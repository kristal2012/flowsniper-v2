/**
 * DIAGNOSTIC TOOL: API Connection Test
 * Tests all external APIs to identify blocking issues
 */

import { proxyManager } from './services/proxy_utils';
import dotenv from 'dotenv';

dotenv.config();

interface ApiTest {
    name: string;
    url: string;
    method?: string;
    expectedField: string;
}

const API_TESTS: ApiTest[] = [
    // Bybit Tests
    {
        name: 'Bybit V5 - POL/USDT',
        url: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=POLUSDT',
        expectedField: 'result.list[0].lastPrice'
    },
    {
        name: 'Bybit V5 - MATIC/USDT',
        url: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=MATICUSDT',
        expectedField: 'result.list[0].lastPrice'
    },
    {
        name: 'Bybit V5 - ETH/USDT',
        url: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=ETHUSDT',
        expectedField: 'result.list[0].lastPrice'
    },
    
    // Binance Tests
    {
        name: 'Binance - POL/USDT',
        url: 'https://api.binance.com/api/v3/ticker/price?symbol=POLUSDT',
        expectedField: 'price'
    },
    {
        name: 'Binance - MATIC/USDT',
        url: 'https://api.binance.com/api/v3/ticker/price?symbol=MATICUSDT',
        expectedField: 'price'
    },
    {
        name: 'Binance - ETH/USDT',
        url: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
        expectedField: 'price'
    },
    
    // CoinGecko Tests
    {
        name: 'CoinGecko - Polygon/MATIC',
        url: 'https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd',
        expectedField: 'matic-network.usd'
    },
    {
        name: 'CoinGecko - Ethereum',
        url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        expectedField: 'ethereum.usd'
    },
    {
        name: 'CoinGecko - Bitcoin',
        url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        expectedField: 'bitcoin.usd'
    },

    // Alternative APIs
    {
        name: 'CryptoCompare - BTC',
        url: 'https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD',
        expectedField: 'USD'
    }
];

function getNestedValue(obj: any, path: string): any {
    return path.split(/[\.\[\]]/).filter(Boolean).reduce((acc, part) => {
        if (acc === null || acc === undefined) return undefined;
        return acc[part];
    }, obj);
}

async function testApi(test: ApiTest, useProxy: boolean = true): Promise<void> {
    const prefix = useProxy ? '🔒 WITH PROXY' : '🌐 DIRECT';
    console.log(`\n${prefix}: ${test.name}`);
    console.log(`URL: ${test.url}`);
    
    try {
        const startTime = Date.now();
        
        const response = useProxy 
            ? await proxyManager.proxyFetch(test.url, { timeout: 10000 })
            : await fetch(test.url);
        
        const elapsed = Date.now() - startTime;
        
        if (!response.ok) {
            console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
            
            // Check if it's a rate limit
            if (response.status === 429) {
                console.log(`   ⚠️  RATE LIMITED - Too many requests`);
                const retryAfter = response.headers.get('retry-after');
                if (retryAfter) console.log(`   Wait ${retryAfter} seconds`);
            }
            
            // Check if it's blocked
            if (response.status === 403) {
                console.log(`   🚫 BLOCKED - Access denied (possible IP/region ban)`);
            }
            
            // Try to get error body
            try {
                const errorText = await response.text();
                console.log(`   Error: ${errorText.substring(0, 200)}`);
            } catch {}
            
            return;
        }
        
        const data = await response.json();
        const value = getNestedValue(data, test.expectedField);
        
        if (value !== undefined && value !== null) {
            console.log(`✅ SUCCESS (${elapsed}ms)`);
            console.log(`   Value: ${JSON.stringify(value)}`);
        } else {
            console.log(`⚠️  SUCCESS but field not found`);
            console.log(`   Expected: ${test.expectedField}`);
            console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}`);
        }
        
    } catch (error: any) {
        console.log(`❌ FAILED: ${error.message}`);
        
        // Check error type
        if (error.code === 'ECONNREFUSED') {
            console.log(`   Connection refused`);
        } else if (error.code === 'ETIMEDOUT') {
            console.log(`   Connection timeout`);
        } else if (error.code === 'ENOTFOUND') {
            console.log(`   DNS resolution failed`);
        } else if (error.message.includes('fetch')) {
            console.log(`   Network error - possible firewall/proxy issue`);
        }
    }
}

async function testRpcConnection() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔗 Testing RPC Connection`);
    console.log('='.repeat(70));
    
    const rpcUrl = process.env.VITE_POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/iRsg1SsPMDZZ9s5kHsRbH';
    console.log(`RPC: ${rpcUrl.substring(0, 50)}...`);
    
    try {
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const blockNumber = parseInt(data.result, 16);
            console.log(`✅ RPC Connected - Block: ${blockNumber}`);
        } else {
            console.log(`❌ RPC Failed - HTTP ${response.status}`);
        }
    } catch (error: any) {
        console.log(`❌ RPC Error: ${error.message}`);
    }
}

async function testProxyStatus() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔒 Proxy Configuration`);
    console.log('='.repeat(70));
    
    const proxyEnabled = process.env.VITE_PROXY_ENABLED === 'true';
    const proxyUrl = process.env.VITE_PROXY_URL || 'not set';
    
    console.log(`Proxy Enabled: ${proxyEnabled}`);
    if (proxyEnabled) {
        const masked = proxyUrl.replace(/:([^:@]+)@/, ':****@');
        console.log(`Proxy URL: ${masked}`);
        
        // Test proxy connectivity
        try {
            const isValid = await proxyManager.validateConnection();
            console.log(`Proxy Status: ${isValid ? '✅ Connected' : '❌ Failed'}`);
        } catch (e: any) {
            console.log(`Proxy Status: ❌ Error - ${e.message}`);
        }
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('🔍 API CONNECTIVITY DIAGNOSTIC');
    console.log('='.repeat(70));
    console.log('Purpose: Identify if APIs are being blocked by:');
    console.log('  - Rate limits');
    console.log('  - IP/Region bans');
    console.log('  - Proxy issues');
    console.log('  - Firewall rules');
    console.log('='.repeat(70));

    // Test proxy
    await testProxyStatus();
    
    // Test RPC
    await testRpcConnection();

    // Test each API with proxy
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📡 Testing APIs WITH Proxy`);
    console.log('='.repeat(70));
    
    for (const test of API_TESTS) {
        await testApi(test, true);
        await new Promise(r => setTimeout(r, 2000)); // Rate limit friendly
    }

    // Test each API without proxy (direct)
    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`📡 Testing APIs WITHOUT Proxy (Direct Connection)`);
    console.log('='.repeat(70));
    
    for (const test of API_TESTS) {
        await testApi(test, false);
        await new Promise(r => setTimeout(r, 2000));
    }

    // Summary
    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`📊 DIAGNOSTIC SUMMARY`);
    console.log('='.repeat(70));
    console.log(`
If ALL APIs failed:
  → Check internet connection
  → Check if running behind corporate firewall
  → Check if ISP is blocking crypto APIs

If only SOME APIs failed:
  → Check for rate limits (429 errors)
  → Check for IP bans (403 errors)
  → Try using a different proxy

If RPC failed but APIs work:
  → RPC endpoint issue
  → Try different RPC (Alchemy, Infura, public RPCs)

If ALL tests passed but bot still doesn't work:
  → Issue is in strategy logic, not API connectivity
    `);
}

main().catch(console.error);

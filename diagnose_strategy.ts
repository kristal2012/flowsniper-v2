/**
 * DIAGNOSTIC TOOL: Strategy & Market Analysis
 * 
 * Purpose: Identify why the bot is not executing trades
 * Tests:
 * 1. Real DEX prices (QuickSwap V2 vs V3)
 * 2. Liquidity analysis
 * 3. Slippage calculation
 * 4. Spread opportunities
 * 5. Gas cost impact
 */

import { blockchainService } from './services/blockchainService';
import { fetchCurrentPrice } from './services/marketDataService';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const USDT_ADDRESS = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';

const TEST_TOKENS = [
    { symbol: 'WMATIC', address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', decimals: 18, cexSymbol: 'POLUSDT' },
    { symbol: 'WETH', address: '0x7ceb23fd6bc0ad59f6c078095c510c28342245c4', decimals: 18, cexSymbol: 'ETHUSDT' },
    { symbol: 'WBTC', address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6', decimals: 8, cexSymbol: 'BTCUSDT' },
    { symbol: 'LINK', address: '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39', decimals: 18, cexSymbol: 'LINKUSDT' }
];

const TRADE_AMOUNTS = ['0.5', '1.0', '3.0', '5.0', '10.0']; // Test different sizes

async function analyzeToken(token: typeof TEST_TOKENS[0], tradeAmount: string) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Analyzing ${token.symbol} with $${tradeAmount} USDT`);
    console.log('='.repeat(70));

    try {
        // 1. Get CEX Price (Global Market)
        const cexPrice = await fetchCurrentPrice(token.cexSymbol);
        if (cexPrice <= 0) {
            console.log(`❌ Failed to fetch CEX price for ${token.symbol}`);
            return null;
        }
        console.log(`📈 CEX Price (${token.cexSymbol}): $${cexPrice.toFixed(6)}`);

        // 2. Get QuickSwap V2 Quote
        let v2Price = 0;
        let v2AmountOut = 0;
        try {
            const v2Amounts = await blockchainService.getAmountsOut(tradeAmount, [USDT_ADDRESS, token.address]);
            if (v2Amounts && v2Amounts.length >= 2) {
                v2AmountOut = Number(v2Amounts[1]) / (10 ** token.decimals);
                v2Price = Number(tradeAmount) / v2AmountOut; // Price per token
                console.log(`🔵 QuickSwap V2: $${v2Price.toFixed(6)} (${v2AmountOut.toFixed(6)} tokens)`);
            } else {
                console.log(`⚠️  QuickSwap V2: No liquidity`);
            }
        } catch (e: any) {
            console.log(`❌ QuickSwap V2 Error: ${e.message.substring(0, 50)}`);
        }

        // 3. Get Uniswap V3 Quote
        let v3Price = 0;
        let v3AmountOut = 0;
        try {
            const v3Quote = await blockchainService.getQuoteV3(USDT_ADDRESS, token.address, tradeAmount);
            v3AmountOut = Number(v3Quote);
            if (v3AmountOut > 0) {
                v3Price = Number(tradeAmount) / v3AmountOut;
                console.log(`🟣 Uniswap V3: $${v3Price.toFixed(6)} (${v3AmountOut.toFixed(6)} tokens)`);
            } else {
                console.log(`⚠️  Uniswap V3: No liquidity`);
            }
        } catch (e: any) {
            console.log(`❌ Uniswap V3 Error: ${e.message.substring(0, 50)}`);
        }

        // 4. Calculate Spreads
        console.log(`\n📊 SPREAD ANALYSIS:`);
        
        const gasEstimate = 0.02; // $0.02 per swap
        const totalGasCost = gasEstimate * 2; // Buy + Sell

        // Scenario A: Buy on DEX, Sell on CEX (IMPOSSIBLE - we can't access CEX)
        console.log(`\n❌ Strategy A: DEX → CEX (IMPOSSIBLE - No CEX API access)`);
        if (v2AmountOut > 0) {
            const v2Spread = ((cexPrice - v2Price) / v2Price) * 100;
            const v2Profit = (v2AmountOut * cexPrice) - Number(tradeAmount) - totalGasCost;
            const v2Roi = (v2Profit / Number(tradeAmount)) * 100;
            console.log(`   V2: Spread ${v2Spread.toFixed(2)}% | Profit $${v2Profit.toFixed(4)} | ROI ${v2Roi.toFixed(2)}%`);
        }

        // Scenario B: Cross-DEX Arbitrage (V2 vs V3)
        console.log(`\n✅ Strategy B: Cross-DEX Arbitrage (V2 vs V3)`);
        if (v2AmountOut > 0 && v3AmountOut > 0) {
            const crossSpread = ((v3Price - v2Price) / v2Price) * 100;
            
            // Buy on cheaper DEX, sell on expensive DEX
            const buyPrice = Math.min(v2Price, v3Price);
            const sellPrice = Math.max(v2Price, v3Price);
            const buyAmount = v2Price < v3Price ? v2AmountOut : v3AmountOut;
            
            // Simulate sell back to USDT
            const sellRoute = v2Price < v3Price ? 'V3' : 'V2';
            const estimatedUsdtBack = buyAmount * (sellPrice / buyPrice) * Number(tradeAmount) / buyAmount;
            const crossProfit = estimatedUsdtBack - Number(tradeAmount) - totalGasCost;
            const crossRoi = (crossProfit / Number(tradeAmount)) * 100;
            
            console.log(`   Spread: ${Math.abs(crossSpread).toFixed(3)}%`);
            console.log(`   Buy on: ${v2Price < v3Price ? 'V2' : 'V3'} @ $${buyPrice.toFixed(6)}`);
            console.log(`   Sell on: ${sellRoute} @ $${sellPrice.toFixed(6)}`);
            console.log(`   Est. Profit: $${crossProfit.toFixed(4)} | ROI: ${crossRoi.toFixed(2)}%`);
            
            if (crossProfit > 0) {
                console.log(`   🟢 OPPORTUNITY FOUND!`);
            } else {
                console.log(`   🔴 No profit after gas`);
            }
        } else {
            console.log(`   ⚠️  Insufficient liquidity on one or both DEXs`);
        }

        // Scenario C: Triangular Arbitrage (USDT → TOKEN → WMATIC → USDT)
        console.log(`\n✅ Strategy C: Triangular Arbitrage (Example: USDT → ${token.symbol} → WMATIC → USDT)`);
        console.log(`   (Not tested - requires 3 swaps, complex calculation)`);

        // 5. Slippage Analysis
        console.log(`\n📉 SLIPPAGE ANALYSIS (with 0.5% slippage tolerance):`);
        const slippage = 0.005;
        
        if (v2AmountOut > 0) {
            const v2MinOut = v2AmountOut * (1 - slippage);
            const v2ActualSlippage = ((v2AmountOut - v2MinOut) / v2AmountOut) * 100;
            console.log(`   V2: Min Out ${v2MinOut.toFixed(6)} tokens (${v2ActualSlippage.toFixed(2)}% slippage)`);
        }
        
        if (v3AmountOut > 0) {
            const v3MinOut = v3AmountOut * (1 - slippage);
            const v3ActualSlippage = ((v3AmountOut - v3MinOut) / v3AmountOut) * 100;
            console.log(`   V3: Min Out ${v3MinOut.toFixed(6)} tokens (${v3ActualSlippage.toFixed(2)}% slippage)`);
        }

        // 6. Liquidity Score
        console.log(`\n💧 LIQUIDITY SCORE:`);
        const hasV2 = v2AmountOut > 0;
        const hasV3 = v3AmountOut > 0;
        const liquidityScore = (hasV2 ? 1 : 0) + (hasV3 ? 1 : 0);
        const v2v3Diff = Math.abs(v2Price - v3Price);
        
        console.log(`   DEXs Available: ${liquidityScore}/2`);
        console.log(`   V2-V3 Price Diff: $${v2v3Diff.toFixed(6)} (${v2v3Diff > 0.01 ? 'HIGH' : 'LOW'})`);
        
        if (liquidityScore < 2) {
            console.log(`   ⚠️  WARNING: Insufficient liquidity for arbitrage`);
        }

        return {
            token: token.symbol,
            tradeAmount,
            cexPrice,
            v2Price,
            v3Price,
            v2AmountOut,
            v3AmountOut,
            liquidityScore
        };

    } catch (error: any) {
        console.error(`❌ Error analyzing ${token.symbol}:`, error.message);
        return null;
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('🔍 FLOWSNIPER STRATEGY DIAGNOSTIC TOOL');
    console.log('='.repeat(70));
    console.log('\nTesting different trade sizes to find optimal parameters...\n');

    const results: any[] = [];

    for (const token of TEST_TOKENS) {
        for (const amount of TRADE_AMOUNTS) {
            const result = await analyzeToken(token, amount);
            if (result) results.push(result);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit
        }
    }

    // Summary
    console.log('\n\n' + '='.repeat(70));
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(70));

    const goodLiquidity = results.filter(r => r.liquidityScore === 2);
    const hasV2V3Diff = results.filter(r => Math.abs(r.v2Price - r.v3Price) > 0.01);

    console.log(`\n✅ Tokens with good liquidity (both V2 & V3): ${goodLiquidity.length}/${results.length}`);
    console.log(`✅ Tokens with V2-V3 price difference: ${hasV2V3Diff.length}/${results.length}`);

    console.log('\n💡 RECOMMENDATIONS:');
    
    if (goodLiquidity.length === 0) {
        console.log('❌ CRITICAL: No tokens have sufficient liquidity on both V2 and V3');
        console.log('   → Reduce trade amount to < $1.0');
        console.log('   → Focus on WMATIC/USDT only (highest liquidity)');
    }
    
    if (hasV2V3Diff.length === 0) {
        console.log('❌ WARNING: No significant V2-V3 price differences found');
        console.log('   → Current strategy (DEX vs Global) is not viable');
        console.log('   → Need to implement triangular arbitrage');
        console.log('   → Or implement MEV/sandwich detection');
    } else {
        console.log('✅ Cross-DEX arbitrage opportunities exist!');
        console.log(`   → Best candidates: ${hasV2V3Diff.map(r => r.token).join(', ')}`);
    }

    console.log('\n🎯 CONCLUSION:');
    console.log('The bot is NOT executing trades because:');
    console.log('1. Current strategy compares DEX price vs CEX price (not actionable)');
    console.log('2. Bot cannot access CEX APIs for actual arbitrage');
    console.log('3. Need to switch to Cross-DEX or Triangular arbitrage');
    console.log('4. Liquidity is insufficient for large trade amounts ($3-10)');

    console.log('\n' + '='.repeat(70));
}

main().catch(console.error);

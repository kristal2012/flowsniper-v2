
import { blockchainService } from './blockchainService';
import { TOKENS } from '../types';

export interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const BYBIT_V5_URL = '/bybit-api/v5/market';

export const fetchHistoricalData = async (symbol: string = 'POLUSDT', interval: string = '1', limit: number = 50): Promise<CandleData[]> => {
    try {
        const url = `${BYBIT_V5_URL}/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
        console.log("Fetching Historical Data from:", url);
        const response = await fetch(url);
        const data = await response.json();

        if (data.retCode === 0 && data.result && data.result.list && data.result.list.length > 0) {
            return data.result.list.map((item: any) => ({
                time: parseInt(item[0]),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            })).reverse();
        }
        throw new Error("Bybit data empty or invalid");
    } catch (error) {
        console.warn("Bybit Fetch failed, trying Binance fallback...", error);
        try {
            // Binance Fallback (Public API usually has better CORS/Availability)
            // Binance uses 1m, 5m, etc. instead of 1.
            const binanceInterval = interval === '1' ? '1m' : (interval + 'm');
            // Binance symbol for MATIC/POL is POLUSDT
            const binanceSymbol = symbol;
            const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`;
            const bResp = await fetch(binanceUrl);
            const bData = await bResp.json();

            return bData.map((item: any) => ({
                time: item[0],
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            }));
        } catch (bError) {
            console.error("All data sources failed:", bError);
            return [];
        }
    }
};

export interface PriceResult {
    price: number;
    source: string;
}

export const fetchCurrentPrice = async (symbol: string = 'POLUSDT'): Promise<PriceResult> => {
    // Normalize symbols for Binance (WMATIC -> MATIC)
    const normalizedSymbol = symbol.replace('WMATIC', 'MATIC').replace('POL', 'MATIC');

    const withTimeout = (promise: Promise<any>, ms: number) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
        ]);
    };

    // 0. Try Serverless Proxy (Reliable, No CORS) [v4.1.8]
    try {
        const resp = await withTimeout(
            fetch(`/api/price?symbol=${normalizedSymbol}`).then(r => r.json()),
            6000
        );
        if (resp && resp.price > 0) {
            console.log(`[MarketData] ${normalizedSymbol} price fetched from SERVER PROXY (${resp.source}): $${resp.price} [v4.1.8]`);
            return { price: resp.price, source: `proxy-${resp.source}` };
        }
    } catch (e: any) {
        console.error(`[MarketData] Proxy Exception:`, e.message);
    }

    // 1. Try Direct Fallbacks (Bybit/Binance) - Might be blocked by CORS but worth a shot
    const candidates = [normalizedSymbol];
    if (symbol !== normalizedSymbol) candidates.push(symbol);

    for (const s of candidates) {
        try {
            const data = await withTimeout(
                fetch(`${BYBIT_V5_URL}/tickers?category=linear&symbol=${s}`).then(r => r.json()),
                5000
            );
            if (data.retCode === 0 && data.result?.list?.length > 0) {
                const p = parseFloat(data.result.list[0].lastPrice);
                return { price: p, source: 'bybit-direct' };
            }
        } catch (e) { }
    }

    // ... (Blockchain Fallback stays same but returns source: 'blockchain')
    try {
        const coinGeckoMap: { [key: string]: string } = {
            'POLUSDT': 'matic-network', 'MATICUSDT': 'matic-network', 'WMATICUSDT': 'matic-network',
            'ETHUSDT': 'ethereum', 'BTCUSDT': 'bitcoin', 'USDCUSDT': 'usd-coin',
            'DAIUSDT': 'dai', 'LINKUSDT': 'chainlink', 'UNIUSDT': 'uniswap',
            'GHSTUSDT': 'aavegotchi', 'LDOUSDT': 'lido-dao', 'GRTUSDT': 'the-graph'
        };
        const coinId = coinGeckoMap[normalizedSymbol] || coinGeckoMap[symbol];
        if (coinId) {
            const cgResp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
            const cgData = await cgResp.json();
            const p = cgData[coinId]?.usd || 0;
            if (p > 0) return { price: p, source: 'coingecko-direct' };
        }
    } catch (e) { }

    // Final Blockchain Resort
    try {
        const searchPart = normalizedSymbol.replace('USDT', '').replace('USDC', '').replace('ETH', '').replace('BTC', '');
        let tokenKey = searchPart;
        if (tokenKey === 'W' || tokenKey === '') tokenKey = 'WMATIC';
        const tokenAddress = TOKENS[tokenKey] || TOKENS[searchPart];
        const usdtAddress = TOKENS['USDT'];

        if (tokenAddress && usdtAddress) {
            const quote = await blockchainService.getQuoteV3(tokenAddress, usdtAddress, "1.0");
            const p = parseFloat(quote);
            if (p > 0) return { price: p, source: 'blockchain' };
        }
    } catch (e) { }

    return { price: 0, source: 'failed' };
};

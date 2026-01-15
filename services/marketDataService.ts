
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

export const fetchCurrentPrice = async (symbol: string = 'POLUSDT'): Promise<number> => {
    // Normalize symbols for Binance (WMATIC -> MATIC)
    const normalizedSymbol = symbol.replace('WMATIC', 'MATIC').replace('POL', 'MATIC');

    const withTimeout = (promise: Promise<any>, ms: number) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
        ]);
    };

    // List of symbol variations to try
    const candidates = [normalizedSymbol];
    if (symbol !== normalizedSymbol) candidates.push(symbol);
    if (symbol.includes('POL') && !candidates.includes('MATICUSDT')) candidates.push(symbol.replace('POL', 'MATIC'));
    if (symbol.includes('MATIC') && !candidates.includes('POLUSDT')) candidates.push(symbol.replace('MATIC', 'POL'));

    // 1. Try Bybit
    for (const s of candidates) {
        try {
            const data = await withTimeout(
                fetch(`${BYBIT_V5_URL}/tickers?category=linear&symbol=${s}`).then(r => r.json()),
                5000
            );
            if (data.retCode === 0 && data.result?.list?.length > 0) {
                const p = parseFloat(data.result.list[0].lastPrice);
                console.log(`[MarketData] ${s} price fetched from Bybit: $${p}`);
                return p;
            }
        } catch (e) { /* continued */ }
    }

    // 2. Try Binance
    for (const s of candidates) {
        try {
            const data = await withTimeout(
                fetch(`/binance-api/api/v3/ticker/price?symbol=${s}`).then(r => r.json()),
                5000
            );
            if (data.price) {
                const p = parseFloat(data.price);
                console.log(`[MarketData] ${s} price fetched from Binance: $${p}`);
                return p;
            }
        } catch (e) { /* continued */ }
    }

    console.warn(`[MarketData] Primary exchanges failed for ${symbol}, trying CoinGecko...`);
    try {
        const coinGeckoMap: { [key: string]: string } = {
            'POLUSDT': 'matic-network',
            'MATICUSDT': 'matic-network',
            'WMATICUSDT': 'matic-network',
            'ETHUSDT': 'ethereum',
            'BTCUSDT': 'bitcoin',
            'USDCUSDT': 'usd-coin',
            'DAIUSDT': 'dai',
            'LINKUSDT': 'chainlink',
            'UNIUSDT': 'uniswap',
            'GHSTUSDT': 'aavegotchi',
            'LDOUSDT': 'lido-dao',
            'GRTUSDT': 'the-graph'
        };
        const coinId = coinGeckoMap[normalizedSymbol] || coinGeckoMap[symbol];

        if (!coinId) throw new Error(`CoinGecko ID not found for ${symbol}`);

        const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
        const cgResp = await fetch(cgUrl);
        const cgData = await cgResp.json();
        const p = cgData[coinId]?.usd || 0;
        if (p > 0) console.log(`[MarketData] ${symbol} price fetched from CoinGecko: $${p}`);
        return p;
    } catch (cgError) {
        console.warn(`[MarketData] External APIs failed for ${symbol}, attempting Blockchain Fallback (Uniswap V3)...`);
        try {
            // Final Resort: Fetch reference price directly from Chain via Uniswap V3
            const tokenAddress = TOKENS[normalizedSymbol.replace('USDT', '')];
            const usdtAddress = TOKENS['USDT'];

            if (tokenAddress && usdtAddress) {
                // Fetch price for 1 token in USDT terms
                const quote = await blockchainService.getQuoteV3(tokenAddress, usdtAddress, "1.0").catch(() => "0");
                const p = parseFloat(quote);
                if (p > 0) {
                    console.log(`[MarketData] ${symbol} price fetched from BLOCKCHAIN (V3): $${p}`);
                    return p;
                }
            }
            throw new Error("No blockchain quote available for " + symbol);
        } catch (chainError) {
            console.error(`[MarketData] FATAL: All sources (including Blockchain) failed for ${symbol}`, chainError);
            return 0;
        }
    }
};

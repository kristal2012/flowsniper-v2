
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

// CACHE SYSTEM
const PRICE_CACHE = new Map<string, { price: number, timestamp: number }>();
const CACHE_DURATION_MS = 10000; // 10 seconds cache

export const fetchHistoricalData = async (symbol: string = 'POLUSDT', interval: string = '1', limit: number = 50): Promise<CandleData[]> => {
    // CryptoCompare HistoMinute
    try {
        const fsym = symbol.replace('USDT', '').replace('W', ''); // POL, BTC, ETH
        const url = `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${fsym}&tsym=USD&limit=${limit}&aggregate=${interval}`;

        console.log(`[MarketData] Fetching history from CryptoCompare: ${fsym}`);
        const response = await fetch(url);
        const data = await response.json();

        if (data.Response === 'Success' && data.Data && data.Data.Data) {
            return data.Data.Data.map((item: any) => ({
                time: item.time * 1000,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volumeto
            }));
        }
        throw new Error("CryptoCompare data empty");
    } catch (error) {
        console.warn("[MarketData] Historical fetch failed:", error);
        return [];
    }
};

export interface PriceResult {
    price: number;
    source: string;
}

export const fetchCurrentPrice = async (symbol: string = 'POLUSDT'): Promise<PriceResult> => {
    // 1. CHECK CACHE
    const cached = PRICE_CACHE.get(symbol);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION_MS)) {
        return { price: cached.price, source: 'cache' };
    }

    const normalizedSymbol = symbol.replace('WMATIC', 'MATIC').replace('POL', 'MATIC');
    const fsym = normalizedSymbol.replace('USDT', '');

    // 2. CRYPTOCOMPARE (Primary - No Block)
    try {
        const url = `https://min-api.cryptocompare.com/data/price?fsym=${fsym}&tsyms=USD`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.USD > 0) {
            PRICE_CACHE.set(symbol, { price: data.USD, timestamp: Date.now() });
            return { price: data.USD, source: 'cryptocompare' };
        }
    } catch (e) {
        console.warn(`[MarketData] CryptoCompare failed for ${symbol}`);
    }

    // 3. COINGECKO (Fallback - Rate Limited)
    try {
        const coinGeckoMap: { [key: string]: string } = {
            'POLUSDT': 'matic-network', 'MATICUSDT': 'matic-network', 'WMATICUSDT': 'matic-network',
            'ETHUSDT': 'ethereum', 'BTCUSDT': 'bitcoin', 'USDCUSDT': 'usd-coin',
            'DAIUSDT': 'dai', 'LINKUSDT': 'chainlink', 'UNIUSDT': 'uniswap'
        };
        const coinId = coinGeckoMap[normalizedSymbol] || coinGeckoMap[symbol];
        if (coinId) {
            const cgResp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
            const cgData = await cgResp.json();
            const p = cgData[coinId]?.usd || 0;
            if (p > 0) {
                PRICE_CACHE.set(symbol, { price: p, timestamp: Date.now() });
                return { price: p, source: 'coingecko' };
            }
        }
    } catch (e) {
        // rate limit mostly
    }

    // 4. BLOCKCHAIN (Last Resort - Slow/Expensive)
    try {
        let tokenKey = fsym;
        if (tokenKey === 'W' || tokenKey === '') tokenKey = 'WMATIC';
        const tokenAddress = TOKENS[tokenKey] || TOKENS[fsym];
        const usdtAddress = TOKENS['USDT'];

        if (tokenAddress && usdtAddress) {
            const result = await blockchainService.getQuoteV3(tokenAddress, usdtAddress, "1.0");
            const p = parseFloat(result.quote);
            if (p > 0) {
                return { price: p, source: 'blockchain' };
            }
        }
    } catch (e) { }

    return { price: 0, source: 'failed' };
};

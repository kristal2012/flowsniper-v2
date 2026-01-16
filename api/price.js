
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

// Simple in-memory cache
let cache = {};

export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol' });
    }

    const s = symbol.toUpperCase();
    const now = Date.now();

    // 1. Check Cache (2s TTL)
    if (cache[s] && (now - cache[s].ts < 2000)) {
        return res.status(200).json(cache[s].data);
    }

    // Proxy Configuration from Env
    const proxyUrl = process.env.VITE_PROXY_URL;
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;
    const fetchOptions = agent ? { agent } : {};

    // Attempt Fetch from CEXs
    let result = null;

    // Bybit
    try {
        const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${s}`, {
            ...fetchOptions,
            headers: { 'Content-Type': 'application/json' },
            timeout: 4000
        });
        const data = await response.json();
        if (data.retCode === 0 && data.result?.list?.length > 0) {
            const price = parseFloat(data.result.list[0].lastPrice);
            if (price > 0) result = { price, source: 'bybit' };
        }
    } catch (e) {
        console.log("Bybit fetch failed in proxy:", e.message);
    }

    // Binance
    if (!result) {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`, {
                ...fetchOptions,
                timeout: 4000
            });
            const data = await response.json();
            if (data.price) {
                const price = parseFloat(data.price);
                if (price > 0) result = { price, source: 'binance' };
            }
        } catch (e) {
            console.log("Binance fetch failed in proxy:", e.message);
        }
    }

    // CoinGecko
    if (!result) {
        try {
            const cgMap = {
                'POLUSDT': 'matic-network', 'MATICUSDT': 'matic-network', 'WMATICUSDT': 'matic-network', 'ETHUSDT': 'ethereum',
                'BTCUSDT': 'bitcoin', 'USDCUSDT': 'usd-coin', 'DAIUSDT': 'dai', 'LINKUSDT': 'chainlink',
                'UNIUSDT': 'uniswap', 'LDOUSDT': 'lido-dao', 'SOLUSDT': 'solana', 'GHSTUSDT': 'aavegotchi',
                'GRTUSDT': 'the-graph', 'AAVEUSDT': 'aave', 'QUICKUSDT': 'quick'
            };
            const coinId = cgMap[s];
            if (coinId) {
                const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, {
                    ...fetchOptions,
                    timeout: 5000
                });
                const data = await response.json();
                const price = data[coinId]?.usd;
                if (price > 0) result = { price, source: 'coingecko' };
            }
        } catch (e) {
            console.log("CoinGecko fetch failed in proxy:", e.message);
        }
    }

    if (result) {
        // Save to cache
        cache[s] = { ts: now, data: result };
        return res.status(200).json(result);
    }

    return res.status(502).json({ error: 'All price sources failed in backend proxy (with dedicated proxy)', symbol: s });
}

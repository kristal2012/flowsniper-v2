
export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol' });
    }

    // Normalize for API calls
    const s = symbol.toUpperCase();

    // 1. Try Bybit (High Rate Limit)
    try {
        const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${s}`, {
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(4000)
        });
        const data = await response.json();
        if (data.retCode === 0 && data.result?.list?.length > 0) {
            const price = parseFloat(data.result.list[0].lastPrice);
            if (price > 0) return res.status(200).json({ price, source: 'bybit' });
        }
    } catch (e) {
        console.log("Bybit fetch failed in proxy:", e.message);
    }

    // 2. Try Binance
    try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`, {
            signal: AbortSignal.timeout(4000)
        });
        const data = await response.json();
        if (data.price) {
            const price = parseFloat(data.price);
            if (price > 0) return res.status(200).json({ price, source: 'binance' });
        }
    } catch (e) {
        console.log("Binance fetch failed in proxy:", e.message);
    }

    // 3. Try CoinGecko ID Map as last resort (Node side)
    try {
        const cgMap = {
            'POLUSDT': 'matic-network', 'MATICUSDT': 'matic-network', 'ETHUSDT': 'ethereum',
            'BTCUSDT': 'bitcoin', 'USDCUSDT': 'usd-coin', 'DAIUSDT': 'dai', 'LINKUSDT': 'chainlink',
            'UNIUSDT': 'uniswap', 'LDOUSDT': 'lido-dao', 'SOLUSDT': 'solana'
        };
        const coinId = cgMap[s];
        if (coinId) {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, {
                signal: AbortSignal.timeout(5000)
            });
            const data = await response.json();
            const price = data[coinId]?.usd;
            if (price > 0) return res.status(200).json({ price, source: 'coingecko' });
        }
    } catch (e) {
        console.log("CoinGecko fetch failed in proxy:", e.message);
    }

    return res.status(502).json({ error: 'All price sources failed in backend proxy', symbol: s });
}


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
    try {
        const response = await fetch(`${BYBIT_V5_URL}/tickers?category=linear&symbol=${symbol}`);
        const data = await response.json();

        if (data.retCode !== 0) {
            console.error("Bybit Price Detail Error:", data);
            throw new Error(`Bybit API Error: ${data.retMsg}`);
        }

        if (!data.result || !data.result.list || data.result.list.length === 0) {
            throw new Error(`Symbol ${symbol} not found or no data available.`);
        }

        return parseFloat(data.result.list[0].lastPrice);
    } catch (error) {
        console.error("Current Price Fetch Error:", error);
        return 0;
    }
};


export interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const BYBIT_V5_URL = '/bybit-api/v5/market';

export const fetchHistoricalData = async (symbol: string = 'MATICUSDT', interval: string = '1', limit: number = 50): Promise<CandleData[]> => {
    try {
        const response = await fetch(`${BYBIT_V5_URL}/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`);
        const data = await response.json();

        if (data.retCode !== 0) {
            throw new Error(`Bybit API Error: ${data.retMsg}`);
        }

        // Bybit returns [startTime, open, high, low, close, volume, turnover]
        return data.result.list.map((item: any) => ({
            time: parseInt(item[0]),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5])
        })).reverse(); // Return in chronological order
    } catch (error) {
        console.error("Historical Data Fetch Error:", error);
        return [];
    }
};

export const fetchCurrentPrice = async (symbol: string = 'MATICUSDT'): Promise<number> => {
    try {
        const response = await fetch(`${BYBIT_V5_URL}/tickers?category=linear&symbol=${symbol}`);
        const data = await response.json();

        if (data.retCode !== 0) {
            throw new Error(`Bybit API Error: ${data.retMsg}`);
        }

        return parseFloat(data.result.list[0].lastPrice);
    } catch (error) {
        console.error("Current Price Fetch Error:", error);
        return 0;
    }
};

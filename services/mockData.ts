
import { Asset, Transaction, PerformanceData, ManagerProfile } from '../types';

export const mockManager: ManagerProfile = {
  address: '0x77E8A5a3077Cfdd3AA080D6c4219110814cA8F6E',
  name: 'AG Capital Alpha Strategist',
  totalAum: 1254300.55,
  pnlAllTime: 452100.20,
  pnlMonthly: 12450.15,
  winRate: 68.4,
  tradesCount: 1242
};

export const mockAssets: Asset[] = [
  { symbol: 'BTC', name: 'Bitcoin', balance: 12.4, valueUsd: 843200, price: 68000, allocation: 67.2, change24h: 2.4 },
  { symbol: 'ETH', name: 'Ethereum', balance: 85.5, valueUsd: 213750, price: 2500, allocation: 17.1, change24h: -1.2 },
  { symbol: 'SOL', name: 'Solana', balance: 450, valueUsd: 63000, price: 140, allocation: 5.0, change24h: 5.8 },
  { symbol: 'USDC', name: 'USD Coin', balance: 134350, valueUsd: 134350, price: 1.0, allocation: 10.7, change24h: 0.01 },
];

export const mockPerformance: PerformanceData[] = Array.from({ length: 30 }, (_, i) => ({
  timestamp: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  pnl: Math.random() * 50000 - 15000,
  equity: 1200000 + (Math.random() * 100000 - 50000)
}));

export const mockTransactions: Transaction[] = [
  { id: '1', type: 'BUY', asset: 'BTC', amount: 0.5, price: 67500, total: 33750, timestamp: '2023-11-20T14:30:00Z', status: 'COMPLETED', txHash: '0xabc...123' },
  { id: '2', type: 'SELL', asset: 'ETH', amount: 10, price: 2550, total: 25500, timestamp: '2023-11-19T09:15:00Z', status: 'COMPLETED', txHash: '0xdef...456' },
  { id: '3', type: 'SWAP', asset: 'SOL', amount: 100, price: 135, total: 13500, timestamp: '2023-11-18T18:45:00Z', status: 'COMPLETED', txHash: '0xghi...789' },
  { id: '4', type: 'BUY', asset: 'BTC', amount: 0.2, price: 68100, total: 13620, timestamp: '2023-11-17T11:20:00Z', status: 'COMPLETED', txHash: '0xjkl...012' },
  { id: '5', type: 'TRANSFER', asset: 'USDC', amount: 5000, price: 1, total: 5000, timestamp: '2023-11-16T15:00:00Z', status: 'COMPLETED', txHash: '0xmno...345' },
];

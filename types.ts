
export interface Asset {
  symbol: string;
  name: string;
  balance: number;
  valueUsd: number;
  price: number;
  allocation: number;
  change24h: number;
}

export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL' | 'TRANSFER' | 'SWAP' | 'BOT_TRADE';
  asset: string;
  amount: number;
  price: number;
  total: number;
  timestamp: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  txHash: string;
  details?: string;
}

export interface PerformanceData {
  timestamp: string;
  pnl: number;
  equity: number;
}

export interface ManagerProfile {
  address: string;
  name: string;
  totalAum: number;
  pnlAllTime: number;
  pnlMonthly: number;
  winRate: number;
  tradesCount: number;
}

export interface BotInstance {
  id: string;
  name: string;
  status: 'RUNNING' | 'STOPPED' | 'PAUSED';
  strategy: 'SLIPPAGE_LP_ALPHA';
  network: 'POLYGON';
  tvl: number;
  dailyProfit: number;
  activeOps: number;
  profitSplit: number; // e.g., 0.7 for 70%
}

export type FlowOperation =
  | 'SLIPPAGE_SWAP'
  | 'LP_FEE_CAPTURE'
  | 'SANDWICH_DETECTION'
  | 'CROSS_DEX_LIQUIDITY'
  | 'ROUTE_OPTIMIZATION'
  | 'LIQUIDITY_SCAN'
  | 'ASSET_CONSOLIDATION'
  | 'SCAN_PULSE';

export const SUPPORTED_PAIRS = [
  'POL/USDT',
  'WBTC/USDT',
  'WETH/USDT',
  'POL/ETH',
  'WBTC/ETH'
];

export interface FlowStep {
  id: string;
  timestamp: string;
  type: FlowOperation;
  pair: string; // e.g. "WMATIC/USDC"
  profit: number;
  status: 'SUCCESS' | 'FAILED';
  hash: string;
}

export interface SniperStep {
  id: string;
  timestamp: string;
  path: string[];
  profit: number;
  status: 'SUCCESS' | 'EXPIRED';
  hash: string;
}
// Token Addresses for Polygon
export const TOKENS: { [key: string]: string } = {
  'USDT': '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
  'POL': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  'WMATIC': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  'WETH': '0x7ceb23fd6bc0ad59f6c078095c510c28342245c4',
  'WBTC': '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
  'LINK': '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39',
  'UNI': '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
  'AAVE': '0xd6df30500db6e36d4336069904944f2b93652618',
  'QUICK': '0xf28768daa238a2e52b21697284f1076f8a02c98d',
  'USDC': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  'SOL': '0x7df36098c4f923b7596ad881a70428f62c0199ba',
  'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  'GHST': '0x385Eeac5cB85A38A9a07A70c73e0a3271CfB4333',
  'LDO': '0xC3C7d422809852031b44ab29EEC9F1EfF2A58756',
  'GRT': '0x5fe2B58c01396b03525D42D55DB1a9c1c3d072EE',
  'SAND': '0xBbba073C31fF030612470a227377ec93Ba67f185',
  'CRV': '0x172370d5cd63279efa6d502dc0092d633c4fd4a0',
  'SUSHI': '0x0b3f868e0be5597d5db7feb59e1cadbb0fdda50a',
  'BAL': '0x9a7101136193907487223343a2908fe67646a798',
  'SNX': '0x50b691079bc6a6058d46db080fc85f096701416b',
  'MKR': '0x6f74abc254582f3ef423bc110a3006d649984920'
};

export interface SwapEvent {
  id: string;
  timestamp: string;
  pair: string;
  dex: 'QuickSwap V2' | 'Uniswap V3';
  txHash?: string;
}


import { FlowStep, FlowOperation } from '../types';
import { fetchCurrentPrice } from './marketDataService';

export class FlowSniperEngine {
    private active: boolean = false;
    private onLog: (step: FlowStep) => void;
    private dailyPnl: number = 0;
    private maxDrawdown: number = -5; // 5% limit
    private tradeLimit: number = 3; // $3 max per trade

    constructor(onLog: (step: FlowStep) => void) {
        this.onLog = onLog;
    }

    start() {
        this.active = true;
        this.run();
    }

    stop() {
        this.active = false;
    }

    private async run() {
        while (this.active) {
            if (this.dailyPnl <= this.maxDrawdown) {
                console.warn("Daily drawdown limit reached. Pausing engine.");
                this.stop();
                break;
            }

            const price = await fetchCurrentPrice('MATICUSDT');

            if (price > 0) {
                // Randomly choose between Slippage capture and LP Fee capture
                const isSlippage = Math.random() > 0.4;
                const type: FlowOperation = isSlippage ? 'SLIPPAGE_SWAP' : 'LP_FEE_CAPTURE';

                // Simulations:
                // Slippage profit is usually very small but high frequency
                // LP Fee is based on a fraction of the "simulated volume"
                const profit = isSlippage
                    ? Number((Math.random() * 0.02 + 0.001).toFixed(4)) // Capture of micro-variation
                    : Number((Math.random() * 0.015 + 0.005).toFixed(4)); // LP Fee capture

                this.dailyPnl += profit;

                const step: FlowStep = {
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: new Date().toLocaleTimeString(),
                    type: type,
                    pair: "WMATIC/USDC",
                    profit: profit,
                    status: 'SUCCESS',
                    hash: '0x' + Math.random().toString(16).substr(2, 64)
                };

                this.onLog(step);
            }

            // High frequency simulation: 1-3 seconds
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
        }
    }
}

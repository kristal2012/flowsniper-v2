
import { FlowStep, FlowOperation } from '../types';
import { fetchCurrentPrice } from './marketDataService';

export class FlowSniperEngine {
    private active: boolean = false;
    private onLog: (step: FlowStep) => void;
    private onGasUpdate?: (bal: number) => void;
    private dailyPnl: number = 0;
    private maxDrawdown: number = -5; // 5% limit
    private tradeLimit: number = 3; // $3 max per trade
    private runMode: 'REAL' | 'DEMO' = 'DEMO'; // Default
    private gasBalance: number = 0;
    private aiAnalysis: any = null;

    constructor(onLog: (step: FlowStep) => void, onGasUpdate?: (bal: number) => void) {
        this.onLog = onLog;
        this.onGasUpdate = onGasUpdate;
    }

    start(mode: 'REAL' | 'DEMO', gas: number = 0, analysis: any = null) {
        if (this.active) {
            this.updateContext(gas, analysis);
            this.runMode = mode;
            return;
        }
        this.active = true;
        this.runMode = mode;
        this.gasBalance = gas;
        this.aiAnalysis = analysis;
        console.log("ENGINE STARTED IN MODE:", mode, "GAS:", gas, "AI:", analysis?.action);
        this.run();
    }

    updateContext(gas: number, analysis: any) {
        this.gasBalance = gas;
        this.aiAnalysis = analysis;
    }

    stop() {
        this.active = false;
    }

    private async run() {
        while (this.active) {
            // Stop if drawdown hit
            if (this.dailyPnl <= this.maxDrawdown) {
                console.warn("Daily drawdown limit reached. Pausing engine.");
                this.stop();
                break;
            }

            // Gas check (only for demo simulation logic here, real mode would check wallet)
            if (this.runMode === 'DEMO' && this.gasBalance <= 0) {
                console.warn("Out of gas (DEMO). Motor standby.");
                // We don't stop the bot automatically so user can recharge, but we skip iterations
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            // AI Decision logic
            // If we have AI analysis, we check if it suggests to WAIT or HOLD
            if (this.aiAnalysis && (this.aiAnalysis.action === 'WAIT' || this.aiAnalysis.action === 'HOLD')) {
                console.log("AI suggests to wait. Strategy:", this.aiAnalysis.suggestedStrategy);
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }

            const price = await fetchCurrentPrice('MATICUSDT');

            if (price > 0) {
                // Randomly choose between Slippage capture and LP Fee capture
                const isSlippage = Math.random() > 0.4;
                const type: FlowOperation = isSlippage ? 'SLIPPAGE_SWAP' : 'LP_FEE_CAPTURE';

                // Simulate gas consumption
                const gasCost = 0.005 + (Math.random() * 0.01);
                if (this.runMode === 'DEMO') {
                    this.gasBalance -= gasCost;
                    if (this.onGasUpdate) this.onGasUpdate(this.gasBalance);
                }

                // Simulate decision making
                const profit = isSlippage
                    ? Number((Math.random() * 0.02 + 0.001).toFixed(4))
                    : Number((Math.random() * 0.015 + 0.005).toFixed(4));

                this.dailyPnl += profit;

                const step: FlowStep = {
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: new Date().toLocaleTimeString(),
                    type: type,
                    pair: "WMATIC/USDC",
                    profit: profit,
                    status: 'SUCCESS',
                    hash: this.runMode === 'REAL' ? '0xREAL_' + Math.random().toString(16).substr(2, 10) : '0xSIM_' + Math.random().toString(16).substr(2, 10)
                };

                this.onLog(step);
            }

            // High frequency simulation: 1-3 seconds
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
        }
    }
}

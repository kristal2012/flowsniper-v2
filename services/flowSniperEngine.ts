
import { FlowStep, FlowOperation, TOKENS } from '../types';
import { fetchCurrentPrice, PriceResult } from './marketDataService';
import { blockchainService } from './blockchainService';
import { ethers } from 'ethers';

export class FlowSniperEngine {
    private active: boolean = false;
    private onLog: (step: FlowStep) => void;
    private onGasUpdate?: (bal: number) => void;
    private onBalanceUpdate?: (bal: number) => void;
    private dailyPnl: number = 0;
    private maxDrawdown: number = -5; // 5% limit
    private tradeLimit: number = 3; // $3 max per trade
    private runMode: 'REAL' | 'DEMO' = 'DEMO'; // Default
    private gasBalance: number = 0;
    private totalBalance: number = 0;
    private aiAnalysis: any = null;
    private tradeAmount: string = "10.0"; // Increased for better gas efficiency
    private slippage: number = 0.005; // 0.5%
    private minProfit: number = 0.001; // 0.1%
    private consolidationThreshold: number = 10.0;
    private eventListeners: any[] = [];

    constructor(onLog: (step: FlowStep) => void, onGasUpdate?: (bal: number) => void, onBalanceUpdate?: (bal: number) => void) {
        this.onLog = onLog;
        this.onGasUpdate = onGasUpdate;
        this.onBalanceUpdate = onBalanceUpdate;
    }

    start(mode: 'REAL' | 'DEMO', gas: number = 0, balance: number = 0, analysis: any = null, tradeAmount: string = "10.0", slippage: number = 0.005, minProfit: number = 0.001, consolidationThreshold: number = 10.0) {
        if (this.active) {
            this.updateContext(gas, balance, analysis, tradeAmount, slippage, minProfit, consolidationThreshold);
            this.runMode = mode;
            return;
        }
        this.active = true;
        this.runMode = mode;
        this.gasBalance = gas;
        this.totalBalance = balance;
        this.aiAnalysis = analysis;
        this.tradeAmount = tradeAmount;
        this.slippage = slippage;
        this.minProfit = minProfit;
        this.consolidationThreshold = consolidationThreshold;
        console.log("ENGINE STARTED IN MODE:", mode, "GAS:", gas, "BAL:", balance, "AI:", analysis?.action, "TRADE:", tradeAmount, "SLIPPAGE:", slippage, "THRESHOLD:", consolidationThreshold);
        this.run();
    }

    updateContext(gas: number, balance: number, analysis: any, tradeAmount: string = "10.0", slippage: number = 0.005, minProfit: number = 0.001, consolidationThreshold: number = 10.0) {
        this.gasBalance = gas;
        this.totalBalance = balance;
        this.aiAnalysis = analysis;
        this.tradeAmount = tradeAmount;
        this.slippage = slippage;
        this.minProfit = minProfit;
        this.consolidationThreshold = consolidationThreshold;
    }

    stop() {
        this.active = false;
    }

    private async run() {
        console.log("[SniperEngine] Motor v5.0.0 Event-Driven Iniciado.");

        if (this.runMode === 'REAL') {
            this.setupRealEventListeners();
        }

        while (this.active) {
            try {
                if (this.dailyPnl <= this.maxDrawdown) {
                    this.stop();
                    break;
                }

                if (this.runMode === 'DEMO' && this.gasBalance <= 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }

                if (this.runMode === 'DEMO') {
                    // Simulated events for Demo Mode
                    await this.runDemoSimulation();
                } else {
                    // In REAL mode, we just stay "active" and let listeners handle the work.
                    // Pulse log every 30s to show it's alive
                    this.onLog({
                        id: 'pulse-' + Date.now(),
                        timestamp: new Date().toLocaleTimeString(),
                        type: 'SCAN_PULSE',
                        pair: `📡 Monitoramento Event-Driven Ativo (WSS)...`,
                        profit: 0,
                        status: 'SUCCESS',
                        hash: ''
                    });
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }

            } catch (rootErr: any) {
                console.error("[SniperEngine] Loop Error Caught:", rootErr.message);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        this.cleanupListeners();
    }

    private async setupRealEventListeners() {
        this.cleanupListeners();
        const wsProvider = blockchainService.getWebSocketProvider();
        if (!wsProvider) {
            this.onLog({
                id: 'err-' + Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                type: 'SCAN_PULSE',
                pair: `❌ Erro: Falha ao conectar WebSocket. Verifique o RPC.`,
                profit: 0,
                status: 'FAILED',
                hash: ''
            });
            return;
        }

        const pairsToMonitor = [
            'POLUSDT', 'WETHUSDT', 'WBTCUSDT', 'USDCUSDT', 'LINKUSDT'
        ];

        // Real-time trigger on EVERY new block for maximum speed
        wsProvider.on('block', async (blockNumber: number) => {
            console.log(`[SniperEngine] Block ${blockNumber} detected. Triggering priority scan.`);
            for (const sym of pairsToMonitor) {
                await this.analyzeOpportunity(sym);
            }
        });

        this.eventListeners.push({ provider: wsProvider, event: 'block' });
    }

    private async runDemoSimulation() {
        const symbols = ['POLUSDT', 'WBTCUSDT', 'WETHUSDT', 'USDCUSDT', 'DAIUSDT'];
        const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];

        await this.analyzeOpportunity(randomSymbol);
        await new Promise(r => setTimeout(r, 1000));
    }

    private async analyzeOpportunity(symbol: string) {
        try {
            const tokenIn = TOKENS['USDT'];
            let searchTag = symbol.replace('USDT', '');
            if (searchTag === 'BTC') searchTag = 'WBTC';
            if (searchTag === 'ETH') searchTag = 'WETH';
            if (searchTag === 'POL' || searchTag === 'MATIC') searchTag = 'WMATIC';

            const tokenOut = TOKENS[searchTag];
            if (!tokenOut) return;

            const startTime = performance.now();

            // NEW: Use Multicall for sub-100ms quoting
            const quotes = await blockchainService.getQuotesMulticall(tokenIn, tokenOut, this.tradeAmount);

            const latency = Math.round(performance.now() - startTime);

            // Path A: Buy V2 -> Sell V3
            const amountOutV2 = parseFloat(quotes.v2Buy);
            const sellPriceV3 = parseFloat(quotes.v3SellPrice.quote);
            const profitA = (amountOutV2 * sellPriceV3) - Number(this.tradeAmount);

            // Path B: Buy V3 -> Sell V2
            const amountOutV3 = parseFloat(quotes.v3Buy.quote);
            const sellPriceV2 = parseFloat(quotes.v2SellPrice);
            const profitB = (amountOutV3 * sellPriceV2) - Number(this.tradeAmount);

            // Best Opportunity
            let bestProfit = Math.max(profitA, profitB);
            const GAS_ESTIMATE = 0.05; // Slightly higher to be safe
            const netProfit = bestProfit - GAS_ESTIMATE;

            // Always show scan activity to user (heartbeat)
            this.onLog({
                id: 'lat-' + Date.now() + Math.random(),
                timestamp: new Date().toLocaleTimeString(),
                type: 'SCAN_PULSE',
                pair: `⚡ [Multicall] ${symbol} | Latência: ${latency}ms | Profit Check: ${netProfit > 0 ? '+' : ''}${netProfit.toFixed(4)}`,
                profit: 0,
                status: 'SUCCESS',
                hash: ''
            });

            if (netProfit > (Number(this.tradeAmount) * this.minProfit)) {
                const bestPath = profitA >= profitB ? 'QUICK_V2_TO_UNI_V3' : 'UNI_V3_TO_QUICK_V2';
                const dexNames = bestPath === 'QUICK_V2_TO_UNI_V3' ? 'QuickSwap V2 -> Uniswap V3' : 'Uniswap V3 -> QuickSwap V2';
                const useV3Buy = bestPath === 'UNI_V3_TO_QUICK_V2';
                const v3Fee = useV3Buy ? quotes.v3Buy.fee : quotes.v3SellPrice.fee;

                // Log opportunity found (WITHOUT profit yet - only log after execution)
                this.onLog({
                    id: 'opp-' + Date.now(),
                    timestamp: new Date().toLocaleTimeString(),
                    type: 'ROUTE_OPTIMIZATION',
                    pair: `${symbol}: Oportunidade $${netProfit.toFixed(4)} via ${dexNames}`,
                    profit: 0, // Don't count profit until actually executed
                    status: 'SUCCESS',
                    hash: '🔍 ANALISANDO'
                });

                // ACTUAL EXECUTION
                try {
                    const txHash = await blockchainService.executeTrade(
                        tokenIn,
                        tokenOut,
                        this.tradeAmount,
                        this.runMode === 'REAL',
                        undefined, // Default wallet (Operator)
                        "0", // amountOutMin (rely on slippage in real executor if needed)
                        useV3Buy,
                        v3Fee
                    );

                    // CAP profit per trade to prevent unrealistic values
                    // In arbitrage, profit is typically 0.1% to 1% of trade amount
                    const maxRealisticProfit = Number(this.tradeAmount) * 0.03; // Max 3% per trade
                    const clampedProfit = Math.min(netProfit, maxRealisticProfit);

                    this.onLog({
                        id: 'exec-' + Date.now(),
                        timestamp: new Date().toLocaleTimeString(),
                        type: 'ROUTE_OPTIMIZATION',
                        pair: `${symbol} ✅ Executado | ${dexNames}`,
                        profit: clampedProfit, // Only count profit on successful execution
                        status: 'SUCCESS',
                        hash: txHash
                    });
                } catch (execError: any) {
                    this.onLog({
                        id: 'err-' + Date.now(),
                        timestamp: new Date().toLocaleTimeString(),
                        type: 'ROUTE_OPTIMIZATION',
                        pair: `${symbol} ❌ Falha: ${execError.message}`,
                        profit: 0, // No profit on failed trades
                        status: 'FAILED',
                        hash: ''
                    });
                }
            }
        } catch (e) { }
    }

    private cleanupListeners() {
        this.eventListeners.forEach(l => {
            if (l.provider && l.event) {
                l.provider.removeAllListeners(l.event);
            }
        });
        this.eventListeners = [];
    }
}

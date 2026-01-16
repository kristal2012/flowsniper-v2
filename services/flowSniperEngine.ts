
import { FlowStep, FlowOperation, TOKENS } from '../types';
import { fetchCurrentPrice } from './marketDataService';
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
        const symbols = ['POLUSDT', 'ETHUSDT', 'BTCUSDT', 'MATICUSDT', 'USDCUSDT', 'DAIUSDT', 'LINKUSDT', 'UNIUSDT', 'AAVEUSDT', 'QUICKUSDT', 'SOLUSDT']; // Optimized set
        const dexes = ['QuickSwap [V2]', 'Uniswap [V3]'];

        // Helper for Promise with Timeout
        const withTimeout = (promise: Promise<any>, ms: number, label: string) => {
            let timeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms);
            });
            return Promise.race([promise, timeout]);
        };



        const GAS_ESTIMATE_USDT = 0.02;

        while (this.active) {
            if (this.dailyPnl <= this.maxDrawdown) {
                this.stop();
                break;
            }

            if (this.runMode === 'DEMO' && this.gasBalance <= 0) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            // 1. SCAN BATCH
            const batchSize = 3;
            const batchSymbols = [];
            for (let i = 0; i < batchSize; i++) {
                batchSymbols.push(symbols[Math.floor(Math.random() * symbols.length)]);
            }

            console.log(`[SniperEngine] Starting Parallel Scan for: ${batchSymbols.join(', ')}`);

            // Pulse log
            this.onLog({
                id: 'pulse-' + Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                type: 'SCAN_PULSE',
                pair: `Scanning (Parallel x${batchSize}): ${batchSymbols.join(', ')}`,
                profit: 0,
                status: 'SUCCESS',
                hash: ''
            });

            await Promise.all(batchSymbols.map(async (randomSymbol) => {
                try {
                    const price = await fetchCurrentPrice(randomSymbol);

                    if (price <= 0) {
                        console.warn(`[SniperEngine] Skip ${randomSymbol}: No price.`);
                        return;
                    }

                    const tokenIn = TOKENS['USDT'];
                    let searchTag = randomSymbol.replace('USDT', '');
                    if (searchTag === 'BTC') searchTag = 'WBTC';
                    if (searchTag === 'ETH') searchTag = 'WETH';
                    if (searchTag === 'POL' || searchTag === 'MATIC') searchTag = 'WMATIC';

                    const tokenOut = TOKENS[searchTag];
                    if (!tokenOut) return;

                    // --- SMART STRATEGY: PRE-FLIGHT VERIFICATION ---
                    let isProfitable = false;
                    let estimatedNetProfit = 0;
                    let buyAmountOut = "0";
                    let bestRoute = 'QuickSwap (V2)';
                    let useV3 = false;
                    let txHash = '';
                    let successTrade = false;
                    let actualProfit = 0;

                    // Parallel Fetch for Speed
                    const [v2Amounts, v3Amount] = await Promise.all([
                        withTimeout(blockchainService.getAmountsOut(this.tradeAmount, [tokenIn, tokenOut]), 4000, 'v2').catch(() => []),
                        withTimeout(blockchainService.getQuoteV3(tokenIn, tokenOut, this.tradeAmount), 4000, 'v3').catch(() => "0")
                    ]);

                    let bestAmountOut = 0;
                    if (v2Amounts && v2Amounts.length >= 2) {
                        const dOut = await (blockchainService as any).getTokenDecimals(tokenOut);
                        // FIXED: Use formatUnits to handle BigInt decimals safely
                        const v2OutFloat = parseFloat(ethers.formatUnits(v2Amounts[1], dOut));
                        bestAmountOut = v2OutFloat;
                    }
                    const v3Out = Number(v3Amount);
                    if (v3Out > bestAmountOut) {
                        bestAmountOut = v3Out;
                        bestRoute = 'Uniswap (V3)';
                        useV3 = true;
                    }

                    if (bestAmountOut > 0) {
                        buyAmountOut = bestAmountOut.toString();
                        const grossProfit = (bestAmountOut * price) - Number(this.tradeAmount);
                        const totalGas = (GAS_ESTIMATE_USDT * 2);
                        estimatedNetProfit = grossProfit - totalGas;
                        const targetProfit = Number(this.tradeAmount) * this.minProfit;

                        if (estimatedNetProfit > targetProfit) {
                            const roi = (estimatedNetProfit / Number(this.tradeAmount)) * 100;
                            // Relaxed Circuit Breaker for higher sensitivity
                            if (roi <= 50.0) {
                                isProfitable = true;
                                console.log(`[Strategy] ✅ ${searchTag} PROFITABLE: $${estimatedNetProfit.toFixed(4)}`);
                            }
                        } else if (grossProfit > 0) {
                            const spreadPct = (grossProfit / Number(this.tradeAmount)) * 100;
                            this.onLog({
                                id: 'pulse-dist-' + Date.now(),
                                timestamp: new Date().toLocaleTimeString(),
                                type: 'SCAN_PULSE',
                                pair: `${searchTag}: Spread ${spreadPct.toFixed(2)}% found! Low Net (Gas/Fee).`,
                                profit: 0,
                                status: 'SUCCESS',
                                hash: ''
                            });
                        }
                    }

                    if (isProfitable) {
                        if (this.runMode === 'REAL') {
                            // EXECUTE REAL (Sequential/Locks handled by provider ideally, but here we just go)
                            const minBuyOut = (Number(buyAmountOut) * (1 - this.slippage)).toString();
                            const bHash = await blockchainService.executeTrade(tokenIn, tokenOut, this.tradeAmount, true, undefined, minBuyOut, useV3);
                            await new Promise(r => setTimeout(r, 1000));

                            const activeAddr = blockchainService.getWalletAddress();
                            const tokenBal = activeAddr ? await blockchainService.getBalance(tokenOut, activeAddr) : '0';
                            if (Number(tokenBal) > 0) {
                                const currentSellAmounts = await blockchainService.getAmountsOut(tokenBal, [tokenOut, tokenIn]);
                                const expectedUsdtBack = Number(currentSellAmounts[1]) / (10 ** 6);
                                const minUsdtOut = (expectedUsdtBack * (1 - this.slippage)).toString();
                                txHash = await blockchainService.executeTrade(tokenOut, tokenIn, tokenBal, true, undefined, minUsdtOut);
                                actualProfit = expectedUsdtBack - Number(this.tradeAmount) - GAS_ESTIMATE_USDT;
                                successTrade = true;
                            }
                        } else {
                            txHash = '0xSIM_' + Math.random().toString(16).substr(2, 10);
                            actualProfit = estimatedNetProfit;
                        }

                        this.dailyPnl += actualProfit;
                        if (this.runMode === 'DEMO') {
                            this.totalBalance += actualProfit;
                            this.gasBalance -= 0.05;
                            if (this.onGasUpdate) this.onGasUpdate(this.gasBalance);
                            if (this.onBalanceUpdate) this.onBalanceUpdate(this.totalBalance);
                        }

                        this.onLog({
                            id: Math.random().toString(36).substr(2, 9),
                            timestamp: new Date().toLocaleTimeString(),
                            type: 'ROUTE_OPTIMIZATION',
                            pair: `${searchTag}/USDT (${bestRoute})`,
                            profit: actualProfit,
                            status: 'SUCCESS',
                            hash: txHash
                        });

                        // Consolidation
                        if (this.runMode === 'REAL' && successTrade && this.consolidationThreshold > 0) {
                            const opAddr = blockchainService.getWalletAddress();
                            const pvt = localStorage.getItem('fs_private_key');
                            const ownerAddr = pvt ? new ethers.Wallet(pvt).address : null;
                            if (opAddr && ownerAddr && opAddr.toLowerCase() !== ownerAddr.toLowerCase()) {
                                const usdtBal = await blockchainService.getBalance(TOKENS['USDT'], opAddr);
                                if (Number(usdtBal) >= this.consolidationThreshold) {
                                    const transferHash = await blockchainService.transferTokens(TOKENS['USDT'], ownerAddr, usdtBal, opAddr);
                                    this.onLog({ id: 'cons-' + Date.now(), timestamp: new Date().toLocaleTimeString(), type: 'ASSET_CONSOLIDATION', pair: `Consolidated ${usdtBal} USDT`, profit: 0, status: 'SUCCESS', hash: transferHash });
                                }
                            }
                        }
                    }
                } catch (e: any) {
                    console.error(`[ScanBatch] Error for ${randomSymbol}:`, e.message);
                }
            }));

            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }



}

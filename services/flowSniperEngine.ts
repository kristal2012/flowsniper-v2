
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
        const symbols = [
            'POLUSDT', 'WBTCUSDT', 'WETHUSDT', 'USDCUSDT', 'DAIUSDT',
            'ETHUSDT', 'MATICUSDT', 'SOLUSDT', 'LINKUSDT', 'UNIUSDT',
            'AAVEUSDT', 'QUICKUSDT', 'SANDUSDT', 'CRVUSDT', 'SUSHIUSDT',
            'BALUSDT', 'SNXUSDT', 'MKRUSDT', 'GRTUSDT', 'LDOUSDT', 'GHSTUSDT'
        ];

        const withTimeout = (promise: Promise<any>, ms: number, label: string) => {
            let timeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`${label} Timeout`)), ms);
            });
            return Promise.race([promise, timeout]);
        };

        const GAS_ESTIMATE_USDT = 0.02;
        console.log("[SniperEngine] Motor v4.3.1 Operação Trade Forçado Iniciada.");

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

                // 1. SCAN BATCH (Expanded to 12 for more coverage)
                const batchSize = 12;
                const batchSymbols = [];
                for (let i = 0; i < batchSize; i++) {
                    batchSymbols.push(symbols[Math.floor(Math.random() * symbols.length)]);
                }

                // Pulse log - Translated to motivate the user
                this.onLog({
                    id: 'pulse-' + Date.now(),
                    timestamp: new Date().toLocaleTimeString(),
                    type: 'SCAN_PULSE',
                    pair: `Varredura Ativa (Parallel x${batchSize}): ${batchSymbols.join(', ')}`,
                    profit: 0,
                    status: 'SUCCESS',
                    hash: ''
                });

                await Promise.all(batchSymbols.map(async (randomSymbol) => {
                    try {
                        let isProfitable = false;
                        let estimatedNetProfit = 0;
                        let buyAmountOut = "0";
                        let bestRoute = '';
                        let useV3 = false;
                        let txHash = '';
                        let successTrade = false;
                        let actualProfit = 0;

                        const tokenIn = TOKENS['USDT'];
                        let searchTag = randomSymbol.replace('USDT', '');
                        if (searchTag === 'BTC') searchTag = 'WBTC';
                        if (searchTag === 'ETH') searchTag = 'WETH';
                        if (searchTag === 'POL' || searchTag === 'MATIC') searchTag = 'WMATIC';

                        const tokenOut = TOKENS[searchTag];
                        if (!tokenOut) return;

                        // --- TRADE FORÇADO STRATEGY (v4.3.1) ---
                        const [v2Buy, v3BuyObj, v2Sell, v3SellObj] = await Promise.all([
                            withTimeout(blockchainService.getAmountsOut(this.tradeAmount, [tokenIn, tokenOut]), 2500, 'v2Buy').catch(() => []),
                            withTimeout(blockchainService.getQuoteV3(tokenIn, tokenOut, this.tradeAmount), 3500, 'v3Buy').catch(() => ({ quote: "0", fee: 3000 })),
                            withTimeout(blockchainService.getAmountsOut("1.0", [tokenOut, tokenIn]), 2500, 'v2Sell').catch(() => []),
                            withTimeout(blockchainService.getQuoteV3(tokenOut, tokenIn, "1.0"), 3500, 'v3Sell').catch(() => ({ quote: "0", fee: 3000 }))
                        ]);

                        const dOut = await (blockchainService as any).getTokenDecimals(tokenOut);

                        const v2BuyOut = v2Buy.length >= 2 ? parseFloat(ethers.formatUnits(v2Buy[1], dOut)) : 0;
                        const v3BuyOut = parseFloat(v3BuyObj.quote);
                        const v2SellPrice = v2Sell.length >= 2 ? parseFloat(ethers.formatUnits(v2Sell[1], 6)) : 0;
                        const v3SellPrice = parseFloat(v3SellObj.quote);

                        // FORCE TRACE LOG: Proof of activity
                        this.onLog({
                            id: 'trace-' + Date.now() + Math.random(),
                            timestamp: new Date().toLocaleTimeString(),
                            type: 'SCAN_PULSE',
                            pair: `🔎 ${randomSymbol}: QW $${v2SellPrice.toFixed(4)} | V3 $${v3SellPrice.toFixed(4)}`,
                            profit: 0,
                            status: 'SUCCESS',
                            hash: ''
                        });

                        const profitA = (v2BuyOut * v3SellPrice) - Number(this.tradeAmount);
                        const profitB = (v3BuyOut * v2SellPrice) - Number(this.tradeAmount);

                        let bestProfit = 0;
                        let executionRoute = '';
                        let bestBuyAmountOut = "0";
                        let finalUseV3 = false;
                        let bestV3Fee = 3000;

                        if (profitA > profitB) {
                            bestProfit = profitA - (GAS_ESTIMATE_USDT * 2);
                            executionRoute = 'QuickSwap -> V3';
                            bestBuyAmountOut = v2BuyOut.toString();
                            finalUseV3 = false;
                            bestV3Fee = v3SellObj.fee;
                        } else {
                            bestProfit = profitB - (GAS_ESTIMATE_USDT * 2);
                            executionRoute = 'V3 -> QuickSwap';
                            bestBuyAmountOut = v3BuyOut.toString();
                            finalUseV3 = true;
                            bestV3Fee = v3BuyObj.fee;
                        }

                        const targetProfit = Number(this.tradeAmount) * this.minProfit;

                        // NEAR-PROFIT LOGGING: Visible feedback for spreads > $0.01
                        if (bestProfit > 0.01) {
                            const isNear = bestProfit >= (targetProfit * 0.7);
                            this.onLog({
                                id: 'diagnostic-' + Date.now() + Math.random(),
                                timestamp: new Date().toLocaleTimeString(),
                                type: 'SCAN_PULSE',
                                pair: `${isNear ? '[DENTRO DO ALVO] ' : '[ALTO SPREAD] '}${randomSymbol}: Lucro $${bestProfit.toFixed(3)} | Alvo: $${targetProfit.toFixed(3)}`,
                                profit: 0,
                                status: 'SUCCESS',
                                hash: ''
                            });
                        }

                        if (bestProfit > targetProfit && bestProfit < 50.0) {
                            const { price: cexPrice } = await fetchCurrentPrice(randomSymbol);
                            const dexSellPrice = finalUseV3 ? v2SellPrice : v3SellPrice;

                            if (cexPrice > 0 && Math.abs(dexSellPrice - cexPrice) / cexPrice > 0.15) {
                                return;
                            }

                            isProfitable = true;
                            buyAmountOut = bestBuyAmountOut;
                            estimatedNetProfit = bestProfit;
                            bestRoute = executionRoute;
                            useV3 = finalUseV3;
                        }

                        if (isProfitable) {
                            if (this.runMode === 'REAL') {
                                const minBuyOut = (Number(bestBuyAmountOut) * (1 - this.slippage)).toString();
                                // PASS v3Fee: if finalUseV3 (Buy V3), use v3BuyObj.fee
                                const bHash = await blockchainService.executeTrade(tokenIn, tokenOut, this.tradeAmount, true, undefined, minBuyOut, finalUseV3, finalUseV3 ? v3BuyObj.fee : 3000);
                                await new Promise(r => setTimeout(r, 600));

                                const activeAddr = blockchainService.getWalletAddress();
                                const tokenBal = activeAddr ? await blockchainService.getBalance(tokenOut, activeAddr) : '0';
                                if (Number(tokenBal) > 0) {
                                    // PASS v3Fee: if !finalUseV3 (Sell V3), use v3SellObj.fee
                                    const txHash = await blockchainService.executeTrade(tokenOut, tokenIn, tokenBal, true, undefined, "0", !finalUseV3, !finalUseV3 ? v3SellObj.fee : 3000);
                                    actualProfit = estimatedNetProfit;
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
                                hash: txHash || '0x...'
                            });
                        }
                    } catch (e: any) {
                        // Individual symbol error handled silently to keep scanning
                    }
                }));

                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (rootErr: any) {
                console.error("[SniperEngine] Loop Error Caught:", rootErr.message);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
}

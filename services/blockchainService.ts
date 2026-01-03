
import { ethers, JsonRpcProvider, Wallet, Contract } from 'ethers';

// Standard ERC20 ABI (Minimal)
// Standard ERC20 ABI (Minimal)
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 amount)"
];

// Uniswap V2 Router ABI (Compatible with QuickSwap)
const ROUTER_ABI = [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

// QuickSwap Router Address (Polygon)
const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const DEFAULT_RPC = 'https://polygon-rpc.com';

export class BlockchainService {
    private getRPC(): string {
        return localStorage.getItem('fs_polygon_rpc') || import.meta.env.VITE_POLYGON_RPC_URL || DEFAULT_RPC;
    }

    private getProvider(): JsonRpcProvider {
        return new JsonRpcProvider(this.getRPC());
    }

    private getWallet(): Wallet | null {
        const pvtKey = localStorage.getItem('fs_private_key') || import.meta.env.VITE_PRIVATE_KEY;
        if (pvtKey) {
            try {
                return new Wallet(pvtKey, this.getProvider());
            } catch (e) {
                console.error("Invalid Private Key", e);
                return null;
            }
        }
        return null;
    }

    // CORE MODULE: TradeExecutor (Real & Sim)
    async executeTrade(tokenIn: string, tokenOut: string, amountIn: string, isReal: boolean): Promise<string> {
        console.log(`[TradeExecutor] Executing ${isReal ? 'REAL' : 'SIMULATED'} trade: ${amountIn} tokens`);

        if (!isReal) {
            // SIMULATION MODE
            await new Promise(r => setTimeout(r, 1000)); // Fake latency
            return "0xSIM_" + Math.random().toString(16).substr(2, 32);
        }

        // REAL MODE
        const wallet = this.getWallet();
        if (!wallet) {
            throw new Error("Private Key required for Risk Mode (Real Trading)");
        }

        try {
            const router = new Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);

            // Dynamic Decimals Detection
            // USDT/USDC usually 6, others 18.
            const isStable = tokenIn.toLowerCase() === '0xc2132d05d31c914a87c6611c10748aeb04b58e8f' || // USDT
                tokenIn.toLowerCase() === '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';   // USDC

            const decimals = isStable ? 6 : 18;
            const amountWei = ethers.parseUnits(amountIn, decimals);

            const tokenContract = new Contract(tokenIn, ERC20_ABI, wallet);

            // 1. Check & Approve if needed
            console.log(`[TradeExecutor] Checking/Approving Router...`);
            const allowance = await tokenContract.allowance(wallet.address, ROUTER_ADDRESS);

            if (allowance < amountWei) {
                const approveTx = await tokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256);
                await approveTx.wait();
            }

            // 2. Swap
            const path = [tokenIn, tokenOut];
            const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

            // Gas estimation for transparency
            const gasPrice = (await this.getProvider().getFeeData()).gasPrice || ethers.parseUnits('50', 'gwei');

            console.log(`[TradeExecutor] Sending Swap Tx...`);
            const tx = await router.swapExactTokensForTokens(
                amountWei,
                0, // Slippage 100% allowed (Sniper Mode - Dangerous but fast)
                path,
                wallet.address,
                deadline,
                {
                    gasLimit: 300000, // Standard swap gas limit
                    gasPrice: gasPrice * 12n / 10n // 20% bump for speed
                }
            );

            console.log(`[TradeExecutor] Tx Sent: ${tx.hash}`);
            return tx.hash;

        } catch (error: any) {
            console.error("[TradeExecutor] Real Trade Failed", error);
            throw new Error("Blockchain Transaction Failed: " + (error.message || "Unknown error"));
        }
    }

    // CORE MODULE: LiquidityManager (LP and Rebalancing)
    async manageLiquidity(poolAddress: string, action: 'ADD' | 'REMOVE', amount: string): Promise<string> {
        console.log(`[LiquidityManager] ${action} liquidity: ${amount} to pool ${poolAddress}`);
        return "0xLP_" + Math.random().toString(16).substr(2, 64);
    }

    // CORE MODULE: RiskController (Validation)
    async validateTrade(amount: number): Promise<boolean> {
        const MAX_TRADE = 10; // Increased limit
        if (amount > MAX_TRADE) {
            console.error(`[RiskController] Trade rejected: Amount $${amount} exceeds limit of $${MAX_TRADE}`);
            return false;
        }
        return true;
    }

    async getBalance(tokenAddress: string, accountAddress: string): Promise<string> {
        try {
            const provider = this.getProvider();
            if (tokenAddress === '0x0000000000000000000000000000000000000000') {
                const balance = await provider.getBalance(accountAddress);
                return ethers.formatEther(balance);
            }
            const contract = new Contract(tokenAddress, ERC20_ABI, provider);
            const balance = await contract.balanceOf(accountAddress);
            return ethers.formatUnits(balance, 18);
        } catch (error) {
            console.error("Blockchain Balance Error:", error);
            return '0';
        }
    }
}

export const blockchainService = new BlockchainService();


import { ethers, JsonRpcProvider, Wallet, Contract, BrowserProvider } from 'ethers';

// Standard ERC20 ABI (Minimal)
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 amount)"
];

// Uniswap V2 Router ABI (Compatible with QuickSwap)
const ROUTER_ABI = [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
    "event Sync(uint112 reserve0, uint112 reserve1)"
];

// Uniswap V3 Quoter ABI (Minimal)
const QUOTER_ABI = [
    "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
    "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
];

// Uniswap V3 Router ABI (Minimal)
const ROUTER_V3_ABI = [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

// Multicall3 ABI
const MULTICALL_ABI = [
    "function aggregate((address target, bytes callData)[] calls) external payable returns (uint256 blockNumber, bytes[] returnData)"
];

const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
const QUOTER_V3_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
const ROUTER_V3_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const MULTICALL_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const DEFAULT_RPC = 'https://polygon-mainnet.g.alchemy.com/v2/iRsg1SsPMDZZ9s5kHsRbH'; // User Alchemy RPC
const FALLBACK_RPCS = [
    'https://polygon-rpc.com',
    'https://rpc-mainnet.maticvigil.com',
    'https://1rpc.io/matic'
];

export class BlockchainService {
    private getRPC(): string {
        return localStorage.getItem('fs_polygon_rpc') || import.meta.env.VITE_POLYGON_RPC_URL || DEFAULT_RPC;
    }

    public lastError: string | null = null;
    private browserProvider: BrowserProvider | null = null;
    private operatorWallet: Wallet | null = null;
    private decimalCache: { [address: string]: number } = {};

    // v4.3.0 Caches
    private providerCache: JsonRpcProvider | null = null;
    private wsProvider: any = null;
    private v2Router: Contract | null = null;
    private v3Quoter: Contract | null = null;
    private v3Router: Contract | null = null;
    private multicall: Contract | null = null;
    private erc20Contracts: { [address: string]: Contract } = {};

    constructor() {
        if (typeof window !== 'undefined' && ((window as any).ethereum || (window as any).rabby)) {
            // Priority to Rabby if available, otherwise standard ethereum
            const provider = (window as any).rabby || (window as any).ethereum;
            this.browserProvider = new BrowserProvider(provider);
        }
        this.loadOperatorWallet();
    }

    private loadOperatorWallet() {
        const storedKey = localStorage.getItem('fs_operator_key');
        if (storedKey) {
            try {
                this.operatorWallet = new Wallet(storedKey, this.getProvider());
            } catch (e) {
                console.error("Failed to load operator wallet", e);
            }
        }
    }

    public async connectWallet(): Promise<string> {
        if (!this.browserProvider) throw new Error("Carteira (Rabby/MetaMask) não encontrada.");
        await this.ensurePolygonNetwork();
        const accounts = await ((window as any).ethereum || (window as any).rabby).request({ method: 'eth_requestAccounts' });
        return accounts[0];
    }

    private async ensurePolygonNetwork(): Promise<void> {
        const provider = (window as any).rabby || (window as any).ethereum;
        if (!provider) return;

        const chainId = '0x89'; // 137 in hex
        try {
            await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }],
            });
        } catch (switchError: any) {
            // This error code indicates that the chain has not been added
            if (switchError.code === 4902) {
                try {
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId,
                            chainName: 'Polygon Mainnet',
                            nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                            rpcUrls: ['https://polygon-rpc.com'],
                            blockExplorerUrls: ['https://polygonscan.com/']
                        }],
                    });
                } catch (addError) {
                    throw new Error("Não foi possível adicionar a rede Polygon.");
                }
            } else {
                throw new Error("Por favor, mude para a rede Polygon na sua Carteira.");
            }
        }
    }

    public async setupOperator(ownerAddress: string): Promise<string> {
        await this.ensurePolygonNetwork();
        // Generate or load operator wallet
        if (!this.operatorWallet) {
            const newWallet = Wallet.createRandom();
            localStorage.setItem('fs_operator_key', newWallet.privateKey);
            this.operatorWallet = new Wallet(newWallet.privateKey, this.getProvider());
        }

        // Request signature to "pair" the operator (security proof)
        const message = `Autorizar FlowSniper Operator\nOwner: ${ownerAddress}\nOperator: ${this.operatorWallet.address}`;
        const signer = await this.browserProvider!.getSigner();
        await signer.signMessage(message);

        return this.operatorWallet.address;
    }

    public async grantAllowance(tokenAddress: string, amount: string): Promise<string> {
        if (!this.browserProvider || !this.operatorWallet) throw new Error("Conecte a Carteira primeiro.");

        await this.ensurePolygonNetwork();
        const signer = await this.browserProvider.getSigner();
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);

        console.log(`[BlockchainService] Granting allowance for operator: ${this.operatorWallet.address}, amount: ${amount}`);
        const tx = await tokenContract.approve(this.operatorWallet.address, amount);
        await tx.wait();
        return tx.hash;
    }

    private getProvider(): JsonRpcProvider {
        if (this.providerCache) return this.providerCache;

        const rpc = this.getRPC();
        try {
            if (rpc.includes('alchemy.com')) {
                console.log("[BlockchainService] Static Provider: Alchemy Premium");
            }
            this.providerCache = new JsonRpcProvider(rpc, 137, { staticNetwork: true });
            return this.providerCache;
        } catch (e) {
            console.warn("[BlockchainService] RPC Fail, fallback to public");
            this.providerCache = new JsonRpcProvider(FALLBACK_RPCS[0], 137, { staticNetwork: true });
            return this.providerCache;
        }
    }

    public getWebSocketProvider(): any {
        if (this.wsProvider) return this.wsProvider;

        const rpc = this.getRPC();
        let wsUrl = rpc.replace('https://', 'wss://').replace('http://', 'ws://');

        // Alchemy specific WSS adjustment if needed (usually just replacing https with wss works)
        if (rpc.includes('alchemy.com') && !wsUrl.includes('/v2/')) {
            // Basic replacement works for most alchemy/infura
        }

        try {
            console.log("[BlockchainService] Connecting WebSocket to:", wsUrl);
            this.wsProvider = new ethers.WebSocketProvider(wsUrl);
            return this.wsProvider;
        } catch (e) {
            console.error("[BlockchainService] WebSocket connection failed", e);
            return null;
        }
    }

    private getV2Router(): any {
        if (!this.v2Router) {
            this.v2Router = new Contract(ROUTER_ADDRESS, ROUTER_ABI, this.getProvider());
        }
        return this.v2Router;
    }

    private getV3Quoter(): any {
        if (!this.v3Quoter) {
            this.v3Quoter = new Contract(QUOTER_V3_ADDRESS, QUOTER_ABI, this.getProvider());
        }
        return this.v3Quoter;
    }

    private getV3Router(signerOrProvider?: any): any {
        const base = signerOrProvider || this.getProvider();
        if (!this.v3Router) {
            this.v3Router = new Contract(ROUTER_V3_ADDRESS, ROUTER_V3_ABI, base);
        }
        return this.v3Router;
    }

    private getMulticall(): any {
        if (!this.multicall) {
            this.multicall = new Contract(MULTICALL_ADDRESS, MULTICALL_ABI, this.getProvider());
        }
        return this.multicall;
    }

    private getERC20(address: string, signerOrProvider?: any): any {
        const normalized = address.toLowerCase();
        const base = signerOrProvider || this.getProvider();
        if (!this.erc20Contracts[normalized]) {
            this.erc20Contracts[normalized] = new Contract(normalized, ERC20_ABI, base);
        }
        return this.erc20Contracts[normalized];
    }

    public async getAmountsOut(amountIn: string, path: string[]): Promise<bigint[]> {
        try {
            const router = this.getV2Router();

            // Detect decimals for the first token in path
            const decimals = await this.getTokenDecimals(path[0]);
            const amountWei = ethers.parseUnits(amountIn, decimals);

            const amounts = await router.getAmountsOut(amountWei, path);
            console.log(`[getAmountsOut] ${amountIn} ${path[0]} -> ${amounts.length > 1 ? ethers.formatUnits(amounts[1], await this.getTokenDecimals(path[1])) : '0'} ${path[1]}`);
            return amounts;
        } catch (e: any) {
            console.error(`[BlockchainService] getAmountsOut Error for path ${path.join('->')}:`, e.message || e);
            return [];
        }
    }

    // NEW: Uniswap V3 Quoter (Multi-Tier)
    public async getQuoteV3(tokenIn: string, tokenOut: string, amountIn: string): Promise<{ quote: string, fee: number }> {
        try {
            const quoter = this.getV3Quoter();

            const decimalsIn = await this.getTokenDecimals(tokenIn);
            const decimalsOut = await this.getTokenDecimals(tokenOut);
            const amountWei = ethers.parseUnits(amountIn, decimalsIn);

            const tiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
            let bestQuoteWei = BigInt(0);
            let bestFee = 3000;

            // Parallel scan of all tiers for speed
            const quotes = await Promise.all(tiers.map(async (fee) => {
                try {
                    return await quoter.quoteExactInputSingle.staticCall(
                        tokenIn,
                        tokenOut,
                        fee,
                        amountWei,
                        0
                    );
                } catch (e) {
                    return BigInt(0);
                }
            }));

            // Find best
            quotes.forEach((q, index) => {
                if (q > bestQuoteWei) {
                    bestQuoteWei = q;
                    bestFee = tiers[index];
                }
            });

            const formatted = ethers.formatUnits(bestQuoteWei, decimalsOut);
            console.log(`[getQuoteV3] Best Quote: ${amountIn} -> ${formatted} (Fee: ${bestFee})`);
            return { quote: formatted, fee: bestFee };
        } catch (e: any) {
            console.error("[getQuoteV3] Failed", e);
            return { quote: "0", fee: 3000 };
        }
    }

    // NEW: Multicall Grouped Quotes (V2 and V3 - Buy & Sell)
    public async getQuotesMulticall(tokenIn: string, tokenOut: string, amountIn: string): Promise<{
        v2Buy: string,
        v3Buy: { quote: string, fee: number },
        v2SellPrice: string,
        v3SellPrice: { quote: string, fee: number }
    }> {
        try {
            const multicall = this.getMulticall();
            const decimalsIn = await this.getTokenDecimals(tokenIn);
            const decimalsOut = await this.getTokenDecimals(tokenOut);

            const amountInWei = ethers.parseUnits(amountIn, decimalsIn);
            const unitOutWei = ethers.parseUnits("1.0", decimalsOut); // For unit price

            const v2Interface = new ethers.Interface(ROUTER_ABI);
            const v3QuoterInterface = new ethers.Interface(QUOTER_ABI);

            const tiers = [500, 3000, 10000];

            // Build 8 calls: 
            // 1. V2 Buy (amountIn)
            // 2. V2 Sell Price (1.0 unit)
            // 3-5. V3 Buy (amountIn) - 3 tiers
            // 6-8. V3 Sell Price (1.0 unit) - 3 tiers
            const calls = [
                // 0: V2 Buy
                { target: ROUTER_ADDRESS, callData: v2Interface.encodeFunctionData("getAmountsOut", [amountInWei, [tokenIn, tokenOut]]) },
                // 1: V2 Sell
                { target: ROUTER_ADDRESS, callData: v2Interface.encodeFunctionData("getAmountsOut", [unitOutWei, [tokenOut, tokenIn]]) },
                // 2-4: V3 Buy
                ...tiers.map(fee => ({
                    target: QUOTER_V3_ADDRESS,
                    callData: v3QuoterInterface.encodeFunctionData("quoteExactInputSingle", [tokenIn, tokenOut, fee, amountInWei, 0])
                })),
                // 5-7: V3 Sell
                ...tiers.map(fee => ({
                    target: QUOTER_V3_ADDRESS,
                    callData: v3QuoterInterface.encodeFunctionData("quoteExactInputSingle", [tokenOut, tokenIn, fee, unitOutWei, 0])
                }))
            ];

            const { returnData } = await multicall.aggregate.staticCall(calls);

            // Decode V2 Buy
            let v2Buy = "0";
            try {
                const decoded = v2Interface.decodeFunctionResult("getAmountsOut", returnData[0]);
                v2Buy = ethers.formatUnits(decoded[0][1], decimalsOut);
            } catch (e) { }

            // Decode V2 Sell
            let v2SellPrice = "0";
            try {
                const decoded = v2Interface.decodeFunctionResult("getAmountsOut", returnData[1]);
                v2SellPrice = ethers.formatUnits(decoded[0][1], decimalsIn);
            } catch (e) { }

            // Decode V3 Buy (best tier)
            let bestBuyV3Wei = BigInt(0);
            let bestBuyFee = 3000;
            for (let i = 0; i < tiers.length; i++) {
                try {
                    const decoded = v3QuoterInterface.decodeFunctionResult("quoteExactInputSingle", returnData[i + 2]);
                    if (decoded[0] > bestBuyV3Wei) {
                        bestBuyV3Wei = decoded[0];
                        bestBuyFee = tiers[i];
                    }
                } catch (e) { }
            }

            // Decode V3 Sell (best tier)
            let bestSellV3Wei = BigInt(0);
            let bestSellFee = 3000;
            for (let i = 0; i < tiers.length; i++) {
                try {
                    const decoded = v3QuoterInterface.decodeFunctionResult("quoteExactInputSingle", returnData[i + 5]);
                    if (decoded[0] > bestSellV3Wei) {
                        bestSellV3Wei = decoded[0];
                        bestSellFee = tiers[i];
                    }
                } catch (e) { }
            }

            return {
                v2Buy: v2Buy,
                v3Buy: { quote: ethers.formatUnits(bestBuyV3Wei, decimalsOut), fee: bestBuyFee },
                v2SellPrice: v2SellPrice,
                v3SellPrice: { quote: ethers.formatUnits(bestSellV3Wei, decimalsIn), fee: bestSellFee }
            };
        } catch (e: any) {
            console.error("[Multicall] Failed, using fallback", e.message);
            // Minimal fallback
            return {
                v2Buy: "0", v3Buy: { quote: "0", fee: 3000 },
                v2SellPrice: "0", v3SellPrice: { quote: "0", fee: 3000 }
            };
        }
    }

    public getWalletAddress(): string | null {
        const wallet = this.getWallet();
        return wallet ? wallet.address : null;
    }

    private getWallet(preferredAddress?: string): Wallet | null {
        // 1. Check if we have a preferred address
        if (preferredAddress) {
            if (this.operatorWallet && this.operatorWallet.address.toLowerCase() === preferredAddress.toLowerCase()) {
                return this.operatorWallet.connect(this.getProvider());
            }
            const pvtKey = localStorage.getItem('fs_private_key');
            if (pvtKey) {
                const master = new Wallet(pvtKey, this.getProvider());
                if (master.address.toLowerCase() === preferredAddress.toLowerCase()) return master;
            }
        }

        // 2. Default Priority: Operator -> Master
        if (this.operatorWallet) {
            return this.operatorWallet.connect(this.getProvider());
        }

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
    async executeTrade(tokenIn: string, tokenOut: string, amountIn: string, isReal: boolean, fromAddress?: string, amountOutMin: string = "0", useV3: boolean = false, v3Fee: number = 3000): Promise<string> {
        console.log(`[TradeExecutor] Executing ${isReal ? 'REAL' : 'SIMULATED'} trade (${useV3 ? 'Uniswap V3' : 'QuickSwap V2'}): ${amountIn} tokens`);

        if (!isReal) {
            await new Promise(r => setTimeout(r, 1000));
            return "0xSIM_" + Math.random().toString(16).substr(2, 32);
        }

        const wallet = this.getWallet(fromAddress);
        if (!wallet) {
            throw new Error("Carteira não configurada para este endereço.");
        }

        try {
            const provider = this.getProvider();

            // PRE-TRADE CHECK: Gas (Native POL)
            const gasBal = await provider.getBalance(wallet.address);
            if (gasBal < ethers.parseEther('0.05')) {
                throw new Error(`Insufficient Gas (POL). Address ${wallet.address} has only ${ethers.formatEther(gasBal)} POL. Please fund it for fees.`);
            }

            const router = this.getV2Router().connect(wallet);

            // Robust Decimals Detection
            const decimalsIn = await this.getTokenDecimals(tokenIn);
            const decimalsOut = await this.getTokenDecimals(tokenOut);
            const amountWei = ethers.parseUnits(amountIn, decimalsIn);
            const amountOutMinWei = ethers.parseUnits(amountOutMin, decimalsOut);

            // 0. Pull funds from Owner to Operator if needed
            const ownerAddress = localStorage.getItem('fs_owner_address');
            if (this.operatorWallet && wallet.address === this.operatorWallet.address && ownerAddress) {
                const tokenContract = this.getERC20(tokenIn, wallet);
                const opBalance = await tokenContract.balanceOf(wallet.address);

                if (opBalance < amountWei) {
                    console.log(`[TradeExecutor] Operator low balance. Attempting to pull funds from owner: ${ownerAddress}`);
                    const remainingToPull = amountWei - opBalance;

                    // Verify allowance
                    const allowanceFromOwner = await tokenContract.allowance(ownerAddress, wallet.address);
                    if (allowanceFromOwner < remainingToPull) {
                        throw new Error(`Saldo insuficiente no Operador e permissão insuficiente do Proprietário. Necessário: ${ethers.formatUnits(remainingToPull, decimalsIn)}`);
                    }

                    const pullTx = await tokenContract.transferFrom(ownerAddress, wallet.address, remainingToPull);
                    await pullTx.wait();
                    console.log(`[TradeExecutor] Pulled ${ethers.formatUnits(remainingToPull, decimalsIn)} tokens from owner.`);
                }
            }

            const tokenContract = this.getERC20(tokenIn, wallet);

            // Gas estimation with Priority (v4.3.3)
            const feeData = await provider.getFeeData();
            const baseGasPrice = feeData.gasPrice || ethers.parseUnits('50', 'gwei');
            // Add 50% premium for extreme priority to win against other bots
            const priorityGasPrice = baseGasPrice * 15n / 10n;

            if (useV3) {
                // UNISWAP V3 EXECUTION
                console.log(`[TradeExecutor] Checking/Approving V3 Router...`);
                const allowance = await tokenContract.allowance(wallet.address, ROUTER_V3_ADDRESS);
                if (allowance < amountWei) {
                    const approveTx = await tokenContract.approve(ROUTER_V3_ADDRESS, ethers.MaxUint256);
                    await approveTx.wait();
                }

                const routerV3 = this.getV3Router(wallet);
                const params = {
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: v3Fee,
                    recipient: wallet.address,
                    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
                    amountIn: amountWei,
                    amountOutMinimum: amountOutMinWei,
                    sqrtPriceLimitX96: 0
                };

                console.log(`[TradeExecutor] Sending V3 Swap (Priority Gas)...`);
                const tx = await routerV3.exactInputSingle(params, {
                    gasLimit: 500000,
                    gasPrice: priorityGasPrice
                });
                console.log(`[TradeExecutor] V3 Tx based: ${tx.hash}`);
                return tx.hash;

            } else {
                // QUICKSWAP V2 EXECUTION (Legacy)
                console.log(`[TradeExecutor] Checking/Approving Router...`);
                const allowance = await tokenContract.allowance(wallet.address, ROUTER_ADDRESS);

                if (allowance < amountWei) {
                    const approveTx = await tokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256);
                    await approveTx.wait();
                }

                // 2. Swap
                const path = [tokenIn, tokenOut];
                const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

                console.log(`[TradeExecutor] Sending Swap Tx (Priority Gas)...`);
                const tx = await router.swapExactTokensForTokens(
                    amountWei,
                    amountOutMinWei,
                    path,
                    wallet.address,
                    deadline,
                    {
                        gasLimit: 350000,
                        gasPrice: priorityGasPrice
                    }
                );
                console.log(`[TradeExecutor] Tx Sent: ${tx.hash}`);
                return tx.hash;
            }
            return ""; // Should not reach here

        } catch (error: any) {
            console.error("[TradeExecutor] Real Trade Failed", error);

            let cleanMsg = error.message || "Unknown error";
            if (cleanMsg.includes('insufficient funds for gas')) cleanMsg = "Erro: Falta POL para Gás";
            if (cleanMsg.includes('allowance')) cleanMsg = "Erro: Falta Permissão USDT";
            if (cleanMsg.includes('user rejected')) cleanMsg = "Erro: Transação Negada";
            if (cleanMsg.includes('execution reverted')) cleanMsg = "Erro: Falha na DEX (Slippage?)";

            throw new Error(cleanMsg);
        }
    }

    // CORE MODULE: Gas Station (Swap USDT to Native POL)
    async rechargeGas(amountUsdt: string): Promise<string> {
        console.log(`[GasStation] Recharging with ${amountUsdt} USDT...`);

        const wallet = this.getWallet();
        if (!wallet) throw new Error("Private Key required for Gas Recharge");

        try {
            const router = this.getV2Router().connect(wallet);
            const usdtAddr = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
            const wmaticAddr = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
            const amountWei = ethers.parseUnits(amountUsdt, 6); // USDT has 6 decimals

            // 0. Pull USDT from Owner if needed
            const ownerAddress = localStorage.getItem('fs_owner_address');
            if (this.operatorWallet && wallet.address === this.operatorWallet.address && ownerAddress) {
                const tokenContract = this.getERC20(usdtAddr, wallet);
                const opBalance = await tokenContract.balanceOf(wallet.address);

                if (opBalance < amountWei) {
                    console.log(`[GasStation] Operator low USDT for recharge. Pulling from owner...`);
                    const pullAmount = amountWei - opBalance;

                    const allowance = await tokenContract.allowance(ownerAddress, wallet.address);
                    if (allowance < pullAmount) throw new Error("Permissão USDT insuficiente do Proprietário para recarga de gás.");

                    const pullTx = await tokenContract.transferFrom(ownerAddress, wallet.address, pullAmount);
                    await pullTx.wait();
                }
            }

            const tokenContract = this.getERC20(usdtAddr, wallet);

            // Approve if needed
            const allowance = await tokenContract.allowance(wallet.address, ROUTER_ADDRESS);
            if (allowance < amountWei) {
                const approveTx = await tokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256);
                await approveTx.wait();
            }

            const path = [usdtAddr, wmaticAddr];
            const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

            const tx = await router.swapExactTokensForETH(
                amountWei,
                0, // Slippage 100%
                path,
                wallet.address,
                deadline
            );

            console.log(`[GasStation] Recharge Tx Sent: ${tx.hash}`);
            return tx.hash;

        } catch (error: any) {
            console.error("[GasStation] Recharge Failed", error);
            throw new Error("Gas Recharge Transaction Failed: " + (error.message || "Unknown error"));
        }
    }

    // Transfer Tokens (Consolidation)
    async transferTokens(tokenAddress: string, to: string, amount: string, fromAddress?: string): Promise<string> {
        const wallet = this.getWallet(fromAddress);
        if (!wallet) throw new Error("Wallet not loaded");

        try {
            const decimals = await this.getTokenDecimals(tokenAddress);
            const amountWei = ethers.parseUnits(amount, decimals);

            if (tokenAddress === '0x0000000000000000000000000000000000000000') {
                console.log(`[Consolidation] Sending ${amount} POL (Native) to ${to}...`);
                const tx = await wallet.sendTransaction({
                    to: to,
                    value: amountWei
                });
                await tx.wait();
                return tx.hash;
            } else {
                const tokenContract = this.getERC20(tokenAddress, wallet);
                console.log(`[Consolidation] Sending ${amount} tokens (${tokenAddress}) to ${to}...`);
                const tx = await tokenContract.transfer(to, amountWei);
                await tx.wait();
                return tx.hash;
            }
        } catch (e: any) {
            console.error("[BlockchainService] Transfer Failed", e);
            throw new Error("Transfer failed: " + (e.message || "Unknown error"));
        }
    }

    // CORE MODULE: LiquidityManager (LP and Rebalancing)
    async manageLiquidity(poolAddress: string, action: 'ADD' | 'REMOVE', amount: string): Promise<string> {
        console.log(`[LiquidityManager] ${action} liquidity: ${amount} to pool ${poolAddress}`);
        return "0xLP_" + Math.random().toString(16).substr(2, 64);
    }

    // CORE MODULE: RiskController (Validation)
    // Helper: Determine Decimals for any token
    private async getTokenDecimals(tokenAddress: string): Promise<number> {
        if (tokenAddress === '0x0000000000000000000000000000000000000000') return 18;

        const normalized = tokenAddress.toLowerCase();
        if (this.decimalCache[normalized]) return this.decimalCache[normalized];

        const STABLES = {
            'usdt': '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
            'usdc_b': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            'usdc_n': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        };

        // Static mapping for speed/known tokens
        if (normalized === STABLES.usdt || normalized === STABLES.usdc_b || normalized === STABLES.usdc_n) {
            this.decimalCache[normalized] = 6;
            return 6;
        }

        // Contract call fallback
        try {
            const contract = this.getERC20(tokenAddress);
            const d = await contract.decimals();
            this.decimalCache[normalized] = Number(d);
            return Number(d);
        } catch (e) {
            console.warn(`[BlockchainService] Failed to fetch decimals for ${tokenAddress}, defaulting to 18`);
            return 18;
        }
    }

    async validateTrade(amount: number): Promise<boolean> {
        const MAX_TRADE = 10; // Increased limit
        if (amount > MAX_TRADE) {
            console.error(`[RiskController] Trade rejected: Amount $${amount} exceeds limit of $${MAX_TRADE}`);
            return false;
        }
        return true;
    }

    async getBalance(tokenAddress: string, accountAddress: string): Promise<string> {
        if (!accountAddress || accountAddress === '0x0000000000000000000000000000000000000000') return '0';

        try {
            const provider = this.getProvider();
            const normalizedAddress = ethers.getAddress(accountAddress);

            // Native POL (Matic)
            if (tokenAddress === '0x0000000000000000000000000000000000000000') {
                const balance = await provider.getBalance(normalizedAddress);
                return ethers.formatEther(balance);
            }

            // ERC20 Tokens
            const normalizedToken = ethers.getAddress(tokenAddress);
            const contract = this.getERC20(normalizedToken);
            let decimals = await this.getTokenDecimals(normalizedToken);
            const balance = await contract.balanceOf(normalizedAddress);

            const formatted = ethers.formatUnits(balance, decimals);

            console.log(`[BlockchainService] Final Balance for ${normalizedToken}: ${formatted} (Raw: ${balance.toString()}, Decimals: ${decimals})`);
            return formatted;
        } catch (error: any) {
            this.lastError = error.message || error.toString();
            console.error("[BlockchainService] Balance Error:", this.lastError);
            throw error;
        }
    }
}

export const blockchainService = new BlockchainService();

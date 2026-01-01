
import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  History,
  PieChart as PieChartIcon,
  ExternalLink,
  Copy,
  RefreshCw,
  Search,
  ShieldCheck,
  BrainCircuit,
  LayoutDashboard,
  Fuel,
  Coins,
  Cpu,
  Zap,
  ChevronRight,
  User,
  LogOut,
  Settings,
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  ArrowLeftRight,
  Crown,
  Bot,
  Check,
  Play,
  Square,
  AlertCircle,
  Network,
  Plus,
  Minus,
  Power,
  Circle,
  ChevronDown,
  Link as LinkIcon,
  Key,
  FolderX,
  Pencil,
  Crosshair,
  Trash2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

import { Asset, Transaction, PerformanceData, ManagerProfile, BotInstance, FlowStep } from './types';
import { mockManager, mockAssets, mockPerformance, mockTransactions } from './services/mockData';
import { analyzePerformance } from './services/openai';
import { fetchHistoricalData, fetchCurrentPrice } from './services/marketDataService';
import { FlowSniperEngine } from './services/flowSniperEngine';
import { blockchainService } from './services/blockchainService';

const App: React.FC = () => {
  const [manager, setManager] = useState<ManagerProfile>(mockManager);
  const [assets, setAssets] = useState<Asset[]>(mockAssets);
  const [performance, setPerformance] = useState<PerformanceData[]>(mockPerformance);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'history' | 'gas' | 'robots' | 'settings'>('overview');

  // Settings State
  const [rpcUrl, setRpcUrl] = useState(localStorage.getItem('fs_polygon_rpc') || '');
  const [pvtKey, setPvtKey] = useState(localStorage.getItem('fs_private_key') || '');

  // Account Dropdown State
  // Account State
  const [walletAddress, setWalletAddress] = useState<string>('0x000...0000');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Bot States
  const [botActive, setBotActive] = useState(false);
  const [flowLogs, setFlowLogs] = useState<FlowStep[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Liquidez states
  const [liquidityAction, setLiquidityAction] = useState<'add' | 'remove'>('add');
  const [liquidityAmount, setLiquidityAmount] = useState<string>('');

  // Gas states
  const [gasAction, setGasAction] = useState<'add' | 'remove'>('add');
  const [gasAmount, setGasAmount] = useState<string>('');

  // Subscription states
  const [subAction, setSubAction] = useState<'add' | 'remove'>('add');
  const [subAmount, setSubAmount] = useState<string>('');

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Flow Engine instance
  const sniperRef = useRef<FlowSniperEngine | null>(null);

  useEffect(() => {
    sniperRef.current = new FlowSniperEngine((newStep) => {
      setFlowLogs(prev => [newStep, ...prev].slice(0, 20));
    });
  }, []);

  useEffect(() => {
    if (botActive && sniperRef.current) {
      sniperRef.current.start();
    } else if (sniperRef.current) {
      sniperRef.current.stop();
    }
  }, [botActive]);

  // Fetch real market data on load
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      const history = await fetchHistoricalData('MATICUSDT', '1', 50);
      if (history.length > 0) {
        const perfData: PerformanceData[] = history.map((c, i) => ({
          timestamp: new Date(c.time).toLocaleTimeString(),
          pnl: Number((Math.random() * 2 - 1).toFixed(2)), // Random for now
          equity: c.close
        }));
        setPerformance(perfData);

        const currentPrice = await fetchCurrentPrice('MATICUSDT');
        setAssets(prev => prev.map(a => a.symbol === 'WMATIC' ? { ...a, price: currentPrice, valueUsd: a.balance * currentPrice } : a));

        // --- NEW: AI Analysis Call ---
        try {
          const aiResult = await analyzePerformance(mockAssets, mockTransactions); // Using mock data for now as per plan
          setAnalysis(aiResult);
        } catch (e) {
          console.error("AI Analysis failed", e);
        }
      }
      setLoading(false);
    };
    initData();
  }, []);

  // Persistence for Keys
  useEffect(() => {
    localStorage.setItem('fs_polygon_rpc', rpcUrl);
    localStorage.setItem('fs_private_key', pvtKey);
  }, [rpcUrl, pvtKey]);

  const connectWallet = async () => {
    if ((window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
      } catch (error) {
        console.error("User denied account access");
      }
    } else {
      alert("Por favor instale a MetaMask!");
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    alert('Endereço copiado!');
    setIsAccountMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col md:flex-row font-['Inter']">
      {/* Sidebar - Desktop */}
      <aside className="w-72 border-r border-zinc-800/50 hidden md:flex flex-col p-6 sticky top-0 h-screen bg-[#0c0c0e]">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#f01a74] rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-[#f01a74]/20">FS</div>
          <span className="font-bold text-2xl tracking-tight bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent italic">FLOWSNIPER <span className="text-[10px] text-emerald-500 non-italic border border-emerald-500/20 px-1 rounded">v3.0 LATEST</span></span>
        </div>

        {/* Account Component */}
        <div className="relative mb-8" ref={accountMenuRef}>
          <button
            onClick={() => walletAddress === '0x000...0000' ? connectWallet() : setIsAccountMenuOpen(!isAccountMenuOpen)}
            className="w-full bg-[#141417] p-4 rounded-2xl border border-zinc-800/50 flex flex-col text-left hover:border-zinc-700 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-2 w-full">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{walletAddress === '0x000...0000' ? 'Sistema' : 'Sua conta'}</span>
              <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                <Wallet size={14} className="text-[#f01a74]" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-mono text-zinc-300 truncate">{walletAddress === '0x000...0000' ? 'Conectar Carteira' : walletAddress}</p>
              </div>
            </div>
          </button>

          {isAccountMenuOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-[#141417] border border-zinc-800 rounded-2xl shadow-2xl z-[100] overflow-hidden">
              <div className="p-4 border-b border-zinc-800/50">
                <div className="flex items-center gap-3">
                  <Wallet size={20} className="text-[#f01a74]" />
                  <div>
                    <p className="text-xs font-bold text-white">FlowSniper v1</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Carteira: 0x000...0000</p>
                  </div>
                </div>
              </div>
              <div className="p-2 space-y-1">
                <button onClick={copyAddress} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-zinc-300 text-xs font-medium transition-all">
                  <Copy size={14} className="text-zinc-500" /> Copiar Carteira
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 text-xs font-bold transition-all">
                  <LinkIcon size={14} /> Encaminhamento
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-zinc-300 text-xs font-medium transition-all">
                  <Settings size={14} className="text-zinc-500" /> Informações Pessoais
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest px-4 mb-4">Menu Principal</p>
        <nav className="flex-1 space-y-1">
          <SidebarItem active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard size={20} />} label="Painel de Controle" />
          <SidebarItem active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} icon={<Coins size={20} />} label="Liquidez" />
          <SidebarItem active={activeTab === 'gas'} onClick={() => setActiveTab('gas')} icon={<Fuel size={20} />} label="Gás" />
          <SidebarItem active={activeTab === 'robots'} onClick={() => setActiveTab('robots')} icon={<Bot size={20} />} label="Robôs" />
          <SidebarItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Configurações" />
        </nav>

        <div className="mt-auto space-y-4">
          <div className="flex items-center justify-between text-zinc-500 text-sm px-4">
            <Settings size={18} className="cursor-pointer hover:text-white" />
            <Bell size={18} className="cursor-pointer hover:text-white" />
            <LogOut size={18} className="cursor-pointer text-rose-500 hover:text-rose-400" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#09090b]">
        {/* Top Header Bar */}
        <div className="h-16 border-b border-zinc-800/30 flex items-center justify-end px-8 gap-6 sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-40">
          <div className="flex items-center gap-2 bg-[#141417] px-3 py-1.5 rounded-full border border-zinc-800">
            <div className="w-5 h-5 rounded-full overflow-hidden border border-zinc-700">
              <img src="https://flagcdn.com/br.svg" alt="BR" className="w-full h-full object-cover" />
            </div>
            <span className="text-xs font-bold uppercase">PT-BR</span>
          </div>
          <div className="flex items-center gap-2 bg-[#141417] px-4 py-1.5 rounded-full border border-zinc-800">
            <span className="text-xs font-mono font-bold">0.0000 <span className="text-zinc-500">USDT</span></span>
            <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-10 max-w-[1400px] mx-auto pb-24 md:pb-10">
          {activeTab === 'overview' && (
            <div className="animate-in fade-in duration-500 space-y-8">
              {/* Top Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#141417] rounded-2xl border border-zinc-800/50 p-6">
                  <p className="text-zinc-300 text-sm font-medium mb-3">Liquidez FlowSniper</p>
                  <h2 className="text-4xl font-bold mb-6 font-mono tracking-tighter">0.000000</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setActiveTab('assets')} className="flex items-center justify-center gap-2 border border-zinc-800 rounded-xl py-2.5 text-xs font-bold hover:bg-white/5 transition-all">
                      <Plus size={14} className="text-zinc-500" /> ADICIONAR
                    </button>
                    <button onClick={() => setActiveTab('assets')} className="flex items-center justify-center gap-2 border border-zinc-800 rounded-xl py-2.5 text-xs font-bold hover:bg-white/5 transition-all">
                      <Minus size={14} className="text-zinc-500" /> REMOVER
                    </button>
                  </div>
                </div>

                <div className="bg-[#141417] rounded-2xl border border-zinc-800/50 p-6">
                  <p className="text-zinc-300 text-sm font-medium mb-3">Saldo de gás (Polygon)</p>
                  <h2 className="text-4xl font-bold mb-6 font-mono tracking-tighter text-zinc-500">--</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setActiveTab('gas')} className="flex items-center justify-center gap-2 border border-zinc-800 rounded-xl py-2.5 text-xs font-bold hover:bg-white/5 transition-all">
                      <Plus size={14} className="text-zinc-500" /> ADICIONAR
                    </button>
                    <button onClick={() => setActiveTab('gas')} className="flex items-center justify-center gap-2 border border-zinc-800 rounded-xl py-2.5 text-xs font-bold hover:bg-white/5 transition-all">
                      <Minus size={14} className="text-zinc-500" /> REMOVER
                    </button>
                  </div>
                </div>

                <div className="bg-[#141417] rounded-2xl border border-zinc-800/50 p-6">
                  <p className="text-zinc-300 text-sm font-medium mb-3">Slippage Capturado</p>
                  <h2 className="text-4xl font-bold mb-6 font-mono tracking-tighter text-emerald-500">+0.48%</h2>
                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={() => setActiveTab('robots')} className="flex items-center justify-center gap-2 border border-zinc-800 rounded-xl py-2.5 text-xs font-bold hover:bg-white/5 transition-all uppercase">
                      Ver Operações
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Analysis Widget */}
              {analysis && (
                <div className="bg-[#141417] rounded-2xl border border-zinc-800/50 p-6 animate-in fade-in duration-700">
                  <div className="flex items-center gap-3 mb-4">
                    <BrainCircuit size={24} className="text-[#f01a74]" />
                    <h3 className="text-xl font-bold italic">AI Market Insight</h3>
                    <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
                      {analysis.riskLevel}
                    </div>
                  </div>
                  <p className="text-zinc-300 mb-4 leading-relaxed">
                    {analysis.summary}
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-black/20 p-4 rounded-xl border border-zinc-800/30">
                      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Recomendação</p>
                      <p className="font-medium text-emerald-400">{analysis.recommendation}</p>
                    </div>
                    <div className="bg-black/20 p-4 rounded-xl border border-zinc-800/30">
                      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Estratégia Sugerida</p>
                      <p className="font-medium text-blue-400">{analysis.suggestedStrategy}</p>
                    </div>
                  </div>
                </div>
              )}


              {/* Grid Content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#141417] rounded-2xl border border-zinc-800/50 flex flex-col min-h-[500px]">
                  <div className="p-6 flex items-center justify-between border-b border-zinc-800/30">
                    <h3 className="text-lg font-bold">Contas FlowSniper</h3>
                    <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all">Vincular</button>
                  </div>
                  <div className="grid grid-cols-2 h-16 border-b border-zinc-800/30">
                    <button className="flex items-center justify-center gap-2 hover:bg-emerald-500/5 transition-all font-bold text-xs"><Play size={14} className="text-zinc-500" /> LIGAR</button>
                    <button className="flex items-center justify-center gap-2 border-l border-zinc-800/30 hover:bg-rose-500/5 transition-all font-bold text-xs">DESLIGAR <Circle size={14} className="text-zinc-500" /></button>
                  </div>
                  <div className="flex-1">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest border-b border-zinc-800/30">
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-center">Pool/Dex</th>
                          <th className="px-6 py-4 text-right">ROI Hoje</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-zinc-800/10"><td colSpan={3} className="px-6 py-12 text-center text-zinc-700 font-medium italic text-sm">Nenhum FlowSniper ativo</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-[#141417] rounded-2xl border border-zinc-800/50 flex flex-col p-8 min-h-[500px]">
                  <h3 className="text-lg font-bold mb-8">Estatísticas FlowSniper</h3>
                  <div className="flex-1 grid md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <DesempenhoItem label="Estratégia" value="High-Freq Slippage" />
                      <DesempenhoItem label="Rede" value="Polygon PoS" />
                      <DesempenhoItem label="Slippage Médio" value="+0.12%" isMono />
                      <DesempenhoItem label="Token Governança" value={<div className="w-4 h-4 bg-zinc-800 rounded-full flex items-center justify-center text-[8px] font-bold">FS</div>} />
                      <DesempenhoItem label="Transações/Dia" value="10k+" isMono />
                      <DesempenhoItem label="Split de Lucro" value="70% User / 30% Prot" />
                      <DesempenhoItem label="Drawdown Max" value="1.5%" />
                      <DesempenhoItem label="Estado do Motor" value={<div className="flex items-center gap-2 justify-end"><div className="w-2 h-2 bg-emerald-500 animate-pulse rounded-full"></div><span className="font-bold text-xs uppercase">ONLINE</span></div>} />
                    </div>
                    <div className="flex flex-col items-center justify-center opacity-10">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-white rounded flex items-center justify-center font-bold text-black text-sm">FS</div>
                        <span className="text-2xl font-black italic tracking-tighter">FLOWSNIPER</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="animate-in fade-in duration-500 space-y-8">
              <div className="bg-[#141417] rounded-[2rem] p-12 border border-zinc-800/50 text-center relative overflow-hidden">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">LIQUIDEZ FLOWSNIPER</p>
                <h2 className="text-6xl font-bold tracking-tighter text-white font-mono">0.000000<span className="text-zinc-700 text-4xl ml-2 uppercase">USDTO</span></h2>
              </div>

              <div className="bg-[#141417] rounded-2xl border border-zinc-800/50 overflow-hidden">
                <div className="grid grid-cols-2">
                  <button onClick={() => setLiquidityAction('add')} className={`py-4 flex items-center justify-center gap-2 font-bold transition-all text-sm ${liquidityAction === 'add' ? 'bg-[#10b981]/10 text-[#10b981] border-b-2 border-[#10b981]' : 'text-zinc-500 border-b-2 border-transparent hover:text-zinc-300'}`}>
                    + INVESTIR
                  </button>
                  <button onClick={() => setLiquidityAction('remove')} className={`py-4 flex items-center justify-center gap-2 font-bold transition-all text-sm ${liquidityAction === 'remove' ? 'bg-rose-500/10 text-rose-500 border-b-2 border-rose-500' : 'text-zinc-500 border-b-2 border-transparent hover:text-zinc-300'}`}>
                    - RESGATAR
                  </button>
                </div>

                <div className="p-8 space-y-8">
                  <div className="grid md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                        <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest mb-1">Capitais sob custódia</p>
                        <p className="text-lg font-bold font-mono">100% MetaMask / Rabby</p>
                      </div>

                      <div className="space-y-3">
                        <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest">Alocação por Pool</p>
                        <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl px-4 py-4 flex items-center justify-between">
                          <span className="font-mono text-lg">Uniswap v3 / QuickSwap</span>
                          <button className="text-zinc-600 hover:text-zinc-400"><Pencil size={16} /></button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest">Valor da Operação</p>
                        <div className="relative group">
                          <input
                            type="text"
                            placeholder="0.00"
                            className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-4 py-4 font-mono text-xl outline-none focus:border-[#10b981]/50 transition-all"
                            value={liquidityAmount}
                            onChange={(e) => setLiquidityAmount(e.target.value)}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                            <span className="text-zinc-600 text-xs font-bold font-mono uppercase">USDTO</span>
                            <button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-colors">MAX</button>
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase">Exposure per trade: ~$3.00 (SafeMode)</p>
                      </div>

                      <button className="w-full bg-[#f01a74] hover:bg-[#d01664] text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95 text-sm uppercase tracking-widest">
                        Confirmar Aporte
                      </button>
                    </div>

                    <div className="space-y-6">
                      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-4">SEGURANÇA BLOCKCHAIN</p>
                      <div className="space-y-8 relative">
                        <div className="absolute left-4 top-4 bottom-4 w-px bg-zinc-800"></div>
                        <div className="flex items-center gap-4 relative">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center z-10 border border-zinc-700"><ShieldCheck size={14} className="text-emerald-500" /></div>
                          <span className="text-zinc-200 text-sm font-medium">Contrato Auditado (FlowSniper Engine)</span>
                        </div>
                        <div className="flex items-center gap-4 relative">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center z-10 border border-zinc-700"><Key size={14} className="text-zinc-500" /></div>
                          <span className="text-zinc-500 text-sm font-medium">Assinatura Multi-Sig Confirmada</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#141417] rounded-2xl border border-zinc-800/50 overflow-hidden">
                <div className="p-8 border-b border-zinc-800/50">
                  <h3 className="text-lg font-bold italic uppercase tracking-tighter">Fluxo de Operações Snipe (0)</h3>
                </div>
                <div className="overflow-x-auto min-h-[300px] flex flex-col">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-zinc-600 text-[10px] uppercase font-black tracking-widest border-b border-zinc-800/30">
                        <th className="px-8 py-5">Timestamp</th>
                        <th className="px-8 py-5">DEX</th>
                        <th className="px-8 py-5">Pair</th>
                        <th className="px-8 py-5">Slippage</th>
                        <th className="px-8 py-5">Lucro Bruto</th>
                        <th className="px-8 py-5">Tx ID</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="flex-1 flex flex-col items-center justify-center py-16 opacity-30">
                    <Crosshair size={48} className="text-zinc-600 mb-4" />
                    <p className="text-sm font-medium">Motor de busca aguardando liquidez...</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-in fade-in duration-500 space-y-8">
              <div className="bg-[#141417] rounded-[2rem] p-12 border border-zinc-800/50">
                <h2 className="text-3xl font-black italic text-white mb-8 flex items-center gap-3">
                  <Settings size={32} className="text-[#f01a74]" />
                  Configurações do Robô
                </h2>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-3 mb-8">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span className="text-xs text-emerald-200 font-medium italic">IA GRATUITA ATIVA: O FlowSniper está usando GPT-4o via Puter.js sem necessidade de chaves.</span>
                </div>

                <div className="space-y-6 max-w-2xl">
                  <div className="space-y-2">
                    <label className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Polygon RPC URL</label>
                    <div className="relative">
                      <Network size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input
                        type="text"
                        value={rpcUrl}
                        onChange={(e) => setRpcUrl(e.target.value)}
                        placeholder="https://polygon-mainnet.g.alchemy.com/..."
                        className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl pl-12 pr-4 py-4 font-mono text-sm outline-none focus:border-[#f01a74]/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Chave Privada (Opcional)</label>
                    <div className="relative">
                      <ShieldCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input
                        type="password"
                        value={pvtKey}
                        onChange={(e) => setPvtKey(e.target.value)}
                        placeholder="0x..."
                        className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl pl-12 pr-4 py-4 font-mono text-sm outline-none focus:border-[#f01a74]/50 transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-600 italic">Necessário apenas para execução real (Mainnet).</p>
                  </div>

                  <div className="pt-4">
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-emerald-500" />
                      <span className="text-xs text-emerald-200 font-medium">As chaves são salvas localmente no seu navegador.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'robots' && (
            <div className="animate-in fade-in duration-500 space-y-8">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-[#141417] rounded-[2.5rem] border border-zinc-800/50 p-8 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-black italic text-white flex items-center gap-3">
                        <Bot size={32} className="text-[#f01a74]" />
                        FlowSniper v1 <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded non-italic">SYNCED</span>
                      </h2>
                      <p className="text-zinc-500 text-sm mt-2">Motor de Alta Frequência: Slippage Positivo & Taxas LP</p>
                    </div>
                    <button
                      onClick={() => setBotActive(!botActive)}
                      className={`px-8 py-4 rounded-2xl font-black italic flex items-center gap-3 transition-all ${botActive ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-lg shadow-rose-500/5' : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20 active:scale-95'}`}
                    >
                      {botActive ? <><Square size={20} fill="currentColor" /> DESATIVAR MOTOR</> : <><Play size={20} fill="currentColor" /> ATIVAR FLOWSNIPER</>}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <BotStat label="Status" value={botActive ? "SNIPING" : "IDLE"} color={botActive ? "text-emerald-500" : "text-zinc-500"} />
                    <BotStat label="Slippage Hoje" value={botActive ? "+0.45%" : "0.00%"} />
                    <BotStat label="DEXs Ativas" value="4 (Polygon)" />
                    <BotStat label="Latência" value="12ms" />
                  </div>
                </div>
                <div className="bg-[#141417] rounded-[2.5rem] border border-zinc-800/50 p-8 flex flex-col items-center justify-center text-center">
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">LUCRO ACUMULADO FLOWSNIPER</p>
                  <h3 className="text-4xl font-black text-white">$1,245.50</h3>
                  <div className="w-full h-2 bg-zinc-800 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-[#f01a74]" style={{ width: '70%' }}></div>
                  </div>
                  <p className="text-[10px] text-zinc-600 font-bold uppercase mt-2">Distribuição 70/30 Ativa</p>
                </div>
              </div>

              {/* Real-time Flow Logs */}
              {botActive && (
                <div className="bg-[#141417] rounded-3xl border border-zinc-800/50 p-8 animate-in slide-in-from-bottom-5 duration-700">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Activity size={18} className="text-[#f01a74]" />
                      Live Flow Feed
                    </h3>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Escaneando DEXs...</span>
                    </div>
                  </div>
                  <div className="space-y-3 font-mono text-xs">
                    {flowLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/30 hover:border-[#f01a74]/30 transition-all">
                        <div className="flex items-center gap-4">
                          <span className="text-zinc-600">{log.timestamp}</span>
                          <span className={`${log.type === 'SLIPPAGE_SWAP' ? 'text-emerald-500' : 'text-blue-500'} font-bold`}>
                            {log.type === 'SLIPPAGE_SWAP' ? 'SLIPPAGE_CAPTURE' : 'LP_FEE_CAPTURE'}
                          </span>
                          <span className="text-zinc-400">{log.pair}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-zinc-200 font-bold">+{log.profit} WMATIC</span>
                          <ExternalLink size={12} className="text-zinc-600 cursor-pointer hover:text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 flex justify-around py-5 z-50">
        <MobileNavItem active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard size={22} />} />
        <MobileNavItem active={activeTab === 'robots'} onClick={() => setActiveTab('robots')} icon={<Bot size={22} />} />
        <MobileNavItem active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} icon={<Coins size={22} />} />
        <MobileNavItem active={activeTab === 'gas'} onClick={() => setActiveTab('gas')} icon={<Fuel size={22} />} />
        <MobileNavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={22} />} />
      </nav>
    </div>
  );
};


const DesempenhoItem: React.FC<{ label: string; value: React.ReactNode; isMono?: boolean }> = ({ label, value, isMono }) => (
  <div className="flex items-center justify-between border-b border-zinc-800/30 pb-3">
    <span className="text-zinc-500 text-sm">{label}</span>
    <div className={`text-sm font-bold ${isMono ? 'font-mono' : ''}`}>{value}</div>
  </div>
);

const BotStat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = "text-white" }) => (
  <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">{label}</p>
    <p className={`text-lg font-black italic ${color}`}>{value}</p>
  </div>
);

const SidebarItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 ${active ? 'bg-[#f01a74]/10 text-[#f01a74] shadow-inner shadow-[#f01a74]/5' : 'hover:bg-zinc-800/30 text-zinc-500 hover:text-zinc-200'}`}>
    <div className={`${active ? 'scale-110' : ''} transition-transform`}>{icon}</div>
    <span className={`text-sm font-bold tracking-tight`}>{label}</span>
  </button>
);

const MobileNavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode }> = ({ active, onClick, icon }) => (
  <button onClick={onClick} className={`p-2 transition-all duration-300 ${active ? 'text-[#f01a74] scale-125' : 'text-zinc-600'}`}>
    {icon}
  </button>
);

export default App;

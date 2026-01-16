# FlowSniper Technical Brief for Specialist Developer

Este documento detalha a arquitetura, estratégias e desafios técnicos do robô **FlowSniper**. O objetivo é fornecer todas as informações necessárias para que um especialista possa diagnosticar a latência na detecção de oportunidades e propor melhorias de alta performance.

---

## 🏗️ Arquitetura Geral

- **Stack:** React/Vite (Frontend), Ethers.js v6, TypeScript.
- **Rede:** Polygon (Chain ID: 137).
- **Execução:** Sistema de Carteira Dupla:
    - **Owner Wallet:** Carteira principal (Rabby/MetaMask) que detém o capital e concede permissão (`allowance`) ao Operador.
    - **Operator Wallet:** Carteira "hot" (chave privada local) que executa as transações autonomamente usando `transferFrom` do Owner para evitar exposição total do capital.
- **RPC:** Provedor estático (Alchemy Premium) com fallback automático para RPCs públicos.

---

## 📈 Estratégias Atuais

Atualmente, o robô opera uma estratégia de **Arbitragem Triangular/Cross-DEX** focada em:

1.  **QuickSwap V2 vs Uniswap V3:**
    - O motor compara os preços entre o par V2 (QuickSwap) e V3 (Uniswap).
    - O lucro é calculado considerando o spread entre as duas DEXs, subtraindo o custo estimado de gás (estático em ~$0.02 - $0.04 por perna).
2.  **CEX Price Validation:**
    - Antes de executar, o robô valida o preço DEX contra feeds da Bybit/Binance para evitar "poisoned pools" ou outliers de liquidez extrema.
3.  **Parallel Quoting:**
    - O robô consulta simultaneamente as 3 faixas de taxas do Uniswap V3 (500, 3000, 10000) para encontrar a melhor rota de saída.

---

## ⚡ Otimizações Implementadas (Performance & Lucratividade)

- **Static Network Provider:** Configurado no Ethers.js para evitar requisições extras de `eth_chainId` em cada chamada, economizando ms cruciais.
- **Priority Gas Strategy:** Implementado um premium de 50% sobre o `baseFee` do Polygon (`priorityGasPrice = baseGasPrice * 15n / 10n`) para vencer outros bots na mempool.
- **Batch Scanning:** O robô varre 12 pares de moedas simultaneamente por ciclo (paralelismo simulado via `Promise.all`).
- **Near-Profit Logging:** Sistema de log que reporta spreads positivos mesmo que não atinjam o `minProfit`, permitindo monitorar a "saúde" do mercado e a proximidade de oportunidades.
- **Automatic Gas Recharge:** Função que converte USDT para POL (Native) automaticamente na carteira do Operador quando o saldo de gás está baixo.

---

## 🔍 O Problema: Latência na Detecção (Analysis of Bottlenecks)

O robô está demorando para encontrar oportunidades. Identificamos os seguintes pontos críticos:

### 1. Polling vs Events
O robô utiliza um loop `while(active)` com `setTimeout` e consultas `getAmountsOut` repetitivas. Isso gera latência de rede e pode sofrer *rate limiting* no RPC.
> **Melhoria Sugerida:** Mudar para uma arquitetura baseada em eventos (monitoramento de `Sync` no V2 ou `Swap` no V3) para reagir instantaneamente à mudança de liquidez.

### 2. Random Batch Selection
A cada ciclo, o robô escolhe 12 símbolos aleatórios de uma lista fixa. Isso significa que pares altamente voláteis podem ser ignorados por vários ciclos.
> **Melhoria Sugerida:** Implementar uma fila de prioridade baseada em volume/volatilidade ou monitoramento constante de todos os pares críticos.

### 3. Latência de Quoting (V3 Quoter)
A consulta ao `QuoterV3` no Polygon pode ser lenta. Atualmente fazemos consultas estáticas que levam centenas de milissegundos.
> **Melhoria Sugerida:** Usar um contrato de "Multicall" customizado para obter quotes de múltiplas fontes em uma única chamada de leitura ao RPC.

### 4. Hardware/Environment (Browser Overlay)
O robô roda no contexto do navegador (Vite dev server). O overhead de renderização do React e a execução single-threaded do JS no browser limitam a velocidade de processamento do Sniper.
> **Melhoria Sugerida:** Migrar o motor de engine para um serviço Node.js/Go dedicado, mantendo o frontend apenas para monitoramento.

---

## 🛠️ Detalhes Técnicos Úteis

- **Threshold de Consolidação:** Atualmente em $10.0 (USDT).
- **Slippage Padrão:** 0.5% (pode ser ajustado no UI).
- **Lista de Tokens:** `types.ts` contém os endereços oficiais (POL, WBTC, WETH, USDC, DAI, etc).
- **Contratos Críticos:**
    - QuickSwap V2 Router: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff`
    - Uniswap V3 Quoter: `0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6`

---

## 🎯 Objetivo para o Engenheiro
O foco deve ser **transformar o robô de um capturador reativo (polling) em um executor preditivo/reativo (event-driven)**, reduzindo o tempo entre a aparição da oportunidade on-chain e o envio da transação para menos de 500ms.

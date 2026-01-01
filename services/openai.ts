
// Declare puter for TypeScript
declare const puter: any;

export const analyzePerformance = async (assets: any[], transactions: any[]) => {
  try {
    if (typeof puter === 'undefined') {
      throw new Error("Puter.js not loaded");
    }

    const prompt = `Analise a seguinte carteira e histórico de operações do robô FlowSniper:
    Assets: ${JSON.stringify(assets)}
    History: ${JSON.stringify(transactions)}
    Forneça uma análise de mercado profissional e concisa em Português, focando em slippage, taxas de liquidez capturadas e otimização de rotas nas DEXs da Polygon (Uniswap v3, QuickSwap). 
    Responda estritamente em JSON com o seguinte formato:
    {
      "summary": "...",
      "riskLevel": "...",
      "recommendation": "...",
      "suggestedStrategy": "..."
    }`;

    const response = await puter.ai.chat(prompt, { model: 'gpt-4o' });

    // Puter.js returns the text directly in some versions or a message object
    const text = typeof response === 'string' ? response : response.message.content;

    // Clean potential markdown code blocks from response
    const cleanedJson = text.replace(/```json\n?|```/g, '').trim();

    return JSON.parse(cleanedJson);
  } catch (error) {
    console.error("FlowSniper Puter AI Error:", error);
    return {
      summary: "O serviço de IA do FlowSniper está sendo inicializado ou encontrou um erro temporário.",
      riskLevel: "Estável",
      recommendation: "Aguarde alguns segundos e tente analisar novamente.",
      suggestedStrategy: "Monitoramento de Slippage"
    };
  }
};

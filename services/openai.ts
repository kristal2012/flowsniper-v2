
// Declare puter for TypeScript
declare const puter: any;

export const analyzePerformance = async (assets: any[], transactions: any[], apiKey?: string) => {
  try {
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

    // Priority: Optional API Key (Direct) -> Puter (Free)
    if (apiKey && apiKey.trim().startsWith('sk-')) {
      console.log("Using direct OpenAI API fallback...");
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return JSON.parse(data.choices[0].message.content);
    }

    if (typeof puter === 'undefined') {
      throw new Error("Puter.js not loaded");
    }

    const response = await puter.ai.chat(prompt, { model: 'gpt-4o' });
    const text = typeof response === 'string' ? response : response.message.content;
    const cleanedJson = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleanedJson);
  } catch (error) {
    console.error("FlowSniper AI Error:", error);
    return {
      summary: "O serviço de IA do FlowSniper está sendo inicializado ou encontrou um erro temporário.",
      riskLevel: "Estável",
      recommendation: "Aguarde alguns segundos e tente analisar novamente.",
      suggestedStrategy: "Monitoramento de Slippage"
    };
  }
};

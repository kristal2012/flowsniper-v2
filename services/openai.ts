
export const analyzePerformance = async (assets: any[], transactions: any[], apiKey?: string) => {
  const prompt = `Analise a seguinte carteira e histórico de operações do robô FlowSniper:
  Assets: ${JSON.stringify(assets)}
  History: ${JSON.stringify(transactions)}
  Forneça uma análise de mercado profissional e concisa em Português, focando em slippage, taxas de liquidez capturadas e otimização de rotas nas DEXs da Polygon (Uniswap v3, QuickSwap). Use um tom técnico mas acessível.
  Responda estritamente em JSON com o seguinte formato:
  {
    "summary": "Resumo executivo da análise (máximo 500 caracteres)",
    "riskLevel": "Baixo | Médio | Alto",
    "recommendation": "Ação recomendada imediata",
    "suggestedStrategy": "Nome da estratégia otimizada"
  }`;

  try {
    // Usar a chave da variável de ambiente ou a fornecida pelo usuário
    const openaiKey = apiKey || import.meta.env.VITE_OPENAI_API_KEY;

    if (!openaiKey || !openaiKey.trim().startsWith('sk-')) {
      throw new Error('OpenAI API Key não configurada ou inválida');
    }

    console.log("🤖 Using OpenAI API for analysis...");

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // Clean Markdown code blocks if present
    content = content.replace(/^```json\s*/g, '').replace(/^```\s*/g, '').replace(/```$/g, '');

    const result = JSON.parse(content);

    console.log("✅ OpenAI analysis completed successfully");
    return result;

  } catch (error) {
    console.error("❌ FlowSniper AI Error:", error);

    // Retornar análise de fallback em caso de erro
    return {
      summary: "⚠️ Serviço de IA em modo de contingência. O robô continua monitorando o mercado e executando trades com base em parâmetros de latência e spread local.",
      riskLevel: "Médio",
      recommendation: "Verifique sua chave de API OpenAI nas configurações para ativar insights preditivos.",
      suggestedStrategy: "HFT Spread Capture"
    };
  }
};

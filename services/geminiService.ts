import { GoogleGenerativeAI } from "@google/generative-ai";
import { Transaction } from "../types";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export const getFinancialInsights = async (transactions: Transaction[], period: string) => {
  if (transactions.length === 0) return "Ainda não há dados suficientes neste período para uma análise detalhada. Adicione receitas e despesas para começar!";

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
    Atue como um Gestor de Propriedades de Alto Padrão e Especialista Financeiro (CFO) focado em imóveis de temporada (Airbnb/Booking).
    
    Contexto: Estamos analisando o desempenho financeiro do flat em Porto de Galinhas no período: *${period}*.
    
    Dados Financeiros (JSON):
    ${JSON.stringify(transactions)}

    Gere um relatório conciso, estratégico e direto (máximo 4 parágrafos) abordando:
    1. **Saúde Financeira:** O lucro obtido é satisfatório para o período? Qual a margem aproximada?
    2. **Análise de Custos:** Identifique o maior vilão das despesas e se ele está desproporcional.
    3. **Oportunidades:** Uma dica prática e acionável para aumentar a diária média ou reduzir um custo específico observado.
    
    Tom de voz: Profissional, encorajador e focado em resultados (ROI). Use formatação Markdown (negrito, tópicos) para facilitar a leitura.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error("Error fetching insights:", error);
    
    if (error.message?.includes('429')) {
        return "Muitas solicitações simultâneas. O consultor está sobrecarregado (Limite de Cota Gratuita). Por favor, aguarde 1 minuto e tente novamente.";
    }
    
    return `O consultor virtual está indisponível no momento. Erro: ${error.message || 'Desconhecido'}`;
  }
};
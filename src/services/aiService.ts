import { GoogleGenAI, Type } from '@google/genai';
import { AgentId, AgentOutput, FactCheckerOutput, MasterStrategistOutput, Asset } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const AGENT_PROMPTS: Record<AgentId, string> = {
  MARKET_REGIME: "Analise o regime de mercado atual (tendência, lateralização, volatilidade) com base no snapshot.",
  ORDERFLOW_MICRO: "Analise o micro-fluxo de ordens e volume recente.",
  PRICE_ACTION: "Analise a ação do preço, suportes, resistências e padrões de candle.",
  TECH_INDICATORS: "Analise os principais indicadores técnicos (RSI, MACD, Médias Móveis).",
  VOLATILITY_RISK: "Avalie o risco de volatilidade e eventos macro iminentes.",
  SETUP_SCORER: "Dê uma nota de 0 a 100 para a qualidade do setup atual.",
  ENTRY_PLANNER: "Defina zonas objetivas de entrada com base no risco/retorno.",
  EXIT_PLANNER: "Defina zonas objetivas de saída (alvos e stops técnicos).",
  EXECUTION_DESK: "Defina a melhor forma de executar a ordem (mercado, limite, fatiado).",
  PORTFOLIO_GUARD: "Avalie o impacto dessa operação no portfólio geral e correlações.",
  CIO_ORCHESTRATOR: "Sintetize as análises anteriores e defina o plano final educacional (postura, entrada, saída, gestão de risco).",
  MASTER_STRATEGIST_TRADER: "Junte as análises dos agentes, resolva conflitos e entregue um plano de operação educacional.",
};

export async function runAgent(
  agentId: AgentId,
  asset: Asset,
  snapshot: any,
  previousSummaries: string
): Promise<AgentOutput> {
  const prompt = `
    Você é o agente especialista ${agentId} do Nexus Crypto Desk analisando ${asset}.
    Sua missão: ${AGENT_PROMPTS[agentId]}
    
    Regras:
    - Retorne APENAS um JSON válido.
    - Sem markdown, sem blocos de código.
    - Use apenas os dados fornecidos no snapshot.
    - Conteúdo estritamente educacional. Não faça recomendações de investimento.
    
    Snapshot:
    ${JSON.stringify(snapshot)}
    
    Resumos Anteriores (Contexto):
    ${previousSummaries}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          agent: { type: Type.STRING },
          asset: { type: Type.STRING },
          thesis: { type: Type.ARRAY, items: { type: Type.STRING } },
          alerts: { type: Type.ARRAY, items: { type: Type.STRING } },
          assertions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                claim: { type: Type.STRING },
                evidence_fields: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          },
          numbers_used: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                field: { type: Type.STRING },
                value: { type: Type.NUMBER }
              }
            }
          },
          data_needed: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.STRING, description: "baixa|media|alta" },
          disclaimer: { type: Type.STRING },
          setup_score: { type: Type.NUMBER, nullable: true },
          posture: { type: Type.STRING, description: "ESPERAR|BUSCAR_ENTRADA|REDUZIR_RISCO", nullable: true },
          DEEP_ALLOWED: { type: Type.BOOLEAN, nullable: true },
          motivo: { type: Type.STRING, nullable: true }
        },
        required: ['agent', 'asset', 'thesis', 'alerts', 'assertions', 'numbers_used', 'data_needed', 'confidence', 'disclaimer']
      }
    }
  });

  return JSON.parse(response.text || '{}');
}

export async function runFactChecker(
  asset: Asset,
  snapshot: any,
  agentOutputs: any[]
): Promise<FactCheckerOutput> {
  const prompt = `
    Você é o FACT_CHECKER do Nexus Crypto Desk.
    Sua missão é validar as análises dos agentes contra o snapshot para evitar alucinações.
    
    Regras:
    - Retorne APENAS um JSON válido.
    - Valide se os números citados estão em numbers_used e batem com o snapshot.
    - Procure contradições entre os agentes.
    - Verifique erros matemáticos óbvios (ex: alvo menor que entrada em compra).
    
    Snapshot:
    ${JSON.stringify(snapshot)}
    
    Análises a validar:
    ${JSON.stringify(agentOutputs)}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          agent: { type: Type.STRING },
          status: { type: Type.STRING, description: "validated|partial|failed" },
          critical_issues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "unsupported_claim|contradiction|out_of_snapshot|math_error" },
                message: { type: Type.STRING },
                where: { type: Type.STRING }
              }
            }
          },
          missing_data: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.STRING, description: "baixa|media|alta" }
        },
        required: ['agent', 'status', 'critical_issues', 'missing_data', 'confidence']
      }
    }
  });

  return JSON.parse(response.text || '{}');
}

export async function runMasterStrategist(
  asset: Asset,
  snapshot: any,
  agentOutputs: AgentOutput[],
  reviewContext?: string
): Promise<MasterStrategistOutput> {
  const prompt = `
    Você é o MASTER_STRATEGIST_TRADER, o 12º agente do pipeline do Nexus Crypto Desk.
    Sua função é juntar as análises dos agentes, resolver conflitos, validar consistência com os dados reais do snapshot e entregar um plano de operação educacional (curto prazo) com alvos claros de entrada e saída, baseado no alvo de lucro (%) e stop (%) configurados no app.

    REGRAS OBRIGATÓRIAS (SEGURANÇA E PRECISÃO)
    1. Você não pode inventar números. Todo preço/valor citado deve existir no snapshot ou ser calculado a partir de um número do snapshot.
    2. Você deve apontar os números usados em numbers_used (caminho do snapshot) e marcar data_needed quando faltar algo.
    3. Se houver conflito entre agentes, você deve:
      - escolher a tese mais consistente com o snapshot
      - registrar conflicts_resolved em 1-3 bullets
    4. Se os dados estiverem STALE/OFFLINE/PARCIAL, você deve reduzir confidence e sugerir "esperar/atualizar".
    5. Linguagem: direta, clara, didática, sem prometer ganho.
    6. Conteúdo educacional. Não é recomendação individual.
    7. Você não pode mandar "compre agora" / "venda agora". Você só descreve condições para considerar.

    ${reviewContext ? `\n    ATENÇÃO - MODO DE REVISÃO:\n    ${reviewContext}\n` : ''}

    Cálculo de alvos (obrigatório):
    Os alvos devem respeitar profit_target_pct e stop_loss_pct:
    Se houver entry_price definido por condições, calcule:
      - take_profit_price = entry_price * (1 + profit_target_pct/100)
      - stop_price = entry_price * (1 - stop_loss_pct/100)
    Se não houver preço de entrada confiável:
      - postura = ESPERAR
      - entry.entry_price = null
      - targets.take_profit_price = null
      - targets.stop_price = null

    ENTRADA:
    Asset: ${asset}
    Params: ${JSON.stringify(snapshot.params)}
    Snapshot: ${JSON.stringify(snapshot)}
    Agent Outputs: ${JSON.stringify(agentOutputs)}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          agent: { type: Type.STRING },
          asset: { type: Type.STRING },
          scenario_now: { type: Type.STRING },
          posture: { type: Type.STRING, description: "ESPERAR|BUSCAR_ENTRADA|REDUZIR_RISCO" },
          entry: {
            type: Type.OBJECT,
            properties: {
              entry_price: { type: Type.NUMBER, nullable: true },
              conditions: { type: Type.ARRAY, items: { type: Type.STRING } },
              invalid_if: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['conditions', 'invalid_if']
          },
          targets: {
            type: Type.OBJECT,
            properties: {
              profit_target_pct: { type: Type.NUMBER },
              stop_loss_pct: { type: Type.NUMBER },
              take_profit_price: { type: Type.NUMBER, nullable: true },
              stop_price: { type: Type.NUMBER, nullable: true }
            },
            required: ['profit_target_pct', 'stop_loss_pct']
          },
          execution_plan: {
            type: Type.OBJECT,
            properties: {
              order_type: { type: Type.STRING, description: "LIMIT|MARKET|NONE" },
              notes: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['order_type', 'notes']
          },
          conflicts_resolved: { type: Type.ARRAY, items: { type: Type.STRING } },
          risks_top3: { type: Type.ARRAY, items: { type: Type.STRING } },
          numbers_used: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                field: { type: Type.STRING },
                value: { type: Type.NUMBER }
              }
            }
          },
          data_needed: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.STRING, description: "baixa|media|alta" },
          disclaimer: { type: Type.STRING }
        },
        required: [
          'agent', 'asset', 'scenario_now', 'posture', 'entry', 'targets',
          'execution_plan', 'conflicts_resolved', 'risks_top3', 'numbers_used',
          'data_needed', 'confidence', 'disclaimer'
        ]
      }
    }
  });

  return JSON.parse(response.text || '{}');
}

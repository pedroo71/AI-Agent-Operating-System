// Cor fixa por agente (DESIGN.md § Direção visual). Valores iguais aos tokens em globals.css.

export interface AgentTone {
  /** Cor sólida para texto/ícones sobre fundo escuro. */
  color: string;
  /** Fundo translúcido da mesma cor. */
  soft: string;
}

const TONES: Record<string, AgentTone> = {
  "tech-lead": { color: "#f5b84b", soft: "rgba(245,184,75,0.14)" },
  "frontend-dev": { color: "#4cd6e8", soft: "rgba(76,214,232,0.14)" },
  "backend-dev": { color: "#a78bfa", soft: "rgba(167,139,250,0.14)" },
  "qa-engineer": { color: "#5bd69a", soft: "rgba(91,214,154,0.14)" },
  "growth-strategist": { color: "#f48fb1", soft: "rgba(244,143,177,0.14)" },
};

const OTHER: AgentTone = { color: "#9a9ab0", soft: "rgba(154,154,176,0.14)" };

/** Aceita o nome ("frontend-dev") ou o agentType; qualquer outro fica cinzento. */
export function toneFor(...keys: (string | undefined)[]): AgentTone {
  for (const k of keys) {
    if (!k) continue;
    const base = k.toLowerCase().split("@")[0].replace(/^team-lead$/, "tech-lead");
    if (TONES[base]) return TONES[base];
  }
  return OTHER;
}

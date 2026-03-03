export function formatDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export function highlightMatch(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  return text.replace(re, '<strong style="color:var(--accent)">$1</strong>');
}

export const STATUS_LABELS = {
  ativo: "✅ Ativo",
  inativo: "⚠️ Inativo",
  nao_contatado: "🔘 Não Contatado",
  mudou: "📦 Mudou",
  desconhecido: "❓ Desconhecido",
};

export const STATUS_COLORS = {
  ativo: "#10b981",
  inativo: "#ef4444",
  nao_contatado: "#3b82f6",
  mudou: "#8b5cf6",
  desconhecido: "#6b7280",
};

export const ROLE_LABELS = {
  HEAD: "Chefe",
  SPOUSE: "Cônjuge",
  CHILD: "Filho(a)",
  OTHER: "Outro",
};

export const TIPO_LABELS = {
  visita: "Visita",
  tentativa: "Tentativa",
  ligacao: "Ligação",
  mensagem: "Mensagem",
};

export const RESULTADO_LABELS = {
  atendeu: "Atendeu",
  nao_atendeu: "Não Atendeu",
  nao_estava: "Não Estava",
  recusou: "Recusou",
};

export function isModified(familia) {
  return !!(
    familia.endereco_editado ||
    (familia.status && familia.status !== "nao_contatado") ||
    familia.observacoes
  );
}

export function getModifiedFields(familia) {
  const fields = [];
  if (familia.endereco_editado) fields.push("endereço");
  if (familia.status && familia.status !== "nao_contatado")
    fields.push("status");
  if (familia.observacoes) fields.push("observações");
  if (familia.aceita_visitas && familia.aceita_visitas !== "nao_contatado")
    fields.push("visitas");
  if (
    familia.interesse_retorno &&
    familia.interesse_retorno !== "nao_contatado"
  )
    fields.push("interesse");
  return fields;
}

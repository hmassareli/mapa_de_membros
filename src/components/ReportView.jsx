import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { api } from "../lib/api";
import {
  formatDate,
  RESULTADO_LABELS,
  ROLE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  TIPO_LABELS,
} from "../lib/utils";
import PrintableReport from "./PrintableReport";

const SECTION_ORDER = [
  { key: "ativo", label: "Famílias Ativas", icon: "✅" },
  { key: "inativo", label: "Famílias Inativas", icon: "⚠️" },
  { key: "nao_contatado", label: "Não Contatados", icon: "🔘" },
  { key: "mudou", label: "Mudou", icon: "📦" },
  { key: "desconhecido", label: "Desconhecido", icon: "❓" },
];

function FamilyRow({ f }) {
  const [expanded, setExpanded] = useState(false);
  const color = STATUS_COLORS[f.status] || "#6b7280";
  const membros = f.membros || [];

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-400 text-xs">{expanded ? "▼" : "▶"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">
              Família {f.nome_familia}
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${color}15`, color }}
            >
              {STATUS_LABELS[f.status] || f.status}
            </span>
            {f.aceita_visitas && f.aceita_visitas !== "nao_contatado" && (
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {f.aceita_visitas === "sim" ? "✅" : "❌"} Visitas
              </span>
            )}
            {f.interesse_retorno && f.interesse_retorno !== "nao_contatado" && (
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                Interesse: {f.interesse_retorno}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 truncate mt-0.5">
            {f.endereco_linha1 || "Sem endereço"}
            {f.telefone ? ` · ${f.telefone}` : ""}
            {" · "}
            {membros.length} membro(s)
            {f.total_visitas > 0
              ? ` · ${f.total_visitas} visita(s)`
              : " · Nenhuma visita"}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 space-y-3">
          {/* Members table */}
          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Membros
            </h5>
            <div className="space-y-1">
              {membros.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-xs text-gray-700"
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${m.sexo === "M" ? "bg-blue-500" : "bg-pink-500"}`}
                  >
                    {(m.primeiro_nome || "?")[0].toUpperCase()}
                  </span>
                  <span className="font-medium">{m.nome_completo}</span>
                  <span className="text-gray-400">
                    {ROLE_LABELS[m.papel_familia] || m.papel_familia}
                  </span>
                  {m.telefone && (
                    <span className="text-gray-400">📞 {m.telefone}</span>
                  )}
                  {m.email && (
                    <span className="text-gray-400">✉️ {m.email}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Observations */}
          {f.observacoes && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Observações
              </h5>
              <p className="text-xs text-gray-700 bg-white rounded p-2 border border-gray-100 whitespace-pre-wrap">
                {f.observacoes}
              </p>
            </div>
          )}

          {/* Last visit */}
          {f.ultimaVisitaInfo && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Última Visita
              </h5>
              <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600">
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                  {TIPO_LABELS[f.ultimaVisitaInfo.tipo] ||
                    f.ultimaVisitaInfo.tipo}
                </span>
                {f.ultimaVisitaInfo.resultado && (
                  <span
                    className={`px-1.5 py-0.5 rounded font-medium ${f.ultimaVisitaInfo.resultado === "atendeu" ? "bg-green-100 text-green-700" : f.ultimaVisitaInfo.resultado === "recusou" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}
                  >
                    {RESULTADO_LABELS[f.ultimaVisitaInfo.resultado] ||
                      f.ultimaVisitaInfo.resultado}
                  </span>
                )}
                <span>👤 {f.ultimaVisitaInfo.visitante}</span>
                {f.ultimaVisitaInfo.data_visita && (
                  <span>📅 {formatDate(f.ultimaVisitaInfo.data_visita)}</span>
                )}
                {f.ultimaVisitaInfo.notas && (
                  <span className="text-gray-500 italic">
                    — {f.ultimaVisitaInfo.notas}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportView({ familias, filters, onSelectFamily }) {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState({});
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `relatorio_completo_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}`,
  });

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    setLoading(true);
    try {
      const data = await api.relatorio();
      setReportData(data);
    } catch (err) {
      console.error("Erro ao carregar relatório:", err);
    }
    setLoading(false);
  }

  // Filter
  let filtered = reportData;
  if (filters.status) {
    filtered = filtered.filter((f) => f.status === filters.status);
  }
  if (filters.aceita_visitas) {
    filtered = filtered.filter(
      (f) => f.aceita_visitas === filters.aceita_visitas,
    );
  }
  if (filters.interesse_retorno) {
    filtered = filtered.filter(
      (f) => f.interesse_retorno === filters.interesse_retorno,
    );
  }

  // Group by status
  const grouped = {};
  for (const f of filtered) {
    const key = f.status || "desconhecido";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  }

  function toggleSection(key) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-bold text-gray-800">
            📋 Relatório Completo ({filtered.length} famílias)
          </h3>
          <button
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition cursor-pointer flex items-center gap-1"
            onClick={() => handlePrint()}
          >
            🖨️ Imprimir Relatório
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">
            Carregando relatório...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Nenhuma família encontrada com os filtros aplicados.
          </div>
        ) : (
          SECTION_ORDER.filter((s) => grouped[s.key]?.length > 0).map(
            (section) => {
              const items = grouped[section.key];
              const collapsed = collapsedSections[section.key];
              const color = STATUS_COLORS[section.key] || "#6b7280";

              return (
                <div key={section.key}>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer transition hover:opacity-90"
                    style={{
                      background: color,
                    }}
                    onClick={() => toggleSection(section.key)}
                  >
                    <span>{collapsed ? "▶" : "▼"}</span>
                    <span>
                      {section.icon} {section.label}
                    </span>
                    <span className="ml-auto bg-white/25 px-2 py-0.5 rounded-full text-xs">
                      {items.length}
                    </span>
                  </button>

                  {!collapsed && (
                    <div className="mt-2 space-y-2">
                      {items.map((f) => (
                        <FamilyRow key={f.id} f={f} />
                      ))}
                    </div>
                  )}
                </div>
              );
            },
          )
        )}
      </div>

      <PrintableReport ref={printRef} familias={filtered} />
    </div>
  );
}

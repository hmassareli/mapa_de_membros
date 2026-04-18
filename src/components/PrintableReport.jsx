import { forwardRef } from "react";
import { formatDate, ROLE_LABELS, STATUS_COLORS } from "../lib/utils";

const SECTION_ORDER = [
  { key: "ativo", label: "Famílias Ativas" },
  { key: "inativo", label: "Famílias Inativas" },
  { key: "nao_contatado", label: "Não Contatados" },
  { key: "mudou", label: "Mudou" },
  { key: "desconhecido", label: "Desconhecido" },
];

const PrintableReport = forwardRef(function PrintableReport({ familias }, ref) {
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  // Group by status
  const grouped = {};
  for (const f of familias) {
    const key = f.status || "desconhecido";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  }

  return (
    <div
      ref={ref}
      className="hidden print:block p-6 bg-white text-black text-sm"
    >
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4 portrait; }
          body * { visibility: hidden; }
          .print-report, .print-report * { visibility: visible !important; display: revert !important; }
          .print-report { position: absolute; left: 0; top: 0; width: 100%; }
          .section-header { break-after: avoid; }
          .family-block { break-inside: avoid; }
        }
      `}</style>
      <div className="print-report">
        <h1 className="text-xl font-bold text-center mb-1">
          Relatório Completo — Mapa de Membros
        </h1>
        <p className="text-xs text-gray-500 text-center mb-1">
          Ala Parque Industrial — São José dos Campos
        </p>
        <p className="text-xs text-gray-500 text-center mb-4">
          Gerado em: {dataHoje} &bull; Total: {familias.length} família(s)
        </p>

        {SECTION_ORDER.filter((s) => grouped[s.key]?.length > 0).map(
          (section) => {
            const items = grouped[section.key];
            const color = STATUS_COLORS[section.key] || "#6b7280";

            return (
              <div key={section.key} className="mb-6">
                <div
                  className="section-header px-3 py-2 rounded mb-2 text-white font-bold text-sm"
                  style={{ background: color }}
                >
                  {section.label} ({items.length})
                </div>

                {items.map((f) => {
                  const membros = f.membros || [];
                  const endereco = [
                    f.endereco_linha1,
                    f.endereco_linha2,
                    f.endereco_linha3,
                  ]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <div
                      key={f.id}
                      className="family-block border border-gray-200 rounded mb-2 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm">
                          Família {f.nome_familia}
                        </span>
                        {f.aceita_visitas &&
                          f.aceita_visitas !== "nao_contatado" && (
                            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                              Visitas:{" "}
                              {f.aceita_visitas === "sim" ? "Sim" : "Não"}
                            </span>
                          )}
                        {f.interesse_retorno &&
                          f.interesse_retorno !== "nao_contatado" && (
                            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                              Interesse: {f.interesse_retorno}
                            </span>
                          )}
                      </div>

                      <div className="text-xs text-gray-600 mb-1">
                        {endereco || "Sem endereço"}
                        {f.telefone ? ` · Tel: ${f.telefone}` : ""}
                      </div>

                      {/* Members */}
                      <div className="text-xs text-gray-700 mb-1">
                        <span className="font-semibold">Membros: </span>
                        {membros
                          .map(
                            (m) =>
                              `${m.nome_completo} (${ROLE_LABELS[m.papel_familia] || m.papel_familia})`,
                          )
                          .join(", ") || "—"}
                      </div>

                      {/* Visits */}
                      <div className="text-xs text-gray-500">
                        {f.total_visitas > 0 ? (
                          <>
                            {f.total_visitas} visita(s)
                            {f.ultima_visita &&
                              ` · Última: ${formatDate(f.ultima_visita)}`}
                          </>
                        ) : (
                          "Nenhuma visita registrada"
                        )}
                      </div>

                      {/* Observations */}
                      {f.observacoes && (
                        <div className="text-xs text-gray-600 mt-1 italic border-l-2 border-amber-300 pl-2">
                          {f.observacoes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          },
        )}

        {familias.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            Nenhuma família para exibir.
          </p>
        )}
      </div>
    </div>
  );
});

export default PrintableReport;

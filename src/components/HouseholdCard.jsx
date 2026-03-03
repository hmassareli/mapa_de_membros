import { useState } from "react";
import {
  formatDate,
  getModifiedFields,
  isModified,
  RESULTADO_LABELS,
  ROLE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  TIPO_LABELS,
} from "../lib/utils";

export default function HouseholdCard({ familia, onSelect }) {
  const [showActions, setShowActions] = useState(false);
  const f = familia;
  const modified = isModified(f);
  const modifiedFields = getModifiedFields(f);
  const color = STATUS_COLORS[f.status] || "#6b7280";
  const statusLabel = STATUS_LABELS[f.status] || f.status;

  const membros = f.membros || [];
  const chefe = membros.find((m) => m.papel_familia === "HEAD");
  const conjuge = membros.find((m) => m.papel_familia === "SPOUSE");
  const filhos = membros.filter(
    (m) => m.papel_familia === "CHILD" || m.papel_familia === "OTHER",
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={onSelect}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="text-sm font-bold text-gray-800 truncate">Família {f.nome_familia}</h4>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium border whitespace-nowrap"
            style={{
              background: `${color}15`,
              color,
              borderColor: `${color}40`,
            }}
          >
            {statusLabel}
          </span>
        </div>
        {/* Mobile toggle */}
        <button
          className="md:hidden w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(!showActions);
          }}
          title="Mais informações"
        >
          ⋮
        </button>
      </div>

      {/* Address */}
      <div className="text-xs text-gray-500 mb-2 flex items-center gap-1 flex-wrap">
        {f.endereco_editado ? (
          <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-medium">✏️ Editado</span>
        ) : null}
        {modified && !f.endereco_editado ? (
          <span
            className="text-amber-500 text-[10px]"
            title={`Alterado: ${modifiedFields.join(", ")}`}
          >
            ✏️
          </span>
        ) : null}
        <span className="truncate">
          {f.endereco_linha1 || "Sem endereço"}
        </span>
        {f.endereco_linha2 && (
          <span className="text-gray-300 truncate">— {f.endereco_linha2}</span>
        )}
      </div>

      {/* Members */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {membros.slice(0, 6).map((m) => {
          const isMale = m.sexo === "M";
          const initial = (m.primeiro_nome || "?")[0].toUpperCase();
          return (
            <div
              key={m.id}
              className="flex items-center gap-1"
              title={`${m.primeiro_nome} ${m.sobrenome} (${ROLE_LABELS[m.papel_familia] || m.papel_familia})`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${isMale ? "bg-blue-500" : "bg-pink-500"}`}>
                {initial}
              </span>
              <span className="text-[11px] text-gray-600">{m.primeiro_nome}</span>
            </div>
          );
        })}
        {membros.length > 6 && (
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">+{membros.length - 6}</span>
        )}
      </div>

      {/* Visit info / status details */}
      <div className={`overflow-hidden transition-all duration-300 ${showActions ? "max-h-96" : "max-h-0 md:max-h-96"}`}>
        <div className="flex items-center gap-2 text-xs text-gray-400 pt-2 border-t border-gray-50">
          {f.total_visitas > 0 ? (
            <>
              <span>📒 {f.total_visitas} visita(s)</span>
              {f.ultima_visita && (
                <span>Última: {formatDate(f.ultima_visita)}</span>
              )}
            </>
          ) : (
            <span className="italic">Nenhuma visita</span>
          )}
        </div>

        {/* Last visit details */}
        {f.ultimaVisitaInfo && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-medium">
              {TIPO_LABELS[f.ultimaVisitaInfo.tipo] || f.ultimaVisitaInfo.tipo}
            </span>
            {f.ultimaVisitaInfo.resultado && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${f.ultimaVisitaInfo.resultado === "atendeu" ? "bg-green-100 text-green-700" : f.ultimaVisitaInfo.resultado === "recusou" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}
              >
                {RESULTADO_LABELS[f.ultimaVisitaInfo.resultado] ||
                  f.ultimaVisitaInfo.resultado}
              </span>
            )}
            <span className="text-[10px] text-gray-400">
              👤 {f.ultimaVisitaInfo.visitante}
            </span>
          </div>
        )}

        {/* Status details */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {f.aceita_visitas && f.aceita_visitas !== "nao_contatado" && (
            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {f.aceita_visitas === "sim" ? "✅" : "❌"} Aceita visitas:{" "}
              {f.aceita_visitas}
            </span>
          )}
          {f.interesse_retorno && f.interesse_retorno !== "nao_contatado" && (
            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Interesse: {f.interesse_retorno}</span>
          )}
          {f.observacoes && (
            <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded" title={f.observacoes}>
              📝 Obs
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

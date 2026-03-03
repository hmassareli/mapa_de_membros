import { useState } from "react";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import {
  formatDate,
  getModifiedFields,
  isModified,
  RESULTADO_LABELS,
  ROLE_LABELS,
  TIPO_LABELS,
} from "../lib/utils";
import AddressModal from "./AddressModal";

export default function SidePanel({
  open,
  familia,
  onClose,
  onRefresh,
  onStartPinMode,
}) {
  const showToast = useToast();
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [coordInput, setCoordInput] = useState("");

  // Visit form
  const [visitData, setVisitData] = useState("");
  const [visitVisitante, setVisitVisitante] = useState("");
  const [visitTipo, setVisitTipo] = useState("visita");
  const [visitResultado, setVisitResultado] = useState("");
  const [visitNotas, setVisitNotas] = useState("");

  if (!familia)
    return (
      <div
        className={`fixed top-0 right-0 h-full w-105 max-w-full bg-white shadow-2xl z-1000 transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      />
    );

  const f = familia;
  const isAtivo = f.status === "ativo";
  const isInativo = f.status === "inativo";
  const modified = isModified(f);
  const modifiedFields = getModifiedFields(f);

  async function updateField(campo, valor) {
    try {
      const body = {};
      body[campo] = valor;
      await api.updateFamilia(f.id, body);
      showToast("Atualizado!", "success");
      onRefresh();
    } catch {
      showToast("Erro ao atualizar", "error");
    }
  }

  async function onStatusChange(novoStatus) {
    const body = { status: novoStatus };
    if (novoStatus === "ativo") {
      body.aceita_visitas = "sim";
      body.interesse_retorno = "nao_contatado";
    }
    if (novoStatus === "mudou" || novoStatus === "desconhecido") {
      body.aceita_visitas = "nao_contatado";
      body.interesse_retorno = "nao_contatado";
    }
    try {
      await api.updateFamilia(f.id, body);
      showToast("Status atualizado!", "success");
      onRefresh();
    } catch {
      showToast("Erro ao atualizar", "error");
    }
  }

  async function saveCoordinates() {
    const parts = coordInput.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      showToast("Formato inválido. Use: -23.2237, -45.9009", "error");
      return;
    }
    try {
      await api.geocodificar(f.id, { latitude: parts[0], longitude: parts[1] });
      showToast("Coordenadas salvas!", "success");
      onRefresh();
    } catch {
      showToast("Erro ao salvar", "error");
    }
  }

  async function addVisita() {
    if (!visitData || !visitVisitante) {
      showToast("Preencha data e visitante", "error");
      return;
    }
    try {
      await api.addVisita({
        familia_id: f.id,
        data_visita: visitData,
        visitante: visitVisitante,
        tipo: visitTipo,
        resultado: visitResultado || null,
        notas: visitNotas,
      });
      showToast("Visita registrada!", "success");
      setVisitData("");
      setVisitVisitante("");
      setVisitTipo("visita");
      setVisitResultado("");
      setVisitNotas("");
      onRefresh();
    } catch {
      showToast("Erro ao registrar visita", "error");
    }
  }

  async function deleteVisita(id) {
    if (!confirm("Deseja realmente remover esta visita?")) return;
    try {
      await api.deleteVisita(id);
      showToast("Visita removida", "success");
      onRefresh();
    } catch {
      showToast("Erro ao remover", "error");
    }
  }

  return (
    <div
      className={`fixed top-0 right-0 h-full w-105 max-w-full bg-white shadow-2xl z-1000 transition-transform duration-300 overflow-y-auto custom-scrollbar ${open ? "translate-x-0" : "translate-x-full"}`}
    >
      <button
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-lg cursor-pointer z-10"
        onClick={onClose}
      >
        &times;
      </button>

      {/* Header */}
      <div
        className="p-5 border-b border-primary"
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
        }}
      >
        <h2 className="text-lg font-bold text-white mb-2">
          Família {f.nome_familia}
        </h2>
        <div
          className="text-sm text-blue-100 leading-relaxed cursor-pointer hover:bg-blue-500/30 rounded-lg p-2 -m-2 transition"
          onClick={() => setShowAddressModal(true)}
          title="Clique para editar endereço"
        >
          {f.endereco_editado ? (
            <span className="inline-block bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-medium mr-1">
              ✏️ Editado
            </span>
          ) : null}
          {f.endereco_linha1 || ""}
          <br />
          {f.endereco_linha2 || ""}
          <br />
          {f.endereco_linha3 || ""}
          <span className="ml-1">✏️</span>
        </div>
        <div className="flex gap-2 items-center mt-2">
          <span className="text-xs bg-blue-400/30 text-white px-2 py-0.5 rounded-full font-medium">
            {f.ala || "Sem ala"}
          </span>
          {modified && (
            <span
              className="text-xs bg-amber-300/30 text-amber-100 px-2 py-0.5 rounded-full font-medium"
              title={`Campos alterados: ${modifiedFields.join(", ")}`}
            >
              ✏️ Modificado
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="p-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-700 text-sm mb-3">📋 Status</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-24 shrink-0">
              Situação:
            </label>
            <select
              value={f.status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="nao_contatado">🔘 Não Contatado</option>
              <option value="ativo">✅ Ativo na Igreja</option>
              <option value="inativo">⚠️ Inativo</option>
              <option value="mudou">📦 Mudou</option>
              <option value="desconhecido">❓ Desconhecido</option>
            </select>
          </div>
          {!isAtivo && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-24 shrink-0">
                Aceita Visitas:
              </label>
              <select
                value={f.aceita_visitas}
                onChange={(e) => updateField("aceita_visitas", e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="nao_contatado">🔘 Não Contatado</option>
                <option value="sim">✅ Sim</option>
                <option value="nao">❌ Não</option>
              </select>
            </div>
          )}
          {isInativo && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-24 shrink-0">
                Interesse em Retornar:
              </label>
              <select
                value={f.interesse_retorno}
                onChange={(e) =>
                  updateField("interesse_retorno", e.target.value)
                }
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="nao_contatado">🔘 Não Contatado</option>
                <option value="sim">✅ Sim</option>
                <option value="nao">❌ Não</option>
                <option value="talvez">🤔 Talvez</option>
              </select>
            </div>
          )}
        </div>

        {/* Coordinates */}
        {!f.latitude || !f.longitude ? (
          <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-700 mb-2">
              ⚠️ Sem coordenadas. Cole do Google Maps ou use 📍:
            </p>
            <div className="flex gap-2">
              <input
                value={coordInput}
                onChange={(e) => setCoordInput(e.target.value)}
                placeholder="-23.2237, -45.9009"
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition cursor-pointer"
                onClick={saveCoordinates}
              >
                Salvar
              </button>
            </div>
            <button
              className="mt-2 w-full px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition cursor-pointer"
              onClick={() => onStartPinMode(f.id)}
            >
              📍 Marcar no Mapa
            </button>
          </div>
        ) : (
          <div className="mt-2 text-xs text-gray-400 flex items-center gap-1 flex-wrap">
            📍 {f.latitude.toFixed(6)}, {f.longitude.toFixed(6)}
            <button
              className="px-2 py-0.5 border border-gray-200 rounded text-[10px] text-gray-500 hover:bg-gray-50 transition cursor-pointer"
              onClick={() => {
                setCoordInput(`${f.latitude}, ${f.longitude}`);
              }}
            >
              Editar
            </button>
            <button
              className="px-2 py-0.5 border border-gray-200 rounded text-[10px] text-gray-500 hover:bg-gray-50 transition cursor-pointer"
              onClick={() => onStartPinMode(f.id)}
            >
              📍 Reposicionar
            </button>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="p-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-700 text-sm mb-3">
          👥 Membros da Família ({f.membros?.length || 0})
        </h3>
        {(f.membros || []).map((m) => {
          const isMale = m.sexo === "M";
          const initials = (m.primeiro_nome || "?")[0].toUpperCase();
          const detalhes = [];
          if (m.papel_familia)
            detalhes.push(ROLE_LABELS[m.papel_familia] || m.papel_familia);
          if (m.sacerdocio) detalhes.push(m.sacerdocio);
          if (m.data_nascimento) detalhes.push(`Nasc: ${m.data_nascimento}`);
          if (m.e_jovem_adulto_solteiro) detalhes.push("JAS");
          if (m.e_adulto_solteiro) detalhes.push("Adulto Solteiro");

          const tel = m.telefone ? m.telefone.replace(/\D/g, "") : "";

          return (
            <div key={m.id} className="flex items-start gap-3 mb-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${isMale ? "bg-blue-500" : "bg-pink-500"}`}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">
                  {m.primeiro_nome} {m.sobrenome}
                </div>
                <div className="text-xs text-gray-400">
                  {detalhes.join(" • ")}
                </div>
                {(m.telefone || m.email) && (
                  <div className="mt-1 flex gap-2 flex-wrap">
                    {tel && (
                      <a
                        href={`https://wa.me/${tel}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-green-600 hover:underline"
                      >
                        📱 WhatsApp
                      </a>
                    )}{" "}
                    {m.email && (
                      <a
                        href={`mailto:${m.email}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        📧 {m.email}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Visit */}
      <div className="p-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-700 text-sm mb-3">
          ➕ Registrar Nova Visita
        </h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={visitData}
              onChange={(e) => setVisitData(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={visitVisitante}
              onChange={(e) => setVisitVisitante(e.target.value)}
              placeholder="Nome do visitante"
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={visitTipo}
              onChange={(e) => setVisitTipo(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="visita">🚶 Visita</option>
              <option value="tentativa">🔔 Tentativa</option>
              <option value="ligacao">📞 Ligação</option>
              <option value="mensagem">💬 Mensagem</option>
            </select>
            <select
              value={visitResultado}
              onChange={(e) => setVisitResultado(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">Resultado...</option>
              <option value="atendeu">✅ Atendeu</option>
              <option value="nao_atendeu">❌ Não Atendeu</option>
              <option value="nao_estava">🏠 Não Estava</option>
              <option value="recusou">🚫 Recusou</option>
            </select>
          </div>
          <textarea
            value={visitNotas}
            onChange={(e) => setVisitNotas(e.target.value)}
            placeholder="Notas sobre a visita..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-15"
          />
          <button
            className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition cursor-pointer"
            onClick={addVisita}
          >
            Registrar Visita
          </button>
        </div>
      </div>

      {/* Visit History */}
      <div className="p-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-700 text-sm mb-3">
          📒 Histórico de Visitas ({f.total_visitas || 0})
        </h3>
        {(f.visitas || []).length === 0 ? (
          <p className="text-gray-400 text-[13px] italic">
            Nenhuma visita registrada ainda.
          </p>
        ) : (
          (f.visitas || []).map((v) => (
            <div key={v.id} className="relative bg-gray-50 rounded-lg p-3 mb-2">
              <button
                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-lg cursor-pointer"
                onClick={() => deleteVisita(v.id)}
                title="Remover"
              >
                &times;
              </button>
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span>📅 {formatDate(v.data_visita)}</span>
                <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-medium">
                  {TIPO_LABELS[v.tipo] || v.tipo}
                </span>
                {v.resultado && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${v.resultado === "atendeu" ? "bg-green-100 text-green-700" : v.resultado === "recusou" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}
                  >
                    {RESULTADO_LABELS[v.resultado] || v.resultado}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">👤 {v.visitante}</div>
              {v.notas && (
                <div className="text-xs text-gray-400 mt-1 italic">
                  &quot;{v.notas}&quot;
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Notes */}
      <div className="p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-3">
          📝 Observações
        </h3>
        <textarea
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-20"
          defaultValue={f.observacoes || ""}
          placeholder="Observações sobre esta família..."
          onBlur={(e) => updateField("observacoes", e.target.value)}
        />
      </div>

      {/* Address Modal */}
      {showAddressModal && (
        <AddressModal
          familia={f}
          onClose={() => setShowAddressModal(false)}
          onSaved={() => {
            setShowAddressModal(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

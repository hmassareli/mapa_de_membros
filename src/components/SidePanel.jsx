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

  if (!familia) return <div className={`side-panel ${open ? "open" : ""}`} />;

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
    <div className={`side-panel ${open ? "open" : ""}`}>
      <button className="close-btn" onClick={onClose}>
        &times;
      </button>

      {/* Header */}
      <div className="familia-header">
        <h2>Família {f.nome_familia}</h2>
        <div
          className="endereco endereco-clickable"
          onClick={() => setShowAddressModal(true)}
          title="Clique para editar endereço"
        >
          {f.endereco_editado ? (
            <span className="modified-tag">✏️ Editado</span>
          ) : null}
          {f.endereco_linha1 || ""}
          <br />
          {f.endereco_linha2 || ""}
          <br />
          {f.endereco_linha3 || ""}
          <span className="btn-edit-address">✏️</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <span className="ala-tag">{f.ala || "Sem ala"}</span>
          {modified && (
            <span
              className="modified-badge"
              title={`Campos alterados: ${modifiedFields.join(", ")}`}
            >
              ✏️ Modificado
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="panel-section">
        <h3>📋 Status</h3>
        <div className="status-controls">
          <div className="status-row">
            <label>Situação:</label>
            <select
              value={f.status}
              onChange={(e) => onStatusChange(e.target.value)}
            >
              <option value="nao_contatado">🔘 Não Contatado</option>
              <option value="ativo">✅ Ativo na Igreja</option>
              <option value="inativo">⚠️ Inativo</option>
              <option value="mudou">📦 Mudou</option>
              <option value="desconhecido">❓ Desconhecido</option>
            </select>
          </div>
          {!isAtivo && (
            <div className="status-row">
              <label>Aceita Visitas:</label>
              <select
                value={f.aceita_visitas}
                onChange={(e) => updateField("aceita_visitas", e.target.value)}
              >
                <option value="nao_contatado">🔘 Não Contatado</option>
                <option value="sim">✅ Sim</option>
                <option value="nao">❌ Não</option>
              </select>
            </div>
          )}
          {isInativo && (
            <div className="status-row">
              <label>Interesse em Retornar:</label>
              <select
                value={f.interesse_retorno}
                onChange={(e) =>
                  updateField("interesse_retorno", e.target.value)
                }
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
          <div className="coord-input-section">
            <p>⚠️ Sem coordenadas. Cole do Google Maps ou use 📍:</p>
            <div className="coord-input-row">
              <input
                value={coordInput}
                onChange={(e) => setCoordInput(e.target.value)}
                placeholder="-23.2237, -45.9009"
              />
              <button
                className="btn btn-primary btn-small"
                onClick={saveCoordinates}
              >
                Salvar
              </button>
            </div>
            <button
              className="btn btn-success btn-small"
              style={{ marginTop: 6, width: "100%" }}
              onClick={() => onStartPinMode(f.id)}
            >
              📍 Marcar no Mapa
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 4 }}>
            📍 {f.latitude.toFixed(6)}, {f.longitude.toFixed(6)}
            <button
              className="btn btn-small btn-secondary"
              style={{ marginLeft: 4 }}
              onClick={() => {
                setCoordInput(`${f.latitude}, ${f.longitude}`);
              }}
            >
              Editar
            </button>
            <button
              className="btn btn-small btn-secondary"
              style={{ marginLeft: 4 }}
              onClick={() => onStartPinMode(f.id)}
            >
              📍 Reposicionar
            </button>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="panel-section">
        <h3>👥 Membros da Família ({f.membros?.length || 0})</h3>
        {(f.membros || []).map((m) => {
          const avatarClass = m.sexo === "M" ? "avatar-m" : "avatar-f";
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
            <div key={m.id} className="membro-card">
              <div className={`membro-avatar ${avatarClass}`}>{initials}</div>
              <div className="membro-info">
                <div className="membro-nome">
                  {m.primeiro_nome} {m.sobrenome}
                </div>
                <div className="membro-detalhe">{detalhes.join(" • ")}</div>
                {(m.telefone || m.email) && (
                  <div style={{ marginTop: 3 }}>
                    {tel && (
                      <a
                        href={`https://wa.me/${tel}`}
                        target="_blank"
                        rel="noreferrer"
                        className="contact-link"
                      >
                        📱 WhatsApp
                      </a>
                    )}{" "}
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="contact-link">
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
      <div className="panel-section">
        <h3>➕ Registrar Nova Visita</h3>
        <div className="form-nova-visita">
          <div className="form-row">
            <input
              type="date"
              value={visitData}
              onChange={(e) => setVisitData(e.target.value)}
            />
            <input
              type="text"
              value={visitVisitante}
              onChange={(e) => setVisitVisitante(e.target.value)}
              placeholder="Nome do visitante"
            />
          </div>
          <div className="form-row">
            <select
              value={visitTipo}
              onChange={(e) => setVisitTipo(e.target.value)}
            >
              <option value="visita">🚶 Visita</option>
              <option value="tentativa">🔔 Tentativa</option>
              <option value="ligacao">📞 Ligação</option>
              <option value="mensagem">💬 Mensagem</option>
            </select>
            <select
              value={visitResultado}
              onChange={(e) => setVisitResultado(e.target.value)}
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
          />
          <button className="btn btn-success" onClick={addVisita}>
            Registrar Visita
          </button>
        </div>
      </div>

      {/* Visit History */}
      <div className="panel-section">
        <h3>📒 Histórico de Visitas ({f.total_visitas || 0})</h3>
        {(f.visitas || []).length === 0 ? (
          <p
            style={{
              color: "var(--gray-400)",
              fontSize: 13,
              fontStyle: "italic",
            }}
          >
            Nenhuma visita registrada ainda.
          </p>
        ) : (
          (f.visitas || []).map((v) => (
            <div key={v.id} className="visita-card">
              <button
                className="visita-delete"
                onClick={() => deleteVisita(v.id)}
                title="Remover"
              >
                &times;
              </button>
              <div className="visita-data">
                📅 {formatDate(v.data_visita)}
                <span className="visita-tipo">
                  {TIPO_LABELS[v.tipo] || v.tipo}
                </span>
                {v.resultado && (
                  <span className={`visita-resultado resultado-${v.resultado}`}>
                    {RESULTADO_LABELS[v.resultado] || v.resultado}
                  </span>
                )}
              </div>
              <div className="visita-visitante">👤 {v.visitante}</div>
              {v.notas && (
                <div className="visita-notas">&quot;{v.notas}&quot;</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Notes */}
      <div className="panel-section">
        <h3>📝 Observações</h3>
        <textarea
          className="obs-textarea"
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

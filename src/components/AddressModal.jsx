import { useEffect, useRef, useState } from "react";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import geocodeClient from "../lib/geocodeClient";

/**
 * Modal de edição de endereço com busca automática por CEP (BrasilAPI).
 * Modelo da igreja: linha1 (rua + nº), linha2 (bairro/complemento), linha3 (cidade-UF CEP).
 */
export default function AddressModal({ familia, onClose, onSaved }) {
  const showToast = useToast();
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);
  const cepRef = useRef(null);

  // Parse current address into fields on mount
  useEffect(() => {
    if (!familia) return;
    const l1 = familia.endereco_linha1 || "";
    const l2 = familia.endereco_linha2 || "";
    const l3 = familia.endereco_linha3 || "";

    // Try to extract rua and numero from linha1 (e.g. "Rua Tal, 123")
    const ruaNumMatch = l1.match(/^(.+?),?\s*(\d+\w*)\s*$/);
    if (ruaNumMatch) {
      setRua(ruaNumMatch[1].trim());
      setNumero(ruaNumMatch[2].trim());
    } else {
      setRua(l1);
    }

    // linha2 could be "Bairro Tal" or "Bairro Tal - Complemento"
    const bairroCompl = l2.split(/\s*-\s*/);
    setBairro(bairroCompl[0] || "");
    setComplemento(bairroCompl.slice(1).join(" - ") || "");

    // linha3 typically "Cidade-UF CEP" or "Cidade, UF CEP"
    const cepMatch = l3.match(/(\d{5})-?(\d{3})/);
    if (cepMatch) setCep(cepMatch[1] + "-" + cepMatch[2]);

    const cidadeEstMatch = l3.match(/^([^,\d-]+)[\s,\-]+([A-Z]{2})/i);
    if (cidadeEstMatch) {
      setCidade(cidadeEstMatch[1].trim());
      setEstado(cidadeEstMatch[2].trim().toUpperCase());
    } else {
      // Fallback: just set what we have minus CEP
      const semCep = l3
        .replace(/\d{5}-?\d{3}/, "")
        .replace(/[,\-\s]+$/, "")
        .trim();
      setCidade(semCep);
    }

    setTimeout(() => cepRef.current?.focus(), 100);
  }, [familia]);

  // Auto-fill from CEP
  async function buscarCep(cepValue) {
    const clean = cepValue.replace(/\D/g, "");
    if (clean.length !== 8) return;

    setLoadingCep(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
      if (!res.ok) {
        showToast("CEP não encontrado", "error");
        setLoadingCep(false);
        return;
      }
      const data = await res.json();
      if (data.street) setRua(data.street);
      if (data.neighborhood) setBairro(data.neighborhood);
      if (data.city) setCidade(data.city);
      if (data.state) setEstado(data.state);
      showToast("Endereço preenchido via CEP!", "success");
    } catch {
      showToast("Erro ao buscar CEP", "error");
    }
    setLoadingCep(false);
  }

  function handleCepChange(value) {
    // Format as 12345-678
    let clean = value.replace(/\D/g, "").slice(0, 8);
    if (clean.length > 5) clean = clean.slice(0, 5) + "-" + clean.slice(5);
    setCep(clean);

    // Auto-search when 8 digits
    if (clean.replace("-", "").length === 8) {
      buscarCep(clean);
    }
  }

  function buildAddressLines() {
    let linha1 = rua.trim();
    if (numero.trim()) linha1 += (linha1 ? ", " : "") + numero.trim();

    let linha2 = bairro.trim();
    if (complemento.trim())
      linha2 += (linha2 ? " - " : "") + complemento.trim();

    const cepClean = cep.replace(/\D/g, "");
    const cepFormatted =
      cepClean.length === 8
        ? cepClean.slice(0, 5) + "-" + cepClean.slice(5)
        : cepClean;
    let linha3 = "";
    if (cidade.trim()) linha3 += cidade.trim();
    if (estado.trim())
      linha3 += (linha3 ? "-" : "") + estado.trim().toUpperCase();
    if (cepFormatted) linha3 += (linha3 ? " " : "") + cepFormatted;

    return { linha1, linha2, linha3 };
  }

  async function handleSave() {
    const { linha1, linha2, linha3 } = buildAddressLines();
    if (!linha1 && !linha2 && !linha3) {
      showToast("Preencha pelo menos um campo", "error");
      return;
    }

    setSaving(true);
    try {
      const enderecoCompleto = [linha1, linha2, linha3]
        .filter(Boolean)
        .join(", ");
      await api.updateFamilia(familia.id, {
        endereco_linha1: linha1,
        endereco_linha2: linha2,
        endereco_linha3: linha3,
        endereco_completo: enderecoCompleto,
      });
      showToast("Endereço atualizado! Buscando coordenadas...", "success");

      // Auto-geocode the family with the new address
      const familiaAtualizada = {
        ...familia,
        endereco_linha1: linha1,
        endereco_linha2: linha2,
        endereco_linha3: linha3,
        endereco_completo: enderecoCompleto,
      };
      const geo = await geocodeClient.geocodeSingle(familiaAtualizada);
      if (geo.sucesso) {
        showToast(`📍 Localização encontrada via ${geo.fonte}!`, "success");
      } else {
        showToast(
          "Endereço salvo, mas não foi possível encontrar coordenadas. Você pode marcar manualmente no mapa.",
          "warning",
        );
      }

      onSaved();
    } catch {
      showToast("Erro ao salvar endereço", "error");
    }
    setSaving(false);
  }

  // Preview
  const preview = buildAddressLines();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>✏️ Editar Endereço</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* CEP first — auto-fills rest */}
          <div className="addr-field">
            <label>CEP</label>
            <div className="addr-cep-row">
              <input
                ref={cepRef}
                type="text"
                value={cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="12345-678"
                maxLength={9}
              />
              {loadingCep && <span className="addr-cep-spinner" />}
            </div>
          </div>

          <div className="addr-row">
            <div className="addr-field addr-field-grow">
              <label>Rua / Logradouro</label>
              <input
                type="text"
                value={rua}
                onChange={(e) => setRua(e.target.value)}
                placeholder="Rua Exemplo"
              />
            </div>
            <div className="addr-field addr-field-small">
              <label>Nº</label>
              <input
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="123"
              />
            </div>
          </div>

          <div className="addr-row">
            <div className="addr-field addr-field-grow">
              <label>Bairro</label>
              <input
                type="text"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Bairro"
              />
            </div>
            <div className="addr-field addr-field-grow">
              <label>Complemento</label>
              <input
                type="text"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Apto 12, Bloco B"
              />
            </div>
          </div>

          <div className="addr-row">
            <div className="addr-field addr-field-grow">
              <label>Cidade</label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="São Paulo"
              />
            </div>
            <div className="addr-field addr-field-small">
              <label>UF</label>
              <input
                type="text"
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="addr-preview">
            <span className="addr-preview-label">Pré-visualização</span>
            <div className="addr-preview-lines">
              <div>{preview.linha1 || <em>—</em>}</div>
              <div>{preview.linha2 || <em>—</em>}</div>
              <div>{preview.linha3 || <em>—</em>}</div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar Endereço"}
          </button>
        </div>
      </div>
    </div>
  );
}

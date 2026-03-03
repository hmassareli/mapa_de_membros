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
    <div
      className="fixed inset-0 bg-black/50 z-2000 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-[modalSlideIn_0.3s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">✏️ Editar Endereço</h3>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl cursor-pointer"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* CEP first — auto-fills rest */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              CEP
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={cepRef}
                type="text"
                value={cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="12345-678"
                maxLength={9}
                className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              {loadingCep && (
                <span className="inline-block w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Rua / Logradouro
              </label>
              <input
                type="text"
                value={rua}
                onChange={(e) => setRua(e.target.value)}
                placeholder="Rua Exemplo"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Nº
              </label>
              <input
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="123"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Bairro"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Complemento
              </label>
              <input
                type="text"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Apto 12, Bloco B"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="São Paulo"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                UF
              </label>
              <input
                type="text"
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
                placeholder="SP"
                maxLength={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              Pré-visualização
            </span>
            <div className="mt-1 text-sm text-gray-700 leading-relaxed">
              <div>
                {preview.linha1 || <em className="text-gray-300">—</em>}
              </div>
              <div>
                {preview.linha2 || <em className="text-gray-300">—</em>}
              </div>
              <div>
                {preview.linha3 || <em className="text-gray-300">—</em>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition cursor-pointer"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60 cursor-pointer"
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

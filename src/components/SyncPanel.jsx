import { useEffect, useState } from "react";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";

export default function SyncPanel({
  onClose,
  onRefresh,
  onStartGeocode,
  onStartRefinamento,
}) {
  const showToast = useToast();
  const [loading, setLoading] = useState(true);
  const [geocodeInfo, setGeocodeInfo] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [dados, geocode] = await Promise.all([
        api.temDados(),
        api.geocodeStats(),
      ]);
      const fonteMap = {};
      (geocode.stats || []).forEach((s) => {
        fonteMap[s.geocode_fonte || "null"] = s.total;
      });

      setGeocodeInfo({
        totalCep: fonteMap["cep"] || 0,
        totalNominatim: fonteMap["nominatim"] || 0,
        totalManual: fonteMap["manual"] || 0,
        totalFalhou: fonteMap["nominatim_falhou"] || 0,
        totalSemCoord: fonteMap["null"] || 0,
        totalNoMapa: geocode.total - (fonteMap["null"] || 0),
        totalFamilias: dados.totalFamilias,
      });
    } catch (err) {
      showToast("Erro ao carregar dados", "error");
    }
    setLoading(false);
  }

  async function sincronizarJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyncResult(null);
    try {
      const text = await file.text();
      const dados = JSON.parse(text);
      const result = await api.sincronizar(dados);
      setSyncResult({ type: "success", message: result.mensagem });
      showToast("Dados sincronizados!", "success");
      if (result.familiasNovas > 0 || result.enderecosAlterados > 0) {
        onStartGeocode();
      }
      onRefresh();
      setTimeout(loadData, 1500);
    } catch (err) {
      setSyncResult({ type: "error", message: err.message });
    }
    e.target.value = "";
  }

  async function regeocodificar(modo) {
    if (
      modo === "todos" &&
      !confirm("Isso vai apagar TODAS as coordenadas. Continuar?")
    )
      return;
    try {
      const r = await api.regeocodificar(modo);
      showToast(r.mensagem, "success");
      onClose();
      if (modo === "todos") setTimeout(onStartGeocode, 500);
      else setTimeout(onStartRefinamento, 500);
      onRefresh();
    } catch (err) {
      showToast("Erro: " + err.message, "error");
    }
  }

  async function resetarDados() {
    if (
      !confirm(
        "⚠️ ATENÇÃO: Apagar TODOS os dados? Esta ação NÃO pode ser desfeita.",
      )
    )
      return;
    if (!confirm("Tem certeza absoluta?")) return;
    try {
      const r = await api.resetar();
      showToast(r.mensagem, "success");
      onClose();
      onRefresh();
    } catch (err) {
      showToast("Erro: " + err.message, "error");
    }
  }

  const g = geocodeInfo;

  return (
    <div className="sync-panel" style={{ display: "block" }}>
      <div className="sync-header">
        <h4>⚙️ Sincronização e Dados</h4>
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>
      </div>
      <div className="sync-content">
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--gray-400)" }}>
            Carregando...
          </p>
        ) : (
          <>
            <div className="sync-section">
              <h5>📍 Coordenadas</h5>
              <div className="sync-stats">
                <div className="sync-stat">
                  <span className="stat-val">{g?.totalNoMapa || 0}</span>
                  <span className="stat-lbl">no mapa</span>
                </div>
                <div className="sync-stat">
                  <span className="stat-val">{g?.totalSemCoord || 0}</span>
                  <span className="stat-lbl">sem coordenada</span>
                </div>
                <div className="sync-stat">
                  <span className="stat-val">{g?.totalCep || 0}</span>
                  <span className="stat-lbl">via CEP</span>
                </div>
                <div className="sync-stat">
                  <span className="stat-val">{g?.totalNominatim || 0}</span>
                  <span className="stat-lbl">via Nominatim</span>
                </div>
                <div className="sync-stat">
                  <span className="stat-val">{g?.totalManual || 0}</span>
                  <span className="stat-lbl">manual</span>
                </div>
                <div className="sync-stat">
                  <span className="stat-val">{g?.totalFalhou || 0}</span>
                  <span className="stat-lbl">Nominatim falhou</span>
                </div>
              </div>
              <div className="sync-btn-group">
                {(g?.totalCep || 0) > 0 && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      onClose();
                      onStartRefinamento();
                    }}
                  >
                    🔄 Refinar {g.totalCep} via Nominatim
                  </button>
                )}
                {(g?.totalFalhou || 0) > 0 && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => regeocodificar("falhou")}
                  >
                    🔁 Retentar {g.totalFalhou} que falharam
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => regeocodificar("todos")}
                >
                  🗺️ Regeocodificar tudo
                </button>
              </div>
            </div>

            <div className="sync-section">
              <h5>📤 Atualizar Dados</h5>
              <p>
                Envie um novo <strong>members.json</strong> para sincronizar.
                Suas visitas, status e observações são mantidos.
              </p>
              <label className="sync-upload-area">
                📁 Clique para enviar members.json
                <input type="file" accept=".json" onChange={sincronizarJSON} />
              </label>
              {syncResult && (
                <div className={`sync-result ${syncResult.type}`}>
                  {syncResult.type === "success" ? "✅" : "❌"}{" "}
                  {syncResult.message}
                </div>
              )}
            </div>

            <div className="sync-section">
              <h5>⚠️ Zona de Perigo</h5>
              <div className="sync-btn-group">
                <button
                  className="btn btn-danger-outline"
                  onClick={resetarDados}
                >
                  🗑️ Apagar todos os dados
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

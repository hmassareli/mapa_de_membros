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
    <div className="absolute bottom-20 right-4 z-500 w-96 max-w-[calc(100vw-2rem)] max-h-[80vh] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h4 className="font-semibold text-sm text-gray-700">⚙️ Sincronização e Dados</h4>
        <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-sm cursor-pointer" onClick={onClose}>
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
        {loading ? (
          <p className="text-center text-gray-400 text-sm">
            Carregando...
          </p>
        ) : (
          <>
            <div>
              <h5 className="font-semibold text-sm text-gray-700 mb-2">📍 Coordenadas</h5>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <span className="block text-lg font-bold text-blue-600">{g?.totalNoMapa || 0}</span>
                  <span className="block text-[10px] text-gray-400">no mapa</span>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <span className="block text-lg font-bold text-red-500">{g?.totalSemCoord || 0}</span>
                  <span className="block text-[10px] text-gray-400">sem coordenada</span>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <span className="block text-lg font-bold text-green-600">{g?.totalCep || 0}</span>
                  <span className="block text-[10px] text-gray-400">via CEP</span>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <span className="block text-lg font-bold text-indigo-600">{g?.totalNominatim || 0}</span>
                  <span className="block text-[10px] text-gray-400">via Nominatim</span>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <span className="block text-lg font-bold text-amber-600">{g?.totalManual || 0}</span>
                  <span className="block text-[10px] text-gray-400">manual</span>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <span className="block text-lg font-bold text-gray-500">{g?.totalFalhou || 0}</span>
                  <span className="block text-[10px] text-gray-400">Nominatim falhou</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {(g?.totalCep || 0) > 0 && (
                  <button
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition cursor-pointer text-left"
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
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition cursor-pointer text-left"
                    onClick={() => regeocodificar("falhou")}
                  >
                    🔁 Retentar {g.totalFalhou} que falharam
                  </button>
                )}
                <button
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition cursor-pointer text-left"
                  onClick={() => regeocodificar("todos")}
                >
                  🗺️ Regeocodificar tudo
                </button>
              </div>
            </div>

            <div>
              <h5 className="font-semibold text-sm text-gray-700 mb-2">📤 Atualizar Dados</h5>
              <p className="text-xs text-gray-500 mb-2">
                Envie um novo <strong>members.json</strong> para sincronizar.
                Suas visitas, status e observações são mantidos.
              </p>
              <label className="block border-2 border-dashed border-gray-200 rounded-lg p-3 text-center text-xs text-gray-500 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                📁 Clique para enviar members.json
                <input type="file" accept=".json" onChange={sincronizarJSON} className="hidden" />
              </label>
              {syncResult && (
                <div className={`mt-2 p-2 rounded-lg text-xs ${syncResult.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {syncResult.type === "success" ? "✅" : "❌"}{" "}
                  {syncResult.message}
                </div>
              )}
            </div>

            <div>
              <h5 className="font-semibold text-sm text-red-600 mb-2">⚠️ Zona de Perigo</h5>
              <button
                className="w-full px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs hover:bg-red-50 transition cursor-pointer"
                onClick={resetarDados}
              >
                🗑️ Apagar todos os dados
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

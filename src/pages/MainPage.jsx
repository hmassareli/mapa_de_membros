import { useCallback, useEffect, useRef, useState } from "react";
import FabGroup from "../components/FabGroup";
import Header from "../components/Header";
import Legend from "../components/Legend";
import MapView from "../components/MapView";
import NoCoordsPanel from "../components/NoCoordsPanel";
import ReportView from "../components/ReportView";
import SidePanel from "../components/SidePanel";
import SyncPanel from "../components/SyncPanel";
import Toolbar from "../components/Toolbar";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import geocodeClient from "../lib/geocodeClient";

export default function MainPage() {
  const showToast = useToast();

  // Data
  const [familias, setFamilias] = useState([]);
  const [stats, setStats] = useState({});
  const [familiaDetalhe, setFamiliaDetalhe] = useState(null);

  // UI state
  const [viewMode, setViewMode] = useState("map"); // map | report
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [noCoordsPanelOpen, setNoCoordsPanelOpen] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pinFamiliaId, setPinFamiliaId] = useState("");
  const [importNeeded, setImportNeeded] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    status: "",
    aceita_visitas: "",
    interesse_retorno: "",
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Geocode progress
  const [geocodeProgress, setGeocodeProgress] = useState(null);
  const [refinamentoProgress, setRefinamentoProgress] = useState(null);

  // Map ref for imperative control
  const mapRef = useRef(null);

  // Load data
  const loadStats = useCallback(async () => {
    try {
      setStats(await api.estatisticas());
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
    }
  }, []);

  const loadFamilias = useCallback(async (params = {}) => {
    try {
      const data = await api.familias(params);
      setFamilias(data);
    } catch (err) {
      console.error("Erro ao carregar famílias:", err);
    }
  }, []);

  const getFilterParams = useCallback(() => {
    const p = {};
    if (filters.status) p.status = filters.status;
    if (filters.aceita_visitas) p.aceita_visitas = filters.aceita_visitas;
    if (filters.interesse_retorno)
      p.interesse_retorno = filters.interesse_retorno;
    return p;
  }, [filters]);

  const refresh = useCallback(() => {
    loadFamilias(getFilterParams());
    loadStats();
  }, [loadFamilias, loadStats, getFilterParams]);

  useEffect(() => {
    loadStats();
    loadFamilias();
    checkImportNeeded();
    setTimeout(() => iniciarRefinamentoNominatim(), 3000);
  }, []);

  useEffect(() => {
    loadFamilias(getFilterParams());
  }, [filters]);

  // Import check
  async function checkImportNeeded() {
    try {
      const data = await api.temDados();
      setImportNeeded(!data.temDados);
    } catch {}
  }

  // Load family detail
  async function loadFamiliaDetalhe(id) {
    try {
      const data = await api.familia(id);
      setFamiliaDetalhe(data);
      setSidePanelOpen(true);
    } catch (err) {
      showToast("Erro ao carregar detalhes", "error");
    }
  }

  // Upload from banner
  async function handleImportFile(file) {
    try {
      const text = await file.text();
      const dados = JSON.parse(text);
      const result = await api.importar(dados);
      showToast(
        `Importados: ${result.familias} famílias e ${result.membros} membros!`,
        "success",
      );
      setImportNeeded(false);
      refresh();
      iniciarGeocodeBg();
    } catch (err) {
      showToast("Erro: " + err.message, "error");
    }
  }

  // Geocode
  async function iniciarGeocodeBg() {
    try {
      const fams = await api.familiasSemCoordenadas();
      if (!fams.length) return;

      setGeocodeProgress({
        current: 0,
        total: fams.length,
        sucesso: 0,
        falha: 0,
      });

      geocodeClient.setOnProgress((p) => {
        setGeocodeProgress({
          current: p.current,
          total: p.total,
          sucesso: p.sucesso,
          falha: p.falha,
        });
        // Atualizar mapa em tempo real quando família recebe coordenadas
        if (p.ultimaFamiliaId && p.ultimaCoords) {
          setFamilias((prev) =>
            prev.map((f) =>
              f.id === p.ultimaFamiliaId
                ? {
                    ...f,
                    latitude: p.ultimaCoords.lat,
                    longitude: p.ultimaCoords.lon,
                  }
                : f,
            ),
          );
        }
      });
      geocodeClient.setOnComplete((p) => {
        showToast(
          `Geocodificação: ${p.sucesso} encontrados, ${p.falha} não encontrados`,
          "success",
        );
        setGeocodeProgress(null);
        refresh();
      });
      geocodeClient.iniciar(fams, "");
    } catch {}
  }

  async function iniciarRefinamentoNominatim() {
    if (geocodeClient.isRunning()) return;
    try {
      const fams = await api.familiasPendentesRefinamento();
      if (!fams.length) return;

      setRefinamentoProgress({
        current: 0,
        total: fams.length,
        sucesso: 0,
        falha: 0,
      });

      geocodeClient.setOnProgress((p) => {
        setRefinamentoProgress({
          current: p.current,
          total: p.total,
          sucesso: p.sucesso,
          falha: p.falha,
        });
        // Atualizar mapa em tempo real quando família recebe coordenadas
        if (p.ultimaFamiliaId && p.ultimaCoords) {
          setFamilias((prev) =>
            prev.map((f) =>
              f.id === p.ultimaFamiliaId
                ? {
                    ...f,
                    latitude: p.ultimaCoords.lat,
                    longitude: p.ultimaCoords.lon,
                  }
                : f,
            ),
          );
        }
      });
      geocodeClient.setOnComplete((p) => {
        showToast(
          `Refinamento: ${p.sucesso} melhorados, ${p.falha} sem resultado`,
          "success",
        );
        setRefinamentoProgress(null);
        refresh();
      });
      geocodeClient.refinar(fams, "");
    } catch (err) {
      console.error("Erro refinamento:", err);
    }
  }

  // Pin mode
  function enablePinMode(familiaId) {
    setPinMode(true);
    if (familiaId) setPinFamiliaId(String(familiaId));
    setSidePanelOpen(false);
  }

  function disablePinMode() {
    setPinMode(false);
    setPinFamiliaId("");
  }

  async function handleMapClickPin(lat, lng) {
    if (!pinFamiliaId) {
      showToast("Selecione uma família primeiro!", "error");
      return;
    }
    try {
      const result = await api.geocodificar(pinFamiliaId, { latitude: lat, longitude: lng });
      if (result.erro) throw new Error(result.erro);
      const fam = familias.find((f) => f.id === parseInt(pinFamiliaId));
      showToast(
        `📍 Localização salva para ${fam?.nome_familia || "família"}!`,
        "success",
      );
      disablePinMode();
      refresh();
    } catch (err) {
      showToast(`Erro ao salvar localização: ${err.message}`, "error");
    }
  }

  // Fly to family on map
  function flyToFamily(familia) {
    if (familia.latitude && familia.longitude && mapRef.current) {
      mapRef.current.flyTo([familia.latitude, familia.longitude], 18, {
        duration: 0.8,
      });
    }
  }

  // Handle select family (from search, report, etc)
  function handleSelectFamily(id) {
    const fam = familias.find((f) => f.id === id);
    loadFamiliaDetalhe(id);
    if (fam) flyToFamily(fam);
    if (viewMode === "report") setViewMode("map");
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        if (pinMode) disablePinMode();
        else if (sidePanelOpen) setSidePanelOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pinMode, sidePanelOpen]);

  const progress = geocodeProgress || refinamentoProgress;
  const progressLabel = geocodeProgress
    ? "🗺️ Geocodificando..."
    : "🔄 Refinando coordenadas...";

  return (
    <>
      <Header
        stats={stats}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <Toolbar
        filters={filters}
        onFiltersChange={setFilters}
        familias={familias}
        onSelectFamily={handleSelectFamily}
        mapRef={mapRef}
      />

      {/* Import banner */}
      {importNeeded && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
          <span>⚠️ Nenhum dado importado ainda.</span>
          <label className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-blue-700 transition">
            📁 Enviar members.json
            <input
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={(e) =>
                e.target.files.length && handleImportFile(e.target.files[0])
              }
            />
          </label>
          <button
            className="ml-auto text-amber-600 hover:text-amber-800 text-lg leading-none cursor-pointer"
            onClick={() => setImportNeeded(false)}
          >
            ×
          </button>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        {viewMode === "map" ? (
          <>
            <MapView
              ref={mapRef}
              familias={familias}
              onMarkerClick={(id) => loadFamiliaDetalhe(id)}
              pinMode={pinMode}
              onMapClickPin={handleMapClickPin}
            />

            <Legend />

            <FabGroup
              pinMode={pinMode}
              onTogglePinMode={() => {
                if (pinMode) disablePinMode();
                else {
                  enablePinMode();
                }
              }}
              onShowNoCoords={() => {
                const noCoords = familias.filter(
                  (f) => !f.latitude || !f.longitude,
                );
                if (noCoords.length === 0) {
                  showToast("Todas as famílias estão no mapa! 🎉", "success");
                  return;
                }
                setNoCoordsPanelOpen((v) => !v);
                setSyncPanelOpen(false);
              }}
              onShowSync={() => {
                setSyncPanelOpen((v) => !v);
                setNoCoordsPanelOpen(false);
              }}
            />

            {/* Pin mode banner */}
            {pinMode && (
              <div className="absolute top-0 left-0 right-0 z-1000 flex items-center gap-3 bg-white/95 backdrop-blur-sm border-b border-amber-300 px-4 py-2 shadow-lg text-sm">
                <span>
                  📍 Clique no mapa para marcar a localização. Selecione a
                  família abaixo.
                </span>
                <select
                  value={pinFamiliaId}
                  onChange={(e) => setPinFamiliaId(e.target.value)}
                  className="px-2 py-1 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Selecione uma família --</option>
                  <optgroup label="Sem coordenadas">
                    {familias
                      .filter((f) => !f.latitude || !f.longitude)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome_familia} -{" "}
                          {f.endereco_linha1 || "sem endereço"}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Com coordenadas (reposicionar)">
                    {familias
                      .filter((f) => f.latitude && f.longitude)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome_familia}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <button
                  className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition cursor-pointer"
                  onClick={disablePinMode}
                >
                  Cancelar
                </button>
              </div>
            )}

            {noCoordsPanelOpen && (
              <NoCoordsPanel
                familias={familias.filter((f) => !f.latitude || !f.longitude)}
                onSelect={handleSelectFamily}
                onClose={() => setNoCoordsPanelOpen(false)}
              />
            )}

            {syncPanelOpen && (
              <SyncPanel
                onClose={() => setSyncPanelOpen(false)}
                onRefresh={refresh}
                onStartGeocode={iniciarGeocodeBg}
                onStartRefinamento={iniciarRefinamentoNominatim}
              />
            )}

            <SidePanel
              open={sidePanelOpen}
              familia={familiaDetalhe}
              onClose={() => setSidePanelOpen(false)}
              onRefresh={() => {
                refresh();
                if (familiaDetalhe) loadFamiliaDetalhe(familiaDetalhe.id);
              }}
              onStartPinMode={(id) => enablePinMode(id)}
            />
          </>
        ) : (
          <ReportView
            familias={familias}
            filters={filters}
            onSelectFamily={handleSelectFamily}
          />
        )}
      </div>

      {/* Progress bar */}
      {progress && (
        <div className="fixed bottom-0 left-0 right-0 z-2000 flex items-center gap-3 px-4 py-2 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg text-sm">
          <span className="font-medium whitespace-nowrap">{progressLabel}</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
                width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {progress.current}/{progress.total} (✅{progress.sucesso} ❌
            {progress.falha})
          </span>
          <button
            className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
            onClick={() => {
              geocodeClient.cancelar();
              setGeocodeProgress(null);
              setRefinamentoProgress(null);
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

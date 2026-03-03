import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function Header({ stats, viewMode, onViewModeChange }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await api.logout();
    navigate("/login");
  }

  return (
    <header
      className="flex items-center justify-between px-4 py-2 shadow-md z-10 flex-wrap gap-2 md:flex-nowrap"
      style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl">🗺️</div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">
            Mapa de Membros
          </h1>
          <span className="text-xs text-blue-200">
            Ala Parque Industrial - São José dos Campos
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap justify-end">
        <div className="flex gap-4">
          <div className="text-center">
            <span className="block text-lg font-bold text-white">
              {stats.totalFamilias ?? "-"}
            </span>
            <span className="block text-[10px] text-blue-200 uppercase tracking-wide">
              Famílias
            </span>
          </div>
          <div className="text-center">
            <span className="block text-lg font-bold text-white">
              {stats.totalMembros ?? "-"}
            </span>
            <span className="block text-[10px] text-blue-200 uppercase tracking-wide">
              Membros
            </span>
          </div>
          <div className="text-center">
            <span className="block text-lg font-bold text-white">
              {stats.totalVisitas ?? "-"}
            </span>
            <span className="block text-[10px] text-blue-200 uppercase tracking-wide">
              Visitas
            </span>
          </div>
          <div className="text-center">
            <span className="block text-lg font-bold text-white">
              {stats.comCoordenadas ?? "-"}
            </span>
            <span className="block text-[10px] text-blue-200 uppercase tracking-wide">
              No Mapa
            </span>
          </div>
        </div>

        <button
          className="px-3 py-1.5 bg-white/15 text-white border border-white/20 rounded-lg text-xs font-medium hover:bg-white/25 transition cursor-pointer"
          onClick={() =>
            onViewModeChange(viewMode === "map" ? "report" : "map")
          }
          title={viewMode === "map" ? "Ver relatório" : "Ver mapa"}
        >
          {viewMode === "map" ? "📋 Relatório" : "🗺️ Mapa"}
        </button>

        <button
          className="px-3 py-1.5 bg-white/15 text-white border border-white/20 rounded-lg text-xs font-medium hover:bg-white/25 transition cursor-pointer"
          onClick={handleLogout}
          title="Sair"
        >
          🚪 Sair
        </button>
      </div>
    </header>
  );
}

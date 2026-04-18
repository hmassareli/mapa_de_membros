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
      className="flex items-center justify-between px-3 py-1.5 md:px-4 md:py-2 shadow-md z-10 gap-2"
      style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
      }}
    >
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <div className="text-xl md:text-2xl">🗺️</div>
        <div className="min-w-0">
          <h1 className="text-sm md:text-lg font-bold text-white leading-tight truncate">
            Mapa de Membros
          </h1>
          <span className="hidden md:block text-xs text-blue-200">
            Ala Parque Industrial - São José dos Campos
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {/* Stats - hidden on mobile */}
        <div className="hidden md:flex gap-4">
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
          className="px-2 py-1 md:px-3 md:py-1.5 bg-white/15 text-white border border-white/20 rounded-lg text-xs font-medium hover:bg-white/25 transition cursor-pointer"
          onClick={() =>
            onViewModeChange(viewMode === "map" ? "report" : "map")
          }
          title={viewMode === "map" ? "Ver relatório" : "Ver mapa"}
        >
          {viewMode === "map" ? "📋" : "🗺️"}
          <span className="hidden md:inline">
            {viewMode === "map" ? " Relatório" : " Mapa"}
          </span>
        </button>

        <button
          className="px-2 py-1 md:px-3 md:py-1.5 bg-white/15 text-white border border-white/20 rounded-lg text-xs font-medium hover:bg-white/25 transition cursor-pointer"
          onClick={handleLogout}
          title="Sair"
        >
          🚪<span className="hidden md:inline"> Sair</span>
        </button>
      </div>
    </header>
  );
}

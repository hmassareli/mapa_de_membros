import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function Header({ stats, viewMode, onViewModeChange }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await api.logout();
    navigate("/login");
  }

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">🗺️</div>
        <div>
          <h1>Mapa de Membros</h1>
          <span className="subtitle">
            Ala Parque Industrial - São José dos Campos
          </span>
        </div>
      </div>
      <div className="header-right">
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-number">{stats.totalFamilias ?? "-"}</span>
            <span className="stat-label">Famílias</span>
          </div>
          <div className="stat">
            <span className="stat-number">{stats.totalMembros ?? "-"}</span>
            <span className="stat-label">Membros</span>
          </div>
          <div className="stat">
            <span className="stat-number">{stats.totalVisitas ?? "-"}</span>
            <span className="stat-label">Visitas</span>
          </div>
          <div className="stat">
            <span className="stat-number">{stats.comCoordenadas ?? "-"}</span>
            <span className="stat-label">No Mapa</span>
          </div>
        </div>

        <button
          className="btn-view-toggle"
          onClick={() =>
            onViewModeChange(viewMode === "map" ? "report" : "map")
          }
          title={viewMode === "map" ? "Ver relatório" : "Ver mapa"}
        >
          {viewMode === "map" ? "📋 Relatório" : "🗺️ Mapa"}
        </button>

        <button className="btn-logout" onClick={handleLogout} title="Sair">
          🚪 Sair
        </button>
      </div>
    </header>
  );
}

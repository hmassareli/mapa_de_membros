import { useState } from "react";

export default function FabGroup({
  pinMode,
  onTogglePinMode,
  onShowNoCoords,
  onShowSync,
}) {
  const [expanded, setExpanded] = useState(true);
  const [isMobile] = useState(() => window.innerWidth <= 768);

  // On mobile, show a toggle button
  if (isMobile && !expanded) {
    return (
      <div className="fab-group">
        <button
          className="fab"
          onClick={() => setExpanded(true)}
          title="Mostrar opções"
        >
          ⋯
        </button>
      </div>
    );
  }

  return (
    <div className="fab-group">
      {isMobile && (
        <button
          className="fab fab-secondary fab-close-mobile"
          onClick={() => setExpanded(false)}
          title="Esconder opções"
        >
          ✕
        </button>
      )}
      <button
        className="fab fab-secondary"
        onClick={onShowSync}
        title="Sincronização e Configurações"
      >
        ⚙️
      </button>
      <button
        className="fab fab-secondary"
        onClick={onShowNoCoords}
        title="Ver famílias sem coordenadas"
      >
        📋
      </button>
      <button
        className={`fab ${pinMode ? "active" : ""}`}
        onClick={onTogglePinMode}
        title="Marcar localização no mapa"
      >
        📍
      </button>
    </div>
  );
}

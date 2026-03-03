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
      <div className="absolute bottom-6 right-4 z-500 flex flex-col gap-2">
        <button
          className="w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center text-xl hover:bg-blue-700 transition cursor-pointer"
          onClick={() => setExpanded(true)}
          title="Mostrar opções"
        >
          ⋯
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 right-4 z-500 flex flex-col gap-2">
      {isMobile && (
        <button
          className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 shadow flex items-center justify-center text-sm hover:bg-gray-300 transition cursor-pointer"
          onClick={() => setExpanded(false)}
          title="Esconder opções"
        >
          ✕
        </button>
      )}
      <button
        className="w-10 h-10 rounded-full bg-white text-gray-600 shadow border border-gray-200 flex items-center justify-center text-sm hover:bg-gray-50 transition cursor-pointer"
        onClick={onShowSync}
        title="Sincronização e Configurações"
      >
        ⚙️
      </button>
      <button
        className="w-10 h-10 rounded-full bg-white text-gray-600 shadow border border-gray-200 flex items-center justify-center text-sm hover:bg-gray-50 transition cursor-pointer"
        onClick={onShowNoCoords}
        title="Ver famílias sem coordenadas"
      >
        📋
      </button>
      <button
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition cursor-pointer ${pinMode ? "bg-red-500 text-white ring-4 ring-red-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}
        onClick={onTogglePinMode}
        title="Marcar localização no mapa"
      >
        📍
      </button>
    </div>
  );
}

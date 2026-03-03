import { useState } from "react";

export default function Legend() {
  const [minimized, setMinimized] = useState(false);

  return (
    <div
      className={`absolute bottom-6 left-4 z-500 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 text-sm transition-all ${minimized ? "cursor-pointer px-3 py-2" : ""}`}
      onClick={() => minimized && setMinimized(false)}
    >
      {minimized ? (
        <span className="text-gray-500 text-xs">🔵 Legenda</span>
      ) : (
        <>
          <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">
            Legenda
          </h4>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-full inline-block shrink-0"
              style={{ background: "#10b981" }}
            />{" "}
            Ativo na Igreja
          </div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-full inline-block shrink-0"
              style={{ background: "#ef4444" }}
            />{" "}
            Inativo - Aceita Visitas
          </div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-full inline-block shrink-0"
              style={{ background: "#f59e0b" }}
            />{" "}
            Inativo - Não Aceita
          </div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-full inline-block shrink-0"
              style={{ background: "#3b82f6" }}
            />{" "}
            Não Contatado
          </div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-full inline-block shrink-0"
              style={{ background: "#8b5cf6" }}
            />{" "}
            Mudou
          </div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-full inline-block shrink-0"
              style={{ background: "#6b7280" }}
            />{" "}
            Desconhecido
          </div>
          <button
            className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(true);
            }}
          >
            Minimizar
          </button>
        </>
      )}
    </div>
  );
}

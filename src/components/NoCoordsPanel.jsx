export default function NoCoordsPanel({ familias, onSelect, onClose }) {
  return (
    <div className="absolute bottom-20 right-4 z-500 w-80 max-h-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h4 className="font-semibold text-sm text-gray-700">Famílias sem Coordenadas</h4>
        <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-sm cursor-pointer" onClick={onClose}>
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {familias.map((f) => (
          <div
            key={f.id}
            className="px-4 py-2 hover:bg-blue-50 cursor-pointer transition border-b border-gray-50"
            onClick={() => onSelect(f.id)}
          >
            <div className="text-sm font-medium text-gray-800">{f.nome_familia}</div>
            <div className="text-xs text-gray-400 truncate">
              {f.endereco_linha1 || "Sem endereço"}, {f.endereco_linha2 || ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NoCoordsPanel({ familias, onSelect, onClose }) {
  return (
    <div className="no-coords-panel" style={{ display: 'block' }}>
      <div className="no-coords-header">
        <h4>Famílias sem Coordenadas</h4>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>
      <div className="no-coords-list">
        {familias.map((f) => (
          <div key={f.id} className="no-coords-item" onClick={() => onSelect(f.id)}>
            <div className="nc-name">{f.nome_familia}</div>
            <div className="nc-addr">{f.endereco_linha1 || 'Sem endereço'}, {f.endereco_linha2 || ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

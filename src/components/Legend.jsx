import { useState } from 'react'

export default function Legend() {
  const [minimized, setMinimized] = useState(false)

  return (
    <div
      className={`legend ${minimized ? 'minimized' : ''}`}
      onClick={() => minimized && setMinimized(false)}
    >
      <h4>Legenda</h4>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: '#10b981' }} /> Ativo na Igreja
      </div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: '#ef4444' }} /> Inativo - Aceita Visitas
      </div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: '#f59e0b' }} /> Inativo - Não Aceita
      </div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: '#3b82f6' }} /> Não Contatado
      </div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: '#8b5cf6' }} /> Mudou
      </div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: '#6b7280' }} /> Desconhecido
      </div>
      <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); setMinimized(true) }}>
        Minimizar
      </button>
    </div>
  )
}

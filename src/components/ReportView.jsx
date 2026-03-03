import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import HouseholdCard from './HouseholdCard'

export default function ReportView({ familias, filters, onSelectFamily }) {
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('nome') // nome | status | visita

  useEffect(() => {
    loadReport()
  }, [])

  async function loadReport() {
    setLoading(true)
    try {
      const data = await api.relatorio()
      setReportData(data)
    } catch (err) {
      console.error('Erro ao carregar relatório:', err)
    }
    setLoading(false)
  }

  // Filter report data using same filters
  let filtered = reportData
  if (filters.status) {
    filtered = filtered.filter((f) => f.status === filters.status)
  }
  if (filters.aceita_visitas) {
    filtered = filtered.filter((f) => f.aceita_visitas === filters.aceita_visitas)
  }
  if (filters.interesse_retorno) {
    filtered = filtered.filter((f) => f.interesse_retorno === filters.interesse_retorno)
  }

  // Sort
  if (sortBy === 'status') {
    const order = { nao_contatado: 0, inativo: 1, ativo: 2, mudou: 3, desconhecido: 4 }
    filtered = [...filtered].sort((a, b) => (order[a.status] || 5) - (order[b.status] || 5))
  } else if (sortBy === 'visita') {
    filtered = [...filtered].sort((a, b) => {
      if (!a.ultima_visita && !b.ultima_visita) return 0
      if (!a.ultima_visita) return -1
      if (!b.ultima_visita) return 1
      return new Date(b.ultima_visita) - new Date(a.ultima_visita)
    })
  }

  return (
    <div className="report-view">
      <div className="report-toolbar">
        <h3>📋 Relatório de Famílias ({filtered.length})</h3>
        <div className="report-sort">
          <label>Ordenar:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="nome">Nome</option>
            <option value="status">Status</option>
            <option value="visita">Última Visita</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="report-loading">Carregando relatório...</div>
      ) : filtered.length === 0 ? (
        <div className="report-empty">Nenhuma família encontrada com os filtros aplicados.</div>
      ) : (
        <div className="report-grid">
          {filtered.map((f) => (
            <HouseholdCard
              key={f.id}
              familia={f}
              onSelect={() => onSelectFamily(f.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

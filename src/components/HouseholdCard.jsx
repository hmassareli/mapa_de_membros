import { useState } from 'react'
import {
  formatDate,
  STATUS_LABELS,
  STATUS_COLORS,
  ROLE_LABELS,
  TIPO_LABELS,
  RESULTADO_LABELS,
  isModified,
  getModifiedFields,
} from '../lib/utils'

export default function HouseholdCard({ familia, onSelect }) {
  const [showActions, setShowActions] = useState(false)
  const f = familia
  const modified = isModified(f)
  const modifiedFields = getModifiedFields(f)
  const color = STATUS_COLORS[f.status] || '#6b7280'
  const statusLabel = STATUS_LABELS[f.status] || f.status

  const membros = f.membros || []
  const chefe = membros.find((m) => m.papel_familia === 'HEAD')
  const conjuge = membros.find((m) => m.papel_familia === 'SPOUSE')
  const filhos = membros.filter((m) => m.papel_familia === 'CHILD' || m.papel_familia === 'OTHER')

  return (
    <div className="household-card" onClick={onSelect}>
      {/* Header */}
      <div className="hc-header">
        <div className="hc-title">
          <h4>Família {f.nome_familia}</h4>
          <span className="hc-status-badge" style={{ background: `${color}15`, color, borderColor: `${color}40` }}>
            {statusLabel}
          </span>
        </div>
        {/* Mobile toggle */}
        <button
          className="hc-toggle-btn"
          onClick={(e) => { e.stopPropagation(); setShowActions(!showActions) }}
          title="Mais informações"
        >
          ⋮
        </button>
      </div>

      {/* Address */}
      <div className="hc-address">
        {f.endereco_editado ? <span className="modified-tag">✏️ Editado</span> : null}
        {modified && !f.endereco_editado ? (
          <span className="modified-tag-small" title={`Alterado: ${modifiedFields.join(', ')}`}>✏️</span>
        ) : null}
        <span className="hc-address-text">{f.endereco_linha1 || 'Sem endereço'}</span>
        {f.endereco_linha2 && <span className="hc-address-sub">{f.endereco_linha2}</span>}
      </div>

      {/* Members */}
      <div className="hc-members">
        {membros.slice(0, 6).map((m) => {
          const avatarClass = m.sexo === 'M' ? 'avatar-m' : 'avatar-f'
          const initial = (m.primeiro_nome || '?')[0].toUpperCase()
          return (
            <div key={m.id} className="hc-member" title={`${m.primeiro_nome} ${m.sobrenome} (${ROLE_LABELS[m.papel_familia] || m.papel_familia})`}>
              <span className={`hc-member-avatar ${avatarClass}`}>{initial}</span>
              <span className="hc-member-name">{m.primeiro_nome}</span>
            </div>
          )
        })}
        {membros.length > 6 && <span className="hc-member-more">+{membros.length - 6}</span>}
      </div>

      {/* Visit info / status details */}
      <div className={`hc-details ${showActions ? 'expanded' : ''}`}>
        <div className="hc-visit-info">
          {f.total_visitas > 0 ? (
            <>
              <span className="hc-visit-count">📒 {f.total_visitas} visita(s)</span>
              {f.ultima_visita && <span className="hc-visit-date">Última: {formatDate(f.ultima_visita)}</span>}
            </>
          ) : (
            <span className="hc-no-visits">Nenhuma visita</span>
          )}
        </div>

        {/* Last visit details */}
        {f.ultimaVisitaInfo && (
          <div className="hc-last-visit">
            <span className="visita-tipo">{TIPO_LABELS[f.ultimaVisitaInfo.tipo] || f.ultimaVisitaInfo.tipo}</span>
            {f.ultimaVisitaInfo.resultado && (
              <span className={`visita-resultado resultado-${f.ultimaVisitaInfo.resultado}`}>
                {RESULTADO_LABELS[f.ultimaVisitaInfo.resultado] || f.ultimaVisitaInfo.resultado}
              </span>
            )}
            <span className="hc-visit-visitor">👤 {f.ultimaVisitaInfo.visitante}</span>
          </div>
        )}

        {/* Status details */}
        <div className="hc-status-details">
          {f.aceita_visitas && f.aceita_visitas !== 'nao_contatado' && (
            <span className="hc-tag">
              {f.aceita_visitas === 'sim' ? '✅' : '❌'} Aceita visitas: {f.aceita_visitas}
            </span>
          )}
          {f.interesse_retorno && f.interesse_retorno !== 'nao_contatado' && (
            <span className="hc-tag">
              Interesse: {f.interesse_retorno}
            </span>
          )}
          {f.observacoes && (
            <span className="hc-tag hc-tag-obs" title={f.observacoes}>📝 Obs</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ================================
// API Client
// ================================

export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return res
}

async function jsonOrThrow(res) {
  const data = await res.json()
  if (!res.ok) throw new Error(data.erro || 'Erro na requisição')
  return data
}

export const api = {
  // Auth
  authStatus: () => apiFetch('/api/auth/status').then((r) => r.json()),
  authMe: async () => {
    const res = await apiFetch('/api/auth/me')
    if (!res.ok) throw new Error('Não autenticado')
    return res.json()
  },
  login: (data) =>
    apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(jsonOrThrow),
  setup: (data) =>
    apiFetch('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(jsonOrThrow),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),

  // Data
  temDados: () => apiFetch('/api/tem-dados').then((r) => r.json()),
  importar: (dados) =>
    apiFetch('/api/importar', {
      method: 'POST',
      body: JSON.stringify({ dados }),
    }).then(jsonOrThrow),
  sincronizar: (dados) =>
    apiFetch('/api/sincronizar', {
      method: 'POST',
      body: JSON.stringify({ dados }),
    }).then(jsonOrThrow),

  // Familias
  familias: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/api/familias?${query}`).then((r) => r.json())
  },
  familia: (id) => apiFetch(`/api/familias/${id}`).then((r) => r.json()),
  updateFamilia: (id, data) =>
    apiFetch(`/api/familias/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  // Search
  buscarMembros: (q) =>
    apiFetch(`/api/buscar-membros?q=${encodeURIComponent(q)}`).then((r) =>
      r.json()
    ),

  // Visitas
  addVisita: (data) =>
    apiFetch('/api/visitas', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(jsonOrThrow),
  deleteVisita: (id) =>
    apiFetch(`/api/visitas/${id}`, { method: 'DELETE' }).then((r) => r.json()),
  updateVisita: (id, data) =>
    apiFetch(`/api/visitas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  // Stats
  estatisticas: () => apiFetch('/api/estatisticas').then((r) => r.json()),

  // Geocode
  familiasSemCoordenadas: () =>
    apiFetch('/api/familias-sem-coordenadas').then((r) => r.json()),
  familiasPendentesRefinamento: () =>
    apiFetch('/api/familias-pendentes-refinamento').then((r) => r.json()),
  geocodificar: (id, data) =>
    apiFetch(`/api/geocodificar/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  geocodeStats: () => apiFetch('/api/geocode-stats').then((r) => r.json()),
  regeocodificar: (modo) =>
    apiFetch('/api/regeocodificar', {
      method: 'POST',
      body: JSON.stringify({ modo }),
    }).then((r) => r.json()),

  // Reset
  resetar: () => apiFetch('/api/resetar', { method: 'POST' }).then((r) => r.json()),

  // Relatório
  relatorio: () => apiFetch('/api/relatorio').then((r) => r.json()),
}

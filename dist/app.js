// ================================
// MAPA DE MEMBROS - App Principal
// ================================

const API = "";
let map, markersLayer;
let familiasData = [];
let selectedFamiliaId = null;
let pinMode = false;
let tempMarker = null;

// ================================
// INICIALIZAÇÃO
// ================================

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadStats();
  loadFamilias();
  setupEventListeners();
  checkImportNeeded();
  checkGeocodeRunning();
  // Auto-iniciar refinamento Nominatim para famílias com coords de CEP
  iniciarRefinamentoNominatim();
});

// Verifica resposta 401 e redireciona para login
function checkAuth(res) {
  if (res.status === 401) {
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

// Verifica se precisa importar dados
async function checkImportNeeded() {
  try {
    const res = await fetch(`${API}/api/tem-dados`);
    if (!checkAuth(res)) return;
    const data = await res.json();
    if (!data.temDados) {
      showImportBanner();
    }
  } catch (err) {}
}

function showImportBanner() {
  const banner = document.createElement("div");
  banner.id = "importBanner";
  banner.style.cssText =
    "position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:12px 20px;text-align:center;z-index:9999;font-size:14px;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;gap:12px;";
  banner.innerHTML = `
    <span>\u26a0\ufe0f Nenhum dado importado ainda.</span>
    <label style="background:white;color:#d97706;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;">
      \ud83d\udcc1 Enviar members.json
      <input type="file" accept=".json" style="display:none" onchange="uploadFromBanner(this)">
    </label>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:18px;margin-left:8px;">\u00d7</button>
  `;
  document.body.prepend(banner);
}

async function uploadFromBanner(input) {
  if (!input.files.length) return;
  const file = input.files[0];
  try {
    const text = await file.text();
    const dados = JSON.parse(text);
    const res = await fetch(`${API}/api/importar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dados }),
    });
    const result = await res.json();
    if (res.ok) {
      showToast(
        `Importados: ${result.familias} fam\u00edlias e ${result.membros} membros!`,
        "success",
      );
      document.getElementById("importBanner")?.remove();
      loadStats();
      loadFamilias();
      // Iniciar geocodificação em background
      iniciarGeocodeBg();
    } else {
      showToast(result.erro || "Erro ao importar", "error");
    }
  } catch (err) {
    showToast("Erro ao ler arquivo: " + err.message, "error");
  }
}

// ================================
// GEOCODIFICAÇÃO EM BACKGROUND
// ================================

async function iniciarGeocodeBg() {
  try {
    const res = await fetch(`${API}/api/familias-sem-coordenadas`);
    if (!checkAuth(res)) return;
    const familias = await res.json();
    if (!familias.length) return;

    showGeocodeProgressBar(familias.length);

    GeocoderClient.setOnProgress((p) => {
      const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
      const bgBar = document.getElementById("geocodeBgBar");
      const bgText = document.getElementById("geocodeBgText");
      if (bgBar) bgBar.style.width = pct + "%";
      if (bgText)
        bgText.textContent = `${p.current}/${p.total} (✅${p.sucesso} ❌${p.falha})`;
    });

    GeocoderClient.setOnComplete((p) => {
      showToast(
        `Geocodificação concluída: ${p.sucesso} encontrados, ${p.falha} não encontrados`,
        "success",
      );
      document.getElementById("geocodeProgressBar")?.remove();
      loadStats();
      loadFamilias(getCurrentFilters());
    });

    GeocoderClient.iniciar(familias, API);
  } catch (err) {}
}

function checkGeocodeRunning() {
  // Geocodificação roda no navegador — se está rodando nesta aba, a barra já está visível
  if (GeocoderClient.isRunning()) return;
}

// ================================
// REFINAMENTO NOMINATIM (BACKGROUND)
// Busca famílias com geocode_fonte='cep' e refina com Nominatim.
// Continua de onde parou entre sessões do navegador.
// ================================

async function iniciarRefinamentoNominatim() {
  // Esperar um pouco para não competir com o carregamento inicial
  await new Promise((r) => setTimeout(r, 3000));

  // Não iniciar se já tem geocodificação rodando
  if (GeocoderClient.isRunning()) return;

  try {
    const res = await fetch(`${API}/api/familias-pendentes-refinamento`);
    if (!checkAuth(res)) return;
    const familias = await res.json();
    if (!familias.length) return;

    console.log(
      `🔄 Refinamento Nominatim: ${familias.length} famílias pendentes`,
    );
    showRefinamentoProgressBar(familias.length);

    GeocoderClient.setOnProgress((p) => {
      const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
      const bgBar = document.getElementById("refinamentoBgBar");
      const bgText = document.getElementById("refinamentoBgText");
      if (bgBar) bgBar.style.width = pct + "%";
      if (bgText)
        bgText.textContent = `${p.current}/${p.total} (✅${p.sucesso} ❌${p.falha})`;
    });

    GeocoderClient.setOnComplete((p) => {
      showToast(
        `Refinamento concluído: ${p.sucesso} melhorados, ${p.falha} sem resultado`,
        "success",
      );
      document.getElementById("refinamentoProgressBar")?.remove();
      loadFamilias(getCurrentFilters());
    });

    GeocoderClient.refinar(familias, API);
  } catch (err) {
    console.error("Erro ao iniciar refinamento:", err);
  }
}

function showRefinamentoProgressBar(total) {
  if (document.getElementById("refinamentoProgressBar")) return;
  if (document.getElementById("geocodeProgressBar")) return; // não mostrar se geocode está rodando
  const bar = document.createElement("div");
  bar.id = "refinamentoProgressBar";
  bar.style.cssText =
    "position:fixed;bottom:0;left:0;right:0;background:#1e293b;color:white;padding:8px 20px;z-index:9999;font-family:Inter,sans-serif;font-size:13px;display:flex;align-items:center;gap:12px;";
  bar.innerHTML = `
    <span>🔄 Refinando coordenadas via Nominatim...</span>
    <div style="flex:1;background:#334155;border-radius:4px;height:8px;overflow:hidden;">
      <div id="refinamentoBgBar" style="width:0%;height:100%;background:#10b981;transition:width 0.3s;border-radius:4px;"></div>
    </div>
    <span id="refinamentoBgText" style="min-width:100px;text-align:right;">0/${total}</span>
    <button onclick="GeocoderClient.cancelar(); this.parentElement.remove();" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
  `;
  document.body.appendChild(bar);
}

function showGeocodeProgressBar(total) {
  if (document.getElementById("geocodeProgressBar")) return;
  const bar = document.createElement("div");
  bar.id = "geocodeProgressBar";
  bar.style.cssText =
    "position:fixed;bottom:0;left:0;right:0;background:#1e293b;color:white;padding:8px 20px;z-index:9999;font-family:Inter,sans-serif;font-size:13px;display:flex;align-items:center;gap:12px;";
  bar.innerHTML = `
    <span>🗺️ Geocodificando endereços...</span>
    <div style="flex:1;height:6px;background:#334155;border-radius:3px;overflow:hidden">
      <div id="geocodeBgBar" style="height:100%;background:#3b82f6;border-radius:3px;width:0%;transition:width 0.5s"></div>
    </div>
    <span id="geocodeBgText">0/${total}</span>
    <button onclick="GeocoderClient.cancelar(); this.parentElement.remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px">×</button>
  `;
  document.body.appendChild(bar);
}

function initMap() {
  // Centrado em São José dos Campos
  map = L.map("map", {
    center: [-23.2237, -45.9009],
    zoom: 13,
    zoomControl: true,
  });

  // OpenStreetMap tiles (gratuito)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  // MarkerCluster para agrupar marcadores próximos
  markersLayer = L.markerClusterGroup({
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();
      let size = "small";
      if (count >= 20) size = "large";
      else if (count >= 10) size = "medium";

      return L.divIcon({
        html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
        className: "custom-cluster",
        iconSize: [40, 40],
      });
    },
  });

  map.addLayer(markersLayer);

  // Add cluster styles
  const style = document.createElement("style");
  style.textContent = `
    .custom-cluster { background: transparent; }
    .cluster-icon {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      color: white; font-weight: 700; font-size: 13px;
      font-family: 'Inter', sans-serif;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .cluster-small { background: var(--accent, #3b82f6); }
    .cluster-medium { background: var(--warning, #f59e0b); }
    .cluster-large { background: var(--danger, #ef4444); }
  `;
  document.head.appendChild(style);
}

// ================================
// DADOS
// ================================

async function loadStats() {
  try {
    const res = await fetch(`${API}/api/estatisticas`);
    if (!checkAuth(res)) return;
    const stats = await res.json();
    document.getElementById("statFamilias").textContent = stats.totalFamilias;
    document.getElementById("statMembros").textContent = stats.totalMembros;
    document.getElementById("statVisitas").textContent = stats.totalVisitas;
    document.getElementById("statMapa").textContent = stats.comCoordenadas;
  } catch (err) {
    console.error("Erro ao carregar estatísticas:", err);
  }
}

async function loadFamilias(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API}/api/familias?${query}`);
    if (!checkAuth(res)) return;
    familiasData = await res.json();
    renderMarkers();
  } catch (err) {
    console.error("Erro ao carregar famílias:", err);
    showToast("Erro ao carregar dados", "error");
  }
}

async function loadFamiliaDetalhe(id) {
  try {
    const res = await fetch(`${API}/api/familias/${id}`);
    const familia = await res.json();
    renderSidePanel(familia);
    selectedFamiliaId = id;
  } catch (err) {
    console.error("Erro ao carregar detalhes:", err);
    showToast("Erro ao carregar detalhes da família", "error");
  }
}

// ================================
// MARCADORES NO MAPA
// ================================

function getMarkerColor(familia) {
  if (familia.status === "mudou") return "#8b5cf6";
  if (familia.status === "desconhecido") return "#6b7280";
  if (familia.status === "ativo") return "#10b981";
  // Inativo ou não contatado
  if (familia.status === "inativo") {
    if (familia.aceita_visitas === "sim") return "#ef4444";
    if (familia.aceita_visitas === "nao") return "#f59e0b";
    return "#ef4444"; // inativo não contatado
  }
  return "#3b82f6"; // nao_contatado
}

function isRecentlyVisited(familia) {
  if (!familia.ultima_visita) return false;
  const diff =
    (new Date() - new Date(familia.ultima_visita)) / (1000 * 60 * 60 * 24);
  return diff <= 30;
}

function createMarkerIcon(color, size = 14) {
  return L.divIcon({
    className: "",
    html: `<div class="custom-marker" style="width:${size}px; height:${size}px; background:${color};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function renderMarkers() {
  markersLayer.clearLayers();

  familiasData.forEach((familia) => {
    if (!familia.latitude || !familia.longitude) return;

    const color = getMarkerColor(familia);
    const recent = isRecentlyVisited(familia);
    const size = recent ? 16 : 12;

    const marker = L.marker([familia.latitude, familia.longitude], {
      icon: createMarkerIcon(color, size),
    });

    // Tooltip on hover
    const tooltipContent = `
      <strong>${familia.nome_familia}</strong><br>
      <small>${familia.endereco_linha1 || ""}</small><br>
      <small>${familia.total_membros} membro(s) | ${familia.total_visitas || 0} visita(s)</small>
    `;
    marker.bindTooltip(tooltipContent, {
      direction: "top",
      offset: [0, -10],
      className: "familia-tooltip",
    });

    // Click to open side panel
    marker.on("click", () => {
      loadFamiliaDetalhe(familia.id);
      openSidePanel();
    });

    // Add pulse animation for recently visited
    if (recent) {
      marker.on("add", function () {
        const el = this.getElement();
        if (el) {
          const inner = el.querySelector(".custom-marker");
          if (inner) inner.classList.add("marker-recent");
        }
      });
    }

    markersLayer.addLayer(marker);
  });

  // Add tooltip styles
  if (!document.getElementById("tooltip-styles")) {
    const style = document.createElement("style");
    style.id = "tooltip-styles";
    style.textContent = `
      .familia-tooltip {
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        padding: 6px 10px;
        border-radius: 6px;
      }
    `;
    document.head.appendChild(style);
  }
}

// ================================
// PAINEL LATERAL
// ================================

function openSidePanel() {
  document.getElementById("sidePanel").classList.add("open");
}

function closeSidePanel() {
  document.getElementById("sidePanel").classList.remove("open");
  selectedFamiliaId = null;
}

function renderSidePanel(familia) {
  const membrosHtml = familia.membros
    .map((m) => {
      const roleLabels = {
        HEAD: "Chefe",
        SPOUSE: "Cônjuge",
        CHILD: "Filho(a)",
        OTHER: "Outro",
      };
      const avatarClass = m.sexo === "M" ? "avatar-m" : "avatar-f";
      const initials = (m.primeiro_nome || "?")[0].toUpperCase();

      let detalhes = [];
      if (m.papel_familia)
        detalhes.push(roleLabels[m.papel_familia] || m.papel_familia);
      if (m.sacerdocio) detalhes.push(m.sacerdocio);
      if (m.data_nascimento) detalhes.push(`Nasc: ${m.data_nascimento}`);
      if (m.e_jovem_adulto_solteiro) detalhes.push("JAS");
      if (m.e_adulto_solteiro) detalhes.push("Adulto Solteiro");

      let contactHtml = "";
      if (m.telefone) {
        const tel = m.telefone.replace(/\D/g, "");
        contactHtml += `<a href="https://wa.me/${tel}" target="_blank" class="contact-link">📱 WhatsApp</a> `;
      }
      if (m.email) {
        contactHtml += `<a href="mailto:${m.email}" class="contact-link">📧 ${m.email}</a>`;
      }

      return `
      <div class="membro-card">
        <div class="membro-avatar ${avatarClass}">${initials}</div>
        <div class="membro-info">
          <div class="membro-nome">${m.primeiro_nome} ${m.sobrenome}</div>
          <div class="membro-detalhe">${detalhes.join(" • ")}</div>
          ${contactHtml ? `<div style="margin-top:3px">${contactHtml}</div>` : ""}
        </div>
      </div>
    `;
    })
    .join("");

  const visitasHtml = (familia.visitas || [])
    .map((v) => {
      const tipoLabels = {
        visita: "Visita",
        tentativa: "Tentativa",
        ligacao: "Ligação",
        mensagem: "Mensagem",
      };
      const resultadoLabels = {
        atendeu: "Atendeu",
        nao_atendeu: "Não Atendeu",
        nao_estava: "Não Estava",
        recusou: "Recusou",
      };

      return `
      <div class="visita-card">
        <button class="visita-delete" onclick="deleteVisita(${v.id})" title="Remover visita">&times;</button>
        <div class="visita-data">
          📅 ${formatDate(v.data_visita)}
          <span class="visita-tipo">${tipoLabels[v.tipo] || v.tipo}</span>
          ${v.resultado ? `<span class="visita-resultado resultado-${v.resultado}">${resultadoLabels[v.resultado] || v.resultado}</span>` : ""}
        </div>
        <div class="visita-visitante">👤 ${v.visitante}</div>
        ${v.notas ? `<div class="visita-notas">"${v.notas}"</div>` : ""}
      </div>
    `;
    })
    .join("");

  const statusBadge = {
    ativo: "badge-ativo",
    mudou: "badge-mudou",
    desconhecido: "badge-desconhecido",
  };

  const statusLabel = {
    ativo: "Ativo",
    mudou: "Mudou",
    desconhecido: "Desconhecido",
  };

  const coordSection =
    !familia.latitude || !familia.longitude
      ? `
    <div class="coord-input-section">
      <p>⚠️ Esta família não tem coordenadas no mapa. Cole as coordenadas do Google Maps ou use o botão 📍 para marcar no mapa:</p>
      <div class="coord-input-row">
        <input type="text" id="coordInput" placeholder="-23.2237, -45.9009">
        <button class="btn btn-primary btn-small" onclick="saveCoordinates(${familia.id})">Salvar</button>
      </div>
      <button class="btn btn-success btn-small" style="margin-top:6px; width:100%" onclick="startPinModeForFamily(${familia.id})">📍 Marcar no Mapa</button>
    </div>
  `
      : `
    <div style="font-size:12px; color: var(--gray-500); margin-top:4px;">
      📍 ${familia.latitude.toFixed(6)}, ${familia.longitude.toFixed(6)}
      <button class="btn btn-small btn-secondary" onclick="editCoordinates(${familia.id})" style="margin-left:4px;">Editar</button>
      <button class="btn btn-small btn-secondary" onclick="startPinModeForFamily(${familia.id})" style="margin-left:4px;">📍 Reposicionar</button>
    </div>
  `;

  // Determinar se é ativo (não mostra aceita_visitas nem interesse_retorno)
  const isAtivo = familia.status === "ativo";
  const isInativo = familia.status === "inativo";

  const statusControlsHtml = `
    <div class="status-controls">
      <div class="status-row">
        <label>Situação:</label>
        <select id="statusSelect" onchange="onStatusChange(${familia.id}, this.value)">
          <option value="nao_contatado" ${familia.status === "nao_contatado" ? "selected" : ""}>🔘 Não Contatado</option>
          <option value="ativo" ${familia.status === "ativo" ? "selected" : ""}>✅ Ativo na Igreja</option>
          <option value="inativo" ${familia.status === "inativo" ? "selected" : ""}>⚠️ Inativo</option>
          <option value="mudou" ${familia.status === "mudou" ? "selected" : ""}>📦 Mudou</option>
          <option value="desconhecido" ${familia.status === "desconhecido" ? "selected" : ""}>❓ Desconhecido</option>
        </select>
      </div>
      ${
        !isAtivo
          ? `
      <div class="status-row" id="rowAceitaVisitas">
        <label>Aceita Visitas:</label>
        <select id="visitasSelect" onchange="updateFamilia(${familia.id}, 'aceita_visitas', this.value)">
          <option value="nao_contatado" ${familia.aceita_visitas === "nao_contatado" ? "selected" : ""}>🔘 Não Contatado</option>
          <option value="sim" ${familia.aceita_visitas === "sim" ? "selected" : ""}>✅ Sim</option>
          <option value="nao" ${familia.aceita_visitas === "nao" ? "selected" : ""}>❌ Não</option>
        </select>
      </div>
      `
          : ""
      }
      ${
        isInativo
          ? `
      <div class="status-row" id="rowInteresseRetorno">
        <label>Interesse em Retornar:</label>
        <select id="interesseSelect" onchange="updateFamilia(${familia.id}, 'interesse_retorno', this.value)">
          <option value="nao_contatado" ${familia.interesse_retorno === "nao_contatado" ? "selected" : ""}>🔘 Não Contatado</option>
          <option value="sim" ${familia.interesse_retorno === "sim" ? "selected" : ""}>✅ Sim</option>
          <option value="nao" ${familia.interesse_retorno === "nao" ? "selected" : ""}>❌ Não</option>
          <option value="talvez" ${familia.interesse_retorno === "talvez" ? "selected" : ""}>🤔 Talvez</option>
        </select>
      </div>
      `
          : ""
      }
    </div>
  `;

  document.getElementById("panelContent").innerHTML = `
    <!-- Header da Família -->
    <div class="familia-header">
      <h2>Família ${familia.nome_familia}</h2>
      <div class="endereco">
        ${familia.endereco_linha1 || ""}<br>
        ${familia.endereco_linha2 || ""}<br>
        ${familia.endereco_linha3 || ""}
      </div>
      <span class="ala-tag">${familia.ala || "Sem ala"}</span>
    </div>

    <!-- Status e Configurações -->
    <div class="panel-section">
      <h3>📋 Status</h3>
      ${statusControlsHtml}
      ${coordSection}
    </div>

    <!-- Membros -->
    <div class="panel-section">
      <h3>👥 Membros da Família (${familia.membros.length})</h3>
      ${membrosHtml}
    </div>

    <!-- Registrar Nova Visita -->
    <div class="panel-section">
      <h3>➕ Registrar Nova Visita</h3>
      <div class="form-nova-visita">
        <div class="form-row">
          <input type="date" id="novaVisitaData" value="${new Date().toISOString().split("T")[0]}">
          <input type="text" id="novaVisitaVisitante" placeholder="Nome do visitante">
        </div>
        <div class="form-row">
          <select id="novaVisitaTipo">
            <option value="visita">🚶 Visita</option>
            <option value="tentativa">🔔 Tentativa</option>
            <option value="ligacao">📞 Ligação</option>
            <option value="mensagem">💬 Mensagem</option>
          </select>
          <select id="novaVisitaResultado">
            <option value="">Resultado...</option>
            <option value="atendeu">✅ Atendeu</option>
            <option value="nao_atendeu">❌ Não Atendeu</option>
            <option value="nao_estava">🏠 Não Estava</option>
            <option value="recusou">🚫 Recusou</option>
          </select>
        </div>
        <textarea id="novaVisitaNotas" placeholder="Notas sobre a visita..."></textarea>
        <button class="btn btn-success" onclick="addVisita(${familia.id})">Registrar Visita</button>
      </div>
    </div>

    <!-- Histórico de Visitas -->
    <div class="panel-section">
      <h3>📒 Histórico de Visitas (${familia.total_visitas || 0})</h3>
      ${visitasHtml || '<p style="color: var(--gray-400); font-size: 13px; font-style: italic;">Nenhuma visita registrada ainda.</p>'}
    </div>

    <!-- Observações -->
    <div class="panel-section">
      <h3>📝 Observações</h3>
      <textarea class="obs-textarea" id="obsTextarea" placeholder="Observações sobre esta família..."
        onblur="updateFamilia(${familia.id}, 'observacoes', this.value)">${familia.observacoes || ""}</textarea>
    </div>
  `;
}

// ================================
// AÇÕES CRUD
// ================================

async function updateFamilia(id, campo, valor) {
  try {
    const body = {};
    body[campo] = valor;
    await fetch(`${API}/api/familias/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    showToast("Atualizado com sucesso!", "success");

    // Refresh markers and stats
    loadFamilias(getCurrentFilters());
    loadStats();
  } catch (err) {
    showToast("Erro ao atualizar", "error");
  }
}

// Quando muda o status, ajusta automaticamente os campos relacionados
async function onStatusChange(id, novoStatus) {
  try {
    const body = { status: novoStatus };

    // Se mudou pra ativo: aceita_visitas = sim, interesse_retorno = não se aplica
    if (novoStatus === "ativo") {
      body.aceita_visitas = "sim";
      body.interesse_retorno = "nao_contatado";
    }
    // Se mudou pra inativo: manter aceita_visitas como está
    // Se mudou pra mudou/desconhecido: aceita_visitas = nao_contatado
    if (novoStatus === "mudou" || novoStatus === "desconhecido") {
      body.aceita_visitas = "nao_contatado";
      body.interesse_retorno = "nao_contatado";
    }

    await fetch(`${API}/api/familias/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    showToast("Status atualizado!", "success");

    // Recarregar o painel para mostrar/esconder campos condicionais
    loadFamiliaDetalhe(id);
    loadFamilias(getCurrentFilters());
    loadStats();
  } catch (err) {
    showToast("Erro ao atualizar status", "error");
  }
}

async function addVisita(familiaId) {
  const data = document.getElementById("novaVisitaData").value;
  const visitante = document.getElementById("novaVisitaVisitante").value;
  const tipo = document.getElementById("novaVisitaTipo").value;
  const resultado = document.getElementById("novaVisitaResultado").value;
  const notas = document.getElementById("novaVisitaNotas").value;

  if (!data || !visitante) {
    showToast("Preencha a data e o nome do visitante", "error");
    return;
  }

  try {
    await fetch(`${API}/api/visitas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familia_id: familiaId,
        data_visita: data,
        visitante,
        tipo,
        resultado: resultado || null,
        notas,
      }),
    });

    showToast("Visita registrada!", "success");
    loadFamiliaDetalhe(familiaId);
    loadFamilias(getCurrentFilters());
    loadStats();
  } catch (err) {
    showToast("Erro ao registrar visita", "error");
  }
}

async function deleteVisita(visitaId) {
  if (!confirm("Deseja realmente remover esta visita?")) return;

  try {
    await fetch(`${API}/api/visitas/${visitaId}`, { method: "DELETE" });
    showToast("Visita removida", "success");
    if (selectedFamiliaId) loadFamiliaDetalhe(selectedFamiliaId);
    loadStats();
  } catch (err) {
    showToast("Erro ao remover visita", "error");
  }
}

async function saveCoordinates(familiaId) {
  const input = document.getElementById("coordInput").value.trim();
  const parts = input.split(",").map((s) => parseFloat(s.trim()));

  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    showToast("Formato inválido. Use: -23.2237, -45.9009", "error");
    return;
  }

  try {
    await fetch(`${API}/api/geocodificar/${familiaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: parts[0], longitude: parts[1] }),
    });
    showToast("Coordenadas salvas!", "success");
    loadFamiliaDetalhe(familiaId);
    loadFamilias(getCurrentFilters());
    loadStats();
  } catch (err) {
    showToast("Erro ao salvar coordenadas", "error");
  }
}

function editCoordinates(familiaId) {
  // Replace the coordinate display with an input
  const familia = familiasData.find((f) => f.id === familiaId);
  if (!familia) return;

  const existingSection = document.querySelector(".coord-input-section");
  if (existingSection) return; // Already editing

  const coordDisplay = document.querySelector(
    ".panel-section .status-controls",
  )?.parentElement;
  if (!coordDisplay) return;

  const editHtml = document.createElement("div");
  editHtml.className = "coord-input-section";
  editHtml.innerHTML = `
    <p>Editar coordenadas:</p>
    <div class="coord-input-row">
      <input type="text" id="coordInput" value="${familia.latitude}, ${familia.longitude}">
      <button class="btn btn-primary btn-small" onclick="saveCoordinates(${familiaId})">Salvar</button>
    </div>
  `;
  coordDisplay.appendChild(editHtml);
}

// ================================
// POSICIONAR PIN NO MAPA
// ================================

function startPinMode() {
  // Populate the family select dropdown
  const select = document.getElementById("pinFamiliaSelect");
  const famsSemCoord = familiasData.filter((f) => !f.latitude || !f.longitude);
  const famsComCoord = familiasData.filter((f) => f.latitude && f.longitude);

  select.innerHTML = '<option value="">-- Selecione uma família --</option>';
  if (famsSemCoord.length > 0) {
    select.innerHTML += '<optgroup label="Sem coordenadas">';
    famsSemCoord.forEach((f) => {
      select.innerHTML += `<option value="${f.id}">${f.nome_familia} - ${f.endereco_linha1 || "sem endereço"}</option>`;
    });
    select.innerHTML += "</optgroup>";
  }
  select.innerHTML += '<optgroup label="Com coordenadas (reposicionar)">';
  famsComCoord.forEach((f) => {
    select.innerHTML += `<option value="${f.id}">${f.nome_familia}</option>`;
  });
  select.innerHTML += "</optgroup>";

  enablePinMode();
}

function startPinModeForFamily(familiaId) {
  // Populate and pre-select the family
  const select = document.getElementById("pinFamiliaSelect");
  select.innerHTML = "";
  familiasData.forEach((f) => {
    const selected = f.id === familiaId ? "selected" : "";
    select.innerHTML += `<option value="${f.id}" ${selected}>${f.nome_familia}</option>`;
  });

  enablePinMode();
  closeSidePanel();
}

function enablePinMode() {
  pinMode = true;
  document.getElementById("pinModeBanner").style.display = "flex";
  document.getElementById("map").classList.add("pin-mode");
  document.getElementById("btnPinMode").classList.add("active");

  // Listen for map clicks
  map.on("click", onMapClickPin);
}

function disablePinMode() {
  pinMode = false;
  document.getElementById("pinModeBanner").style.display = "none";
  document.getElementById("map").classList.remove("pin-mode");
  document.getElementById("btnPinMode").classList.remove("active");

  // Remove temp marker
  if (tempMarker) {
    map.removeLayer(tempMarker);
    tempMarker = null;
  }

  map.off("click", onMapClickPin);
}

async function onMapClickPin(e) {
  const { lat, lng } = e.latlng;
  const familiaId = document.getElementById("pinFamiliaSelect").value;

  if (!familiaId) {
    showToast("Selecione uma família primeiro!", "error");
    return;
  }

  // Show temp marker
  if (tempMarker) map.removeLayer(tempMarker);
  tempMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: "",
      html: `<div class="temp-marker" style="width:18px; height:18px;"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }),
  }).addTo(map);

  // Save coordinates
  try {
    await fetch(`${API}/api/geocodificar/${familiaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });

    const familia = familiasData.find((f) => f.id === parseInt(familiaId));
    showToast(
      `📍 Localização salva para ${familia?.nome_familia || "família"}!`,
      "success",
    );

    disablePinMode();
    loadFamilias(getCurrentFilters());
    loadStats();
  } catch (err) {
    showToast("Erro ao salvar localização", "error");
  }
}

// ================================
// FILTROS
// ================================

function getCurrentFilters() {
  const filters = {};
  const status = document.getElementById("filtroStatus").value;
  const visitas = document.getElementById("filtroVisitas").value;
  const interesse = document.getElementById("filtroInteresse").value;

  if (status) filters.status = status;
  if (visitas) filters.aceita_visitas = visitas;
  if (interesse) filters.interesse_retorno = interesse;

  return filters;
}

function applyFilters() {
  loadFamilias(getCurrentFilters());
}

// ================================
// FAMÍLIAS SEM COORDENADAS
// ================================

function showNoCoordsPanel() {
  const panel = document.getElementById("noCoordsPanel");
  const list = document.getElementById("noCoordsList");
  const noCoords = familiasData.filter((f) => !f.latitude || !f.longitude);

  if (noCoords.length === 0) {
    showToast("Todas as famílias estão no mapa! 🎉", "success");
    return;
  }

  list.innerHTML = noCoords
    .map(
      (f) => `
    <div class="no-coords-item" onclick="loadFamiliaDetalhe(${f.id}); openSidePanel();">
      <div class="nc-name">${f.nome_familia}</div>
      <div class="nc-addr">${f.endereco_linha1 || "Sem endereço"}, ${f.endereco_linha2 || ""}</div>
    </div>
  `,
    )
    .join("");

  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

// ================================
// EVENT LISTENERS
// ================================

function setupEventListeners() {
  // Close side panel
  document
    .getElementById("closeSidePanel")
    .addEventListener("click", closeSidePanel);

  // Logout
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await fetch(`${API}/api/auth/logout`, { method: "POST" });
    window.location.href = "/login.html";
  });

  // Filters
  document
    .getElementById("filtroStatus")
    .addEventListener("change", applyFilters);
  document
    .getElementById("filtroVisitas")
    .addEventListener("change", applyFilters);
  document
    .getElementById("filtroInteresse")
    .addEventListener("change", applyFilters);

  // Search (debounced) with dropdown
  let searchTimeout;
  const searchInput = document.getElementById("searchInput");
  const searchDropdown = document.getElementById("searchDropdown");

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (query.length < 2) {
      searchDropdown.classList.remove("visible");
      return;
    }
    searchTimeout = setTimeout(() => {
      showSearchDropdown(query);
    }, 300);
  });

  searchInput.addEventListener("focus", () => {
    const query = searchInput.value.trim();
    if (query.length >= 2) showSearchDropdown(query);
  });

  // Fechar dropdown ao clicar fora
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) {
      searchDropdown.classList.remove("visible");
    }
  });

  // Navegação por teclado no dropdown
  searchInput.addEventListener("keydown", (e) => {
    if (!searchDropdown.classList.contains("visible")) return;
    const items = searchDropdown.querySelectorAll(".search-item");
    const active = searchDropdown.querySelector(".search-item.active");
    let idx = Array.from(items).indexOf(active);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (active) active.classList.remove("active");
      idx = (idx + 1) % items.length;
      items[idx].classList.add("active");
      items[idx].scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (active) active.classList.remove("active");
      idx = idx <= 0 ? items.length - 1 : idx - 1;
      items[idx].classList.add("active");
      items[idx].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active) active.click();
    }
  });

  // Clear filters
  document.getElementById("btnLimparFiltros").addEventListener("click", () => {
    document.getElementById("filtroStatus").value = "";
    document.getElementById("filtroVisitas").value = "";
    document.getElementById("filtroInteresse").value = "";
    document.getElementById("searchInput").value = "";
    applyFilters();
  });

  // Legend toggle
  document.getElementById("toggleLegend").addEventListener("click", () => {
    document.getElementById("legend").classList.toggle("minimized");
  });

  document.getElementById("legend").addEventListener("click", function (e) {
    if (this.classList.contains("minimized")) {
      this.classList.remove("minimized");
    }
  });

  // No coords panel
  document
    .getElementById("btnSemCoord")
    .addEventListener("click", showNoCoordsPanel);
  document
    .getElementById("closeNoCoordsPanel")
    .addEventListener("click", () => {
      document.getElementById("noCoordsPanel").style.display = "none";
    });

  // Sync panel
  document
    .getElementById("btnSync")
    .addEventListener("click", toggleSyncPanel);
  document
    .getElementById("closeSyncPanel")
    .addEventListener("click", () => {
      document.getElementById("syncPanel").style.display = "none";
    });

  // Pin placement mode
  document.getElementById("btnPinMode").addEventListener("click", () => {
    if (pinMode) {
      disablePinMode();
    } else {
      startPinMode();
    }
  });
  document
    .getElementById("btnCancelPin")
    .addEventListener("click", disablePinMode);

  // Close side panel on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (pinMode) disablePinMode();
      else closeSidePanel();
    }
  });
}

// ================================
// BUSCA INTELIGENTE (dropdown)
// ================================

function showSearchDropdown(query) {
  const dropdown = document.getElementById("searchDropdown");
  const lower = query.toLowerCase();

  // Filtra famílias localmente (nome da família, ou endereço)
  const matches = familiasData
    .filter((f) => {
      const nome = (f.nome_familia || "").toLowerCase();
      const end = (f.endereco_linha1 || "").toLowerCase();
      const endCompleto = (f.endereco_completo || "").toLowerCase();
      return (
        nome.includes(lower) ||
        end.includes(lower) ||
        endCompleto.includes(lower)
      );
    })
    .slice(0, 6);

  // Busca membros no servidor (async)
  renderSearchResults(dropdown, query, matches, []);

  fetch(`${API}/api/buscar-membros?q=${encodeURIComponent(query)}`)
    .then((r) => r.json())
    .then((membros) => {
      // Remove membros cujas famílias já aparecem nos matches
      const famIds = new Set(matches.map((f) => f.id));
      const membrosFiltrados = membros.filter((m) => !famIds.has(m.familia_id));
      if (membrosFiltrados.length > 0) {
        renderSearchResults(dropdown, query, matches, membrosFiltrados);
      }
    })
    .catch(() => {});
}

function renderSearchResults(dropdown, query, matches, membros) {
  let html = "";

  // Seção 1: Famílias
  if (matches.length > 0) {
    html += '<div class="search-section-label">Famílias encontradas</div>';
    matches.forEach((f) => {
      const statusColors = {
        ativo: "#10b981",
        inativo: "#ef4444",
        nao_contatado: "#3b82f6",
        mudou: "#8b5cf6",
        desconhecido: "#6b7280",
      };
      const statusLabels = {
        ativo: "Ativo",
        inativo: "Inativo",
        nao_contatado: "Não contatado",
        mudou: "Mudou",
        desconhecido: "Desconhecido",
      };
      const color = statusColors[f.status] || "#6b7280";
      const label = statusLabels[f.status] || f.status;
      const hasCoords = f.latitude && f.longitude;
      const endereco = f.endereco_linha1 || "Sem endereço";

      html += `
        <div class="search-item" data-action="familia" data-id="${f.id}">
          <div class="search-item-icon familia">👤</div>
          <div class="search-item-info">
            <div class="search-item-title">${highlightMatch(f.nome_familia, query)}</div>
            <div class="search-item-sub">${highlightMatch(endereco, query)}${hasCoords ? "" : " 📍?"}</div>
          </div>
          <span class="search-item-badge" style="background:${color}20;color:${color}">${label}</span>
        </div>`;
    });
  }

  // Seção 2: Membros encontrados (busca no servidor)
  if (membros.length > 0) {
    html += '<div class="search-section-label">Membros encontrados</div>';
    membros.forEach((m) => {
      const statusColors = {
        ativo: "#10b981",
        inativo: "#ef4444",
        nao_contatado: "#3b82f6",
        mudou: "#8b5cf6",
        desconhecido: "#6b7280",
      };
      const color = statusColors[m.status] || "#6b7280";
      const hasCoords = m.latitude && m.longitude;

      html += `
        <div class="search-item" data-action="familia" data-id="${m.familia_id}">
          <div class="search-item-icon familia">👥</div>
          <div class="search-item-info">
            <div class="search-item-title">${highlightMatch(m.nome_completo, query)}</div>
            <div class="search-item-sub">Família ${m.nome_familia} — ${m.endereco_linha1 || "Sem endereço"}${hasCoords ? "" : " 📍?"}</div>
          </div>
        </div>`;
    });
  }

  // Seção 3: Ir para endereço no mapa
  html += '<div class="search-section-label">Buscar no mapa</div>';
  html += `
    <div class="search-item" data-action="geocode">
      <div class="search-item-icon zoom">🔍</div>
      <div class="search-item-info">
        <div class="search-item-title">Ir para "${query}" no mapa</div>
        <div class="search-item-sub">Buscar endereço e dar zoom</div>
      </div>
    </div>`;

  if (matches.length === 0 && membros.length === 0) {
    html =
      '<div class="search-section-label">Buscar no mapa</div>' +
      `<div class="search-item" data-action="geocode">
        <div class="search-item-icon zoom">🔍</div>
        <div class="search-item-info">
          <div class="search-item-title">Ir para "${query}" no mapa</div>
          <div class="search-item-sub">Buscar endereço e dar zoom</div>
        </div>
      </div>
      <div class="search-no-results">Nenhum resultado para "${query}"</div>`;
  }

  dropdown.innerHTML = html;
  dropdown.classList.add("visible");

  // Delegação de clique nos itens
  dropdown.querySelectorAll(".search-item").forEach((item) => {
    item.addEventListener("click", () => {
      const action = item.dataset.action;
      if (action === "familia") {
        const id = parseInt(item.dataset.id);
        const fam = familiasData.find((f) => f.id === id);
        dropdown.classList.remove("visible");
        // Abre o painel lateral
        loadFamiliaDetalhe(id);
        // Zoom se tiver coordenadas
        if (fam && fam.latitude && fam.longitude) {
          map.flyTo([fam.latitude, fam.longitude], 18, { duration: 0.8 });
        }
      } else if (action === "geocode") {
        dropdown.classList.remove("visible");
        geocodeAndZoom(query);
      }
    });
  });
}

function highlightMatch(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  return text.replace(re, '<strong style="color:var(--accent)">$1</strong>');
}

let geocodeMarker = null;

async function geocodeAndZoom(query) {
  showToast("Buscando endereço...", "info");

  // Acrescenta contexto da cidade
  let searchQuery = query;
  if (!/são josé|sjc|s\.? ?j\.? ?c/i.test(query)) {
    searchQuery += ", São José dos Campos, SP, Brasil";
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "MapaDeMembrosSJC/1.0" },
    });
    const data = await resp.json();

    if (data.length === 0) {
      showToast("Endereço não encontrado", "error");
      return;
    }

    const { lat, lon, display_name } = data[0];

    // Remove marcador anterior de busca
    if (geocodeMarker) {
      map.removeLayer(geocodeMarker);
    }

    // Voa até o local
    map.flyTo([parseFloat(lat), parseFloat(lon)], 17, { duration: 1 });

    // Coloca um marcador temporário azul
    geocodeMarker = L.marker([parseFloat(lat), parseFloat(lon)], {
      icon: L.divIcon({
        className: "geocode-result-marker",
        html: `<div style="
          background:#3b82f6;
          width:16px;height:16px;
          border-radius:50%;
          border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          animation: pulse-ring 1.5s ease-out infinite;
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(map);

    geocodeMarker
      .bindPopup(
        `<strong>📍 Resultado da busca</strong><br><small>${display_name}</small>`,
      )
      .openPopup();

    showToast("Endereço encontrado!", "success");
  } catch (err) {
    console.error("Erro ao geocodificar:", err);
    showToast("Erro ao buscar endereço", "error");
  }
}

// ================================
// UTILITÁRIOS
// ================================

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// Toast notifications
function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ================================
// PAINEL DE SINCRONIZAÇÃO
// ================================

async function toggleSyncPanel() {
  const panel = document.getElementById("syncPanel");
  if (panel.style.display === "none" || !panel.style.display) {
    panel.style.display = "block";
    document.getElementById("noCoordsPanel").style.display = "none";
    await loadSyncPanel();
  } else {
    panel.style.display = "none";
  }
}

async function loadSyncPanel() {
  const content = document.getElementById("syncContent");
  content.innerHTML = '<p style="text-align:center; color: var(--gray-400);">Carregando...</p>';

  try {
    const [statsRes, geocodeRes] = await Promise.all([
      fetch(`${API}/api/tem-dados`),
      fetch(`${API}/api/geocode-stats`),
    ]);

    const stats = await statsRes.json();
    const geocode = await geocodeRes.json();

    // Parse geocode stats
    const fonteMap = {};
    (geocode.stats || []).forEach(s => { fonteMap[s.geocode_fonte || 'null'] = s.total; });
    const totalCep = fonteMap['cep'] || 0;
    const totalNominatim = fonteMap['nominatim'] || 0;
    const totalManual = fonteMap['manual'] || 0;
    const totalFalhou = fonteMap['nominatim_falhou'] || 0;
    const totalSemCoord = fonteMap['null'] || 0;
    const totalNoMapa = geocode.total - totalSemCoord;

    const totalMembros = db_totalMembros || '-';

    content.innerHTML = `
      <!-- Estatísticas de geocodificação -->
      <div class="sync-section">
        <h5>📍 Coordenadas</h5>
        <div class="sync-stats">
          <div class="sync-stat"><span class="stat-val">${totalNoMapa}</span><span class="stat-lbl">no mapa</span></div>
          <div class="sync-stat"><span class="stat-val">${totalSemCoord}</span><span class="stat-lbl">sem coordenada</span></div>
          <div class="sync-stat"><span class="stat-val">${totalCep}</span><span class="stat-lbl">via CEP</span></div>
          <div class="sync-stat"><span class="stat-val">${totalNominatim}</span><span class="stat-lbl">via Nominatim</span></div>
          <div class="sync-stat"><span class="stat-val">${totalManual}</span><span class="stat-lbl">manual</span></div>
          <div class="sync-stat"><span class="stat-val">${totalFalhou}</span><span class="stat-lbl">Nominatim falhou</span></div>
        </div>
        <div class="sync-btn-group">
          ${totalCep > 0 ? `<button class="btn btn-secondary" onclick="acaoRefinar()">🔄 Refinar ${totalCep} via Nominatim</button>` : ''}
          ${totalFalhou > 0 ? `<button class="btn btn-secondary" onclick="acaoRetentarFalhou()">🔁 Retentar ${totalFalhou} que falharam</button>` : ''}
          <button class="btn btn-secondary" onclick="acaoRegeocodificarTudo()">🗺️ Regeocodificar tudo</button>
        </div>
      </div>

      <!-- Sincronizar dados -->
      <div class="sync-section">
        <h5>📤 Atualizar Dados</h5>
        <p>Envie um novo <strong>members.json</strong> para sincronizar. Atualiza endereços, telefones, e-mails e adiciona membros novos. Suas visitas, status e observações são mantidos.</p>
        <label class="sync-upload-area" id="syncUploadArea">
          📁 Clique para enviar members.json
          <input type="file" accept=".json" id="syncFileInput" onchange="sincronizarJSON(this)">
        </label>
        <div id="syncResult"></div>
      </div>

      <!-- Ações perigosas -->
      <div class="sync-section">
        <h5>⚠️ Zona de Perigo</h5>
        <div class="sync-btn-group">
          <button class="btn btn-danger-outline" onclick="acaoResetarDados()">🗑️ Apagar todos os dados</button>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p style="color: #ef4444;">Erro ao carregar: ${err.message}</p>`;
  }
}

// Variável auxiliar para exibir total de membros
let db_totalMembros = '-';
(async () => {
  try {
    const r = await fetch(`${API}/api/tem-dados`);
    const d = await r.json();
    db_totalMembros = d.totalFamilias || '-';
  } catch(e) {}
})();

async function sincronizarJSON(input) {
  if (!input.files.length) return;
  const file = input.files[0];
  const resultDiv = document.getElementById("syncResult");
  resultDiv.innerHTML = '<p style="color: var(--gray-500);">Processando...</p>';

  try {
    const text = await file.text();
    const dados = JSON.parse(text);

    const res = await fetch(`${API}/api/sincronizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dados }),
    });
    const result = await res.json();

    if (res.ok) {
      resultDiv.innerHTML = `<div class="sync-result success">
        ✅ ${result.mensagem}
      </div>`;
      showToast("Dados sincronizados com sucesso!", "success");

      // Re-geocodificar novas famílias ou endereços alterados
      if (result.familiasNovas > 0 || result.enderecosAlterados > 0) {
        iniciarGeocodeBg();
      }

      loadStats();
      loadFamilias(getCurrentFilters());
      // Recarregar painel
      setTimeout(() => loadSyncPanel(), 1500);
    } else {
      resultDiv.innerHTML = `<div class="sync-result error">❌ ${result.erro}</div>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<div class="sync-result error">❌ Erro: ${err.message}</div>`;
  }

  // Resetar input
  input.value = "";
}

async function acaoRefinar() {
  document.getElementById("syncPanel").style.display = "none";
  iniciarRefinamentoNominatim();
}

async function acaoRetentarFalhou() {
  try {
    const res = await fetch(`${API}/api/regeocodificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modo: "falhou" }),
    });
    const r = await res.json();
    showToast(r.mensagem, "success");
    document.getElementById("syncPanel").style.display = "none";
    // Iniciar refinamento para as que foram resetadas
    setTimeout(() => iniciarRefinamentoNominatim(), 500);
  } catch (err) {
    showToast("Erro: " + err.message, "error");
  }
}

async function acaoRegeocodificarTudo() {
  if (!confirm("Isso vai apagar TODAS as coordenadas e regeocodificar do zero. Continuar?")) return;

  try {
    const res = await fetch(`${API}/api/regeocodificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modo: "todos" }),
    });
    const r = await res.json();
    showToast(r.mensagem, "success");
    document.getElementById("syncPanel").style.display = "none";
    loadFamilias(getCurrentFilters());
    // Re-geocodificar
    setTimeout(() => iniciarGeocodeBg(), 500);
  } catch (err) {
    showToast("Erro: " + err.message, "error");
  }
}

async function acaoResetarDados() {
  if (!confirm("⚠️ ATENÇÃO: Isso vai apagar TODOS os dados (famílias, membros, visitas). Esta ação NÃO pode ser desfeita. Continuar?")) return;
  if (!confirm("Tem certeza absoluta? Todos os dados serão perdidos permanentemente.")) return;

  try {
    const res = await fetch(`${API}/api/resetar`, { method: "POST" });
    const r = await res.json();
    showToast(r.mensagem, "success");
    document.getElementById("syncPanel").style.display = "none";
    loadStats();
    loadFamilias();
    checkImportNeeded();
  } catch (err) {
    showToast("Erro: " + err.message, "error");
  }
}

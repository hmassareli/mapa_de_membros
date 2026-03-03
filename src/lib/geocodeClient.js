/**
 * Geocodificação no navegador via BrasilAPI (CEP) + Nominatim (fallback).
 * ES Module version.
 */

const state = {
  running: false,
  total: 0,
  current: 0,
  sucesso: 0,
  falha: 0,
  ultimaFamilia: "",
  ultimaEstrategia: "",
  concluido: false,
  cancelar: false,
};

let onProgress = null;
let onComplete = null;

function extrairCep(linha3) {
  if (!linha3) return null;
  const match = linha3.match(/(\d{5})-?(\d{3})/);
  return match ? match[1] + match[2] : null;
}

/**
 * Busca CEP na BrasilAPI. Retorna { coords, endereco } ou null.
 * coords pode ser null mesmo com endereço encontrado.
 */
async function buscarCep(cep) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data.location?.coordinates;
    const coords =
      loc && loc.latitude && loc.longitude
        ? { lat: parseFloat(loc.latitude), lon: parseFloat(loc.longitude) }
        : null;
    return {
      coords,
      endereco: {
        street: data.street || null,
        neighborhood: data.neighborhood || null,
        city: data.city || null,
        state: data.state || null,
      },
    };
  } catch (e) {}
  return null;
}

async function geocodificarEndereco(endereco) {
  const query = encodeURIComponent(endereco);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=br`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MapaDeMembrosSJC/1.0" },
    });
    const results = await res.json();
    if (results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon),
      };
    }
  } catch (e) {}
  return null;
}

function extrairRuaENumero(endereco) {
  if (!endereco) return null;
  const match = endereco.match(/^(.+?\d+)/);
  if (match) return match[1].trim().replace(/[,\s]+$/, "");
  return endereco.split(",")[0].trim();
}

function extrairCidade(linha3) {
  if (!linha3) return null;
  let cidade = linha3.replace(/^[\d-\s]+/, "").trim();
  cidade = cidade.replace(/\s*-\s*/g, ", ");
  return cidade || null;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Remove CEP, info de apartamento/bloco e limpa pontuação para Nominatim.
 */
function limparEnderecoParaNominatim(endereco) {
  if (!endereco) return "";
  let limpo = endereco;
  // Remove CEP (XXXXX-XXX ou XXXXXXXX)
  limpo = limpo.replace(/\b\d{5}-?\d{3}\b/g, "");
  // Remove info de apartamento, bloco, casa, fundos, conjunto, nº
  limpo = limpo.replace(
    /\b(bl(oco)?|apto?|ap|casa|fds|fundos|conj(unto)?|nº)\b\.?\s*\d*/gi,
    "",
  );
  // Normaliza separadores
  limpo = limpo.replace(/\s*-\s*/g, ", ");
  limpo = limpo.replace(/[,\s]{2,}/g, ", ").trim();
  limpo = limpo.replace(/^[,\s]+|[,\s]+$/g, "");
  return limpo;
}

/**
 * Expande abreviações comuns de logradouro.
 */
function normalizarRua(rua) {
  if (!rua) return rua;
  return rua
    .replace(/^R\b\.?\s*/i, "Rua ")
    .replace(/^Av\b\.?\s*/i, "Avenida ")
    .replace(/^Tv\b\.?\s*/i, "Travessa ")
    .trim();
}

async function salvarCoordenadas(familiaId, coords, apiBase, fonte) {
  try {
    await fetch(`${apiBase}/api/familias/${familiaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: coords.lat,
        longitude: coords.lon,
        geocode_fonte: fonte,
      }),
    });
  } catch (e) {}
}

async function tentarNominatim(f, dadosCep = null) {
  const cidade = extrairCidade(f.endereco_linha3);
  const cidadeCompleta = cidade
    ? cidade.includes("Brasil")
      ? cidade
      : `${cidade}, Brasil`
    : null;
  const ruaNumero = extrairRuaENumero(f.endereco_linha1);
  let coords = null;

  // 1. Endereço completo limpo (sem CEP, sem apt/bloco)
  const enderecoLimpo = limparEnderecoParaNominatim(f.endereco_completo);
  if (enderecoLimpo) {
    coords = await geocodificarEndereco(enderecoLimpo);
    if (coords) return { coords, estrategia: "Nominatim (completo)" };
  }

  // 2. linha1 limpa + cidade
  if (f.endereco_linha1 && cidadeCompleta) {
    await delay(1100);
    const linha1Limpa = limparEnderecoParaNominatim(f.endereco_linha1);
    coords = await geocodificarEndereco(
      `${normalizarRua(linha1Limpa)}, ${cidadeCompleta}`,
    );
    if (coords) return { coords, estrategia: "Nominatim (rua+cidade)" };
  }

  // 3. ruaNumero normalizado + cidade
  if (ruaNumero && cidadeCompleta) {
    await delay(1100);
    const ruaNorm = normalizarRua(ruaNumero);
    coords = await geocodificarEndereco(`${ruaNorm}, ${cidadeCompleta}`);
    if (coords) return { coords, estrategia: "Nominatim (rua+num)" };
  }

  // 4. rua + bairro + cidade
  if (ruaNumero && f.endereco_linha2) {
    const bairro = f.endereco_linha2.split(/[-,]/)[0].trim();
    const cidadeParaBairro = cidadeCompleta || "Brasil";
    if (bairro.length > 2) {
      await delay(1100);
      const ruaNorm = normalizarRua(ruaNumero);
      coords = await geocodificarEndereco(
        `${ruaNorm}, ${bairro}, ${cidadeParaBairro}`,
      );
      if (coords)
        return { coords, estrategia: "Nominatim (rua+bairro+cidade)" };
    }
  }

  // 5. Só nome da rua normalizado + cidade
  if (f.endereco_linha1 && cidadeCompleta) {
    const somenteRua = f.endereco_linha1.split(/[,\d]/)[0].trim();
    if (somenteRua.length > 3) {
      await delay(1100);
      const ruaNorm = normalizarRua(somenteRua);
      coords = await geocodificarEndereco(
        `${ruaNorm}, ${cidadeCompleta}`,
      );
      if (coords) return { coords, estrategia: "Nominatim (só rua)" };
    }
  }

  // 6. Rua via BrasilAPI (CEP)
  if (dadosCep?.street) {
    const cidadeCep =
      dadosCep.city && dadosCep.state
        ? `${dadosCep.city}, ${dadosCep.state}, Brasil`
        : cidadeCompleta;
    await delay(1100);
    coords = await geocodificarEndereco(`${dadosCep.street}, ${cidadeCep}`);
    if (coords) return { coords, estrategia: "Nominatim (rua via CEP)" };
  }

  // 7. Bairro + cidade
  const bairroTexto =
    dadosCep?.neighborhood ||
    (f.endereco_linha2 ? f.endereco_linha2.split(/[-,]/)[0].trim() : null);
  if (bairroTexto && bairroTexto.length > 2) {
    await delay(1100);
    coords = await geocodificarEndereco(
      `${bairroTexto}, ${dadosCep?.city || cidadeCompleta || "Brasil"}`,
    );
    if (coords) return { coords, estrategia: "Nominatim (bairro)" };
  }

  return { coords: null, estrategia: "não encontrado" };
}

async function iniciar(familias, apiBase = "") {
  if (state.running) return;
  if (!familias || familias.length === 0) return;

  Object.assign(state, {
    running: true,
    total: familias.length,
    current: 0,
    sucesso: 0,
    falha: 0,
    ultimaFamilia: "",
    ultimaEstrategia: "",
    ultimaFamiliaId: null,
    ultimaCoords: null,
    concluido: false,
    cancelar: false,
  });

  const semCoordenadas = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < familias.length; i += BATCH_SIZE) {
    if (state.cancelar) break;
    const lote = familias.slice(i, i + BATCH_SIZE);
    const promessas = lote.map(async (f) => {
      const cep =
        extrairCep(f.endereco_linha3) || extrairCep(f.endereco_completo);
      if (!cep) return { familia: f, coords: null, dadosCep: null };
      const resultado = await buscarCep(cep);
      return {
        familia: f,
        coords: resultado?.coords || null,
        dadosCep: resultado?.endereco || null,
      };
    });

    const resultados = await Promise.all(promessas);
    for (const { familia, coords, dadosCep } of resultados) {
      if (state.cancelar) break;
      state.current++;
      state.ultimaFamilia = familia.nome_familia;
      if (coords) {
        await salvarCoordenadas(familia.id, coords, apiBase, "cep");
        state.sucesso++;
        state.ultimaEstrategia = "CEP (instantâneo)";
        state.ultimaFamiliaId = familia.id;
        state.ultimaCoords = coords;
      } else {
        // Guardar dadosCep para usar no Nominatim
        familia._dadosCep = dadosCep;
        semCoordenadas.push(familia);
        state.ultimaFamiliaId = null;
        state.ultimaCoords = null;
      }
      if (onProgress) onProgress({ ...state });
    }
    if (i + BATCH_SIZE < familias.length) await delay(200);
  }

  for (let i = 0; i < semCoordenadas.length; i++) {
    if (state.cancelar) break;
    const f = semCoordenadas[i];
    state.ultimaFamilia = f.nome_familia;
    const result = await tentarNominatim(f, f._dadosCep || null);

    if (result.coords) {
      await salvarCoordenadas(f.id, result.coords, apiBase, "nominatim");
      state.sucesso++;
      state.ultimaEstrategia = result.estrategia;
      state.ultimaFamiliaId = f.id;
      state.ultimaCoords = result.coords;
    } else {
      state.falha++;
      state.ultimaEstrategia = "não encontrado";
      state.ultimaFamiliaId = null;
      state.ultimaCoords = null;
    }
    if (onProgress) onProgress({ ...state });
    await delay(1100);
  }

  state.running = false;
  state.concluido = true;
  if (onProgress) onProgress({ ...state });
  if (onComplete) onComplete({ ...state });
}

async function iniciarSomenteCep(familias, apiBase = "") {
  if (state.running) return;
  if (!familias || familias.length === 0) return;

  Object.assign(state, {
    running: true,
    total: familias.length,
    current: 0,
    sucesso: 0,
    falha: 0,
    ultimaFamilia: "",
    ultimaEstrategia: "",
    concluido: false,
    cancelar: false,
  });

  const BATCH_SIZE = 5;
  for (let i = 0; i < familias.length; i += BATCH_SIZE) {
    if (state.cancelar) break;
    const lote = familias.slice(i, i + BATCH_SIZE);
    const promessas = lote.map(async (f) => {
      const cep =
        extrairCep(f.endereco_linha3) || extrairCep(f.endereco_completo);
      if (!cep) return { familia: f, coords: null };
      const resultado = await buscarCep(cep);
      return { familia: f, coords: resultado?.coords || null };
    });

    const resultados = await Promise.all(promessas);
    for (const { familia, coords } of resultados) {
      if (state.cancelar) break;
      state.current++;
      state.ultimaFamilia = familia.nome_familia;
      if (coords) {
        await salvarCoordenadas(familia.id, coords, apiBase, "cep");
        state.sucesso++;
        state.ultimaEstrategia = "CEP (instantâneo)";
      } else {
        state.falha++;
        state.ultimaEstrategia = "sem CEP";
      }
      if (onProgress) onProgress({ ...state });
    }
    if (i + BATCH_SIZE < familias.length) await delay(200);
  }

  state.running = false;
  state.concluido = true;
  if (onProgress) onProgress({ ...state });
  if (onComplete) onComplete({ ...state });
}

async function refinar(familias, apiBase = "") {
  if (state.running) return;
  if (!familias || familias.length === 0) return;

  Object.assign(state, {
    running: true,
    total: familias.length,
    current: 0,
    sucesso: 0,
    falha: 0,
    ultimaFamilia: "",
    ultimaEstrategia: "",
    ultimaFamiliaId: null,
    ultimaCoords: null,
    concluido: false,
    cancelar: false,
    modo: "refinamento",
  });

  for (let i = 0; i < familias.length; i++) {
    if (state.cancelar) break;
    const f = familias[i];
    state.current = i + 1;
    state.ultimaFamilia = f.nome_familia;

    // Buscar dados do CEP para usar como fallback no Nominatim
    const cep =
      extrairCep(f.endereco_linha3) || extrairCep(f.endereco_completo);
    let dadosCep = null;
    if (cep) {
      const resultado = await buscarCep(cep);
      dadosCep = resultado?.endereco || null;
    }

    const result = await tentarNominatim(f, dadosCep);

    if (result.coords) {
      await salvarCoordenadas(f.id, result.coords, apiBase, "nominatim");
      state.sucesso++;
      state.ultimaEstrategia = result.estrategia;
      state.ultimaFamiliaId = f.id;
      state.ultimaCoords = result.coords;
    } else {
      try {
        await fetch(`${apiBase}/api/familias/${f.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geocode_fonte: "nominatim_falhou" }),
        });
      } catch (e) {}
      state.falha++;
      state.ultimaEstrategia = "não encontrado";
      state.ultimaFamiliaId = null;
      state.ultimaCoords = null;
    }

    if (onProgress) onProgress({ ...state });
    await delay(1100);
  }

  state.running = false;
  state.concluido = true;
  if (onProgress) onProgress({ ...state });
  if (onComplete) onComplete({ ...state });
}

function cancelar() {
  if (state.running) state.cancelar = true;
}

function getProgress() {
  return { ...state };
}

function setOnProgress(cb) {
  onProgress = cb;
}

function setOnComplete(cb) {
  onComplete = cb;
}

function isRunning() {
  return state.running;
}

/**
 * Geocodifica uma única família (CEP → Nominatim → bairro).
 * Retorna { sucesso: boolean, fonte: string } e já salva no servidor.
 */
async function geocodeSingle(familia, apiBase = "") {
  // 1. Tentar CEP
  const cep =
    extrairCep(familia.endereco_linha3) ||
    extrairCep(familia.endereco_completo);
  let dadosCep = null;
  if (cep) {
    const resultado = await buscarCep(cep);
    if (resultado?.coords) {
      await salvarCoordenadas(familia.id, resultado.coords, apiBase, "cep");
      return { sucesso: true, fonte: "CEP" };
    }
    dadosCep = resultado?.endereco || null;
  }

  // 2. Tentar Nominatim (passando dadosCep como alternativa)
  const result = await tentarNominatim(familia, dadosCep);
  if (result.coords) {
    await salvarCoordenadas(familia.id, result.coords, apiBase, "nominatim");
    return { sucesso: true, fonte: result.estrategia };
  }

  // 3. Marcar como falhou
  try {
    await fetch(`${apiBase}/api/familias/${familia.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geocode_fonte: "nominatim_falhou" }),
    });
  } catch (e) {}
  return { sucesso: false, fonte: "não encontrado" };
}

const geocodeClient = {
  iniciar,
  iniciarSomenteCep,
  refinar,
  cancelar,
  getProgress,
  setOnProgress,
  setOnComplete,
  isRunning,
  geocodeSingle,
};

export default geocodeClient;

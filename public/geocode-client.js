/**
 * Geocodificação no navegador via BrasilAPI (CEP) + Nominatim (fallback).
 * Estratégia em duas fases:
 *   Fase 1: Busca por CEP na BrasilAPI (em paralelo, ~instantâneo)
 *   Fase 2: Fallback no Nominatim só para os que falharam (1 req/seg)
 * Roda 100% no client-side.
 */

const GeocoderClient = (() => {
  // Estado do processo
  let state = {
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

  let onProgress = null; // callback(state)
  let onComplete = null; // callback(state)

  // ================================
  // EXTRAIR CEP DO ENDEREÇO
  // ================================

  function extrairCep(linha3) {
    if (!linha3) return null;
    // CEP brasileiro: 12345-678 ou 12345678
    const match = linha3.match(/(\d{5})\-?(\d{3})/);
    return match ? match[1] + match[2] : null;
  }

  // ================================
  // BRASILAPI (CEP → COORDENADAS)
  // ================================

  async function geocodificarPorCep(cep) {
    try {
      const res = await fetch(
        `https://brasilapi.com.br/api/cep/v2/${cep}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      const coords = data.location?.coordinates;
      if (coords && coords.latitude && coords.longitude) {
        return {
          lat: parseFloat(coords.latitude),
          lon: parseFloat(coords.longitude),
        };
      }
    } catch (e) {}
    return null;
  }

  // ================================
  // NOMINATIM (FALLBACK)
  // ================================

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

  // ================================
  // HELPERS DE LIMPEZA DE ENDEREÇO
  // ================================

  function extrairRuaENumero(endereco) {
    if (!endereco) return null;
    const match = endereco.match(/^(.+?\d+)/);
    if (match) return match[1].trim().replace(/[,\s]+$/, "");
    return endereco.split(",")[0].trim();
  }

  function extrairCidade(linha3) {
    if (!linha3) return "São José dos Campos, SP, Brasil";
    let cidade = linha3.replace(/^[\d\-\s]+/, "").trim();
    cidade = cidade.replace(/\s*-\s*/g, ", ");
    return cidade || "São José dos Campos, SP, Brasil";
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ================================
  // SALVAR COORDENADAS NO SERVIDOR
  // ================================

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

  // ================================
  // GEOCODIFICAÇÃO EM BATCH (2 FASES)
  // ================================

  async function iniciar(familias, apiBase = "") {
    if (state.running) return;
    if (!familias || familias.length === 0) return;

    state = {
      running: true,
      total: familias.length,
      current: 0,
      sucesso: 0,
      falha: 0,
      ultimaFamilia: "",
      ultimaEstrategia: "",
      concluido: false,
      cancelar: false,
    };

    // =============================
    // FASE 1: CEP via BrasilAPI (paralelo, rápido)
    // =============================
    const semCoordenadas = []; // famílias que não foram resolvidas por CEP

    // Processar em lotes de 5 para não sobrecarregar
    const BATCH_SIZE = 5;
    for (let i = 0; i < familias.length; i += BATCH_SIZE) {
      if (state.cancelar) break;

      const lote = familias.slice(i, i + BATCH_SIZE);
      const promessas = lote.map(async (f) => {
        const cep = extrairCep(f.endereco_linha3);
        if (!cep) return { familia: f, coords: null };

        const coords = await geocodificarPorCep(cep);
        return { familia: f, coords };
      });

      const resultados = await Promise.all(promessas);

      for (const { familia, coords } of resultados) {
        if (state.cancelar) break;

        state.current++;
        state.ultimaFamilia = familia.nome_familia;

        if (coords) {
          await salvarCoordenadas(familia.id, coords, apiBase, 'cep');
          state.sucesso++;
          state.ultimaEstrategia = "CEP (instantâneo)";
        } else {
          semCoordenadas.push(familia);
        }

        if (onProgress) onProgress({ ...state });
      }

      // Pequeno delay entre lotes para não abusar da API
      if (i + BATCH_SIZE < familias.length) await delay(200);
    }

    // =============================
    // FASE 2: Nominatim para os que falharam (1 req/seg)
    // =============================
    for (let i = 0; i < semCoordenadas.length; i++) {
      if (state.cancelar) break;

      const f = semCoordenadas[i];
      state.ultimaFamilia = f.nome_familia;

      const cidade = extrairCidade(f.endereco_linha3);
      const ruaNumero = extrairRuaENumero(f.endereco_linha1);
      let coords = null;
      let estrategia = "";

      // Estratégia 1: endereço completo
      coords = await geocodificarEndereco(f.endereco_completo);
      if (coords) estrategia = "Nominatim (completo)";

      // Estratégia 2: rua + cidade
      if (!coords && f.endereco_linha1 && f.endereco_linha3) {
        await delay(1100);
        coords = await geocodificarEndereco(`${f.endereco_linha1}, ${cidade}`);
        if (coords) estrategia = "Nominatim (rua+cidade)";
      }

      // Estratégia 3: rua + número limpo + cidade
      if (!coords && ruaNumero) {
        await delay(1100);
        coords = await geocodificarEndereco(`${ruaNumero}, ${cidade}`);
        if (coords) estrategia = "Nominatim (rua+num)";
      }

      // Estratégia 4: só nome da rua + cidade
      if (!coords && f.endereco_linha1) {
        const somenteRua = f.endereco_linha1.split(/[,\d]/)[0].trim();
        if (somenteRua.length > 3) {
          await delay(1100);
          coords = await geocodificarEndereco(
            `${somenteRua}, São José dos Campos, SP, Brasil`,
          );
          if (coords) estrategia = "Nominatim (só rua)";
        }
      }

      if (coords) {
        await salvarCoordenadas(f.id, coords, apiBase, 'nominatim');
        state.sucesso++;
        state.ultimaEstrategia = estrategia;
      } else {
        state.falha++;
        state.ultimaEstrategia = "não encontrado";
      }

      if (onProgress) onProgress({ ...state });

      // Rate limit do Nominatim
      await delay(1100);
    }

    state.running = false;
    state.concluido = true;
    if (onProgress) onProgress({ ...state });
    if (onComplete) onComplete({ ...state });
  }

  // ================================
  // REFINAMENTO NOMINATIM
  // Pega famílias com geocode_fonte='cep' e refina com Nominatim.
  // Persiste progresso: cada família refinada é salva como 'nominatim'.
  // Ao reabrir o navegador, basta buscar as que ainda são 'cep'.
  // ================================

  async function refinar(familias, apiBase = "") {
    if (state.running) return;
    if (!familias || familias.length === 0) return;

    state = {
      running: true,
      total: familias.length,
      current: 0,
      sucesso: 0,
      falha: 0,
      ultimaFamilia: "",
      ultimaEstrategia: "",
      concluido: false,
      cancelar: false,
      modo: "refinamento",
    };

    for (let i = 0; i < familias.length; i++) {
      if (state.cancelar) break;

      const f = familias[i];
      state.current = i + 1;
      state.ultimaFamilia = f.nome_familia;

      const cidade = extrairCidade(f.endereco_linha3);
      const ruaNumero = extrairRuaENumero(f.endereco_linha1);
      let coords = null;
      let estrategia = "";

      // Estratégia 1: endereço completo
      coords = await geocodificarEndereco(f.endereco_completo);
      if (coords) estrategia = "Nominatim (completo)";

      // Estratégia 2: rua + cidade
      if (!coords && f.endereco_linha1 && f.endereco_linha3) {
        await delay(1100);
        coords = await geocodificarEndereco(`${f.endereco_linha1}, ${cidade}`);
        if (coords) estrategia = "Nominatim (rua+cidade)";
      }

      // Estratégia 3: rua + número limpo + cidade
      if (!coords && ruaNumero) {
        await delay(1100);
        coords = await geocodificarEndereco(`${ruaNumero}, ${cidade}`);
        if (coords) estrategia = "Nominatim (rua+num)";
      }

      // Estratégia 4: só nome da rua + cidade
      if (!coords && f.endereco_linha1) {
        const somenteRua = f.endereco_linha1.split(/[,\d]/)[0].trim();
        if (somenteRua.length > 3) {
          await delay(1100);
          coords = await geocodificarEndereco(
            `${somenteRua}, São José dos Campos, SP, Brasil`,
          );
          if (coords) estrategia = "Nominatim (só rua)";
        }
      }

      if (coords) {
        await salvarCoordenadas(f.id, coords, apiBase, 'nominatim');
        state.sucesso++;
        state.ultimaEstrategia = estrategia;
      } else {
        // Nominatim não achou — marcar como tentado para não repetir, mantém coords do CEP
        try {
          await fetch(`${apiBase}/api/familias/${f.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ geocode_fonte: 'nominatim_falhou' }),
          });
        } catch (e) {}
        state.falha++;
        state.ultimaEstrategia = "não encontrado";
      }

      if (onProgress) onProgress({ ...state });

      // Rate limit do Nominatim
      await delay(1100);
    }

    state.running = false;
    state.concluido = true;
    if (onProgress) onProgress({ ...state });
    if (onComplete) onComplete({ ...state });
  }

  function cancelar() {
    if (state.running) {
      state.cancelar = true;
    }
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

  return {
    iniciar,
    refinar,
    cancelar,
    getProgress,
    setOnProgress,
    setOnComplete,
    isRunning,
  };
})();

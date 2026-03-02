/**
 * Geocodificação no navegador via Nominatim (OpenStreetMap).
 * Roda 100% no client-side — cada aba faz as requisições direto,
 * sem sobrecarregar o VPS.
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
  // NOMINATIM
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
  // GEOCODIFICAÇÃO EM BATCH
  // ================================

  async function iniciar(familias, apiBase = "") {
    if (state.running) return;

    if (!familias || familias.length === 0) {
      return;
    }

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
      if (coords) estrategia = "completo";

      // Estratégia 2: rua + cidade
      if (!coords && f.endereco_linha1 && f.endereco_linha3) {
        await delay(1100);
        coords = await geocodificarEndereco(`${f.endereco_linha1}, ${cidade}`);
        if (coords) estrategia = "rua+cidade";
      }

      // Estratégia 3: rua + número limpo + cidade
      if (!coords && ruaNumero) {
        await delay(1100);
        coords = await geocodificarEndereco(`${ruaNumero}, ${cidade}`);
        if (coords) estrategia = "rua+num";
      }

      // Estratégia 4: só nome da rua + cidade
      if (!coords && f.endereco_linha1) {
        const somenteRua = f.endereco_linha1.split(/[,\d]/)[0].trim();
        if (somenteRua.length > 3) {
          await delay(1100);
          coords = await geocodificarEndereco(
            `${somenteRua}, São José dos Campos, SP, Brasil`,
          );
          if (coords) estrategia = "só rua";
        }
      }

      if (coords) {
        // Salvar coordenadas no servidor
        try {
          await fetch(`${apiBase}/api/familias/${f.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: coords.lat,
              longitude: coords.lon,
            }),
          });
        } catch (e) {}
        state.sucesso++;
        state.ultimaEstrategia = estrategia;
      } else {
        state.falha++;
        state.ultimaEstrategia = "não encontrado";
      }

      if (onProgress) onProgress({ ...state });

      // Rate limit do Nominatim (1 req/seg)
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
    cancelar,
    getProgress,
    setOnProgress,
    setOnComplete,
    isRunning,
  };
})();

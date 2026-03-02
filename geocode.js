/**
 * Módulo de geocodificação reutilizável.
 * Usado pelo server.js (rota de geocodificação automática) e pelo script CLI.
 */

const https = require('https');
const db = require('./db');

// ================================
// GEOCODIFICAÇÃO VIA NOMINATIM
// ================================

function geocodificarEndereco(endereco) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(endereco);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=br`;

    https.get(url, {
      headers: { 'User-Agent': 'MapaDeMembrosSJC/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results.length > 0) {
            resolve({ lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// ================================
// HELPERS DE LIMPEZA DE ENDEREÇO
// ================================

function extrairRuaENumero(endereco) {
  if (!endereco) return null;
  const match = endereco.match(/^(.+?\d+)/);
  if (match) {
    return match[1].trim().replace(/[,\s]+$/, '');
  }
  return endereco.split(',')[0].trim();
}

function extrairCidade(linha3) {
  if (!linha3) return 'São José dos Campos, SP, Brasil';
  let cidade = linha3.replace(/^[\d\-\s]+/, '').trim();
  cidade = cidade.replace(/\s*-\s*/g, ', ');
  return cidade || 'São José dos Campos, SP, Brasil';
}

// ================================
// GEOCODIFICAÇÃO EM BATCH
// ================================

// Estado global do processo de geocodificação
let geocodeState = {
  running: false,
  total: 0,
  current: 0,
  sucesso: 0,
  falha: 0,
  ultimaFamilia: '',
  ultimaEstrategia: '',
  concluido: false,
  cancelar: false
};

function getGeocodeProgress() {
  return { ...geocodeState };
}

function cancelGeocode() {
  if (geocodeState.running) {
    geocodeState.cancelar = true;
  }
}

async function geocodificarBatch() {
  if (geocodeState.running) {
    return { erro: 'Geocodificação já está em andamento' };
  }

  const familias = db.prepare(
    `SELECT id, nome_familia, endereco_linha1, endereco_linha2, endereco_linha3, endereco_completo 
     FROM familias WHERE latitude IS NULL AND endereco_completo != ''`
  ).all();

  if (familias.length === 0) {
    return { sucesso: true, mensagem: 'Todas as famílias já possuem coordenadas!' };
  }

  // Reset state
  geocodeState = {
    running: true,
    total: familias.length,
    current: 0,
    sucesso: 0,
    falha: 0,
    ultimaFamilia: '',
    ultimaEstrategia: '',
    concluido: false,
    cancelar: false
  };

  const atualizar = db.prepare('UPDATE familias SET latitude = ?, longitude = ? WHERE id = ?');

  // Rodar em background (não bloqueia a resposta HTTP)
  (async () => {
    for (let i = 0; i < familias.length; i++) {
      if (geocodeState.cancelar) break;

      const f = familias[i];
      geocodeState.current = i + 1;
      geocodeState.ultimaFamilia = f.nome_familia;

      const cidade = extrairCidade(f.endereco_linha3);
      const ruaNumero = extrairRuaENumero(f.endereco_linha1);
      let coords = null;
      let estrategia = '';

      // Estratégia 1: endereço completo
      coords = await geocodificarEndereco(f.endereco_completo);
      if (coords) estrategia = 'completo';

      // Estratégia 2: rua + cidade
      if (!coords && f.endereco_linha1 && f.endereco_linha3) {
        await delay(1100);
        coords = await geocodificarEndereco(`${f.endereco_linha1}, ${cidade}`);
        if (coords) estrategia = 'rua+cidade';
      }

      // Estratégia 3: rua + número limpo + cidade
      if (!coords && ruaNumero) {
        await delay(1100);
        coords = await geocodificarEndereco(`${ruaNumero}, ${cidade}`);
        if (coords) estrategia = 'rua+num';
      }

      // Estratégia 4: só nome da rua + cidade
      if (!coords && f.endereco_linha1) {
        const somenteRua = f.endereco_linha1.split(/[,\d]/)[0].trim();
        if (somenteRua.length > 3) {
          await delay(1100);
          coords = await geocodificarEndereco(`${somenteRua}, São José dos Campos, SP, Brasil`);
          if (coords) estrategia = 'só rua';
        }
      }

      if (coords) {
        atualizar.run(coords.lat, coords.lon, f.id);
        geocodeState.sucesso++;
        geocodeState.ultimaEstrategia = estrategia;
      } else {
        geocodeState.falha++;
        geocodeState.ultimaEstrategia = 'não encontrado';
      }

      // Espera entre requisições (regra do Nominatim)
      await delay(1100);
    }

    geocodeState.running = false;
    geocodeState.concluido = true;
  })();

  return {
    sucesso: true,
    total: familias.length,
    mensagem: `Geocodificação iniciada para ${familias.length} famílias`
  };
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = {
  geocodificarEndereco,
  extrairRuaENumero,
  extrairCidade,
  geocodificarBatch,
  getGeocodeProgress,
  cancelGeocode
};

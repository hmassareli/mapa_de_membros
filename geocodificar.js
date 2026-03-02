/**
 * Script para geocodificar endereços que ainda não possuem coordenadas.
 * Usa o Nominatim (OpenStreetMap) - gratuito, 1 requisição por segundo.
 * 
 * Uso: node geocodificar.js
 */

const db = require('./db');
const https = require('https');

async function geocodificarEndereco(endereco) {
  return new Promise((resolve, reject) => {
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

/**
 * Extrai "Rua Tal, 123" de endereços como:
 *   "Rua George Eastman, 651 Bl.8 apt.34"
 *   "R. José Cobra,360 -bloco 1 - apto 104"
 *   "Av Dr João Bat de S Soares,2251 Bl11-4"
 * 
 * Lógica: pega tudo até o primeiro grupo de dígitos (o número da casa),
 * e descarta o resto (bloco, apto, fundos, condomínio, etc.)
 */
function extrairRuaENumero(endereco) {
  if (!endereco) return null;
  // Match: tudo até (e incluindo) o primeiro bloco de dígitos
  // Ex: "Rua George Eastman, 651 Bl.8 apt.34" -> "Rua George Eastman, 651"
  // Ex: "R. José Cobra,360 -bloco 1" -> "R. José Cobra,360"
  const match = endereco.match(/^(.+?\d+)/);
  if (match) {
    let limpo = match[1].trim();
    // Remover vírgula ou espaço no final
    limpo = limpo.replace(/[,\s]+$/, '');
    return limpo;
  }
  // Se não tem número nenhum, retorna o endereço cortando em vírgula
  const partes = endereco.split(',');
  return partes[0].trim();
}

/**
 * Extrai a cidade do endereco_linha3.
 * Formatos comuns: "12235410 São José dos Campos - SP", "São José dos campos - SP"
 */
function extrairCidade(linha3) {
  if (!linha3) return 'São José dos Campos, SP, Brasil';
  // Remover CEP do início (sequência de dígitos e traço)
  let cidade = linha3.replace(/^[\d\-\s]+/, '').trim();
  // Trocar " - " por ", " pra ficar melhor no Nominatim
  cidade = cidade.replace(/\s*-\s*/g, ', ');
  return cidade || 'São José dos Campos, SP, Brasil';
}

async function main() {
  const familias = db.prepare(
    `SELECT id, nome_familia, endereco_linha1, endereco_linha2, endereco_linha3, endereco_completo 
     FROM familias WHERE latitude IS NULL AND endereco_completo != ''`
  ).all();

  if (familias.length === 0) {
    console.log('✅ Todas as famílias já possuem coordenadas!');
    return;
  }

  console.log(`🗺️  Geocodificando ${familias.length} endereços...`);
  console.log(`   (1 por segundo - limite do Nominatim)`);
  console.log(`   Tempo estimado: ~${Math.ceil(familias.length / 60)} minutos\n`);

  const atualizar = db.prepare(`UPDATE familias SET latitude = ?, longitude = ? WHERE id = ?`);

  let sucesso = 0;
  let falha = 0;
  const falhas = [];

  for (let i = 0; i < familias.length; i++) {
    const f = familias[i];
    const cidade = extrairCidade(f.endereco_linha3);
    const ruaNumero = extrairRuaENumero(f.endereco_linha1);
    let estrategia = '';

    // Estratégia 1: endereço completo (rua + bairro + cidade)
    let coords = await geocodificarEndereco(f.endereco_completo);
    if (coords) estrategia = 'completo';

    // Estratégia 2: linha1 inteira + cidade (sem bairro)
    if (!coords && f.endereco_linha1 && f.endereco_linha3) {
      await new Promise(r => setTimeout(r, 1100));
      coords = await geocodificarEndereco(`${f.endereco_linha1}, ${cidade}`);
      if (coords) estrategia = 'rua+cidade';
    }

    // Estratégia 3: TRUQUE - só rua + número (sem bloco/apto/fundos) + cidade
    if (!coords && ruaNumero) {
      await new Promise(r => setTimeout(r, 1100));
      coords = await geocodificarEndereco(`${ruaNumero}, ${cidade}`);
      if (coords) estrategia = 'rua+num';
    }

    // Estratégia 4: só o nome da rua (sem número nenhum) + cidade
    if (!coords && f.endereco_linha1) {
      const somenteRua = f.endereco_linha1.split(/[,\d]/)[0].trim();
      if (somenteRua.length > 3) {
        await new Promise(r => setTimeout(r, 1100));
        coords = await geocodificarEndereco(`${somenteRua}, São José dos Campos, SP, Brasil`);
        if (coords) estrategia = 'só rua';
      }
    }

    if (coords) {
      atualizar.run(coords.lat, coords.lon, f.id);
      sucesso++;
    } else {
      falha++;
      falhas.push(`${f.nome_familia}: ${f.endereco_linha1 || 'sem endereço'}`);
    }

    const progresso = Math.round(((i + 1) / familias.length) * 100);
    const tag = coords ? `✅ ${estrategia}` : '❌';
    process.stdout.write(`\r   Progresso: ${progresso}% (${i + 1}/${familias.length}) | ✅ ${sucesso} | ❌ ${falha} | último: ${tag}   `);

    // Espera 1.1 segundos entre requisições
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`\n\n✅ Geocodificação concluída!`);
  console.log(`   Encontrados: ${sucesso}`);
  console.log(`   Não encontrados: ${falha}`);

  if (falhas.length > 0) {
    console.log(`\n❌ Famílias não geocodificadas:`);
    falhas.forEach(f => console.log(`   - ${f}`));
    console.log(`\nVocê pode adicionas as coordenadas manualmente pelo mapa.`);
  }
}

main().catch(console.error);

/**
 * Script para importar membros do JSON exportado do diretório da Igreja
 * para o banco de dados SQLite.
 * 
 * Uso: node importar.js [caminho-do-arquivo.json]
 * Padrão: members.json
 */

const db = require('./db');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const arquivo = process.argv[2] || 'members.json';
const caminhoCompleto = path.resolve(arquivo);

if (!fs.existsSync(caminhoCompleto)) {
  console.error(`Arquivo não encontrado: ${caminhoCompleto}`);
  process.exit(1);
}

console.log(`Importando membros de: ${caminhoCompleto}`);

const dados = JSON.parse(fs.readFileSync(caminhoCompleto, 'utf8'));
console.log(`Total de registros no arquivo: ${dados.length}`);

// Group by household
const familias = {};
dados.forEach(membro => {
  const hhId = membro.householdUuid;
  if (!hhId) return;

  if (!familias[hhId]) {
    const addr = membro.address || {};
    familias[hhId] = {
      householdUuid: hhId,
      nomeFamilia: membro.householdNameDirectoryLocal || membro.householdNameFamilyLocal || 'Desconhecido',
      enderecoLinha1: addr.formattedLine1 || '',
      enderecoLinha2: addr.formattedLine2 || '',
      enderecoLinha3: addr.formattedLine3 || '',
      enderecoCompleto: (addr.addressLines || []).join(', '),
      ala: membro.unitName || '',
      telefone: membro.phoneNumber || '',
      email: membro.email || '',
      membros: []
    };
  }

  familias[hhId].membros.push({
    pessoaUuid: membro.personUuid || membro.uuid,
    nomeCompleto: membro.nameFormats?.listPreferredLocal || `${membro.nameFormats?.familyPreferredLocal}, ${membro.nameFormats?.givenPreferredLocal}`,
    primeiroNome: membro.nameFormats?.givenPreferredLocal || '',
    sobrenome: membro.nameFormats?.familyPreferredLocal || '',
    sexo: membro.sex || '',
    idade: membro.age ? String(membro.age) : '',
    telefone: membro.phoneNumber || '',
    email: membro.email || '',
    papelFamilia: membro.householdRole || 'OTHER',
    sacerdocio: membro.priesthoodOffice || '',
    eMembro: membro.isMember ? 1 : 0,
    eAdulto: membro.isAdult ? 1 : 0,
    eJovemAdultoSolteiro: membro.isYoungSingleAdult ? 1 : 0,
    eAdultoSolteiro: membro.isSingleAdult ? 1 : 0,
    dataNascimento: membro.birth?.date?.display || ''
  });
});

console.log(`Total de famílias identificadas: ${Object.keys(familias).length}`);

// Insert into database
const inserirFamilia = db.prepare(`
  INSERT OR IGNORE INTO familias (household_uuid, nome_familia, endereco_linha1, endereco_linha2, endereco_linha3, endereco_completo, ala, telefone, email, status, aceita_visitas)
  VALUES (@householdUuid, @nomeFamilia, @enderecoLinha1, @enderecoLinha2, @enderecoLinha3, @enderecoCompleto, @ala, @telefone, @email, 'nao_contatado', 'nao_contatado')
`);

const buscarFamilia = db.prepare(`SELECT id FROM familias WHERE household_uuid = ?`);

const inserirMembro = db.prepare(`
  INSERT OR IGNORE INTO membros (pessoa_uuid, familia_id, nome_completo, primeiro_nome, sobrenome, sexo, idade, telefone, email, papel_familia, sacerdocio, e_membro, e_adulto, e_jovem_adulto_solteiro, e_adulto_solteiro, data_nascimento)
  VALUES (@pessoaUuid, @familiaId, @nomeCompleto, @primeiroNome, @sobrenome, @sexo, @idade, @telefone, @email, @papelFamilia, @sacerdocio, @eMembro, @eAdulto, @eJovemAdultoSolteiro, @eAdultoSolteiro, @dataNascimento)
`);

const importar = db.transaction(() => {
  let contFamilias = 0;
  let contMembros = 0;

  for (const [hhId, familia] of Object.entries(familias)) {
    inserirFamilia.run({
      householdUuid: familia.householdUuid,
      nomeFamilia: familia.nomeFamilia,
      enderecoLinha1: familia.enderecoLinha1,
      enderecoLinha2: familia.enderecoLinha2,
      enderecoLinha3: familia.enderecoLinha3,
      enderecoCompleto: familia.enderecoCompleto,
      ala: familia.ala,
      telefone: familia.telefone,
      email: familia.email
    });

    const row = buscarFamilia.get(familia.householdUuid);
    if (!row) continue;

    contFamilias++;

    for (const membro of familia.membros) {
      inserirMembro.run({
        ...membro,
        familiaId: row.id
      });
      contMembros++;
    }
  }

  return { contFamilias, contMembros };
});

const resultado = importar();
console.log(`\n✅ Importação concluída!`);
console.log(`   Famílias importadas: ${resultado.contFamilias}`);
console.log(`   Membros importados: ${resultado.contMembros}`);

// --- Geocoding using Nominatim (OpenStreetMap) ---
// Rate limited to 1 request per second as per Nominatim policy

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

async function geocodificarTodas() {
  const familiasSemCoord = db.prepare(
    `SELECT id, endereco_linha1, endereco_linha2, endereco_linha3, endereco_completo FROM familias WHERE latitude IS NULL AND endereco_completo != ''`
  ).all();

  console.log(`\n🗺️  Geocodificando ${familiasSemCoord.length} endereços...`);
  console.log(`   (1 por segundo - Nominatim rate limit)`);
  console.log(`   Tempo estimado: ~${Math.ceil(familiasSemCoord.length / 60)} minutos\n`);

  const atualizar = db.prepare(`UPDATE familias SET latitude = ?, longitude = ? WHERE id = ?`);

  let sucesso = 0;
  let falha = 0;

  for (let i = 0; i < familiasSemCoord.length; i++) {
    const f = familiasSemCoord[i];

    // Try full address first, then fallback to street + city
    let coords = await geocodificarEndereco(f.endereco_completo);

    if (!coords && f.endereco_linha1 && f.endereco_linha3) {
      // Try with just street and city
      coords = await geocodificarEndereco(`${f.endereco_linha1}, ${f.endereco_linha3}`);
    }

    if (!coords && f.endereco_linha1) {
      // Last resort: just city
      coords = await geocodificarEndereco(`${f.endereco_linha1}, São José dos Campos, SP, Brasil`);
    }

    if (coords) {
      atualizar.run(coords.lat, coords.lon, f.id);
      sucesso++;
    } else {
      falha++;
    }

    const progresso = Math.round(((i + 1) / familiasSemCoord.length) * 100);
    process.stdout.write(`\r   Progresso: ${progresso}% (${i + 1}/${familiasSemCoord.length}) | ✅ ${sucesso} | ❌ ${falha}`);

    // Wait 1.1 seconds between requests (Nominatim policy)
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`\n\n✅ Geocodificação concluída!`);
  console.log(`   Endereços encontrados: ${sucesso}`);
  console.log(`   Endereços não encontrados: ${falha}`);
}

// Ask user if they want to geocode
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('\nDeseja geocodificar os endereços agora? (s/n): ', async (resposta) => {
  if (resposta.toLowerCase() === 's') {
    await geocodificarTodas();
  } else {
    console.log('Você pode geocodificar depois executando: node geocodificar.js');
  }
  rl.close();
  process.exit(0);
});

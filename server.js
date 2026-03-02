const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const auth = require('./auth');
const geocode = require('./geocode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ========================
// AUTH MIDDLEWARES
// ========================

// Primeiro: se não tem usuário cadastrado, redireciona para setup
app.use(auth.setupMiddleware);
// Depois: verifica se está logado
app.use(auth.authMiddleware);

// Arquivos estáticos servidos APÓS a autenticação
// (login.html e setup.html são permitidos pelo authMiddleware)
app.use(express.static(path.join(__dirname, 'public')));

// ========================
// ROTAS DE AUTENTICAÇÃO
// ========================

// Status: verifica se o sistema já foi configurado
app.get('/api/auth/status', (req, res) => {
  res.json({ configurado: auth.temUsuarios() });
});

// Setup: criar primeiro usuário (só funciona se não tem nenhum)
app.post('/api/auth/setup', (req, res) => {
  if (auth.temUsuarios()) {
    return res.status(400).json({ erro: 'Sistema já configurado' });
  }

  const { username, senha, nome, ala } = req.body;
  if (!username || !senha) {
    return res.status(400).json({ erro: 'Login e senha são obrigatórios' });
  }

  try {
    const userId = auth.criarUsuario(username, senha, nome || '', ala || '');
    const token = auth.criarSessao(userId);

    res.setHeader('Set-Cookie', auth.setCookieHeader(token));
    res.json({ sucesso: true, mensagem: 'Conta criada com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, senha } = req.body;
  if (!username || !senha) {
    return res.status(400).json({ erro: 'Login e senha são obrigatórios' });
  }

  const usuario = auth.buscarUsuario(username);
  if (!usuario || !auth.verificarSenha(senha, usuario.senha_hash)) {
    return res.status(401).json({ erro: 'Login ou senha inválidos' });
  }

  const token = auth.criarSessao(usuario.id);
  res.setHeader('Set-Cookie', auth.setCookieHeader(token));
  res.json({ sucesso: true, nome: usuario.nome, ala: usuario.ala });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const cookieStr = req.headers.cookie || '';
  const match = cookieStr.match(/(?:^|;\s*)session=([^;]*)/);
  if (match) auth.encerrarSessao(match[1]);

  res.setHeader('Set-Cookie', auth.clearCookieHeader());
  res.json({ sucesso: true });
});

// Quem sou eu (dados do usuário logado)
app.get('/api/auth/me', (req, res) => {
  res.json({
    username: req.usuario.username,
    nome: req.usuario.nome,
    ala: req.usuario.ala
  });
});

// ========================
// UPLOAD / IMPORTAÇÃO JSON
// ========================

app.post('/api/importar', (req, res) => {
  const { dados } = req.body;

  if (!dados || !Array.isArray(dados) || dados.length === 0) {
    return res.status(400).json({ erro: 'Envie o array de membros no campo "dados"' });
  }

  try {
    // Agrupar por household
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
        nomeCompleto: membro.nameFormats?.listPreferredLocal || `${membro.nameFormats?.familyPreferredLocal || ''}, ${membro.nameFormats?.givenPreferredLocal || ''}`,
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

    const inserirFamilia = db.prepare(`
      INSERT OR IGNORE INTO familias (household_uuid, nome_familia, endereco_linha1, endereco_linha2, endereco_linha3, endereco_completo, ala, telefone, email, status, aceita_visitas)
      VALUES (@householdUuid, @nomeFamilia, @enderecoLinha1, @enderecoLinha2, @enderecoLinha3, @enderecoCompleto, @ala, @telefone, @email, 'nao_contatado', 'nao_contatado')
    `);
    const buscarFamilia = db.prepare('SELECT id FROM familias WHERE household_uuid = ?');
    const inserirMembro = db.prepare(`
      INSERT OR IGNORE INTO membros (pessoa_uuid, familia_id, nome_completo, primeiro_nome, sobrenome, sexo, idade, telefone, email, papel_familia, sacerdocio, e_membro, e_adulto, e_jovem_adulto_solteiro, e_adulto_solteiro, data_nascimento)
      VALUES (@pessoaUuid, @familiaId, @nomeCompleto, @primeiroNome, @sobrenome, @sexo, @idade, @telefone, @email, @papelFamilia, @sacerdocio, @eMembro, @eAdulto, @eJovemAdultoSolteiro, @eAdultoSolteiro, @dataNascimento)
    `);

    const importar = db.transaction(() => {
      let contFamilias = 0;
      let contMembros = 0;

      for (const familia of Object.values(familias)) {
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
          inserirMembro.run({ ...membro, familiaId: row.id });
          contMembros++;
        }
      }

      return { contFamilias, contMembros };
    });

    const resultado = importar();
    res.json({
      sucesso: true,
      familias: resultado.contFamilias,
      membros: resultado.contMembros,
      mensagem: `Importados: ${resultado.contFamilias} famílias e ${resultado.contMembros} membros`
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Verificar se tem dados importados
app.get('/api/tem-dados', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as n FROM familias').get().n;
  const semCoord = db.prepare('SELECT COUNT(*) as n FROM familias WHERE latitude IS NULL AND endereco_completo != ?').get('').n;
  res.json({ temDados: count > 0, totalFamilias: count, semCoordenadas: semCoord });
});

// ========================
// GEOCODIFICAÇÃO AUTOMÁTICA
// ========================

// Iniciar geocodificação em batch (roda em background)
app.post('/api/geocodificar-batch', async (req, res) => {
  try {
    const resultado = await geocode.geocodificarBatch();
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Progresso da geocodificação (polling)
app.get('/api/geocodificar-progresso', (req, res) => {
  res.json(geocode.getGeocodeProgress());
});

// Cancelar geocodificação
app.post('/api/geocodificar-cancelar', (req, res) => {
  geocode.cancelGeocode();
  res.json({ sucesso: true });
});

// ========================
// FAMÍLIAS (Households)
// ========================

// GET todas as famílias com coordenadas (para o mapa)
app.get('/api/familias', (req, res) => {
  const { status, aceita_visitas, interesse_retorno, busca } = req.query;

  let sql = `
    SELECT f.*, 
      COUNT(m.id) as total_membros,
      (SELECT COUNT(*) FROM visitas v WHERE v.familia_id = f.id) as total_visitas,
      (SELECT MAX(v.data_visita) FROM visitas v WHERE v.familia_id = f.id) as ultima_visita
    FROM familias f
    LEFT JOIN membros m ON m.familia_id = f.id
  `;

  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('f.status = ?');
    params.push(status);
  }
  if (aceita_visitas) {
    conditions.push('f.aceita_visitas = ?');
    params.push(aceita_visitas);
  }
  if (interesse_retorno) {
    conditions.push('f.interesse_retorno = ?');
    params.push(interesse_retorno);
  }
  if (busca) {
    conditions.push('(f.nome_familia LIKE ? OR f.endereco_completo LIKE ?)');
    params.push(`%${busca}%`, `%${busca}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY f.id ORDER BY f.nome_familia';

  try {
    const familias = db.prepare(sql).all(...params);
    res.json(familias);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// GET uma família com membros e visitas
app.get('/api/familias/:id', (req, res) => {
  try {
    const familia = db.prepare(`
      SELECT f.*,
        (SELECT COUNT(*) FROM visitas v WHERE v.familia_id = f.id) as total_visitas,
        (SELECT MAX(v.data_visita) FROM visitas v WHERE v.familia_id = f.id) as ultima_visita
      FROM familias f WHERE f.id = ?
    `).get(req.params.id);

    if (!familia) {
      return res.status(404).json({ erro: 'Família não encontrada' });
    }

    const membros = db.prepare('SELECT * FROM membros WHERE familia_id = ? ORDER BY papel_familia, primeiro_nome').all(req.params.id);
    const visitas = db.prepare('SELECT * FROM visitas WHERE familia_id = ? ORDER BY data_visita DESC LIMIT 20').all(req.params.id);

    res.json({ ...familia, membros, visitas });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// PUT atualizar família (status, aceita_visitas, interesse, coordenadas, observações)
app.put('/api/familias/:id', (req, res) => {
  const { status, aceita_visitas, interesse_retorno, observacoes, latitude, longitude } = req.body;

  try {
    const sets = [];
    const params = [];

    if (status !== undefined) { sets.push('status = ?'); params.push(status); }
    if (aceita_visitas !== undefined) { sets.push('aceita_visitas = ?'); params.push(aceita_visitas); }
    if (interesse_retorno !== undefined) { sets.push('interesse_retorno = ?'); params.push(interesse_retorno); }
    if (observacoes !== undefined) { sets.push('observacoes = ?'); params.push(observacoes); }
    if (latitude !== undefined) { sets.push('latitude = ?'); params.push(latitude); }
    if (longitude !== undefined) { sets.push('longitude = ?'); params.push(longitude); }

    if (sets.length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar' });
    }

    sets.push('atualizado_em = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    db.prepare(`UPDATE familias SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const familia = db.prepare('SELECT * FROM familias WHERE id = ?').get(req.params.id);
    res.json(familia);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// VISITAS (Visits)
// ========================

// POST registrar nova visita
app.post('/api/visitas', (req, res) => {
  const { familia_id, data_visita, visitante, tipo, resultado, notas } = req.body;

  if (!familia_id || !data_visita || !visitante) {
    return res.status(400).json({ erro: 'familia_id, data_visita e visitante são obrigatórios' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO visitas (familia_id, data_visita, visitante, tipo, resultado, notas)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(familia_id, data_visita, visitante, tipo || 'visita', resultado, notas);

    const visita = db.prepare('SELECT * FROM visitas WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(visita);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// DELETE remover visita
app.delete('/api/visitas/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM visitas WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Visita removida' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// PUT atualizar visita
app.put('/api/visitas/:id', (req, res) => {
  const { data_visita, visitante, tipo, resultado, notas } = req.body;

  try {
    const sets = [];
    const params = [];

    if (data_visita !== undefined) { sets.push('data_visita = ?'); params.push(data_visita); }
    if (visitante !== undefined) { sets.push('visitante = ?'); params.push(visitante); }
    if (tipo !== undefined) { sets.push('tipo = ?'); params.push(tipo); }
    if (resultado !== undefined) { sets.push('resultado = ?'); params.push(resultado); }
    if (notas !== undefined) { sets.push('notas = ?'); params.push(notas); }

    if (sets.length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar' });
    }

    params.push(req.params.id);
    db.prepare(`UPDATE visitas SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const visita = db.prepare('SELECT * FROM visitas WHERE id = ?').get(req.params.id);
    res.json(visita);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// ESTATÍSTICAS
// ========================

app.get('/api/estatisticas', (req, res) => {
  try {
    const stats = {
      totalFamilias: db.prepare('SELECT COUNT(*) as n FROM familias').get().n,
      totalMembros: db.prepare('SELECT COUNT(*) as n FROM membros').get().n,
      totalVisitas: db.prepare('SELECT COUNT(*) as n FROM visitas').get().n,
      familiasAtivas: db.prepare("SELECT COUNT(*) as n FROM familias WHERE status = 'ativo'").get().n,
      familiasInativas: db.prepare("SELECT COUNT(*) as n FROM familias WHERE status = 'inativo'").get().n,
      familiasMudaram: db.prepare("SELECT COUNT(*) as n FROM familias WHERE status = 'mudou'").get().n,
      familiasDesconhecido: db.prepare("SELECT COUNT(*) as n FROM familias WHERE status = 'desconhecido'").get().n,
      familiasNaoContatadas: db.prepare("SELECT COUNT(*) as n FROM familias WHERE status = 'nao_contatado'").get().n,
      aceitamVisitas: db.prepare("SELECT COUNT(*) as n FROM familias WHERE aceita_visitas = 'sim'").get().n,
      naoAceitamVisitas: db.prepare("SELECT COUNT(*) as n FROM familias WHERE aceita_visitas = 'nao'").get().n,
      naoContatadas: db.prepare("SELECT COUNT(*) as n FROM familias WHERE aceita_visitas = 'nao_contatado'").get().n,
      comCoordenadas: db.prepare('SELECT COUNT(*) as n FROM familias WHERE latitude IS NOT NULL').get().n,
      semCoordenadas: db.prepare('SELECT COUNT(*) as n FROM familias WHERE latitude IS NULL').get().n,
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// GEOCODIFICAÇÃO MANUAL
// ========================

app.post('/api/geocodificar/:id', async (req, res) => {
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ erro: 'latitude e longitude são obrigatórios' });
  }

  try {
    db.prepare('UPDATE familias SET latitude = ?, longitude = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?')
      .run(latitude, longitude, req.params.id);
    res.json({ mensagem: 'Coordenadas atualizadas' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Fallback to index.html for SPA
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🗺️  Mapa de Membros rodando em http://localhost:${PORT}`);
  console.log(`   API disponível em http://localhost:${PORT}/api/`);
  console.log(`   Pressione Ctrl+C para parar\n`);
});

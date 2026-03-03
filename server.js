const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const db = require("./db");
const auth = require("./auth");
// geocode.js não é mais necessário — geocodificação roda no navegador

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ========================
// AUTH MIDDLEWARES
// ========================

// Primeiro: se não tem usuário cadastrado, redireciona para setup
app.use(auth.setupMiddleware);
// Depois: verifica se está logado
app.use(auth.authMiddleware);

// Arquivos estáticos (React build)
app.use(express.static(path.join(__dirname, "dist")));

// ========================
// ROTAS DE AUTENTICAÇÃO
// ========================

// Status: verifica se o sistema já foi configurado
app.get("/api/auth/status", (req, res) => {
  res.json({ configurado: auth.temUsuarios() });
});

// Setup: criar nova ala (qualquer pessoa pode se cadastrar)
app.post("/api/auth/setup", (req, res) => {
  const { username, senha, nome, ala } = req.body;
  if (!username || !senha) {
    return res.status(400).json({ erro: "Login e senha são obrigatórios" });
  }

  try {
    // Verificar se username já existe
    if (auth.buscarUsuario(username)) {
      return res
        .status(400)
        .json({ erro: "Esse login já está em uso. Escolha outro." });
    }

    const userId = auth.criarUsuario(username, senha, nome || "", ala || "");
    const token = auth.criarSessao(userId);

    res.setHeader("Set-Cookie", auth.setCookieHeader(token));
    res.json({ sucesso: true, mensagem: "Conta criada com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { username, senha } = req.body;
  if (!username || !senha) {
    return res.status(400).json({ erro: "Login e senha são obrigatórios" });
  }

  const usuario = auth.buscarUsuario(username);
  if (!usuario || !auth.verificarSenha(senha, usuario.senha_hash)) {
    return res.status(401).json({ erro: "Login ou senha inválidos" });
  }

  const token = auth.criarSessao(usuario.id);
  res.setHeader("Set-Cookie", auth.setCookieHeader(token));
  res.json({ sucesso: true, nome: usuario.nome, ala: usuario.ala });
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  const cookieStr = req.headers.cookie || "";
  const match = cookieStr.match(/(?:^|;\s*)session=([^;]*)/);
  if (match) auth.encerrarSessao(match[1]);

  res.setHeader("Set-Cookie", auth.clearCookieHeader());
  res.json({ sucesso: true });
});

// Quem sou eu (dados do usuário logado)
app.get("/api/auth/me", (req, res) => {
  res.json({
    username: req.usuario.username,
    nome: req.usuario.nome,
    ala: req.usuario.ala,
  });
});

// ========================
// UPLOAD / IMPORTAÇÃO JSON
// ========================

app.post("/api/importar", (req, res) => {
  const { dados } = req.body;

  if (!dados || !Array.isArray(dados) || dados.length === 0) {
    return res
      .status(400)
      .json({ erro: 'Envie o array de membros no campo "dados"' });
  }

  try {
    // Agrupar por household
    const familias = {};
    dados.forEach((membro) => {
      const hhId = membro.householdUuid;
      if (!hhId) return;

      if (!familias[hhId]) {
        const addr = membro.address || {};
        familias[hhId] = {
          householdUuid: hhId,
          nomeFamilia:
            membro.householdNameDirectoryLocal ||
            membro.householdNameFamilyLocal ||
            "Desconhecido",
          enderecoLinha1: addr.formattedLine1 || "",
          enderecoLinha2: addr.formattedLine2 || "",
          enderecoLinha3: addr.formattedLine3 || "",
          enderecoCompleto: (addr.addressLines || []).join(", "),
          ala: membro.unitName || "",
          telefone: membro.phoneNumber || "",
          email: membro.email || "",
          membros: [],
        };
      }

      familias[hhId].membros.push({
        pessoaUuid: membro.personUuid || membro.uuid,
        nomeCompleto:
          membro.nameFormats?.listPreferredLocal ||
          `${membro.nameFormats?.familyPreferredLocal || ""}, ${membro.nameFormats?.givenPreferredLocal || ""}`,
        primeiroNome: membro.nameFormats?.givenPreferredLocal || "",
        sobrenome: membro.nameFormats?.familyPreferredLocal || "",
        sexo: membro.sex || "",
        idade: membro.age ? String(membro.age) : "",
        telefone: membro.phoneNumber || "",
        email: membro.email || "",
        papelFamilia: membro.householdRole || "OTHER",
        sacerdocio: membro.priesthoodOffice || "",
        eMembro: membro.isMember ? 1 : 0,
        eAdulto: membro.isAdult ? 1 : 0,
        eJovemAdultoSolteiro: membro.isYoungSingleAdult ? 1 : 0,
        eAdultoSolteiro: membro.isSingleAdult ? 1 : 0,
        dataNascimento: membro.birth?.date?.display || "",
      });
    });

    const usuarioId = req.usuario.usuario_id;
    const inserirFamilia = db.prepare(`
      INSERT OR IGNORE INTO familias (household_uuid, usuario_id, nome_familia, endereco_linha1, endereco_linha2, endereco_linha3, endereco_completo, ala, telefone, email, status, aceita_visitas)
      VALUES (@householdUuid, @usuarioId, @nomeFamilia, @enderecoLinha1, @enderecoLinha2, @enderecoLinha3, @enderecoCompleto, @ala, @telefone, @email, 'nao_contatado', 'nao_contatado')
    `);
    const buscarFamilia = db.prepare(
      "SELECT id FROM familias WHERE household_uuid = ? AND usuario_id = ?",
    );
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
          usuarioId: usuarioId,
          nomeFamilia: familia.nomeFamilia,
          enderecoLinha1: familia.enderecoLinha1,
          enderecoLinha2: familia.enderecoLinha2,
          enderecoLinha3: familia.enderecoLinha3,
          enderecoCompleto: familia.enderecoCompleto,
          ala: familia.ala,
          telefone: familia.telefone,
          email: familia.email,
        });

        const row = buscarFamilia.get(familia.householdUuid, usuarioId);
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
      mensagem: `Importados: ${resultado.contFamilias} famílias e ${resultado.contMembros} membros`,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// SINCRONIZAR (MERGE) - Atualiza dados existentes + adiciona novos
// ========================

app.post("/api/sincronizar", (req, res) => {
  const { dados } = req.body;

  if (!dados || !Array.isArray(dados) || dados.length === 0) {
    return res
      .status(400)
      .json({ erro: 'Envie o array de membros no campo "dados"' });
  }

  try {
    // Agrupar por household (mesma lógica do importar)
    const familias = {};
    dados.forEach((membro) => {
      const hhId = membro.householdUuid;
      if (!hhId) return;

      if (!familias[hhId]) {
        const addr = membro.address || {};
        familias[hhId] = {
          householdUuid: hhId,
          nomeFamilia:
            membro.householdNameDirectoryLocal ||
            membro.householdNameFamilyLocal ||
            "Desconhecido",
          enderecoLinha1: addr.formattedLine1 || "",
          enderecoLinha2: addr.formattedLine2 || "",
          enderecoLinha3: addr.formattedLine3 || "",
          enderecoCompleto: (addr.addressLines || []).join(", "),
          ala: membro.unitName || "",
          telefone: membro.phoneNumber || "",
          email: membro.email || "",
          membros: [],
        };
      }

      familias[hhId].membros.push({
        pessoaUuid: membro.personUuid || membro.uuid,
        nomeCompleto:
          membro.nameFormats?.listPreferredLocal ||
          `${membro.nameFormats?.familyPreferredLocal || ""}, ${membro.nameFormats?.givenPreferredLocal || ""}`,
        primeiroNome: membro.nameFormats?.givenPreferredLocal || "",
        sobrenome: membro.nameFormats?.familyPreferredLocal || "",
        sexo: membro.sex || "",
        idade: membro.age ? String(membro.age) : "",
        telefone: membro.phoneNumber || "",
        email: membro.email || "",
        papelFamilia: membro.householdRole || "OTHER",
        sacerdocio: membro.priesthoodOffice || "",
        eMembro: membro.isMember ? 1 : 0,
        eAdulto: membro.isAdult ? 1 : 0,
        eJovemAdultoSolteiro: membro.isYoungSingleAdult ? 1 : 0,
        eAdultoSolteiro: membro.isSingleAdult ? 1 : 0,
        dataNascimento: membro.birth?.date?.display || "",
      });
    });

    const usuarioId = req.usuario.usuario_id;
    const buscarFamilia = db.prepare(
      "SELECT * FROM familias WHERE household_uuid = ? AND usuario_id = ?",
    );
    const inserirFamilia = db.prepare(`
      INSERT INTO familias (household_uuid, usuario_id, nome_familia, endereco_linha1, endereco_linha2, endereco_linha3, endereco_completo, ala, telefone, email, status, aceita_visitas)
      VALUES (@householdUuid, @usuarioId, @nomeFamilia, @enderecoLinha1, @enderecoLinha2, @enderecoLinha3, @enderecoCompleto, @ala, @telefone, @email, 'nao_contatado', 'nao_contatado')
    `);
    const atualizarFamilia = db.prepare(`
      UPDATE familias SET 
        nome_familia = @nomeFamilia,
        endereco_linha1 = @enderecoLinha1, endereco_linha2 = @enderecoLinha2, endereco_linha3 = @enderecoLinha3,
        endereco_completo = @enderecoCompleto, ala = @ala, telefone = @telefone, email = @email,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE household_uuid = @householdUuid AND usuario_id = @usuarioId
    `);
    // Se endereço mudou, resetar geocode para re-geocodificar
    const resetarGeocode = db.prepare(`
      UPDATE familias SET latitude = NULL, longitude = NULL, geocode_fonte = NULL, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const buscarMembro = db.prepare(
      "SELECT * FROM membros WHERE pessoa_uuid = ?",
    );
    const inserirMembro = db.prepare(`
      INSERT INTO membros (pessoa_uuid, familia_id, nome_completo, primeiro_nome, sobrenome, sexo, idade, telefone, email, papel_familia, sacerdocio, e_membro, e_adulto, e_jovem_adulto_solteiro, e_adulto_solteiro, data_nascimento)
      VALUES (@pessoaUuid, @familiaId, @nomeCompleto, @primeiroNome, @sobrenome, @sexo, @idade, @telefone, @email, @papelFamilia, @sacerdocio, @eMembro, @eAdulto, @eJovemAdultoSolteiro, @eAdultoSolteiro, @dataNascimento)
    `);
    const atualizarMembro = db.prepare(`
      UPDATE membros SET 
        nome_completo = @nomeCompleto, primeiro_nome = @primeiroNome, sobrenome = @sobrenome,
        sexo = @sexo, idade = @idade, telefone = @telefone, email = @email,
        papel_familia = @papelFamilia, sacerdocio = @sacerdocio,
        e_membro = @eMembro, e_adulto = @eAdulto,
        e_jovem_adulto_solteiro = @eJovemAdultoSolteiro, e_adulto_solteiro = @eAdultoSolteiro,
        data_nascimento = @dataNascimento
      WHERE pessoa_uuid = @pessoaUuid
    `);

    const sincronizar = db.transaction(() => {
      let familiasNovas = 0,
        familiasAtualizadas = 0,
        enderecosAlterados = 0;
      let membrosNovos = 0,
        membrosAtualizados = 0;

      for (const familia of Object.values(familias)) {
        const existente = buscarFamilia.get(familia.householdUuid, usuarioId);

        if (existente) {
          // Verificar se endereço mudou
          const enderecoMudou =
            existente.endereco_completo !== familia.enderecoCompleto ||
            existente.endereco_linha1 !== familia.enderecoLinha1;

          atualizarFamilia.run({
            householdUuid: familia.householdUuid,
            usuarioId: usuarioId,
            nomeFamilia: familia.nomeFamilia,
            enderecoLinha1: familia.enderecoLinha1,
            enderecoLinha2: familia.enderecoLinha2,
            enderecoLinha3: familia.enderecoLinha3,
            enderecoCompleto: familia.enderecoCompleto,
            ala: familia.ala,
            telefone: familia.telefone,
            email: familia.email,
          });
          familiasAtualizadas++;

          if (enderecoMudou) {
            resetarGeocode.run(existente.id);
            enderecosAlterados++;
          }
        } else {
          inserirFamilia.run({
            householdUuid: familia.householdUuid,
            usuarioId: usuarioId,
            nomeFamilia: familia.nomeFamilia,
            enderecoLinha1: familia.enderecoLinha1,
            enderecoLinha2: familia.enderecoLinha2,
            enderecoLinha3: familia.enderecoLinha3,
            enderecoCompleto: familia.enderecoCompleto,
            ala: familia.ala,
            telefone: familia.telefone,
            email: familia.email,
          });
          familiasNovas++;
        }

        const row = db
          .prepare("SELECT id FROM familias WHERE household_uuid = ? AND usuario_id = ?")
          .get(familia.householdUuid, usuarioId);
        if (!row) continue;

        for (const membro of familia.membros) {
          const membroExistente = buscarMembro.get(membro.pessoaUuid);
          const dados = { ...membro, familiaId: row.id };

          if (membroExistente) {
            atualizarMembro.run(dados);
            membrosAtualizados++;
          } else {
            inserirMembro.run(dados);
            membrosNovos++;
          }
        }
      }

      return {
        familiasNovas,
        familiasAtualizadas,
        enderecosAlterados,
        membrosNovos,
        membrosAtualizados,
      };
    });

    const r = sincronizar();
    res.json({
      sucesso: true,
      familiasNovas: r.familiasNovas,
      familiasAtualizadas: r.familiasAtualizadas,
      enderecosAlterados: r.enderecosAlterados,
      membrosNovos: r.membrosNovos,
      membrosAtualizados: r.membrosAtualizados,
      mensagem: `Sincronizado! ${r.familiasNovas} famílias novas, ${r.familiasAtualizadas} atualizadas (${r.enderecosAlterados} endereços alterados). ${r.membrosNovos} membros novos, ${r.membrosAtualizados} atualizados.`,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// RESETAR TODOS OS DADOS
// ========================

app.post("/api/resetar", (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;
    db.prepare("DELETE FROM visitas WHERE familia_id IN (SELECT id FROM familias WHERE usuario_id = ?)").run(usuarioId);
    db.prepare("DELETE FROM membros WHERE familia_id IN (SELECT id FROM familias WHERE usuario_id = ?)").run(usuarioId);
    db.prepare("DELETE FROM familias WHERE usuario_id = ?").run(usuarioId);
    res.json({ sucesso: true, mensagem: "Todos os seus dados foram apagados." });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// REGEOCODIFICAR - resetar coordenadas para re-geocodificar
// ========================

app.post("/api/regeocodificar", (req, res) => {
  const { modo } = req.body; // 'todos', 'cep', 'falhou'

  try {
    const usuarioId = req.usuario.usuario_id;
    let affected = 0;
    if (modo === "todos") {
      const r = db
        .prepare(
          "UPDATE familias SET latitude = NULL, longitude = NULL, geocode_fonte = NULL WHERE endereco_completo != '' AND usuario_id = ?",
        )
        .run(usuarioId);
      affected = r.changes;
    } else if (modo === "cep") {
      const r = db
        .prepare(
          "UPDATE familias SET geocode_fonte = 'cep' WHERE geocode_fonte IN ('nominatim', 'nominatim_falhou') AND usuario_id = ?",
        )
        .run(usuarioId);
      affected = r.changes;
    } else if (modo === "falhou") {
      const r = db
        .prepare(
          "UPDATE familias SET geocode_fonte = 'cep' WHERE geocode_fonte = 'nominatim_falhou' AND usuario_id = ?",
        )
        .run(usuarioId);
      affected = r.changes;
    } else {
      return res
        .status(400)
        .json({ erro: "Modo inválido. Use: todos, cep, falhou" });
    }

    res.json({
      sucesso: true,
      afetados: affected,
      mensagem: `${affected} famílias marcadas para regeocodificação.`,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// ESTATÍSTICAS DE GEOCODIFICAÇÃO
// ========================

app.get("/api/geocode-stats", (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;
    const stats = db
      .prepare(
        `
      SELECT 
        geocode_fonte,
        COUNT(*) as total
      FROM familias 
      WHERE usuario_id = ?
      GROUP BY geocode_fonte
    `,
      )
      .all(usuarioId);

    const total = db.prepare("SELECT COUNT(*) as n FROM familias WHERE usuario_id = ?").get(usuarioId).n;
    const semEndereco = db
      .prepare(
        "SELECT COUNT(*) as n FROM familias WHERE (endereco_completo = '' OR endereco_completo IS NULL) AND usuario_id = ?",
      )
      .get(usuarioId).n;

    res.json({ stats, total, semEndereco });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Verificar se tem dados importados
app.get("/api/tem-dados", (req, res) => {
  const usuarioId = req.usuario.usuario_id;
  const count = db.prepare("SELECT COUNT(*) as n FROM familias WHERE usuario_id = ?").get(usuarioId).n;
  const semCoord = db
    .prepare(
      "SELECT COUNT(*) as n FROM familias WHERE latitude IS NULL AND endereco_completo != ? AND usuario_id = ?",
    )
    .get("", usuarioId).n;
  res.json({
    temDados: count > 0,
    totalFamilias: count,
    semCoordenadas: semCoord,
  });
});

// ========================
// FAMÍLIAS SEM COORDENADAS (para geocodificação client-side)
// ========================

app.get("/api/familias-sem-coordenadas", (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;
    const familias = db
      .prepare(
        `SELECT id, nome_familia, endereco_linha1, endereco_linha2, endereco_linha3, endereco_completo 
       FROM familias WHERE latitude IS NULL AND endereco_completo != '' AND usuario_id = ?`,
      )
      .all(usuarioId);
    res.json(familias);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// FAMÍLIAS PENDENTES DE REFINAMENTO NOMINATIM
// (coordenadas vieram do CEP, precisam ser refinadas)
// ========================

app.get("/api/familias-pendentes-refinamento", (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;
    const familias = db
      .prepare(
        `SELECT id, nome_familia, endereco_linha1, endereco_linha2, endereco_linha3, endereco_completo 
       FROM familias WHERE geocode_fonte = 'cep' AND endereco_completo != '' AND usuario_id = ?`,
      )
      .all(usuarioId);
    res.json(familias);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// FAMÍLIAS (Households)
// ========================

// GET todas as famílias com coordenadas (para o mapa)
app.get("/api/familias", (req, res) => {
  const { status, aceita_visitas, interesse_retorno, busca } = req.query;
  const usuarioId = req.usuario.usuario_id;

  let sql = `
    SELECT f.*, 
      COUNT(m.id) as total_membros,
      (SELECT COUNT(*) FROM visitas v WHERE v.familia_id = f.id) as total_visitas,
      (SELECT MAX(v.data_visita) FROM visitas v WHERE v.familia_id = f.id) as ultima_visita
    FROM familias f
    LEFT JOIN membros m ON m.familia_id = f.id
  `;

  const conditions = ["f.usuario_id = ?"];
  const params = [usuarioId];

  if (status) {
    conditions.push("f.status = ?");
    params.push(status);
  }
  if (aceita_visitas) {
    conditions.push("f.aceita_visitas = ?");
    params.push(aceita_visitas);
  }
  if (interesse_retorno) {
    conditions.push("f.interesse_retorno = ?");
    params.push(interesse_retorno);
  }
  if (busca) {
    conditions.push("(f.nome_familia LIKE ? OR f.endereco_completo LIKE ?)");
    params.push(`%${busca}%`, `%${busca}%`);
  }

  sql += " WHERE " + conditions.join(" AND ");

  sql += " GROUP BY f.id ORDER BY f.nome_familia";

  try {
    const familias = db.prepare(sql).all(...params);
    res.json(familias);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Busca de famílias por nome de membro (para o search dropdown)
app.get("/api/buscar-membros", (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  try {
    const usuarioId = req.usuario.usuario_id;
    const membros = db
      .prepare(
        `SELECT m.nome_completo, m.primeiro_nome, m.familia_id, f.nome_familia, f.endereco_linha1, f.latitude, f.longitude, f.status
       FROM membros m
       JOIN familias f ON f.id = m.familia_id
       WHERE (m.nome_completo LIKE ? OR m.primeiro_nome LIKE ?) AND f.usuario_id = ?
       LIMIT 10`,
      )
      .all(`%${q}%`, `%${q}%`, usuarioId);
    res.json(membros);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// GET uma família com membros e visitas
app.get("/api/familias/:id", (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;
    const familia = db
      .prepare(
        `
      SELECT f.*,
        (SELECT COUNT(*) FROM visitas v WHERE v.familia_id = f.id) as total_visitas,
        (SELECT MAX(v.data_visita) FROM visitas v WHERE v.familia_id = f.id) as ultima_visita
      FROM familias f WHERE f.id = ? AND f.usuario_id = ?
    `,
      )
      .get(req.params.id, usuarioId);

    if (!familia) {
      return res.status(404).json({ erro: "Família não encontrada" });
    }

    const membros = db
      .prepare(
        "SELECT * FROM membros WHERE familia_id = ? ORDER BY papel_familia, primeiro_nome",
      )
      .all(req.params.id);
    const visitas = db
      .prepare(
        "SELECT * FROM visitas WHERE familia_id = ? ORDER BY data_visita DESC LIMIT 20",
      )
      .all(req.params.id);

    res.json({ ...familia, membros, visitas });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// PUT atualizar família (status, aceita_visitas, interesse, coordenadas, endereço, observações)
app.put("/api/familias/:id", (req, res) => {
  const {
    status,
    aceita_visitas,
    interesse_retorno,
    observacoes,
    latitude,
    longitude,
    geocode_fonte,
    endereco_linha1,
    endereco_linha2,
    endereco_linha3,
    endereco_completo,
  } = req.body;

  try {
    const usuarioId = req.usuario.usuario_id;

    // Verificar ownership
    const existe = db.prepare("SELECT id FROM familias WHERE id = ? AND usuario_id = ?").get(req.params.id, usuarioId);
    if (!existe) return res.status(404).json({ erro: "Família não encontrada" });

    const sets = [];
    const params = [];

    if (status !== undefined) {
      sets.push("status = ?");
      params.push(status);
    }
    if (aceita_visitas !== undefined) {
      sets.push("aceita_visitas = ?");
      params.push(aceita_visitas);
    }
    if (interesse_retorno !== undefined) {
      sets.push("interesse_retorno = ?");
      params.push(interesse_retorno);
    }
    if (observacoes !== undefined) {
      sets.push("observacoes = ?");
      params.push(observacoes);
    }
    if (latitude !== undefined) {
      sets.push("latitude = ?");
      params.push(latitude);
    }
    if (longitude !== undefined) {
      sets.push("longitude = ?");
      params.push(longitude);
    }
    if (geocode_fonte !== undefined) {
      sets.push("geocode_fonte = ?");
      params.push(geocode_fonte);
    }
    // Edição de endereço
    const enderecoEditado =
      endereco_linha1 !== undefined ||
      endereco_linha2 !== undefined ||
      endereco_linha3 !== undefined ||
      endereco_completo !== undefined;

    if (endereco_linha1 !== undefined) {
      sets.push("endereco_linha1 = ?");
      params.push(endereco_linha1);
    }
    if (endereco_linha2 !== undefined) {
      sets.push("endereco_linha2 = ?");
      params.push(endereco_linha2);
    }
    if (endereco_linha3 !== undefined) {
      sets.push("endereco_linha3 = ?");
      params.push(endereco_linha3);
    }
    if (endereco_completo !== undefined) {
      sets.push("endereco_completo = ?");
      params.push(endereco_completo);
    }
    if (enderecoEditado) {
      sets.push("endereco_editado = 1");
      // Resetar geocode para re-geocodificar com novo endereço
      sets.push("latitude = NULL");
      sets.push("longitude = NULL");
      sets.push("geocode_fonte = NULL");
    }

    if (sets.length === 0) {
      return res.status(400).json({ erro: "Nenhum campo para atualizar" });
    }

    sets.push("atualizado_em = CURRENT_TIMESTAMP");
    params.push(req.params.id);

    db.prepare(`UPDATE familias SET ${sets.join(", ")} WHERE id = ?`).run(
      ...params,
    );

    const familia = db
      .prepare("SELECT * FROM familias WHERE id = ?")
      .get(req.params.id);
    res.json(familia);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// VISITAS (Visits)
// ========================

// POST registrar nova visita
app.post("/api/visitas", (req, res) => {
  const { familia_id, data_visita, visitante, tipo, resultado, notas } =
    req.body;

  if (!familia_id || !data_visita || !visitante) {
    return res
      .status(400)
      .json({ erro: "familia_id, data_visita e visitante são obrigatórios" });
  }

  try {
    // Verificar ownership da família
    const usuarioId = req.usuario.usuario_id;
    const familia = db.prepare("SELECT id FROM familias WHERE id = ? AND usuario_id = ?").get(familia_id, usuarioId);
    if (!familia) return res.status(404).json({ erro: "Família não encontrada" });

    const result = db
      .prepare(
        `
      INSERT INTO visitas (familia_id, data_visita, visitante, tipo, resultado, notas)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        familia_id,
        data_visita,
        visitante,
        tipo || "visita",
        resultado,
        notas,
      );

    const visita = db
      .prepare("SELECT * FROM visitas WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(visita);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// DELETE remover visita
app.delete("/api/visitas/:id", (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;
    // Verificar ownership via família
    const visita = db.prepare(
      "SELECT v.id FROM visitas v JOIN familias f ON f.id = v.familia_id WHERE v.id = ? AND f.usuario_id = ?"
    ).get(req.params.id, usuarioId);
    if (!visita) return res.status(404).json({ erro: "Visita não encontrada" });

    db.prepare("DELETE FROM visitas WHERE id = ?").run(req.params.id);
    res.json({ mensagem: "Visita removida" });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// PUT atualizar visita
app.put("/api/visitas/:id", (req, res) => {
  const { data_visita, visitante, tipo, resultado, notas } = req.body;

  try {
    const usuarioId = req.usuario.usuario_id;
    // Verificar ownership via família
    const visitaOwner = db.prepare(
      "SELECT v.id FROM visitas v JOIN familias f ON f.id = v.familia_id WHERE v.id = ? AND f.usuario_id = ?"
    ).get(req.params.id, usuarioId);
    if (!visitaOwner) return res.status(404).json({ erro: "Visita não encontrada" });

    const sets = [];
    const params = [];

    if (data_visita !== undefined) {
      sets.push("data_visita = ?");
      params.push(data_visita);
    }
    if (visitante !== undefined) {
      sets.push("visitante = ?");
      params.push(visitante);
    }
    if (tipo !== undefined) {
      sets.push("tipo = ?");
      params.push(tipo);
    }
    if (resultado !== undefined) {
      sets.push("resultado = ?");
      params.push(resultado);
    }
    if (notas !== undefined) {
      sets.push("notas = ?");
      params.push(notas);
    }

    if (sets.length === 0) {
      return res.status(400).json({ erro: "Nenhum campo para atualizar" });
    }

    params.push(req.params.id);
    db.prepare(`UPDATE visitas SET ${sets.join(", ")} WHERE id = ?`).run(
      ...params,
    );

    const visita = db
      .prepare("SELECT * FROM visitas WHERE id = ?")
      .get(req.params.id);
    res.json(visita);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// ESTATÍSTICAS
// ========================

app.get("/api/estatisticas", (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;
    const stats = {
      totalFamilias: db.prepare("SELECT COUNT(*) as n FROM familias WHERE usuario_id = ?").get(usuarioId).n,
      totalMembros: db.prepare("SELECT COUNT(*) as n FROM membros m JOIN familias f ON f.id = m.familia_id WHERE f.usuario_id = ?").get(usuarioId).n,
      totalVisitas: db.prepare("SELECT COUNT(*) as n FROM visitas v JOIN familias f ON f.id = v.familia_id WHERE f.usuario_id = ?").get(usuarioId).n,
      familiasAtivas: db
        .prepare("SELECT COUNT(*) as n FROM familias WHERE status = 'ativo' AND usuario_id = ?")
        .get(usuarioId).n,
      familiasInativas: db
        .prepare("SELECT COUNT(*) as n FROM familias WHERE status = 'inativo' AND usuario_id = ?")
        .get(usuarioId).n,
      familiasMudaram: db
        .prepare("SELECT COUNT(*) as n FROM familias WHERE status = 'mudou' AND usuario_id = ?")
        .get(usuarioId).n,
      familiasDesconhecido: db
        .prepare(
          "SELECT COUNT(*) as n FROM familias WHERE status = 'desconhecido' AND usuario_id = ?",
        )
        .get(usuarioId).n,
      familiasNaoContatadas: db
        .prepare(
          "SELECT COUNT(*) as n FROM familias WHERE status = 'nao_contatado' AND usuario_id = ?",
        )
        .get(usuarioId).n,
      aceitamVisitas: db
        .prepare(
          "SELECT COUNT(*) as n FROM familias WHERE aceita_visitas = 'sim' AND usuario_id = ?",
        )
        .get(usuarioId).n,
      naoAceitamVisitas: db
        .prepare(
          "SELECT COUNT(*) as n FROM familias WHERE aceita_visitas = 'nao' AND usuario_id = ?",
        )
        .get(usuarioId).n,
      naoContatadas: db
        .prepare(
          "SELECT COUNT(*) as n FROM familias WHERE aceita_visitas = 'nao_contatado' AND usuario_id = ?",
        )
        .get(usuarioId).n,
      comCoordenadas: db
        .prepare(
          "SELECT COUNT(*) as n FROM familias WHERE latitude IS NOT NULL AND usuario_id = ?",
        )
        .get(usuarioId).n,
      semCoordenadas: db
        .prepare("SELECT COUNT(*) as n FROM familias WHERE latitude IS NULL AND usuario_id = ?")
        .get(usuarioId).n,
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// GEOCODIFICAÇÃO MANUAL
// ========================

app.post("/api/geocodificar/:id", async (req, res) => {
  const { latitude, longitude, geocode_fonte } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res
      .status(400)
      .json({ erro: "latitude e longitude são obrigatórios" });
  }

  try {
    const usuarioId = req.usuario.usuario_id;
    // Verificar ownership
    const existe = db.prepare("SELECT id FROM familias WHERE id = ? AND usuario_id = ?").get(req.params.id, usuarioId);
    if (!existe) return res.status(404).json({ erro: "Família não encontrada" });

    const fonte = geocode_fonte || "manual";
    db.prepare(
      "UPDATE familias SET latitude = ?, longitude = ?, geocode_fonte = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND usuario_id = ?",
    ).run(latitude, longitude, fonte, req.params.id, usuarioId);
    res.json({ mensagem: "Coordenadas atualizadas" });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ========================
// RELATÓRIO (famílias com membros)
// ========================

app.get("/api/relatorio", (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;
    const familias = db
      .prepare(
        `
      SELECT f.*,
        COUNT(m.id) as total_membros,
        (SELECT COUNT(*) FROM visitas v WHERE v.familia_id = f.id) as total_visitas,
        (SELECT MAX(v.data_visita) FROM visitas v WHERE v.familia_id = f.id) as ultima_visita
      FROM familias f
      LEFT JOIN membros m ON m.familia_id = f.id
      WHERE f.usuario_id = ?
      GROUP BY f.id
      ORDER BY f.nome_familia
    `,
      )
      .all(usuarioId);

    const getMembros = db.prepare(
      "SELECT * FROM membros WHERE familia_id = ? ORDER BY papel_familia, primeiro_nome",
    );
    const getUltimaVisita = db.prepare(
      "SELECT * FROM visitas WHERE familia_id = ? ORDER BY data_visita DESC LIMIT 1",
    );

    const resultado = familias.map((f) => ({
      ...f,
      membros: getMembros.all(f.id),
      ultimaVisitaInfo: getUltimaVisita.get(f.id) || null,
    }));

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Fallback to index.html for SPA
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🗺️  Mapa de Membros rodando em http://localhost:${PORT}`);
  console.log(`   API disponível em http://localhost:${PORT}/api/`);
  console.log(`   Pressione Ctrl+C para parar\n`);
});

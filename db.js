const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "membros.db");
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS familias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    household_uuid TEXT UNIQUE NOT NULL,
    nome_familia TEXT NOT NULL,
    endereco_linha1 TEXT,
    endereco_linha2 TEXT,
    endereco_linha3 TEXT,
    endereco_completo TEXT,
    latitude REAL,
    longitude REAL,
    ala TEXT,
    telefone TEXT,
    email TEXT,
    status TEXT DEFAULT 'nao_contatado' CHECK(status IN ('ativo', 'inativo', 'mudou', 'desconhecido', 'nao_contatado')),
    aceita_visitas TEXT DEFAULT 'nao_contatado' CHECK(aceita_visitas IN ('sim', 'nao', 'nao_contatado')),
    interesse_retorno TEXT DEFAULT 'nao_contatado' CHECK(interesse_retorno IN ('sim', 'nao', 'talvez', 'nao_contatado')),
    observacoes TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS membros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pessoa_uuid TEXT UNIQUE NOT NULL,
    familia_id INTEGER NOT NULL,
    nome_completo TEXT NOT NULL,
    primeiro_nome TEXT,
    sobrenome TEXT,
    sexo TEXT,
    idade TEXT,
    telefone TEXT,
    email TEXT,
    papel_familia TEXT CHECK(papel_familia IN ('HEAD', 'SPOUSE', 'CHILD', 'OTHER')),
    sacerdocio TEXT,
    e_membro INTEGER DEFAULT 1,
    e_adulto INTEGER DEFAULT 0,
    e_jovem_adulto_solteiro INTEGER DEFAULT 0,
    e_adulto_solteiro INTEGER DEFAULT 0,
    data_nascimento TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS visitas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    familia_id INTEGER NOT NULL,
    data_visita DATE NOT NULL,
    visitante TEXT NOT NULL,
    tipo TEXT DEFAULT 'visita' CHECK(tipo IN ('visita', 'tentativa', 'ligacao', 'mensagem')),
    resultado TEXT CHECK(resultado IN ('atendeu', 'nao_atendeu', 'nao_estava', 'recusou')),
    notas TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_membros_familia ON membros(familia_id);
  CREATE INDEX IF NOT EXISTS idx_visitas_familia ON visitas(familia_id);
  CREATE INDEX IF NOT EXISTS idx_familias_status ON familias(status);
  CREATE INDEX IF NOT EXISTS idx_familias_coords ON familias(latitude, longitude);

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    nome TEXT,
    ala TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    usuario_id INTEGER NOT NULL,
    expira_em DATETIME NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(token);
`);

// ========================
// MIGRAÇÃO: adicionar coluna geocode_fonte
// ========================
try {
  const cols = db.pragma("table_info(familias)");
  const temFonte = cols.some((c) => c.name === "geocode_fonte");
  if (!temFonte) {
    db.exec(`ALTER TABLE familias ADD COLUMN geocode_fonte TEXT DEFAULT NULL`);
    // Marcar coordenadas existentes como 'cep' (presumido) para que sejam refinadas
    db.exec(
      `UPDATE familias SET geocode_fonte = 'cep' WHERE latitude IS NOT NULL AND geocode_fonte IS NULL`,
    );
    console.log("Migração: coluna geocode_fonte adicionada.");
  }
} catch (e) {
  // Coluna já existe ou tabela nova
}

// ========================
// MIGRAÇÃO: adicionar coluna endereco_editado
// ========================
try {
  const cols2 = db.pragma("table_info(familias)");
  const temEditado = cols2.some((c) => c.name === "endereco_editado");
  if (!temEditado) {
    db.exec(
      `ALTER TABLE familias ADD COLUMN endereco_editado INTEGER DEFAULT 0`,
    );
    console.log("Migração: coluna endereco_editado adicionada.");
  }
} catch (e) {
  // Coluna já existe ou tabela nova
}

// ========================
// MIGRAÇÃO: adicionar 'inativo' e 'nao_contatado' ao status existente
// SQLite não suporta ALTER CHECK, então recriamos a constraint via tabela nova
// Mas como usamos CHECK inline, basta garantir que os dados são compatíveis.
// A forma mais segura é recriar a tabela, mas como já temos dados, vamos apenas
// atualizar os valores padrão para famílias existentes que estavam como 'ativo'.
// ========================
try {
  // Migrar famílias que tinham status 'ativo' e aceita_visitas 'sim' (valores padrão antigos)
  // para 'nao_contatado' - o usuário vai classificar manualmente
  const info = db.pragma("table_info(familias)");
  const statusCol = info.find((c) => c.name === "status");
  // Se a tabela já existia com constraint antiga, recriamos
  if (statusCol) {
    // Verificar se precisamos migrar (se a constraint não inclui 'inativo')
    const testRow = db.prepare("SELECT 1").get();
    try {
      db.prepare("UPDATE familias SET status = 'inativo' WHERE 0").run();
      // Se não deu erro, a constraint já aceita 'inativo' - tudo certo
    } catch (e) {
      // Constraint antiga - precisamos recriar a tabela
      console.log("Migrando banco de dados para novo esquema de status...");
      db.exec(`
        ALTER TABLE familias RENAME TO familias_old;
        
        CREATE TABLE familias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          household_uuid TEXT UNIQUE NOT NULL,
          nome_familia TEXT NOT NULL,
          endereco_linha1 TEXT,
          endereco_linha2 TEXT,
          endereco_linha3 TEXT,
          endereco_completo TEXT,
          latitude REAL,
          longitude REAL,
          ala TEXT,
          telefone TEXT,
          email TEXT,
          status TEXT DEFAULT 'nao_contatado' CHECK(status IN ('ativo', 'inativo', 'mudou', 'desconhecido', 'nao_contatado')),
          aceita_visitas TEXT DEFAULT 'nao_contatado' CHECK(aceita_visitas IN ('sim', 'nao', 'nao_contatado')),
          interesse_retorno TEXT DEFAULT 'nao_contatado' CHECK(interesse_retorno IN ('sim', 'nao', 'talvez', 'nao_contatado')),
          observacoes TEXT,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO familias SELECT 
          id, household_uuid, nome_familia, endereco_linha1, endereco_linha2, endereco_linha3,
          endereco_completo, latitude, longitude, ala, telefone, email,
          CASE WHEN status = 'ativo' THEN 'nao_contatado' ELSE status END,
          CASE WHEN aceita_visitas = 'sim' THEN 'nao_contatado' ELSE aceita_visitas END,
          interesse_retorno, observacoes, criado_em, atualizado_em
        FROM familias_old;

        DROP TABLE familias_old;
      `);
      console.log(
        'Migração concluída! Famílias resetadas para "não contatado".',
      );
    }
  }
} catch (e) {
  // Tabela nova, nada a migrar
}

module.exports = db;

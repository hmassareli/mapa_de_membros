const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'membros.db'));
db.pragma('foreign_keys = OFF');

console.log('Migrando banco de dados...');

// Recreate familias table with new CHECK constraints
db.exec(`
  CREATE TABLE IF NOT EXISTS familias_new (
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

  INSERT INTO familias_new SELECT 
    id, household_uuid, nome_familia, endereco_linha1, endereco_linha2, endereco_linha3,
    endereco_completo, latitude, longitude, ala, telefone, email,
    'nao_contatado',
    'nao_contatado',
    'nao_contatado',
    observacoes, criado_em, atualizado_em
  FROM familias;

  DROP TABLE familias;
  ALTER TABLE familias_new RENAME TO familias;

  CREATE INDEX IF NOT EXISTS idx_familias_status ON familias(status);
  CREATE INDEX IF NOT EXISTS idx_familias_coords ON familias(latitude, longitude);
`);

db.pragma('foreign_keys = ON');

const result = db.prepare('SELECT status, COUNT(*) as n FROM familias GROUP BY status').all();
console.log('Status das famílias após migração:');
result.forEach(r => console.log(`  ${r.status}: ${r.n}`));
console.log('\n✅ Migração concluída! Todas as famílias estão como "Não Contatado".');
console.log('   Agora você pode classificar cada uma pelo mapa.');

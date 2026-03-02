/**
 * Módulo de autenticação simples.
 * Usa crypto nativo do Node.js (sem dependências extras).
 * Pode ser trocado por Supabase/Auth0/etc no futuro — basta
 * substituir as funções exportadas.
 */

const crypto = require("crypto");
const db = require("./db");

// ================================
// HASH DE SENHA (SHA-256 + salt)
// ================================

function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(salt + senha)
    .digest("hex");
  return `${salt}:${hash}`;
}

function verificarSenha(senha, senhaHash) {
  const [salt, hash] = senhaHash.split(":");
  const tentativa = crypto
    .createHash("sha256")
    .update(salt + senha)
    .digest("hex");
  return tentativa === hash;
}

// ================================
// USUÁRIOS
// ================================

function criarUsuario(username, senha, nome, ala) {
  const senhaHash = hashSenha(senha);
  const result = db
    .prepare(
      "INSERT INTO usuarios (username, senha_hash, nome, ala) VALUES (?, ?, ?, ?)",
    )
    .run(username, senhaHash, nome, ala);
  return result.lastInsertRowid;
}

function buscarUsuario(username) {
  return db.prepare("SELECT * FROM usuarios WHERE username = ?").get(username);
}

function temUsuarios() {
  const row = db.prepare("SELECT COUNT(*) as n FROM usuarios").get();
  return row.n > 0;
}

// ================================
// SESSÕES (token em cookie)
// ================================

function criarSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString("hex");
  // Sessão válida por 30 dias
  const expiraEm = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  db.prepare(
    "INSERT INTO sessoes (token, usuario_id, expira_em) VALUES (?, ?, ?)",
  ).run(token, usuarioId, expiraEm);

  // Limpar sessões expiradas aproveitando
  db.prepare("DELETE FROM sessoes WHERE expira_em < datetime('now')").run();

  return token;
}

function validarSessao(token) {
  if (!token) return null;
  const sessao = db
    .prepare(
      `
    SELECT s.*, u.username, u.nome, u.ala 
    FROM sessoes s 
    JOIN usuarios u ON u.id = s.usuario_id 
    WHERE s.token = ? AND s.expira_em > datetime('now')
  `,
    )
    .get(token);
  return sessao || null;
}

function encerrarSessao(token) {
  db.prepare("DELETE FROM sessoes WHERE token = ?").run(token);
}

// ================================
// MIDDLEWARE EXPRESS
// ================================

function authMiddleware(req, res, next) {
  // Rotas públicas (login, setup, assets estáticos)
  const publicPaths = [
    "/api/auth/login",
    "/api/auth/setup",
    "/api/auth/status",
    "/login.html",
    "/setup.html",
  ];
  if (publicPaths.some((p) => req.path === p)) return next();

  // Assets estáticos (css, js, fontes, imagens)
  if (/\.(css|js|png|jpg|svg|ico|woff|woff2|ttf)$/.test(req.path))
    return next();

  // Verificar cookie de sessão
  const token = parseCookie(req.headers.cookie || "", "session");
  const sessao = validarSessao(token);

  if (!sessao) {
    // API retorna 401, páginas redirecionam
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ erro: "Não autenticado" });
    }
    return res.redirect("/login.html");
  }

  req.usuario = sessao;
  next();
}

// Middleware que redireciona para /setup.html se não tem nenhum usuário ainda
function setupMiddleware(req, res, next) {
  const publicSetup = ["/api/auth/setup", "/api/auth/status", "/setup.html"];
  if (publicSetup.some((p) => req.path === p)) return next();
  if (/\.(css|js|png|jpg|svg|ico|woff|woff2|ttf)$/.test(req.path))
    return next();

  if (!temUsuarios()) {
    if (req.path.startsWith("/api/")) {
      return res
        .status(403)
        .json({ erro: "Sistema não configurado", setup: true });
    }
    return res.redirect("/setup.html");
  }
  next();
}

// ================================
// UTILITÁRIO DE COOKIE
// ================================

function parseCookie(cookieStr, name) {
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function setCookieHeader(token, maxAgeDays = 30) {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookieHeader() {
  return "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

module.exports = {
  criarUsuario,
  buscarUsuario,
  temUsuarios,
  verificarSenha,
  criarSessao,
  validarSessao,
  encerrarSessao,
  authMiddleware,
  setupMiddleware,
  setCookieHeader,
  clearCookieHeader,
};

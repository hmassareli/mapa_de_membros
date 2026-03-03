import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .authMe()
      .then(() => navigate("/", { replace: true }))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !senha) {
      setError("Preencha login e senha");
      return;
    }

    setLoading(true);
    try {
      await api.login({ username, senha });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Erro ao fazer login");
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">🗺️</div>
          <h1>Mapa de Membros</h1>
          <p>Faça login para acessar o mapa da sua ala</p>
        </div>

        <div className="login-body">
          {error && <div className="error-msg visible">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Login</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Login da ala"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-auth-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>Sua ala ainda não tem conta?</p>
            <a href="/setup">Cadastrar nova ala →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

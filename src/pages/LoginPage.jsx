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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #e8eef5 0%, #d5deec 100%)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="text-white p-8 text-center" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)' }}>
          <div className="text-4xl mb-2">🗺️</div>
          <h1 className="text-2xl font-bold mb-1">Mapa de Membros</h1>
          <p className="text-blue-100 text-sm">Faça login para acessar o mapa da sua ala</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 mb-4 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Login</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Login da ala"
                autoComplete="username"
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha"
                autoComplete="current-password"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <div className="text-center pt-6 border-t border-gray-100 mt-6 text-sm text-gray-500">
            <p>Sua ala ainda não tem conta?</p>
            <a href="/setup" className="text-blue-600 hover:underline font-medium">Cadastrar nova ala →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

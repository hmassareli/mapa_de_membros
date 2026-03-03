import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import geocodeClient from "../lib/geocodeClient";

export default function SetupPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [ala, setAla] = useState("");
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [jsonData, setJsonData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [recordCount, setRecordCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [geocodeProgress, setGeocodeProgress] = useState(null);
  const fileRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .authMe()
      .then(() => navigate("/", { replace: true }))
      .catch(() => {});
  }, []);

  function hideError() {
    setError("");
  }

  function goStep(n) {
    setStep(n);
    hideError();
  }

  async function criarConta() {
    if (!username || !senha) {
      setError("Preencha login e senha");
      return;
    }
    if (senha.length < 4) {
      setError("A senha deve ter pelo menos 4 caracteres");
      return;
    }
    if (senha !== senha2) {
      setError("As senhas não coincidem");
      return;
    }

    try {
      await api.setup({ username, senha, nome: username, ala });
      goStep(2);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleFile(file) {
    if (!file.name.endsWith(".json")) {
      setError("Selecione um arquivo .json");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) {
          setError("O arquivo JSON deve conter um array");
          return;
        }
        setJsonData(data);
        setFileName(file.name);
        setRecordCount(data.length);
        hideError();
      } catch (err) {
        setError("Erro ao ler JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  }

  async function importarDados() {
    if (!jsonData) return;
    setImporting(true);
    try {
      const data = await api.importar(jsonData);
      setResult(data);
      goStep(3);
      iniciarGeocode();
    } catch (err) {
      setError(err.message);
      setImporting(false);
    }
  }

  async function iniciarGeocode() {
    try {
      const familias = await api.familiasSemCoordenadas();
      if (!familias.length) {
        finalizarGeocode();
        return;
      }

      setGeocodeProgress({
        current: 0,
        total: familias.length,
        sucesso: 0,
        falha: 0,
        ultima: "",
      });

      geocodeClient.setOnProgress((p) => {
        setGeocodeProgress({
          current: p.current,
          total: p.total,
          sucesso: p.sucesso,
          falha: p.falha,
          ultima: p.ultimaFamilia
            ? `${p.ultimaFamilia} — ${p.ultimaEstrategia}`
            : "Iniciando...",
        });
      });

      geocodeClient.setOnComplete(() => finalizarGeocode());
      geocodeClient.iniciarSomenteCep(familias, "");
    } catch {
      finalizarGeocode();
    }
  }

  function finalizarGeocode() {
    goStep(4);
  }

  function pularGeocode() {
    geocodeClient.cancelar();
    goStep(4);
  }

  const pct = geocodeProgress
    ? geocodeProgress.total > 0
      ? Math.round((geocodeProgress.current / geocodeProgress.total) * 100)
      : 0
    : 0;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #e8eef5 0%, #d5deec 100%)",
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div
          className="text-white p-8 text-center"
          style={{
            background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
          }}
        >
          <div className="text-4xl mb-2">🗺️</div>
          <h1 className="text-2xl font-bold mb-1">Mapa de Membros</h1>
          <p className="text-blue-100 text-sm">
            Configure sua ala para começar
          </p>
        </div>

        <div className="p-8">
          <div className="flex justify-center gap-3 mb-6">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`w-3 h-3 rounded-full transition-all ${n === step ? "bg-blue-600 scale-125" : ""} ${n < step ? "bg-green-500" : ""} ${n > step ? "bg-gray-200" : ""}`}
              />
            ))}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 mb-4 text-sm text-center">
              {error}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">
                1. Crie o acesso da ala
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Este login será usado por todos que precisarem acessar o mapa.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Ala
                </label>
                <input
                  value={ala}
                  onChange={(e) => setAla(e.target.value)}
                  placeholder="Ex: Ala Parque Industrial"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Login
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: parqueindustrial"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Crie uma senha"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  value={senha2}
                  onChange={(e) => setSenha2(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    background:
                      "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
                  }}
                  onClick={criarConta}
                >
                  Próximo →
                </button>
              </div>
              <div className="text-center pt-6 border-t border-gray-100 mt-6 text-sm text-gray-500">
                <a
                  href="/login"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Já tem conta? Faça login
                </a>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">
                2. Importe o diretório
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Faça upload do arquivo <strong>members.json</strong> exportado
                do diretório da Igreja.
              </p>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${jsonData ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add(
                    "border-blue-400",
                    "bg-blue-50",
                  );
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove(
                    "border-blue-400",
                    "bg-blue-50",
                  );
                }}
                onDrop={handleDrop}
              >
                <div className="text-3xl mb-2">{jsonData ? "✅" : "📁"}</div>
                <div className="text-sm text-gray-600">
                  {jsonData
                    ? "Arquivo carregado!"
                    : "Clique ou arraste o arquivo JSON aqui"}
                </div>
                {fileName && (
                  <div className="text-xs text-gray-400 mt-1">
                    {fileName} ({recordCount} registros)
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={(e) =>
                    e.target.files.length && handleFile(e.target.files[0])
                  }
                />
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-all cursor-pointer"
                  onClick={() => goStep(1)}
                >
                  ← Voltar
                </button>
                <button
                  className="flex-1 py-3 text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  style={{
                    background:
                      "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
                  }}
                  onClick={importarDados}
                  disabled={!jsonData || importing}
                >
                  {importing ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                      Importando...
                    </>
                  ) : (
                    "Importar Dados"
                  )}
                </button>
              </div>
              <div className="text-center pt-6 border-t border-gray-100 mt-6 text-sm text-gray-500">
                <a
                  href="#"
                  className="text-blue-600 hover:underline font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    goStep(4);
                  }}
                >
                  Pular por agora
                </a>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">
                3. Localizando endereços no mapa
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Buscando coordenadas de cada família...
              </p>
              <div className="space-y-3">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      background:
                        "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
                    }}
                  />
                </div>
                <div className="text-sm text-gray-700 text-center font-medium">
                  {geocodeProgress?.current || 0} /{" "}
                  {geocodeProgress?.total || 0} endereços
                </div>
                <div className="flex justify-center gap-4 text-sm">
                  <span className="text-green-600">
                    ✅ {geocodeProgress?.sucesso || 0}
                  </span>
                  <span className="text-red-500">
                    ❌ {geocodeProgress?.falha || 0}
                  </span>
                </div>
                <div className="text-xs text-gray-400 text-center truncate">
                  {geocodeProgress?.ultima || "Iniciando..."}
                </div>
              </div>
              <div className="flex gap-3" style={{ marginTop: 16 }}>
                <button
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-all cursor-pointer"
                  onClick={pularGeocode}
                >
                  Pular (fazer depois)
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✅</div>
              <div className="text-lg font-semibold text-gray-800 mb-1">
                {result
                  ? `${result.familias} famílias, ${result.membros} membros`
                  : "Pronto!"}
              </div>
              <div className="text-sm text-gray-500 mb-4">
                {result
                  ? "importados com sucesso!"
                  : "Você pode importar dados depois pelo menu."}
              </div>
              <div className="flex gap-3" style={{ marginTop: 24 }}>
                <button
                  className="flex-1 py-3 text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    background:
                      "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
                  }}
                  onClick={() => navigate("/")}
                >
                  Abrir o Mapa 🗺️
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

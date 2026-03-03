import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import geocodeClient from '../lib/geocodeClient'

export default function SetupPage() {
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [ala, setAla] = useState('')
  const [username, setUsername] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [jsonData, setJsonData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [recordCount, setRecordCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [geocodeProgress, setGeocodeProgress] = useState(null)
  const fileRef = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    api.authMe().then(() => navigate('/', { replace: true })).catch(() => {})
  }, [])

  function hideError() { setError('') }

  function goStep(n) { setStep(n); hideError() }

  async function criarConta() {
    if (!username || !senha) { setError('Preencha login e senha'); return }
    if (senha.length < 4) { setError('A senha deve ter pelo menos 4 caracteres'); return }
    if (senha !== senha2) { setError('As senhas não coincidem'); return }

    try {
      await api.setup({ username, senha, nome: username, ala })
      goStep(2)
    } catch (err) {
      setError(err.message)
    }
  }

  function handleFile(file) {
    if (!file.name.endsWith('.json')) { setError('Selecione um arquivo .json'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!Array.isArray(data)) { setError('O arquivo JSON deve conter um array'); return }
        setJsonData(data)
        setFileName(file.name)
        setRecordCount(data.length)
        hideError()
      } catch (err) {
        setError('Erro ao ler JSON: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0])
  }

  async function importarDados() {
    if (!jsonData) return
    setImporting(true)
    try {
      const data = await api.importar(jsonData)
      setResult(data)
      goStep(3)
      iniciarGeocode()
    } catch (err) {
      setError(err.message)
      setImporting(false)
    }
  }

  async function iniciarGeocode() {
    try {
      const familias = await api.familiasSemCoordenadas()
      if (!familias.length) { finalizarGeocode(); return }

      setGeocodeProgress({ current: 0, total: familias.length, sucesso: 0, falha: 0, ultima: '' })

      geocodeClient.setOnProgress((p) => {
        setGeocodeProgress({
          current: p.current, total: p.total,
          sucesso: p.sucesso, falha: p.falha,
          ultima: p.ultimaFamilia ? `${p.ultimaFamilia} — ${p.ultimaEstrategia}` : 'Iniciando...',
        })
      })

      geocodeClient.setOnComplete(() => finalizarGeocode())
      geocodeClient.iniciarSomenteCep(familias, '')
    } catch {
      finalizarGeocode()
    }
  }

  function finalizarGeocode() { goStep(4) }

  function pularGeocode() {
    geocodeClient.cancelar()
    goStep(4)
  }

  const pct = geocodeProgress
    ? geocodeProgress.total > 0 ? Math.round((geocodeProgress.current / geocodeProgress.total) * 100) : 0
    : 0

  return (
    <div className="auth-page">
      <div className="setup-card">
        <div className="setup-header">
          <div className="logo">🗺️</div>
          <h1>Mapa de Membros</h1>
          <p>Configure sua ala para começar</p>
        </div>

        <div className="setup-body">
          <div className="step-indicator">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`step-dot ${n === step ? 'active' : ''} ${n < step ? 'done' : ''}`}
              />
            ))}
          </div>

          {error && <div className="error-msg visible">{error}</div>}

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <h2>1. Crie o acesso da ala</h2>
              <p className="step-desc">Este login será usado por todos que precisarem acessar o mapa.</p>
              <div className="form-group">
                <label>Nome da Ala</label>
                <input value={ala} onChange={(e) => setAla(e.target.value)} placeholder="Ex: Ala Parque Industrial" />
              </div>
              <div className="form-group">
                <label>Login</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ex: parqueindustrial" />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Crie uma senha" />
              </div>
              <div className="form-group">
                <label>Confirmar Senha</label>
                <input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} placeholder="Repita a senha" />
              </div>
              <div className="btn-row">
                <button className="btn btn-auth-primary" onClick={criarConta}>Próximo →</button>
              </div>
              <div className="auth-footer">
                <a href="/login">Já tem conta? Faça login</a>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <h2>2. Importe o diretório</h2>
              <p className="step-desc">Faça upload do arquivo <strong>members.json</strong> exportado do diretório da Igreja.</p>
              <div
                className={`upload-area ${jsonData ? 'has-file' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
                onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
                onDrop={handleDrop}
              >
                <div className="icon">{jsonData ? '✅' : '📁'}</div>
                <div className="text">{jsonData ? 'Arquivo carregado!' : 'Clique ou arraste o arquivo JSON aqui'}</div>
                {fileName && <div className="filename">{fileName} ({recordCount} registros)</div>}
                <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => e.target.files.length && handleFile(e.target.files[0])} />
              </div>
              <div className="btn-row">
                <button className="btn btn-auth-secondary" onClick={() => goStep(1)}>← Voltar</button>
                <button className="btn btn-auth-primary" onClick={importarDados} disabled={!jsonData || importing}>
                  {importing ? <><span className="spinner" /> Importando...</> : 'Importar Dados'}
                </button>
              </div>
              <div className="auth-footer">
                <a href="#" onClick={(e) => { e.preventDefault(); goStep(4) }}>Pular por agora</a>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <h2>3. Localizando endereços no mapa</h2>
              <p className="step-desc">Buscando coordenadas de cada família...</p>
              <div className="geocode-progress">
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${pct}%` }} />
                </div>
                <div className="progress-stats">
                  {geocodeProgress?.current || 0} / {geocodeProgress?.total || 0} endereços
                </div>
                <div className="progress-detail">
                  <span className="prog-ok">✅ {geocodeProgress?.sucesso || 0}</span>
                  <span className="prog-fail">❌ {geocodeProgress?.falha || 0}</span>
                </div>
                <div className="progress-last">{geocodeProgress?.ultima || 'Iniciando...'}</div>
              </div>
              <div className="btn-row" style={{ marginTop: 16 }}>
                <button className="btn btn-auth-secondary" onClick={pularGeocode}>Pular (fazer depois)</button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="success-box">
              <div className="icon">✅</div>
              <div className="count">
                {result ? `${result.familias} famílias, ${result.membros} membros` : 'Pronto!'}
              </div>
              <div className="detail">
                {result ? 'importados com sucesso!' : 'Você pode importar dados depois pelo menu.'}
              </div>
              <div className="btn-row" style={{ marginTop: 24 }}>
                <button className="btn btn-auth-primary" onClick={() => navigate('/')}>
                  Abrir o Mapa 🗺️
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

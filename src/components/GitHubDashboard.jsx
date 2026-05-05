import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, GitBranch, Lock, Zap } from 'lucide-react';

function resolveApiOrigin() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('apiBase');
    if (fromQuery) return fromQuery.replace(/\/$/, '');
  } catch {
    // não há window em ambientes SSR/teste
  }
  return (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
}

const API_ORIGIN = resolveApiOrigin();
const API_BASE = `${API_ORIGIN}/api`;

const PIN_STORAGE_KEY = 'gh_dashboard_pin';

export default function GitHubDashboard() {
  const [pin, setPin] = useState('');
  const [pinSubmitted, setPinSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [serverStatus, setServerStatus] = useState(null);

  const pinRef = useRef(pin);
  useEffect(() => { pinRef.current = pin; }, [pin]);

  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_STORAGE_KEY);
    if (saved) {
      setPin(saved);
      pinRef.current = saved;
      setPinSubmitted(true);
    }
  }, []);

  const checkServer = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      return response.ok;
    } catch {
      return false;
    }
  };

  const fetchGitHubData = async () => {
    if (!pin) {
      setError('Informe o PIN para acessar o dashboard');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const isServerRunning = await checkServer();

      if (!isServerRunning) {
        setError('Servidor não encontrado. Verifique a conexão.');
        setServerStatus('offline');
        setLoading(false);
        return;
      }

      setServerStatus('online');

      const query = `
        query {
          viewer {
            login
            repositories(first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
              nodes {
                name
                pullRequests(first: 100, states: OPEN) {
                  nodes {
                    number
                    title
                    url
                    createdAt
                    repository { nameWithOwner }
                    comments { totalCount }
                    reviews { totalCount }
                  }
                }
                issues(first: 100, states: OPEN) {
                  nodes {
                    number
                    title
                    url
                    createdAt
                    repository { nameWithOwner }
                    labels(first: 5) {
                      nodes { name }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch(`${API_BASE}/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-pin': pinRef.current,
        },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();

      if (response.status === 401) {
        sessionStorage.removeItem(PIN_STORAGE_KEY);
        setError('PIN inválido. Tente novamente.');
        setPinSubmitted(false);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(result.error || 'Erro ao conectar com o servidor');
        setLoading(false);
        return;
      }

      if (result.errors) {
        setError(result.errors[0]?.message || 'Erro na consulta do GitHub');
        setLoading(false);
        return;
      }

      const viewer = result.data?.viewer;
      if (!viewer) {
        setError('Não foi possível autenticar com o GitHub. Verifique o token no servidor.');
        setLoading(false);
        return;
      }

      let allPRs = [];
      let allIssues = [];

      viewer.repositories.nodes.forEach((repo) => {
        if (repo.pullRequests?.nodes) allPRs = allPRs.concat(repo.pullRequests.nodes);
        if (repo.issues?.nodes) allIssues = allIssues.concat(repo.issues.nodes);
      });

      setData({
        user: { login: viewer.login },
        openPRs: allPRs,
        openIssues: allIssues,
      });

      if (allPRs.length === 0 && allIssues.length === 0) {
        setNotice('Nenhuma PR ou Issue aberta. Tudo limpo!');
      }
    } catch (err) {
      setError(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pinSubmitted && !data) {
      fetchGitHubData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinSubmitted]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!pin.trim()) return;
    sessionStorage.setItem(PIN_STORAGE_KEY, pin.trim());
    setPinSubmitted(true);
  };

  const prRecommendations = useMemo(() => {
    if (!data?.openPRs?.length) return [];
    return data.openPRs
      .map((pr) => ({
        ...pr,
        score:
          (pr.comments?.totalCount || 0) * 0.3 +
          ((Date.now() - new Date(pr.createdAt)) / (1000 * 60 * 60 * 24)) * 0.5 +
          (pr.reviews?.totalCount || 0) * 0.2,
        daysOld: Math.floor((Date.now() - new Date(pr.createdAt)) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [data]);

  const issueRecommendations = useMemo(() => {
    if (!data?.openIssues?.length) return [];
    const priority = { critical: 5, blocker: 4, bug: 3, high: 3, medium: 2, low: 1 };

    return data.openIssues
      .map((issue) => {
        const labels = issue.labels?.nodes?.map((l) => l.name) || [];
        const priorityScore = Math.max(
          ...labels.map((l) => {
            const lower = l.toLowerCase();
            for (const key of Object.keys(priority)) {
              if (lower.includes(key)) return priority[key];
            }
            return 0;
          }),
          2
        );
        return {
          ...issue,
          priorityScore,
          labels,
          ageInDays: Math.floor((Date.now() - new Date(issue.createdAt)) / (1000 * 60 * 60 * 24)),
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore || b.ageInDays - a.ageInDays)
      .slice(0, 3);
  }, [data]);

  const stats = data
    ? [
        { label: 'PRs Abertas', value: data.openPRs.length, icon: GitBranch, color: 'text-blue-500' },
        { label: 'Issues Abertas', value: data.openIssues.length, icon: AlertCircle, color: 'text-yellow-500' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">GitHub Activity Dashboard</h1>
          <p className="text-slate-300">Acompanhe suas PRs, Issues e recomendações</p>
        </div>

        {!pinSubmitted && (
          <div className="max-w-md mx-auto bg-slate-800/50 border border-slate-700 rounded-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold">Acesso protegido</h2>
            </div>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 block mb-2">PIN de acesso</label>
                <input
                  type="password"
                  placeholder="Digite seu PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-3 text-white text-center text-lg tracking-widest"
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded p-3">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !pin.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-6 py-3 rounded font-semibold transition text-lg"
              >
                {loading ? 'Verificando...' : 'Entrar'}
              </button>
            </form>
          </div>
        )}

        {pinSubmitted && !data && (
          <div className="max-w-md mx-auto bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div
              className={`border rounded p-3 mb-4 ${
                serverStatus === 'online'
                  ? 'bg-green-900/30 border-green-700'
                  : serverStatus === 'offline'
                    ? 'bg-red-900/30 border-red-700'
                    : 'bg-slate-700/50 border-slate-600'
              }`}
            >
              <p className="text-sm">
                {serverStatus === 'online' && 'Servidor conectado.'}
                {serverStatus === 'offline' && 'Servidor não encontrado.'}
                {!serverStatus && 'Conectando...'}
              </p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded p-3 mb-4">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {loading && (
              <p className="text-slate-400 text-center">Carregando dados do GitHub...</p>
            )}
          </div>
        )}

        {data && (
          <>
            <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-slate-400">
                Logado como <span className="text-blue-400 font-semibold">{data.user.login}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem(PIN_STORAGE_KEY);
                  setData(null);
                  setError('');
                  setNotice('');
                  setServerStatus(null);
                  setActiveTab('overview');
                  setPinSubmitted(false);
                  setPin('');
                }}
                className="text-slate-400 hover:text-slate-200 text-sm px-3 py-1 hover:bg-slate-700 rounded"
              >
                Sair
              </button>
            </div>

            {notice && (
              <div className="mb-4 bg-emerald-900/30 border border-emerald-700 rounded p-3">
                <p className="text-emerald-200 text-sm">{notice}</p>
              </div>
            )}

            {stats.length > 0 && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm">{stat.label}</p>
                        <p className="text-3xl font-bold">{stat.value}</p>
                      </div>
                      <stat.icon className={`w-8 h-8 ${stat.color}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mb-6 border-b border-slate-700 flex-wrap">
              {['overview', 'prs', 'issues'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 font-semibold transition ${
                    activeTab === tab
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab === 'overview' && 'Visão geral'}
                  {tab === 'prs' && `PRs (${data.openPRs.length})`}
                  {tab === 'issues' && `Issues (${data.openIssues.length})`}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-xl font-bold">PRs em destaque</h2>
                  </div>
                  <div className="space-y-3">
                    {prRecommendations.length ? (
                      prRecommendations.map((pr) => (
                        <div key={pr.url} className="bg-slate-700/50 rounded p-3 hover:bg-slate-700 transition">
                          <p className="text-xs text-slate-500 mb-1">{pr.repository?.nameWithOwner}</p>
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 font-semibold"
                          >
                            #{pr.number}: {pr.title}
                          </a>
                          <p className="text-sm text-slate-400 mt-1">
                            {pr.daysOld} dias · {pr.comments?.totalCount || 0} comentários ·{' '}
                            {pr.reviews?.totalCount || 0} reviews
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400">Nenhuma PR aberta</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <h2 className="text-xl font-bold">Issues prioritárias</h2>
                  </div>
                  <div className="space-y-3">
                    {issueRecommendations.length ? (
                      issueRecommendations.map((issue) => (
                        <div key={issue.url} className="bg-slate-700/50 rounded p-3 hover:bg-slate-700 transition">
                          <p className="text-xs text-slate-500 mb-1">{issue.repository?.nameWithOwner}</p>
                          <a
                            href={issue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 font-semibold"
                          >
                            #{issue.number}: {issue.title}
                          </a>
                          {issue.labels.length > 0 && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {issue.labels.map((label, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 rounded bg-slate-600">
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-sm text-slate-400 mt-2">{issue.ageInDays} dias</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400">Nenhuma issue aberta</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prs' && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">PRs abertas ({data.openPRs.length})</h2>
                {data.openPRs.length ? (
                  <div className="space-y-2">
                    {data.openPRs.map((pr) => (
                      <div
                        key={pr.url}
                        className="flex justify-between items-start gap-3 p-3 bg-slate-700/50 rounded hover:bg-slate-700 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-500">{pr.repository?.nameWithOwner}</p>
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 font-semibold break-words"
                          >
                            #{pr.number}: {pr.title}
                          </a>
                        </div>
                        <span className="text-sm text-slate-400 shrink-0">{pr.comments?.totalCount || 0}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400">Nenhuma PR aberta</p>
                )}
              </div>
            )}

            {activeTab === 'issues' && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Issues abertas ({data.openIssues.length})</h2>
                {data.openIssues.length ? (
                  <div className="space-y-2">
                    {data.openIssues.map((issue) => (
                      <div key={issue.url} className="p-3 bg-slate-700/50 rounded hover:bg-slate-700 transition">
                        <p className="text-xs text-slate-500 mb-1">{issue.repository?.nameWithOwner}</p>
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          #{issue.number}: {issue.title}
                        </a>
                        {issue.labels?.nodes && issue.labels.nodes.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {issue.labels.nodes.map((label, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 rounded bg-slate-600">
                                {label.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400">Nenhuma issue aberta</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

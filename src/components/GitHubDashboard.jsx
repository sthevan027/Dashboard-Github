import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, GitBranch, Lock, Zap,
  MessageSquare, ExternalLink, RefreshCw, Clock,
  ChevronDown, ChevronUp, User, BookOpen, CheckCircle,
  GitPullRequest, Delete, Check,
} from 'lucide-react';

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

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `há ${days}d`;
  if (hours > 0) return `há ${hours}h`;
  if (minutes > 0) return `há ${minutes}min`;
  return 'agora';
}

function getLabelStyle(labelName) {
  const lower = labelName.toLowerCase();
  if (/critical|blocker/.test(lower))   return { bg: '#3d1a1a', text: '#f85149', border: '#6e2b2b' };
  if (/bug|error|crash/.test(lower))    return { bg: '#2d1f0e', text: '#d29922', border: '#5a3e10' };
  if (/high/.test(lower))               return { bg: '#2d1f0e', text: '#d29922', border: '#5a3e10' };
  if (/medium/.test(lower))             return { bg: '#1f2d1a', text: '#3fb950', border: '#2a5c2a' };
  if (/low/.test(lower))                return { bg: '#1a1f2d', text: '#79c0ff', border: '#1f3a6e' };
  if (/feature|enhancement/.test(lower))return { bg: '#1e1b3a', text: '#a371f7', border: '#3d2a6e' };
  return { bg: '#21262d', text: '#8b949e', border: '#30363d' };
}

function getIssueBorderColor(labels) {
  const joined = labels.map((l) => l.toLowerCase()).join(' ');
  if (/critical|blocker/.test(joined)) return '#f85149';
  if (/bug|error|crash/.test(joined))  return '#d29922';
  if (/high/.test(joined))             return '#d29922';
  if (/medium/.test(joined))           return '#3fb950';
  if (/low/.test(joined))              return '#79c0ff';
  return '#30363d';
}

function Label({ name }) {
  const s = getLabelStyle(name);
  return (
    <span
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
      className="text-xs px-2 py-0.5 rounded-full font-medium"
    >
      {name}
    </span>
  );
}

function CommentSection({ comments, url, expandedComments, toggleComments }) {
  if (!comments) return null;
  const isOpen = expandedComments.has(url);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => toggleComments(url)}
        className="flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: '#8b949e' }}
        onMouseEnter={e => e.currentTarget.style.color = '#58a6ff'}
        onMouseLeave={e => e.currentTarget.style.color = '#8b949e'}
      >
        <MessageSquare className="w-3 h-3" />
        {comments.totalCount} {comments.totalCount === 1 ? 'comentário' : 'comentários'}
        {comments.totalCount > 0 && (
          isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {isOpen && comments.nodes?.length > 0 && (
        <div className="mt-2 space-y-3 pl-3" style={{ borderLeft: '2px solid #30363d' }}>
          {comments.nodes.map((comment, idx) => (
            <div key={idx}>
              <div className="flex items-center gap-1.5 text-xs mb-0.5" style={{ color: '#8b949e' }}>
                <User className="w-3 h-3" />
                <span style={{ color: '#e6edf3' }} className="font-medium">{comment.author?.login ?? 'ghost'}</span>
                <span>·</span>
                <span>{relativeTime(comment.createdAt)}</span>
              </div>
              <p className="text-xs leading-relaxed line-clamp-3" style={{ color: '#c9d1d9' }}>
                {comment.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {isOpen && comments.nodes?.length === 0 && (
        <p className="mt-2 pl-3 text-xs" style={{ color: '#8b949e', borderLeft: '2px solid #30363d' }}>
          Nenhum comentário ainda.
        </p>
      )}
    </div>
  );
}

function PRCard({ pr, expandedComments, toggleComments }) {
  const daysOld = Math.floor((Date.now() - new Date(pr.createdAt)) / (1000 * 60 * 60 * 24));
  return (
    <div
      className="rounded-md p-3 transition-colors"
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderLeft: '3px solid #3fb950',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#388bfd #388bfd #388bfd #3fb950'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#30363d #30363d #30363d #3fb950'}
    >
      <p className="text-xs mb-1 font-mono" style={{ color: '#8b949e' }}>
        {pr.repository?.nameWithOwner}
      </p>
      <a
        href={pr.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-1 font-semibold text-sm group"
        style={{ color: '#58a6ff' }}
        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
      >
        <span className="flex-1">#{pr.number}: {pr.title}</span>
        <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
      </a>
      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: '#8b949e' }}>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{daysOld}d</span>
        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{pr.comments?.totalCount ?? 0}</span>
        <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{pr.reviews?.totalCount ?? 0} reviews</span>
      </div>
      <CommentSection comments={pr.comments} url={pr.url} expandedComments={expandedComments} toggleComments={toggleComments} />
    </div>
  );
}

function IssueCard({ issue, labels, ageInDays, expandedComments, toggleComments }) {
  const borderColor = getIssueBorderColor(labels);
  return (
    <div
      className="rounded-md p-3 transition-colors"
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderLeft: `3px solid ${borderColor}`,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = `#388bfd #388bfd #388bfd ${borderColor}`}
      onMouseLeave={e => e.currentTarget.style.borderColor = `#30363d #30363d #30363d ${borderColor}`}
    >
      <p className="text-xs mb-1 font-mono" style={{ color: '#8b949e' }}>
        {issue.repository?.nameWithOwner}
      </p>
      <a
        href={issue.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-1 font-semibold text-sm group"
        style={{ color: '#58a6ff' }}
        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
      >
        <span className="flex-1 break-words">#{issue.number}: {issue.title}</span>
        <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
      </a>
      {labels.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {labels.map((label, idx) => <Label key={idx} name={label} />)}
        </div>
      )}
      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: '#8b949e' }}>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ageInDays}d</span>
        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{issue.comments?.totalCount ?? 0}</span>
      </div>
      <CommentSection comments={issue.comments} url={issue.url} expandedComments={expandedComments} toggleComments={toggleComments} />
    </div>
  );
}

export default function GitHubDashboard() {
  const [pin, setPin] = useState('');
  const [pinSubmitted, setPinSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [serverStatus, setServerStatus] = useState(null);
  const [expandedComments, setExpandedComments] = useState(new Set());

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

  const toggleComments = (url) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const checkServer = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      return response.ok;
    } catch {
      return false;
    }
  };

  const fetchGitHubData = async () => {
    if (!pin) { setError('Informe o PIN para acessar o dashboard'); return; }
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
                    number title url createdAt
                    repository { nameWithOwner }
                    comments(last: 3) {
                      totalCount
                      nodes { body author { login } createdAt }
                    }
                    reviews { totalCount }
                  }
                }
                issues(first: 100, states: OPEN) {
                  nodes {
                    number title url createdAt
                    repository { nameWithOwner }
                    labels(first: 5) { nodes { name } }
                    comments(last: 3) {
                      totalCount
                      nodes { body author { login } createdAt }
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
        headers: { 'Content-Type': 'application/json', 'x-app-pin': pinRef.current },
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
      if (!response.ok) { setError(result.error || 'Erro ao conectar com o servidor'); setLoading(false); return; }
      if (result.errors) { setError(result.errors[0]?.message || 'Erro na consulta do GitHub'); setLoading(false); return; }

      const viewer = result.data?.viewer;
      if (!viewer) { setError('Não foi possível autenticar com o GitHub. Verifique o token no servidor.'); setLoading(false); return; }

      let allPRs = [];
      let allIssues = [];
      viewer.repositories.nodes.forEach((repo) => {
        if (repo.pullRequests?.nodes) allPRs = allPRs.concat(repo.pullRequests.nodes);
        if (repo.issues?.nodes) allIssues = allIssues.concat(repo.issues.nodes);
      });

      const activeRepos = new Set([
        ...allPRs.map((pr) => pr.repository?.nameWithOwner),
        ...allIssues.map((issue) => issue.repository?.nameWithOwner),
      ]).size;

      setData({ user: { login: viewer.login }, openPRs: allPRs, openIssues: allIssues, activeRepos });
      setPinSubmitted(true);
      if (allPRs.length === 0 && allIssues.length === 0) setNotice('Nenhuma PR ou Issue aberta. Tudo limpo!');
    } catch (err) {
      setError(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pinSubmitted && !data) fetchGitHubData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinSubmitted]);

  const handlePinSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!pin.trim()) return;
    sessionStorage.setItem(PIN_STORAGE_KEY, pin.trim());
    void fetchGitHubData();
  };

  const handleDigit = (d) => {
    setPin(prev => prev.length < 6 ? prev + d : prev);
  };

  const handleBackspace = () => setPin(prev => prev.slice(0, -1));

  const handleLogout = () => {
    sessionStorage.removeItem(PIN_STORAGE_KEY);
    setData(null); setError(''); setNotice(''); setServerStatus(null);
    setActiveTab('overview'); setPinSubmitted(false); setPin('');
    setExpandedComments(new Set());
  };

  const handleRefresh = () => {
    setData(null);
    setExpandedComments(new Set());
    fetchGitHubData();
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
            for (const key of Object.keys(priority)) if (lower.includes(key)) return priority[key];
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

  // ─── GitHub color tokens ───────────────────────────────────────────────────
  const gh = {
    bg:       '#0d1117',
    surface:  '#161b22',
    border:   '#30363d',
    text:     '#e6edf3',
    muted:    '#8b949e',
    link:     '#58a6ff',
    green:    '#3fb950',
    red:      '#f85149',
    yellow:   '#d29922',
  };

  return (
    <div className="min-h-screen" style={{ background: gh.bg, color: gh.text }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: `1px solid ${gh.border}` }}>
          <div className="flex items-center gap-2">
            <svg height="24" width="24" viewBox="0 0 16 16" fill={gh.text} aria-hidden="true">
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
            </svg>
            <span className="font-semibold text-lg" style={{ color: gh.text }}>GitHub Activity</span>
          </div>

          {data && (
            <div className="flex items-center gap-2">
              <span className="text-sm hidden sm:block" style={{ color: gh.muted }}>
                <span style={{ color: gh.link }}>{data.user.login}</span>
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                title="Atualizar"
                className="p-1.5 rounded-md transition-colors disabled:opacity-50"
                style={{ color: gh.muted, border: `1px solid ${gh.border}` }}
                onMouseEnter={e => { e.currentTarget.style.background = '#21262d'; e.currentTarget.style.color = gh.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = gh.muted; }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm px-3 py-1 rounded-md transition-colors"
                style={{ color: gh.muted, border: `1px solid ${gh.border}` }}
                onMouseEnter={e => { e.currentTarget.style.background = '#21262d'; e.currentTarget.style.color = gh.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = gh.muted; }}
              >
                Sair
              </button>
            </div>
          )}
        </div>

        {/* Tela de login */}
        {!pinSubmitted && (() => {
          const totalDots = 6;
          const keypadRows = [
            ['1','2','3'],
            ['4','5','6'],
            ['7','8','9'],
          ];
          return (
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 96px)' }}>
              <div className="w-full max-w-xs px-4 flex flex-col items-center gap-6">

                {/* Ícone + título */}
                <div className="text-center">
                  <div
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                    style={{ background: '#161b22', border: `1px solid ${gh.border}` }}
                  >
                    <Lock className="w-7 h-7" style={{ color: gh.muted }} />
                  </div>
                  <h2 className="font-bold text-xl" style={{ color: gh.text }}>Acesso protegido</h2>
                  <p className="text-sm mt-1" style={{ color: gh.muted }}>Insira o PIN para continuar</p>
                </div>

                {/* Dots de PIN */}
                <div className="flex items-center gap-3">
                  {Array.from({ length: totalDots }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all duration-150"
                      style={{
                        width: 14,
                        height: 14,
                        background: i < pin.length ? gh.text : 'transparent',
                        border: `2px solid ${i < pin.length ? gh.text : gh.muted}`,
                        transform: i === pin.length - 1 ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>

                {/* Erro */}
                {error && (
                  <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: '#3d1a1a', border: '1px solid #6e2b2b', color: '#f85149' }}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Keypad */}
                <div className="flex flex-col items-center gap-3 w-full">
                  {keypadRows.map((row, ri) => (
                    <div key={ri} className="flex gap-3">
                      {row.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleDigit(d)}
                          className="flex items-center justify-center rounded-2xl text-xl font-semibold select-none transition-all duration-100 active:scale-90"
                          style={{
                            width: 80, height: 60,
                            background: gh.surface,
                            border: `1px solid ${gh.border}`,
                            color: gh.text,
                          }}
                          onPointerDown={e => { e.currentTarget.style.background = '#21262d'; }}
                          onPointerUp={e => { e.currentTarget.style.background = gh.surface; }}
                          onPointerLeave={e => { e.currentTarget.style.background = gh.surface; }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  ))}

                  {/* Última linha: backspace, 0, enter */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleBackspace}
                      disabled={pin.length === 0}
                      className="flex items-center justify-center rounded-2xl transition-all duration-100 active:scale-90 disabled:opacity-30"
                      style={{
                        width: 80, height: 60,
                        background: gh.surface,
                        border: `1px solid ${gh.border}`,
                        color: gh.muted,
                      }}
                      onPointerDown={e => { if (pin.length) e.currentTarget.style.background = '#21262d'; }}
                      onPointerUp={e => { e.currentTarget.style.background = gh.surface; }}
                      onPointerLeave={e => { e.currentTarget.style.background = gh.surface; }}
                    >
                      <Delete className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDigit('0')}
                      className="flex items-center justify-center rounded-2xl text-xl font-semibold select-none transition-all duration-100 active:scale-90"
                      style={{
                        width: 80, height: 60,
                        background: gh.surface,
                        border: `1px solid ${gh.border}`,
                        color: gh.text,
                      }}
                      onPointerDown={e => { e.currentTarget.style.background = '#21262d'; }}
                      onPointerUp={e => { e.currentTarget.style.background = gh.surface; }}
                      onPointerLeave={e => { e.currentTarget.style.background = gh.surface; }}
                    >
                      0
                    </button>

                    <button
                      type="button"
                      onClick={handlePinSubmit}
                      disabled={pin.length === 0}
                      className="flex items-center justify-center rounded-2xl transition-all duration-100 active:scale-90 disabled:opacity-30"
                      style={{
                        width: 80, height: 60,
                        background: pin.length > 0 ? '#238636' : gh.surface,
                        border: `1px solid ${pin.length > 0 ? '#2ea043' : gh.border}`,
                        color: '#fff',
                      }}
                      onPointerDown={e => { if (pin.length) e.currentTarget.style.background = '#2ea043'; }}
                      onPointerUp={e => { e.currentTarget.style.background = pin.length > 0 ? '#238636' : gh.surface; }}
                      onPointerLeave={e => { e.currentTarget.style.background = pin.length > 0 ? '#238636' : gh.surface; }}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* Conectando */}
        {pinSubmitted && !data && (
          <div className="max-w-sm mx-auto mt-8">
            <div className="rounded-md p-4 text-sm space-y-3" style={{ background: gh.surface, border: `1px solid ${gh.border}` }}>
              <div className="flex items-center gap-2" style={{ color: gh.muted }}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  serverStatus === 'online' ? 'bg-green-500' :
                  serverStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
                }`} />
                {serverStatus === 'online' && 'Servidor conectado. Buscando dados...'}
                {serverStatus === 'offline' && 'Servidor não encontrado.'}
                {!serverStatus && 'Conectando...'}
              </div>
              {error && <p style={{ color: gh.red }}>{error}</p>}
              {loading && (
                <div className="space-y-2 mt-2">
                  {[1, 2].map(i => (
                    <div key={i} className="rounded animate-pulse h-8" style={{ background: '#21262d' }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dashboard */}
        {data && (
          <>
            {notice && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm mb-4" style={{ background: '#1f2d1a', border: '1px solid #2a5c2a', color: gh.green }}>
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {notice}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'PRs abertas',    value: data.openPRs.length,    icon: GitPullRequest, color: gh.green  },
                { label: 'Issues abertas', value: data.openIssues.length,  icon: AlertCircle,   color: gh.yellow },
                { label: 'Repos ativos',   value: data.activeRepos,        icon: BookOpen,      color: gh.link   },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md p-4"
                  style={{ background: gh.surface, border: `1px solid ${gh.border}` }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs mb-1" style={{ color: gh.muted }}>{stat.label}</p>
                      <p className="text-2xl font-bold" style={{ color: gh.text }}>{stat.value}</p>
                    </div>
                    <stat.icon className="w-6 h-6 opacity-70" style={{ color: stat.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs — estilo GitHub */}
            <div className="flex mb-4" style={{ borderBottom: `1px solid ${gh.border}` }}>
              {[
                { key: 'overview', label: 'Visão geral', count: null },
                { key: 'prs',      label: 'PRs',         count: data.openPRs.length },
                { key: 'issues',   label: 'Issues',      count: data.openIssues.length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    color: activeTab === tab.key ? gh.text : gh.muted,
                    borderBottom: activeTab === tab.key ? `2px solid #f78166` : '2px solid transparent',
                    marginBottom: '-1px',
                  }}
                >
                  {tab.label}
                  {tab.count !== null && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: activeTab === tab.key ? '#30363d' : '#21262d',
                        color: gh.muted,
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Visão geral — 2 colunas */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4" style={{ color: gh.yellow }} />
                    <h2 className="text-sm font-semibold" style={{ color: gh.text }}>PRs em destaque</h2>
                  </div>
                  <div className="space-y-2">
                    {prRecommendations.length ? (
                      prRecommendations.map((pr) => (
                        <PRCard key={pr.url} pr={pr} expandedComments={expandedComments} toggleComments={toggleComments} />
                      ))
                    ) : (
                      <div className="text-center py-8" style={{ color: gh.muted }}>
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" style={{ color: gh.green }} />
                        <p className="text-sm">Nenhuma PR aberta</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4" style={{ color: gh.red }} />
                    <h2 className="text-sm font-semibold" style={{ color: gh.text }}>Issues prioritárias</h2>
                  </div>
                  <div className="space-y-2">
                    {issueRecommendations.length ? (
                      issueRecommendations.map((issue) => (
                        <IssueCard
                          key={issue.url}
                          issue={issue}
                          labels={issue.labels}
                          ageInDays={issue.ageInDays}
                          expandedComments={expandedComments}
                          toggleComments={toggleComments}
                        />
                      ))
                    ) : (
                      <div className="text-center py-8" style={{ color: gh.muted }}>
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" style={{ color: gh.green }} />
                        <p className="text-sm">Nenhuma issue aberta</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PRs */}
            {activeTab === 'prs' && (
              <div>
                <p className="text-sm mb-3" style={{ color: gh.muted }}>
                  {data.openPRs.length} pull request{data.openPRs.length !== 1 ? 's' : ''} aberta{data.openPRs.length !== 1 ? 's' : ''}
                </p>
                {data.openPRs.length ? (
                  <div className="space-y-2">
                    {data.openPRs.map((pr) => (
                      <PRCard key={pr.url} pr={pr} expandedComments={expandedComments} toggleComments={toggleComments} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12" style={{ color: gh.muted }}>
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-40" style={{ color: gh.green }} />
                    <p className="text-sm font-medium">Nenhuma PR aberta</p>
                  </div>
                )}
              </div>
            )}

            {/* Issues */}
            {activeTab === 'issues' && (
              <div>
                <p className="text-sm mb-3" style={{ color: gh.muted }}>
                  {data.openIssues.length} issue{data.openIssues.length !== 1 ? 's' : ''} aberta{data.openIssues.length !== 1 ? 's' : ''}
                </p>
                {data.openIssues.length ? (
                  <div className="space-y-2">
                    {data.openIssues.map((issue) => {
                      const labels = issue.labels?.nodes?.map((l) => l.name) || [];
                      const ageInDays = Math.floor((Date.now() - new Date(issue.createdAt)) / (1000 * 60 * 60 * 24));
                      return (
                        <IssueCard
                          key={issue.url}
                          issue={issue}
                          labels={labels}
                          ageInDays={ageInDays}
                          expandedComments={expandedComments}
                          toggleComments={toggleComments}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12" style={{ color: gh.muted }}>
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-40" style={{ color: gh.green }} />
                    <p className="text-sm font-medium">Nenhuma issue aberta</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

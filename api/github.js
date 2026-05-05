function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
}

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 30;

/** @type {Map<string, { count: number; resetAt: number }>} */
const rateLimitStore = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (realIp) return String(realIp).trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

function checkRateLimit(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) return true;
  return false;
}

function parseBody(req) {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

const ALLOWED_METHODS = ['POST', 'OPTIONS'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-pin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end();
    return;
  }

  if (!ALLOWED_METHODS.includes(req.method)) {
    sendJson(res, 405, { error: 'Método não permitido' });
    return;
  }

  if (checkRateLimit(req)) {
    sendJson(res, 429, { error: 'Rate limit excedido. Tente novamente em instantes.' });
    return;
  }

  const { GITHUB_TOKEN, APP_PIN } = process.env;

  if (!GITHUB_TOKEN) {
    sendJson(res, 500, { error: 'Servidor mal configurado: GITHUB_TOKEN ausente' });
    return;
  }

  if (!APP_PIN) {
    sendJson(res, 500, { error: 'Servidor mal configurado: APP_PIN ausente' });
    return;
  }

  const clientPin = req.headers['x-app-pin'];

  if (!clientPin || clientPin !== APP_PIN) {
    sendJson(res, 401, { error: 'PIN inválido' });
    return;
  }

  const body = parseBody(req);
  const { query } = body;

  if (!query) {
    sendJson(res, 400, { error: 'Campo "query" é obrigatório' });
    return;
  }

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Dashboard-Server',
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    if (!response.ok) {
      sendJson(res, response.status, data);
      return;
    }

    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

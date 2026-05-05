import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'GitHub Dashboard Server rodando!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'GitHub Dashboard Server rodando!' });
});

app.post('/api/github', async (req, res) => {
  const { GITHUB_TOKEN, APP_PIN } = process.env;

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN não configurado no .env' });
  }

  if (!APP_PIN) {
    return res.status(500).json({ error: 'APP_PIN não configurado no .env' });
  }

  const clientPin = req.headers['x-app-pin'];

  if (!clientPin || clientPin !== APP_PIN) {
    return res.status(401).json({ error: 'PIN inválido' });
  }

  const { query } = req.body ?? {};

  if (!query) {
    return res.status(400).json({ error: 'Campo "query" é obrigatório' });
  }

  try {
    console.log('📡 Requisição GraphQL recebida...');

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
      console.error('❌ Erro GitHub:', response.status);
      return res.status(response.status).json(data);
    }

    console.log('✅ Dados recebidos com sucesso!');
    return res.json(data);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   ✅ GitHub Dashboard Server Rodando!    ║');
  console.log(`║   🌐 http://localhost:${PORT}            ║`);
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n👋 Servidor encerrado');
  process.exit(0);
});

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '✅ Servidor GitHub Dashboard rodando!' });
});

app.post('/api/github', async (req, res) => {
  const { token, query } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token é obrigatório' });
  }

  try {
    console.log('📡 Requisição GraphQL recebida...');

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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
    res.json(data);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    res.status(500).json({
      error: error.message,
      details: 'Verifique o token do GitHub',
    });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   ✅ GitHub Dashboard Server Rodando!    ║');
  console.log(`║   🌐 http://localhost:${PORT}            ║`);
  console.log('║   📊 Dashboard pronto para conectar        ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n👋 Servidor encerrado');
  process.exit(0);
});

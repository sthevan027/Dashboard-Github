import express from 'express';
import cors from 'cors';
import { githubGraphqlProxy } from './lib/github-proxy.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: '✅ Servidor GitHub Dashboard rodando!',
  });
});

app.post('/api/github', async (req, res) => {
  const { token, query } = req.body;
  const { status, body } = await githubGraphqlProxy({ token, query });
  res.status(status).json(body);
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

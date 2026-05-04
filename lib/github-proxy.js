/**
 * Proxy GraphQL GitHub — usado pelo Express (dev) e pelas Serverless Functions (Vercel).
 */
export async function githubGraphqlProxy({ token, query }) {
  if (!token) {
    return { status: 400, body: { error: 'Token é obrigatório' } };
  }

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Dashboard-Server',
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { status: response.status, body: data };
    }

    return { status: 200, body: data };
  } catch (error) {
    return {
      status: 500,
      body: {
        error: error.message,
        details: 'Verifique o token do GitHub',
      },
    };
  }
}

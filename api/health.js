function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
}

export default function handler(req, res) {
  sendJson(res, 200, { status: 'OK', message: 'GitHub Dashboard rodando!' });
}

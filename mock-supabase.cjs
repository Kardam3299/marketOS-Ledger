const http = require('http');

let remoteTxs = [
  {
    id: 'mock-1',
    date: '2026-08-01',
    type: 'income',
    category: 'Sales',
    amount: 5000,
    payment_mode: 'Cash',
    description: 'Remote mock transaction',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/rest/v1/transactions') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(remoteTxs));
    }
    
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        const item = JSON.parse(body);
        const existingIndex = remoteTxs.findIndex(t => t.id === item.id);
        if (existingIndex !== -1) {
          remoteTxs[existingIndex] = item;
        } else {
          remoteTxs.push(item);
        }
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(item));
      });
      return;
    }

    if (req.method === 'DELETE') {
      const idStr = url.searchParams.get('id');
      if (idStr && idStr.startsWith('eq.')) {
        const id = idStr.slice(3);
        remoteTxs = remoteTxs.filter(t => t.id !== id);
        res.writeHead(200);
        return res.end();
      } else {
        res.writeHead(400);
        return res.end('Invalid query');
      }
    }

    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Range-Unit': 'items',
        'Content-Range': '0-0/1'
      });
      return res.end();
    }
  }

  res.writeHead(404);
  res.end();
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Mock Supabase running on port ${PORT}`);
});

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');
const ROOT_BENCH  = '/Users/levnach/dev/msagljs/examples/chrome-routing-bench';
const ROOT_GRAPHS = '/Users/levnach/dev/paper_msagljs/graphs';
const LOG_FILES = {
  '/log':     '/tmp/chrome_bench_results.log',
  '/loadlog': '/tmp/chrome_load_results.log',
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.csv':  'text/csv; charset=utf-8',
  '.mtx':  'text/plain; charset=utf-8',
};
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && LOG_FILES[req.url]) {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      fs.appendFileSync(LOG_FILES[req.url], '[' + new Date().toISOString() + '] ' + body + '\n');
      res.writeHead(200, {'Access-Control-Allow-Origin': '*'});
      res.end('ok');
    });
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }
  const u = url.parse(req.url);
  let p = decodeURIComponent(u.pathname);
  let abs;
  if (p.startsWith('/graphs/')) {
    abs = path.join(ROOT_GRAPHS, p.slice('/graphs/'.length));
  } else {
    if (p === '/') p = '/index.html';
    abs = path.join(ROOT_BENCH, p);
  }
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) { res.statusCode = 404; res.end('not found: ' + p); return; }
    const ct = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': ct, 'Content-Length': st.size, 'Access-Control-Allow-Origin': '*'});
    fs.createReadStream(abs).pipe(res);
  });
});
const PORT = 8765;
server.listen(PORT, '127.0.0.1', () => console.log('listening http://127.0.0.1:' + PORT));

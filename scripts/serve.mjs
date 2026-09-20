import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const PORT = 3000;
const HOST = '0.0.0.0';
const ROOT = process.cwd();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);

  // Route API pour déclencher la synchronisation
  if (reqPath === '/api/sync') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    exec('node scripts/sync.mjs', (error, stdout, stderr) => {
      if (error) {
        console.error(`Erreur sync: ${error.message}`);
        res.end(JSON.stringify({ success: false, error: error.message }));
        return;
      }
      console.log('Synchronisation terminée (déclenchée via API).');
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const fullPath = path.join(ROOT, reqPath);

  // Empêcher les traversées de répertoire
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' || ext === '.js' || fullPath.endsWith('sw.js') ? 'no-cache' : 'no-store'
    };

    if (fullPath.endsWith('sw.js')) {
      headers['Service-Worker-Allowed'] = '/';
    }

    res.writeHead(200, headers);

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n🏉 Serveur démarré sur : http://${HOST}:${PORT}`);
  console.log(`Appuyez sur Ctrl+C pour arrêter le serveur.\n`);
});


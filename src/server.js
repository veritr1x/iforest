import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { applyCommand, createGame, getEvidenceSummary } from './gameEngine.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicRoot = join(projectRoot, 'public');
const evidenceRoot = join(projectRoot, 'evidence');
const sessions = new Map();

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pqa': 'application/octet-stream',
  '.wbmp': 'image/vnd.wap.wbmp',
  '.wml': 'text/vnd.wap.wml; charset=utf-8'
};

export function createServer() {
  return createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');

      if (request.method === 'GET' && url.pathname === '/api/evidence') {
        return sendJson(response, getEvidenceSummary());
      }

      if (request.method === 'POST' && url.pathname === '/api/new') {
        const body = await readJson(request);
        const id = randomUUID();
        const game = createGame({ name: body.name });
        sessions.set(id, game);
        return sendJson(response, { id, game });
      }

      if (request.method === 'GET' && url.pathname === '/api/state') {
        const game = sessions.get(url.searchParams.get('id'));
        return game ? sendJson(response, { game }) : sendJson(response, { error: 'Unknown session' }, 404);
      }

      if (request.method === 'POST' && url.pathname === '/api/command') {
        const body = await readJson(request);
        const current = sessions.get(body.id);
        if (!current) {
          return sendJson(response, { error: 'Unknown session' }, 404);
        }
        const game = applyCommand(current, body.command || {});
        sessions.set(body.id, game);
        return sendJson(response, { game });
      }

      return serveStatic(url.pathname, response);
    } catch (error) {
      console.error(error);
      return sendJson(response, { error: 'Internal server error' }, 500);
    }
  });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function serveStatic(pathname, response) {
  const root = pathname.startsWith('/evidence/') ? projectRoot : publicRoot;
  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, '');
  const filePath = resolve(root, `.${safePath}`);
  const allowedRoot = pathname.startsWith('/evidence/') ? evidenceRoot : publicRoot;

  if (!filePath.startsWith(allowedRoot) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3333);
  createServer().listen(port, () => {
    console.log(`iForest reconstruction listening on http://localhost:${port}`);
  });
}

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { applyCommand, createGame } from './gameEngine.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicRoot = join(projectRoot, 'public');
const evidenceRoot = join(projectRoot, 'evidence');

const MAX_BODY_BYTES = 16 * 1024;
const SESSION_TTL_MS = 1000 * 60 * 60; // drop sessions idle for an hour
const MAX_SESSIONS = 500;
const sessions = new Map(); // id -> { game, touched }

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

      if (request.method === 'GET' && url.pathname === '/api/health') {
        return sendJson(response, { ok: true });
      }

      if (request.method === 'POST' && url.pathname === '/api/new') {
        const body = await readJson(request);
        sweepSessions();
        const id = randomUUID();
        const game = createGame({
          name: body.name,
          gender: body.gender,
          face: body.face,
          login: true
        });
        putSession(id, game);
        return sendJson(response, { id, game });
      }

      if (request.method === 'GET' && url.pathname === '/api/state') {
        const game = getSession(url.searchParams.get('id'));
        return game ? sendJson(response, { game }) : sendJson(response, { error: 'Unknown session' }, 404);
      }

      if (request.method === 'POST' && url.pathname === '/api/command') {
        const body = await readJson(request);
        const current = getSession(body.id);
        if (!current) {
          return sendJson(response, { error: 'Unknown session' }, 404);
        }
        const game = applyCommand(current, body.command || {});
        putSession(body.id, game);
        return sendJson(response, { game });
      }

      if (request.method === 'GET' && url.pathname === '/engine/gameData.js') {
        return serveStaticFile(join(projectRoot, 'src', 'gameData.js'), response);
      }
      if (request.method === 'GET' && url.pathname === '/engine/gameEngine.js') {
        return serveStaticFile(join(projectRoot, 'src', 'gameEngine.js'), response);
      }
      return serveStatic(url.pathname, response);
    } catch (error) {
      const status = error?.statusCode || 500;
      if (status >= 500) {
        console.error(error);
      }
      const message =
        status === 413 ? 'Payload too large' : status === 400 ? 'Bad request' : 'Internal server error';
      return sendJson(response, { error: message }, status);
    }
  });
}

function putSession(id, game) {
  sessions.set(id, { game, touched: Date.now() });
}

function getSession(id) {
  if (!id) {
    return null;
  }
  const entry = sessions.get(id);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.touched > SESSION_TTL_MS) {
    sessions.delete(id);
    return null;
  }
  entry.touched = Date.now();
  return entry.game;
}

function sweepSessions() {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.touched > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
  if (sessions.size >= MAX_SESSIONS) {
    // Evict the least-recently-touched sessions to stay under the cap.
    const ordered = [...sessions.entries()].sort((a, b) => a[1].touched - b[1].touched);
    const excess = sessions.size - MAX_SESSIONS + 1;
    for (let i = 0; i < excess; i += 1) {
      sessions.delete(ordered[i][0]);
    }
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (_) {
    const error = new Error('Invalid JSON body');
    error.statusCode = 400;
    throw error;
  }
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

  if (!isWithin(filePath, allowedRoot) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
}

function isWithin(filePath, root) {
  return filePath === root || filePath.startsWith(root + sep);
}

function serveStaticFile(filePath, response) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
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

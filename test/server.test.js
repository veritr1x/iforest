import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { createServer } from '../src/server.js';
import { FACES } from '../src/gameData.js';

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
});

describe('iForest server', () => {
  it('starts a session and forwards gender and face to the engine', async () => {
    const face = FACES.female[0];
    const response = await fetch(`${base}/api/new`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', gender: 'female', face })
    });
    assert.equal(response.status, 200);
    const { id, game } = await response.json();
    assert.ok(id);
    assert.equal(game.player.gender, 'female');
    assert.equal(game.player.face, face);
  });

  it('returns 404 for commands on an unknown session', async () => {
    const response = await fetch(`${base}/api/command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'does-not-exist', command: { verb: 'look' } })
    });
    assert.equal(response.status, 404);
  });

  it('returns 404 for state on an unknown session', async () => {
    const response = await fetch(`${base}/api/state?id=nope`);
    assert.equal(response.status, 404);
  });

  it('rejects oversized request bodies with 413', async () => {
    const huge = JSON.stringify({ name: 'x'.repeat(20 * 1024) });
    const response = await fetch(`${base}/api/new`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: huge
    });
    assert.equal(response.status, 413);
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await fetch(`${base}/api/new`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json'
    });
    assert.equal(response.status, 400);
  });

  it('blocks path traversal out of the evidence root', async () => {
    const response = await fetch(`${base}/evidence/../package.json`);
    assert.equal(response.status, 404);
  });

  it('serves a real evidence file', async () => {
    const response = await fetch(`${base}/evidence/commoncrawl/manifest.json`);
    assert.equal(response.status, 200);
  });
});

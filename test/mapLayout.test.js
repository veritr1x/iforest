import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeMapLayout } from '../public/mapLayout.js';
import { rooms } from '../src/gameData.js';

describe('computeMapLayout', () => {
  it('places the start room at the origin', () => {
    const { positions } = computeMapLayout(rooms, 'forestown-square');
    assert.deepEqual(positions.get('forestown-square'), { x: 0, y: 0 });
  });

  it('places a north exit one cell above the parent', () => {
    const { positions } = computeMapLayout(rooms, 'forestown-square');
    // forestown-square.exits.north === 'northern-path'
    assert.deepEqual(positions.get('northern-path'), { x: 0, y: -1 });
  });

  it('places a south exit one cell below, east one right, west one left', () => {
    const { positions } = computeMapLayout(rooms, 'forestown-square');
    // exits: south -> customer-services, east -> forest-edge, west -> lost-property
    assert.deepEqual(positions.get('customer-services'), { x: 0, y: 1 });
    assert.deepEqual(positions.get('forest-edge'), { x: 1, y: 0 });
    assert.deepEqual(positions.get('lost-property'), { x: -1, y: 0 });
  });

  it('keeps first-placement-wins on BFS collisions', () => {
    // A loop in the graph must not overwrite an earlier placement.
    const { positions } = computeMapLayout(rooms, 'forestown-square');
    const seen = new Map();
    for (const [id, { x, y }] of positions) {
      const key = `${x},${y}`;
      assert.ok(!seen.has(key), `two rooms share cell ${key}: ${seen.get(key)} and ${id}`);
      seen.set(key, id);
    }
  });

  it('places every room reachable from the start room', () => {
    const { positions } = computeMapLayout(rooms, 'forestown-square');
    const reachable = new Set();
    const queue = ['forestown-square'];
    while (queue.length) {
      const id = queue.shift();
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const next of Object.values(rooms[id]?.exits || {})) {
        if (!reachable.has(next)) queue.push(next);
      }
    }
    assert.equal(positions.size, reachable.size);
    for (const id of reachable) assert.ok(positions.has(id), `missing ${id}`);
  });

  it('bumps a colliding room one extra step in its arrival direction', () => {
    // A.east → B at (1,0); A.south → C at (0,1).
    // B.south → D lands at (1,1).
    // C.east → E would also target (1,1); it must bump east to (2,1).
    const fixture = {
      A: { id: 'A', exits: { east: 'B', south: 'C' } },
      B: { id: 'B', exits: { south: 'D' } },
      C: { id: 'C', exits: { east: 'E' } },
      D: { id: 'D', exits: {} },
      E: { id: 'E', exits: {} }
    };
    const { positions } = computeMapLayout(fixture, 'A');
    assert.deepEqual(positions.get('D'), { x: 1, y: 1 });
    assert.deepEqual(positions.get('E'), { x: 2, y: 1 });
  });

  it('returns bounds that cover every placed room', () => {
    const { positions, bounds } = computeMapLayout(rooms, 'forestown-square');
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const { x, y } of positions.values()) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    assert.deepEqual(bounds, { minX, maxX, minY, maxY });
  });
});

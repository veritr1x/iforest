const DELTAS = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 }
};

export function computeMapLayout(rooms, startId) {
  const positions = new Map();
  const occupied = new Set();

  if (!rooms[startId]) {
    return { positions, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
  }

  positions.set(startId, { x: 0, y: 0 });
  occupied.add('0,0');
  const queue = [startId];

  while (queue.length) {
    const id = queue.shift();
    const here = positions.get(id);
    const exits = rooms[id]?.exits || {};
    for (const [dir, nextId] of Object.entries(exits)) {
      const delta = DELTAS[dir];
      if (!delta) continue;
      if (positions.has(nextId)) continue; // first-placement-wins per room
      if (!rooms[nextId]) continue;
      // Bump in-direction until an empty cell is found.
      let nx = here.x + delta.x;
      let ny = here.y + delta.y;
      while (occupied.has(`${nx},${ny}`)) {
        nx += delta.x;
        ny += delta.y;
      }
      positions.set(nextId, { x: nx, y: ny });
      occupied.add(`${nx},${ny}`);
      queue.push(nextId);
    }
  }

  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const { x, y } of positions.values()) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { positions, bounds: { minX, maxX, minY, maxY } };
}

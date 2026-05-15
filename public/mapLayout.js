const DELTAS = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 }
};

function findAvailableCell(occupiedCells, preferredX, preferredY, maxSearch = 20) {
  const key = (x, y) => `${x},${y}`;
  if (!occupiedCells.has(key(preferredX, preferredY))) {
    return { x: preferredX, y: preferredY };
  }

  // Spiral search for an empty cell
  for (let radius = 1; radius <= maxSearch; radius++) {
    for (let x = preferredX - radius; x <= preferredX + radius; x++) {
      for (let y = preferredY - radius; y <= preferredY + radius; y++) {
        if ((Math.abs(x - preferredX) === radius || Math.abs(y - preferredY) === radius) &&
            !occupiedCells.has(key(x, y))) {
          return { x, y };
        }
      }
    }
  }
  // Fallback: return the preferred position (shouldn't happen)
  return { x: preferredX, y: preferredY };
}

export function computeMapLayout(rooms, startId) {
  const positions = new Map();
  const occupiedCells = new Set();

  if (!rooms[startId]) {
    return { positions, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
  }

  positions.set(startId, { x: 0, y: 0 });
  occupiedCells.add('0,0');
  const queue = [startId];

  while (queue.length) {
    const id = queue.shift();
    const here = positions.get(id);
    const exits = rooms[id]?.exits || {};
    for (const [dir, nextId] of Object.entries(exits)) {
      const delta = DELTAS[dir];
      if (!delta) continue;
      if (positions.has(nextId)) continue;
      if (!rooms[nextId]) continue;
      const preferredX = here.x + delta.x;
      const preferredY = here.y + delta.y;
      const cell = findAvailableCell(occupiedCells, preferredX, preferredY);
      positions.set(nextId, cell);
      occupiedCells.add(`${cell.x},${cell.y}`);
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

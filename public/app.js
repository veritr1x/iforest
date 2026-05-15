import { computeMapLayout } from './mapLayout.js';
import { rooms as roomData } from './engine/gameData.js';

const DIRECTIONS = ['north', 'south', 'east', 'west'];
const DIRECTION_LABEL = { north: 'N', south: 'S', east: 'E', west: 'W' };
const VERB_ORDER = [
  'look',
  'take',
  'use',
  'examine',
  'drop',
  'attack',
  'sleep',
  'wait',
  'dive',
  'climb',
  'claim',
  'read',
  'cast',
  'stamp',
  'smile',
  'say hello'
];
const ZERO_ARITY = new Set([
  'look',
  'inventory',
  'sleep',
  'wait',
  'dive',
  'climb',
  'claim',
  'stamp',
  'smile',
  'say hello'
]);
const INVENTORY_ONLY = new Set(['drop', 'cast', 'read']);
const STORAGE_KEY = 'iforest:state';

const MAP_CELL_W = 52;
const MAP_CELL_H = 34;
const MAP_GAP = 14;
const MAP_PAD = 18;
const MAP_NS = 'http://www.w3.org/2000/svg';

let sessionId = null;
let currentGame = null;
let armedVerb = null;
let activePanel = null;
let serverMode = false;
let staticEngine = null;

const el = {
  screen: document.querySelector('#screen'),
  playerLine: document.querySelector('#player-line'),
  worldLine: document.querySelector('#world-line'),
  title: document.querySelector('#room-title'),
  description: document.querySelector('#room-description'),
  message: document.querySelector('#message'),
  image: document.querySelector('#room-image'),
  directionRow: document.querySelector('#direction-row'),
  verbRow: document.querySelector('#verb-row'),
  objectRow: document.querySelector('#object-row'),
  armedRow: document.querySelector('#armed-row'),
  armedVerb: document.querySelector('#armed-verb'),
  armedCancel: document.querySelector('#armed-cancel'),
  tabs: Array.from(document.querySelectorAll('.tab-key')),
  sheet: document.querySelector('#sheet'),
  sheetTitle: document.querySelector('#sheet-title'),
  sheetBody: document.querySelector('#sheet-body'),
  sheetClose: document.querySelector('#sheet-close'),
  menuButton: document.querySelector('#menu-button'),
  menuDialog: document.querySelector('#menu-dialog'),
  menuCancel: document.querySelector('#menu-cancel'),
  startForm: document.querySelector('#start-form'),
  playerName: document.querySelector('#player-name')
};

el.menuButton.addEventListener('click', () => el.menuDialog.showModal());
el.menuCancel.addEventListener('click', () => el.menuDialog.close());
el.menuDialog.addEventListener('click', (event) => {
  if (event.target === el.menuDialog) el.menuDialog.close();
});

el.startForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.menuDialog.close();
  await startGame(el.playerName.value);
});

el.armedCancel.addEventListener('click', () => setArmed(null));

el.tabs.forEach((tab) => {
  tab.addEventListener('click', () => togglePanel(tab.dataset.panel));
});

el.sheetClose.addEventListener('click', closePanel);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (activePanel) closePanel();
    else if (armedVerb) setArmed(null);
  }
});

async function detectMode() {
  try {
    const response = await fetch('api/health', { cache: 'no-store' });
    if (response.ok) {
      serverMode = true;
      return;
    }
  } catch (_) {
    // fall through to static
  }
  serverMode = false;
  staticEngine = await import('./engine/gameEngine.js');
}

async function startGame(name) {
  if (serverMode) {
    const response = await fetch('api/new', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const payload = await response.json();
    sessionId = payload.id;
    currentGame = payload.game;
  } else {
    currentGame = staticEngine.createGame({ name });
    sessionId = 'local';
    persistState();
  }
  initMapState();
  setArmed(null);
  render();
}

async function runCommand(verb, target = '') {
  const prevVisited = currentGame?.visitedRooms instanceof Set
    ? currentGame.visitedRooms
    : new Set();
  const prevLayout = currentGame?.mapLayout;
  const prevDetailRoomId = currentGame?.mapDetailRoomId ?? null;

  if (serverMode) {
    const response = await fetch('api/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: sessionId, command: { verb, target } })
    });
    const payload = await response.json();
    currentGame = payload.game;
  } else {
    currentGame = staticEngine.applyCommand(currentGame, { verb, target });
  }

  currentGame.visitedRooms = prevVisited;
  currentGame.mapLayout = prevLayout
    ?? computeMapLayout(roomData, currentGame.player.location);
  currentGame.mapDetailRoomId = prevDetailRoomId;

  if (currentGame?.view?.room?.id) {
    currentGame.visitedRooms.add(currentGame.view.room.id);
  }

  if (!serverMode) persistState();
  setArmed(null);
  render();
  if (activePanel) renderPanel(activePanel);
  el.screen.scrollTop = 0;
}

function persistState() {
  if (serverMode) return;
  try {
    const snapshot = {
      ...currentGame,
      visitedRooms: currentGame.visitedRooms ? [...currentGame.visitedRooms] : []
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (_) {
    // storage unavailable
  }
}

function restoreState() {
  if (serverMode) return false;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    currentGame = parsed;
    currentGame.visitedRooms = new Set(parsed.visitedRooms || [currentGame.player.location]);
    currentGame.mapLayout = computeMapLayout(roomData, currentGame.player.location);
    currentGame.mapDetailRoomId = null;
    sessionId = 'local';
    return true;
  } catch (_) {
    return false;
  }
}

function initMapState() {
  if (!currentGame) return;
  currentGame.visitedRooms = new Set([currentGame.player.location]);
  currentGame.mapLayout = computeMapLayout(roomData, currentGame.player.location);
  currentGame.mapDetailRoomId = null;
}

function render() {
  if (!currentGame) return;
  const { player, view, message } = currentGame;

  const asleep = player.asleep ? ' . asleep' : '';
  el.playerLine.textContent = `${player.name}  S${player.strength}%  XP${player.experience}${asleep}`;

  const safeSleep = view.room.safeSleep ? ' . safer sleep' : '';
  const marker = view.markerOwner ? ` . marker: ${view.markerOwner}` : '';
  el.worldLine.textContent = `Turn ${view.turn} . resets ${view.resets}${marker}${safeSleep}`;

  el.title.textContent = view.room.title;
  el.description.textContent = view.room.description;
  el.message.textContent = message || '';

  if (view.room.image) {
    el.image.src = view.room.image;
    el.image.hidden = false;
    el.image.alt = view.room.title;
  } else {
    el.image.hidden = true;
    el.image.removeAttribute('src');
  }

  renderDirections(view.exits || []);
  renderVerbs(view);
}

function renderDirections(exits) {
  const have = new Set(exits);
  el.directionRow.replaceChildren(
    ...DIRECTIONS.map((dir) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'key direction';
      button.textContent = DIRECTION_LABEL[dir];
      button.setAttribute('aria-label', dir);
      button.disabled = !have.has(dir);
      button.addEventListener('click', () => runCommand(dir));
      return button;
    })
  );
}

function renderVerbs(view) {
  const set = new Set();
  VERB_ORDER.forEach((v) => set.add(v));
  (view.commands || []).forEach((v) => {
    if (!DIRECTIONS.includes(v) && v !== 'inventory') set.add(v);
  });

  el.verbRow.replaceChildren(
    ...[...set].map((verb) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'key verb';
      if (verb === 'attack') button.classList.add('danger');
      if (verb === armedVerb) button.classList.add('armed');
      button.textContent = verb;
      button.addEventListener('click', () => onVerb(verb));
      return button;
    })
  );
}

function onVerb(verb) {
  if (ZERO_ARITY.has(verb)) {
    runCommand(verb);
    return;
  }
  if (armedVerb === verb) {
    setArmed(null);
    return;
  }
  setArmed(verb);
}

function setArmed(verb) {
  armedVerb = verb;
  if (!verb) {
    el.armedRow.hidden = true;
    el.objectRow.hidden = true;
    el.verbRow.hidden = false;
    if (currentGame) renderVerbs(currentGame.view);
    return;
  }
  el.armedRow.hidden = false;
  el.armedVerb.textContent = verb;
  el.verbRow.hidden = true;
  el.objectRow.hidden = false;
  renderObjects(verb);
}

function renderObjects(verb) {
  const view = currentGame.view;
  const inventory = currentGame.player.inventory;
  const objects = new Set();
  if (INVENTORY_ONLY.has(verb)) {
    inventory.forEach((it) => objects.add(it));
  } else {
    (view.nouns || []).forEach((n) => objects.add(n));
    inventory.forEach((it) => objects.add(it));
  }

  if (objects.size === 0) {
    const empty = document.createElement('span');
    empty.className = 'key';
    empty.style.cssText = 'opacity:0.6;background:transparent;border-style:dashed;';
    empty.textContent = 'no objects';
    el.objectRow.replaceChildren(empty);
    return;
  }

  el.objectRow.replaceChildren(
    ...[...objects].map((obj) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'key';
      button.textContent = obj;
      button.addEventListener('click', () => runCommand(armedVerb, obj));
      return button;
    })
  );
}

function togglePanel(name) {
  if (activePanel === name) {
    closePanel();
    return;
  }
  activePanel = name;
  el.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.panel === name));
  el.sheet.hidden = false;
  el.sheet.setAttribute('aria-hidden', 'false');
  renderPanel(name);
}

function closePanel() {
  activePanel = null;
  el.tabs.forEach((tab) => tab.classList.remove('active'));
  el.sheet.hidden = true;
  el.sheet.setAttribute('aria-hidden', 'true');
}

function renderPanel(name) {
  const view = currentGame?.view;
  if (!view) return;
  el.sheetBody.replaceChildren();

  if (name === 'inventory') {
    el.sheetTitle.textContent = 'Inventory';
    const items = currentGame.player.inventory;
    el.sheetBody.append(
      sectionList('Carrying', items.length ? items : ['nothing']),
      sectionList('Skills', view.skills?.length ? view.skills : ['none']),
      sectionList('Spells', view.spells?.length ? view.spells : ['none'])
    );
    return;
  }

  if (name === 'here') {
    el.sheetTitle.textContent = 'Here';
    el.sheetBody.append(
      sectionList('Objects', view.nouns?.length ? view.nouns : ['no obvious objects'])
    );
    return;
  }

  if (name === 'map') {
    el.sheetTitle.textContent = 'Map';
    renderMap(view);
    return;
  }
}

function renderMap(view) {
  if (currentGame.mapDetailRoomId) {
    renderMapDetail(view, currentGame.mapDetailRoomId);
    return;
  }
  renderMapGrid(view);
}

function renderMapGrid(view) {
  const layout = currentGame.mapLayout;
  const visited = currentGame.visitedRooms || new Set();
  const stepX = MAP_CELL_W + MAP_GAP;
  const stepY = MAP_CELL_H + MAP_GAP;
  const cols = layout.bounds.maxX - layout.bounds.minX + 1;
  const rows = layout.bounds.maxY - layout.bounds.minY + 1;
  const width = cols * stepX - MAP_GAP + MAP_PAD * 2;
  const height = rows * stepY - MAP_GAP + MAP_PAD * 2;

  const svg = document.createElementNS(MAP_NS, 'svg');
  svg.setAttribute('class', 'map-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  const cellCenter = (pos) => ({
    cx: MAP_PAD + (pos.x - layout.bounds.minX) * stepX + MAP_CELL_W / 2,
    cy: MAP_PAD + (pos.y - layout.bounds.minY) * stepY + MAP_CELL_H / 2
  });

  // 1. Connectors between two visited rooms
  for (const [id, pos] of layout.positions) {
    if (!visited.has(id)) continue;
    const exits = roomData[id]?.exits || {};
    for (const [dir, nextId] of Object.entries(exits)) {
      if (!visited.has(nextId)) continue;
      if (id > nextId) continue; // draw each edge once
      const nextPos = layout.positions.get(nextId);
      if (!nextPos) continue;
      const a = cellCenter(pos);
      const b = cellCenter(nextPos);
      const line = document.createElementNS(MAP_NS, 'line');
      line.setAttribute('x1', String(a.cx));
      line.setAttribute('y1', String(a.cy));
      line.setAttribute('x2', String(b.cx));
      line.setAttribute('y2', String(b.cy));
      line.setAttribute('class', 'map-connector');
      if (isBlocked(id, dir)) line.classList.add('is-blocked');
      svg.append(line);
    }
  }

  // 2. Stubs from visited rooms toward unvisited neighbors
  for (const [id, pos] of layout.positions) {
    if (!visited.has(id)) continue;
    const exits = roomData[id]?.exits || {};
    for (const [dir, nextId] of Object.entries(exits)) {
      if (visited.has(nextId)) continue;
      const delta = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[dir];
      if (!delta) continue;
      const a = cellCenter(pos);
      const stubLen = MAP_GAP / 2;
      const line = document.createElementNS(MAP_NS, 'line');
      line.setAttribute('x1', String(a.cx));
      line.setAttribute('y1', String(a.cy));
      line.setAttribute('x2', String(a.cx + delta[0] * (MAP_CELL_W / 2 + stubLen)));
      line.setAttribute('y2', String(a.cy + delta[1] * (MAP_CELL_H / 2 + stubLen)));
      line.setAttribute('class', 'map-stub');
      if (isBlocked(id, dir)) line.classList.add('is-blocked');
      svg.append(line);
    }
  }

  // 3. Rooms (visited only — fog of war hides everything else)
  for (const [id, pos] of layout.positions) {
    if (!visited.has(id)) continue;
    const room = roomData[id];
    const x = MAP_PAD + (pos.x - layout.bounds.minX) * stepX;
    const y = MAP_PAD + (pos.y - layout.bounds.minY) * stepY;
    const g = document.createElementNS(MAP_NS, 'g');
    g.setAttribute('class', 'map-room');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', room.title);
    if (id === view.room.id) g.classList.add('is-current');
    g.addEventListener('click', () => openRoomDetail(id));
    g.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openRoomDetail(id);
      }
    });

    const rect = document.createElementNS(MAP_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(MAP_CELL_W));
    rect.setAttribute('height', String(MAP_CELL_H));
    rect.setAttribute('rx', '3');
    g.append(rect);

    const label = document.createElementNS(MAP_NS, 'text');
    label.setAttribute('x', String(x + MAP_CELL_W / 2));
    label.setAttribute('y', String(y + MAP_CELL_H / 2 + 3));
    label.setAttribute('text-anchor', 'middle');
    label.textContent = shortLabel(room.title);
    g.append(label);

    if (id === view.room.id) {
      const dot = document.createElementNS(MAP_NS, 'circle');
      dot.setAttribute('cx', String(x + MAP_CELL_W - 6));
      dot.setAttribute('cy', String(y + 6));
      dot.setAttribute('r', '3');
      dot.setAttribute('class', 'map-pulse');
      g.append(dot);
    }

    svg.append(g);
  }

  el.sheetBody.append(svg);
}

function renderMapDetail(_view, _roomId) {
  // Replaced in Task 7
  currentGame.mapDetailRoomId = null;
  renderMapGrid(_view);
}

function shortLabel(title) {
  return title.length <= 12 ? title : title.slice(0, 11) + '…';
}

function isBlocked(roomId, dir) {
  const blocked = roomData[roomId]?.blockedExits?.[dir];
  if (!blocked) return false;
  const flag = blocked.unlessFlag;
  if (!flag) return true;
  return !currentGame.flags?.[flag];
}

function openRoomDetail(roomId) {
  currentGame.mapDetailRoomId = roomId;
  renderPanel('map');
}

function sectionList(title, values) {
  const wrap = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = title;
  const ul = document.createElement('ul');
  values.forEach((value) => {
    const li = document.createElement('li');
    li.textContent = value;
    ul.append(li);
  });
  wrap.append(heading, ul);
  return wrap;
}

function sectionLinks(title, entries) {
  const wrap = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = title;
  wrap.append(heading);

  if (!entries.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No room-specific evidence linked.';
    empty.style.color = 'var(--ink-dim)';
    wrap.append(empty);
    return wrap;
  }

  const ul = document.createElement('ul');
  entries.forEach((entry) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = entry.file;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = entry.file.replace('evidence/wayback/raw/', '');
    li.append(link);
    if (entry.note) li.append(document.createTextNode(` - ${entry.note}`));
    ul.append(li);
  });
  wrap.append(ul);
  return wrap;
}

await detectMode();
if (restoreState()) {
  render();
} else {
  await startGame('Jane');
}

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

let sessionId = null;
let currentGame = null;
let armedVerb = null;
let activePanel = null;
let evidenceSummary = null;

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

async function startGame(name) {
  const response = await fetch('/api/new', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name })
  });
  const payload = await response.json();
  sessionId = payload.id;
  currentGame = payload.game;
  setArmed(null);
  render();
}

async function runCommand(verb, target = '') {
  const response = await fetch('/api/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: sessionId, command: { verb, target } })
  });
  const payload = await response.json();
  currentGame = payload.game;
  setArmed(null);
  render();
  if (activePanel) renderPanel(activePanel);
  el.screen.scrollTop = 0;
}

async function loadEvidence() {
  const response = await fetch('/api/evidence');
  evidenceSummary = await response.json();
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

  if (name === 'systems') {
    el.sheetTitle.textContent = 'Recovered Systems';
    el.sheetBody.append(sectionList('Architecture', view.systems || []));
    return;
  }

  if (name === 'evidence') {
    el.sheetTitle.textContent = 'Evidence';
    if (evidenceSummary) {
      const summary = document.createElement('p');
      summary.className = 'summary-line';
      const c = evidenceSummary.categories;
      const wap = (c.wap || 0) + (c.wapExpanded || 0);
      const desktop = (c.html || 0) + (c.htmlExpanded || 0) + (c.littlescreen || 0);
      summary.textContent = `${evidenceSummary.rawFiles} archived files: ${wap} WAP, ${c.servlet || 0} servlet, ${desktop} desktop, ${c.contact || 0} tech/contact, ${c.pqaDecompiled || 0} PQA.`;
      el.sheetBody.append(summary);
    }
    el.sheetBody.append(sectionLinks('For this room', view.room.evidence || []));
  }
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
    link.href = `/${entry.file}`;
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

await loadEvidence();
await startGame('Jane');

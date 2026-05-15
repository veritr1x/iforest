import {
  FACES,
  HOUSEKEEPING_RESET_INTERVAL,
  items,
  MAX_POCKETS,
  MAX_STRENGTH,
  recoveredSystems,
  rooms
} from './gameData.js';

function pickFace(name, gender) {
  const list = FACES[gender] || FACES.male;
  let hash = 0;
  for (const ch of String(name)) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return list[hash % list.length];
}

const DIRECTIONS = new Set(['north', 'south', 'east', 'west']);
const GLOBAL_COMMANDS = ['look', 'inventory', 'take', 'use', 'examine', 'drop', 'attack', 'sleep', 'wait'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(value = '') {
  return String(value).trim().toLowerCase();
}

function initialItemLocations() {
  return Object.fromEntries(
    Object.values(rooms).map((room) => [
      room.id,
      (room.nouns || []).filter((noun) => items[noun]?.portable)
    ])
  );
}

function resolveItemId(target) {
  const wanted = normalize(target);
  if (items[wanted]) {
    return wanted;
  }

  return Object.values(items).find((item) => item.aliases?.includes(wanted))?.id || wanted;
}

function visibleNouns(game, room) {
  const placed = game.world.itemLocations[room.id] || [];
  const fixed = (room.nouns || []).filter((noun) => !items[noun]?.portable);

  if (room.id === 'forest-edge' && game.flags.noticedThorn && !game.flags.wolfHelped) {
    fixed.push('thorn');
  }

  if (room.id === 'service-corridor' && game.flags.foundLostWoman) {
    fixed.push('marker');
  }

  return [...new Set([...fixed, ...placed])];
}

function describe(game, message = '') {
  const room = rooms[game.player.location];
  const inventory = game.player.inventory;
  const skills = [...new Set(inventory.map((itemId) => items[itemId]?.skill).filter(Boolean))];
  const fullMessage = [game.world.housekeepingMessage, message].filter(Boolean).join(' ');
  delete game.world.housekeepingMessage;

  return {
    ...game,
    message: fullMessage,
    view: {
      room: {
        id: room.id,
        title: room.title,
        description: room.description,
        image: room.image || null,
        evidence: room.evidence || [],
        safeSleep: Boolean(room.safeSleep)
      },
      exits: Object.keys(room.exits || {}),
      nouns: visibleNouns(game, room),
      commands: listCommands(game).map((command) => command.verb),
      inventory,
      skills,
      spells: game.player.spells || [],
      face: game.player.face || null,
      gender: game.player.gender || null,
      markerOwner: game.world.claimedMarkers?.[room.id] || null,
      systems: recoveredSystems,
      turn: game.world.turns,
      resets: game.world.resets
    }
  };
}

export function createGame({ name = 'Tourist', gender = 'male', face = null, intro = false } = {}) {
  const safeName = String(name || 'Tourist').trim().slice(0, 12) || 'Tourist';
  const safeGender = gender === 'female' ? 'female' : 'male';
  const chosenFace = face && (FACES[safeGender] || []).includes(face)
    ? face
    : pickFace(safeName, safeGender);
  const startLocation = intro ? 'forestown-reception' : 'forestown-square';
  const welcome = intro
    ? "The receptionist looks up, unimpressed. Sign the forms when you are ready to descend."
    : 'Welcome to Forestown.';
  const game = {
    player: {
      name: safeName,
      gender: safeGender,
      face: chosenFace,
      location: startLocation,
      strength: MAX_STRENGTH,
      experience: 0,
      inventory: [],
      maxPockets: MAX_POCKETS,
      asleep: false,
      spells: []
    },
    flags: {},
    world: {
      itemLocations: initialItemLocations(),
      claimedMarkers: {},
      turns: 0,
      resets: 0
    },
    log: [welcome]
  };

  return describe(game, welcome);
}

export function getRoom(roomId) {
  const room = rooms[roomId];
  if (!room) {
    throw new Error(`Unknown room: ${roomId}`);
  }
  return clone(room);
}

export function listCommands(game) {
  const room = rooms[game.player.location];
  const verbs = room.commands || [...Object.keys(room.exits || {}), ...GLOBAL_COMMANDS];
  return [...new Set(verbs)].map((verb) => ({ verb, label: verb[0].toUpperCase() + verb.slice(1) }));
}

export function applyCommand(currentGame, command) {
  const game = clone(currentGame);
  const verb = normalize(command?.verb);
  const target = resolveItemId(command?.target);
  const room = rooms[game.player.location];

  if (!verb) {
    return describe(game, 'What now?');
  }

  game.world.turns = (game.world.turns || 0) + 1;
  game.player.asleep = false;
  runHousekeeping(game);

  if (DIRECTIONS.has(verb)) {
    return move(game, room, verb);
  }

  if (verb === 'look') {
    return describe(game, room.description);
  }

  if (verb === 'inventory' || verb === 'i') {
    const carried = game.player.inventory.map((itemId) => items[itemId].name).join(', ');
    const spells = game.player.spells?.length ? ` Spells: ${game.player.spells.join(', ')}.` : '';
    return describe(game, carried ? `You are carrying ${carried}.${spells}` : `Your pockets are empty.${spells}`);
  }

  if (verb === 'take') {
    return takeItem(game, room, target);
  }

  if (verb === 'drop') {
    return dropItem(game, room, target);
  }

  if (verb === 'examine') {
    return examine(game, room, target);
  }

  if (verb === 'use') {
    return useItem(game, room, target);
  }

  if (verb === 'attack') {
    return attack(game, room, target);
  }

  if (verb === 'swap') {
    if (game.player.location === 'giant-kitchen-cage' && target === 'giant') {
      game.player.location = 'service-lift';
      return describe(
        game,
        'You swap places with the giant. For a heartbeat he is rattling the bars of his own cage while you stand by the lift doors. You step inside before he understands.'
      );
    }
    return describe(game, 'You swap places in the old demonstration state. Whoosh.');
  }

  if (verb === 'wait') {
    return describe(game, 'The WAP screen refreshes, reporting anything that has changed nearby.');
  }

  if (verb === 'sleep') {
    return sleep(game, room);
  }

  if (verb === 'dive') {
    return dive(game, room);
  }

  if (verb === 'climb') {
    return climb(game, room);
  }

  if (verb === 'claim') {
    return claimMarker(game, room);
  }

  if (verb === 'read') {
    return readItem(game, room, target);
  }

  if (verb === 'cast') {
    return castSpell(game, target);
  }

  if (verb === 'sign') {
    if (room.id !== 'forestown-reception') {
      return describe(game, 'There is nothing to sign here.');
    }
    game.flags.introSigned = true;
    game.player.location = 'forestown-square';
    return describe(
      game,
      'You sign the forms on the dotted line and hurry into the lift. The receptionist watches you go. "Don\'t get lost!" she calls. The doors close, the lift descends, and they open again on Forestown Main Square.'
    );
  }

  if (verb === 'stamp') {
    if (room.id !== 'tourist-info-booth') {
      return describe(game, 'There is no tourist information booth here.');
    }

    game.flags.handStamped = true;
    return describe(game, 'Your hand is stamped for the Forestown Mall.');
  }

  if (verb === 'smile' || verb === 'say hello') {
    return describe(game, 'You perform a friendly preset action from the later player-interaction update.');
  }

  return describe(game, 'I do not know that verb.');
}

function move(game, room, direction) {
  const blocked = room.blockedExits?.[direction];
  if (blocked && !canPass(game, blocked)) {
    return describe(game, blocked.message);
  }

  const nextRoom = room.exits?.[direction];
  if (!nextRoom) {
    return describe(game, 'You cannot go that way.');
  }

  game.player.location = nextRoom;
  return describe(game, rooms[nextRoom].description);
}

function canPass(game, blocked) {
  if (blocked.unlessFlag && !game.flags[blocked.unlessFlag]) {
    return false;
  }
  if (blocked.unlessItem && !game.player.inventory.includes(blocked.unlessItem)) {
    return false;
  }
  if (blocked.unlessSkill && !hasSkill(game, blocked.unlessSkill)) {
    return false;
  }
  return true;
}

function takeItem(game, room, target) {
  const available = game.world.itemLocations[room.id] || [];
  if (!available.includes(target)) {
    return describe(game, `You cannot take ${commandName(target)} here.`);
  }

  if (game.player.inventory.length >= game.player.maxPockets) {
    return describe(game, 'Your pockets are full. Drop something before picking anything else up.');
  }

  game.world.itemLocations[room.id] = available.filter((itemId) => itemId !== target);
  game.player.inventory.push(target);
  return describe(game, `You take ${items[target].name}.`);
}

function dropItem(game, room, target) {
  if (!game.player.inventory.includes(target)) {
    return describe(game, `You are not carrying ${commandName(target)}.`);
  }

  game.player.inventory = game.player.inventory.filter((itemId) => itemId !== target);
  game.world.itemLocations[room.id] = [...(game.world.itemLocations[room.id] || []), target];
  return describe(game, `You drop ${items[target].name}.`);
}

function examine(game, room, target) {
  if (room.id === 'forestown-reception' && target === 'receptionist') {
    return describe(game, 'She watches with the patience of someone who has seen many tourists vanish into iForest. "Rumours of dragons, fairies and magical sandwiches," she sighs. "That is what brings them in. Most never make it past the wolves." Her pen taps the form clipboard.');
  }

  if (room.id === 'forest-edge' && target === 'wolf') {
    game.flags.noticedThorn = true;
    return describe(game, "The wolf's paw is swollen. A thorn is buried between the pads.");
  }

  if (room.id === 'waterfall-top' && target === 'baron trace') {
    game.flags.foundBaron = true;
    game.player.experience += 1;
    return describe(game, "You find enough of the Baron's trail to satisfy the recovered big-house hint.");
  }

  if (room.id === 'service-corridor' && target === 'woman') {
    game.flags.foundLostWoman = true;
    game.player.experience += 1;
    return describe(
      game,
      'You find the woman tucked behind a row of filing cabinets. She blinks at you, points at a game marker hidden in the partition wall, and slips out toward reception.'
    );
  }

  if (target === 'self' || target === 'me' || target === game.player.name.toLowerCase()) {
    const face = game.player.face || 'a featureless face';
    return describe(
      game,
      `${game.player.name} (${game.player.gender}, ${face}). Strength ${game.player.strength}/${MAX_STRENGTH}, experience ${game.player.experience}.`
    );
  }

  if (target === 'player' || target === 'character') {
    const face = game.player.face || 'a featureless face';
    return describe(game, `You see ${game.player.name}: ${face}.`);
  }

  const item = items[target];
  if (item && (visibleNouns(game, room).includes(target) || game.player.inventory.includes(target))) {
    return describe(game, item.description);
  }

  return describe(game, `You see nothing special about ${commandName(target)}.`);
}

function useItem(game, room, target) {
  if (room.id === 'forest-edge' && target === 'thorn' && game.flags.noticedThorn) {
    game.flags.wolfHelped = true;
    game.player.experience += 1;
    return describe(
      game,
      "You pull the thorn from the wolf's paw. The wolf still growls, but the fairies notice and clear the northern path."
    );
  }

  if (target === 'water' && room.id === 'forest-pool') {
    game.player.strength = MAX_STRENGTH;
    return describe(game, 'The cold water restores your strength.');
  }

  if (target === 'sandwich' && game.player.inventory.includes('sandwich')) {
    const destination = items.sandwich.madeAt || 'forestown-square';
    game.player.strength = MAX_STRENGTH;
    game.player.inventory = game.player.inventory.filter((itemId) => itemId !== 'sandwich');
    game.player.location = destination;
    return describe(game, 'The teleportation sandwich vanishes and returns you to where it was made.');
  }

  if (target === 'seal' && game.player.location === 'beside-gate' && game.player.inventory.includes('seal')) {
    if (!game.flags.foundBaron) {
      return describe(game, "The seal is not enough yet. The tourist hints point you toward the waterfall as well.");
    }
    game.flags.gateOpened = true;
    return describe(game, 'The Baronial crest flashes. The gate opens just enough to slip through.');
  }

  if (target === 'lift' && room.id === 'service-lift') {
    game.player.location = 'giant-kitchen-cage';
    return describe(game, 'You press the button. The lift descends rapidly, the doors open, and the lift disappears.');
  }

  if (target === 'marker key') {
    return claimMarker(game, room);
  }

  if (target === 'spellbook') {
    return readItem(game, room, target);
  }

  if (game.player.inventory.includes(target)) {
    return describe(game, `You use ${items[target].name}, but nothing obvious happens.`);
  }

  return describe(game, `You are not holding ${commandName(target)}.`);
}

function attack(game, room, target) {
  if (target === 'sleeping players') {
    return describe(game, 'Sleeping characters cannot be attacked, but the old rules warned that visible carried objects could be taken.');
  }

  if (target !== 'wolf' || room.id !== 'forest-edge') {
    return describe(game, 'That is not a fight worth starting.');
  }

  const weapon = bestHeldItem(game, 'attack');
  const damage = weapon ? Math.max(4, 10 - weapon.attack) : 10;
  game.player.strength -= damage;

  if (game.player.strength <= 0) {
    return hospitalize(game, 'The wolf wins the fight. The fairies carry you to hospital.');
  }

  if (game.player.inventory.length > 0) {
    const dropped = game.player.inventory.pop();
    game.world.itemLocations[room.id] = [...(game.world.itemLocations[room.id] || []), dropped];
    return describe(game, `The wolf snaps back. You drop ${items[dropped].name}.`);
  }

  return describe(game, 'The wolf snaps back. A friendlier approach may work better.');
}

function sleep(game, room) {
  game.player.asleep = true;
  const lockKey = room.lockableWith;
  const lockedAndKeyed = lockKey && game.player.inventory.includes(lockKey);

  let safety;
  if (lockedAndKeyed) {
    safety = `You lock the door with the ${lockKey} before bedding down. This is the safest sleep available — the recovered help warns that fairies will eventually respawn a duplicate key, so this safety lapses after a while.`;
  } else if (room.safeSleep) {
    safety = 'This is one of the safer sleeping places preserved by the help pages.';
  } else {
    safety = 'You will eventually disappear from view, but visible carried objects can be taken first.';
  }
  return describe(game, `You fall asleep. ${safety}`);
}

function dive(game, room) {
  if (room.id !== 'forest-pool') {
    return describe(game, 'There is nowhere useful to dive here.');
  }
  if (!hasSkill(game, 'swim')) {
    return describe(game, 'You cannot dive to the bottom of the pool unless you can swim.');
  }
  game.flags.waterfallRouteFound = true;
  game.player.experience += 1;
  return describe(game, 'You dive under the waterfall and find a route upward.');
}

function climb(game, room) {
  if (room.id === 'tall-tree') {
    if (!hasSkill(game, 'climb')) {
      return describe(game, 'You need the climbing skill stone before you can reach the top.');
    }
    game.player.location = 'tree-top';
    game.player.experience += 1;
    return describe(game, rooms['tree-top'].description);
  }

  if (room.id === 'forest-pool' && game.flags.waterfallRouteFound) {
    game.player.location = 'waterfall-top';
    return describe(game, rooms['waterfall-top'].description);
  }

  return describe(game, 'You cannot climb anything useful here.');
}

function claimMarker(game, room) {
  if (!visibleNouns(game, room).includes('marker')) {
    return describe(game, 'There is no marker to claim here.');
  }
  if (!game.player.inventory.includes('marker key')) {
    return describe(game, 'You need the appropriate marker key before you can claim this marker.');
  }

  game.world.claimedMarkers[room.id] = game.player.name;
  return describe(game, `${game.player.name}'s flag is now in this marker.`);
}

function readItem(game, room, target) {
  if (target !== 'spellbook') {
    return describe(game, `There is nothing to read on ${commandName(target)}.`);
  }
  if (!game.player.inventory.includes('spellbook') && !visibleNouns(game, room).includes('spellbook')) {
    return describe(game, 'There is no spellbook here.');
  }

  const spell = items.spellbook.teachesSpell;
  game.player.spells = [...new Set([...(game.player.spells || []), spell])];
  return describe(game, `You learn the ${spell} spell. Nobody can take it away from you.`);
}

function castSpell(game, target) {
  if (!game.player.spells?.length) {
    return describe(game, 'You have not learned any spells yet.');
  }
  const spell = game.player.spells[0];
  const victim = commandName(target || 'another player');
  if (spell === 'chocolate weapons') {
    return describe(
      game,
      `You cast chocolate weapons at ${victim}. In the original multiplayer game this would turn the weapons they are holding into chocolate; the single-player reconstruction has nobody to target.`
    );
  }
  return describe(
    game,
    `You cast ${spell} at ${victim}. This reconstruction records the spell system but not the original full effects.`
  );
}

function hospitalize(game, message) {
  const lost = game.player.inventory;
  game.world.itemLocations['lost-property'] = [
    ...(game.world.itemLocations['lost-property'] || []),
    ...lost
  ];
  game.player.inventory = [];
  game.player.location = 'hospital';
  game.player.strength = Math.ceil(MAX_STRENGTH / 3);
  return describe(game, message);
}

function runHousekeeping(game) {
  if (game.world.turns % HOUSEKEEPING_RESET_INTERVAL !== 0) {
    return;
  }

  game.world.itemLocations = initialItemLocations();
  game.world.resets += 1;
  game.world.housekeepingMessage =
    'The fairies quietly reset the location documents, replacing taken objects and tidying dropped ones.';
}

function hasSkill(game, skill) {
  return game.player.inventory.some((itemId) => items[itemId]?.skill === skill);
}

function bestHeldItem(game, field) {
  return game.player.inventory
    .map((itemId) => items[itemId])
    .filter((item) => item?.[field])
    .sort((a, b) => b[field] - a[field])[0];
}

function commandName(target) {
  return target || 'that';
}

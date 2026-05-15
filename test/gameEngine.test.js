import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyCommand,
  createGame,
  getRoom,
  listCommands
} from '../src/gameEngine.js';

describe('iForest reconstructed game engine', () => {
  it('starts a named player in Forestown with WAP-style command options', () => {
    const game = createGame({ name: 'Jane' });

    assert.equal(game.player.name, 'Jane');
    assert.equal(game.player.location, 'forestown-square');
    assert.equal(game.player.strength, 35);
    assert.deepEqual(listCommands(game).map((command) => command.verb), [
      'north',
      'south',
      'east',
      'west',
      'look',
      'inventory',
      'take',
      'use',
      'examine',
      'drop',
      'attack',
      'sleep',
      'wait'
    ]);
    assert.ok(game.view.systems.includes('XML-backed mutable location documents'));
  });

  it('models the forest wolf thorn puzzle and unlocks the northern path', () => {
    let game = createGame({ name: 'Jane' });

    game = applyCommand(game, { verb: 'east' });
    assert.equal(game.player.location, 'forest-edge');

    game = applyCommand(game, { verb: 'examine', target: 'wolf' });
    assert.match(game.message, /thorn/i);
    assert.equal(game.flags.noticedThorn, true);

    game = applyCommand(game, { verb: 'use', target: 'thorn' });
    assert.equal(game.flags.wolfHelped, true);
    assert.match(game.message, /fairies/i);

    game = applyCommand(game, { verb: 'west' });
    game = applyCommand(game, { verb: 'north' });
    assert.equal(game.player.location, 'northern-path');
  });

  it('requires the old church and waterfall clues before entering the mansion', () => {
    let game = createGame({ name: 'Jane' });

    game = applyCommand(game, { verb: 'east' });
    game = applyCommand(game, { verb: 'east' });
    game = applyCommand(game, { verb: 'take', target: 'seal' });
    game = applyCommand(game, { verb: 'west' });
    game = applyCommand(game, { verb: 'south' });
    game = applyCommand(game, { verb: 'take', target: 'swim stone' });
    game = applyCommand(game, { verb: 'dive' });
    assert.equal(game.flags.waterfallRouteFound, true);

    game = applyCommand(game, { verb: 'east' });
    game = applyCommand(game, { verb: 'examine', target: 'baron trace' });
    assert.equal(game.flags.foundBaron, true);

    game = applyCommand(game, { verb: 'north' });
    game = applyCommand(game, { verb: 'use', target: 'seal' });
    game = applyCommand(game, { verb: 'east' });
    assert.equal(game.player.location, 'mansion-grounds');
  });

  it('models the recovered tourist-info hand stamp for mall access', () => {
    let game = createGame({ name: 'Shopper' });

    game = applyCommand(game, { verb: 'stamp' });
    assert.notEqual(game.flags.handStamped, true);
    assert.match(game.message, /no tourist information booth/i);

    game = createGame({ name: 'Shopper' });
    game = applyCommand(game, { verb: 'south' });
    game = applyCommand(game, { verb: 'west' });
    assert.equal(game.player.location, 'customer-services');
    assert.match(game.message, /hand stamped/i);

    game = createGame({ name: 'Shopper' });
    game = applyCommand(game, { verb: 'east' });
    game = applyCommand(game, { verb: 'south' });
    assert.ok(listCommands(game).some((command) => command.verb === 'south'));
    game = applyCommand(game, { verb: 'south' });
    game = applyCommand(game, { verb: 'east' });
    assert.equal(game.player.location, 'tourist-info-booth');

    game = applyCommand(game, { verb: 'stamp' });
    assert.equal(game.flags.handStamped, true);

    game = applyCommand(game, { verb: 'west' });
    game = applyCommand(game, { verb: 'north' });
    game = applyCommand(game, { verb: 'north' });
    game = applyCommand(game, { verb: 'west' });
    game = applyCommand(game, { verb: 'south' });
    game = applyCommand(game, { verb: 'west' });
    assert.equal(game.player.location, 'forestown-mall');
  });

  it('lets the player swap with the giant to escape the kitchen cage', () => {
    let game = createGame({ name: 'Jack' });
    game = applyCommand(game, { verb: 'south' });
    game = applyCommand(game, { verb: 'east' });
    game = applyCommand(game, { verb: 'north' });
    assert.equal(game.player.location, 'service-lift');

    game = applyCommand(game, { verb: 'use', target: 'lift' });
    assert.equal(game.player.location, 'giant-kitchen-cage');

    const stuck = applyCommand(game, { verb: 'swap', target: 'cage' });
    assert.equal(stuck.player.location, 'giant-kitchen-cage');

    game = applyCommand(game, { verb: 'swap', target: 'giant' });
    assert.equal(game.player.location, 'service-lift');
    assert.match(game.message, /swap places with the giant/i);
  });

  it('keeps the recovered wooden house servlet room and its command vocabulary', () => {
    const house = getRoom('wooden-house');

    assert.match(house.description, /small wooden house/i);
    assert.deepEqual(house.nouns, ['woman']);
    assert.deepEqual(house.commands, [
      'south',
      'take',
      'use',
      'attack',
      'examine',
      'inventory',
      'swap',
      'sleep',
      'wait'
    ]);
    assert.match(house.evidence[0].file, /DriverHTML/);
  });

  it('models pocket limits, teleportation sandwiches, and fairy reset behavior', () => {
    let game = createGame({ name: 'Peter' });
    game = applyCommand(game, { verb: 'take', target: 'sandwich' });
    game = applyCommand(game, { verb: 'take', target: 'map' });
    game = applyCommand(game, { verb: 'east' });
    game = applyCommand(game, { verb: 'take', target: 'stick' });
    game = applyCommand(game, { verb: 'south' });
    game = applyCommand(game, { verb: 'take', target: 'swim stone' });
    game = applyCommand(game, { verb: 'north' });
    game = applyCommand(game, { verb: 'west' });
    game = applyCommand(game, { verb: 'west' });
    const full = applyCommand(game, { verb: 'take', target: 'coat' });

    assert.match(full.message, /pockets are full/i);
    assert.equal(full.player.inventory.length, 4);
    assert.equal(full.world.resets, 1);

    const restored = applyCommand(
      { ...game, player: { ...game.player, strength: 20 } },
      { verb: 'use', target: 'sandwich' }
    );
    assert.equal(restored.player.strength, 35);
    assert.equal(restored.player.location, 'forestown-square');
  });

  it('captures marker claiming, spellbooks, and safe sleeping hints', () => {
    let game = createGame({ name: 'MarkerFan' });

    game = {
      ...game,
      player: {
        ...game.player,
        location: 'tree-top',
        inventory: ['marker key'],
        spells: []
      }
    };
    game = applyCommand(game, { verb: 'claim' });
    assert.equal(game.world.claimedMarkers['tree-top'], 'MarkerFan');
    assert.match(game.message, /flag/i);

    game = {
      ...game,
      player: {
        ...game.player,
        location: 'derelict-church',
        inventory: ['spellbook'],
        spells: []
      }
    };
    game = applyCommand(game, { verb: 'read', target: 'spellbook' });
    assert.deepEqual(game.player.spells, ['chocolate weapons']);

    game = { ...game, player: { ...game.player, location: 'valley-house' } };
    game = applyCommand(game, { verb: 'sleep' });
    assert.equal(game.player.asleep, true);
    assert.match(game.message, /safer sleeping/i);
  });

  it('hides the customer-services marker until the lost woman is found', () => {
    let game = createGame({ name: 'Detective' });
    game = { ...game, player: { ...game.player, location: 'service-corridor' } };

    assert.ok(!game.view.nouns.includes('marker'), 'marker should not be visible before finding the woman');

    game = applyCommand(game, { verb: 'examine', target: 'woman' });
    assert.equal(game.flags.foundLostWoman, true);
    assert.match(game.message, /filing cabinets/i);
    assert.ok(game.view.nouns.includes('marker'), 'marker becomes visible after finding the woman');
  });

  it('reflavors the chocolate-weapons spell as a debuff cast on other players', () => {
    let game = createGame({ name: 'Caster' });
    game = {
      ...game,
      player: { ...game.player, spells: ['chocolate weapons'] }
    };
    game = applyCommand(game, { verb: 'cast', target: 'rival' });
    assert.match(game.message, /turn the weapons they are holding into chocolate/i);
    assert.match(game.message, /single-player reconstruction/i);
  });

  it('treats valley-house sleep as safest when the valley key is held', () => {
    let game = createGame({ name: 'Sleeper' });
    game = {
      ...game,
      player: {
        ...game.player,
        location: 'valley-house',
        inventory: ['valley key']
      }
    };
    game = applyCommand(game, { verb: 'sleep' });
    assert.equal(game.player.asleep, true);
    assert.match(game.message, /safest sleep available/i);
    assert.match(game.message, /duplicate key/i);
  });

  it('opens at the reception lobby when intro is requested and signs into Forestown via the lift', () => {
    let game = createGame({ name: 'Newbie', intro: true });
    assert.equal(game.player.location, 'forestown-reception');
    assert.ok(game.view.commands.includes('sign'));
    assert.ok(game.view.nouns.includes('receptionist'));
    assert.ok(game.view.nouns.includes('lift'));

    const peeked = applyCommand(game, { verb: 'examine', target: 'receptionist' });
    assert.match(peeked.message, /seen many tourists/i);

    const framed = applyCommand(game, { verb: 'examine', target: 'frames' });
    assert.match(framed.message, /proud, fit, and annoyingly confident/i);

    game = applyCommand(game, { verb: 'sign' });
    assert.equal(game.player.location, 'forestown-square');
    assert.match(game.message, /lift descends/i);
    assert.equal(game.flags.introSigned, true);
  });

  it('routes a knocked-out player to the hospital with carried items in lost property', () => {
    let game = createGame({ name: 'Hapless' });
    game = {
      ...game,
      player: {
        ...game.player,
        location: 'forest-edge',
        strength: 5,
        inventory: ['map']
      }
    };

    game = applyCommand(game, { verb: 'attack', target: 'wolf' });
    assert.equal(game.player.location, 'hospital');
    assert.equal(game.player.inventory.length, 0);
    assert.match(game.message, /hospital/i);
    assert.ok(game.world.itemLocations['lost-property'].includes('map'));

    game = applyCommand(game, { verb: 'west' });
    assert.equal(game.player.location, 'lost-property');
    game = applyCommand(game, { verb: 'take', target: 'map' });
    assert.ok(game.player.inventory.includes('map'));
  });

  it('documents PvP combat, hospital recovery, and the reception lobby in recovered systems', () => {
    const game = createGame({ name: 'Lorehunter' });
    assert.ok(game.view.systems.some((s) => /PvP/i.test(s)), 'PvP combat in systems');
    assert.ok(game.view.systems.some((s) => /hospital/i.test(s)), 'hospital recovery in systems');
    assert.ok(game.view.systems.some((s) => /reception/i.test(s)), 'reception lobby in systems');
    assert.ok(game.view.systems.some((s) => /lots of players/i.test(s)), 'crowded-location overflow text in systems');
  });

  it('attributes the teleportation sandwich to the fairies', () => {
    let game = createGame({ name: 'Foodie' });
    game = applyCommand(game, { verb: 'take', target: 'sandwich' });
    game = applyCommand(game, { verb: 'examine', target: 'sandwich' });
    assert.match(game.message, /made by the fairies/i);
  });

  it('assigns a deterministic face per name and respects gender selection', () => {
    const a = createGame({ name: 'Alice', gender: 'female' });
    const b = createGame({ name: 'Alice', gender: 'female' });
    assert.equal(a.player.face, b.player.face, 'same name + gender yields same face');
    assert.equal(a.player.gender, 'female');

    const m = createGame({ name: 'Alice', gender: 'male' });
    assert.equal(m.player.gender, 'male');
    assert.ok(typeof m.player.face === 'string' && m.player.face.length > 0);

    const looked = applyCommand(a, { verb: 'examine', target: 'self' });
    assert.match(looked.message, new RegExp(a.player.face));
  });

});

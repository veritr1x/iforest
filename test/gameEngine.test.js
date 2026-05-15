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

});

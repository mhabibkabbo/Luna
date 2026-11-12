import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseExplorerRoute, buildExplorerHash } from '../src/utils/explorerRoute.js';

describe('explorerRoute URL hash & query state synchronization', () => {
  it('parses default landing and explorer hashes accurately', () => {
    assert.deepEqual(parseExplorerRoute(''), {
      currentView: 'landing',
      viewMode: '3d',
      activePlanet: 'moon',
    });

    assert.deepEqual(parseExplorerRoute('#explorer'), {
      currentView: 'explorer',
      viewMode: '3d',
      activePlanet: 'moon',
    });

    assert.deepEqual(parseExplorerRoute('#explorer-moon'), {
      currentView: 'explorer',
      viewMode: '3d',
      activePlanet: 'moon',
    });
  });

  it('parses 3D Earth DSN hashes into explorer + 3d + earth', () => {
    assert.deepEqual(parseExplorerRoute('#explorer-earth'), {
      currentView: 'explorer',
      viewMode: '3d',
      activePlanet: 'earth',
    });

    assert.deepEqual(parseExplorerRoute('#earth-3d'), {
      currentView: 'explorer',
      viewMode: '3d',
      activePlanet: 'earth',
    });

    assert.deepEqual(parseExplorerRoute('#dsn'), {
      currentView: 'explorer',
      viewMode: '3d',
      activePlanet: 'earth',
    });
  });

  it('parses 2D South Pole Topo hashes into explorer + sp-2d + moon', () => {
    assert.deepEqual(parseExplorerRoute('#sp-2d'), {
      currentView: 'explorer',
      viewMode: 'sp-2d',
      activePlanet: 'moon',
    });

    assert.deepEqual(parseExplorerRoute('#southpole'), {
      currentView: 'explorer',
      viewMode: 'sp-2d',
      activePlanet: 'moon',
    });

    assert.deepEqual(parseExplorerRoute('#2d'), {
      currentView: 'explorer',
      viewMode: 'sp-2d',
      activePlanet: 'moon',
    });
  });

  it('parses dedicated subpage workspaces and query parameters', () => {
    assert.deepEqual(parseExplorerRoute('#planner'), {
      currentView: 'planner',
      viewMode: '3d',
      activePlanet: 'moon',
    });

    assert.deepEqual(parseExplorerRoute('#compare'), {
      currentView: 'comparison',
      viewMode: '3d',
      activePlanet: 'moon',
    });

    assert.deepEqual(parseExplorerRoute('#orbit'), {
      currentView: 'trajectory',
      viewMode: '3d',
      activePlanet: 'moon',
    });

    assert.deepEqual(parseExplorerRoute('', '?autostart=1'), {
      currentView: 'explorer',
      viewMode: '3d',
      activePlanet: 'moon',
    });

    assert.deepEqual(parseExplorerRoute('', '?planet=earth&lat=35.4&lon=-116.8'), {
      currentView: 'explorer',
      viewMode: '3d',
      activePlanet: 'earth',
    });
  });

  it('builds canonical URL hashes for Moon 3D, Earth 3D, 2D Topo, and workspaces', () => {
    assert.equal(
      buildExplorerHash({ currentView: 'explorer', viewMode: '3d', activePlanet: 'moon' }),
      '#explorer'
    );
    assert.equal(
      buildExplorerHash({ currentView: 'explorer', viewMode: '3d', activePlanet: 'earth' }),
      '#explorer-earth'
    );
    assert.equal(
      buildExplorerHash({ currentView: 'explorer', viewMode: 'sp-2d', activePlanet: 'moon' }),
      '#sp-2d'
    );
    assert.equal(
      buildExplorerHash({ currentView: 'explorer', viewMode: '2d', activePlanet: 'moon' }),
      '#sp-2d'
    );
    assert.equal(
      buildExplorerHash({ currentView: 'landing', viewMode: '3d', activePlanet: 'moon' }),
      '#'
    );
    assert.equal(
      buildExplorerHash({ currentView: 'site-comparison' }),
      '#comparison'
    );
  });
});

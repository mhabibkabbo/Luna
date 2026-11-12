/**
 * Parses a URL hash string and optional URLSearchParams into the canonical
 * { currentView, viewMode, activePlanet } state tuple.
 *
 * @param {string} rawHash - window.location.hash (with or without leading '#')
 * @param {URLSearchParams | string} [searchParams] - window.location.search or URLSearchParams
 * @returns {{
 *   currentView: string,
 *   viewMode: '3d' | '2d' | 'sp-2d',
 *   activePlanet: 'moon' | 'earth'
 * }}
 */
export function parseExplorerRoute(rawHash = '', searchParams = '') {
  const hash = String(rawHash || '')
    .toLowerCase()
    .replace(/^#\/?/, '')
    .trim();

  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(typeof searchParams === 'string' ? searchParams : '');

  const queryPlanet = params.get('planet') === 'earth' ? 'earth' : 'moon';
  const hasShareCoords = Boolean(params.get('lat') && params.get('lon'));
  const isAutostart = params.get('autostart') === '1';

  if (
    hash === 'sp-2d' ||
    hash === 'southpole' ||
    hash === 'southpole-2d' ||
    hash === 'explorer-2d' ||
    hash === '2d' ||
    hash === 'planar' ||
    hash.includes('sp-2d') ||
    hash.includes('southpole')
  ) {
    return {
      currentView: 'explorer',
      viewMode: 'sp-2d',
      activePlanet: 'moon',
    };
  }

  if (
    hash === 'explorer-earth' ||
    hash === 'earth-3d' ||
    hash === 'globe-earth' ||
    hash === 'earth' ||
    hash === 'dsn'
  ) {
    return {
      currentView: 'explorer',
      viewMode: '3d',
      activePlanet: 'earth',
    };
  }

  if (
    hash === 'explorer' ||
    hash === 'explorer-moon' ||
    hash === 'moon-3d' ||
    hash === 'globe-moon' ||
    hash === 'map' ||
    hash === 'globe' ||
    hash === 'briefing' ||
    hash.includes('explorer') ||
    hash.includes('map') ||
    hash.includes('globe')
  ) {
    return {
      currentView: 'explorer',
      viewMode: '3d',
      activePlanet: queryPlanet,
    };
  }

  if (hash === 'missions') {
    return { currentView: 'missions', viewMode: '3d', activePlanet: 'moon' };
  }
  if (hash === 'about') {
    return { currentView: 'about', viewMode: '3d', activePlanet: 'moon' };
  }
  if (hash === 'planner') {
    return { currentView: 'planner', viewMode: '3d', activePlanet: 'moon' };
  }
  if (hash === 'comparison' || hash === 'compare' || hash === 'site-comparison') {
    return { currentView: 'comparison', viewMode: '3d', activePlanet: 'moon' };
  }
  if (hash === 'library' || hash === 'guide') {
    return { currentView: 'library', viewMode: '3d', activePlanet: 'moon' };
  }
  if (hash === 'trajectory' || hash === 'orbit' || hash === 'transfer') {
    return { currentView: 'trajectory', viewMode: '3d', activePlanet: 'moon' };
  }
  if (hash === 'landing') {
    return { currentView: 'landing', viewMode: '3d', activePlanet: 'moon' };
  }

  if (isAutostart || hasShareCoords) {
    return {
      currentView: 'explorer',
      viewMode: '3d',
      activePlanet: queryPlanet,
    };
  }

  return {
    currentView: 'landing',
    viewMode: '3d',
    activePlanet: 'moon',
  };
}

/**
 * Formats the canonical URL hash for the given view, mode, and active planet.
 *
 * @param {{
 *   currentView: string,
 *   viewMode?: '3d' | '2d' | 'sp-2d',
 *   activePlanet?: 'moon' | 'earth'
 * }} state
 * @returns {string} Canonical hash string starting with '#'
 */
export function buildExplorerHash({
  currentView = 'landing',
  viewMode = '3d',
  activePlanet = 'moon',
} = {}) {
  if (!currentView || currentView === 'landing') {
    return '#';
  }

  if (currentView !== 'explorer') {
    const normalized =
      currentView === 'site-comparison' || currentView === 'compare'
        ? 'comparison'
        : currentView === 'orbit' || currentView === 'transfer'
        ? 'trajectory'
        : currentView;
    return `#${normalized}`;
  }

  if (viewMode === '2d' || viewMode === 'sp-2d') {
    return '#sp-2d';
  }

  if (activePlanet === 'earth') {
    return '#explorer-earth';
  }

  return '#explorer';
}

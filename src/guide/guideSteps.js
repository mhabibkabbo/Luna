export const GUIDE_VERSION = 1;

/**
 * Step schema:
 * - id: unique string identifier
 * - since: version number that introduced the step (for 'What's new' incremental tours)
 * - view: view/workspace where this step runs ('explorer', 'planner', 'comparison', etc.)
 * - target: CSS selector with data-guide="..." (optional for modal/centered steps)
 * - mobileTarget: optional selector to use on mobile when the desktop target is hidden
 * - mobileToolbar: keep the mobile visualization toolbar drawer open for this step
 * - mobilePlacement: optional mobile popover placement ('top' keeps bottom targets visible)
 * - title: Step headline
 * - body: Step description
 * - placement: 'top' | 'bottom' | 'left' | 'right' | 'center'
 * - requires: (ctx) => boolean - predicate to check if prerequisites are met
 * - before: async (ctx) => void - action before step is highlighted (open panels, select feature, etc.)
 * - bodyByViewMode: optional mode-specific body copy
 * - interactive: keep the underlying workspace visually clear for user actions
 */
export const GUIDE_STEPS_BY_VIEW = {
  explorer: [
    {
      id: "toolbar",
      since: 1,
      view: "explorer",
      target: '[data-guide="toolbar"]',
      mobileTarget: '[aria-label="Mobile visualization toolbar"][data-guide="toolbar"]',
      mobileToolbar: true,
      title: "Mission Operations Toolbar",
      body: "Access essential map controls: reset camera overview, toggle NASA layers, switch 2D/3D modes, and toggle celestial ephemeris.",
      placement: "right",
    },
    {
      id: "search",
      since: 1,
      view: "explorer",
      target: '[data-guide="search"]',
      title: "Search Anything",
      body: "Find craters, CLPS landing sites, peaks, or jump directly to coordinates like -85.9, 0.",
      placement: "bottom",
    },
    {
      id: "view-mode",
      since: 1,
      view: "explorer",
      target: '[data-guide="view-mode"]',
      mobileTarget: '[aria-label="Mobile visualization toolbar"] [data-guide="view-mode"]',
      mobileToolbar: true,
      title: "3D Globe & 2D Topo Switch",
      body: "Toggle between the full 3D Cesium planetary sphere and the high-resolution LOLA 2D polar topographic GIS map.",
      placement: "right",
    },
    {
      id: "layers",
      since: 1,
      view: "explorer",
      target: '[data-guide="layers"]',
      mobileTarget: '[aria-label="Mobile visualization toolbar"] [data-guide="layers"]',
      mobileToolbar: true,
      title: "Planetary Datasets & Basemaps",
      body: "Overlay LROC WAC, LOLA DEM elevation contours, slope steepness hazard heatmaps, and surface feature labels.",
      placement: "right",
    },
    {
      id: "click-drop-pin",
      since: 1,
      view: "explorer",
      target: null, // text-only centered step
      title: "Click-the-Moon Pin Drop",
      body: "Click or tap anywhere on the 3D globe or 2D polar map to drop a pin. Instantly evaluate solar illumination, slope hazard, and Earth visibility.",
      bodyByViewMode: {
        "3d": "Click or tap anywhere on the 3D globe to drop a pin. Instantly evaluate solar illumination, slope hazard, and Earth visibility.",
        "2d": "Click or tap anywhere on the 2D polar map to drop a pin. Instantly evaluate solar illumination, slope hazard, and Earth visibility.",
        "sp-2d":
          "Click or tap anywhere on the 2D polar map to drop a pin. Instantly evaluate solar illumination, slope hazard, and Earth visibility.",
      },
      interactive: true,
      placement: "center",
    },
    {
      id: "feature-panel",
      since: 1,
      view: "explorer",
      target: '[data-guide="feature-panel"]',
      requires: (ctx) => Boolean(ctx.hasSelection),
      before: async (ctx) => {
        if (!ctx.hasSelection && ctx.selectTargetFeature) {
          await ctx.selectTargetFeature("landing-artemis3-malapert");
        }
      },
      title: "Feature & Site Telemetry",
      body: "Inspect five scientific tabs: Overview, Terrain (LOLA DEM roughness & slope), Sun Elevation, Direct-to-Earth (DTE) Comms, and Mission Dossier.",
      placement: "left",
    },
    {
      id: "timeline",
      since: 1,
      view: "explorer",
      target: '[data-guide="timeline"]',
      requires: (ctx) => Boolean(ctx.hasSelection),
      title: "Sun and Earth Windows",
      body: "Scrub or drag the playhead along the 30-day timeline to inspect solar illumination and Direct-to-Earth visibility windows over time.",
      placement: "top",
      mobilePlacement: "top",
    },
    {
      id: "workspace-switcher",
      since: 1,
      view: "explorer",
      target: '[data-guide="workspace-switcher"]',
      title: "Mission Workspaces",
      body: "Switch between the Map, Mission Overview, Site Analysis, DTE Communications, and Landing Recommendations workspaces anytime.",
      placement: "bottom",
    },
  ],
  planner: [
    {
      id: "planner-overview",
      since: 1,
      view: "planner",
      target: null,
      title: "Landing Site Recommendations",
      body: "Evaluate Artemis candidates against slope safety, continuous sunlight, and DTE communication constraints.",
      placement: "center",
    },
  ],
  comparison: [
    {
      id: "comparison-overview",
      since: 1,
      view: "comparison",
      target: null,
      title: "Side-by-Side Site Comparison",
      body: "Compare environmental metrics, illumination streaks, and terrain hazards across multiple lunar landing sites.",
      placement: "center",
    },
  ],
};

export const GUIDE_STEPS = Object.values(GUIDE_STEPS_BY_VIEW).flat();

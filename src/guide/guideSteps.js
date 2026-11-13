export const GUIDE_VERSION = 3;

/**
 * Step schema:
 * - id: unique string identifier
 * - since: version number that introduced the step (for 'What's new' incremental tours)
 * - view: view/workspace where this step runs ('explorer', 'planner', 'comparison', etc.)
 * - target: CSS selector with data-guide="..." (optional for modal/centered steps)
 * - mobileTarget: optional selector to use on mobile when the desktop target is hidden
 * - mobileToolbar: keep the mobile visualization toolbar drawer open for this step
 * - mobilePlacement: optionally pin the mobile coachmark to the top for lower-screen targets
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
      body: "Use the map tools to reset the view, change layers and display modes, inspect the celestial ephemeris, and measure or plan a surface route when available.",
      placement: "right",
      forceBottom: true,
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
      body: "Switch between the interactive 3D Moon globe and the 2D South Pole topographic map. The 2D map focuses on 80°S–90°S.",
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
      body: "Open the layer controls to choose lunar basemaps and toggle available terrain, elevation, and feature overlays.",
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
      requires: (ctx) => Boolean(ctx.hasLunarSelection),
      before: async (ctx) => {
        if (!ctx.hasLunarSelection && ctx.selectTargetFeature) {
          await ctx.selectTargetFeature("landing-artemis3-malapert");
        }
      },
      title: "Feature & Site Telemetry",
      body: "Inspect the five current tabs: Terrain, Comms, Temp, Dossier, and Info. Select a map feature or drop a pin to load its analysis.",
      mobileTarget: '[data-guide="feature-panel-header"]',
      placement: "left",
    },
    {
      id: "feature-analysis-tabs",
      since: 2,
      view: "explorer",
      target: '[data-guide="feature-analysis-tabs"]',
      requires: (ctx) => Boolean(ctx.hasLunarSelection),
      before: async (ctx) => {
        if (!ctx.hasLunarSelection && ctx.selectTargetFeature) {
          await ctx.selectTargetFeature("landing-artemis3-malapert");
        }
      },
      title: "Site Analysis Tabs",
      body: "Explore slope and elevation in Terrain, link visibility in Comms, surface conditions in Temp, mission facts in Dossier, and location details in Info.",
      placement: "left",
    },
    {
      id: "site-actions",
      since: 2,
      view: "explorer",
      target: '[data-guide="site-actions"]',
      requires: (ctx) => Boolean(ctx.hasLunarSelection),
      before: async (ctx) => {
        if (!ctx.hasLunarSelection && ctx.selectTargetFeature) {
          await ctx.selectTargetFeature("landing-artemis3-malapert");
        }
      },
      title: "Save, Compare, and Share",
      body: "Save a location for quick access, add lunar sites to the comparison workspace, center the map on them, or copy a shareable link.",
      placement: "left",
      mobilePlacement: "top",
    },
    {
      id: "timeline",
      since: 1,
      view: "explorer",
      target: '[data-guide="timeline"]',
      requires: (ctx) => Boolean(ctx.hasLunarSelection),
      title: "Sun and Earth Windows",
      body: "Scrub the timeline to inspect sunlight and Direct-to-Earth windows, adjust its forecast range, toggle the DTE track, or play ephemeris time.",
      placement: "top",
      mobilePlacement: "top",
    },
    {
      id: "workspace-switcher",
      since: 1,
      view: "explorer",
      target: '[data-guide="workspace-switcher"]',
      mobileTarget: '[aria-label="Mission workspace"]',
      title: "Mission Workspaces",
      body: "Move between Map, Orbit, Planner, Compare, and Library. On smaller screens, use the workspace dropdown in the top bar.",
      placement: "bottom",
    },
    {
      id: "workspace-guides",
      since: 3,
      view: "explorer",
      target: '[data-guide="workspace-switcher"]',
      mobileTarget: '[aria-label="Mission workspace"]',
      title: "Explore Each Workspace's Guide",
      body: "This walkthrough covers Map. Each workspace has its own focused guide: switch to Orbit, Planner, Compare, or Library using the highlighted control, then select Guide in the top bar. You can reopen this Map guide any time.",
      placement: "bottom",
    },
  ],
  trajectory: [
    {
      id: "trajectory-paths",
      since: 2,
      view: "trajectory",
      target: '[data-guide="trajectory-paths"]',
      title: "Choose a Transfer Profile",
      body: "Compare direct, free-return, and low-energy paths here. Choose a launch vehicle above, or switch between the 3D cislunar view and 2D diagram.",
      placement: "left",
      mobilePlacement: "top",
    },
    {
      id: "trajectory-playback",
      since: 2,
      view: "trajectory",
      target: '[data-guide="trajectory-playback"]',
      title: "Run the Flight Simulation",
      body: "Play or pause the transfer, adjust playback speed, or scrub mission elapsed time. Use Camera Focus above to follow the full path, rocket, Earth, or Moon.",
      placement: "left",
      mobilePlacement: "top",
    },
  ],
  planner: [
    {
      id: "planner-overview",
      since: 1,
      view: "planner",
      target: '[data-guide="planner-configuration"]',
      title: "Landing Site Recommendations",
      body: "Set a touchdown epoch, region, and mission duration. Open Configure Constraints to adjust slope, sunlight, communications, and thermal requirements.",
      placement: "bottom",
    },
    {
      id: "planner-recommendations",
      since: 2,
      view: "planner",
      target: '[data-guide="planner-recommendations"]',
      title: "Review Candidate Recommendations",
      body: "Candidate cards summarize compliance, scores, sunlight, communications, terrain, and temperature. Use the filters above to inspect compliant, all, disqualified, or auto-discovered sites, then view or compare a candidate.",
      placement: "top",
    },
  ],
  comparison: [
    {
      id: "comparison-overview",
      since: 1,
      view: "comparison",
      target: '[data-guide="comparison-sites"]',
      title: "Side-by-Side Site Comparison",
      body: "Add sites from the predefined list, enter coordinates, or select locations from the map. Set a mission duration and reference touchdown epoch for the analysis.",
      placement: "bottom",
    },
    {
      id: "comparison-matrix",
      since: 2,
      view: "comparison",
      target: '[data-guide="comparison-matrix"]',
      title: "Explore and Export the Matrix",
      body: "Filter metrics by category, switch between core and detailed columns, inspect parameter provenance, and export the comparison as CSV or a PDF dossier.",
      placement: "top",
    },
  ],
  library: [
    {
      id: "library-sections",
      since: 2,
      view: "library",
      target: '[data-guide="library-sections"]',
      title: "Mission Library and References",
      body: "Browse CLPS and Artemis missions, Earth ground stations, planetary science references, NASA dataset provenance, and keyboard shortcuts.",
      placement: "bottom",
    },
    {
      id: "library-replay",
      since: 2,
      view: "library",
      target: '[data-guide="library-replays"]',
      title: "Replay Historical Touchdowns",
      body: "Choose a listed landing replay to set the shared ephemeris clock to that touchdown and open its site in the lunar map.",
      placement: "bottom",
    },
  ],
};

export const GUIDE_STEPS = Object.values(GUIDE_STEPS_BY_VIEW).flat();

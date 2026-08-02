// Style presets shared by the generate API and the Studio UI.
// Kept out of the route handler file so the Route Handler only exports
// HTTP methods + config (Next typed-routes requires this).

export const STYLE_PRESETS: Record<string, [string, string, string]> = {
  minimal: ["#0c0c0d", "#f7f6f3", "#f1efea"],
  swiss: ["#ff4d18", "#0c0c0d", "#f7f6f3"],
  abstract: ["#6b3df5", "#ff4d18", "#f7f6f3"],
  organic: ["#1f7a4d", "#0c0c0d", "#f7f6f3"],
  bold: ["#0c0c0d", "#f7f6f3", "#ff4d18"],
  radial: ["#2244ff", "#f7f6f3", "#0c0c0d"],
};

/**
 * Each Bypass bot instance is a stage on the bill, with a colour that
 * follows it through every screen: column rule, set blocks, progress,
 * chart series, permission scopes.
 */

export interface StageStyle {
  /** Ink colour of the stage (blocks, rules, series). */
  color: string;
  /** Text colour that reads on top of `color`. */
  on: string;
  /** Tint for quiet backgrounds of this stage. */
  tint: string;
  /** Illustration for the idle / bench state. */
  benchArt: string;
}

const STAGES: Record<number, StageStyle> = {
  1: { color: "#e8402a", on: "#ffffff", tint: "#f7d9cf", benchArt: "/dash/empty-stage-red.webp" },
  2: { color: "#2a5bd7", on: "#ffffff", tint: "#d5dff5", benchArt: "/dash/empty-stage.webp" },
  3: { color: "#f5b700", on: "#151515", tint: "#f6e5b0", benchArt: "/dash/empty-stage-yellow.webp" },
  4: { color: "#1f9d55", on: "#ffffff", tint: "#cfe7d6", benchArt: "/dash/empty-stage-green.webp" },
  5: { color: "#c2187a", on: "#ffffff", tint: "#f1d0e2", benchArt: "/dash/empty-stage-red.webp" },
  6: { color: "#0f8a8a", on: "#ffffff", tint: "#cbe6e4", benchArt: "/dash/empty-stage-green.webp" },
  7: { color: "#f07d16", on: "#151515", tint: "#f8dcc0", benchArt: "/dash/empty-stage-orange.webp" },
  8: { color: "#7c4ddb", on: "#ffffff", tint: "#e0d6f6", benchArt: "/dash/empty-stage.webp" },
};

export function stage(instance: number): StageStyle {
  return STAGES[instance] ?? STAGES[1];
}

export function stageName(instance: number): string {
  return instance === 1 ? "Bypass" : `Bypass ${instance}`;
}

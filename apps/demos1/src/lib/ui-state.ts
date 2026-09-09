import type { ConnStatus } from "@blockreq/ui";

/** Map connection + “has event” into the four feel-baseline states. */
export type FeelState = "idle" | "connecting" | "listening" | "hit";

export function toFeelState(status: ConnStatus, hasHit: boolean): FeelState {
  if (status === "connecting") return "connecting";
  if (hasHit && (status === "listening" || status === "hit")) return "hit";
  if (status === "listening") return "listening";
  // idle | stopped | error → paused/dead-gray
  return "idle";
}

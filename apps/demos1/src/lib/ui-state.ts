import type { ConnStatus } from "@blockreq/ui";

/** Map connection + “has event” into the four feel-baseline states. */
export type FeelState = "idle" | "connecting" | "listening" | "hit";

export function toFeelState(status: ConnStatus, hasHit: boolean): FeelState {
  if (status === "connecting") return "connecting";
  if (status === "hit" || (hasHit && (status === "listening" || status === "idle"))) {
    return "hit";
  }
  if (status === "listening") return "listening";
  return "idle";
}

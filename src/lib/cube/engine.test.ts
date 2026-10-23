import { describe, expect, it, vi } from "vitest";
import { CubeEngine } from "./engine";

describe("cube gesture integrity", () => {
  it("ignores a face swipe if a keyboard turn started after pointer down", () => {
    const onUserMove = vi.fn();
    const resolveFaceGesture = vi.fn();
    const harness = {
      gesture: { kind: "face" },
      pendingCount: () => 1,
      cb: { onUserMove },
      resolveFaceGesture,
    };
    const input = CubeEngine.prototype as unknown as { onMove: (event: PointerEvent) => void };
    input.onMove.call(harness, { clientX: 100, clientY: 100 } as PointerEvent);
    expect(harness.gesture.kind).toBe("spent");
    expect(resolveFaceGesture).not.toHaveBeenCalled();
    expect(onUserMove).not.toHaveBeenCalled();
  });
});
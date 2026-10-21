import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimer } from "./useTimer";

describe("first inspection turn", () => {
  let now = 0;
  beforeEach(() => {
    now = 0;
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    [14999, "none"],
    [15000, "+2"],
    [16999, "+2"],
    [17000, "dnf"],
    [18000, "dnf"],
  ])("starts at %i ms and saves %s with raw solve time", (elapsed, penalty) => {
    const finish = vi.fn();
    const start = vi.fn();
    const { result } = renderHook(() => useTimer({ inspection: true, holdToStart: false, onFinish: finish, onStart: start }));
    act(() => result.current.press());
    act(() => vi.runOnlyPendingTimers());
    act(() => result.current.release());
    expect(result.current.phase).toBe("inspecting");
    now = elapsed;
    act(() => result.current.startOnMove());
    expect(result.current.phase).toBe("running");
    expect(result.current.display).toBe(0);
    expect(start).toHaveBeenCalledTimes(1);
    expect(finish).not.toHaveBeenCalled();
    now += 2345;
    act(() => result.current.stop());
    expect(finish).toHaveBeenCalledWith({ ms: 2345, penalty, inspectionMs: elapsed });
  });

  it("does not start an idle clock on a cube turn", () => {
    const { result } = renderHook(() => useTimer({ inspection: true, holdToStart: false, onFinish: vi.fn() }));
    act(() => result.current.startOnMove());
    expect(result.current.phase).toBe("idle");
  });

  it("Reset cancels inspection without recording an attempt", () => {
    const finish = vi.fn();
    const { result } = renderHook(() => useTimer({ inspection: true, holdToStart: false, onFinish: finish }));
    act(() => result.current.press());
    act(() => vi.runOnlyPendingTimers());
    act(() => result.current.release());
    now = 16000;
    act(() => result.current.reset());
    act(() => result.current.startOnMove());
    expect(result.current.phase).toBe("idle");
    expect(finish).not.toHaveBeenCalled();
  });
});
import { describe, expect, it } from "vitest";
import { bytes, compact, pct, relTime, uptime } from "./format";

describe("format", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  it("relTime", () => {
    expect(relTime(null)).toBe("never");
    expect(relTime("2026-09-14T11:59:50Z", now)).toBe("just now");
    expect(relTime("2026-09-14T11:30:00Z", now)).toBe("30m ago");
    expect(relTime("2026-09-14T09:00:00Z", now)).toBe("3h ago");
    expect(relTime("2026-09-10T12:00:00Z", now)).toBe("4d ago");
    expect(relTime(now - 40 * 86400000, now)).toBe("1mo ago");
  });
  it("compact / bytes / uptime / pct", () => {
    expect(compact(88000)).toBe("88K");
    expect(bytes(512 * 1024 * 1024)).toBe("512.0 MB");
    expect(bytes(0)).toBe("0 B");
    expect(uptime(90061)).toBe("1d 1h 1m");
    expect(uptime(59)).toBe("59s");
    expect(pct(12.5)).toBe("12.5%");
    expect(pct(null)).toBe("—");
  });
});

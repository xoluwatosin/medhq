import { describe, expect, it } from "vitest";
import { areaStatuses, needsAttention, scheduleInWords, timeAgo, worstStatus } from "./system-health";
import { adminDomains, domainDestinations, visibleDomains } from "./admin-nav";
import { ALL_ACCESS_AREAS } from "./admin-access";

const check = (area: string, statuses: ("ok" | "info" | "warning" | "critical")[], extra = {}) => ({
  area,
  enabled: true,
  last_status: null,
  results: statuses.map((status) => ({ status })) as never,
  ...extra,
});

describe("System health", () => {
  it("takes the worst status", () => {
    expect(worstStatus([])).toBe("ok");
    expect(worstStatus(["ok", "info", null])).toBe("info");
    expect(worstStatus(["warning", "critical", "ok"])).toBe("critical");
  });

  it("rolls checks and open alerts up by area, in display order", () => {
    const areas = areaStatuses(
      [check("jobs", ["ok", "warning"]), check("care", ["ok"]), check("email", ["ok"], { enabled: false })],
      [{ area: "care", severity: "critical" }],
    );
    expect(areas).toEqual([
      { key: "care", label: "Care delivery", status: "critical" },
      { key: "jobs", label: "Scheduled jobs", status: "warning" },
    ]);
  });

  it("shows a broken check as needing a look", () => {
    expect(areaStatuses([check("talent", ["ok"], { last_status: "error" })])[0].status).toBe("warning");
  });

  it("counts only open, unacknowledged warnings and criticals for the bell", () => {
    const alerts = [
      { severity: "critical", acknowledged_at: null, resolved_at: null },
      { severity: "warning", acknowledged_at: "2026-10-03T10:00:00Z", resolved_at: null },
      { severity: "warning", acknowledged_at: null, resolved_at: "2026-10-03T10:00:00Z" },
      { severity: "info", acknowledged_at: null, resolved_at: null },
    ] as const;
    expect(needsAttention([...alerts])).toHaveLength(1);
  });

  it("says schedules in words, in Lagos time", () => {
    expect(scheduleInWords("*/5 * * * *")).toBe("Every 5 minutes");
    expect(scheduleInWords("5 * * * *")).toBe("Hourly at :05");
    expect(scheduleInWords("45 6 * * *")).toBe("Daily at 07:45");
    expect(scheduleInWords("30 2 * * 1")).toBe("Mondays at 03:30");
    expect(scheduleInWords("30 23 * * 6")).toBe("Sundays at 00:30");
    expect(scheduleInWords("0 0 1 * *")).toBe("0 0 1 * *");
  });

  it("says how long ago", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    expect(timeAgo("2026-10-03T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-03T11:48:00Z", now)).toBe("12 min ago");
    expect(timeAgo("2026-10-03T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-09-30T12:00:00Z", now)).toBe("3 days ago");
    expect(timeAgo(null, now)).toBe("never");
  });

  it("is a permission-gated Administration destination", () => {
    const admin = adminDomains.find((d) => d.key === "administration")!;
    const item = domainDestinations(admin).find((i) => i.url === "/admin/system");
    expect(item?.perm).toBe("system_health");
    expect(ALL_ACCESS_AREAS.map((a) => a.key)).toContain("system_health");
    const keys = visibleDomains({ isSuperAdmin: false, permissions: ["system_health"] }).map((d) => d.key);
    expect(keys).toContain("administration");
    expect(keys).not.toContain("care");
  });
});

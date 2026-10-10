import { describe, expect, it } from "vitest";
import { canCheckIn, lagosDayKey, mapsUrl, nextVisit, type CareVisit } from "@/lib/visits";

const visit = (over: Partial<CareVisit>): CareVisit => ({
  id: "v",
  episode_id: "e",
  kind: "visit",
  scheduled_start: "2026-10-12T07:00:00Z",
  scheduled_end: "2026-10-12T07:30:00Z",
  status: "scheduled",
  notes: null,
  client_name: "Mama Bisi",
  service_code: null,
  address: null,
  landmark: null,
  lat: null,
  lng: null,
  access_notes: null,
  check_in_at: null,
  check_out_at: null,
  location_flags: [],
  ...over,
});

describe("canCheckIn", () => {
  const v = visit({});
  it("opens an hour before the start and closes at the end", () => {
    expect(canCheckIn(v, Date.parse("2026-10-12T05:59:00Z"))).toBe(false);
    expect(canCheckIn(v, Date.parse("2026-10-12T06:00:00Z"))).toBe(true);
    expect(canCheckIn(v, Date.parse("2026-10-12T07:30:00Z"))).toBe(true);
    expect(canCheckIn(v, Date.parse("2026-10-12T07:31:00Z"))).toBe(false);
  });
  it("is never offered once the visit has started or closed", () => {
    const now = Date.parse("2026-10-12T07:10:00Z");
    for (const status of ["in_progress", "completed", "missed", "cancelled"] as const) {
      expect(canCheckIn(visit({ status }), now)).toBe(false);
    }
  });
});

describe("nextVisit", () => {
  const now = Date.parse("2026-10-12T09:00:00Z");
  it("shows a visit in progress before anything else", () => {
    const list = [
      visit({ id: "a", scheduled_start: "2026-10-12T10:00:00Z", scheduled_end: "2026-10-12T11:00:00Z" }),
      visit({ id: "b", status: "in_progress" }),
    ];
    expect(nextVisit(list, now)?.id).toBe("b");
  });
  it("skips visits already over", () => {
    const list = [
      visit({ id: "past" }),
      visit({ id: "later", scheduled_start: "2026-10-12T10:00:00Z", scheduled_end: "2026-10-12T11:00:00Z" }),
    ];
    expect(nextVisit(list, now)?.id).toBe("later");
  });
  it("returns null when nothing is left", () => {
    expect(nextVisit([visit({ status: "completed" })], now)).toBeNull();
  });
});

describe("lagosDayKey", () => {
  it("groups by the Lagos date, not the UTC date", () => {
    // 23:30 UTC is 00:30 the next day in Lagos (UTC+1).
    expect(lagosDayKey("2026-10-12T23:30:00Z")).toBe("2026-10-13");
    expect(lagosDayKey("2026-10-12T22:30:00Z")).toBe("2026-10-12");
  });
});

describe("mapsUrl", () => {
  it("prefers the pin, then the address, else nothing", () => {
    expect(mapsUrl({ lat: 6.428055, lng: 3.421955, address: "x" })).toContain("query=6.428055,3.421955");
    expect(mapsUrl({ lat: null, lng: null, address: "1 Close, Ikoyi" })).toContain("1%20Close%2C%20Ikoyi");
    expect(mapsUrl({ lat: null, lng: null, address: null })).toBeNull();
  });
});

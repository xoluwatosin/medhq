import { describe, expect, it } from "vitest";
import { lagosToday, shiftDay, sortBoard, weekdaysLabel, type BoardVisit } from "@/lib/care-schedule";

const v = (id: string, start: string, alert: BoardVisit["alert"]): BoardVisit => ({
  id, episode_id: "e", kind: "visit", scheduled_start: start, scheduled_end: start, status: "scheduled", notes: null,
  client_name: "c", service_code: null, address: null, landmark: null, lat: null, lng: null, access_notes: null,
  check_in_at: null, check_out_at: null, location_flags: [], person_id: null, person_name: null,
  check_in_distance_m: null, check_out_distance_m: null, check_out_note: null, close_reason: null, alert,
});

describe("care schedule helpers", () => {
  it("names weekday sets plainly", () => {
    expect(weekdaysLabel([1, 2, 3, 4, 5, 6, 7])).toBe("Every day");
    expect(weekdaysLabel([5, 4, 3, 2, 1])).toBe("Weekdays");
    expect(weekdaysLabel([6, 7])).toBe("Weekends");
    expect(weekdaysLabel([1, 3, 5])).toBe("Mon, Wed, Fri");
  });

  it("moves by whole Lagos days across month ends", () => {
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("knows the Lagos date, not the UTC date", () => {
    expect(lagosToday(new Date("2026-10-12T23:30:00Z"))).toBe("2026-10-13");
  });

  it("puts the most urgent visits first, then by time", () => {
    const sorted = sortBoard([
      v("plain-early", "2026-10-12T06:00:00Z", null),
      v("unassigned", "2026-10-12T09:00:00Z", "unassigned"),
      v("overdue", "2026-10-12T10:00:00Z", "overdue_checkout"),
      v("not-started", "2026-10-12T08:00:00Z", "not_started"),
      v("plain-late", "2026-10-12T05:00:00Z", null),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["overdue", "not-started", "unassigned", "plain-late", "plain-early"]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));
// No Maps key in tests: the list shows on its own.
vi.mock("@/components/portal/GoogleMapsLoader", () => ({ useGoogleMapsReady: () => false }));

import { LiveMap } from "./LiveMap";
import { minutesAgo } from "@/lib/care-schedule";

afterEach(() => { cleanup(); rpc.mockReset(); });

describe("LiveMap", () => {
  it("lists who is on the way and on a visit, with links to Google Maps", async () => {
    rpc.mockResolvedValue({
      data: {
        at: new Date().toISOString(),
        travelling: [{
          journey_id: "j1", person_id: "p1", person_name: "Ada Carer", started_at: new Date().toISOString(),
          lat: 6.43, lng: 3.42, accuracy_m: 12, last_at: new Date(Date.now() - 3 * 60000).toISOString(),
          visit_id: "v1", scheduled_start: new Date().toISOString(), client_name: "Mama Bisi", address: null,
          dest_lat: null, dest_lng: null,
        }],
        on_visit: [{
          visit_id: "v2", person_id: "p2", person_name: "Tunde Carer", client_name: "Baba Femi", address: null,
          check_in_at: new Date().toISOString(), scheduled_end: new Date().toISOString(), lat: 6.5, lng: 3.4, overdue: true,
        }],
        emergencies: [],
      },
      error: null,
    });
    render(<LiveMap />);
    expect(await screen.findByText(/needs the Google Maps key/)).toBeTruthy();
    const way = screen.getByRole("region", { name: "On the way" });
    expect(within(way).getByText(/Last seen 3 minutes ago, within 12 m/)).toBeTruthy();
    expect(within(way).getByText("Open in Google Maps").getAttribute("href")).toContain("6.43,3.42");
    const visits = screen.getByRole("region", { name: "On a visit" });
    expect(within(visits).getByText("Not checked out")).toBeTruthy();
  });

  it("says plainly when nobody is out", async () => {
    rpc.mockResolvedValue({ data: { at: new Date().toISOString(), travelling: [], on_visit: [], emergencies: [] }, error: null });
    render(<LiveMap />);
    expect(await screen.findByText("No one is on the way or on a visit right now")).toBeTruthy();
  });

  it("words the last position plainly", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    expect(minutesAgo(null, now)).toBe("no position yet");
    expect(minutesAgo("2026-10-10T11:59:50Z", now)).toBe("just now");
    expect(minutesAgo("2026-10-10T11:59:00Z", now)).toBe("1 minute ago");
    expect(minutesAgo("2026-10-10T11:45:00Z", now)).toBe("15 minutes ago");
  });
});

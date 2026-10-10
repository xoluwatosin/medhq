import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const soon = () => ({
  id: "v1",
  episode_id: "e1",
  kind: "visit",
  scheduled_start: new Date(Date.now() + 10 * 60000).toISOString(),
  scheduled_end: new Date(Date.now() + 55 * 60000).toISOString(),
  status: "scheduled",
  notes: null,
  client_name: "Mama Bisi",
  service_code: "home_care",
  address: "1 Synthetic Close",
  landmark: "Opposite the pharmacy",
  lat: 6.428055,
  lng: 3.421955,
  access_notes: "Blue gate",
  check_in_at: null,
  check_out_at: null,
  location_flags: [],
});

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));

import { MyVisits } from "./MyVisits";

afterEach(() => { cleanup(); rpc.mockReset(); });

describe("MyVisits", () => {
  it("shows the next visit as a ticket and checks in without a device location", async () => {
    const v = soon();
    rpc.mockImplementation((fn: string) => {
      if (fn === "care_my_visits") return Promise.resolve({ data: [v], error: null });
      if (fn === "care_visit_check_in") {
        return Promise.resolve({
          data: { ...v, status: "in_progress", check_in_at: new Date().toISOString(), location_flags: ["no_location_at_check_in"] },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: "unexpected" } });
    });

    render(<MyVisits />);
    expect(await screen.findByText("Mama Bisi")).toBeTruthy();
    expect(screen.getByText("Access: Blue gate")).toBeTruthy();
    expect(screen.getByText("Open in Maps").getAttribute("href")).toContain("6.428055,3.421955");
    expect(screen.getByText(/location is taken when you check in and out, and on the way/)).toBeTruthy();

    // jsdom has no geolocation, so the visit checks in with no location.
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    expect(await screen.findByRole("button", { name: "Check out" })).toBeTruthy();
    const [, args] = rpc.mock.calls.find(([fn]) => fn === "care_visit_check_in")!;
    expect(args).toMatchObject({ _visit_id: "v1", _lat: undefined, _lng: undefined });
    expect(typeof (args as { _client_event_id: string })._client_event_id).toBe("string");
  });

  it("reuses the same event id when a failed check-in is retried", async () => {
    const v = soon();
    let attempts = 0;
    rpc.mockImplementation((fn: string) => {
      if (fn === "care_my_visits") return Promise.resolve({ data: [v], error: null });
      if (fn !== "care_visit_check_in") return Promise.resolve({ data: null, error: null });
      attempts += 1;
      return attempts === 1
        ? Promise.resolve({ data: null, error: { message: "Network request failed" } })
        : Promise.resolve({ data: { ...v, status: "in_progress", check_in_at: new Date().toISOString() }, error: null });
    });

    render(<MyVisits />);
    fireEvent.click(await screen.findByRole("button", { name: "Check in" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    await screen.findByRole("button", { name: "Check out" });

    const ids = rpc.mock.calls
      .filter(([fn]) => fn === "care_visit_check_in")
      .map(([, a]) => (a as { _client_event_id: string })._client_event_id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("says when there is nothing booked", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    render(<MyVisits />);
    await waitFor(() => expect(screen.getByText("No visits booked in the next seven days.")).toBeTruthy());
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));

const watch = vi.fn((..._args: unknown[]) => 7);
const clear = vi.fn();

import { JourneyControl } from "./JourneyControl";
import type { CareVisit } from "@/lib/visits";

const visit = (minsAhead: number): CareVisit => ({
  id: "v1", episode_id: "e1", kind: "visit",
  scheduled_start: new Date(Date.now() + minsAhead * 60000).toISOString(),
  scheduled_end: new Date(Date.now() + (minsAhead + 30) * 60000).toISOString(),
  status: "scheduled", notes: null, client_name: "Mama Bisi", service_code: null, address: null, landmark: null,
  lat: null, lng: null, access_notes: null, check_in_at: null, check_out_at: null, location_flags: [],
});

afterEach(() => { cleanup(); rpc.mockReset(); watch.mockClear(); clear.mockClear(); });

describe("JourneyControl", () => {
  it("starts sharing on tap and stops watching when stopped", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { watchPosition: watch, clearWatch: clear, getCurrentPosition: (_ok: unknown, fail: () => void) => fail() },
    });
    rpc.mockImplementation((fn: string) => {
      if (fn === "care_my_journey") return Promise.resolve({ data: null, error: null });
      if (fn === "care_journey_start") {
        return Promise.resolve({ data: { id: "j1", visit_id: "v1", started_at: new Date().toISOString(), ended_at: null }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    render(<JourneyControl visit={visit(40)} />);
    fireEvent.click(await screen.findByRole("button", { name: "I'm on my way" }));
    expect(await screen.findByText("Sharing your location with the office until you check in.")).toBeTruthy();
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true });

    fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("care_journey_stop", { _journey_id: "j1" }));
    expect(clear).toHaveBeenCalledWith(7);
    expect(screen.queryByText(/Sharing your location/)).toBeNull();
  });

  it("is not offered more than three hours before the visit", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    render(<JourneyControl visit={visit(200)} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("care_my_journey"));
    expect(screen.queryByRole("button", { name: "I'm on my way" })).toBeNull();
  });

  it("resumes an open journey for this visit when the app reopens", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true, value: { watchPosition: watch, clearWatch: clear, getCurrentPosition: vi.fn() },
    });
    rpc.mockResolvedValue({ data: { id: "j1", visit_id: "v1", started_at: new Date().toISOString(), ended_at: null }, error: null });
    render(<JourneyControl visit={visit(40)} />);
    expect(await screen.findByText("Sharing your location with the office until you check in.")).toBeTruthy();
    expect(watch).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ScheduleTab } from "./ScheduleTab";

const schedule = {
  episode_id: "e1", status: "planned", service_code: "eldercare", client_id: "c1", client_name: "Mama Bisi",
  home_id: "h1", place: { address: "1 Close", landmark: null, lat: null, lng: null, access_notes: null },
  workers: [], patterns: [], visits: [],
};

afterEach(() => { cleanup(); rpc.mockReset(); toast.success.mockReset(); toast.error.mockReset(); });

const answers = (extra: Record<string, unknown> = {}) => (fn: string) => {
  const table: Record<string, unknown> = {
    care_schedule_episodes: [{
      episode_id: "e1", status: "planned", service_code: "eldercare", client_id: "c1", client_name: "Mama Bisi",
      primary_carer: null, patterns: 0, workers: 0, next_visit: null, open_visits: 0, has_pin: false,
    }],
    care_episode_schedule: schedule,
    care_worker_options: [{ person_id: "p1", full_name: "Ada Carer", app_access: true }],
    care_assignment_plan: "as1",
    care_assignment_activate: null,
    ...extra,
  };
  if (fn in table) {
    const v = table[fn];
    return v instanceof Error ? Promise.resolve({ data: null, error: { message: v.message } })
      : Promise.resolve({ data: v, error: null });
  }
  return Promise.resolve({ data: null, error: { message: "unexpected" } });
};

describe("ScheduleTab", () => {
  it("adds a worker to the care, active from today", async () => {
    rpc.mockImplementation(answers());
    render(<MemoryRouter><ScheduleTab /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Mama Bisi/ }));
    expect(await screen.findByText(/This care is planned, not started/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add a worker" }));
    fireEvent.change(await screen.findByLabelText("Worker"), { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: "Add worker" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("care_assignment_activate", { _assignment_id: "as1" }));
    const [, plan] = rpc.mock.calls.find(([fn]) => fn === "care_assignment_plan")!;
    expect(plan).toMatchObject({ _episode_id: "e1", _person_id: "p1", _capability_code: "care_worker" });
  });

  it("explains why care cannot start when the service is not set up", async () => {
    rpc.mockImplementation(answers({
      care_episode_activate: new Error("That service has no published configuration to start care against"),
    }));
    render(<MemoryRouter><ScheduleTab /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Mama Bisi/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Start this care" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "That service has no published configuration to start care against"));
  });
});

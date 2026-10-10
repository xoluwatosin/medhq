import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TodayBoard } from "./TodayBoard";

const at = (mins: number) => new Date(Date.now() + mins * 60000).toISOString();
const visit = (over: Record<string, unknown>) => ({
  id: "v", episode_id: "e1", kind: "visit", scheduled_start: at(60), scheduled_end: at(90), status: "scheduled",
  notes: null, client_name: "Mama Bisi", service_code: null, address: "1 Close", landmark: null, lat: null, lng: null,
  access_notes: null, check_in_at: null, check_out_at: null, location_flags: [], person_id: "p1", person_name: "Ada Carer",
  check_in_distance_m: null, check_out_distance_m: null, check_out_note: null, close_reason: null, alert: null, ...over,
});

const board = {
  day: "2026-10-10",
  emergencies: [{
    id: "a1", status: "open", raised_at: at(-5), person_id: "p2", person_name: "Tunde Carer", visit_id: null,
    client_name: null, address: null, lat: 6.45, lng: 3.39, accuracy_m: 20, note: "Car accident", acknowledged_at: null,
  }],
  visits: [
    visit({ id: "plain", client_name: "Plain Client" }),
    visit({ id: "late", client_name: "Overdue Client", status: "in_progress", check_in_at: at(-120),
            scheduled_start: at(-120), scheduled_end: at(-60), alert: "overdue_checkout" }),
    visit({ id: "open", client_name: "Open Client", person_id: null, person_name: null, alert: "unassigned" }),
  ],
};

afterEach(() => { cleanup(); rpc.mockReset(); });

describe("TodayBoard", () => {
  it("shows emergencies first and visits needing action above the rest", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "care_visits_board") return Promise.resolve({ data: board, error: null });
      if (fn === "care_worker_alert_update") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: { message: "unexpected" } });
    });
    render(<TodayBoard />);
    const emergency = await screen.findByRole("article", { name: "Emergency from Tunde Carer" });
    expect(within(emergency).getByText("“Car accident”")).toBeTruthy();
    expect(within(emergency).getByText("Where they were").getAttribute("href")).toContain("6.45,3.39");

    const needs = screen.getByRole("region", { name: /Needs attention/ });
    const names = within(needs).getAllByText(/Client$/).map((n) => n.textContent);
    expect(names).toEqual(["Overdue Client", "Open Client"]);
    expect(within(needs).getByText("Not checked out")).toBeTruthy();
    expect(screen.queryAllByText("Plain Client")).toHaveLength(1);

    fireEvent.click(within(emergency).getByRole("button", { name: "Acknowledge" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("care_worker_alert_update",
      { _alert_id: "a1", _status: "acknowledged", _note: null }));
  });

  it("assigns a worker from the people on that care", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "care_visits_board") return Promise.resolve({ data: board, error: null });
      if (fn === "care_episode_schedule") {
        return Promise.resolve({ data: { workers: [
          { person_id: "p1", name: "Ada Carer", assignment_status: "active", effective_from: "2026-10-01", effective_to: null, app_access: true },
          { person_id: "p9", name: "No App", assignment_status: "active", effective_from: "2026-10-01", effective_to: null, app_access: false },
        ] }, error: null });
      }
      if (fn === "care_visit_assign") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: { message: "unexpected" } });
    });
    render(<TodayBoard />);
    const needs = await screen.findByRole("region", { name: /Needs attention/ });
    fireEvent.click(within(needs).getByRole("button", { name: "Assign a worker" }));
    const select = await screen.findByLabelText("Worker");
    expect((within(select).getByRole("option", { name: "No App (no app access)" }) as HTMLOptionElement).disabled).toBe(true);
    fireEvent.change(select, { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("care_visit_assign", { _visit_id: "open", _person_id: "p1" }));
  });
});

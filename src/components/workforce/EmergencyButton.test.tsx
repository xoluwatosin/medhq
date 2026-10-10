import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));

import { EmergencyButton } from "./EmergencyButton";

afterEach(() => { cleanup(); rpc.mockReset(); });

describe("EmergencyButton", () => {
  it("needs two taps, then sends with the visit and no location", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "care_my_open_alert") return Promise.resolve({ data: null, error: null });
      if (fn === "care_worker_alert_raise") {
        return Promise.resolve({ data: { id: "a1", status: "open", raised_at: new Date().toISOString(), acknowledged_at: null }, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unexpected" } });
    });
    render(<EmergencyButton visitId="v1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Emergency" }));
    expect(rpc.mock.calls.some(([fn]) => fn === "care_worker_alert_raise")).toBe(false);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Aggressive visitor" } });
    fireEvent.click(screen.getByRole("button", { name: "Send now" }));
    expect(await screen.findByText("Emergency sent. The office has been told.")).toBeTruthy();
    const [, args] = rpc.mock.calls.find(([fn]) => fn === "care_worker_alert_raise")!;
    expect(args).toMatchObject({ _visit_id: "v1", _lat: undefined, _note: "Aggressive visitor" });
  });

  it("keeps one event id across a failed send and its retry", async () => {
    let tries = 0;
    rpc.mockImplementation((fn: string) => {
      if (fn === "care_my_open_alert") return Promise.resolve({ data: null, error: null });
      tries += 1;
      return tries === 1
        ? Promise.resolve({ data: null, error: { message: "Network request failed" } })
        : Promise.resolve({ data: { id: "a1", status: "open", raised_at: new Date().toISOString(), acknowledged_at: null }, error: null });
    });
    render(<EmergencyButton visitId={null} />);
    fireEvent.click(await screen.findByRole("button", { name: "Emergency" }));
    fireEvent.click(screen.getByRole("button", { name: "Send now" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send now" }));
    await screen.findByText("Emergency sent. The office has been told.");
    const ids = rpc.mock.calls.filter(([fn]) => fn === "care_worker_alert_raise")
      .map(([, a]) => (a as { _client_event_id: string })._client_event_id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("shows when the office has acknowledged an open alert", async () => {
    rpc.mockResolvedValue({
      data: { id: "a1", status: "acknowledged", raised_at: new Date().toISOString(), acknowledged_at: new Date().toISOString() },
      error: null,
    });
    render(<EmergencyButton visitId={null} />);
    expect(await screen.findByText("The office has your alert and is acting on it.")).toBeTruthy();
  });
});

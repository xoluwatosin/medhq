import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// A stand-in database: each function name answers with fixed data.
const rpcAnswers: Record<string, unknown> = {};
const tableAnswers: Record<string, unknown[]> = {};

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const result = Promise.resolve({ data: tableAnswers[table] ?? [], error: null });
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "lte", "order"]) q[m] = () => q;
    q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result.then(resolve, reject);
    return q;
  };
  return {
    supabase: {
      rpc: (fn: string) => Promise.resolve({ data: rpcAnswers[fn] ?? null, error: null }),
      from: (table: string) => chain(table),
    },
  };
});

import { MyLeave, PersonLeave, Reviews } from "./HrPanels";

const leave = (over: Record<string, unknown>) => ({
  id: "l1", person_id: "p1", full_name: "Muminat Anisere", leave_type: "annual", from_date: "2026-11-16", to_date: "2026-11-20",
  working_days: 5, reason: "Family visit", status: "requested", decision_note: null, decided_by_name: null, decided_at: null,
  created_at: "2026-10-09T10:00:00Z", can_decide: false, ...over,
});

beforeEach(() => {
  for (const k of Object.keys(rpcAnswers)) delete rpcAnswers[k];
  for (const k of Object.keys(tableAnswers)) delete tableAnswers[k];
});

describe("HR panels", () => {
  it("shows a person their balance and their own requests, without approve buttons", async () => {
    rpcAnswers.hr_leave_balance = { ok: true, year: 2026, allowance: 20, taken: 3, booked: 5, pending: 0, remaining: 12 };
    rpcAnswers.hr_leave_list = [leave({})];
    render(<MemoryRouter><MyLeave personId="p1" /></MemoryRouter>);
    expect(await screen.findByText("Annual leave")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/16 to 20 Nov 2026, 5 working days/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByRole("button", { name: "Withdraw this request" })).toBeInTheDocument();
  });

  it("lets a manager decide only the requests the database says they can", async () => {
    rpcAnswers.hr_leave_balance = { ok: true, year: 2026, allowance: null, taken: 0, booked: 0, pending: 5, remaining: null };
    rpcAnswers.hr_leave_list = [leave({ can_decide: true }), leave({ id: "l2", status: "approved", from_date: "2026-08-03", to_date: "2026-08-03", working_days: 1, decided_by_name: "Munachim Frank-Dobi" })];
    render(<MemoryRouter><PersonLeave personId="p1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(1));
    expect(screen.getByText(/Approved by Munachim Frank-Dobi/)).toBeInTheDocument();
  });

  it("lets a person answer a shared review but never write their own", async () => {
    tableAnswers.hr_reviews = [{
      id: "r1", person_id: "p1", reviewer_person_id: "m1", kind: "probation", period_label: null, due_date: "2026-12-01",
      status: "shared", rating: 4, achievements: "Strong partnerships work", development: null, objectives: "Two new partners",
      outcome: "passed", employee_comments: null, shared_at: "2026-12-01T10:00:00Z", acknowledged_at: null, created_at: "2026-11-01T10:00:00Z",
    }];
    render(<MemoryRouter><Reviews personId="p1" manage={false} myPersonId="p1" /></MemoryRouter>);
    expect(await screen.findByText("Strong partnerships work")).toBeInTheDocument();
    expect(screen.getByText(/Passed probation/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add comments and confirm" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Book a review" })).toBeNull();
  });
});

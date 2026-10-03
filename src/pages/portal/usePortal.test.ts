// Regression cover for the portal queue: once a question is settled as
// candidate_updated, it must not come back to the candidate on reload.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

type Row = { id: string; field: string; value: string | null; status: string; note: string | null };

const state: { person: any; rows: Row[]; docs: any[] } = {
  person: null,
  rows: [],
  docs: [],
};

const navigate = vi.fn();

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", user_metadata: {} }, loading: false }),
}));
vi.mock("@/lib/documents", () => ({ loadRequirements: async () => [] }));
vi.mock("@/components/DocumentRequestList", () => ({ loadDocumentRequests: async () => [] }));
vi.mock("@/lib/work-preferences", () => ({
  loadPreferences: async () => ({}),
  preferencesComplete: () => true,
}));

vi.mock("@/integrations/supabase/client", () => {
  const result = (data: unknown) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => Promise.resolve({ data, error: null }),
      maybeSingle: () => Promise.resolve({ data, error: null }),
      update: () => chain,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data, error: null }).then(res, rej),
    };
    return chain;
  };
  return {
    supabase: {
      from: (table: string) =>
        result(
          table === "mu_people" ? state.person
            : table === "mu_parsed_fields" ? state.rows
            : table === "mu_documents" ? state.docs
            : [],
        ),
      rpc: async () => ({ data: [], error: null }),
    },
  };
});

const { usePortal } = await import("./usePortal");

const person = (extra: Record<string, unknown> = {}) => ({
  id: "person-1",
  full_name: "Test Candidate",
  contact_verified_at: "2026-01-01T00:00:00Z",
  state: "Lagos",
  lga: "Ikeja",
  profession: "Registered Nurse",
  location_source: "candidate_stated",
  track: "clinical",
  track_source: "candidate_stated",
  claimed_at: "2026-01-01T00:00:00Z",
  candidate_gaps: [],
  ...extra,
});

beforeEach(() => {
  navigate.mockClear();
  state.person = person();
  state.rows = [];
  state.docs = [{ id: "d1", label: "CV — test.pdf", url: "x", verified: false, created_at: "2026-01-01" }];
});

describe("usePortal queue", () => {
  it("asks a pending imported detail once", async () => {
    state.rows = [
      { id: "pf-1", field: "sex", value: "Female", status: "pending", note: null },
      { id: "pf-2", field: "sex", value: "F", status: "accepted", note: null },
    ];
    const { result } = renderHook(() => usePortal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.attention.filter((r) => r.field === "sex")).toHaveLength(1);
  });

  it("drops the question once the row is settled as candidate_updated", async () => {
    state.rows = [{ id: "pf-1", field: "sex", value: "Female", status: "pending", note: null }];
    const { result } = renderHook(() => usePortal());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.attention.some((r) => r.field === "sex")).toBe(true);

    // What a successful save leaves behind in the database.
    state.rows = [{ id: "pf-1", field: "sex", value: "Female", status: "candidate_updated", note: null }];
    state.person = person({ sex: "Female" });
    await result.current.reload();
    await waitFor(() =>
      expect(result.current.rows[0]?.status).toBe("candidate_updated"), { timeout: 2000 });
    expect(result.current.attention.some((r) => r.field === "sex")).toBe(false);
    expect(result.current.later.some((r) => r.field === "sex")).toBe(false);
  });

  it("does not re-ask a gap the profile now holds", async () => {
    state.rows = [];
    state.person = person({ candidate_gaps: ["sex", "license_number"], sex: "Female" });
    const { result } = renderHook(() => usePortal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.attention.map((r) => r.field)).toEqual(["license_number"]);
  });
});

// Regression cover for settling imported details: the right rows must be
// updated, and a settled question must not come back to the candidate.
import { describe, it, expect, beforeEach, vi } from "vitest";

type UpdateCall = {
  table: string;
  patch: Record<string, unknown>;
  filters: Record<string, unknown>;
};

const updateCalls: UpdateCall[] = [];
const rpcCalls: { fn: string; args: unknown }[] = [];
let selectResult: { data: unknown[]; error: unknown } = { data: [{ id: "row-1" }], error: null };
let updateError: { message: string } | null = null;
let rpcError: { message: string } | null = null;

const makeUpdateChain = (call: UpdateCall) => {
  const chain: any = {
    eq: (column: string, value: unknown) => {
      call.filters[column] = value;
      return chain;
    },
    select: () => Promise.resolve(selectResult),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: updateError }).then(resolve, reject),
  };
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => {
        const call: UpdateCall = { table, patch, filters: {} };
        updateCalls.push(call);
        return makeUpdateChain(call);
      },
    }),
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: null, error: rpcError });
    },
  },
}));

const { settlePortalFields, updateOwnProfile, savePortalField } = await import("./portal-actions");

beforeEach(() => {
  updateCalls.length = 0;
  rpcCalls.length = 0;
  selectResult = { data: [{ id: "row-1" }], error: null };
  updateError = null;
  rpcError = null;
});

describe("settlePortalFields", () => {
  it("settles one row per profile field, scoped to the person", async () => {
    const error = await settlePortalFields({ state: "Lagos", lga: "Ikeja" }, "person-1");

    expect(error).toBeNull();
    expect(updateCalls).toHaveLength(2);
    for (const call of updateCalls) {
      expect(call.table).toBe("mu_parsed_fields");
      expect(call.patch.status).toBe("candidate_updated");
      expect(call.filters.person_id).toBe("person-1");
    }
    expect(updateCalls.map((c) => c.filters.field).sort()).toEqual(["lga", "state"]);
    expect(updateCalls.map((c) => c.patch.value).sort()).toEqual(["Ikeja", "Lagos"]);
  });

  it("ignores fields the candidate does not own and empty values", async () => {
    await settlePortalFields({ verified: "yes", state: null, admin_note: "x" }, "person-1");
    expect(updateCalls).toHaveLength(0);
  });

  it("reports the failure when a settlement is refused", async () => {
    updateError = { message: "denied" };
    const error = await settlePortalFields({ state: "Lagos" }, "person-1");
    expect(error).toBe("denied");
  });
});

describe("updateOwnProfile", () => {
  it("writes the profile then settles the same fields so they are not asked again", async () => {
    const { error } = await updateOwnProfile({ profession: "Registered Nurse" }, "person-1");

    expect(error).toBeNull();
    expect(rpcCalls[0]).toEqual({
      fn: "mu_candidate_update_profile",
      args: { _patch: { profession: "Registered Nurse" } },
    });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].filters).toEqual({ field: "profession", person_id: "person-1" });
    expect(updateCalls[0].patch).toEqual({
      value: "Registered Nurse",
      status: "candidate_updated",
    });
  });

  it("does not settle anything when the profile write fails", async () => {
    rpcError = { message: "no" };
    const { error } = await updateOwnProfile({ profession: "Midwife" }, "person-1");
    expect(error).toBe("no");
    expect(updateCalls).toHaveLength(0);
  });
});

describe("savePortalField", () => {
  it("settles a profile question through the profile door", async () => {
    const { error } = await savePortalField(
      "person-1",
      { id: "pf-9", field: "state" },
      "Lagos",
    );

    expect(error).toBeNull();
    expect(rpcCalls).toHaveLength(1);
    expect(updateCalls[0].filters).toEqual({ field: "state", person_id: "person-1" });
  });

  it("marks a non-profile row as candidate_updated for that person only", async () => {
    const { error } = await savePortalField(
      "person-1",
      { id: "pf-9", field: "certifications" },
      "BLS",
    );

    expect(error).toBeNull();
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].filters).toEqual({ person_id: "person-1", field: "certifications" });
    expect(updateCalls[0].patch.status).toBe("candidate_updated");
  });

  it("tells the candidate when nothing was actually updated", async () => {
    selectResult = { data: [], error: null };
    const { error } = await savePortalField(
      "person-1",
      { id: "pf-9", field: "certifications" },
      "BLS",
    );
    expect(error).toBe("The confirmation was not saved.");
  });

  it("does not touch rows for questions answered on their own screen", async () => {
    const { error } = await savePortalField("person-1", { id: "pf-9", field: "references" }, "x");
    expect(error).toBeNull();
    expect(updateCalls).toHaveLength(0);
  });
});

// Two things on the device must never drift: the order work replays in, and
// what the assessor is shown while some of it is still held here.
import { describe, expect, it } from "vitest";
import { mergedResponses, orderEvents, type CaptureEvent } from "@/lib/care-offline";

const event = (over: Partial<CaptureEvent>): CaptureEvent => ({
  client_event_id: "a",
  owner_id: "owner",
  assessment_id: "visit",
  client_id: "client",
  document_id: "doc",
  scope_key: "owner::visit::doc",
  field_id: "note.core_a",
  value: null,
  captured_at: "2026-01-01T10:00:00.000Z",
  client_seq: 1,
  state: "pending",
  ...over,
});

describe("local ordering", () => {
  it("replays in the order the assessor wrote, not the order of the clock", () => {
    const rows = [
      event({ client_event_id: "second", client_seq: 2, captured_at: "2026-01-01T09:59:00.000Z", value: "later" }),
      event({ client_event_id: "first", client_seq: 1, captured_at: "2026-01-01T10:00:00.000Z", value: "earlier" }),
    ];
    expect(orderEvents(rows).map((r) => r.client_event_id)).toEqual(["first", "second"]);
  });

  it("falls back to the clock, then the identifier, when sequences tie", () => {
    const rows = [
      event({ client_event_id: "b", client_seq: 1, captured_at: "2026-01-01T10:00:00.000Z" }),
      event({ client_event_id: "a", client_seq: 1, captured_at: "2026-01-01T10:00:00.000Z" }),
      event({ client_event_id: "c", client_seq: 1, captured_at: "2026-01-01T09:00:00.000Z" }),
    ];
    expect(orderEvents(rows).map((r) => r.client_event_id)).toEqual(["c", "a", "b"]);
  });

  it("puts the last edit of one field on top, whatever order it arrives in", () => {
    const merged = mergedResponses({ responses: { "note.core_a": "from the server" } }, [
      event({ client_event_id: "late", client_seq: 3, value: "final" }),
      event({ client_event_id: "early", client_seq: 2, value: "draft" }),
    ]);
    expect(merged["note.core_a"]).toBe("final");
  });

  it("shows what the server holds when nothing is held here", () => {
    expect(mergedResponses({ responses: { "confirm.who_for": { decision: "confirmed" } } }, []))
      .toEqual({ "confirm.who_for": { decision: "confirmed" } });
  });
});

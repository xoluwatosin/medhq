import { describe, expect, it } from "vitest";
import { selectRequest, type GroupRequest } from "@/lib/care-group";

// One family and care group with two requests that share the same recipients,
// as happens when a second enquiry is opened for the same people.
const sharedRecipients: GroupRequest["recipients"] = [
  { id: "recipient-1", client_id: "client-1", person_id: null, full_name: "Recipient one", display_order: 0, address_line: null },
];

const requestA: GroupRequest = {
  id: "request-a",
  status: "open",
  source: "phone",
  enquirer_person_id: "person-a",
  created_at: "2024-01-01T00:00:00Z",
  recipients: sharedRecipients,
  services: [],
};

const requestB: GroupRequest = {
  id: "request-b",
  status: "open",
  source: "email",
  enquirer_person_id: "person-b",
  created_at: "2024-02-01T00:00:00Z",
  recipients: sharedRecipients,
  services: [],
};

const requests = [requestA, requestB];

describe("selectRequest", () => {
  it("returns the requested request when its id matches", () => {
    expect(selectRequest(requests, "request-a")).toBe(requestA);
  });

  it("returns the other requested request when its id matches", () => {
    expect(selectRequest(requests, "request-b")).toBe(requestB);
  });

  it("falls back to the first request when the id is unknown", () => {
    expect(selectRequest(requests, "request-unknown")).toBe(requestA);
  });

  it("falls back to the first request when no id is given", () => {
    expect(selectRequest(requests, null)).toBe(requestA);
    expect(selectRequest(requests, undefined)).toBe(requestA);
  });
});

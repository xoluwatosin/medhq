import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const rows = [
  { id: "n1", kind: "leave_requested", title: "Muminat Anisere asked for leave", body: "Annual leave, 21 to 24 Dec 2026", link: "/admin/me?person=p1", created_at: new Date().toISOString(), read_at: null },
  { id: "n2", kind: "post_approved", title: "Your post is live", body: "Test post", link: "/admin/posts/x", created_at: "2026-10-01T10:00:00Z", read_at: "2026-10-01T11:00:00Z" },
];
const rpc = vi.fn(() => Promise.resolve({ data: 1, error: null }));

vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit"]) q[m] = () => q;
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
  return { supabase: { from: () => q, rpc: (...a: unknown[]) => rpc(...(a as [])) } };
});

import { NotificationBell } from "./NotificationBell";
import { timeAgo } from "@/lib/notifications";

const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; };

describe("NotificationBell", () => {
  it("counts unread, and opening one marks it read and follows its link", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <NotificationBell />
        <Routes><Route path="*" element={<Where />} /></Routes>
      </MemoryRouter>,
    );
    const bell = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    fireEvent.click(bell);
    fireEvent.click(await screen.findByText("Muminat Anisere asked for leave"));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin/me?person=p1"));
    expect(rpc).toHaveBeenCalledWith("staff_notifications_read", { _ids: ["n1"] });
  });

  it("says when things happened in plain words", () => {
    const now = new Date("2026-10-09T12:00:00Z").getTime();
    expect(timeAgo("2026-10-09T11:59:40Z", now)).toBe("Just now");
    expect(timeAgo("2026-10-09T11:55:00Z", now)).toBe("5 min ago");
    expect(timeAgo("2026-10-08T09:00:00Z", now)).toBe("Yesterday");
    expect(timeAgo("2026-10-01T09:00:00Z", now)).toBe("1 Oct");
  });
});

// Programmes: the register of Medic Connect's named programmes.
//
// Navigation composition only. Each row opens the existing Admin workspace for
// that programme; nothing about how those workspaces behave changes here.
import { useEffect, useState } from "react";
import ConsolePageHeader from "@/components/admin/console/ConsolePageHeader";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { Status } from "@/components/field";
import { useAuth } from "@/contexts/AuthContext";
import { adminDb } from "@/lib/admin-utils";

interface ProgrammeRow {
  key: string;
  title: string;
  detail: string;
  to: string;
  open: number;
}

const Programmes = () => {
  const { isSuperAdmin, permissions } = useAuth();
  const can = (permission: string) => isSuperAdmin || permissions.includes(permission);
  const [rows, setRows] = useState<ProgrammeRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const db = adminDb();
      const creator = can("creator_applications")
        ? await db.from("creator_applications").select("id", { count: "exact", head: true }).eq("status", "new")
        : { count: 0 };
      setRows([
        can("creator_applications")
          ? {
              key: "creator",
              title: "Creator",
              detail: "Creator applications and content partners",
              to: "/admin/creator-applications",
              open: creator.count ?? 0,
            }
          : null,
      ].filter((row): row is ProgrammeRow => Boolean(row)));
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, permissions]);

  return (
    <section className="mx-auto w-full max-w-[960px]" aria-labelledby="programmes-heading">
      <ConsolePageHeader id="programmes-heading" title="Programmes" description="Medic Connect programmes and the applications waiting on each one." />
      <ConsoleMobileList
        className="block"
        emptyLabel="No programmes"
        rows={rows.map((row) => ({
          key: row.key,
          title: row.title,
          state: row.detail,
          status: (
            <Status
              label={row.open === 1 ? "One new application" : `${row.open} new applications`}
              tone={row.open > 0 ? "info" : "neutral"}
            />
          ),
          to: row.to,
        }))}
      />
    </section>
  );
};

export default Programmes;

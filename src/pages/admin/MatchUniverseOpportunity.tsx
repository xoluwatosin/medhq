import { useEffect, useState } from "react";
import { Link, useParams, useLocation, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminDb } from "@/lib/admin-utils";
import { MuEmpty, MuPageHeader } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import MatchmakerEditor from "./MatchmakerEditor";
import MatchmakerApplications from "./MatchmakerApplications";
import MatchmakerMatches from "./MatchmakerMatches";

export default function MatchUniverseOpportunity() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [op, setOp] = useState<{ id: string; title: string; slug: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminDb()
      .from("matchmaker_opportunities")
      .select("id, title, slug")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setOp(data as any);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!op) {
    return (
      <div className="border border-line bg-card">
        <MuEmpty
          art={art.objMagnifier}
          title="Opportunity not found"
          description="It may have been deleted, or it could not be loaded."
          action={
            <Button variant="outline" asChild>
              <Link to="/admin/match-universe/opportunities">Back to opportunities</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const path = location.pathname;
  const activeTab = path.endsWith("/matches")
    ? "matches"
    : path.endsWith("/applications")
      ? "applications"
      : "details";

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <MuPageHeader
        title={op.title}
        description={`/hm/${op.slug}`}
        backTo="/admin/match-universe/opportunities"
        backLabel="Opportunities"
      />

      <Tabs value={activeTab}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="details" asChild>
              <Link to={`/admin/match-universe/opportunities/${op.id}`}>Details</Link>
            </TabsTrigger>
            <TabsTrigger value="applications" asChild>
              <Link to={`/admin/match-universe/opportunities/${op.id}/applications`}>Applications</Link>
            </TabsTrigger>
            <TabsTrigger value="matches" asChild>
              <Link to={`/admin/match-universe/opportunities/${op.id}/matches`}>Matches</Link>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Kept mounted so edits survive a look at Applications or Matches. */}
        <TabsContent value="details" forceMount className="mt-4 data-[state=inactive]:hidden">
          <MatchmakerEditor embedded />
        </TabsContent>
        <TabsContent value="applications" className="mt-4">
          <MatchmakerApplications embedded />
        </TabsContent>
        <TabsContent value="matches" className="mt-4">
          <MatchmakerMatches embedded />
        </TabsContent>
      </Tabs>

    </div>
  );
}

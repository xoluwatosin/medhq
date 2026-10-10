import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { MapPin, ArrowLeft, Loader2, Eye } from "lucide-react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { adminDb } from "@/lib/admin-utils";
import ShareButtons from "@/components/matchmaker/ShareButtons";
import type { DocumentField, Question } from "@/lib/matchmaker";

interface Opp {
  id: string; slug: string; title: string; summary: string | null; description: string | null;
  location: string | null; role_details: string | null; requirements: string | null;
  document_fields: DocumentField[]; questions: Question[]; status: string; link_target: "detail" | "landing";
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="kit-curve-sm border border-border bg-background p-5 sm:p-7">
    <h2 className="font-serif text-xl sm:text-2xl font-semibold mb-3">{title}</h2>
    <div className="prose-base text-foreground/85 whitespace-pre-wrap leading-relaxed">{children}</div>
  </section>
);

const MatchmakerOpportunity = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const isPreview = search.get("preview") === "1";
  const [opp, setOpp] = useState<Opp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await adminDb()
        .from("matchmaker_opportunities")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      setOpp(data ? {
        ...data,
        document_fields: Array.isArray(data.document_fields) ? data.document_fields : [],
        questions: Array.isArray(data.questions) ? data.questions : [],
      } : null);
      setLoading(false);
    })();
  }, [slug]);

  const shareUrl = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/hm/${slug || ""}` : ""),
    [slug]
  );

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <SEO title="Opportunity not found | Medic Connect" description="This Matchmakers opportunity could not be found." path={`/hm/${slug || ""}`} noindex breadcrumbs={[]} />
        <MedicHeader />
        <main className="flex-1 pt-24 pb-16">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h1 className="font-serif text-3xl font-bold">Opportunity not found</h1>
            <p className="text-muted-foreground mt-3">This link may have been mistyped, or the draft is not visible without an admin session.</p>
            <Button asChild className="mt-6"><Link to="/hm">View all opportunities</Link></Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isClosed = opp.status === "closed";
  const isDraft = opp.status === "draft" || opp.status === "archived";
  const canApply = !isClosed && !isDraft;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SEO
        title={`${opp.title} | Healthcare Matchmakers Network`}
        description={opp.summary || "Healthcare opportunity placed by Medic Connect."}
        path={`/hm/${opp.slug}`}
        noindex
        breadcrumbs={[]}
      />
      <MedicHeader />

      {/* Hero block — tight to the header, muted band so there's no dead space */}
      <section className="bg-muted/40 border-b border-border pt-20 sm:pt-24 pb-8 sm:pb-10">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-3">
            <Link to="/hm"><ArrowLeft className="mr-2 h-4 w-4" />All opportunities</Link>
          </Button>

          {(isDraft || isPreview) && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-sm text-amber-900">
              <Eye className="h-4 w-4" />
              Preview mode, status: {opp.status}
            </div>
          )}

          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-2">Healthcare Matchmakers Network</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight">{opp.title}</h1>
          {opp.location && (
            <p className="text-base text-muted-foreground mt-3 inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />{opp.location}
            </p>
          )}
          {opp.summary && <p className="text-base sm:text-lg text-foreground/80 mt-4 max-w-2xl">{opp.summary}</p>}

          {canApply && (
            <div className="mt-6 hidden sm:block">
              <Button size="lg" className="rounded-full" onClick={() => navigate(`/hm/${opp.slug}/apply`)}>
                Apply for this role
              </Button>
            </div>
          )}
        </div>
      </section>

      <main className="flex-1 pb-32 sm:pb-16 pt-8 sm:pt-10">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 space-y-5 sm:space-y-6">
          {isClosed && (
            <div className="kit-curve-sm border border-border bg-muted/40 p-5">
              <p className="font-medium text-lg">This opportunity has closed.</p>
              <p className="text-base text-muted-foreground mt-1">
                Thank you for your interest. This role is no longer accepting applications.{" "}
                <Link to="/hm" className="underline">See other open opportunities</Link>.
              </p>
            </div>
          )}

          {opp.description && <Section title="About the job">{opp.description}</Section>}
          {opp.role_details && <Section title="Role details">{opp.role_details}</Section>}
          {opp.requirements && <Section title="Requirements">{opp.requirements}</Section>}

          <div className="kit-curve-sm border border-border bg-background p-5 sm:p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Know someone right for this?</p>
            <ShareButtons opportunityId={opp.id} title={opp.title} url={shareUrl} />
          </div>
        </div>
      </main>

      {/* Mobile sticky apply bar */}
      {canApply && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button size="lg" className="w-full rounded-full" onClick={() => navigate(`/hm/${opp.slug}/apply`)}>
            Apply for this role
          </Button>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default MatchmakerOpportunity;

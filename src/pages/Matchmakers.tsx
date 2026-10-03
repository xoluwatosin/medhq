import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ArrowRight } from "lucide-react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { adminDb } from "@/lib/admin-utils";
import ShareButtons from "@/components/matchmaker/ShareButtons";

interface Opp {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  status: string;
}

const Matchmakers = () => {
  const [open, setOpen] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await adminDb()
        .from("matchmaker_opportunities")
        .select("id, slug, title, summary, location, status")
        .eq("status", "open")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      setOpen(data || []);
      setLoading(false);
    })();
  }, []);

  const url = typeof window !== "undefined" ? window.location.origin + "/hm" : "";

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SEO
        title="Healthcare Matchmakers Network — Medic Connect"
        description="Curated healthcare opportunities placed through Medic Connect's Matchmakers Network."
        path="/hm"
        noindex
        breadcrumbs={[]}
      />
      <MedicHeader />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">By invitation</p>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">Healthcare Matchmakers Network</h1>
          <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-2xl">
            Healthcare opportunities we are currently placing. Some sit inside Medic Connect, others
            are roles we are filling on behalf of trusted partners. Browse what's open, apply
            directly, or pass it on to someone in your network.
          </p>

          <div className="mt-6">
            <ShareButtons opportunityId={null} title="Healthcare Matchmakers Network — open opportunities" url={url} />
          </div>

          <div className="mt-12 space-y-3">
            {loading ? (
              <p className="text-muted-foreground text-base">Loading opportunities…</p>
            ) : open.length === 0 ? (
              <div className="border border-dashed border-border kit-curve-sm p-10 text-center">
                <p className="text-muted-foreground text-base">No live opportunities right now. Check back, or share this page with a peer who may benefit later.</p>
              </div>
            ) : (
              open.map((o) => (
                <Link
                  key={o.id}
                  to={`/hm/${o.slug}`}
                  className="block border border-border kit-curve-sm p-5 hover:border-foreground/40 transition-colors bg-background"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-serif text-xl sm:text-2xl font-semibold">{o.title}</h2>
                      {o.summary && <p className="text-base text-muted-foreground mt-1">{o.summary}</p>}
                      {o.location && (
                        <p className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />{o.location}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Matchmakers;

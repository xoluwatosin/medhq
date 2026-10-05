import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ArrowRight } from "lucide-react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import KitPageHero from "@/components/kit/KitPageHero";
import { art } from "@/components/mc/art";
import { ClipArt } from "@/components/mc/brand";
import { KitMain } from "@/components/kit/KitLayout";
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
    <div className="flex min-h-dvh flex-col bg-background">
      <SEO
        title="Healthcare Matchmakers Network | Medic Connect"
        description="Curated healthcare opportunities placed through Medic Connect's Matchmakers Network."
        path="/hm"
        noindex
        breadcrumbs={[]}
      />
      <MedicHeader />
      <KitPageHero
        eyebrow="By invitation"
        title="Healthcare Matchmakers Network"
        accent={[1]}
        art={art.doctorNurseHandshake}
        lead="Healthcare opportunities we are placing now. Some sit inside Medic Connect, others are roles we fill for trusted partners. Apply directly, or pass one on to someone in your network."
      />
      <KitMain className="flex-1">
        <div className="mx-auto max-w-[900px]">
          <ShareButtons opportunityId={null} title="Healthcare Matchmakers Network, open opportunities" url={url} />

          <div className="mt-8 space-y-4">
            {loading ? (
              <p className="text-[16px] text-body">Loading opportunities</p>
            ) : open.length === 0 ? (
              <div className="flex flex-col items-start gap-5 border-2 border-navy bg-card p-6 shadow-offset sm:flex-row sm:items-center sm:p-8">
                <ClipArt src={art.objMagnifier} size={110} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy">Nothing open right now</h2>
                  <p className="mt-2 text-[16px] leading-[1.7] text-body">
                    Check back soon, or share this page with a peer who may be looking later.
                  </p>
                </div>
              </div>
            ) : (
              open.map((o) => (
                <Link key={o.id} to={`/hm/${o.slug}`} className="kit-curve block border-2 border-navy bg-card p-5 shadow-offset-tint transition-transform duration-200 hover:-translate-y-0.5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-navy sm:text-[26px]">{o.title}</h2>
                      {o.summary && <p className="mt-2 text-[16px] leading-[1.6] text-body">{o.summary}</p>}
                      {o.location && (
                        <p className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-label">
                          <MapPin className="h-4 w-4" aria-hidden="true" />{o.location}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </KitMain>
      <Footer />
    </div>
  );
};

export default Matchmakers;

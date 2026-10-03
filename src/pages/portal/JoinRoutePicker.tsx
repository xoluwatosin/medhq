import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, FileText, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import SEO from "@/components/SEO";
import { CxJoinShell } from "@/components/candidate/CxJoinShell";
import { CxCard, CxButton, CxPill } from "@/components/candidate/primitives";
import { JOIN_TRACKS, trackBySlug } from "@/lib/join-tracks";

const WhatsAppHelp = () => (
  <div className="cx-card border border-line-tint bg-tint px-5 py-4">
    <div className="flex items-start gap-3">
      <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
      <p className="text-[15px] leading-relaxed text-ink2">
        Not sure which route fits you? WhatsApp us on{" "}
        <a href="https://wa.me/2348126988237" className="font-bold text-brand underline-offset-4 hover:underline">
          +234 812 698 8237
        </a>
        . You can change your route later from your profile.
      </p>
    </div>
  </div>
);

const TrackCard = ({
  track,
  expanded,
  onToggle,
  emphasized,
}: {
  track: (typeof JOIN_TRACKS)[number];
  expanded: boolean;
  onToggle: () => void;
  emphasized: boolean;
}) => {
  const requiredDocs = track.documents.filter((d) => d.required);
  const optionalDocs = track.documents.filter((d) => !d.required);

  return (
    <CxCard
      kind={emphasized ? "navy" : "quiet"}
      className={emphasized ? "md:col-span-2" : ""}
    >
      <div className="p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={emphasized ? "text-[20px] font-bold text-white" : "text-[18px] font-bold text-ink md:text-[20px]"}>
                {track.label}
              </h2>
              <span
                className={
                  emphasized
                    ? "cx-pill inline-flex items-center gap-1 bg-white/15 px-2.5 py-1 text-[12px] font-extrabold text-white"
                    : "cx-pill inline-flex items-center gap-1 bg-tint px-2.5 py-1 text-[12px] font-extrabold text-navy"
                }
              >
                <Clock className="h-3 w-3" />
                {track.minutes} min
              </span>
            </div>
            <p className={emphasized ? "mt-2 text-[15px] leading-relaxed text-body-navy" : "mt-2 text-[15px] leading-relaxed text-body"}>
              {track.blurb}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className={emphasized ? "flex h-10 w-10 shrink-0 items-center justify-center text-white md:hidden" : "flex h-10 w-10 shrink-0 items-center justify-center text-ink md:hidden"}
            aria-label={expanded ? "Show less" : "Show more"}
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        <div className={expanded ? "mt-5 block" : "mt-5 hidden md:block"}>
          <p className={emphasized ? "text-[14px] font-bold uppercase tracking-wider text-muted-navy" : "text-[14px] font-bold uppercase tracking-wider text-muted-foreground"}>
            Typical roles
          </p>
          <p className={emphasized ? "mt-1 text-[15px] leading-relaxed text-body-navy" : "mt-1 text-[15px] leading-relaxed text-body"}>
            {track.examples}
          </p>

          <div className="mt-5">
            <p className={emphasized ? "text-[14px] font-bold uppercase tracking-wider text-muted-navy" : "text-[14px] font-bold uppercase tracking-wider text-muted-foreground"}>
              We will ask you for
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {requiredDocs.map((d) => (
                <span
                  key={d.label}
                  className={
                    emphasized
                      ? "inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white"
                      : "inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink2"
                  }
                >
                  <FileText className="h-3.5 w-3.5" />
                  {d.label}
                </span>
              ))}
              {optionalDocs.map((d) => (
                <span
                  key={d.label}
                  className={
                    emphasized
                      ? "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[13px] font-semibold text-body-navy"
                      : "inline-flex items-center gap-1.5 rounded-full border border-line bg-desk px-3 py-1.5 text-[13px] font-semibold text-muted-foreground"
                  }
                >
                  {d.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <CxButton
              asChild
              rank="primary"
              onNavy={emphasized}
              full
              className="md:w-auto md:px-7"
            >
              <Link to={`/join/${track.slug}/account`}>Create my profile</Link>
            </CxButton>
          </div>
        </div>
      </div>
    </CxCard>
  );
};

const JoinRoutePicker = () => {
  const [expanded, setExpanded] = useState<string>("clinical-professional");

  return (
    <>
      <SEO
        title="Join our network | Medic Connect"
        description="Apply to join the Medic Connect network of nurses, caregivers, doctors, and allied health professionals across Nigeria."
        path="/join"
      />
      <CxJoinShell
        title="Which of these is you?"
        eyebrow="Start here"
        headerAction={
          <Link
            to="/portal/login"
            className="text-[14px] font-bold text-white underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        }
      >
        <p className="max-w-[60ch] text-[16px] leading-[1.75] text-body">
          Everyone who joins builds a candidate profile rather than filling a one-off form. Pick your
          route and we will ask only the questions that apply to you.
        </p>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {JOIN_TRACKS.map((track) => (
            <TrackCard
              key={track.slug}
              track={track}
              emphasized={track.slug === "clinical-professional"}
              expanded={expanded === track.slug}
              onToggle={() => setExpanded((prev) => (prev === track.slug ? "" : track.slug))}
            />
          ))}
        </div>

        <WhatsAppHelp />
      </CxJoinShell>
    </>
  );
};

export default JoinRoutePicker;

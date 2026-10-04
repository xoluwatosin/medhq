import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHeardPath } from "@/components/heard/HeardBase";
import HeardPage from "@/components/heard/v2/HeardLayout";
import HeardHeroMark from "@/components/heard/v2/HeardHero";
import {
  HeardDivider,
  HeardIndexMarker,
  HeardLinkButton,
  HeardQuote,
  HeardReveal,
  HeardRevealStatement,
  HeardStackFrame,
  HeardWatermark,
} from "@/components/heard/v2/HeardKit";
import { fetchPublicLetters } from "@/components/heard/v2/heardSubmit";

const WAYS = [
  {
    numeral: "01",
    kicker: "Write to us",
    title: "Some things are easier written down.",
    note: "Tell us what's on your mind.",
    action: "Write to us",
    to: "/write",
  },
  {
    numeral: "02",
    kicker: "Story Swap",
    title: "Give one. Get one.",
    note: "Leave a story. Receive one from someone else.",
    action: "Story Swap",
    to: "/story-swap",
  },
  {
    numeral: "03",
    kicker: "Letters",
    title: "Letters to strangers. Letters from strangers. Or friends you haven't met yet.",
    note: "Leave a letter for someone you don't know. Read one from someone you're yet to meet.",
    action: "Letter Room",
    to: "/letters",
  },
  {
    numeral: "04",
    kicker: "Talk to us",
    title: "Sometimes you just need to tell somebody.",
    note: "Phone lines coming soon.\n6pm to 2am.",
    action: "Tell me when",
    to: "/talk",
  },
];



/** One short line from an approved letter, or the plain line when there are none. */
const useOpeningLine = () => {
  const [line, setLine] = useState<{ text: string; from: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await fetchPublicLetters();
        if (!active || !rows.length) return;
        const short = rows
          .map((row) => row.content.split("\n").map((s) => s.trim()).find((s) => s.length > 24 && s.length < 140))
          .map((text, i) => (text ? { text, from: rows[i].sign_it_as } : null))
          .filter((v): v is { text: string; from: string | null } => Boolean(v));
        if (short.length) setLine(short[Math.floor(Math.random() * short.length)]);
      } catch {
        /* The opening line is decorative: a failure leaves the plain line in place. */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return line;
};

export const HeardHome = () => {
  const heardPath = useHeardPath();
  const line = useOpeningLine();

  return (
    <HeardPage
      path="/"
      title="Heard"
      description="Explore the freedom in confiding in a stranger."
      width="wide"
    >
      <section className="hv-home-hero">
        <HeardReveal>
          <HeardHeroMark />
        </HeardReveal>
        <HeardReveal delay={120}>
          <div className="hv-home-hero-copy">
            <h1 className="hv-line-1">Yapping is so chic.</h1>
            <p className="hv-line-2">
              Explore the freedom in confiding in a stranger.
            </p>
          </div>
        </HeardReveal>
      </section>

      <HeardDivider variant="bar" />

      <section aria-labelledby="ways" className="flex flex-col gap-10 pt-14">
        <HeardReveal>
          <div className="flex flex-col gap-4">
            <span className="hv-index">Four ways in</span>
            <h2 id="ways">Ways to be heard</h2>
          </div>
        </HeardReveal>
        <div className="grid gap-8 sm:grid-cols-2">
          {WAYS.map((way, i) => (
            <HeardReveal key={way.to} delay={i * 80} className="h-full">
              <HeardStackFrame className="h-full">
                <div className="flex h-full flex-col gap-4">
                  <HeardIndexMarker label={way.kicker} numeral={way.numeral} />
                  <h3>{way.title}</h3>
                  <p className="whitespace-pre-line text-[14.5px] text-[color:var(--hv-violet)]">{way.note}</p>
                  <div className="mt-auto pt-6">
                    <Link to={heardPath(way.to)} className="hv-btn hv-btn-alt">
                      {way.action}
                    </Link>
                  </div>
                </div>
              </HeardStackFrame>
            </HeardReveal>
          ))}
        </div>
      </section>

      <section aria-label="From the Letter Room" className="pt-20">
        <HeardReveal>
          <div className="relative overflow-hidden bg-[color:var(--hv-sky)] px-6 py-12 sm:px-12 sm:py-16">
            <HeardWatermark fill="#FFFFFF" />
            <div className="relative flex flex-col gap-7 max-w-[760px]">
              <span className="hv-index">From the Letter Room</span>
              <HeardQuote attribution={line ? `Left by ${line.from ?? "somebody"}` : undefined}>
                {line ? `“${line.text}”` : "Letters to strangers. Letters from strangers."}
              </HeardQuote>
              <div className="flex flex-wrap gap-4">
                <HeardLinkButton to={heardPath("/letters")}>Read a letter</HeardLinkButton>
                <HeardLinkButton to={heardPath("/letters/leave")} tone="pill">
                  Leave a letter
                </HeardLinkButton>
              </div>
            </div>
          </div>
        </HeardReveal>
      </section>

      <section aria-label="Talk to us" className="pt-20">
        <div className="flex flex-col gap-6">
          <HeardDivider variant="mark" />
          <HeardRevealStatement lines={["Nobody here knows you.", "That is rather the point."]} className="mx-auto w-full max-w-[760px]" />
        </div>
      </section>
    </HeardPage>
  );
};

export default HeardHome;

import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useHeardPath } from "@/components/heard/HeardBase";

const NAV_LINKS = [
  { href: "#what", label: "What we're building" },
  { href: "#roles", label: "Roles" },
  { href: "#training", label: "Training" },
  { href: "#faq", label: "FAQ" },
];

export const HeardShell = ({ children }: { children: ReactNode }) => {
  const heardPath = useHeardPath();
  return (
    <div className="heard-scope min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur bg-[color:var(--heard-bg)]/85 border-b border-[color:var(--heard-line)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <Link to={heardPath("/")} className="heard-plain flex flex-col leading-none">
            <span className="heard-serif text-2xl">Heard</span>
            <span className="text-[11px] tracking-widest uppercase text-[color:var(--heard-muted)] mt-1">
              by Medic Connect
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="heard-plain text-[color:var(--heard-ink-soft)] hover:text-[color:var(--heard-ink)]">
                {l.label}
              </a>
            ))}
            <a
              href="#signup"
              className="heard-plain inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold bg-[color:var(--heard-ink)] text-white hover:bg-[color:var(--heard-accent-ink)] transition-colors"
            >
              Sign up
            </a>
          </nav>
          <a
            href="#signup"
            className="md:hidden heard-plain inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-[color:var(--heard-ink)] text-white"
          >
            Sign up
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <HeardFooter />
    </div>
  );
};

const HeardFooter = () => {
  return (
    <footer className="mt-24 border-t border-[color:var(--heard-line)] bg-[color:var(--heard-band)]/50">
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-16">
        <p className="heard-eyebrow mb-4">If you need someone tonight</p>
        <h2 className="heard-serif text-2xl sm:text-3xl mb-3">We're not open yet, but you shouldn't have to wait to be heard.</h2>
        <p className="text-[color:var(--heard-ink-soft)] max-w-2xl">
          Here's who to reach right now, and what each one is best for.
        </p>

        <div className="mt-10 grid gap-8">
          <ResourceBlock
            heading="If you're in immediate danger, or it's a medical emergency"
            items={[
              { name: "112", note: "Nigeria's national emergency line (ambulance, police, fire), anywhere in the country." },
              { name: "767", note: "The emergency line if you're in Lagos." },
            ]}
          />
          <ResourceBlock
            heading="If you're having thoughts of suicide or self-harm"
            items={[
              {
                name: "SURPIN, Suicide Research & Prevention Initiative",
                note: "A 24-hour crisis lifeline, with counsellors in English, Hausa, Igbo and Yoruba.",
                numbers: ["0800 0078 7746 (toll-free)", "0903 440 0009 (MTN)", "0908 021 7555 (9mobile)", "0814 224 1007 (Hausa)"],
              },
            ]}
          />
          <ResourceBlock
            heading="If you just need to talk, free, confidential, any time"
            items={[
              {
                name: "MANI, Mentally Aware Nigeria Initiative",
                note: "24/7 support for whatever you're carrying: anxiety, depression, grief, loneliness, stress, self-harm.",
                numbers: ["0809 111 6264", "0811 168 0686"],
              },
              {
                name: "She Writes Woman, Safe Place",
                note: "A free, 24/7, judgement-free helpline, with support in multiple languages.",
                numbers: ["0800 800 2000"],
              },
            ]}
          />
          <ResourceBlock
            heading="If a child or teenager is being hurt or is unsafe"
            items={[
              {
                name: "Cece Yara, 24-Hour Child Helpline",
                note: "Free, trained staff who listen to children and young people (and to anyone worried about a child).",
                numbers: ["0800 800 8001 (free, for children)", "0700 700 7001 (paid line, for adults)"],
              },
            ]}
          />
        </div>

        <div className="mt-16 pt-8 border-t border-[color:var(--heard-line)] flex flex-col sm:flex-row justify-between gap-4 text-sm text-[color:var(--heard-ink-soft)]">
          <p>
            Heard is a service of{" "}
            <a href="https://www.medicconnect.co/" className="heard-plain underline">Medic Connect</a>
            .
            {/* [confirm: one line on what Medic Connect is / does] */}
          </p>
          <p>© {new Date().getFullYear()} Medic Connect.</p>
        </div>
      </div>
    </footer>
  );
};

const ResourceBlock = ({
  heading,
  items,
}: {
  heading: string;
  items: { name: string; note: string; numbers?: string[] }[];
}) => (
  <div className="rounded-2xl bg-[color:var(--heard-surface)] border border-[color:var(--heard-line)] p-6 sm:p-7">
    <p className="heard-serif text-lg mb-4">{heading}</p>
    <ul className="space-y-4">
      {items.map((it) => (
        <li key={it.name}>
          <p className="font-semibold text-[color:var(--heard-ink)]">{it.name}</p>
          <p className="text-sm text-[color:var(--heard-ink-soft)] mt-1">{it.note}</p>
          {it.numbers && (
            <ul className="mt-2 text-sm space-y-1">
              {it.numbers.map((n) => (
                <li key={n} className="text-[color:var(--heard-ink)]">{n}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  </div>
);

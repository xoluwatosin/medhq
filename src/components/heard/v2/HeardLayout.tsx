import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import SEO from "@/components/SEO";
import { useHeardPath } from "@/components/heard/HeardBase";
import HeardLogo from "./HeardLogo";
import { HeardBreadcrumb } from "./HeardKit";

/**
 * The Heard consumer chrome: header, mobile sheet, footer.
 * One component tree serves heard.medicconnect.co/ and /heard-preview.
 */

const NAV = [
  { to: "/write", label: "Be Heard" },
  { to: "/story-swap", label: "Story Swap" },
  { to: "/letters", label: "Letters" },
  { to: "/get-involved", label: "Get involved" },
  { to: "/about", label: "About" },
];

const FOOTER_GROUPS: { heading: string; items: { to: string; label: string }[] }[] = [
  {
    heading: "Ways to be heard",
    items: [
      { to: "/write", label: "Write to us" },
      { to: "/story-swap", label: "Story Swap" },
      { to: "/letters", label: "Letter Room" },
      { to: "/talk", label: "Talk to us" },
    ],
  },
  {
    heading: "About Heard",
    items: [
      { to: "/about", label: "About" },
      { to: "/support", label: "Support" },
      { to: "/privacy", label: "Privacy" },
      { to: "/get-involved", label: "Get involved" },
      { to: "/volunteer/sign-in", label: "Volunteer sign in" },
    ],
  },
];

const HeardHeader = () => {
  const heardPath = useHeardPath();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const isCurrent = (to: string) => location.pathname === heardPath(to);

  return (
    <header className="border-b border-[color:var(--hv-late)] bg-[color:var(--hv-white)]">
      <div className="hv-header-inner mx-auto w-full max-w-[1180px] px-5 sm:px-7 flex items-center justify-between gap-4">
        <Link to={heardPath("/")} aria-label="Heard, home">
          <HeardLogo size="md" />
        </Link>
        <nav aria-label="Heard" className="hidden md:flex items-end gap-8">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={heardPath(item.to)}
              aria-current={isCurrent(item.to) ? "page" : undefined}
              className="hv-tab"
            >
              {item.label}
            </Link>
          ))}
        </nav>
          <div className="md:hidden shrink-0">
          <button
            type="button"
            className="hv-menu-control"
            aria-expanded={open}
            aria-controls="heard-nav-sheet"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
        </div>
      </div>

      {open && (
        <div id="heard-nav-sheet" className="hv-sheet md:hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-[color:var(--hv-late)]">
            <HeardLogo size="md" />
            <button
              type="button"
              className="hv-menu-control"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          <nav aria-label="Heard, mobile" className="flex min-h-0 flex-1 flex-col px-5 py-2">
            {[...NAV, { to: "/talk", label: "Talk to us" }, { to: "/support", label: "Support" }].map((item, i) => (
              <Link
                key={item.to}
                to={heardPath(item.to)}
                aria-current={isCurrent(item.to) ? "page" : undefined}
                className="hv-sheet-link"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="px-5 py-4 bg-[color:var(--hv-sky)]">
            <p className="text-[12.5px] leading-relaxed text-[color:var(--hv-late)]">
              Heard is peer listening, not therapy and not an emergency service.
            </p>
          </div>
        </div>
      )}
    </header>
  );
};

const HeardFooter = () => {
  const heardPath = useHeardPath();
  return (
    <footer className="mt-20 border-t border-[color:var(--hv-late)]">
      <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-7 py-14 flex flex-col gap-10">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <p className="max-w-[520px] m-0 font-extrabold text-[clamp(24px,4.4vw,38px)] leading-[1.05] tracking-[-0.05em] text-[color:var(--hv-late)]">
            Anyway. What were you saying?
          </p>
          <div className="hidden sm:flex flex-wrap gap-x-14 gap-y-8">
            {FOOTER_GROUPS.map((group) => (
              <nav key={group.heading} aria-label={group.heading} className="flex flex-col gap-3">
                <span className="hv-index">{group.heading}</span>
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={heardPath(item.to)}
                    className="text-[14.5px] font-extrabold text-[color:var(--hv-violet)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
          <div className="hv-footer-accordions sm:hidden">
            {FOOTER_GROUPS.map((group) => (
              <details key={group.heading} className="hv-footer-accordion">
                <summary>
                  <span>{group.heading}</span>
                  <span className="hv-footer-accordion-icon" aria-hidden="true">+</span>
                </summary>
                <nav aria-label={group.heading}>
                  {group.items.map((item) => (
                    <Link key={item.to} to={heardPath(item.to)}>
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </details>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6 pt-8 border-t border-[color:var(--hv-hair)]">
          <p className="max-w-xl text-[13.5px] leading-relaxed text-[color:var(--hv-violet)]">
            Heard is peer listening, not therapy and not an emergency service. If tonight is urgent, the{" "}
            <Link to={heardPath("/support")} className="underline underline-offset-4">
              Support
            </Link>{" "}
            page says what to do.
          </p>
          <HeardLogo />
        </div>
      </div>
    </footer>
  );
};


/** Page wrapper: metadata, chrome, and the Heard scope. */
export const HeardPage = ({
  path,
  title,
  description,
  children,
  width = "prose",
}: {
  path: string;
  title: string;
  description: string;
  children: ReactNode;
  width?: "prose" | "wide";
}) => {
  const heardPath = useHeardPath();
  return (
    <>
      <SEO title={title} description={description} path={heardPath(path)} breadcrumbs={[]} noindex />
      <div className="heard-v2 min-h-dvh flex flex-col">
        <HeardHeader />
        <main className="flex-1">
          <div
            className={`mx-auto w-full px-5 sm:px-7 pt-12 pb-16 sm:pt-16 ${
              width === "wide" ? "max-w-[1180px]" : "max-w-[760px]"
            }`}
          >
            {path !== "/" && <HeardBreadcrumb current={title.replace(/\s+[—-]\s+Heard$/, "")} />}
            {children}
          </div>
        </main>
        <HeardFooter />
      </div>
    </>
  );
};

export default HeardPage;

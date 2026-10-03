import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { HeardShell } from "@/components/heard/HeardShell";
import { useHeardPath } from "@/components/heard/HeardBase";

const HeardThanks = () => {
  const heardPath = useHeardPath();
  return (
  <>
    <SEO
      title="Thank you — Heard"
      description="Thanks for signing up to volunteer with Heard. We'll be in touch about the next training cohort."
      path={heardPath("/thanks")}
      breadcrumbs={[]}
      noindex
    />
    <HeardShell>
      <section className="max-w-2xl mx-auto px-5 sm:px-8 py-32 text-center">
        <p className="heard-eyebrow mb-4">Sign up received</p>
        <h1 className="heard-serif text-4xl sm:text-5xl mb-8">Thank you &mdash; we've got you.</h1>
        <p className="text-[17px] text-[color:var(--heard-ink-soft)] leading-relaxed mb-4">
          That's all we need for now. We'll be in touch about the next training cohort.
        </p>
        <p className="text-[17px] text-[color:var(--heard-ink-soft)] leading-relaxed mb-10">
          Keep an eye on your inbox (and your spam folder, just in case).
        </p>
        <p className="heard-serif text-2xl italic text-[color:var(--heard-ink)] mb-10">Glad you're doing this.</p>
        <Link
          to={heardPath("/")}
          className="heard-plain inline-flex items-center justify-center rounded-full border border-[color:var(--heard-line)] bg-white px-6 py-3 text-[15px] font-semibold text-[color:var(--heard-ink)] hover:bg-[color:var(--heard-band)] transition-colors"
        >
          Back to Heard
        </Link>
      </section>
    </HeardShell>
  </>
  );
};

export default HeardThanks;

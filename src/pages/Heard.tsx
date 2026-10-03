import SEO from "@/components/SEO";
import { HeardShell } from "@/components/heard/HeardShell";
import { HeardSignupForm } from "@/components/heard/HeardSignupForm";
import { HeardWaitlistForm } from "@/components/heard/HeardWaitlistForm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS: { q: string; a: string }[] = [
  { q: "Do I need qualifications?", a: "No. Good listeners come from everywhere. We train you from scratch." },
  { q: "Do I need to have struggled with my own mental health?", a: "It's welcome, and it can help you connect, but it's not required." },
  { q: "Will I be counselling people?", a: "No. You listen, and you refer. You'll be trained on exactly where the boundary sits, and a qualified person is always behind you. When a caller wants professional help, we help them find it. That's one of the best things we do." },
  { q: "Is it paid?", a: "It's a volunteer role. What you get is real training, real support, and real impact." },
  { q: "Where is it? Do I need to be in a certain city?", a: "It's fully virtual. Anywhere in Nigeria works. Based abroad? Tell us. Some roles, like social media, can work from anywhere." },
  { q: "How much time does it take?", a: "A few hours a week for training over 6 to 8 weeks, then evening shifts you choose once we open." },
  { q: "When do you launch?", a: "We're training our first group of volunteers soon. Sign up to be part of it." },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Heard",
    alternateName: "Heard by Medic Connect",
    url: "https://www.medicconnect.co/heard",
    description: "A free evening warm line for Nigeria. Any Nigerian can call and just talk to a peer who listens, and doesn't judge.",
    parentOrganization: { "@type": "Organization", name: "Medic Connect", url: "https://www.medicconnect.co" },
    areaServed: { "@type": "Country", name: "Nigeria" },
  },
  {
    "@context": "https://schema.org",
    "@type": "VolunteerOpportunity",
    name: "Peer Listener volunteer with Heard",
    description: "Volunteer as a Peer Listener with Heard, a free evening warm line for Nigeria. Full training provided, fully virtual, anywhere in Nigeria.",
    url: "https://www.medicconnect.co/heard#signup",
    datePosted: new Date().toISOString().split("T")[0],
    hiringOrganization: { "@type": "Organization", name: "Heard by Medic Connect" },
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: { "@type": "Country", name: "Nigeria" },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

const Heard = () => {
  return (
    <>
      <SEO
        title="Volunteer with Heard - Somewhere to just talk"
        description="We're building Heard, a free evening warm line for Nigeria. Train as a peer listener, or help on social. Not open yet - sign up to be one of the first to answer."
        path="/heard"
        type="website"
        breadcrumbs={[]}
        jsonLd={jsonLd}
      />
      <HeardShell>
        {/* Hero */}
        <section className="border-b border-[color:var(--heard-line)]">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-16">
            <p className="heard-eyebrow mb-6">You talk. We listen.</p>
            <h1 className="heard-serif text-4xl sm:text-6xl leading-[1.05] mb-8">
              Be the one that <span className="heard-underline">picks up</span>.
            </h1>

            <p className="text-lg sm:text-xl text-[color:var(--heard-ink-soft)] max-w-2xl leading-relaxed">
              We're building Heard, a free line where any Nigerian can call in the evening and just talk to someone who
              listens, and doesn't judge. We're not open yet. We're looking for great listeners. That could be you.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 sm:items-center">
              <a
                href="#signup"
                className="heard-plain inline-flex items-center justify-center rounded-full bg-[color:var(--heard-ink)] px-7 py-4 text-[15px] font-semibold text-white hover:bg-[color:var(--heard-accent-ink)] transition-colors"
              >
                Sign up to volunteer
              </a>
              <p className="text-sm text-[color:var(--heard-muted)]">
                Free training &nbsp;·&nbsp; Fully virtual &nbsp;·&nbsp; Anywhere in Nigeria
              </p>
            </div>
          </div>
        </section>

        {/* What we're building */}
        <section id="what" className="max-w-5xl mx-auto px-5 sm:px-8 py-20 grid md:grid-cols-12 gap-10">
          <div className="md:col-span-4">
            <p className="heard-eyebrow">What we're building</p>
          </div>
          <div className="md:col-span-8 space-y-5 text-[17px] text-[color:var(--heard-ink)] leading-relaxed">
            <p>
              Heard is a free warm line for Nigeria. When we open, anyone can call or email in the evenings and talk to a peer ,
              someone who's had their own hard seasons and won't judge you for yours.
            </p>
            <p>
              Talking helps. Sometimes it's all you need. Sometimes it's the first step toward more, and when someone wants more,
              we help them find it. We're the easiest place to start: free, no waitlist, no forms, no shame.
            </p>
            <p>
              We're not here to replace counsellors or therapists. We're here to make talking an easy first move, and to open the
              next door when someone's ready for it.
            </p>
            <p className="text-[color:var(--heard-ink-soft)]">
              But none of it works without people willing to listen. That's where you come in.
            </p>
          </div>
        </section>

        {/* Why Heard */}
        <section className="bg-[color:var(--heard-band)]/60 border-y border-[color:var(--heard-line)]">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-20 grid md:grid-cols-12 gap-10">
            <div className="md:col-span-4">
              <p className="heard-eyebrow">Why Heard</p>
              <h2 className="heard-serif text-3xl mt-3">A place for the honest answer.</h2>
            </div>
            <div className="md:col-span-8 space-y-5 text-[17px] leading-relaxed">
              <p>
                Across Nigeria, a lot of people are carrying heavy things quietly. Not because they don't want to talk, but because
                there's almost nowhere to just talk. Care is expensive, far away, or booked out for months, and "how are you?"
                rarely expects an honest answer.
              </p>
              <p>
                Heard is a place for the honest answer. Free, in the evening, from someone who'll actually listen. It won't fix
                everything, but being heard is where it starts, and for a lot of people it's the thing that finally makes the next
                step feel possible.
              </p>
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="max-w-6xl mx-auto px-5 sm:px-8 py-24">
          <div className="max-w-2xl mb-14">
            <p className="heard-eyebrow">The roles</p>
            <h2 className="heard-serif text-3xl sm:text-4xl mt-3">Three ways to be part of this.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <RoleCard
              variant={1}
              title="Peer Listener"
              blurb="The heart of it."
              body="You don't need a degree. You need to be someone people feel safe talking to. Our listeners come from everywhere, students, traders, teachers, nurses, all the way to psychologists, and everyone trains together. If you've been through your own hard times, that's welcome; it's never required. You'll listen, you'll hold space, and you'll point people toward more help when they need it. You won't counsel or fix anyone. You'll be trained on exactly where that line is, and there's always a qualified person behind you."
            />
            <RoleCard
              variant={2}
              title="Social Media Volunteer"
              blurb="Make sure people find us."
              body="Good with words, design, or community? Help us reach the people who need this. Write posts, make graphics, reply with warmth, grow and hold the community, and help us speak to what Nigerians are actually going through. You don't have to answer a single call to make this real."
            />
            <RoleCard
              variant={3}
              title="Counsellors, psychologists, clinicians"
              blurb="Sit behind the line."
              body="Are you a counsellor, psychologist, or clinician? We'd love you on the line to help shape this, or as a Listener like everyone else. We especially need qualified people behind the line: supervising, supporting listeners, and helping us refer callers well. This is how we keep Heard safe and warm at the same time."
            />
          </div>

        </section>

        {/* Training */}
        <section id="training" className="bg-[color:var(--heard-band)]/60 border-y border-[color:var(--heard-line)]">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-24 grid md:grid-cols-12 gap-10">
            <div className="md:col-span-4">
              <p className="heard-eyebrow">The training</p>
              <h2 className="heard-serif text-3xl mt-3">Nobody gets thrown in the deep end.</h2>
            </div>
            <div className="md:col-span-8 space-y-5 text-[17px] leading-relaxed">
              <p>
                Whether you've never done anything like this or you've got a psych degree, everyone goes through the same
                6 to 8 week, hands-on, virtual training before they ever take a call.
              </p>
              <p className="font-semibold">You'll learn:</p>
              <ul className="space-y-3 pl-0">
                {[
                  "How to really listen, and why that alone changes things",
                  "How to hold space without rushing to fix",
                  "Boundaries and scope: what we do, what we don't, and where the line is",
                  "How to tell when someone needs more, and how to hand off safely",
                  "Cultural nuance: faith, family, money, shame, the real texture of Nigerian life",
                  "Looking after yourself, so you can keep showing up",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="text-[color:var(--heard-accent)] font-bold" aria-hidden>·</span>
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))}
              </ul>
              <p className="pt-2">
                It's live and practical, you'll practise, not just watch slides, and you can do all of it from
                anywhere in Nigeria. You'll finish knowing exactly what to do. And you'll never be alone on a shift.
              </p>
            </div>
          </div>
        </section>

        {/* Safe and looked after */}
        <section className="max-w-5xl mx-auto px-5 sm:px-8 py-24">
          <div className="max-w-2xl mb-12">
            <p className="heard-eyebrow">Safe, and looked after</p>
            <h2 className="heard-serif text-3xl sm:text-4xl mt-3">Warm on the surface. Safe underneath.</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-[color:var(--heard-surface)] border border-[color:var(--heard-line)] p-7">
              <p className="heard-eyebrow mb-3">For the people who call</p>
              <p className="text-[color:var(--heard-ink)] leading-relaxed">
                Our listeners are peers, not clinicians, but they're never on their own. Qualified counsellors sit behind
                the line, supervising and ready to step in. We're not an emergency service, but we always know how to get someone
                to one. And what's said on a call stays private.
              </p>
              {/* [confirm your confidentiality policy wording before publishing] */}
            </div>
            <div className="rounded-2xl bg-[color:var(--heard-surface)] border border-[color:var(--heard-line)] p-7">
              <p className="heard-eyebrow mb-3">For you, as a volunteer</p>
              <p className="text-[color:var(--heard-ink)] leading-relaxed">
                You'll be trained before you ever take a call, supervised while you do, and debriefed after the hard ones.
                You will never carry a heavy call alone.
              </p>
            </div>
          </div>
        </section>

        {/* Who makes a good listener */}
        <section className="bg-[color:var(--heard-band)]/60 border-y border-[color:var(--heard-line)]">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-24 grid md:grid-cols-12 gap-10">
            <div className="md:col-span-4">
              <p className="heard-eyebrow">Who makes a good listener</p>
              <h2 className="heard-serif text-3xl mt-3">If this sounds like you, credentials are optional.</h2>
            </div>
            <div className="md:col-span-8 text-[17px] leading-relaxed">
              <ul className="space-y-4">
                {[
                  "Warm, and patient.",
                  "Hard to shock, you can sit with someone's pain without flinching or fixing.",
                  "A better listener than talker.",
                  "Non-judgemental about faith, money, relationships, or anything else that walks in.",
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="text-[color:var(--heard-accent)] font-bold" aria-hidden>·</span>
                    <span dangerouslySetInnerHTML={{ __html: line }} />
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[color:var(--heard-ink-soft)]">We'll teach you the rest.</p>
            </div>
          </div>
        </section>

        {/* What you'll get + commitment */}
        <section className="max-w-5xl mx-auto px-5 sm:px-8 py-24 grid md:grid-cols-2 gap-12">
          <div>
            <p className="heard-eyebrow mb-3">What you'll get</p>
            <ul className="space-y-4 text-[17px]">
              <li>Real training, and a skill you keep for life.</li>
              <li>A community of people building something that matters.</li>
              <li>Supervision and support, so you're never carrying a hard call alone.</li>
              <li>The thing itself: being the reason someone got through a heavy night.</li>
            </ul>
            <p className="mt-6 text-[color:var(--heard-ink-soft)] text-[15px]">
              This is a volunteer role, it's unpaid. The training, the support, and the community are real, and so is the
              difference you'll make.
            </p>
          </div>
          <div>
            <p className="heard-eyebrow mb-3">The commitment</p>
            <p className="text-[17px] leading-relaxed">
              Training comes first, 6 to 8 weeks, a few hours a week, online.
            </p>
            <p className="text-[17px] leading-relaxed mt-4">
              Once we open, shifts run in the evenings (around 6 to 11pm), and you choose what you can give. It's all virtual,
              so any corner of Nigeria works.
            </p>
            <p className="text-[17px] leading-relaxed mt-4 text-[color:var(--heard-ink-soft)]">
              We'd rather have a few hours you can truly commit than a promise you can't keep. Come as you can.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-[color:var(--heard-band)]/60 border-y border-[color:var(--heard-line)]">
          <div className="max-w-3xl mx-auto px-5 sm:px-8 py-24">
            <p className="heard-eyebrow mb-3">FAQ</p>
            <h2 className="heard-serif text-3xl sm:text-4xl mb-10">The honest answers.</h2>
            <Accordion type="single" collapsible className="space-y-3">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="rounded-xl border border-[color:var(--heard-line)] bg-[color:var(--heard-surface)] px-5">
                  <AccordionTrigger className="text-left font-semibold text-[16px] hover:no-underline py-5">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[color:var(--heard-ink-soft)] text-[15px] leading-relaxed pb-5">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Sign up */}
        <section id="signup" className="max-w-3xl mx-auto px-5 sm:px-8 py-24">
          <p className="heard-eyebrow mb-3">Sign up</p>
          <h2 className="heard-serif text-3xl sm:text-4xl mb-4">Ready to be part of this?</h2>
          <p className="text-[color:var(--heard-ink-soft)] text-[17px] mb-10">
            Tell us a little about you and which role fits. It takes only a few minutes. We'll be in touch.
          </p>
          <HeardSignupForm />
        </section>

        {/* Not ready + Questions */}
        <section className="bg-[color:var(--heard-band)]/60 border-y border-[color:var(--heard-line)]">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-20 grid md:grid-cols-2 gap-12">
            <div>
              <p className="heard-eyebrow mb-3">Not ready to volunteer yet?</p>
              <p className="text-[17px] mb-5">
                Want to follow along, or help later? Leave your email and we'll keep you posted. No spam, just the moments that
                matter.
              </p>
              <HeardWaitlistForm />
            </div>
            <div>
              <p className="heard-eyebrow mb-3">Questions?</p>
              <p className="text-[17px]">
                Got a question before you sign up? Email us at{" "}
                <a href="mailto:heard@medicconnect.co">heard@medicconnect.co</a>{" "}
                {/* [confirm final address, brief said herd@ but we assumed a typo] */}
                and a real person will get back to you.
              </p>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="max-w-4xl mx-auto px-5 sm:px-8 py-28 text-center">
          <h2 className="heard-serif text-3xl sm:text-5xl leading-tight mb-8">
            One quiet evening, someone is going to need to talk, and someone will need to answer.
          </h2>
          <p className="heard-serif text-2xl sm:text-3xl italic text-[color:var(--heard-ink-soft)] mb-10">
            Be the one that picks up.
          </p>
          <a
            href="#signup"
            className="heard-plain inline-flex items-center justify-center rounded-full bg-[color:var(--heard-ink)] px-8 py-4 text-[15px] font-semibold text-white hover:bg-[color:var(--heard-accent-ink)] transition-colors"
          >
            Sign up to volunteer
          </a>
        </section>
      </HeardShell>
    </>
  );
};

const RoleCard = ({ title, blurb, body, variant = 1 }: { title: string; blurb: string; body: string; variant?: 1 | 2 | 3 }) => (
  <div className={`heard-role-${variant} rounded-2xl border p-7 flex flex-col`}>
    <p className="heard-eyebrow mb-3">{blurb}</p>
    <h3 className="heard-serif text-xl mb-4">{title}</h3>
    <p className="text-[15px] text-[color:var(--heard-ink-soft)] leading-relaxed" dangerouslySetInnerHTML={{ __html: body }} />
  </div>
);

export default Heard;


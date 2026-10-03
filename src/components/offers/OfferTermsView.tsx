// The terms of an offer, read the same way by us and by the person.
//
// One component serves the admin list, the composer preview and the candidate
// portal, so an offer can never look like one thing to us and another to them.
import { offerTermRows, type Offer } from "@/lib/offers";

interface Props {
  offer: Offer;
  /** Compact drops the duties and the closing paragraphs. */
  compact?: boolean;
}

const Para = ({ title, body }: { title: string; body?: string | null }) =>
  body && body.trim() ? (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="whitespace-pre-line text-sm leading-relaxed">{body}</p>
    </div>
  ) : null;

const OfferTermsView = ({ offer, compact }: Props) => {
  const rows = offerTermRows(offer);
  const t = offer.terms || {};
  if (!rows.length && !t.duties && !t.provided && !t.next_steps) return null;

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
      {rows.length > 0 && (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-1.5">
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd className="text-right text-sm font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {!compact && (
        <>
          <Para title="What the work involves" body={t.duties} />
          <Para title="What we provide" body={t.provided} />
          <Para title="What happens next" body={t.next_steps} />
        </>
      )}
    </div>
  );
};

export default OfferTermsView;

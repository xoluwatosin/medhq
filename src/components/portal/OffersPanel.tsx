// Offers the candidate has been sent, and the answer they give.
//
// Every offer carries the whole story: what it is, when, where, what it pays
// if we said, and what happened. Accepting a run of shifts books those hours;
// accepting a role opens an engagement. Nothing is buried in loose text.
import { art } from "@/components/mc/art";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PortalEmpty, PortalSection } from "@/components/portal/PortalShell";
import { BriefcaseBusiness, CalendarClock, Check, Loader2, MapPin, X } from "lucide-react";
import {
  type Offer, OFFER_STATUS_LABEL, dateLabel, isOfferOpen, shiftLabel,
} from "@/lib/offers";
import OfferTermsView from "@/components/offers/OfferTermsView";

const tone = (o: Offer) =>
  o.status === "accepted" ? "default" : isOfferOpen(o) ? "secondary" : "outline";

const OffersPanel = ({ personId, onChanged }: { personId: string; onChanged?: () => void }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<Offer | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("mu_my_offers" as any);
    setOffers(((data as any) || []) as Offer[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, personId]);

  const respond = async (offer: Offer, action: "accept" | "decline", why?: string) => {
    setBusy(offer.id);
    const { data, error } = await supabase.rpc("mu_respond_offer" as any, {
      _offer_id: offer.id, _action: action, _reason: why ?? null,
    });
    setBusy(null);
    const res = data as any;
    if (error || (res && res.ok === false)) {
      toast({
        title: "Could not save that",
        description: res?.error || error?.message,
        variant: "destructive",
      });
      load();
      return;
    }
    toast({
      title: action === "accept" ? "Accepted" : "Declined",
      description: action === "accept"
        ? "We have booked it in and your calendar now shows it."
        : "Thank you for letting us know.",
    });
    setDeclining(null);
    setReason("");
    load();
    onChanged?.();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const open = offers.filter(isOfferOpen);
  const past = offers.filter((o) => !isOfferOpen(o));

  const card = (o: Offer) => (
    <li key={o.id} className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-medium">{o.title}</p>
          <p className="text-sm text-muted-foreground">
            {o.kind === "role" ? "Ongoing role" : "Shift work"}
            {o.pattern ? ` · ${o.pattern}` : ""}
            {o.start_date ? ` · from ${dateLabel(o.start_date)}` : ""}
          </p>
        </div>
        <Badge variant={tone(o) as any} className="shrink-0">{OFFER_STATUS_LABEL[o.status]}</Badge>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {o.location && (
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{o.location}</span>
        )}
        {o.rate_note && (
          <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="h-4 w-4" />{o.rate_note}</span>
        )}
        {o.expires_at && isOfferOpen(o) && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4" />
            Answer by {new Date(o.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
          </span>
        )}
      </div>

      <OfferTermsView offer={o} />

      {o.message && <p className="text-sm leading-relaxed">{o.message}</p>}

      {!!o.shifts?.length && (
        <ul className="flex flex-wrap gap-1.5">
          {o.shifts.map((s, i) => (
            <li key={i} className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs">
              {shiftLabel(s)}
            </li>
          ))}
        </ul>
      )}

      {o.decline_reason && o.status === "declined" && (
        <p className="text-sm text-muted-foreground">You said: {o.decline_reason}</p>
      )}

      {isOfferOpen(o) && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={busy === o.id} onClick={() => respond(o, "accept")}>
            {busy === o.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
            Accept
          </Button>
          <Button size="sm" variant="outline" disabled={busy === o.id} onClick={() => { setDeclining(o); setReason(""); }}>
            <X className="mr-1.5 h-4 w-4" />Decline
          </Button>
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-4">
      <PortalSection
        title="Offers waiting on you"
        description="Say yes and we book it. Say no and it costs you nothing, it only tells us what suits."
        padded={false}
      >
        {open.length === 0 ? (
          <PortalEmpty
            icon={BriefcaseBusiness}
            art={art.objHandshake}
            title="Nothing waiting on you"
            description="Keep your availability and preferences current and we will come to you when something fits."
          />
        ) : (
          <ul className="divide-y divide-border/60">{open.map(card)}</ul>
        )}
      </PortalSection>

      {past.length > 0 && (
        <PortalSection title="Earlier offers" padded={false}>
          <ul className="divide-y divide-border/60">{past.map(card)}</ul>
        </PortalSection>
      )}

      <Dialog open={!!declining} onOpenChange={(v) => !v && setDeclining(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this offer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A short reason helps us send you better work next time. It is optional.
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Too far, wrong hours, already booked..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)}>Keep it open</Button>
            <Button
              variant="destructive"
              disabled={busy === declining?.id}
              onClick={() => declining && respond(declining, "decline", reason.trim() || undefined)}
            >
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OffersPanel;

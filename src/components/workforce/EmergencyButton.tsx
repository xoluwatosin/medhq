// The field worker's emergency button. Two taps (open, then send) so a pocket
// press does not raise one; the office is told at once, with the visit the
// worker is on and the phone's location if it gives one in a few seconds.
// While the alert is open the worker sees whether the office has picked it up.
import { useEffect, useRef, useState } from "react";
import { myOpenAlert, newEventId, raiseEmergency, readDeviceLocation, type OpenAlert } from "@/lib/visits";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

export const EmergencyButton = ({ visitId }: { visitId: string | null }) => {
  const [alert, setAlert] = useState<OpenAlert | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventId = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    const check = () => myOpenAlert().then((a) => { if (live) setAlert(a); }).catch(() => {});
    void check();
    const t = window.setInterval(check, 30000);
    return () => { live = false; window.clearInterval(t); };
  }, []);

  const send = async () => {
    setSending(true);
    setError(null);
    eventId.current ??= newEventId();
    try {
      const loc = await readDeviceLocation(5000);
      setAlert(await raiseEmergency(eventId.current, visitId, loc, note));
      setConfirming(false);
      eventId.current = null;
      setNote("");
    } catch {
      setError("It did not send. Try again now, and phone the office if you can.");
    } finally {
      setSending(false);
    }
  };

  if (alert) {
    return (
      <section role="status" className="border-2 border-white bg-white/10 px-4 py-3 text-white">
        <p className="text-[15px] font-bold">
          {alert.status === "acknowledged" ? "The office has your alert and is acting on it." : "Emergency sent. The office has been told."}
        </p>
        <p className="text-[13px] text-white/80">
          Sent at {time(alert.raised_at)}. If you are in danger, call 112.
        </p>
      </section>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full border-2 border-[#FFD7D7] py-3 text-[16px] font-bold text-[#FFD7D7]"
      >
        Emergency
      </button>
    );
  }

  return (
    <section aria-label="Send an emergency alert" className="space-y-3 border-2 border-[#FFD7D7] px-4 py-4 text-white">
      <p className="text-[15px] font-bold">Send an emergency alert to the office now?</p>
      <p className="text-[13px] text-white/80">
        Every coordinator is told at once, with where you are if your phone allows. If you are in danger, call 112 first.
      </p>
      <label className="block text-[14px]">
        <span className="font-bold">What is happening (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={2}
          className="mt-1 w-full bg-white/10 px-3 py-2 text-[15px] text-white"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={sending}
          onClick={send}
          className="flex-1 bg-[#FFD7D7] py-3 text-[16px] font-bold text-navy disabled:opacity-60"
        >
          {sending ? "Sending" : "Send now"}
        </button>
        <button
          type="button"
          disabled={sending}
          onClick={() => { setConfirming(false); setError(null); }}
          className="border border-white/60 px-4 py-3 text-[15px] text-white"
        >
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-[14px] font-bold text-[#FFD7D7]">{error}</p>}
    </section>
  );
};

export default EmergencyButton;

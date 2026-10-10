/// <reference types="google.maps" />
// Live, for coordinators: who is on the way to a visit (their last position),
// who is on a visit, and any open emergency, on a Google map with a list
// underneath. Refreshes every 30 seconds. Without a Maps key the list alone
// shows, each with a link to open the place in Google Maps.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Status } from "@/components/field";
import { MuEmpty } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { useGoogleMapsReady } from "@/components/portal/GoogleMapsLoader";
import { liveMap, minutesAgo, type LiveMapData } from "@/lib/care-schedule";
import { mapsUrl } from "@/lib/visits";

const LAGOS = { lat: 6.5244, lng: 3.3792 };

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });


type Pin = { lat: number; lng: number; label: string; colour: string; title: string };

const pinsFor = (d: LiveMapData): Pin[] => [
  ...d.emergencies.filter((e) => e.lat != null && e.lng != null)
    .map((e) => ({ lat: e.lat!, lng: e.lng!, label: "!", colour: "#C0392B", title: `Emergency: ${e.person_name}` })),
  ...d.travelling.filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({ lat: t.lat!, lng: t.lng!, label: "→", colour: "#0B2545", title: `${t.person_name}, on the way to ${t.client_name}` })),
  ...d.on_visit.filter((v) => v.lat != null && v.lng != null)
    .map((v) => ({ lat: v.lat!, lng: v.lng!, label: "•", colour: v.overdue ? "#B7791F" : "#2F855A", title: `${v.person_name} with ${v.client_name}` })),
];

const MapView = ({ pins }: { pins: Pin[] }) => {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const [libs, setLibs] = useState<{ maps: google.maps.MapsLibrary; marker: google.maps.MarkerLibrary } | null>(null);

  // With async loading, the map and marker classes come from importLibrary.
  useEffect(() => {
    let live = true;
    Promise.all([
      google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
      google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
    ]).then(([maps, marker]) => { if (live) setLibs({ maps, marker }); }).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!libs || !el.current || map.current) return;
    map.current = new libs.maps.Map(el.current, {
      center: LAGOS, zoom: 11, streetViewControl: false, mapTypeControl: false, fullscreenControl: true,
    });
  }, [libs]);

  useEffect(() => {
    if (!libs || !map.current) return;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = pins.map((p) => new libs.marker.Marker({
      map: map.current!, position: { lat: p.lat, lng: p.lng }, title: p.title,
      label: { text: p.label, color: "#ffffff", fontWeight: "700" },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 11, fillColor: p.colour, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 },
    }));
    if (pins.length === 1) {
      map.current.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
      map.current.setZoom(14);
    } else if (pins.length > 1) {
      const b = new google.maps.LatLngBounds();
      pins.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
      map.current.fitBounds(b, 48);
    }
  }, [pins, libs]);

  return <div ref={el} className="h-[420px] w-full border border-line-soft" role="region" aria-label="Map of workers" />;
};

export const LiveMap = () => {
  const ready = useGoogleMapsReady();
  const [data, setData] = useState<LiveMapData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await liveMap();
      setData(d);
      setFailed(d === null);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => { void load(); }, 30000);
    return () => window.clearInterval(t);
  }, [load]);

  const pins = useMemo(() => (data ? pinsFor(data) : []), [data]);

  if (failed) return <p className="border border-line-soft p-4 text-[14px] text-body">The live view could not be loaded.</p>;
  if (!data) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-copy" />;

  const empty = data.travelling.length + data.on_visit.length + data.emergencies.length === 0;
  const link = (lat: number | null, lng: number | null) =>
    lat != null && lng != null ? mapsUrl({ lat, lng, address: null }) : null;

  return (
    <div className="flex flex-col gap-6">
      {ready ? <MapView pins={pins} /> : (
        <p className="border border-line-soft p-3 text-[13px] text-muted-copy">
          The map needs the Google Maps key. Until it is set, each place below opens in Google Maps.
        </p>
      )}
      <p className="text-[12px] text-muted-copy">
        Positions come from workers' phones only while they share a trip to a visit, at check-in and at check-out,
        and when they press the emergency button. Routes are deleted after 90 days.
      </p>

      {empty && <MuEmpty art={art.objMagnifier} title="No one is on the way or on a visit right now" />}

      {data.emergencies.length > 0 && (
        <section aria-labelledby="live-emergencies" className="flex flex-col gap-2">
          <h3 id="live-emergencies" className="text-[13px] font-bold uppercase tracking-wide text-muted-copy">Emergencies</h3>
          {data.emergencies.map((e) => (
            <article key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-2 border-destructive p-3">
              <p className="text-[14px] text-ink"><span className="font-bold">{e.person_name}</span> at {time(e.raised_at)}{e.note ? `: ${e.note}` : ""}</p>
              {link(e.lat, e.lng) ? <a className="text-[14px] font-bold text-brand underline" href={link(e.lat, e.lng)!} target="_blank" rel="noreferrer">Open in Google Maps</a>
                : <span className="text-[13px] text-muted-copy">No location</span>}
            </article>
          ))}
        </section>
      )}

      {data.travelling.length > 0 && (
        <section aria-labelledby="live-travelling" className="flex flex-col gap-2">
          <h3 id="live-travelling" className="text-[13px] font-bold uppercase tracking-wide text-muted-copy">On the way</h3>
          {data.travelling.map((t) => (
            <article key={t.journey_id} className="flex flex-wrap items-center justify-between gap-3 border border-line-soft p-3">
              <div>
                <p className="text-[14px] text-ink"><span className="font-bold">{t.person_name}</span> to {t.client_name}, due {time(t.scheduled_start)}</p>
                <p className="text-[13px] text-muted-copy">
                  Last seen {minutesAgo(t.last_at)}{t.accuracy_m != null ? `, within ${t.accuracy_m} m` : ""}
                </p>
              </div>
              {link(t.lat, t.lng) && <a className="text-[14px] font-bold text-brand underline" href={link(t.lat, t.lng)!} target="_blank" rel="noreferrer">Open in Google Maps</a>}
            </article>
          ))}
        </section>
      )}

      {data.on_visit.length > 0 && (
        <section aria-labelledby="live-visits" className="flex flex-col gap-2">
          <h3 id="live-visits" className="text-[13px] font-bold uppercase tracking-wide text-muted-copy">On a visit</h3>
          {data.on_visit.map((v) => (
            <article key={v.visit_id} className="flex flex-wrap items-center justify-between gap-3 border border-line-soft p-3">
              <p className="text-[14px] text-ink">
                <span className="font-bold">{v.person_name}</span> with {v.client_name}, since {v.check_in_at ? time(v.check_in_at) : "?"}, due out {time(v.scheduled_end)}
              </p>
              {v.overdue ? <Status label="Not checked out" tone="bad" /> : <Status label="In progress" tone="progress" />}
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default LiveMap;

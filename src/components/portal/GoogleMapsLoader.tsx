/// <reference types="google.maps" />
// Load the Google Maps JavaScript API once, and expose a ready flag.
// Uses the browser key from the connected Google Maps Platform connector.
import { useEffect, useState } from "react";

const BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
const TRACKING_ID = import.meta.env.VITE_GOOGLE_MAPS_TRACKING_ID;

let loadPromise: Promise<boolean> | null = null;

const doLoad = (): Promise<boolean> => {
  if (loadPromise) return loadPromise;
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!BROWSER_KEY) {
    console.warn("Google Maps browser key is not configured.");
    return Promise.resolve(false);
  }
  if ((window as any).google?.maps?.places) return Promise.resolve(true);

  loadPromise = new Promise((resolve) => {
    const scriptId = "google-maps-js-api";
    if (document.getElementById(scriptId)) {
      // Already loading; wait for callback.
      const check = () => {
        if ((window as any).google?.maps?.places) { resolve(true); return; }
        setTimeout(check, 100);
      };
      check();
      return;
    }

    const cbName = `__gmInit_${Math.random().toString(36).slice(2, 9)}`;
    (window as any)[cbName] = () => resolve(true);

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=${cbName}&libraries=places&channel=${TRACKING_ID ?? ""}`;
    script.onerror = () => {
      console.error("Google Maps script failed to load.");
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return loadPromise;
};

export const useGoogleMapsReady = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => { doLoad().then(setReady); }, []);
  return ready;
};

export const importPlacesLibrary = async (): Promise<google.maps.PlacesLibrary | null> => {
  const ok = await doLoad();
  if (!ok) return null;
  return (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
};

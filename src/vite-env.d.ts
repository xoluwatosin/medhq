/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;
  readonly VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY?: string;
  readonly VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID?: string;
  readonly VITE_GOOGLE_ADS_AW_ID?: string;
  readonly VITE_GOOGLE_ADS_CONTACT_LABEL?: string;
  readonly VITE_GOOGLE_ADS_CARE_LABEL?: string;
  readonly VITE_GOOGLE_ADS_JOIN_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

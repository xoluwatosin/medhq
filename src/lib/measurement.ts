// Google Analytics 4 + Google Ads conversion measurement.
// Safe to call before gtag loads; calls are queued in window.dataLayer.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const AW_ID = import.meta.env.VITE_GOOGLE_ADS_AW_ID;
const CONTACT_FORM_LABEL = import.meta.env.VITE_GOOGLE_ADS_CONTACT_LABEL;
const CARE_REQUEST_LABEL = import.meta.env.VITE_GOOGLE_ADS_CARE_LABEL;
const JOIN_APPLICATION_LABEL = import.meta.env.VITE_GOOGLE_ADS_JOIN_LABEL;

const DEFAULT_VALUE_NGN = 35000; // Care Assessment Fee

function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag === "function") {
    window.gtag(...args);
  } else {
    window.dataLayer.push(args);
  }
}

/** Boot the measurement queue and, if configured, load Google Ads. */
export function initMeasurement() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      window.dataLayer!.push(arguments);
    };
  }
  if (AW_ID) {
    gtag("config", AW_ID);
  }
}

/** Fire any GA4 custom event. */
export function gaEvent(name: string, params?: Record<string, unknown>) {
  gtag("event", name, params);
}

/** Fire a SPA page_view so route changes are tracked. */
export function pageView(path: string, title?: string) {
  gaEvent("page_view", { page_path: path, page_title: title });
}

/** Fire a Google Ads conversion with optional value in NGN. */
export function adConversion(label: string, value?: number) {
  if (!AW_ID || !label) return;
  const payload: Record<string, unknown> = {
    send_to: `${AW_ID}/${label}`,
  };
  if (typeof value === "number") {
    payload.value = value;
    payload.currency = "NGN";
  }
  gtag("event", "conversion", payload);
}

/** Contact form submission (including the welcome intake path). */
export function trackContactForm(source: string = "contact_form", value: number = DEFAULT_VALUE_NGN) {
  gaEvent("generate_lead", { method: source });
  adConversion(CONTACT_FORM_LABEL, value);
}

/** Care request dialog submitted. */
export function trackCareRequest(serviceLine?: string, value: number = DEFAULT_VALUE_NGN) {
  gaEvent("submit_form", { form_name: "care_request", service_line: serviceLine ?? "unknown" });
  adConversion(CARE_REQUEST_LABEL, value);
}

/** Someone showed interest in a service line, before any request is sent. */
export function trackServiceInterest(serviceLine: string, source: string) {
  gaEvent("select_item", { item_list_name: "service_lines", item_id: serviceLine, source });
}

/** Candidate successfully creates an account to join the network. */
export function trackJoinApplication(track: string) {
  gaEvent("sign_up", { method: "join_account", track });
  adConversion(JOIN_APPLICATION_LABEL);
}

/** WhatsApp, phone, or email link clicked. */
export function trackOutboundClick(href: string, type: "whatsapp" | "phone" | "email") {
  gaEvent("contact", { method: type });
  gaEvent("outbound_click", { destination: href, transport_type: "beacon" });
}

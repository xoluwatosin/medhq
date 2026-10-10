import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { captureAttribution } from "@/lib/utm";

// Capture UTM params + referrer on first landing (first-touch attribution).
captureAttribution();

const rootEl = document.getElementById("root")!;

// Pre-rendered pages arrive with their content already in #root. While the
// page's own code downloads, keep showing that content rather than a blank
// screen. Later page changes keep the old page up until the new one is ready.
const prerendered = rootEl.innerHTML;
const FirstPaint = () =>
  prerendered ? <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: prerendered }} /> : null;

createRoot(rootEl).render(
  <HelmetProvider>
    <Suspense fallback={<FirstPaint />}>
      <App />
    </Suspense>
  </HelmetProvider>
);

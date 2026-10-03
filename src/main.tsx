import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { captureAttribution } from "@/lib/utm";

// Capture UTM params + referrer on first landing (first-touch attribution).
captureAttribution();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Turning the rendered contract into a PDF.
//
// The PDF is produced from the very same DOM the person read and signed, so
// there is no second layout to keep in step. The sheet is captured at print
// width and sliced into A4 pages. The slicing rules themselves live in
// contract-pdf-core.ts so they can be tested without a browser canvas.
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { computePageSlices, type SliceProbes } from "@/lib/contract-pdf-core";

const A4_W = 210;
const A4_H = 297;

export async function contractToPdfBlob(node: HTMLElement): Promise<Blob> {
  // Blocks that must never be cut through: an execution page, a signature
  // card, a table row. Their positions are read before capture and used to
  // move a page break up to the top of whatever it would have split.
  const nodeTop = node.getBoundingClientRect().top;
  const measure = (selector: string, pad: number) =>
    Array.from(node.querySelectorAll<HTMLElement>(selector)).map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - nodeTop, bottom: r.bottom - nodeTop, pad };
    });
  // A signature panel gets a little clearance above it so its label never
  // strands at the foot of the page. A table row only needs to stay whole.
  const keepWhole = [
    ...measure(".mc-exec, .mc-sign-grid, .mc-sign-card, .mc-accept-inner", 44),
    ...measure("tr", 0),
  ];


  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: node.scrollWidth,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const firstPagePx = Math.floor((canvas.width * A4_H) / A4_W);
  const continuationPx = Math.floor((canvas.width * (A4_H - 6)) / A4_W);
  // Vertical scale is taken from the captured height against the measured
  // height, so block positions land exactly where html2canvas drew them.
  const scale = canvas.height / (node.getBoundingClientRect().height || node.scrollHeight);
  const full = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;

  const probes: SliceProbes = {
    /** Near enough to white to cut on. A table's vertical rules leave a few
        dark pixels on an otherwise empty row, so a handful is allowed. */
    rowIsBlank: (y, allowance = 0) => {
      if (!full || y < 0 || y >= canvas.height) return true;
      const data = full.getImageData(0, y, canvas.width, 1).data;
      let dark = 0;
      for (let i = 0; i < data.length; i += 16) {
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
          dark += 1;
          if (dark > allowance) return false;
        }
      }
      return true;
    },
    /** A full width rule, which in a table means the line between two rows.
        Cutting on one keeps every row whole no matter how the bitmap landed. */
    rowIsRule: (y) => {
      if (!full || y < 1 || y >= canvas.height) return false;
      const data = full.getImageData(0, y, canvas.width, 1).data;
      let dark = 0;
      let seen = 0;
      for (let i = 0; i < data.length; i += 16) {
        seen += 1;
        if (data[i] < 246 || data[i + 1] < 246 || data[i + 2] < 246) dark += 1;
      }
      return seen > 0 && dark / seen > 0.85;
    },
  };

  const slices = computePageSlices({
    contentHeightPx: canvas.height,
    firstPageHeightPx: firstPagePx,
    continuationHeightPx: continuationPx,
    scale,
    keepWhole,
    probes,
  });

  slices.forEach((slice, index) => {
    const strip = document.createElement("canvas");
    strip.width = canvas.width;
    strip.height = slice.height;
    const ctx = strip.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, strip.width, strip.height);
    ctx.drawImage(canvas, 0, slice.offset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);

    if (index > 0) pdf.addPage();
    // A continuation page gets a little air at the top so a heading never sits
    // flush against the paper edge.
    const topMm = index === 0 ? 0 : 6;
    pdf.addImage(
      strip.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      topMm,
      A4_W,
      (slice.height * A4_W) / canvas.width,
    );
  });

  return pdf.output("blob");
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

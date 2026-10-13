/**
 * Table export: CSV for spreadsheets, PDF for sharing and printing.
 *
 * Both take the same shape - a title, headers and rows of plain values - so
 * the table decides WHAT is exported and this file only decides HOW. jsPDF is
 * imported on demand, so it costs nothing until someone asks for a PDF.
 */

export type ExportCell = string | number;

export type ExportTable = {
  /** "Orders", "Transactions"… - the PDF heading. */
  title: string;
  /** File name without extension or date, e.g. "orders". */
  fileName: string;
  headers: string[];
  /** Per column: right-align it in the PDF (money, counts). */
  numeric?: boolean[];
  /** CSV rows: raw values, so spreadsheets can sum and sort them. */
  csvRows: ExportCell[][];
  /** PDF rows: formatted for reading (₦85,000, Sep 15, 2026). */
  pdfRows: string[][];
  /** Lines under the PDF heading, e.g. active filters. */
  notes?: string[];
};

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---- CSV ---------------------------------------------------------------- */

export function exportCsv(t: ExportTable) {
  const escape = (v: ExportCell) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [t.headers, ...t.csvRows].map((row) => row.map(escape).join(","));
  // The BOM makes Excel read the file as UTF-8, so ₦ and accents survive.
  download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${t.fileName}-${stamp()}.csv`);
}

/* ---- PDF ---------------------------------------------------------------- */

/**
 * jsPDF's built-in Helvetica only covers WinAnsi (roughly Latin-1). ₦ and a
 * few typographic characters are outside it and would print as garbage, so
 * they are spelled out; anything else outside the set becomes "?".
 */
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function pdfSafe(s: string): string {
  return s
    .replace(/₦\s?/g, "NGN ")
    .replace(/[−‒]/g, "-")
    .replace(/[^\x00-\xFF]/g, (ch) => (WINANSI_EXTRA.has(ch) ? ch : "?"));
}

/**
 * The 1 MB logo, drawn down to a small JPEG for the PDF header. It always sits
 * on the black band, so the canvas is filled black first and needs no alpha.
 */
async function logoDataUrl(): Promise<string | null> {
  try {
    const img = new Image();
    img.src = "/assets/brand/beyond-service-logo.png";
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 420;
    canvas.height = Math.round((420 * img.naturalHeight) / img.naturalWidth);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#0b0b0c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

// Brand colours as RGB for jsPDF (from globals.css: onyx, signal, paper, slate).
const ONYX: [number, number, number] = [11, 11, 12];
const SIGNAL: [number, number, number] = [251, 11, 1];
const PAPER: [number, number, number] = [243, 243, 243];
const SLATE: [number, number, number] = [82, 87, 92];

export async function exportPdf(t: ExportTable) {
  const [{ jsPDF }, { autoTable }, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), logoDataUrl()]);

  // Landscape: admin tables are wide.
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  const exported = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  // Page 1 heading: a black band with the logo, a red rule, then the title.
  doc.setFillColor(...ONYX);
  doc.rect(0, 0, W, 56, "F");
  if (logo) doc.addImage(logo, "JPEG", M, 12, 90, 90 * (750 / 2097));
  else {
    doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(14);
    doc.text("BEYOND SERVICE", M, 34);
  }
  doc.setTextColor(255, 255, 255).setFont("helvetica", "normal").setFontSize(8);
  doc.text("ADMIN", W - M, 32, { align: "right" });
  doc.setFillColor(...SIGNAL);
  doc.rect(0, 56, W, 3, "F");

  doc.setTextColor(...ONYX).setFont("helvetica", "bold").setFontSize(20);
  doc.text(pdfSafe(t.title), M, 92);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...SLATE);
  const meta = [`Exported ${exported} (Lagos)`, `${t.pdfRows.length} ${t.pdfRows.length === 1 ? "row" : "rows"}`, ...(t.notes ?? [])];
  doc.text(pdfSafe(meta.join("  ·  ")), M, 108);

  autoTable(doc, {
    head: [t.headers.map(pdfSafe)],
    body: t.pdfRows.map((r) => r.map(pdfSafe)),
    startY: 122,
    margin: { left: M, right: M, top: M, bottom: 40 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: ONYX, lineColor: [219, 221, 224], lineWidth: 0 },
    headStyles: { fillColor: ONYX, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: PAPER },
    columnStyles: Object.fromEntries((t.numeric ?? []).map((n, i) => [i, { halign: n ? "right" : "left" }])),
    didParseCell: ({ section, column, cell }) => {
      if (section === "head" && t.numeric?.[column.index]) cell.styles.halign = "right";
    },
    didDrawPage: () => {
      doc.setFontSize(8).setTextColor(...SLATE);
      doc.text("Goondu Games Studio  ·  Beyond Service admin  ·  Confidential", M, H - 18);
    },
  });

  // Page numbers go on last, once the total is known.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(...SLATE);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 18, { align: "right" });
  }

  doc.save(`${t.fileName}-${stamp()}.pdf`);
}

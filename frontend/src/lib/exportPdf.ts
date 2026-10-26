import { jsPDF } from "jspdf";

import type { DiagnoseSession } from "../state/types.ts";
import { formatCaseTime } from "./cases.ts";

const TEAL: [number, number, number] = [15, 95, 92];
const CHARCOAL: [number, number, number] = [43, 39, 36];
const MUTED: [number, number, number] = [111, 100, 92];
const IVORY: [number, number, number] = [251, 246, 239];

export async function exportReportPdf(session: DiagnoseSession): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  let y = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed < pageHeight - 18) return;
    doc.addPage();
    y = margin;
  };

  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(251, 246, 239);
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text("HealthCure", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Decision support report — not a diagnosis or medical device", margin, 20);

  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(`Case ${session.id}`, pageWidth - margin, 12, { align: "right" });
  doc.text(formatCaseTime(session.createdAt), pageWidth - margin, 18, { align: "right" });

  y = 38;
  doc.setTextColor(...CHARCOAL);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  const diagnosisLines = doc.splitTextToSize(session.report.diagnosis, pageWidth - margin * 2);
  doc.text(diagnosisLines, margin, y);
  y += diagnosisLines.length * 7 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const badges = [
    `Image: ${session.image.label} (${(session.image.confidence * 100).toFixed(1)}%)`,
    `Notes: ${session.textPrediction.label} (${(session.textPrediction.confidence * 100).toFixed(1)}%)`,
    `Risk: ${session.risk.level} (${(session.risk.risk_score * 100).toFixed(0)}%)`,
    session.report.agreement ? "Modalities agree" : "Modalities disagree",
    `Dataset: ${session.dataset}`,
  ];
  for (const badge of badges) {
    ensureSpace(8);
    doc.setFillColor(...IVORY);
    doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 8, 2, 2, "F");
    doc.setTextColor(...TEAL);
    doc.text(badge, margin + 3, y + 1.5);
    y += 10;
  }

  y += 2;
  ensureSpace(12);
  doc.setTextColor(...CHARCOAL);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("Symptom notes", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const noteLines = doc.splitTextToSize(session.text, pageWidth - margin * 2);
  ensureSpace(noteLines.length * 5 + 4);
  doc.text(noteLines, margin, y);
  y += noteLines.length * 5 + 6;

  const imageData = await rasterizeForPdf(session.originalImageUrl);
  if (imageData) {
    ensureSpace(78);
    doc.setTextColor(...CHARCOAL);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.text("Chest X-ray", margin, y);
    y += 4;
    const imgWidth = 78;
    const imgHeight = 78;
    try {
      doc.addImage(imageData, "JPEG", margin, y, imgWidth, imgHeight, undefined, "FAST");
    } catch {
      /* skip if the browser cannot encode the image */
    }
    y += imgHeight + 8;
  }

  ensureSpace(20);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...CHARCOAL);
  doc.text("SHAP feature contributions", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const shap = Object.entries(session.risk.shap_contributions)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 10);
  for (const [name, value] of shap) {
    ensureSpace(6);
    doc.setTextColor(...MUTED);
    doc.text(name, margin, y);
    doc.setTextColor(value >= 0 ? TEAL[0] : 194, value >= 0 ? TEAL[1] : 96, value >= 0 ? TEAL[2] : 62);
    doc.text((value >= 0 ? "+" : "") + value.toFixed(4), pageWidth - margin, y, { align: "right" });
    y += 5.5;
  }

  y += 4;
  ensureSpace(20);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...CHARCOAL);
  doc.text("Influential words (LIME)", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const words = Object.entries(session.textPrediction.lime_word_weights)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 10);
  if (words.length === 0) {
    doc.setTextColor(...MUTED);
    doc.text("No word weights returned.", margin, y);
    y += 6;
  } else {
    for (const [word, value] of words) {
      ensureSpace(6);
      doc.setTextColor(...MUTED);
      doc.text(word, margin, y);
      doc.setTextColor(...CHARCOAL);
      doc.text(value.toFixed(3), pageWidth - margin, y, { align: "right" });
      y += 5.5;
    }
  }

  y += 4;
  ensureSpace(24);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...CHARCOAL);
  doc.text("Next step", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const nextLines = doc.splitTextToSize(session.report.next_step, pageWidth - margin * 2);
  ensureSpace(nextLines.length * 5 + 8);
  doc.text(nextLines, margin, y);
  y += nextLines.length * 5 + 8;

  ensureSpace(28);
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const disclaimer = doc.splitTextToSize(session.report.disclaimer, pageWidth - margin * 2);
  doc.text(disclaimer, margin, y);
  y += disclaimer.length * 4 + 6;
  doc.text(`Generated ${new Date().toISOString()} · HealthCure ${session.id}`, margin, y);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  doc.save(`HealthCure-${session.id}.pdf`);
}

async function rasterizeForPdf(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    const max = 720;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

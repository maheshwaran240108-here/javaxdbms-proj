function sanitizePdfText(text) {
  return String(text || '')
    .replace(/[^\x20-\x7E]/g, (ch) => (ch === '\u2013' || ch === '\u2014' ? '-' : ch === '\u00b7' ? '|' : ' '))
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text, maxChars = 84) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function downloadAiReportPdf(aiReport) {
  if (!aiReport) return;

  const generatedAt = new Date().toLocaleString();
  const entries = [
    { text: 'PREDICTIVE MAINTENANCE & EQUIPMENT FAILURE SYSTEM', font: 'F2', size: 14, gap: 18 },
    { text: 'AI-Generated Machine Performance Report', font: 'F2', size: 12, gap: 18 },
    { text: `Product ID / Machine ID: ${aiReport.machineId}`, font: 'F2', size: 10, gap: 14 },
    { text: `Report Generated: ${generatedAt}`, font: 'F1', size: 10, gap: 20 },
    { text: '1. MACHINE CONDITION', font: 'F2', size: 11, gap: 15 },
    ...wrapLine(aiReport.condition).map((line) => ({ text: line, font: 'F1', size: 10, gap: 14 })),
    { text: '', font: 'F1', size: 10, gap: 8 },
    { text: '2. OBSERVED TELEMETRY PATTERNS', font: 'F2', size: 11, gap: 15 },
    ...aiReport.observations.flatMap((obs) => wrapLine(`- ${obs}`).map((line) => ({ text: line, font: 'F1', size: 10, gap: 14 }))),
    { text: '', font: 'F1', size: 10, gap: 8 },
    { text: '3. AI FAILURE PREDICTION & MAINTENANCE ALERTS', font: 'F2', size: 11, gap: 15 },
    ...wrapLine(`Prediction: ${aiReport.predictionSummary}`).map((line) => ({ text: line, font: 'F1', size: 10, gap: 14 })),
    ...wrapLine(`Alerts: ${aiReport.alertSummary}`).map((line) => ({ text: line, font: 'F1', size: 10, gap: 14 })),
    ...wrapLine(`Model Context: ${aiReport.modelContext}`).map((line) => ({ text: line, font: 'F1', size: 10, gap: 14 })),
    { text: '', font: 'F1', size: 10, gap: 8 },
    { text: '4. POSSIBLE RISKS & RECOMMENDED MAINTENANCE ACTIONS', font: 'F2', size: 11, gap: 15 },
    ...aiReport.risks.flatMap((r) => wrapLine(`- Risk: ${r}`).map((line) => ({ text: line, font: 'F1', size: 10, gap: 14 }))),
    ...aiReport.actions.flatMap((a) => wrapLine(`- Action: ${a}`).map((line) => ({ text: line, font: 'F1', size: 10, gap: 14 }))),
  ];

  // Build pages (Letter: 612 x 792 pt, top margin 750, bottom margin 55)
  const pages = [];
  let currentOps = [];
  let y = 750;

  for (const entry of entries) {
    if (y - entry.gap < 55) {
      pages.push(currentOps.join('\n'));
      currentOps = [];
      y = 750;
    }
    if (entry.text) {
      currentOps.push(`BT /${entry.font} ${entry.size} Tf 50 ${y} Td (${sanitizePdfText(entry.text)}) Tj ET`);
    }
    y -= entry.gap;
  }
  if (currentOps.length || !pages.length) pages.push(currentOps.join('\n'));

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pagesPlaceholderId = addObject('');

  const pageIds = [];
  for (const streamContent of pages) {
    const contentId = addObject(`<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesPlaceholderId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[pagesPlaceholderId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesPlaceholderId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `performance-report-${String(aiReport.machineId || 'machine').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

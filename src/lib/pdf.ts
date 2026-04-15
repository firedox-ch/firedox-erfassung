import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Liegenschaft, Mangel } from './db';

// Brand colors matching the Brandschutzdossier template
const GREEN: [number, number, number] = [34, 139, 34];
const GREEN_LIGHT: [number, number, number] = [240, 255, 240];
const GREEN_HEADER: [number, number, number] = [45, 140, 60];
const DARK: [number, number, number] = [33, 33, 33];
const GRAY: [number, number, number] = [100, 100, 100];
const LIGHT_GRAY: [number, number, number] = [220, 220, 220];
const WHITE: [number, number, number] = [255, 255, 255];

const PRIO_COLORS: Record<string, [number, number, number]> = {
  Kritisch: [200, 30, 30],
  Hoch: [220, 120, 20],
  Mittel: [180, 160, 20],
  Gering: [34, 139, 34],
};

const PRIO_BG: Record<string, [number, number, number]> = {
  Kritisch: [255, 230, 230],
  Hoch: [255, 243, 224],
  Mittel: [255, 252, 220],
  Gering: [230, 255, 230],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastY(doc: any): number {
  return doc.lastAutoTable?.finalY ?? 40;
}

function addPageHeader(doc: jsPDF, liegenschaft: Liegenschaft) {
  const pw = doc.internal.pageSize.getWidth();
  // Top green line
  doc.setFillColor(...GREEN_HEADER);
  doc.rect(0, 0, pw, 2, 'F');
  // Header text
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text('BRANDSCHUTZDOSSIER', 14, 8);
  doc.text(
    `${liegenschaft.name} | ${liegenschaft.begehungsDatum || new Date().toLocaleDateString('de-CH')}`,
    pw - 14,
    8,
    { align: 'right' }
  );
  doc.setDrawColor(...LIGHT_GRAY);
  doc.line(14, 10, pw - 14, 10);
}

function addPageFooter(doc: jsPDF, liegenschaft: Liegenschaft, pageNum: number, totalPages: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...LIGHT_GRAY);
  doc.line(14, ph - 14, pw - 14, ph - 14);
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(`FireDox | ${liegenschaft.name}`, 14, ph - 8);
  doc.text(`Seite ${pageNum} / ${totalPages}`, pw - 14, ph - 8, { align: 'right' });
}

function sectionTitle(doc: jsPDF, num: number, title: string, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...GREEN_HEADER);
  doc.rect(14, y, pw - 28, 8, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${num}. ${title}`, 18, y + 5.5);
  doc.setTextColor(...DARK);
  return y + 14;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, liegenschaft: Liegenschaft): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage();
    addPageHeader(doc, liegenschaft);
    return 18;
  }
  return y;
}

export async function generatePDF(
  liegenschaft: Liegenschaft,
  maengel: Mangel[]
): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  let y = 0;

  // ============================================================
  // PAGE 1: Cover — Objekt-Klassifizierung & Verantwortung
  // ============================================================

  // Top green bar
  doc.setFillColor(...GREEN_HEADER);
  doc.rect(0, 0, pw, 3, 'F');

  y = 20;
  doc.setTextColor(...DARK);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('BRANDSCHUTZDOSSIER', 14, y);

  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Qualitätssicherung (QSS) nach Brandschutzvorschriften BSV 2026', 14, y);

  y += 12;
  y = sectionTitle(doc, 1, 'Objekt-Klassifizierung & Verantwortung', y);

  const infoRows = [
    ['Objekt', liegenschaft.name],
    ['Adresse', `${liegenschaft.strasse}, ${liegenschaft.plz} ${liegenschaft.ort}`],
    ['Gebäudeart', liegenschaft.gebaeudeart || '-'],
    ['Baujahr', liegenschaft.baujahr || '-'],
    ['Geschosse', liegenschaft.anzahlGeschosse || '-'],
    ['Einheiten', liegenschaft.anzahlEinheiten || '-'],
    ['Eigentümer', liegenschaft.eigentuemer || '-'],
    ['Verwalter', liegenschaft.verwalter || '-'],
    ['Prüfer', liegenschaft.pruefer || '-'],
  ];

  autoTable(doc, {
    startY: y,
    body: infoRows,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35, textColor: GRAY },
      1: { cellWidth: 'auto', textColor: DARK },
    },
    margin: { left: 14, right: 14 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  y = lastY(doc) + 10;

  // Date of inspection
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Datum der Erstbegehung: ${liegenschaft.begehungsDatum || '-'}`, 14, y);
  y += 10;

  // Conformity badge
  const openCount = maengel.filter(m => m.status === 'Offen').length;
  const criticalCount = maengel.filter(m => m.prioritaet === 'Kritisch' && m.status === 'Offen').length;
  const isConform = criticalCount === 0;

  const badgeColor: [number, number, number] = isConform ? GREEN : [200, 30, 30];
  const badgeBg: [number, number, number] = isConform ? [230, 255, 230] : [255, 230, 230];
  doc.setFillColor(...badgeBg);
  doc.setDrawColor(...badgeColor);
  doc.roundedRect(14, y, 45, 14, 2, 2, 'FD');
  doc.setTextColor(...badgeColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(isConform ? 'KONFORM' : 'NICHT KONFORM', 36.5, y + 9, { align: 'center' });

  y += 22;

  // Notes
  if (liegenschaft.notizen) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(
      `Bemerkung: ${liegenschaft.notizen}`,
      pw - 28
    );
    doc.text(noteLines, 14, y);
    y += noteLines.length * 3.5 + 5;
  }

  // ============================================================
  // PAGE 2: Lebenszyklus Dokumentation (Audit Trail)
  // ============================================================
  doc.addPage();
  addPageHeader(doc, liegenschaft);
  y = 18;

  y = sectionTitle(doc, 2, 'Lebenszyklus Dokumentation (Audit Trail)', y);

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Zeitliche und qualitätsrelevante Dokumentation aller erfassten Brandschutzmassnahmen.', 14, y);
  y += 8;

  // Audit trail table from maengel
  if (maengel.length > 0) {
    const auditRows = maengel.map(m => [
      new Date(m.createdAt).toLocaleDateString('de-CH'),
      m.titel,
      m.ort + (m.geschoss ? ` (${m.geschoss})` : ''),
      m.prioritaet,
      m.status,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Datum', 'Massnahme / Feststellung', 'Ort', 'Priorität', 'Status']],
      body: auditRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: GREEN_HEADER, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 252, 248] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35 },
        3: { cellWidth: 22 },
        4: { cellWidth: 20 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          const prio = data.cell.raw as string;
          const color = PRIO_COLORS[prio];
          if (color) {
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 4 && data.section === 'body') {
          const status = data.cell.raw as string;
          data.cell.styles.textColor = status === 'Offen' ? [200, 30, 30] : [34, 139, 34];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    y = lastY(doc) + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('Keine Einträge vorhanden.', 14, y);
    y += 10;
  }

  // ============================================================
  // PAGE 3: Prüfbericht & Fotodokumentation
  // ============================================================
  doc.addPage();
  addPageHeader(doc, liegenschaft);
  y = 18;

  y = sectionTitle(doc, 3, 'Prüfbericht & Fotodokumentation', y);

  for (const mangel of maengel) {
    y = checkPageBreak(doc, y, 70, liegenschaft);

    // Mangel header box
    const prioColor = PRIO_COLORS[mangel.prioritaet] || DARK;
    const prioBg = PRIO_BG[mangel.prioritaet] || [245, 245, 245];

    doc.setFillColor(...prioBg);
    doc.setDrawColor(...prioColor);
    doc.roundedRect(14, y, pw - 28, 8, 1, 1, 'FD');
    doc.setTextColor(...prioColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${mangel.prioritaet.toUpperCase()} | ${mangel.titel}`, 18, y + 5.5);
    y += 12;

    // Details
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Ort: ${mangel.ort}${mangel.geschoss ? ` | Geschoss: ${mangel.geschoss}` : ''}`, 14, y);
    y += 4;
    doc.text(`Status: ${mangel.status} | Erfasst: ${new Date(mangel.createdAt).toLocaleDateString('de-CH')}`, 14, y);
    y += 5;

    if (mangel.beschreibung) {
      doc.setTextColor(...GRAY);
      const lines = doc.splitTextToSize(mangel.beschreibung, pw - 28);
      doc.text(lines, 14, y);
      y += lines.length * 3.5 + 3;
    }

    // Photos - side by side (2 per row)
    if (mangel.fotos.length > 0) {
      const photoWidth = 80;
      const photoHeight = 55;

      for (let i = 0; i < mangel.fotos.length; i += 2) {
        y = checkPageBreak(doc, y, photoHeight + 10, liegenschaft);

        // Left photo
        try {
          doc.addImage(mangel.fotos[i], 'JPEG', 14, y, photoWidth, photoHeight);
        } catch {
          doc.setFillColor(240, 240, 240);
          doc.rect(14, y, photoWidth, photoHeight, 'F');
          doc.setFontSize(7);
          doc.setTextColor(...GRAY);
          doc.text(`[Foto ${i + 1}]`, 54, y + photoHeight / 2, { align: 'center' });
        }

        // Right photo
        if (i + 1 < mangel.fotos.length) {
          try {
            doc.addImage(mangel.fotos[i + 1], 'JPEG', pw / 2 + 2, y, photoWidth, photoHeight);
          } catch {
            doc.setFillColor(240, 240, 240);
            doc.rect(pw / 2 + 2, y, photoWidth, photoHeight, 'F');
          }
        }

        y += photoHeight + 5;
      }
    }

    y += 5;
  }

  if (maengel.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('Keine Mängel bei der Begehung festgestellt.', 14, y);
  }

  // ============================================================
  // PAGE 4: Mängelliste (Übersicht) + Empfehlung
  // ============================================================
  doc.addPage();
  addPageHeader(doc, liegenschaft);
  y = 18;

  y = sectionTitle(doc, 4, 'Mängelliste (Übersicht)', y);

  if (maengel.length > 0) {
    const tableData = maengel.map((m, i) => [
      String(i + 1),
      m.titel,
      m.ort + (m.geschoss ? ` (${m.geschoss})` : ''),
      m.prioritaet,
      m.status,
      m.fotos.length > 0 ? `${m.fotos.length}` : '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Mangel', 'Ort', 'Priorität', 'Status', 'Fotos']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: GREEN_HEADER, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 252, 248] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35 },
        3: { cellWidth: 22 },
        4: { cellWidth: 20 },
        5: { cellWidth: 14, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          const prio = data.cell.raw as string;
          const color = PRIO_COLORS[prio];
          if (color) {
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 4 && data.section === 'body') {
          const status = data.cell.raw as string;
          data.cell.styles.textColor = status === 'Offen' ? [200, 30, 30] : [34, 139, 34];
        }
      },
    });

    y = lastY(doc) + 12;
  }

  // Summary box
  y = checkPageBreak(doc, y, 40, liegenschaft);
  y = sectionTitle(doc, 5, 'Periodische Überwachungsempfehlung', y);

  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('Zusammenfassung:', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);

  const summaryLines = [
    `Die gesamthafte Brandschutzbeurteilung der Liegenschaft "${liegenschaft.name}" wurde am ${liegenschaft.begehungsDatum || '-'} durchgeführt.`,
    `Es wurden insgesamt ${maengel.length} Feststellung(en) dokumentiert, davon ${openCount} offen${criticalCount > 0 ? ` (${criticalCount} kritisch)` : ''}.`,
    '',
    `Empfehlung: ${criticalCount > 0 ? 'Es müssen umgehend Massnahmen zur Behebung der kritischen Mängel eingeleitet werden.' : openCount > 0 ? 'Die offenen Mängel sollten zeitnah behoben und nachkontrolliert werden.' : 'Keine unmittelbaren Massnahmen erforderlich. Nächste periodische Kontrolle gemäss BSV-Richtlinien.'}`,
  ];

  for (const line of summaryLines) {
    if (line === '') { y += 3; continue; }
    const wrapped = doc.splitTextToSize(line, pw - 28);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 3.5 + 2;
  }

  y += 12;

  // Signature section
  y = checkPageBreak(doc, y, 40, liegenschaft);

  doc.setTextColor(...DARK);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Bestätigung', 14, y);
  y += 8;

  doc.setDrawColor(...DARK);
  doc.line(14, y + 12, 85, y + 12);
  doc.line(110, y + 12, pw - 14, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text('Unterschrift Prüfer', 14, y + 17);
  doc.text('Datum', 110, y + 17);

  y += 28;
  doc.setDrawColor(...DARK);
  doc.line(14, y, 85, y);
  doc.line(110, y, pw - 14, y);
  doc.text('Unterschrift Eigentümer / Verwalter', 14, y + 5);
  doc.text('Datum', 110, y + 5);

  // ============================================================
  // Add headers & footers to all pages
  // ============================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    // Header already added per page (except page 1 which has its own)
  }
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, liegenschaft, i, totalPages);
  }

  return doc.output('blob');
}

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Liegenschaft, Mangel, Asset, Begehung } from './db';

// Colors from the DOCX template
const TEXT: [number, number, number] = [51, 51, 51];       // #333333
const GREEN: [number, number, number] = [22, 163, 74];     // #16A34A
const HEADER_GRAY: [number, number, number] = [89, 89, 89]; // #595959
const LIGHT_GRAY: [number, number, number] = [166, 166, 166]; // #A6A6A6
const BLACK: [number, number, number] = [0, 0, 0];

const M = 20; // margin

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastY(doc: any): number {
  return doc.lastAutoTable?.finalY ?? 40;
}

function pageHeader(doc: jsPDF) {
  // "BRANDSCHUTZDOSSIER 2026" bold, dark gray
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...HEADER_GRAY);
  doc.text('BRANDSCHUTZDOSSIER 2026', M, 12);
  // "Konformität nach BSV 2026" italic below
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...HEADER_GRAY);
  doc.text('Konformität nach BSV 2026', M, 17);
}

function pageFooter(doc: jsPDF, page: number, total: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text(`${page} / ${total}`, pw - M, ph - 10, { align: 'right' });
}

function section(doc: jsPDF, num: number, title: string, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text(`${num}. ${title}`, M, y);
  y += 2;
  // Thick underline
  doc.setDrawColor(...TEXT);
  doc.setLineWidth(0.8);
  doc.line(M, y, pw - M, y);
  return y + 6;
}

function subSection(doc: jsPDF, num: string, title: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text(`${num} ${title}`, M, y);
  return y + 7;
}

function italic(doc: jsPDF, text: string, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...LIGHT_GRAY);
  const lines = doc.splitTextToSize(text, pw - M * 2);
  doc.text(lines, M, y);
  return y + lines.length * 4 + 3;
}

function needsPage(doc: jsPDF, y: number, h: number): boolean {
  return y + h > doc.internal.pageSize.getHeight() - 20;
}

function newPage(doc: jsPDF): number {
  doc.addPage();
  pageHeader(doc);
  return 26;
}

export async function generatePDF(
  liegenschaft: Liegenschaft,
  maengel: Mangel[],
  assets: Asset[] = [],
  begehungen: Begehung[] = []
): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const cw = pw - M * 2;
  let y = 0;

  const openMaengel = maengel.filter(m => m.status === 'Offen');
  const erledigtMaengel = maengel.filter(m => m.status === 'Erledigt');
  const criticalCount = openMaengel.filter(m => m.prioritaet === 'Kritisch').length;
  const isConform = criticalCount === 0 && openMaengel.length === 0;
  const datum = begehungen[0]?.datum || new Date().toLocaleDateString('de-CH');

  // ============================================================
  // PAGE 1: Deckblatt
  // ============================================================
  pageHeader(doc);
  y = 40;

  // Big title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  doc.text('BRANDSCHUTZDOSSIER', pw / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT);
  doc.text('Qualitätssicherung (QSS) nach Brandschutzvorschriften 2026', pw / 2, y, { align: 'center' });
  y += 16;

  // 1. Objekt-Klassifizierung & Verantwortung
  y = section(doc, 1, 'Objekt-Klassifizierung & Verantwortung', y);

  const infoRows = [
    ['Objekt:', liegenschaft.name + ', ' + liegenschaft.strasse + ', ' + liegenschaft.plz + ' ' + liegenschaft.ort],
    ['Eigentümerschaft:', liegenschaft.eigentuemer || '-'],
    ['Bewirtschaftung:', liegenschaft.verwalter || '-'],
    ['Gebäudeart:', liegenschaft.gebaeudeart || '-'],
    ['Baujahr / Geschosse:', (liegenschaft.baujahr || '-') + ' / ' + (liegenschaft.anzahlGeschosse || '-') + ' Geschosse'],
    ['Einheiten:', liegenschaft.anzahlEinheiten || '-'],
    ['QS-Verantwortlicher:', liegenschaft.pruefer ? `**${liegenschaft.pruefer}**` : '-'],
  ];

  // Top border for table
  doc.setDrawColor(...TEXT);
  doc.setLineWidth(0.8);
  doc.line(M, y, pw - M, y);
  y += 1;

  autoTable(doc, {
    startY: y,
    body: infoRows.map(r => [r[0], r[1].replace(/\*\*/g, '')]),
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 }, textColor: TEXT },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: M, right: M },
  });
  y = lastY(doc);

  // Bottom border for table
  doc.setDrawColor(...TEXT);
  doc.setLineWidth(0.8);
  doc.line(M, y, pw - M, y);
  y += 14;

  // Status der Konformität
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text(`Status der Konformität per ${datum}:`, pw / 2, y, { align: 'center' });
  y += 10;

  // KONFORM / NICHT KONFORM box
  const boxW = 55;
  const boxH = 14;
  const boxX = (pw - boxW) / 2;
  doc.setDrawColor(...TEXT);
  doc.setLineWidth(0.5);
  doc.rect(boxX, y, boxW, boxH);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(isConform ? GREEN : [200, 30, 30] as [number, number, number]));
  doc.text(isConform ? 'KONFORM' : 'NICHT KONFORM', pw / 2, y + 10, { align: 'center' });
  y += boxH + 10;

  // Conformity note
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...(isConform ? GREEN : [200, 30, 30] as [number, number, number]));
  const conformNote = isConform
    ? 'Konformitätsnachweis: Das Objekt erfüllt alle brandschutztechnischen Anforderungen gemäss BSV 2026. Die Betriebsbereitschaft ist vollumfänglich gewährleistet.'
    : `Hinweis: Es bestehen offene Mängel (${openMaengel.length} offen, davon ${criticalCount} kritisch). Die Konformität ist erst nach Behebung aller kritischen Mängel gegeben.`;
  const noteLines = doc.splitTextToSize(conformNote, cw);
  doc.text(noteLines, M, y);

  // ============================================================
  // PAGE 2: Sicherheitskonzept + Lebenszyklus
  // ============================================================
  y = newPage(doc);

  // Section 2 - just a placeholder reference
  y = section(doc, 2, 'Sicherheitskonzept & Pläne (Baulicher Brandschutz)', y);
  y = italic(doc, 'Grundlage für die Intervention der Feuerwehr und Fluchtwege.', y);
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text('[Pläne und Grundrisse werden separat beigelegt]', M, y);
  y += 14;

  // Section 3 - Lebenszyklus
  y = section(doc, 3, 'Lebenszyklus-Dokumentation (Audit Trail)', y);
  y = italic(doc, 'Nachweis der regelmässigen Instandhaltung gemäss Wartungsintervallen.', y);

  // 3.1 Wartungs-Logbuch (Assets)
  if (assets.length > 0) {
    y = subSection(doc, '3.1', 'Wartungs-Logbuch (Technischer Brandschutz)', y);

    const assetRows = assets.map(a => [
      a.typ,
      a.bezeichnung || a.typ,
      a.ort + (a.geschoss ? ` (${a.geschoss})` : ''),
      a.letztePruefung || '-',
      a.naechstePruefung || '-',
      a.status,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Typ', 'Bezeichnung', 'Ort', 'Letzte Prüfung', 'Nächste', 'Status']],
      body: assetRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2.5, textColor: TEXT },
      headStyles: { fillColor: [245, 245, 245], textColor: TEXT, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 18 },
        5: { cellWidth: 18 },
      },
      margin: { left: M, right: M },
      didParseCell: (data) => {
        if (data.column.index === 5 && data.section === 'body') {
          const s = data.cell.raw as string;
          if (s === 'OK') { data.cell.styles.textColor = GREEN; data.cell.styles.fontStyle = 'bold'; }
          else if (s === 'Mangelhaft') { data.cell.styles.textColor = [200, 30, 30]; data.cell.styles.fontStyle = 'bold'; }
        }
      },
    });
    y = lastY(doc) + 10;

    if (needsPage(doc, y, 20)) y = newPage(doc);
  }

  // 3.2 Mängel-Historie
  y = subSection(doc, assets.length > 0 ? '3.2' : '3.1', 'Mängel-Historie (Gelebte Qualitätssicherung)', y);

  if (erledigtMaengel.length > 0) {
    const historyRows = erledigtMaengel.map(m => [
      m.ort + (m.geschoss ? ` (${m.geschoss})` : ''),
      m.titel,
      new Date(m.updatedAt).toLocaleDateString('de-CH'),
      'Erledigt \u2713',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Bereich', 'Behobener Mangel', 'Behoben am', 'Status']],
      body: historyRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, textColor: TEXT },
      headStyles: { fillColor: [245, 245, 245], textColor: TEXT, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 22 },
      },
      margin: { left: M, right: M },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          data.cell.styles.textColor = GREEN;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = lastY(doc) + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...LIGHT_GRAY);
    doc.text('Keine behobenen Mängel dokumentiert.', M, y);
    y += 10;
  }

  // ============================================================
  // Section 4: Prüfbericht & Fotodokumentation
  // ============================================================
  if (needsPage(doc, y, 50)) y = newPage(doc);

  y = section(doc, 4, 'Prüfbericht & Fotodokumentation', y);
  y = italic(doc, 'Detaillierte Auflistung der Feststellungen.', y);

  if (maengel.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...LIGHT_GRAY);
    doc.text('Keine Feststellungen bei der Begehung dokumentiert.', M, y);
    y += 10;
  }

  for (let idx = 0; idx < maengel.length; idx++) {
    const mangel = maengel[idx];

    if (needsPage(doc, y, 65)) y = newPage(doc);

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(M, y, pw - M, y);
    y += 6;

    const statusColor = mangel.status === 'Offen' ? [200, 30, 30] as [number, number, number] : GREEN;
    const statusLabel = mangel.status === 'Offen' ? 'Offen' : 'OK';

    // ID line: "ID: #M-001 | Standort: ..."   "Status: OK"
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT);
    doc.text(`ID: #M-${String(idx + 1).padStart(3, '0')}`, M, y);

    doc.setFont('helvetica', 'normal');
    doc.text(`| Standort: ${mangel.ort}${mangel.geschoss ? ', ' + mangel.geschoss : ''}`, M + 25, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...statusColor);
    doc.text(`Status: ${statusLabel}`, pw - M, y, { align: 'right' });
    y += 8;

    // Layout: text left, photo right
    const hasPhoto = mangel.fotos.length > 0 && mangel.fotos[0];
    const textW = hasPhoto ? cw - 58 : cw;
    const photoStartY = y;

    // Feststellung
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT);
    doc.text('Feststellung:', M, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const festText = mangel.titel + (mangel.beschreibung ? '. ' + mangel.beschreibung : '');
    const festLines = doc.splitTextToSize(festText, textW);
    doc.text(festLines, M, y);
    y += festLines.length * 3.5 + 4;

    // Priority + Date
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT);
    doc.text('Priorität: ', M, y);
    const prioX = M + doc.getTextWidth('Priorität: ');
    const prioColor = mangel.prioritaet === 'Kritisch' ? [200, 30, 30] as [number, number, number]
      : mangel.prioritaet === 'Hoch' ? [220, 120, 20] as [number, number, number]
      : TEXT;
    doc.setTextColor(...prioColor);
    doc.text(mangel.prioritaet, prioX, y);
    doc.setTextColor(...LIGHT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(` | Erfasst: ${new Date(mangel.createdAt).toLocaleDateString('de-CH')}`, prioX + doc.getTextWidth(mangel.prioritaet), y);

    // Photo on the right
    let photoEndY = y;
    if (hasPhoto) {
      const photoX = pw - M - 52;
      const photoW = 52;
      const photoH = 40;
      try {
        doc.addImage(mangel.fotos[0], 'JPEG', photoX, photoStartY, photoW, photoH);
        photoEndY = photoStartY + photoH + 2;
      } catch {
        // Skip
      }
    }

    y = Math.max(y + 6, photoEndY + 4);
  }

  // ============================================================
  // Section 5: Mängelliste (Übersicht)
  // ============================================================
  y = newPage(doc);

  y = section(doc, 5, 'Mängelliste (Übersicht)', y);
  y = italic(doc, 'Zusammenfassung aller offenen Punkte.', y);

  if (openMaengel.length === 0) {
    // Bordered box with "Keine offenen Mängel"
    doc.setDrawColor(...TEXT);
    doc.setLineWidth(0.3);
    doc.rect(M, y, cw, 8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text('Keine offenen Mängel festgestellt.', pw / 2, y + 5.5, { align: 'center' });
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text('Alle geprüften Bereiche entsprechen den gesetzlichen Vorgaben.', pw / 2, y, { align: 'center' });
    y += 12;
  } else {
    const tableData = openMaengel.map((m, i) => [
      String(i + 1),
      m.titel,
      m.ort + (m.geschoss ? ` (${m.geschoss})` : ''),
      m.prioritaet,
      m.status,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Mangel', 'Ort', 'Priorität', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, textColor: TEXT },
      headStyles: { fillColor: [245, 245, 245], textColor: TEXT, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35 },
        3: { cellWidth: 22 },
        4: { cellWidth: 20 },
      },
      margin: { left: M, right: M },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          const p = data.cell.raw as string;
          if (p === 'Kritisch') data.cell.styles.textColor = [200, 30, 30];
          else if (p === 'Hoch') data.cell.styles.textColor = [220, 120, 20];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 4 && data.section === 'body') {
          data.cell.styles.textColor = [200, 30, 30];
        }
      },
    });
    y = lastY(doc) + 12;
  }

  // ============================================================
  // Section 6: Periodische Übereinstimmungserklärung
  // ============================================================
  if (needsPage(doc, y, 65)) y = newPage(doc);

  y = section(doc, 6, 'Periodische Übereinstimmungserklärung', y);
  y += 2;

  // Declaration box
  doc.setDrawColor(...TEXT);
  doc.setLineWidth(0.3);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT);
  const declText = 'Hiermit wird bestätigt, dass der Zustand der geprüften brandschutztechnischen Einrichtungen und baulichen Massnahmen aufgenommen wurde.';
  const declLines = doc.splitTextToSize(declText, cw - 10);
  doc.rect(M, y, cw, declLines.length * 4 + 6);
  doc.text(declLines, M + 5, y + 5);
  y += declLines.length * 4 + 12;

  // Ergebnis
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text('Ergebnis: ', M, y);
  const erX = M + doc.getTextWidth('Ergebnis: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT);
  const erText = isConform
    ? 'Die Anlagen entsprechen den Vorschriften und dem bewilligten Brandschutzkonzept. Die periodische Sicherheitsüberprüfung wurde erfolgreich abgeschlossen.'
    : `Es bestehen ${openMaengel.length} offene Mängel. Die Konformität wird nach Behebung aller Mängel erneut geprüft.`;
  const erLines = doc.splitTextToSize(erText, cw - (erX - M));

  // If first line fits next to "Ergebnis:", rest below
  if (erLines.length > 0) {
    doc.text(erLines[0], erX, y);
    if (erLines.length > 1) {
      doc.text(erLines.slice(1), M, y + 4);
      y += 4 + (erLines.length - 1) * 4;
    }
  }
  y += 18;

  // Signature lines
  if (needsPage(doc, y, 25)) y = newPage(doc);

  doc.setDrawColor(...TEXT);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + 65, y);
  doc.line(pw / 2 + 10, y, pw - M, y);

  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text('Ort, Datum', M, y + 5);
  doc.text('Unterschrift QS-Verantwortlicher', pw / 2 + 10, y + 5);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text(`(${liegenschaft.ort || '...'}, ${datum})`, M, y + 10);
  doc.text('(Verwaltung / Eigentümerschaft)', pw / 2 + 10, y + 10);
  y += 20;

  // Legal footer
  doc.setFontSize(6);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(160, 160, 160);
  const legal = 'Digitales Original. Revisionssicher archiviert gemäss BSV 2026 / QSS-Lifecycle-Nachweis. Die in FireDox erfassten Daten entsprechen formal den Dokumentationsanforderungen der BSV 2026. Die inhaltliche Richtigkeit der Eingaben obliegt dem unterzeichnenden QS-Verantwortlichen.';
  const legalLines = doc.splitTextToSize(legal, cw);
  doc.text(legalLines, M, y);

  // ============================================================
  // Footers on all pages
  // ============================================================
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    pageFooter(doc, i, total);
  }

  return doc.output('blob');
}

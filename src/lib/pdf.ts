import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Liegenschaft, Mangel, Asset, Begehung } from './db';

// Colors from HTML template
const DARK: [number, number, number] = [26, 26, 26];       // #1a1a1a
const TEXT: [number, number, number] = [51, 51, 51];        // #333333
const GRAY: [number, number, number] = [74, 74, 74];        // #4a4a4a
const LIGHT_GRAY: [number, number, number] = [166, 166, 166];
const RED: [number, number, number] = [211, 47, 47];        // #d32f2f
const GREEN: [number, number, number] = [46, 125, 50];      // #2e7d32
const BORDER: [number, number, number] = [208, 208, 208];   // #d0d0d0
const ROW_BORDER: [number, number, number] = [232, 232, 232]; // #e8e8e8
const LABEL_BG: [number, number, number] = [250, 250, 250]; // #fafafa

const M = 25; // margin (50px scaled)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastY(doc: any): number {
  return doc.lastAutoTable?.finalY ?? 40;
}

function pageHeader(doc: jsPDF) {
  // "BRANDSCHUTZDOSSIER 2026" - bold, 13px
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('BRANDSCHUTZDOSSIER 2026', M, 14);
  // "Konformität nach BSV 2026" - italic
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  doc.text('Konformität nach BSV 2026', M, 19);
  // Red divider line (3px = ~1mm)
  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...RED);
  doc.setLineWidth(1);
  doc.line(M, 23, pw - M, 23);
}

function pageFooter(doc: jsPDF, page: number, total: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text(`Seite ${page} / ${total}`, pw - M, ph - 10, { align: 'right' });
}

function sectionTitle(doc: jsPDF, num: number, title: string, y: number): number {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(`${num}. ${title}`, M, y);
  return y + 10;
}

function subSectionTitle(doc: jsPDF, num: string, title: string, y: number): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(`${num} ${title}`, M, y);
  return y + 8;
}

function descriptionText(doc: jsPDF, text: string, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  const lines = doc.splitTextToSize(text, pw - M * 2);
  doc.text(lines, M, y);
  return y + lines.length * 4 + 4;
}

function needsPage(doc: jsPDF, y: number, h: number): boolean {
  return y + h > doc.internal.pageSize.getHeight() - 20;
}

function newPage(doc: jsPDF): number {
  doc.addPage();
  pageHeader(doc);
  return 32;
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
  // PAGE 1: Titelseite & Objekt-Klassifizierung
  // ============================================================
  pageHeader(doc);
  y = 42;

  // Main Title - centered
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('BRANDSCHUTZDOSSIER', pw / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Qualitätssicherung (QSS) nach Brandschutzvorschriften 2026', pw / 2, y, { align: 'center' });
  y += 20;

  // Section 1
  y = sectionTitle(doc, 1, 'Objekt-Klassifizierung & Verantwortung', y);

  // Info table - bordered, with gray label column
  const infoRows = [
    ['Objekt:', `${liegenschaft.name}, ${liegenschaft.strasse}, ${liegenschaft.plz} ${liegenschaft.ort}`],
    ['Eigentümerschaft:', liegenschaft.eigentuemer || '-'],
    ['Bewirtschaftung:', liegenschaft.verwalter || '-'],
    ['Gebäudeart:', liegenschaft.gebaeudeart || '-'],
    ['Geschosse / Einheiten:', `${liegenschaft.anzahlGeschosse || '-'} / ${liegenschaft.anzahlEinheiten || '-'}`],
    ['QS-Verantwortlicher:', liegenschaft.pruefer || '-'],
  ];

  autoTable(doc, {
    startY: y,
    body: infoRows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 }, textColor: TEXT, lineColor: ROW_BORDER, lineWidth: 0.3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 48, fillColor: LABEL_BG, textColor: DARK },
      1: { cellWidth: 'auto' },
    },
    margin: { left: M, right: M },
    tableLineColor: BORDER,
    tableLineWidth: 0.5,
    didDrawCell: (data) => {
      // Draw outer border
      if (data.section === 'body') {
        const { x, y: cy, width, height } = data.cell;
        doc.setDrawColor(...ROW_BORDER);
        doc.setLineWidth(0.2);
        doc.line(x, cy + height, x + width, cy + height);
        if (data.column.index === 0) {
          doc.setDrawColor(...ROW_BORDER);
          doc.line(x + width, cy, x + width, cy + height);
        }
      }
    },
  });
  y = lastY(doc) + 16;

  // Konformitäts-Status
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RED);
  doc.text(`Status der Konformität per ${datum}:`, pw / 2, y, { align: 'center' });
  y += 8;

  // Status box
  const boxW = isConform ? 52 : 72;
  const boxH = 14;
  const boxX = (pw - boxW) / 2;
  doc.setDrawColor(192, 192, 192);
  doc.setLineWidth(0.7);
  doc.rect(boxX, y, boxW, boxH);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(isConform ? GREEN : RED));
  doc.text(isConform ? 'KONFORM' : 'NICHT KONFORM', pw / 2, y + 10, { align: 'center' });
  y += boxH + 10;

  // Conformity note
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  const conformNote = isConform
    ? 'Konformitätsnachweis: Das Objekt erfüllt alle brandschutztechnischen Anforderungen gemäss BSV 2026. Die Betriebsbereitschaft ist vollumfänglich gewährleistet.'
    : `Hinweis: Es bestehen offene Mängel (${openMaengel.length} offen, davon ${criticalCount} kritisch). Die Konformität ist erst nach Behebung aller kritischen Mängel gegeben.`;
  const noteLines = doc.splitTextToSize(conformNote, cw - 20);
  doc.text(noteLines, pw / 2, y, { align: 'center', maxWidth: cw - 20 });

  // ============================================================
  // PAGE 2: Wartung & Lebenszyklus
  // ============================================================
  y = newPage(doc);

  // Section 2
  y = sectionTitle(doc, 2, 'Sicherheitskonzept & Pläne (Baulicher Brandschutz)', y);
  y = descriptionText(doc, 'Grundlage für die Intervention der Feuerwehr und Fluchtwege.', y);
  doc.setFontSize(9);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text('[Pläne und Grundrisse werden separat beigelegt]', M, y);
  y += 14;

  // Section 3
  y = sectionTitle(doc, 3, 'Lebenszyklus-Dokumentation (Audit Trail)', y);
  y = descriptionText(doc, 'Nachweis der regelmässigen Instandhaltung gemäss Wartungsintervallen.', y);

  // 3.1 Wartungs-Logbuch (Assets)
  if (assets.length > 0) {
    y = subSectionTitle(doc, '3.1', 'Wartungs-Logbuch (Technischer Brandschutz)', y);

    const assetRows = assets.map(a => [
      a.typ,
      a.letztePruefung || '-',
      a.bezeichnung || '-',
      a.naechstePruefung || '-',
      a.status === 'OK' ? 'GÜLTIG' : a.status,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Anlage', 'Letzte Prüfung', 'Geprüft durch', 'Nächste Fälligkeit', 'Status']],
      body: assetRows,
      theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: TEXT },
      headStyles: { fontStyle: 'bold', textColor: DARK, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
      margin: { left: M, right: M },
      didDrawCell: (data) => {
        if (data.section === 'head') {
          // Bold bottom border for header
          doc.setDrawColor(...DARK);
          doc.setLineWidth(0.6);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        } else {
          // Light border for body rows
          doc.setDrawColor(224, 224, 224);
          doc.setLineWidth(0.2);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.section === 'body') {
          const s = data.cell.raw as string;
          if (s === 'GÜLTIG') { data.cell.styles.textColor = RED; data.cell.styles.fontStyle = 'bold'; }
          else if (s === 'Mangelhaft') { data.cell.styles.textColor = RED; data.cell.styles.fontStyle = 'bold'; }
        }
      },
    });
    y = lastY(doc) + 10;
  }

  // 3.2 Mängel-Historie
  if (needsPage(doc, y, 30)) y = newPage(doc);
  y = subSectionTitle(doc, assets.length > 0 ? '3.2' : '3.1', 'Mängel-Historie (Gelebte Qualitätssicherung)', y);

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
      theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: TEXT },
      headStyles: { fontStyle: 'bold', textColor: DARK },
      margin: { left: M, right: M },
      didDrawCell: (data) => {
        if (data.section === 'head') {
          doc.setDrawColor(...DARK);
          doc.setLineWidth(0.6);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        } else {
          doc.setDrawColor(224, 224, 224);
          doc.setLineWidth(0.2);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          data.cell.styles.textColor = GREEN;
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
  // Section 4: Prüfbericht & Fotodokumentation (Cards)
  // ============================================================
  if (needsPage(doc, y, 40)) y = newPage(doc);

  y = sectionTitle(doc, 4, 'Prüfbericht & Fotodokumentation', y);
  y = descriptionText(doc, 'Detaillierte Auflistung der Feststellungen.', y);

  if (maengel.length === 0 && assets.filter(a => a.status === 'OK').length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...LIGHT_GRAY);
    doc.text('Keine Feststellungen dokumentiert.', M, y);
    y += 10;
  }

  // Render each entry as a card (like HTML pruef-card)
  const allEntries = [
    ...assets.map((a, i) => ({ type: 'asset' as const, id: `#A-${String(i + 1).padStart(3, '0')}`, standort: `${a.ort}${a.geschoss ? ', ' + a.geschoss : ''}`, status: a.status === 'OK' ? 'OK' : a.status, feststellung: `${a.typ}: ${a.bezeichnung || a.typ}. Status: ${a.status}.${a.letztePruefung ? ' Letzte Prüfung: ' + a.letztePruefung + '.' : ''}${a.naechstePruefung ? ' Nächste: ' + a.naechstePruefung + '.' : ''}`, bemerkung: a.notizen, foto: a.fotos[0] })),
    ...maengel.filter(m => !assets.some(a => a.id === m.assetId)).map((m, i) => ({ type: 'mangel' as const, id: `#M-${String(i + 1).padStart(3, '0')}`, standort: `${m.ort}${m.geschoss ? ', ' + m.geschoss : ''}`, status: m.status === 'Offen' ? 'Offen' : 'OK', feststellung: m.titel + (m.beschreibung ? '. ' + m.beschreibung : ''), bemerkung: '', foto: m.fotos[0] })),
  ];

  for (const entry of allEntries) {
    if (needsPage(doc, y, 55)) y = newPage(doc);

    // Card border
    const cardH = entry.foto ? 50 : 35;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(M, y, cw, cardH);

    // Card header (gray bg)
    doc.setFillColor(...LABEL_BG);
    doc.rect(M, y, cw, 9, 'F');
    doc.setDrawColor(224, 224, 224);
    doc.line(M, y + 9, M + cw, y + 9);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`ID: ${entry.id} | Standort: ${entry.standort}`, M + 5, y + 6);

    const statusColor = entry.status === 'OK' ? GREEN : entry.status === 'Offen' ? RED : GRAY;
    doc.setTextColor(...statusColor);
    doc.text(`Status: ${entry.status}`, pw - M - 5, y + 6, { align: 'right' });

    // Card body
    const bodyY = y + 13;
    const textW = entry.foto ? cw - 60 : cw - 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Feststellung:', M + 5, bodyY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT);
    const festLines = doc.splitTextToSize(entry.feststellung, textW);
    doc.text(festLines, M + 5, bodyY + 4);

    if (entry.bemerkung) {
      const bemY = bodyY + 4 + festLines.length * 3.5 + 2;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text('Bemerkung:', M + 5, bemY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT);
      doc.text(doc.splitTextToSize(entry.bemerkung, textW), M + 5, bemY + 4);
    }

    // Photo placeholder on right
    if (entry.foto) {
      try {
        doc.addImage(entry.foto, 'JPEG', pw - M - 52, bodyY - 2, 48, 35);
      } catch {
        doc.setFillColor(240, 240, 240);
        doc.rect(pw - M - 52, bodyY - 2, 48, 35, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...LIGHT_GRAY);
        doc.text('[Foto]', pw - M - 28, bodyY + 16, { align: 'center' });
      }
    }

    y += cardH + 6;
  }

  // ============================================================
  // Section 5: Mängelliste (Übersicht)
  // ============================================================
  y = newPage(doc);

  y = sectionTitle(doc, 5, 'Mängelliste (Übersicht)', y);
  y = descriptionText(doc, 'Zusammenfassung aller offenen Punkte.', y);

  // Mängel-Box (bordered)
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);

  if (openMaengel.length === 0) {
    // Header
    doc.rect(M, y, cw, 10);
    doc.setDrawColor(224, 224, 224);
    doc.line(M, y + 10, M + cw, y + 10);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text('Keine offenen Mängel festgestellt.', pw / 2, y + 7, { align: 'center' });

    // Body
    doc.setDrawColor(...BORDER);
    doc.rect(M, y + 10, cw, 8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT);
    doc.text('Alle geprüften Bereiche entsprechen den gesetzlichen Vorgaben.', pw / 2, y + 15, { align: 'center' });
    y += 28;
  } else {
    // Header
    doc.rect(M, y, cw, 10);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...RED);
    doc.text('Offene Mängel vorhanden', pw / 2, y + 7, { align: 'center' });
    y += 14;

    const tableData = openMaengel.map((m, i) => [
      String(i + 1),
      m.titel,
      m.ort,
      m.prioritaet,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Beschreibung', 'Ort', 'Priorität']],
      body: tableData,
      theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: TEXT },
      headStyles: { fontStyle: 'bold', textColor: DARK },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 3: { cellWidth: 22 } },
      margin: { left: M, right: M },
      didDrawCell: (data) => {
        if (data.section === 'head') {
          doc.setDrawColor(...DARK);
          doc.setLineWidth(0.6);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        } else {
          doc.setDrawColor(224, 224, 224);
          doc.setLineWidth(0.2);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          const p = data.cell.raw as string;
          if (p === 'Kritisch' || p === 'Hoch') data.cell.styles.textColor = RED;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = lastY(doc) + 12;
  }

  // ============================================================
  // Section 6: Periodische Übereinstimmungserklärung
  // ============================================================
  if (needsPage(doc, y, 70)) y = newPage(doc);

  y = sectionTitle(doc, 6, 'Periodische Übereinstimmungserklärung', y);
  y += 2;

  // Erklärungs-Box (bordered)
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);

  const boxStartY = y;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT);

  const declText = 'Hiermit wird bestätigt, dass der Zustand der geprüften brandschutztechnischen Einrichtungen und baulichen Massnahmen aufgenommen wurde.';
  const declLines = doc.splitTextToSize(declText, cw - 16);
  doc.text(declLines, M + 8, y + 8);
  y += declLines.length * 4 + 14;

  // Ergebnis
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Ergebnis', M + 8, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT);
  const erText = isConform
    ? ': Die Anlagen entsprechen den Vorschriften und dem bewilligten Brandschutzkonzept. Die periodische Sicherheitsüberprüfung wurde erfolgreich abgeschlossen.'
    : `: Es bestehen ${openMaengel.length} offene Mängel. Die Konformität wird nach Behebung aller Mängel erneut geprüft.`;
  const erLines = doc.splitTextToSize(erText, cw - 16 - doc.getTextWidth('Ergebnis'));
  doc.text(erLines[0], M + 8 + doc.getTextWidth('Ergebnis'), y);
  if (erLines.length > 1) {
    doc.text(erLines.slice(1), M + 8, y + 4);
    y += (erLines.length - 1) * 4;
  }
  y += 16;

  // Signatures
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.3);
  const sigLeftX = M + 8;
  const sigRightX = pw / 2 + 15;

  doc.line(sigLeftX, y, sigLeftX + 60, y);
  doc.line(sigRightX, y, pw - M - 8, y);

  doc.setFontSize(9);
  doc.setTextColor(85, 85, 85);
  doc.text('Ort, Datum', sigLeftX, y + 5);
  doc.text('Unterschrift QS-Verantwortlicher', sigRightX, y + 5);

  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  doc.text(`(${liegenschaft.ort || '...'}, ${datum})`, sigLeftX, y + 10);
  doc.text('(Verwaltung / Eigentümerschaft)', sigRightX, y + 10);

  y += 16;

  // Draw border around entire box
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.rect(M, boxStartY - 4, cw, y - boxStartY + 8);

  y += 10;

  // Footer notes
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(119, 119, 119);
  doc.text('Digitales Original. Revisionssicher archiviert gemäss BSV 2026 / QSS-Lifecycle-Nachweis.', M, y);
  y += 4;
  doc.setFont('helvetica', 'italic');
  const legalText = 'Die in FireDox erfassten Daten entsprechen formal den Dokumentationsanforderungen der BSV 2026. Die inhaltliche Richtigkeit der Eingaben obliegt dem unterzeichnenden QS-Verantwortlichen.';
  const legalLines = doc.splitTextToSize(legalText, cw);
  doc.text(legalLines, M, y);

  // ============================================================
  // Add footers to all pages
  // ============================================================
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    pageFooter(doc, i, total);
  }

  return doc.output('blob');
}

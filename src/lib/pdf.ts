import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Liegenschaft, Mangel } from './db';

const PRIO_COLORS: Record<string, [number, number, number]> = {
  Kritisch: [220, 38, 38],
  Hoch: [234, 88, 12],
  Mittel: [202, 138, 4],
  Gering: [22, 163, 74],
};

export async function generatePDF(
  liegenschaft: Liegenschaft,
  maengel: Mangel[]
): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BRANDSCHUTZBERICHT', 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Begehungsprotokoll | FireDox Erfassung', 14, 26);
  doc.text(`Datum: ${liegenschaft.begehungsDatum || new Date().toLocaleDateString('de-CH')}`, 14, 32);

  y = 45;

  // Liegenschaft Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Liegenschaft', 14, y);
  y += 8;

  const infoRows = [
    ['Name', liegenschaft.name],
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
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35, textColor: [100, 100, 100] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // Statistics
  const openCount = maengel.filter(m => m.status === 'Offen').length;
  const criticalCount = maengel.filter(m => m.prioritaet === 'Kritisch' && m.status === 'Offen').length;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Zusammenfassung', 14, y);
  y += 8;

  const statsData = [
    ['Erfasste Mängel', String(maengel.length)],
    ['Offene Mängel', String(openCount)],
    ['Kritische Mängel', String(criticalCount)],
    ['Erledigte Mängel', String(maengel.length - openCount)],
  ];

  autoTable(doc, {
    startY: y,
    body: statsData,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { halign: 'center', cellWidth: 30 },
    },
    margin: { left: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // Mängel Detail
  if (maengel.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Mängelliste', 14, y);
    y += 8;

    const tableData = maengel.map((m, i) => [
      String(i + 1),
      m.titel,
      m.ort + (m.geschoss ? ` (${m.geschoss})` : ''),
      m.prioritaet,
      m.status,
      m.fotos.length > 0 ? `${m.fotos.length} Foto(s)` : '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Mangel', 'Ort', 'Priorität', 'Status', 'Fotos']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 50 },
        2: { cellWidth: 40 },
        3: { cellWidth: 25 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
      },
      margin: { left: 14 },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          const prio = data.cell.raw as string;
          const color = PRIO_COLORS[prio];
          if (color) {
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Mängel Detail Pages with Photos
  for (const mangel of maengel) {
    if (mangel.fotos.length === 0 && !mangel.beschreibung) continue;

    doc.addPage();
    y = 20;

    // Mangel header
    const prioColor = PRIO_COLORS[mangel.prioritaet] || [0, 0, 0];
    doc.setFillColor(...prioColor);
    doc.rect(14, y - 5, pageWidth - 28, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${mangel.prioritaet.toUpperCase()} | ${mangel.titel}`, 18, y + 2);
    y += 15;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ort: ${mangel.ort}${mangel.geschoss ? ` | Geschoss: ${mangel.geschoss}` : ''}`, 14, y);
    y += 5;
    doc.text(`Status: ${mangel.status} | Erfasst: ${new Date(mangel.createdAt).toLocaleDateString('de-CH')}`, 14, y);
    y += 8;

    if (mangel.beschreibung) {
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(mangel.beschreibung, pageWidth - 28);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 5;
    }

    // Photos
    for (let i = 0; i < mangel.fotos.length; i++) {
      const foto = mangel.fotos[i];
      if (!foto) continue;

      try {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Foto ${i + 1}`, 14, y);
        y += 3;

        doc.addImage(foto, 'JPEG', 14, y, 80, 60);
        y += 65;
      } catch {
        doc.setFontSize(8);
        doc.text(`[Foto ${i + 1} konnte nicht geladen werden]`, 14, y);
        y += 6;
      }
    }
  }

  // Signature page
  doc.addPage();
  y = 20;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Bestätigung', 14, y);
  y += 15;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Hiermit bestätige ich die Korrektheit der im vorliegenden Bericht', 14, y);
  y += 5;
  doc.text('aufgeführten Feststellungen.', 14, y);
  y += 25;

  // Signature lines
  doc.line(14, y, 90, y);
  doc.text('Unterschrift Prüfer', 14, y + 5);

  doc.line(110, y, 196, y);
  doc.text('Datum', 110, y + 5);

  y += 25;
  doc.line(14, y, 90, y);
  doc.text('Unterschrift Eigentümer / Verwalter', 14, y + 5);

  doc.line(110, y, 196, y);
  doc.text('Datum', 110, y + 5);

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `FireDox Erfassung | ${liegenschaft.name} | Seite ${i}/${totalPages}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  return doc.output('blob');
}

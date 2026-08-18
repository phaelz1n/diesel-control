import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================
// EXCEL EXPORT
// ============================================================
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto column width
  const cols = Object.keys(data[0] ?? {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? '').length)
    ) + 2,
  }));
  ws['!cols'] = cols;

  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ============================================================
// CSV EXPORT
// ============================================================
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
}

// ============================================================
// PDF EXPORT
// ============================================================
export interface PDFExportOptions {
  orientation?: 'portrait' | 'landscape';
  subtitle?: string;
  summaryInfo?: { label: string; value: string }[];
  foot?: (string | number)[][];
}

export function exportToPDF(
  title: string,
  columns: string[],
  rows: (string | number)[][],
  filename: string,
  options?: PDFExportOptions
): void {
  const orientation = options?.orientation ?? 'landscape';
  const doc = new jsPDF({ orientation });

  // Header
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235); // Blue 600
  doc.text('DieselControl', 14, 15);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(title, 14, 23);

  let startY = 30;

  if (options?.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(options.subtitle, 14, 28);
    startY = 35;
  }

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate 400
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 14, 15, { align: 'right' });

  // Optional summary KPIs block
  if (options?.summaryInfo && options.summaryInfo.length > 0) {
    doc.setFontSize(8);
    const summaryText = options.summaryInfo.map((s) => `${s.label}: ${s.value}`).join('   |   ');
    doc.setTextColor(71, 85, 105);
    doc.text(summaryText, 14, startY);
    startY += 6;
  }

  autoTable(doc, {
    startY,
    head: [columns],
    body: rows,
    foot: options?.foot,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [37, 99, 235], // Blue 600
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14, bottom: 18 },
    didDrawPage: (data) => {
      const str = `Página ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height || pageSize.getHeight();
      doc.text(str, data.settings.margin.left, pageHeight - 8);
      doc.text('DieselControl - Sistema de Gestão de Frotas e Combustível', pageSize.width - 14, pageHeight - 8, { align: 'right' });
    },
  });

  doc.save(`${filename}.pdf`);
}

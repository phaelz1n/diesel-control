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
export function exportToPDF(
  title: string,
  columns: string[],
  rows: (string | number)[][],
  filename: string
): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.text('DieselControl', 14, 16);

  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, 26);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 33);

  autoTable(doc, {
    startY: 38,
    head: [columns],
    body: rows,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

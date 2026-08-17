import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================
// TAILWIND MERGE
// ============================================================
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// FORMATAÇÃO DE MOEDA
// ============================================================
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatLiters(value: number): string {
  return `${formatNumber(value, 2)} L`;
}

export function formatKmL(value: number): string {
  return `${formatNumber(value, 2)} km/L`;
}

export function formatOdometer(value: number): string {
  return `${formatNumber(value, 0)} km`;
}

// ============================================================
// FORMATAÇÃO DE DATA
// ============================================================
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

export function formatMonthYear(yearMonth: string): string {
  // yearMonth = "YYYY-MM"
  const [year, month] = yearMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return format(date, 'MMMM/yyyy', { locale: ptBR });
}

export function formatMonthShort(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return format(date, 'MMM', { locale: ptBR });
}

export function toYearMonth(date: Date): string {
  return format(date, 'yyyy-MM');
}

export function getMonthsInYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, '0')}`
  );
}

// ============================================================
// VARIAÇÃO PERCENTUAL
// ============================================================
export function calcVariation(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function formatVariation(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatNumber(value, 1)}%`;
}

// ============================================================
// NORMALIZAÇÃO DE TEXTO
// ============================================================
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ============================================================
// CÁLCULOS DE ABASTECIMENTO
// ============================================================
export function calcTotalValue(liters: number, unitPrice: number): number {
  return Math.round(liters * unitPrice * 100) / 100;
}

export function calcKmTraveled(
  currentOdometer: number,
  previousOdometer: number
): number {
  return currentOdometer - previousOdometer;
}

export function calcAvgKmL(kmTraveled: number, liters: number): number {
  if (liters === 0) return 0;
  return Math.round((kmTraveled / liters) * 100) / 100;
}

// ============================================================
// EXPORTAÇÃO
// ============================================================
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// PAGINAÇÃO
// ============================================================
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(totalItems: number, pageSize: number): number {
  return Math.ceil(totalItems / pageSize);
}

// ============================================================
// MISC
// ============================================================
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * Parses a date string safely in LOCAL time (avoiding UTC timezone shift).
 * "2026-04-13" with new Date() gives UTC midnight → shows as 12/04 in Brazil (UTC-3).
 * This function parses date-only strings as local midnight instead.
 */
export function parseDateSafe(date: string | Date): Date {
  if (date instanceof Date) return date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(date);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(parseDateSafe(date));
}

export function formatDateBR(date: string | null | undefined): string {
  if (!date) return '-';
  return parseDateSafe(date).toLocaleDateString('pt-BR');
}

export function formatDateForInput(date: string | Date): string {
  const d = parseDateSafe(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calculateLicenseStatus(validade: string): 'ativa' | 'a_vencer' | 'vencida' {
  const now = new Date();
  const validadeDate = parseDateSafe(validade);
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(now.getDate() + 90);

  if (validadeDate < now) {
    return 'vencida';
  } else if (validadeDate <= ninetyDaysFromNow) {
    return 'a_vencer';
  } else {
    return 'ativa';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'ativa':
    case 'ativo':
      return 'Ativa';
    case 'a_vencer':
      return 'A Vencer';
    case 'vencida':
    case 'vencido':
      return 'Vencida';
    case 'finalizada':
      return 'Finalizada';
    default:
      return 'Desconhecido';
  }
}

export function getStatusClass(status: string): string {
  switch (status) {
    case 'ativa':
    case 'ativo':
      return 'status-active';
    case 'a_vencer':
      return 'status-expiring';
    case 'vencida':
    case 'vencido':
      return 'status-expired';
    case 'finalizada':
      return 'status-finalizada';
    default:
      return '';
  }
}

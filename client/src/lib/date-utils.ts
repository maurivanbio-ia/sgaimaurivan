export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

export function formatDateForInput(date: string | Date): string {
  return new Date(date).toISOString().split('T')[0];
}

export function calculateLicenseStatus(validade: string): 'ativa' | 'a_vencer' | 'vencida' {
  const now = new Date();
  const validadeDate = new Date(validade);
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
    default:
      return '';
  }
}

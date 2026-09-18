// Semanas domingo–sábado (Seção 9 da especificação).
// Cálculo em UTC nesta etapa (dados de demonstração); ao integrar a API
// real do Meta (Etapa 6), revisar para usar o fuso da conta.

export function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getWeekStart(date: Date): Date {
  const d = toDateOnly(date);
  const weekday = d.getUTCDay(); // 0 = domingo
  d.setUTCDate(d.getUTCDate() - weekday);
  return d;
}

export function getWeekEnd(weekStart: Date): Date {
  const d = toDateOnly(weekStart);
  d.setUTCDate(d.getUTCDate() + 6);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = toDateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function formatDateOnly(date: Date): string {
  return toDateOnly(date).toISOString().slice(0, 10);
}

export function isSameOrBefore(a: Date, b: Date): boolean {
  return toDateOnly(a).getTime() <= toDateOnly(b).getTime();
}

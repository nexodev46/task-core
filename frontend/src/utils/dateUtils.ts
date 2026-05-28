export function parseDateInput(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = String(value).trim();
  if (!normalized) return null;

  const dateOnlyMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(normalized);
  return isNaN(parsed.getTime()) ? null : parsed;
}

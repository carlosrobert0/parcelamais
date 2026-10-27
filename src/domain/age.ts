const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toDateParts = (isoDate: string) => isoDate.split("-").map(Number);

export function isValidIsoDate(isoDate: string): boolean {
  if (!ISO_DATE.test(isoDate)) return false;
  const [year, month, day] = toDateParts(isoDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function calculateAge(birthDate: string, referenceDate: string): number {
  const [birthYear, birthMonth, birthDay] = toDateParts(birthDate);
  const [year, month, day] = toDateParts(referenceDate);
  const hadBirthday = month > birthMonth || (month === birthMonth && day >= birthDay);
  return year - birthYear - (hadBirthday ? 0 : 1);
}

export function todayInSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function ageToday(birthDate: string): number {
  return calculateAge(birthDate, todayInSaoPaulo());
}

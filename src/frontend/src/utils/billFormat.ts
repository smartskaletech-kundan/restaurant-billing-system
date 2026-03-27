/**
 * Returns the current Indian financial year string.
 * FY starts April 1. E.g. Apr 2025 – Mar 2026 → "2025-26"
 */
export function getCurrentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const startYear = month >= 3 ? year : year - 1;
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYear}`;
}

/**
 * Returns FY string for a given date.
 */
export function getFYForDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYear}`;
}

/**
 * Formats a bill number as INV/2025-26/001
 */
export function formatBillNumber(
  billNumber: number | string,
  date?: Date,
): string {
  const fy = date ? getFYForDate(date) : getCurrentFY();
  const num =
    typeof billNumber === "string"
      ? Number.parseInt(billNumber, 10)
      : billNumber;
  const padded = num.toString().padStart(3, "0");
  return `INV/${fy}/${padded}`;
}

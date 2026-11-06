const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Null when the API doesn't report it yet. A wallet that has never been
 * updated reports null, and undefined only comes from an older API.
 */
export function formatLastUpdated(lastAdjustedAt: string | null | undefined): string | null {
  if (lastAdjustedAt === undefined) return null;
  if (lastAdjustedAt === null) return 'Never updated';

  const now = new Date();
  const updated = new Date(lastAdjustedAt);
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(updated)) / DAY_MS);

  if (days <= 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  return `Updated ${days} days ago`;
}

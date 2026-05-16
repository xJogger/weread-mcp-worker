export function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function optionalInteger(value: unknown, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return clampInteger(value, min, min, max);
}

export function secondsToDuration(seconds: unknown): string | undefined {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return undefined;
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}分钟`;
  if (minutes <= 0) return `${hours}小时`;
  return `${hours}小时${minutes}分钟`;
}

export function unixSecondsToDate(seconds: unknown): string | undefined {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

export function wereadReadingUrl(bookId: string): string {
  return `weread://reading?bId=${encodeURIComponent(bookId)}`;
}

export function wereadBookWebUrl(bookId: string): string {
  return `https://weread.qq.com/web/reader/${encodeURIComponent(bookId)}`;
}

export function parseRange(range: unknown): { rangeStart: string; rangeEnd: string } | undefined {
  if (typeof range !== "string") return undefined;
  const [rangeStart, rangeEnd] = range.split("-");
  if (!rangeStart || !rangeEnd) return undefined;
  return { rangeStart, rangeEnd };
}

export function wereadBookmarkUrl(bookId: string, chapterUid: string | number, range: string, userVid?: string | number): string | undefined {
  const parsed = parseRange(range);
  if (!parsed) return undefined;
  const params = new URLSearchParams({
    bookId,
    chapterUid: String(chapterUid),
    rangeStart: parsed.rangeStart,
    rangeEnd: parsed.rangeEnd
  });
  if (userVid !== undefined && userVid !== null && String(userVid)) {
    params.set("userVid", String(userVid));
  }
  return `weread://bestbookmark?${params.toString()}`;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

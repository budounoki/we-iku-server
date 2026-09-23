type SleepTrendLog = {
  id: number;
  type: string;
  sleepSessionId?: number | null;
  settlingMethod?: string | null;
  settlingMinutes?: number | null;
  sleepLocation?: string | null;
};

/**
 * Start and wake logs describe one sleep, not two samples.
 * Higher log IDs represent later writes (createdAt can be backdated).
 * Legacy wake logs may omit details: retain the start values in that case,
 * while explicit empty strings / zero on a later log still take precedence.
 */
export function sleepTrendRecords<T extends SleepTrendLog>(logs: T[]): T[] {
  const sessions = new Map<number, T>();
  const unlinked: T[] = [];
  const sleepLogs = logs.filter(log => log.type === "sleep").sort((a, b) => a.id - b.id);
  for (const log of sleepLogs) {
    if (log.sleepSessionId == null) {
      unlinked.push(log);
      continue;
    }
    const previous = sessions.get(log.sleepSessionId);
    sessions.set(log.sleepSessionId, previous ? {
      ...log,
      settlingMethod: log.settlingMethod ?? previous.settlingMethod,
      settlingMinutes: log.settlingMinutes ?? previous.settlingMinutes,
      sleepLocation: log.sleepLocation ?? previous.sleepLocation,
    } : log);
  }
  return [...unlinked, ...Array.from(sessions.values())];
}
import type { IBotHeartbeat } from "../../shared/types";

export interface HeartbeatInput {
  id: string;
  username: string;
  avatar: string | null;
  startedAt: Date;
  now: Date;
  guildCount: number;
  memberCount: number;
  wsPing: number;
  wsStatus: number;
  queues: IBotHeartbeat["queues"];
  memory: { rss: number; heapUsed: number; heapTotal: number };
  cpuPercent: number;
  node: string;
  platform: string;
  pid: number;
  versions: IBotHeartbeat["versions"];
  services: IBotHeartbeat["services"];
  lastError?: IBotHeartbeat["lastError"];
}

/** Pure: turns sampled process/client values into the Redis heartbeat document. */
export function buildHeartbeat(i: HeartbeatInput): IBotHeartbeat {
  const uptimeSec = Math.max(0, Math.floor((i.now.getTime() - i.startedAt.getTime()) / 1000));
  const hb: IBotHeartbeat = {
    online: true,
    id: i.id,
    username: i.username,
    avatar: i.avatar,
    startedAt: i.startedAt.toISOString(),
    ts: i.now.toISOString(),
    uptimeSec,
    guildCount: i.guildCount,
    memberCount: i.memberCount,
    ws: { ping: i.wsPing, status: i.wsStatus },
    queues: { ...i.queues },
    process: {
      rss: i.memory.rss,
      heapUsed: i.memory.heapUsed,
      heapTotal: i.memory.heapTotal,
      cpuPercent: i.cpuPercent,
      node: i.node,
      platform: i.platform,
      pid: i.pid
    },
    versions: { ...i.versions },
    services: { ...i.services }
  };
  if (i.lastError) hb.lastError = { ...i.lastError };
  return hb;
}

/** CPU usage as percent of one core between two `process.cpuUsage()` samples (microseconds). */
export function cpuPercent(prev: NodeJS.CpuUsage, curr: NodeJS.CpuUsage, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const usedMicros = curr.user - prev.user + (curr.system - prev.system);
  const pct = (usedMicros / 1000 / elapsedMs) * 100;
  return Math.round(Math.max(0, pct) * 10) / 10;
}

import { fleetInstances, idlePlaybackState, normalizePlayback } from "@/lib/fleet";
import { getGuildAccess } from "@/lib/guild-access";
import { createRedisSubscriber } from "@/lib/redis";
import { NextResponse } from "next/server";
import { FleetEvent, fleetKeys, parseInstance } from "../../../../../../../shared/fleet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

const PING_MS = 15_000;

/**
 * GET /api/guilds/[guildId]/stream — server-sent events for a server:
 *   event: playback  data: PlaybackState (one per instance, on every change and every ~5 s while connected)
 *   event: fleet     data: { instance, online, inGuild }
 *   event: settings  data: { keys }
 * Starts with a snapshot (playback + fleet per instance), then relays the
 * bot's messages on Redis `bypass:events:<guildId>`; a comment ping every 15 s.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;

  const subscriber = createRedisSubscriber();
  if (!subscriber) return NextResponse.json({ error: "Live updates are not available" }, { status: 503 });

  const channel = fleetKeys.events(guildId);
  const encoder = new TextEncoder();
  let closed = false;
  let ping: ReturnType<typeof setInterval> | undefined;
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const emit = (event: string, data: unknown) => send(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      cleanup = () => {
        if (closed) return;
        closed = true;
        if (ping) clearInterval(ping);
        subscriber.removeAllListeners("message");
        subscriber.quit().catch(() => subscriber.disconnect());
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", cleanup);

      const relay = (message: string) => {
        let event: FleetEvent;
        try {
          event = JSON.parse(message);
        } catch {
          return;
        }
        if (event.type === "playback") {
          const instance = parseInstance(event.instance);
          if (instance && event.state) emit("playback", normalizePlayback(event.state as unknown as Record<string, unknown>, guildId, instance));
        } else if (event.type === "fleet") {
          emit("fleet", { instance: event.instance, online: Boolean(event.online), inGuild: Boolean(event.inGuild) });
        } else if (event.type === "settings") {
          emit("settings", { keys: Array.isArray(event.keys) ? event.keys : [] });
        }
      };

      // Subscribe before the snapshot so nothing is missed; hold live
      // messages until the snapshot is out so they arrive after it.
      let ready = false;
      const held: string[] = [];
      subscriber.on("message", (from: string, message: string) => {
        if (from !== channel || closed) return;
        if (ready) relay(message);
        else held.push(message);
      });

      send("retry: 5000\n\n");
      try {
        await subscriber.connect();
        await subscriber.subscribe(channel);
      } catch (error) {
        // Closing makes EventSource retry after the `retry` delay.
        console.error("[stream] Redis subscribe failed:", error);
        cleanup();
        return;
      }

      try {
        for (const info of await fleetInstances(guildId)) {
          emit("playback", info.playback ?? idlePlaybackState(guildId, info.instance));
          emit("fleet", { instance: info.instance, online: info.online, inGuild: info.inGuild });
        }
      } catch (error) {
        console.error("[stream] Snapshot failed:", error);
      }
      ready = true;
      for (const message of held.splice(0)) relay(message);

      ping = setInterval(() => send(": ping\n\n"), PING_MS);
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Proxies (nginx, cloudflared) must not buffer the stream.
      "X-Accel-Buffering": "no"
    }
  });
}

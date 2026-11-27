/**
 * GET /api/public/stats — live public numbers, no auth, CORS open.
 *
 *   ?format=shields&metric=servers|members|songs|status
 *     answers in the shields.io endpoint schema, for README badges:
 *     https://img.shields.io/endpoint?url=<this url, encoded>
 */

import { getPublicStats } from "@/lib/public-stats";
import { compactCount, type PublicStats } from "@/lib/public-stats-shape";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
};

const AMBER = "f8aa2a";

function shield(stats: PublicStats | null, metric: string | null) {
  if (!stats) return { schemaVersion: 1, label: "bypass", message: "unavailable", color: "lightgrey", isError: true };
  switch (metric) {
    case "members":
      return { schemaVersion: 1, label: "members", message: compactCount(stats.members), color: AMBER };
    case "songs":
      return { schemaVersion: 1, label: "songs played", message: compactCount(stats.songsPlayed ?? 0), color: AMBER };
    case "status": {
      const total = stats.players.length;
      const color = stats.online === total ? "brightgreen" : stats.online === 0 ? "red" : "yellow";
      return { schemaVersion: 1, label: "status", message: `${stats.online}/${total} online`, color };
    }
    default:
      return { schemaVersion: 1, label: "servers", message: compactCount(stats.servers), color: AMBER };
  }
}

export async function GET(request: NextRequest) {
  const stats = await getPublicStats();
  const params = request.nextUrl.searchParams;

  if (params.get("format") === "shields") {
    return NextResponse.json(shield(stats, params.get("metric")), { headers: HEADERS });
  }
  if (!stats) {
    return NextResponse.json({ error: "Stats unavailable" }, { status: 503, headers: { ...HEADERS, "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    {
      servers: stats.servers,
      members: stats.members,
      playingNow: stats.playingNow,
      songsPlayed: stats.songsPlayed,
      online: stats.online,
      players: stats.players.map(({ name, state, pingMs, servers, startedAt }) => ({ name, state, pingMs, servers, startedAt })),
      generatedAt: stats.generatedAt,
    },
    { headers: HEADERS },
  );
}

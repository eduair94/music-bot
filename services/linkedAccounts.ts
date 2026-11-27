import { Schema, model, models, Model } from "mongoose";
import { LinkedAccountDoc, LinkProvider, LINKED_ACCOUNTS_COLLECTION, PROVIDER_OAUTH } from "../shared/linkedAccounts";
import { availableProviders, decryptToken, encryptToken, OAuthError, refreshTokens } from "../shared/linkedAccountsServer";
import type { NewCollectionTrack } from "./collection";
import { ytSearchUrl } from "./linkBridge";

/**
 * The bot side of connected accounts (/library). The dashboard runs the
 * OAuth flow and stores the tokens (shared/linkedAccounts.ts); here we read
 * them, refresh expired access tokens, and list the user's own playlists.
 *
 * Spotify development-mode apps (since February 2026): playlist songs come
 * from /playlists/{id}/items (each entry under `item`), and only playlists
 * the user owns or collaborates on can be read, so followed playlists are
 * left out of the list.
 */

const linkedAccountSchema = new Schema<LinkedAccountDoc>(
  {
    userId: { type: String, required: true },
    provider: { type: String, required: true },
    providerUserId: { type: String, required: true },
    displayName: { type: String, default: "" },
    avatarUrl: { type: String },
    scopes: { type: [String], default: [] },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false }
);
linkedAccountSchema.index({ userId: 1, provider: 1 }, { unique: true });

const LinkedAccount: Model<LinkedAccountDoc> =
  (models.LinkedAccount as Model<LinkedAccountDoc>) || model<LinkedAccountDoc>("LinkedAccount", linkedAccountSchema, LINKED_ACCOUNTS_COLLECTION);

export type LibraryErrorCode = "notConnected" | "revoked" | "forbidden" | "failed";

export class LibraryError extends Error {
  constructor(public readonly code: LibraryErrorCode, message?: string) {
    super(message ?? code);
    this.name = "LibraryError";
  }
}

/** Providers the bot can use right now (OAuth client + encryption key configured). */
export function libraryProviders(): LinkProvider[] {
  return availableProviders();
}

export async function connectedAccounts(userId: string): Promise<Array<Pick<LinkedAccountDoc, "provider" | "displayName">>> {
  return LinkedAccount.find({ userId }, { provider: 1, displayName: 1 }).lean().exec();
}

/** A working access token for the user's account, refreshed (and saved) when expired. */
async function accessToken(userId: string, provider: LinkProvider): Promise<{ token: string; account: LinkedAccountDoc }> {
  const account = await LinkedAccount.findOne({ userId, provider }).lean().exec();
  if (!account) throw new LibraryError("notConnected");
  if (new Date(account.expiresAt).getTime() > Date.now() + 30_000) {
    return { token: decryptToken(account.accessToken), account };
  }
  try {
    const fresh = await refreshTokens(provider, decryptToken(account.refreshToken));
    await LinkedAccount.updateOne(
      { userId, provider },
      {
        $set: {
          accessToken: encryptToken(fresh.accessToken),
          expiresAt: fresh.expiresAt,
          ...(fresh.refreshToken ? { refreshToken: encryptToken(fresh.refreshToken) } : {})
        }
      }
    ).exec();
    return { token: fresh.accessToken, account };
  } catch (error) {
    if (error instanceof OAuthError && (error.code === "invalid_grant" || error.status === 400 || error.status === 401)) {
      // The user revoked access (or the token was rotated elsewhere): they must connect again.
      await LinkedAccount.deleteOne({ userId, provider }).exec();
      throw new LibraryError("revoked");
    }
    throw new LibraryError("failed", (error as Error)?.message);
  }
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new LibraryError("revoked");
  if (res.status === 403) throw new LibraryError("forbidden");
  if (!res.ok) throw new LibraryError("failed", `${res.status} ${url.split("?")[0]}`);
  return (await res.json()) as T;
}

export interface LibraryPlaylist {
  provider: LinkProvider;
  /** Provider playlist id, or "liked" for liked songs. */
  id: string;
  name: string;
  count: number | null;
}

/** "spotify:liked" ⇄ { provider, id } (autocomplete values). */
export function libraryKey(p: Pick<LibraryPlaylist, "provider" | "id">): string {
  return `${p.provider}:${p.id}`;
}

export function parseLibraryKey(value: string): { provider: LinkProvider; id: string } | null {
  const m = /^(spotify|youtube):(.{1,120})$/.exec(value);
  return m ? { provider: m[1] as LinkProvider, id: m[2] } : null;
}

/** The user's playlists on one provider, liked songs first. */
export async function listPlaylists(userId: string, provider: LinkProvider): Promise<LibraryPlaylist[]> {
  const { token, account } = await accessToken(userId, provider);
  const out: LibraryPlaylist[] = [{ provider, id: "liked", name: "", count: null }];

  if (provider === "spotify") {
    let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";
    for (let page = 0; url && page < 4; page++) {
      const data: {
        next: string | null;
        items: Array<{ id: string; name: string; collaborative?: boolean; owner?: { id?: string }; items?: { total?: number }; tracks?: { total?: number } }>;
      } = await getJson(url, token);
      for (const p of data.items ?? []) {
        // Development-mode apps can only read playlists the user owns or collaborates on.
        if (p.owner?.id !== account.providerUserId && !p.collaborative) continue;
        out.push({ provider, id: p.id, name: p.name || "Untitled", count: p.items?.total ?? p.tracks?.total ?? null });
      }
      url = data.next;
    }
    return out;
  }

  let pageToken = "";
  for (let page = 0; page < 4; page++) {
    const data: {
      nextPageToken?: string;
      items?: Array<{ id: string; snippet?: { title?: string }; contentDetails?: { itemCount?: number } }>;
    } = await getJson(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ""}`,
      token
    );
    for (const p of data.items ?? []) out.push({ provider, id: p.id, name: p.snippet?.title || "Untitled", count: p.contentDetails?.itemCount ?? null });
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return out;
}

interface SpotifyTrackObject {
  type?: string;
  name?: string;
  is_local?: boolean;
  duration_ms?: number;
  artists?: Array<{ name?: string }>;
  album?: { images?: Array<{ url?: string }> };
  external_urls?: { spotify?: string };
}

function spotifySong(t: SpotifyTrackObject | null | undefined): NewCollectionTrack | null {
  if (!t || t.is_local || (t.type && t.type !== "track") || !t.name) return null;
  const artist = (t.artists ?? []).map((a) => a.name).filter(Boolean).join(", ");
  const durationSec = t.duration_ms ? Math.round(t.duration_ms / 1000) : null;
  const thumbnail = t.album?.images?.[0]?.url ?? null;
  return {
    title: t.name,
    author: artist || "Unknown",
    url: ytSearchUrl({ title: t.name, artist, durationSec, thumbnail }),
    duration: durationSec ?? 0,
    thumbnail: thumbnail ?? undefined
  };
}

/** Songs of one playlist (or liked songs), ready to queue or store as a collection. */
export async function playlistTracks(
  userId: string,
  provider: LinkProvider,
  playlistId: string,
  limit: number
): Promise<{ name: string; tracks: NewCollectionTrack[] }> {
  const { token } = await accessToken(userId, provider);
  const tracks: NewCollectionTrack[] = [];

  if (provider === "spotify") {
    let name = "Liked Songs";
    let url: string | null =
      playlistId === "liked"
        ? "https://api.spotify.com/v1/me/tracks?limit=50"
        : `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=50&additional_types=track`;
    if (playlistId !== "liked") {
      const meta = await getJson<{ name?: string }>(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}?fields=name`, token);
      name = meta.name || "Spotify";
    }
    while (url && tracks.length < limit) {
      const data: { next: string | null; items: Array<{ item?: SpotifyTrackObject; track?: SpotifyTrackObject }> } = await getJson(url, token);
      for (const entry of data.items ?? []) {
        const song = spotifySong(entry.item ?? entry.track);
        if (song) tracks.push(song);
      }
      url = data.next;
    }
    return { name, tracks: tracks.slice(0, limit) };
  }

  // YouTube: "LL" is the signed-in user's liked videos.
  const listId = playlistId === "liked" ? "LL" : playlistId;
  let name = "Liked videos";
  if (playlistId !== "liked") {
    const meta = await getJson<{ items?: Array<{ snippet?: { title?: string } }> }>(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${encodeURIComponent(listId)}`,
      token
    );
    name = meta.items?.[0]?.snippet?.title || "YouTube";
  }
  let pageToken = "";
  while (tracks.length < limit) {
    const data: {
      nextPageToken?: string;
      items?: Array<{
        snippet?: { title?: string; videoOwnerChannelTitle?: string; thumbnails?: { medium?: { url?: string } } };
        contentDetails?: { videoId?: string };
      }>;
    } = await getJson(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${encodeURIComponent(listId)}${pageToken ? `&pageToken=${pageToken}` : ""}`,
      token
    );
    for (const item of data.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      const title = item.snippet?.title;
      // Removed videos stay in playlists as "Deleted video" / "Private video" without an owner.
      if (!videoId || !title || !item.snippet?.videoOwnerChannelTitle) continue;
      tracks.push({
        title,
        author: item.snippet.videoOwnerChannelTitle.replace(/\s*-\s*Topic$/i, ""),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        duration: 0,
        thumbnail: item.snippet.thumbnails?.medium?.url
      });
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return { name, tracks: tracks.slice(0, limit) };
}

export function providerLabel(provider: LinkProvider): string {
  return PROVIDER_OAUTH[provider].label;
}

"use client";

import type { CommandResult } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason?: string,
  ) {
    super(message);
  }
}

/** JSON fetch against /api/guilds/:id/<path>; throws ApiError with the server's reason. */
export async function guildApi<T>(guildId: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/guilds/${guildId}/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; reason?: string };
    throw new ApiError(b.reason || b.error || `Request failed (${res.status})`, res.status, b.reason);
  }
  return body as T;
}

export async function postCommand(
  guildId: string,
  instance: number,
  command: string,
  params: Record<string, unknown> = {},
): Promise<CommandResult> {
  try {
    return await guildApi<CommandResult>(guildId, "commands", {
      method: "POST",
      body: JSON.stringify({ command, params, instance }),
    });
  } catch (e) {
    const err = e as ApiError;
    return { success: false, error: err.message, reason: err.reason };
  }
}

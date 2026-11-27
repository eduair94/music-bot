import { BotCommand, IBotCommand } from "../../models/BotCommand";
import type { BotCommandParams, BusCommand } from "../../shared/types";

export type BusResult =
  | { status: "completed"; message: string; data?: unknown }
  | { status: "failed"; message: string }
  /** Claimed but still running when we stopped waiting (a slow play). */
  | { status: "processing" }
  /** Nobody claimed it in time: the instance is down; the command was withdrawn. */
  | { status: "unclaimed" };

/** Ticks of the executor poll (500 ms) plus headroom. */
const POLL_MS = 150;

/**
 * Hand a player command to another fleet instance through the `botcommands`
 * bus and wait for its result (the same documents the dashboard writes).
 */
export async function sendToInstance(options: {
  guildId: string;
  instance: number;
  command: BusCommand;
  params?: BotCommandParams;
  user: { id: string; username: string };
  timeoutMs?: number;
}): Promise<BusResult> {
  const { guildId, instance, command, params = {}, user } = options;
  const created = await BotCommand.create({
    guildId,
    instance,
    command,
    params,
    status: "pending",
    userId: user.id,
    requestedBy: { id: user.id, username: user.username }
  });

  const deadline = Date.now() + (options.timeoutMs ?? 8_000);
  let claimed = false;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const row = (await BotCommand.findById(created._id).lean()) as IBotCommand | null;
    if (!row) break;
    if (row.status === "completed") return { status: "completed", message: row.result ?? "", data: row.data };
    if (row.status === "failed") return { status: "failed", message: row.error ?? "" };
    if (row.status === "processing") claimed = true;
  }
  if (claimed) return { status: "processing" };

  // Withdraw it so it can't run minutes later when the instance comes back.
  const withdrawn = await BotCommand.updateOne(
    { _id: created._id, status: "pending" },
    { status: "failed", error: "Not claimed in time", processedAt: new Date() }
  ).catch(() => null);
  return withdrawn?.modifiedCount ? { status: "unclaimed" } : { status: "processing" };
}

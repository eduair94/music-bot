import "server-only";
import { BotCommand, IBotCommand } from "./models/BotCommand";
import { connectToDatabase } from "./mongodb";

export interface CommandOutcome {
  id: string;
  status: "completed" | "failed" | "pending";
  result?: string;
  error?: string;
}

/** Insert a `botcommands` document and poll until the bot processes it or the timeout elapses. */
export async function enqueueAndWait(doc: Partial<IBotCommand>, timeoutMs = 5000): Promise<CommandOutcome> {
  await connectToDatabase();
  const created = await BotCommand.create({ ...doc, status: "pending" });
  const id = String(created._id);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = (await BotCommand.findById(id).lean()) as IBotCommand | null;
    if (row && row.status === "completed") return { id, status: "completed", result: row.result };
    if (row && row.status === "failed") return { id, status: "failed", error: row.error || "Command failed" };
    await new Promise((r) => setTimeout(r, 150));
  }
  return { id, status: "pending" };
}

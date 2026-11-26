import {
  ButtonInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction
} from "discord.js";

/**
 * Persistent component handlers.
 *
 * Collectors die with their timeout (and with every restart), which left the
 * old now-playing and help buttons answering "This interaction failed". A
 * handler registered here answers any component whose custom id starts with
 * `<namespace>:`, for as long as the bot runs, including messages sent before
 * a restart. Custom ids look like `player:pause` or `queue:page:3`.
 *
 * Components without a registered namespace are left alone, so commands that
 * still use their own collectors keep working.
 */
export type ComponentInteraction = MessageComponentInteraction | ModalSubmitInteraction;

export type ComponentHandler = (
  interaction: ComponentInteraction,
  args: string[]
) => Promise<unknown> | unknown;

const handlers = new Map<string, ComponentHandler>();

export function registerComponentHandler(namespace: string, handler: ComponentHandler): void {
  if (handlers.has(namespace)) {
    throw new Error(`Component namespace "${namespace}" is already registered`);
  }
  handlers.set(namespace, handler);
}

export function parseCustomId(customId: string): { namespace: string; args: string[] } {
  const [namespace, ...args] = customId.split(":");
  return { namespace, args };
}

export function getComponentHandler(customId: string): { handler: ComponentHandler; args: string[] } | null {
  const { namespace, args } = parseCustomId(customId);
  const handler = handlers.get(namespace);
  return handler ? { handler, args } : null;
}

export function isButton(interaction: ComponentInteraction): interaction is ButtonInteraction {
  return "isButton" in interaction && interaction.isButton();
}

export function isStringSelect(interaction: ComponentInteraction): interaction is StringSelectMenuInteraction {
  return "isStringSelectMenu" in interaction && interaction.isStringSelectMenu();
}

/**
 * Ticket topics offered by the support server's #tickets panel. The panel
 * (scripts/setupSupportServer.ts) lists them in a `ticket:open` select; the bot
 * (services/supportServer.ts) opens a private thread with the matching hint.
 */
export const TICKET_TOPICS = {
  billing: { emoji: "💳", label: "Billing & Patreon", description: "Payments, Founder perks, linking Patreon", hint: "Your Patreon name or email, what you paid for and what's wrong." },
  report: { emoji: "🚩", label: "Report a member", description: "Harassment, scams or rule breaking", hint: "Who (mention or user ID), where it happened, and message links or screenshots." },
  bug: { emoji: "🐛", label: "Private bug report", description: "Problems you'd rather not post in public", hint: "Your server ID, the command you ran, what happened and when." },
  other: { emoji: "💬", label: "Something else", description: "Partnerships, press, anything else", hint: "Tell us what you need." }
} as const;

export type TicketTopic = keyof typeof TICKET_TOPICS;

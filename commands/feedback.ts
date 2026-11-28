import {
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  CheckboxBuilder,
  ContainerBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { Feedback } from "../models/Feedback";
import { DatabaseService } from "../services/database";
import { forwardFeedback } from "../shared/feedbackWebhook";
import { FEEDBACK_MESSAGE_MAX, type FeedbackKind, type FeedbackRecord } from "../shared/growth";
import { SUPPORT_INVITE_URL } from "../shared/links";
import { registerComponentHandler } from "../structs/componentRouter";
import { i18n } from "../utils/i18n";

/**
 * /feedback — a modal (kind select, message, opt-in "can we quote this on the
 * website?" checkbox) that lands in Mongo `feedbacks` and in the staff channel
 * webhook (FEEDBACK_WEBHOOK_URL), next to the site's and dashboard's
 * feedback. Works anywhere, also user-installed.
 * The modal submit is answered by the persistent "feedback" component
 * handler below, so it survives restarts like every other component.
 */
const MODAL_ID = "feedback:submit";
const KINDS = ["idea", "bug", "praise", "other"] as const satisfies readonly FeedbackKind[];
const MESSAGE_MIN = 3;

export function buildFeedbackModal(): ModalBuilder {
  const kind = new StringSelectMenuBuilder()
    .setCustomId("kind")
    .setPlaceholder(i18n.__("feedback.kindPlaceholder"))
    .setRequired(false)
    .setMinValues(0)
    .setMaxValues(1)
    .addOptions(
      KINDS.map((k) => ({
        label: i18n.__(`feedback.kinds.${k}`),
        description: i18n.__(`feedback.kindDescriptions.${k}`),
        value: k
      }))
    );
  const message = new TextInputBuilder()
    .setCustomId("message")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(MESSAGE_MIN)
    .setMaxLength(FEEDBACK_MESSAGE_MAX)
    .setPlaceholder(i18n.__("feedback.messagePlaceholder"));

  // Opt-in consent for the website's testimonials: unticked by default.
  const quote = new CheckboxBuilder().setCustomId("quote").setDefault(false);

  return new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle(i18n.__("feedback.modalTitle"))
    .addLabelComponents(
      new LabelBuilder().setLabel(i18n.__("feedback.kindLabel")).setStringSelectMenuComponent(kind),
      new LabelBuilder()
        .setLabel(i18n.__("feedback.messageLabel"))
        .setDescription(i18n.__("feedback.messageDescription"))
        .setTextInputComponent(message),
      new LabelBuilder()
        .setLabel(i18n.__("feedback.quoteLabel"))
        .setDescription(i18n.__("feedback.quoteDescription"))
        .setCheckboxComponent(quote)
    );
}

/** The person ticked "can we quote this?"; false when the box is missing (older clients). */
function quoteAllowed(interaction: ModalSubmitInteraction): boolean {
  try {
    return interaction.fields.getCheckbox("quote") === true;
  } catch {
    return false;
  }
}

function selectedKind(interaction: ModalSubmitInteraction): FeedbackKind {
  try {
    const value = interaction.fields.getStringSelectValues("kind")[0];
    return (KINDS as readonly string[]).includes(value) ? (value as FeedbackKind) : "other";
  } catch {
    return "other";
  }
}

async function store(record: FeedbackRecord): Promise<boolean> {
  if (!DatabaseService.getInstance().isConnected()) return false;
  try {
    await Feedback.create(record);
    return true;
  } catch (error) {
    console.error("[feedback] could not store:", (error as Error)?.message ?? error);
    return false;
  }
}

async function handleSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const message = interaction.fields.getTextInputValue("message").trim().slice(0, FEEDBACK_MESSAGE_MAX);
  const record: FeedbackRecord = {
    kind: selectedKind(interaction),
    source: "bot",
    message,
    ...(quoteAllowed(interaction) ? { quoteOk: true } : {}),
    userId: interaction.user.id,
    userName: interaction.user.username,
    guildId: interaction.guildId ?? undefined,
    locale: interaction.locale,
    context: "/feedback",
    status: "new",
    createdAt: new Date()
  };

  // Thank first (modal submits must be answered within 3 s), then save.
  const container = new ContainerBuilder()
    .setAccentColor(0xf8aa2a)
    .addTextDisplayComponents((t) => t.setContent(`### ${i18n.__("feedback.thanksTitle")}`))
    .addTextDisplayComponents((t) => t.setContent(i18n.__("feedback.thanksBody")))
    .addActionRowComponents((row) =>
      row.setComponents(new ButtonBuilder().setLabel(i18n.__("feedback.supportButton")).setStyle(ButtonStyle.Link).setURL(SUPPORT_INVITE_URL))
    );
  await interaction
    .reply({ components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 })
    .catch((error) => console.warn("[feedback] could not reply:", (error as Error)?.message ?? error));

  // Mongo down still forwards to the staff channel; both down leaves it in the logs.
  const [stored, forwarded] = await Promise.all([store(record), forwardFeedback(record)]);
  if (!stored && !forwarded) console.warn("[feedback] not stored or forwarded:", JSON.stringify(record));
}

registerComponentHandler("feedback", async (interaction, args) => {
  if (args[0] === "submit" && interaction.isModalSubmit()) return handleSubmit(interaction);
});

export default {
  data: new SlashCommandBuilder().setName("feedback").setDescription(i18n.__("feedback.description")),
  category: "other",
  cooldown: 20,
  userInstallable: true,
  execute(interaction: ChatInputCommandInteraction) {
    return interaction.showModal(buildFeedbackModal());
  }
};

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageComponentInteraction,
  MessageFlags
} from "discord.js";
import { GuildSettingsService } from "../../services/guildSettings";
import { i18n } from "../../utils/i18n";
import { SettingsHandlerContext } from "./types";

const channelList = (ids: string[]) => ids.map((c) => "<#" + c + ">").join(", ");

export async function handleVoiceChannels({ interaction, settings }: SettingsHandlerContext) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("settings:voice")
    .setPlaceholder(i18n.__("settings.voicechannels.placeholder"))
    .setChannelTypes(ChannelType.GuildVoice)
    .setMinValues(0)
    .setMaxValues(10);

  const clearButton = new ButtonBuilder()
    .setCustomId("settings:voice:clear")
    .setLabel(i18n.__("settings.voicechannels.allowAll"))
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton);

  const current = settings.allowedVoiceChannels.length > 0 ? channelList(settings.allowedVoiceChannels) : i18n.__("settings.allChannels");
  return interaction.reply({
    content: i18n.__("settings.voicechannels.prompt") + "\n" + i18n.__mf("settings.current", { value: current }),
    components: [row1, row2],
    flags: MessageFlags.Ephemeral
  });
}

export async function onVoiceChannelsComponent(interaction: MessageComponentInteraction<"cached">, action: string | undefined) {
  const settingsService = GuildSettingsService.getInstance();
  if (action === "clear") {
    await settingsService.updateSettings(interaction.guildId, { allowedVoiceChannels: [] });
    return interaction.update({ content: i18n.__("settings.voicechannels.cleared"), components: [] });
  }
  if (!interaction.isChannelSelectMenu()) return;
  const channels = interaction.values;
  await settingsService.updateSettings(interaction.guildId, { allowedVoiceChannels: channels });
  return interaction.update({
    content:
      channels.length > 0
        ? i18n.__mf("settings.voicechannels.set", { channels: channelList(channels) })
        : i18n.__("settings.voicechannels.cleared"),
    components: []
  });
}

export async function handleTextChannels({ interaction, settings }: SettingsHandlerContext) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("settings:text")
    .setPlaceholder(i18n.__("settings.textchannels.placeholder"))
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(10);

  const clearButton = new ButtonBuilder()
    .setCustomId("settings:text:clear")
    .setLabel(i18n.__("settings.textchannels.allowAll"))
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton);

  const current = settings.allowedTextChannels.length > 0 ? channelList(settings.allowedTextChannels) : i18n.__("settings.allChannels");
  return interaction.reply({
    content: i18n.__("settings.textchannels.prompt") + "\n" + i18n.__mf("settings.current", { value: current }),
    components: [row1, row2],
    flags: MessageFlags.Ephemeral
  });
}

export async function onTextChannelsComponent(interaction: MessageComponentInteraction<"cached">, action: string | undefined) {
  const settingsService = GuildSettingsService.getInstance();
  if (action === "clear") {
    await settingsService.updateSettings(interaction.guildId, { allowedTextChannels: [] });
    return interaction.update({ content: i18n.__("settings.textchannels.cleared"), components: [] });
  }
  if (!interaction.isChannelSelectMenu()) return;
  const channels = interaction.values;
  await settingsService.updateSettings(interaction.guildId, { allowedTextChannels: channels });
  return interaction.update({
    content:
      channels.length > 0
        ? i18n.__mf("settings.textchannels.set", { channels: channelList(channels) })
        : i18n.__("settings.textchannels.cleared"),
    components: []
  });
}

export async function handleLogChannel({ interaction, settings }: SettingsHandlerContext) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("settings:log")
    .setPlaceholder(i18n.__("settings.logchannel.placeholder"))
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const clearButton = new ButtonBuilder()
    .setCustomId("settings:log:default")
    .setLabel(i18n.__("settings.logchannel.useDefault"))
    .setStyle(ButtonStyle.Secondary);

  const disableButton = new ButtonBuilder()
    .setCustomId("settings:log:disable")
    .setLabel(i18n.__("settings.logchannel.disable"))
    .setStyle(ButtonStyle.Danger);

  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton, disableButton);

  let currentStatus = i18n.__("settings.logchannel.statusDefault");
  if (settings.logChannelId === "disabled") {
    currentStatus = i18n.__("settings.logchannel.statusDisabled");
  } else if (settings.logChannelId) {
    currentStatus = "<#" + settings.logChannelId + ">";
  }

  return interaction.reply({
    content: [
      i18n.__("settings.logchannel.prompt"),
      "",
      i18n.__mf("settings.current", { value: currentStatus }),
      "",
      i18n.__("settings.logchannel.note")
    ].join("\n"),
    components: [row1, row2],
    flags: MessageFlags.Ephemeral
  });
}

export async function onLogChannelComponent(interaction: MessageComponentInteraction<"cached">, action: string | undefined) {
  const settingsService = GuildSettingsService.getInstance();
  if (action === "default") {
    await settingsService.updateSettings(interaction.guildId, { logChannelId: null });
    return interaction.update({ content: i18n.__("settings.logchannel.reset"), components: [] });
  }
  if (action === "disable") {
    await settingsService.updateSettings(interaction.guildId, { logChannelId: "disabled" });
    return interaction.update({ content: i18n.__("settings.logchannel.disabled"), components: [] });
  }
  if (!interaction.isChannelSelectMenu()) return;
  const channelId = interaction.values[0];
  if (!channelId) return;
  await settingsService.updateSettings(interaction.guildId, { logChannelId: channelId });
  return interaction.update({ content: i18n.__mf("settings.logchannel.set", { channel: "<#" + channelId + ">" }), components: [] });
}

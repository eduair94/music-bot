import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
} from "discord.js";
import { SettingsHandlerContext } from "./types";

export async function handleVoiceChannels({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("voicechannel_select")
    .setPlaceholder("Select allowed voice channels")
    .setChannelTypes(ChannelType.GuildVoice)
    .setMinValues(0)
    .setMaxValues(10);

  const clearButton = new ButtonBuilder()
    .setCustomId("voicechannel_clear")
    .setLabel("Allow All Channels")
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton);

  const response = await interaction.reply({
    content: "Select which voice channels the bot is allowed to join.\n**Current:** " + 
      (settings.allowedVoiceChannels.length > 0 
        ? settings.allowedVoiceChannels.map((c) => "<#" + c + ">").join(", ") 
        : "All channels allowed"),
    components: [row1, row2],
    ephemeral: true,
  });

  const collector = response.createMessageComponentCollector({
    time: 60000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "voicechannel_select" && i.isChannelSelectMenu()) {
      const channels = i.values;
      await settingsService.updateSettings(guildId, { allowedVoiceChannels: channels });
      await i.update({
        content: channels.length > 0 
          ? "Allowed voice channels: " + channels.map((c) => "<#" + c + ">").join(", ") 
          : "All voice channels are now allowed.",
        components: [],
      });
    } else if (i.customId === "voicechannel_clear") {
      await settingsService.updateSettings(guildId, { allowedVoiceChannels: [] });
      await i.update({
        content: "All voice channels are now allowed.",
        components: [],
      });
    }
  });
}

export async function handleTextChannels({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("textchannel_select")
    .setPlaceholder("Select allowed text channels")
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(10);

  const clearButton = new ButtonBuilder()
    .setCustomId("textchannel_clear")
    .setLabel("Allow All Channels")
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton);

  const response = await interaction.reply({
    content: "Select which text channels can use bot commands.\n**Current:** " + 
      (settings.allowedTextChannels.length > 0 
        ? settings.allowedTextChannels.map((c) => "<#" + c + ">").join(", ") 
        : "All channels allowed"),
    components: [row1, row2],
    ephemeral: true,
  });

  const collector = response.createMessageComponentCollector({
    time: 60000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "textchannel_select" && i.isChannelSelectMenu()) {
      const channels = i.values;
      await settingsService.updateSettings(guildId, { allowedTextChannels: channels });
      await i.update({
        content: channels.length > 0 
          ? "Allowed text channels: " + channels.map((c) => "<#" + c + ">").join(", ") 
          : "All text channels are now allowed.",
        components: [],
      });
    } else if (i.customId === "textchannel_clear") {
      await settingsService.updateSettings(guildId, { allowedTextChannels: [] });
      await i.update({
        content: "All text channels are now allowed.",
        components: [],
      });
    }
  });
}

export async function handleLogChannel({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("logchannel_select")
    .setPlaceholder("Select log channel for bot messages")
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const clearButton = new ButtonBuilder()
    .setCustomId("logchannel_clear")
    .setLabel("Use Default (bot-commands)")
    .setStyle(ButtonStyle.Secondary);

  const disableButton = new ButtonBuilder()
    .setCustomId("logchannel_disable")
    .setLabel("Disable Log Messages")
    .setStyle(ButtonStyle.Danger);

  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton, disableButton);

  let currentStatus = "Using default behavior (looks for #bot-commands)";
  if (settings.logChannelId === "disabled") {
    currentStatus = "Log messages are disabled";
  } else if (settings.logChannelId) {
    currentStatus = "<#" + settings.logChannelId + ">";
  }

  const response = await interaction.reply({
    content: "Select a channel for bot log messages (now playing, queue finished, etc.).\n\n**Current:** " + currentStatus + "\n\n**Note:** If no log channel is set, the bot will look for a channel named 'bot-commands'. If that doesn't exist, no log messages will be sent.",
    components: [row1, row2],
    ephemeral: true,
  });

  const collector = response.createMessageComponentCollector({
    time: 60000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "logchannel_select" && i.isChannelSelectMenu()) {
      const channelId = i.values[0];
      await settingsService.updateSettings(guildId, { logChannelId: channelId });
      await i.update({
        content: "Log channel set to <#" + channelId + ">",
        components: [],
      });
    } else if (i.customId === "logchannel_clear") {
      await settingsService.updateSettings(guildId, { logChannelId: null });
      await i.update({
        content: "Log channel reset to default (will use #bot-commands if it exists).",
        components: [],
      });
    } else if (i.customId === "logchannel_disable") {
      await settingsService.updateSettings(guildId, { logChannelId: "disabled" });
      await i.update({
        content: "Log messages have been disabled.",
        components: [],
      });
    }
  });
}

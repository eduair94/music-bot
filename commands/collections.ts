import { useQueue } from "discord-player";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder
} from "discord.js";
import { collectionService } from "../services/collection";
import { i18n } from "../utils/i18n";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder()
    .setName("collections")
    .setDescription(i18n.__("collections.description"))
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription(i18n.__("collections.list.description"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription(i18n.__("collections.create.description"))
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(i18n.__("collections.create.nameOption"))
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName("description")
            .setDescription(i18n.__("collections.create.descriptionOption"))
            .setRequired(false)
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription(i18n.__("collections.delete.description"))
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(i18n.__("collections.delete.nameOption"))
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription(i18n.__("collections.view.description"))
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(i18n.__("collections.view.nameOption"))
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("save")
        .setDescription(i18n.__("collections.save.description"))
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(i18n.__("collections.save.nameOption"))
            .setRequired(true)
            .setMaxLength(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("load")
        .setDescription(i18n.__("collections.load.description"))
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(i18n.__("collections.load.nameOption"))
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("rename")
        .setDescription(i18n.__("collections.rename.description"))
        .addStringOption((opt) =>
          opt
            .setName("old_name")
            .setDescription(i18n.__("collections.rename.oldNameOption"))
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("new_name")
            .setDescription(i18n.__("collections.rename.newNameOption"))
            .setRequired(true)
            .setMaxLength(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("share")
        .setDescription(i18n.__("collections.share.description"))
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(i18n.__("collections.share.nameOption"))
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unshare")
        .setDescription(i18n.__("collections.unshare.description"))
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(i18n.__("collections.unshare.nameOption"))
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("clone")
        .setDescription(i18n.__("collections.clone.description"))
        .addStringOption((opt) =>
          opt
            .setName("share_code")
            .setDescription(i18n.__("collections.clone.shareCodeOption"))
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(i18n.__("collections.clone.nameOption"))
            .setRequired(true)
            .setMaxLength(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("merge")
        .setDescription(i18n.__("collections.merge.description"))
        .addStringOption((opt) =>
          opt
            .setName("source")
            .setDescription(i18n.__("collections.merge.sourceOption"))
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("target")
            .setDescription(i18n.__("collections.merge.targetOption"))
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("addcurrent")
        .setDescription(i18n.__("collections.addcurrent.description"))
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(i18n.__("collections.addcurrent.nameOption"))
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("removetrack")
        .setDescription(i18n.__("collections.removetrack.description"))
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(i18n.__("collections.removetrack.nameOption"))
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("position")
            .setDescription(i18n.__("collections.removetrack.positionOption"))
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    switch (subcommand) {
      case "list":
        return handleList(interaction, userId);
      case "create":
        return handleCreate(interaction, userId);
      case "delete":
        return handleDelete(interaction, userId);
      case "view":
        return handleView(interaction, userId);
      case "save":
        return handleSave(interaction, userId);
      case "load":
        return handleLoad(interaction, userId);
      case "rename":
        return handleRename(interaction, userId);
      case "share":
        return handleShare(interaction, userId);
      case "unshare":
        return handleUnshare(interaction, userId);
      case "clone":
        return handleClone(interaction, userId);
      case "merge":
        return handleMerge(interaction, userId);
      case "addcurrent":
        return handleAddCurrent(interaction, userId);
      case "removetrack":
        return handleRemoveTrack(interaction, userId);
      default:
        return safeReply(interaction, {
          content: i18n.__("common.error"),
          ephemeral: true,
        });
    }
  },
};

async function handleList(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const collections = await collectionService.getUserCollections(userId);

  if (collections.length === 0) {
    return safeReply(interaction, {
      content: i18n.__("collections.list.empty"),
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(i18n.__("collections.list.title"))
    .setColor("#0099ff")
    .setDescription(
      collections
        .map(
          (c, i) =>
            `**${i + 1}.** ${c.name} - ${c.tracks.length} ${i18n.__("collections.tracks")}${
              c.shareCode ? " 🔗" : ""
            }`
        )
        .join("\n")
    )
    .setFooter({
      text: i18n.__mf("collections.list.footer", { count: collections.length }),
    });

  return safeReply(interaction, { embeds: [embed] });
}

async function handleCreate(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const name = interaction.options.getString("name", true);
  const description = interaction.options.getString("description") || undefined;

  // Check limit
  const canCreate = await collectionService.canCreateCollection(userId);
  if (!canCreate) {
    return safeReply(interaction, {
      content: i18n.__("collections.create.limitReached"),
      ephemeral: true,
    });
  }

  // Check if exists
  const existing = await collectionService.getByName(userId, name);
  if (existing) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.create.exists", { name }),
      ephemeral: true,
    });
  }

  try {
    await collectionService.create(userId, name, description);
    return safeReply(interaction, {
      content: i18n.__mf("collections.create.success", { name }),
    });
  } catch (error) {
    console.error("Error creating collection:", error);
    return safeReply(interaction, {
      content: i18n.__("common.error"),
      ephemeral: true,
    });
  }
}

async function handleDelete(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const name = interaction.options.getString("name", true);

  const deleted = await collectionService.delete(userId, name);
  if (!deleted) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.notFound", { name }),
      ephemeral: true,
    });
  }

  return safeReply(interaction, {
    content: i18n.__mf("collections.delete.success", { name }),
  });
}

async function handleView(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const name = interaction.options.getString("name", true);

  const collection = await collectionService.getByName(userId, name);
  if (!collection) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.notFound", { name }),
      ephemeral: true,
    });
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const totalDuration = collection.tracks.reduce((sum, t) => sum + t.duration, 0);
  const trackList = collection.tracks.slice(0, 10).map((t, i) => 
    `**${i + 1}.** [${t.title}](${t.url}) - ${formatDuration(t.duration)}`
  );

  if (collection.tracks.length > 10) {
    trackList.push(
      i18n.__mf("collections.view.andMore", {
        count: collection.tracks.length - 10,
      })
    );
  }

  const embed = new EmbedBuilder()
    .setTitle(`📁 ${collection.name}`)
    .setColor("#0099ff")
    .setDescription(
      collection.description || trackList.join("\n") || i18n.__("collections.view.empty")
    )
    .addFields(
      {
        name: i18n.__("collections.view.tracksField"),
        value: collection.tracks.length.toString(),
        inline: true,
      },
      {
        name: i18n.__("collections.view.durationField"),
        value: formatDuration(totalDuration),
        inline: true,
      }
    );

  if (collection.description && collection.tracks.length > 0) {
    embed.addFields({
      name: i18n.__("collections.view.tracksField"),
      value: trackList.join("\n"),
    });
  }

  if (collection.shareCode) {
    embed.addFields({
      name: i18n.__("collections.view.shareCodeField"),
      value: `\`${collection.shareCode}\``,
      inline: true,
    });
  }

  return safeReply(interaction, { embeds: [embed] });
}

async function handleSave(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const name = interaction.options.getString("name", true);
  const queue = useQueue(interaction.guildId!);

  if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
    return safeReply(interaction, {
      content: i18n.__("collections.save.noQueue"),
      ephemeral: true,
    });
  }

  // Check limit for new collections
  const existing = await collectionService.getByName(userId, name);
  if (!existing) {
    const canCreate = await collectionService.canCreateCollection(userId);
    if (!canCreate) {
      return safeReply(interaction, {
        content: i18n.__("collections.create.limitReached"),
        ephemeral: true,
      });
    }
  }

  try {
    const collection = await collectionService.saveQueue(
      userId,
      name,
      queue.tracks.toArray(),
      queue.currentTrack || undefined
    );

    return safeReply(interaction, {
      content: i18n.__mf("collections.save.success", {
        name,
        count: collection.tracks.length,
      }),
    });
  } catch (error) {
    console.error("Error saving collection:", error);
    return safeReply(interaction, {
      content: i18n.__("common.error"),
      ephemeral: true,
    });
  }
}

async function handleLoad(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const name = interaction.options.getString("name", true);
  const member = interaction.guild?.members.cache.get(userId);
  const voiceChannel = member?.voice.channel;

  if (!voiceChannel) {
    return safeReply(interaction, {
      content: i18n.__("common.notInVoice"),
      ephemeral: true,
    });
  }

  const collection = await collectionService.getByName(userId, name);
  if (!collection) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.notFound", { name }),
      ephemeral: true,
    });
  }

  if (collection.tracks.length === 0) {
    return safeReply(interaction, {
      content: i18n.__("collections.load.empty"),
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    const { useDiscordPlayer } = await import("../services/discordPlayer");
    const discordPlayer = useDiscordPlayer();
    const textChannel = interaction.channel as any;
    let addedCount = 0;

    for (const track of collection.tracks) {
      try {
        await discordPlayer.play(voiceChannel, track.url, textChannel);
        addedCount++;
      } catch (e) {
        console.error(`Failed to add track ${track.title}:`, e);
      }
    }

    return interaction.editReply({
      content: i18n.__mf("collections.load.success", {
        name,
        count: addedCount,
      }),
    });
  } catch (error) {
    console.error("Error loading collection:", error);
    return interaction.editReply({
      content: i18n.__("common.error"),
    });
  }
}

async function handleRename(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const oldName = interaction.options.getString("old_name", true);
  const newName = interaction.options.getString("new_name", true);

  // Check if new name already exists
  const existingNew = await collectionService.getByName(userId, newName);
  if (existingNew) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.rename.exists", { name: newName }),
      ephemeral: true,
    });
  }

  const collection = await collectionService.rename(userId, oldName, newName);
  if (!collection) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.notFound", { name: oldName }),
      ephemeral: true,
    });
  }

  return safeReply(interaction, {
    content: i18n.__mf("collections.rename.success", { oldName, newName }),
  });
}

async function handleShare(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const name = interaction.options.getString("name", true);

  const shareCode = await collectionService.createShareCode(userId, name);
  if (!shareCode) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.notFound", { name }),
      ephemeral: true,
    });
  }

  return safeReply(interaction, {
    content: i18n.__mf("collections.share.success", { name, code: shareCode }),
  });
}

async function handleUnshare(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const name = interaction.options.getString("name", true);

  const collection = await collectionService.removeShareCode(userId, name);
  if (!collection) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.notFound", { name }),
      ephemeral: true,
    });
  }

  return safeReply(interaction, {
    content: i18n.__mf("collections.unshare.success", { name }),
  });
}

async function handleClone(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const shareCode = interaction.options.getString("share_code", true);
  const name = interaction.options.getString("name", true);

  // Check limit
  const canCreate = await collectionService.canCreateCollection(userId);
  if (!canCreate) {
    return safeReply(interaction, {
      content: i18n.__("collections.create.limitReached"),
      ephemeral: true,
    });
  }

  // Check if name exists
  const existing = await collectionService.getByName(userId, name);
  if (existing) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.create.exists", { name }),
      ephemeral: true,
    });
  }

  try {
    const collection = await collectionService.cloneFromShareCode(
      userId,
      shareCode,
      name
    );

    if (!collection) {
      return safeReply(interaction, {
        content: i18n.__("collections.clone.invalidCode"),
        ephemeral: true,
      });
    }

    return safeReply(interaction, {
      content: i18n.__mf("collections.clone.success", {
        name,
        count: collection.tracks.length,
      }),
    });
  } catch (error) {
    console.error("Error cloning collection:", error);
    return safeReply(interaction, {
      content: i18n.__("common.error"),
      ephemeral: true,
    });
  }
}

async function handleMerge(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const source = interaction.options.getString("source", true);
  const target = interaction.options.getString("target", true);

  if (source === target) {
    return safeReply(interaction, {
      content: i18n.__("collections.merge.sameCollection"),
      ephemeral: true,
    });
  }

  const collection = await collectionService.merge(userId, source, target);
  if (!collection) {
    return safeReply(interaction, {
      content: i18n.__("collections.merge.notFound"),
      ephemeral: true,
    });
  }

  return safeReply(interaction, {
    content: i18n.__mf("collections.merge.success", {
      source,
      target,
      count: collection.tracks.length,
    }),
  });
}

async function handleAddCurrent(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const name = interaction.options.getString("name", true);
  const queue = useQueue(interaction.guildId!);

  if (!queue || !queue.currentTrack) {
    return safeReply(interaction, {
      content: i18n.__("collections.addcurrent.noTrack"),
      ephemeral: true,
    });
  }

  const collection = await collectionService.getByName(userId, name);
  if (!collection) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.notFound", { name }),
      ephemeral: true,
    });
  }

  try {
    await collectionService.addTracks(userId, name, [queue.currentTrack]);
    return safeReply(interaction, {
      content: i18n.__mf("collections.addcurrent.success", {
        track: queue.currentTrack.title,
        name,
      }),
    });
  } catch (error) {
    console.error("Error adding track:", error);
    return safeReply(interaction, {
      content: i18n.__("common.error"),
      ephemeral: true,
    });
  }
}

async function handleRemoveTrack(
  interaction: ChatInputCommandInteraction,
  userId: string
) {
  const name = interaction.options.getString("name", true);
  const position = interaction.options.getInteger("position", true);

  const collection = await collectionService.getByName(userId, name);
  if (!collection) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.notFound", { name }),
      ephemeral: true,
    });
  }

  if (position < 1 || position > collection.tracks.length) {
    return safeReply(interaction, {
      content: i18n.__mf("collections.removetrack.invalidPosition", {
        max: collection.tracks.length,
      }),
      ephemeral: true,
    });
  }

  const trackTitle = collection.tracks[position - 1].title;
  const result = await collectionService.removeTrack(userId, name, position - 1);
  
  if (!result) {
    return safeReply(interaction, {
      content: i18n.__("common.error"),
      ephemeral: true,
    });
  }

  return safeReply(interaction, {
    content: i18n.__mf("collections.removetrack.success", {
      track: trackTitle,
      name,
    }),
  });
}

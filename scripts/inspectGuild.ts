/**
 * Print a guild's structure as the bot sees it: features, settings, roles,
 * channels (with type and position), the bot's permissions.
 * Usage: TOKEN=... npx ts-node --transpile-only scripts/inspectGuild.ts <guildId>
 */
import { PermissionsBitField, REST, Routes } from "discord.js";

const TYPES: Record<number, string> = { 0: "text", 2: "voice", 4: "category", 5: "announce", 13: "stage", 15: "forum", 16: "media" };

async function main() {
  const guildId = process.argv[2];
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);
  const guild: any = await rest.get(Routes.guild(guildId), { query: new URLSearchParams({ with_counts: "true" }) });
  const channels: any[] = (await rest.get(Routes.guildChannels(guildId))) as any[];
  const roles: any[] = (await rest.get(Routes.guildRoles(guildId))) as any[];
  const me: any = await rest.get(Routes.user("@me"));
  const member: any = await rest.get(Routes.guildMember(guildId, me.id));

  let perms = 0n;
  for (const r of roles) if (r.id === guildId || member.roles.includes(r.id)) perms |= BigInt(r.permissions);
  const isAdmin = (perms & PermissionsBitField.Flags.Administrator) !== 0n;

  console.log(`guild: ${guild.name} | members ~${guild.approximate_member_count} | owner ${guild.owner_id}`);
  console.log(`features: ${guild.features.join(", ") || "-"}`);
  console.log(`verification ${guild.verification_level} | explicit filter ${guild.explicit_content_filter} | default notif ${guild.default_message_notifications} | system ch ${guild.system_channel_id} | rules ch ${guild.rules_channel_id} | updates ch ${guild.public_updates_channel_id} | premium tier ${guild.premium_tier} | vanity ${guild.vanity_url_code}`);
  console.log(`description: ${guild.description ?? "-"} | icon ${Boolean(guild.icon)} banner ${Boolean(guild.banner)} splash ${Boolean(guild.splash)}`);
  console.log(`bot admin: ${isAdmin} | perms: ${new PermissionsBitField(perms).toArray().slice(0, 40).join(",")}`);
  console.log(`bot roles: ${member.roles.map((id: string) => roles.find((r) => r.id === id)?.name).join(", ")}`);
  console.log("\nroles (top first):");
  for (const r of [...roles].sort((a, b) => b.position - a.position)) {
    console.log(`  ${r.position.toString().padStart(2)} ${r.name} ${r.managed ? "(managed)" : ""} color=${r.color.toString(16)} hoist=${r.hoist} mentionable=${r.mentionable}`);
  }
  console.log("\nchannels:");
  const cats = channels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
  const print = (c: any, indent: string) =>
    console.log(`${indent}[${TYPES[c.type] ?? c.type}] ${c.name} (${c.id}) pos=${c.position}${c.topic ? ` topic="${String(c.topic).slice(0, 60)}"` : ""}${c.permission_overwrites?.length ? ` overwrites=${c.permission_overwrites.length}` : ""}`);
  for (const c of channels.filter((c) => !c.parent_id && c.type !== 4)) print(c, "");
  for (const cat of cats) {
    print(cat, "");
    for (const c of channels.filter((x) => x.parent_id === cat.id).sort((a, b) => a.position - b.position)) print(c, "   ");
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

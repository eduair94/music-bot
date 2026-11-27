import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

/**
 * Auth.js configuration for Discord OAuth
 *
 * Scopes:
 * - identify: Basic user info (username, avatar)
 * - guilds: List of guilds the user is in
 * - email: User's email address
 * - guilds.join: add the user to the Bypass support server, once, at sign-in
 *   (Discord's consent screen shows it as "Join servers for you")
 */
const DISCORD_SCOPES ="identify guilds email guilds.join";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true, // Trust the host (required for production behind proxies)
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      // Discord now returns `iss` on the OAuth callback (RFC 9207). Without an
      // issuer, Auth.js checks it against "https://authjs.dev" and every
      // sign-in fails with error=Configuration.
      issuer: "https://discord.com",
      authorization: {
        params: {
          scope: DISCORD_SCOPES,
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token and discord user ID to the token
      if (account) {
        token.accessToken = account.access_token;
        token.discordId = (profile as { id?: string })?.id ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string;
      session.user.discordId = token.discordId as string;
      return session;
    },
  },
  events: {
    // Auth.js awaits events, so the join is started and left running: sign-in
    // never waits on Mongo or Discord for it.
    signIn({ account, profile }) {
      if (account?.provider !== "discord" || !account.access_token) return;
      // The middleware imports this file on the edge runtime, where sign-ins never
      // happen. NEXT_RUNTIME is a build-time constant there, so this branch (and
      // mongoose with it) is dropped from the edge bundle; keep it a plain `if`.
      if (process.env.NEXT_RUNTIME !== "edge") {
        const discordId = account.providerAccountId || (profile as { id?: string } | undefined)?.id;
        const accessToken = account.access_token;
        const scope = typeof account.scope === "string" ? account.scope : null;
        void import("./lib/support-join")
          .then(({ joinSupportServerOnce }) => joinSupportServerOnce({ discordId, accessToken, scope }))
          .catch(() => undefined);
      }
    },
  },
  pages: {
    signIn: "/login",
    // Failed sign-ins come back to the login page with ?error= instead of
    // Auth.js's unbranded error screen.
    error: "/login",
  },
});

import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

/**
 * Auth.js configuration for Discord OAuth
 * 
 * Scopes:
 * - identify: Basic user info (username, avatar)
 * - guilds: List of guilds the user is in
 * - email: User's email address
 */
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
          scope: "identify guilds email",
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
  pages: {
    signIn: "/login",
    // Failed sign-ins come back to the login page with ?error= instead of
    // Auth.js's unbranded error screen.
    error: "/login",
  },
});

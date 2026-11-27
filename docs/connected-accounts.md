# Connected music accounts (Spotify, YouTube)

Users connect their own Spotify and YouTube accounts on the dashboard, under
**Profile → Connections** (`/profile#connections`). Once connected, the bot's
`/library` command can play their private playlists and liked songs.

## How it works

- The dashboard runs the OAuth flow, because it owns the public redirect URL.
  - `GET /api/connect/<provider>` starts it: it signs a CSRF `state` tied to the
    Discord user, keeps it in a 10-minute httpOnly cookie, and redirects to the
    provider's consent screen.
  - `GET /api/connect/<provider>/callback` checks that state, exchanges the code,
    reads the account name, and stores the account.
  - `DELETE /api/connect/<provider>` disconnects. For YouTube it also revokes the
    grant at Google. Spotify has no revoke API; users can remove Bypass at
    <https://www.spotify.com/account/apps/>.
  - `GET /api/connect` lists the signed-in user's connections. It never
    returns tokens.
- Each connected account is one document per (Discord user, provider) in the
  Mongo collection `linkedaccounts`, unique on `{ userId, provider }`. Access
  and refresh tokens are encrypted with AES-256-GCM using `LINKED_ACCOUNTS_KEY`.
- The bot reads those documents and refreshes access tokens as they expire.
  So the bot and the dashboard need the same Mongo database, the same OAuth
  client credentials and the same `LINKED_ACCOUNTS_KEY`.
- The shared code is `shared/linkedAccounts.ts` (provider config, safe to use
  in the browser) and `shared/linkedAccountsServer.ts` (crypto and OAuth calls,
  server only).

Redirect URIs come from the dashboard's public site URL (`SITE_URL` in
`dashboard/src/lib/site.ts`: `NEXT_PUBLIC_SITE_URL`, which defaults to
`https://music-bot.checkleaked.com`), never from `NEXTAUTH_URL`. Next.js
inlines `NEXT_PUBLIC_*` values at build time.

## Owner setup

### 1. Encryption key

Generate one long random string and put it in **both** `.env` files:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

If you change this key later, every stored token becomes unreadable and every
user has to connect again.

### 2. Spotify app

1. Open <https://developer.spotify.com/dashboard>. Create an app, or reuse the
   one behind `DP_SPOTIFY_CLIENT_ID`; adding a redirect URI doesn't affect the
   bot's existing client-credentials search. Tick **Web API**.
2. Under **Redirect URIs**, add exactly:
   `https://music-bot.checkleaked.com/api/connect/spotify/callback`
3. Copy the Client ID and Client secret into `SPOTIFY_OAUTH_CLIENT_ID` and
   `SPOTIFY_OAUTH_CLIENT_SECRET`. If those are unset, the code uses
   `DP_SPOTIFY_CLIENT_ID` and `DP_SPOTIFY_CLIENT_SECRET` instead.
4. **Development mode** is where every new app starts. In development mode:
   - Only accounts you add by hand can connect, up to **5** of them. Add each
     one under the app's **Settings → User Management** (name and the email of
     their Spotify account).
   - The app owner's own Spotify account must have **Premium**, or the app
     doesn't work.
   - For anyone else, Spotify accepts the consent but then answers 403 on
     `/v1/me`. The dashboard shows them "not on the allowlist" (see the
     `not_allowlisted` code below) and asks them to request access in the
     support server.
5. **Extended quota mode**, which lifts the user limit, has been open only to
   organizations since 2025-05-15. You need a legally registered business, a
   launched service, and at least 250k monthly active users. Until then,
   access stays limited to the allowlist.

Scopes requested: `playlist-read-private`, `playlist-read-collaborative`,
`user-library-read`, `user-read-private`.

### 3. Google Cloud OAuth client (YouTube)

1. In <https://console.cloud.google.com/>, pick or create a project, then go to
   **APIs & Services → Library** and enable **YouTube Data API v3**.
2. Set up the **OAuth consent screen** (Google Auth Platform):
   - User type: **External**.
   - App name "Bypass", a support email, home page
     `https://music-bot.checkleaked.com`, privacy policy
     `https://music-bot.checkleaked.com/privacy`, terms
     `https://music-bot.checkleaked.com/terms`, authorized domain
     `checkleaked.com`.
   - **Data access**: add the scope
     `https://www.googleapis.com/auth/youtube.readonly`.
3. Go to **Credentials → Create credentials → OAuth client ID** and choose
   type **Web application**. Under **Authorized redirect URIs**, add exactly:
   `https://music-bot.checkleaked.com/api/connect/youtube/callback`
4. Copy the client ID and secret into `GOOGLE_OAUTH_CLIENT_ID` and
   `GOOGLE_OAUTH_CLIENT_SECRET`.
5. Publishing status and verification:
   - **Testing**: only the test users you list can connect, and Google makes
     their refresh tokens expire after 7 days. That breaks `/library` every
     week, so use Testing only to try the flow.
   - **In production, unverified**: anyone can connect, but they see Google's
     "unverified app" warning. `youtube.readonly` is a sensitive scope, so an
     unverified app is also capped at **100 users**.
   - **Verification** removes the warning and the cap. Google asks for proof
     that you own the domain (Search Console), the privacy policy, a short
     video of the consent flow showing how the scope is used, and a
     justification for the scope. It can take days to weeks.
6. The YouTube Data API has a default quota of 10,000 units a day. Listing
   playlists and liked videos costs about 1 unit per page.

The consent URL asks for `access_type=offline` and `prompt=consent`, so Google
returns a refresh token on every connect.

### 4. Environment

Put the same five values in both the bot's `.env` and the dashboard's `.env`:

```
LINKED_ACCOUNTS_KEY=
SPOTIFY_OAUTH_CLIENT_ID=
SPOTIFY_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

Both services must also point at the same Mongo database (`MONGODB_URI`),
because the bot reads the documents the dashboard writes. Restart both after
changing these values.

A provider shows as **Not configured** on the profile page until its client ID,
its client secret and `LINKED_ACCOUNTS_KEY` (16+ characters) are all set.

### 5. Check it

1. Open `/profile#connections` while signed in. Both providers should show a
   **Connect** button, not "Not configured".
2. Connect. You should come back to the profile page with a "connected" notice,
   and `GET /api/connect` should show `"connected": true`.
3. Disconnect. The row goes back to "Not connected", and the document is gone
   from `linkedaccounts`.

## Errors users can see

The callback returns to `/profile?connectError=<code>&provider=<p>#connections`:

| Code | Meaning |
| --- | --- |
| `denied` | The user cancelled on the consent screen. |
| `not_allowlisted` | The Spotify app is in development mode and this account isn't on its allowlist (403 from `/v1/me`). |
| `no_refresh_token` | The provider sent no refresh token, and none is stored for that same account. The user should remove Bypass from the provider's connected apps and connect again. |
| `state` | The CSRF state was missing, didn't match the cookie, had a bad signature, was older than 10 minutes, or belonged to another Discord user. |
| `not_configured` | The provider was turned off between the click and the callback. |
| `failed` | Anything else: the token exchange, the profile call, or the database. The dashboard log has a `[connect]` line with the provider's status and error code. Tokens and codes are never logged. |

## Testing locally

The redirect URI has to match the origin you browse on, and the state cookie is
only sent back to that same origin. To test the flow on your machine:

1. Start `next dev` with `NEXT_PUBLIC_SITE_URL` set to your local origin.
2. Register a matching redirect URI on the app you're testing:
   - Spotify no longer accepts `localhost`. Use the loopback IP, for example
     `http://127.0.0.1:4123/api/connect/spotify/callback`, and browse on
     `http://127.0.0.1:4123`.
   - Google web clients accept `http://localhost:4123/api/connect/youtube/callback`.

The state cookie is `Secure`. Chrome and Firefox accept it on loopback over
plain http; Safari doesn't.

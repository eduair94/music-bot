/**
 * Privacy Policy Page
 *
 * Displays the privacy policy for Bypass Discord Music Bot
 */

import CookieSettingsButton from "@/components/analytics/CookieSettingsButton";
import { ANALYTICS_ENABLED } from "@/lib/analytics/config";
import { Metadata } from "next";

const description =
  "How Bypass collects, uses, and protects data from Discord servers and users, what the website measures and which cookies it sets, what is stored, for how long, and how to request deletion.";

const linkClass = "text-amber underline underline-offset-2 transition-colors hover:text-amber-hot";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { title: "Bypass Privacy Policy", description, url: "/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-18">
      <section className="py-16 lg:py-24">
        <div className="shell">
          <article className="max-w-3xl legal">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4 text-balance">
              Privacy Policy
            </h1>
            <p className="text-dune mb-10">
              Last updated: <time dateTime="2026-11-28">November 28, 2026</time>
            </p>

            <section aria-labelledby="p1">
              <h2 id="p1">1. Introduction</h2>
              <p>
                Welcome to Bypass Discord Music Bot (&quot;the Bot&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
                We are committed to protecting your privacy and ensuring transparency about how we handle your data.
                This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.
              </p>
            </section>

            <section aria-labelledby="p2">
              <h2 id="p2">2. Information We Collect</h2>
              <p>We collect the minimum data needed to provide our services:</p>
              <ul>
                <li><strong>Discord User IDs:</strong> to identify users and store preferences</li>
                <li><strong>Discord Server IDs:</strong> to store server-specific settings and configuration</li>
                <li><strong>Command usage data:</strong> to improve our services and track feature usage</li>
                <li><strong>Music playback history:</strong> stored temporarily to power history and recently played</li>
                <li><strong>User playlists and collections:</strong> created and saved by users voluntarily</li>
                <li><strong>Premium status:</strong> information about Patreon subscriptions for premium features</li>
                <li>
                  <strong>Support server join:</strong> when you sign in to the dashboard, Discord&apos;s &ldquo;Join servers for
                  you&rdquo; permission lets us add you to the Bypass support server once; we record that we did so we never add
                  you again after you leave
                </li>
                <li>
                  <strong>Private bot tokens:</strong> if you link your own bot (Premium), its token is stored encrypted and used
                  only to run that bot; unlinking deletes it
                </li>
                <li>
                  <strong>Website analytics, invite attribution and feedback:</strong> described in sections 7, 8 and 9
                </li>
              </ul>
            </section>

            <section aria-labelledby="p3">
              <h2 id="p3">3. How We Use Your Information</h2>
              <p>We use the collected information to:</p>
              <ul>
                <li>Provide and maintain the Bot&apos;s functionality</li>
                <li>Store your preferences and settings</li>
                <li>Enable features like playlists, history, and personalized profiles</li>
                <li>Process premium subscriptions and provide premium features</li>
                <li>Improve our services and develop new features</li>
                <li>Respond to support requests</li>
              </ul>
            </section>

            <section aria-labelledby="p4">
              <h2 id="p4">4. Data Storage and Security</h2>
              <p>
                Your data is stored using industry-standard encryption and security practices.
                We use MongoDB for data storage and Redis for caching. Access to data is restricted to
                authorized personnel only. We do not sell, trade, or rent your personal information to third parties.
              </p>
            </section>

            <section aria-labelledby="p5">
              <h2 id="p5">5. Data Retention</h2>
              <p>
                We retain your data for as long as necessary to provide our services.
                Playback history is retained for a limited period (typically 30 days).
                User-created playlists and settings are retained until you delete them or request data deletion.
                If you remove the bot from your server, server-specific data may be retained for up to 90 days
                before automatic deletion.
              </p>
            </section>

            <section aria-labelledby="p6">
              <h2 id="p6">6. Third-Party Services</h2>
              <p>Our Bot integrates with third-party services including:</p>
              <ul>
                <li><strong>Discord:</strong> core platform for bot functionality</li>
                <li><strong>YouTube:</strong> music playback and search</li>
                <li><strong>Spotify:</strong> music search and playlist import</li>
                <li><strong>SoundCloud:</strong> music playback</li>
                <li><strong>Patreon:</strong> premium subscription management</li>
                <li><strong>Lyrics providers:</strong> lyrics and song information</li>
                <li><strong>Google Analytics and Microsoft Clarity:</strong> website analytics (section 7)</li>
                <li><strong>Cloudflare:</strong> delivers the website and tells us each visitor&apos;s country</li>
              </ul>
              <p>These services have their own privacy policies, and we encourage you to review them.</p>
            </section>

            <section id="cookies" aria-labelledby="p7">
              <h2 id="p7">7. Website Analytics and Cookies</h2>
              <p>
                The website (music-bot.checkleaked.com, including the dashboard) uses two analytics tools to learn which pages
                help people find and use Bypass. The bot in Discord does not use them. Visits by the site owner are tagged and
                excluded from the reports.
              </p>
              <ul>
                <li>
                  <strong>Google Analytics 4:</strong> the pages you visit, clicks on key links (Add to Discord, the support server,
                  Patreon, bot-list votes), your device and browser, and your approximate location. Google Analytics 4 does not
                  store IP addresses. Cookies: <code>_ga</code> and <code>_ga_&lt;id&gt;</code>, kept up to 2 years. When you are
                  signed in to the dashboard we also send a random code derived from your account, so visits from your devices
                  count as one person; it is never your Discord ID, name or email. See{" "}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
                    Google&apos;s privacy policy<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  .
                </li>
                <li>
                  <strong>Microsoft Clarity:</strong> session replays and heatmaps of how the site is used (scrolling, clicks,
                  where the pointer moves). Text typed into form fields is masked, and so is the name and avatar of a signed-in
                  user. Cookies: <code>_clck</code> (1 year), <code>_clsk</code> (1 day) and <code>CLID</code> (1 year, on
                  Clarity&apos;s own domain). See the{" "}
                  <a href="https://www.microsoft.com/privacy/privacystatement" target="_blank" rel="noopener noreferrer" className={linkClass}>
                    Microsoft Privacy Statement<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  .
                </li>
                <li>
                  <strong>
                    First-touch cookie <code>bp_ft</code> (90 days):
                  </strong>{" "}
                  where you first came from (the campaign tag or the website that linked to us, and the first page you opened), so
                  a later &ldquo;Add to Discord&rdquo; click is credited to that source. It is only set when analytics is allowed.
                </li>
              </ul>
              <p>
                <strong>Your choice.</strong> Visitors from the European Economic Area, the United Kingdom and Switzerland are
                asked first. Until they accept, Google Analytics runs in its cookieless consent mode and Clarity does not set
                cookies. To know whether to ask, we read your country from Cloudflare and remember it in your browser for 30
                days (<code>bp_geo</code>). Your answer is stored in your browser too (<code>bp_consent</code>). You can change
                it at any time with &ldquo;Cookie settings&rdquo; in the footer; rejecting removes the analytics cookies this
                site set.
              </p>
              {ANALYTICS_ENABLED ? (
                <p>
                  <CookieSettingsButton className={`${linkClass} font-semibold`} />
                </p>
              ) : null}
            </section>

            <section aria-labelledby="p8">
              <h2 id="p8">8. Invite Attribution</h2>
              <p>
                When you click &ldquo;Add to Discord&rdquo; on the website, we record the link&apos;s source code and campaign,
                your Google Analytics client ID (only if analytics cookies are allowed) and your country (from Cloudflare).
                These click records are kept for at most 30 days; daily totals per source are kept for 120 days.
              </p>
              <p>
                When the bot joins a server, we store which source it came from together with the server data we already keep
                (server ID, name and member count), and send an anonymous &ldquo;bot added&rdquo; event to Google Analytics.
              </p>
            </section>

            <section aria-labelledby="p9">
              <h2 id="p9">9. Feedback</h2>
              <p>
                When you send feedback through the website&apos;s feedback form, the satisfaction survey (NPS) or{" "}
                <code>/feedback</code> in Discord, we store the message, the contact details you choose to add (optional),
                whether we may quote it publicly, your Discord ID and username when you are signed in or send it from Discord,
                the page or command it was sent from, and your country. Feedback is forwarded to a private staff channel in our
                Discord support server, kept until it is handled, and deleted on request. If you allow quoting, we may show
                the message on the Bypass website without your username or server name; we take it down when you ask.
              </p>
            </section>

            <section aria-labelledby="p10">
              <h2 id="p10">10. Your Rights</h2>
              <p>You have the right to:</p>
              <ul>
                <li>Access your personal data stored by the Bot</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Opt out of data collection where applicable, including website analytics (&ldquo;Cookie settings&rdquo;)</li>
              </ul>
              <p>To exercise these rights, contact us through our Discord support server.</p>
            </section>

            <section aria-labelledby="p11">
              <h2 id="p11">11. Children&apos;s Privacy</h2>
              <p>
                Our Bot is not intended for users under the age of 13. We do not knowingly collect
                personal information from children under 13. If you believe we have collected such
                information, please contact us immediately.
              </p>
            </section>

            <section aria-labelledby="p12">
              <h2 id="p12">12. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify users of any
                significant changes through our Discord support server or the Bot itself.
                Continued use of the Bot after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section aria-labelledby="p13">
              <h2 id="p13">13. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy or our data practices,
                contact us through our Discord support server or open an issue on our GitHub repository.
              </p>
            </section>
          </article>
        </div>
      </section>
    </div>
  );
}

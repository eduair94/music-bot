/**
 * Privacy Policy Page
 *
 * Displays the privacy policy for Bypass Discord Music Bot
 */

import { Metadata } from "next";

const description =
  "How Bypass collects, uses, and protects data from Discord servers and users, what is stored, for how long, and how to request deletion.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { title: "Bypass Privacy Policy", description, url: "/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-20">
      <section className="py-16 bg-coal">
        <article className="container mx-auto px-4 max-w-3xl legal">
          <p className="console-label text-amber! mb-4">Legal</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4 text-balance">
            Privacy Policy
          </h1>
          <p className="text-dune mb-10">
            Last updated: <time dateTime="2026-01">January 2026</time>
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
            </ul>
            <p>These services have their own privacy policies, and we encourage you to review them.</p>
          </section>

          <section aria-labelledby="p7">
            <h2 id="p7">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal data stored by the Bot</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of data collection where applicable</li>
            </ul>
            <p>To exercise these rights, contact us through our Discord support server.</p>
          </section>

          <section aria-labelledby="p8">
            <h2 id="p8">8. Children&apos;s Privacy</h2>
            <p>
              Our Bot is not intended for users under the age of 13. We do not knowingly collect
              personal information from children under 13. If you believe we have collected such
              information, please contact us immediately.
            </p>
          </section>

          <section aria-labelledby="p9">
            <h2 id="p9">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of any
              significant changes through our Discord support server or the Bot itself.
              Continued use of the Bot after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section aria-labelledby="p10">
            <h2 id="p10">10. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices,
              contact us through our Discord support server or open an issue on our GitHub repository.
            </p>
          </section>
        </article>
      </section>
    </div>
  );
}

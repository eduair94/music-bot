/**
 * Terms of Service Page
 *
 * Displays the terms of service for Bypass Discord Music Bot
 */

import { Metadata } from "next";

const description =
  "Terms of Service for the Bypass Discord music bot: acceptable use, premium subscriptions via Patreon, user content, and liability.";

export const metadata: Metadata = {
  title: "Terms of Service",
  description,
  alternates: { canonical: "/terms" },
  openGraph: { title: "Bypass Terms of Service", description, url: "/terms" },
};

export default function TermsOfServicePage() {
  return (
    <div className="pt-20">
      <section className="py-16 bg-coal">
        <article className="container mx-auto px-4 max-w-3xl legal">
          <p className="console-label text-amber! mb-4">Legal</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4 text-balance">
            Terms of Service
          </h1>
          <p className="text-dune mb-10">
            Last updated: <time dateTime="2026-01">January 2026</time>
          </p>

          <section aria-labelledby="t1">
            <h2 id="t1">1. Acceptance of Terms</h2>
            <p>
              By inviting Bypass Discord Music Bot (&quot;the Bot&quot;) to your Discord server or using its features,
              you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms,
              please do not use the Bot.
            </p>
          </section>

          <section aria-labelledby="t2">
            <h2 id="t2">2. Description of Service</h2>
            <p>
              Bypass is a Discord music bot that provides music playback, queue management, audio filters,
              and various utility features. The Bot allows users to play music from platforms like YouTube,
              Spotify, and SoundCloud within Discord voice channels.
            </p>
          </section>

          <section aria-labelledby="t3">
            <h2 id="t3">3. Eligibility</h2>
            <p>
              You must be at least 13 years old to use the Bot. By using the Bot, you represent that you
              meet this age requirement and have the authority to agree to these Terms. If you are using
              the Bot on behalf of an organization, you represent that you have the authority to bind that
              organization to these Terms.
            </p>
          </section>

          <section aria-labelledby="t4">
            <h2 id="t4">4. Acceptable Use</h2>
            <p>
              You agree to use the Bot in accordance with Discord&apos;s Terms of Service and Community Guidelines.
              You must not:
            </p>
            <ul>
              <li>Use the Bot for any illegal or unauthorized purpose</li>
              <li>Attempt to exploit, hack, or disrupt the Bot&apos;s services</li>
              <li>Use automated systems or scripts to abuse the Bot</li>
              <li>Attempt to circumvent rate limits or restrictions</li>
              <li>Use the Bot to harass, spam, or harm other users</li>
              <li>Violate intellectual property rights or third-party platforms&apos; terms of service</li>
              <li>Share or distribute content that is illegal, harmful, or inappropriate</li>
              <li>Resell or commercially exploit the Bot&apos;s services without authorization</li>
            </ul>
          </section>

          <section aria-labelledby="t5">
            <h2 id="t5">5. Premium Services</h2>
            <p>Bypass offers premium features through Patreon subscriptions. By subscribing to premium:</p>
            <ul>
              <li>You agree to Patreon&apos;s Terms of Service</li>
              <li>Premium features are provided &quot;as is&quot; and may change over time</li>
              <li>Refunds are subject to Patreon&apos;s refund policy</li>
              <li>Premium benefits apply to linked servers only</li>
              <li>We reserve the right to revoke premium access for Terms violations</li>
            </ul>
          </section>

          <section aria-labelledby="t6">
            <h2 id="t6">6. User Content</h2>
            <p>
              You retain ownership of content you create using the Bot (such as playlists and collections).
              However, by creating content, you grant us a license to store and display that content as
              necessary to provide our services. You are responsible for ensuring you have the right to
              use any music or content you play through the Bot.
            </p>
          </section>

          <section aria-labelledby="t7">
            <h2 id="t7">7. Intellectual Property</h2>
            <p>
              The Bot, including its code, design, and features, is the intellectual property of the
              development team. The Bot is open source under its respective license. Music content
              played through the Bot belongs to its respective copyright holders. We do not claim
              ownership of any third-party content.
            </p>
          </section>

          <section aria-labelledby="t8">
            <h2 id="t8">8. Third-Party Services</h2>
            <p>
              The Bot integrates with third-party services (Discord, YouTube, Spotify, SoundCloud, etc.).
              Your use of these services is subject to their respective terms of service. We are not
              responsible for the availability, content, or policies of these third-party services.
            </p>
          </section>

          <section aria-labelledby="t9">
            <h2 id="t9">9. Disclaimer of Warranties</h2>
            <p>
              THE BOT IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE BOT WILL BE UNINTERRUPTED,
              SECURE, OR ERROR-FREE. WE ARE NOT RESPONSIBLE FOR ANY INTERRUPTIONS, DELAYS, OR
              PERFORMANCE ISSUES.
            </p>
          </section>

          <section aria-labelledby="t10">
            <h2 id="t10">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED
              TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH
              YOUR USE OF THE BOT.
            </p>
          </section>

          <section aria-labelledby="t11">
            <h2 id="t11">11. Modifications to Service</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue the Bot (or any part of it)
              at any time with or without notice. We may also update features, add new features,
              or remove existing features at our discretion.
            </p>
          </section>

          <section aria-labelledby="t12">
            <h2 id="t12">12. Termination</h2>
            <p>
              We reserve the right to terminate or restrict your access to the Bot at any time,
              for any reason, including but not limited to violation of these Terms. Upon termination,
              your right to use the Bot will immediately cease.
            </p>
          </section>

          <section aria-labelledby="t13">
            <h2 id="t13">13. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify users of significant
              changes through our Discord support server or the Bot. Continued use of the Bot
              after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section aria-labelledby="t14">
            <h2 id="t14">14. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws,
              without regard to conflict of law principles.
            </p>
          </section>

          <section aria-labelledby="t15">
            <h2 id="t15">15. Contact</h2>
            <p>
              If you have any questions about these Terms of Service, contact us through
              our Discord support server or open an issue on our GitHub repository.
            </p>
          </section>
        </article>
      </section>
    </div>
  );
}

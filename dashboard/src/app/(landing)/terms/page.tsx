/**
 * Terms of Service Page
 * 
 * Displays the terms of service for Bypass Discord Music Bot
 */

import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Bypass Discord Music Bot",
  description: "Terms of Service for Bypass Discord Music Bot. Read the rules and guidelines for using our bot.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen">
      <Header />
      {/* Spacer for fixed header */}
      <div className="h-20" />
      
      <section className="py-16 bg-[#0f0f23]">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8 gradient-text">Terms of Service</h1>
          <p className="text-gray-400 mb-8">Last updated: January 2026</p>

          <div className="prose prose-invert prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                By inviting Bypass Discord Music Bot (&quot;the Bot&quot;) to your Discord server or using its features, 
                you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, 
                please do not use the Bot.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p className="text-gray-300 leading-relaxed">
                Bypass is a Discord music bot that provides music playback, queue management, audio filters, 
                and various utility features. The Bot allows users to play music from platforms like YouTube, 
                Spotify, and SoundCloud within Discord voice channels.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Eligibility</h2>
              <p className="text-gray-300 leading-relaxed">
                You must be at least 13 years old to use the Bot. By using the Bot, you represent that you 
                meet this age requirement and have the authority to agree to these Terms. If you are using 
                the Bot on behalf of an organization, you represent that you have the authority to bind that 
                organization to these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Acceptable Use</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                You agree to use the Bot in accordance with Discord&apos;s Terms of Service and Community Guidelines. 
                You must not:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
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

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Premium Services</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                Bypass offers premium features through Patreon subscriptions. By subscribing to premium:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>You agree to Patreon&apos;s Terms of Service</li>
                <li>Premium features are provided &quot;as is&quot; and may change over time</li>
                <li>Refunds are subject to Patreon&apos;s refund policy</li>
                <li>Premium benefits apply to linked servers only</li>
                <li>We reserve the right to revoke premium access for Terms violations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. User Content</h2>
              <p className="text-gray-300 leading-relaxed">
                You retain ownership of content you create using the Bot (such as playlists and collections). 
                However, by creating content, you grant us a license to store and display that content as 
                necessary to provide our services. You are responsible for ensuring you have the right to 
                use any music or content you play through the Bot.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Intellectual Property</h2>
              <p className="text-gray-300 leading-relaxed">
                The Bot, including its code, design, and features, is the intellectual property of the 
                development team. The Bot is open source under its respective license. Music content 
                played through the Bot belongs to their respective copyright holders. We do not claim 
                ownership of any third-party content.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Third-Party Services</h2>
              <p className="text-gray-300 leading-relaxed">
                The Bot integrates with third-party services (Discord, YouTube, Spotify, SoundCloud, etc.). 
                Your use of these services is subject to their respective terms of service. We are not 
                responsible for the availability, content, or policies of these third-party services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Disclaimer of Warranties</h2>
              <p className="text-gray-300 leading-relaxed">
                THE BOT IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, 
                EITHER EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE BOT WILL BE UNINTERRUPTED, 
                SECURE, OR ERROR-FREE. WE ARE NOT RESPONSIBLE FOR ANY INTERRUPTIONS, DELAYS, OR 
                PERFORMANCE ISSUES.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">10. Limitation of Liability</h2>
              <p className="text-gray-300 leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED 
                TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH 
                YOUR USE OF THE BOT.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">11. Modifications to Service</h2>
              <p className="text-gray-300 leading-relaxed">
                We reserve the right to modify, suspend, or discontinue the Bot (or any part of it) 
                at any time with or without notice. We may also update features, add new features, 
                or remove existing features at our discretion.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">12. Termination</h2>
              <p className="text-gray-300 leading-relaxed">
                We reserve the right to terminate or restrict your access to the Bot at any time, 
                for any reason, including but not limited to violation of these Terms. Upon termination, 
                your right to use the Bot will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">13. Changes to Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                We may update these Terms from time to time. We will notify users of significant 
                changes through our Discord support server or the Bot. Continued use of the Bot 
                after changes constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">14. Governing Law</h2>
              <p className="text-gray-300 leading-relaxed">
                These Terms shall be governed by and construed in accordance with applicable laws, 
                without regard to conflict of law principles.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">15. Contact</h2>
              <p className="text-gray-300 leading-relaxed">
                If you have any questions about these Terms of Service, please contact us through 
                our Discord support server or by opening an issue on our GitHub repository.
              </p>
            </section>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

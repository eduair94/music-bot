/**
 * Privacy Policy Page
 * 
 * Displays the privacy policy for Bypass Discord Music Bot
 */

import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Bypass Discord Music Bot",
  description: "Privacy Policy for Bypass Discord Music Bot. Learn how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen">
      <Header />
      {/* Spacer for fixed header */}
      <div className="h-20" />
      
      <section className="py-16 bg-coal">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8 text-amber font-display">Privacy Policy</h1>
          <p className="text-dune mb-8">Last updated: January 2026</p>

          <div className="prose prose-invert prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-cream mb-4">1. Introduction</h2>
              <p className="text-gray-300 leading-relaxed">
                Welcome to Bypass Discord Music Bot (&quot;the Bot&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). 
                We are committed to protecting your privacy and ensuring transparency about how we handle your data. 
                This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-cream mb-4">2. Information We Collect</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We collect minimal data necessary to provide our services:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li><strong>Discord User IDs:</strong> To identify users and store preferences</li>
                <li><strong>Discord Server IDs:</strong> To store server-specific settings and configurations</li>
                <li><strong>Command Usage Data:</strong> To improve our services and track feature usage</li>
                <li><strong>Music Playback History:</strong> Temporarily stored to enable features like history and recently played</li>
                <li><strong>User Playlists/Collections:</strong> Created and saved by users voluntarily</li>
                <li><strong>Premium Status:</strong> Information about Patreon subscriptions for premium features</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-cream mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We use the collected information to:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Provide and maintain the Bot&apos;s functionality</li>
                <li>Store your preferences and settings</li>
                <li>Enable features like playlists, history, and personalized profiles</li>
                <li>Process premium subscriptions and provide premium features</li>
                <li>Improve our services and develop new features</li>
                <li>Respond to support requests</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-cream mb-4">4. Data Storage and Security</h2>
              <p className="text-gray-300 leading-relaxed">
                Your data is stored securely using industry-standard encryption and security practices. 
                We use MongoDB for data storage and Redis for caching. Access to data is restricted to 
                authorized personnel only. We do not sell, trade, or rent your personal information to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-cream mb-4">5. Data Retention</h2>
              <p className="text-gray-300 leading-relaxed">
                We retain your data for as long as necessary to provide our services. 
                Playback history is retained for a limited period (typically 30 days). 
                User-created playlists and settings are retained until you delete them or request data deletion.
                If you remove the bot from your server, server-specific data may be retained for up to 90 days 
                before automatic deletion.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-cream mb-4">6. Third-Party Services</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                Our Bot integrates with third-party services including:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li><strong>Discord:</strong> Core platform for bot functionality</li>
                <li><strong>YouTube:</strong> Music playback and search</li>
                <li><strong>Spotify:</strong> Music search and playlist import</li>
                <li><strong>SoundCloud:</strong> Music playback</li>
                <li><strong>Patreon:</strong> Premium subscription management</li>
                <li><strong>Genius:</strong> Lyrics and song information</li>
              </ul>
              <p className="text-gray-300 leading-relaxed mt-4">
                These services have their own privacy policies, and we encourage you to review them.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-cream mb-4">7. Your Rights</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                You have the right to:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Access your personal data stored by the Bot</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Opt out of data collection where applicable</li>
              </ul>
              <p className="text-gray-300 leading-relaxed mt-4">
                To exercise these rights, please contact us through our Discord support server.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-cream mb-4">8. Children&apos;s Privacy</h2>
              <p className="text-gray-300 leading-relaxed">
                Our Bot is not intended for users under the age of 13. We do not knowingly collect 
                personal information from children under 13. If you believe we have collected such 
                information, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-cream mb-4">9. Changes to This Policy</h2>
              <p className="text-gray-300 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify users of any 
                significant changes through our Discord support server or the Bot itself. 
                Continued use of the Bot after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-cream mb-4">10. Contact Us</h2>
              <p className="text-gray-300 leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, 
                please contact us through our Discord support server or by opening an issue 
                on our GitHub repository.
              </p>
            </section>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

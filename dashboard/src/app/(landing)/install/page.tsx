/**
 * Installation Guide Page
 * 
 * Step-by-step guide for self-hosting Bypass Discord Music Bot
 */

import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import { Metadata } from "next";
import Link from "next/link";
import { FaDiscord, FaDocker, FaGithub, FaNodeJs } from "react-icons/fa";
import { SiMongodb, SiRedis, SiTypescript } from "react-icons/si";

export const metadata: Metadata = {
  title: "Installation Guide - Bypass Discord Music Bot",
  description: "Learn how to self-host Bypass Discord Music Bot. Step-by-step installation guide with Docker and Node.js options.",
};

function StepNumber({ number }: { number: number }) {
  return (
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#5865f2] to-[#eb459e] flex items-center justify-center text-white font-bold text-lg">
      {number}
    </div>
  );
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-xl overflow-hidden bg-[#1a1a2e] border border-white/10">
      {title && (
        <div className="px-4 py-2 bg-white/5 border-b border-white/10 text-sm text-gray-400">
          {title}
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="text-green-400">{children}</code>
      </pre>
    </div>
  );
}

function RequirementCard({ icon, title, description, link }: { icon: React.ReactNode; title: string; description: string; link?: string }) {
  const content = (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2]">
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-white mb-1">{title}</h4>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </div>
  );

  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return content;
}

export default function InstallationPage() {
  return (
    <main className="min-h-screen">
      <Header />
      {/* Spacer for fixed header */}
      <div className="h-20" />
      
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e]">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#5865f2]/20 rounded-full border border-[#5865f2]/30 mb-6">
            <FaGithub className="w-4 h-4 text-[#5865f2]" />
            <span className="text-sm text-[#5865f2]">Open Source</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 gradient-text">Installation Guide</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Self-host your own instance of Bypass Discord Music Bot. Follow this step-by-step guide to get started.
          </p>
        </div>
      </section>

      {/* Requirements Section */}
      <section className="py-16 bg-[#0f0f23]">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2]">📋</span>
            Requirements
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RequirementCard 
              icon={<FaNodeJs className="w-6 h-6" />}
              title="Node.js 16.11+"
              description="JavaScript runtime for running the bot"
              link="https://nodejs.org/"
            />
            <RequirementCard 
              icon={<FaDiscord className="w-6 h-6" />}
              title="Discord Bot Token"
              description="Create a bot in Discord Developer Portal"
              link="https://discord.com/developers/applications"
            />
            <RequirementCard 
              icon={<SiMongodb className="w-6 h-6" />}
              title="MongoDB (Optional)"
              description="Database for persistent settings & playlists"
              link="https://www.mongodb.com/atlas"
            />
            <RequirementCard 
              icon={<SiRedis className="w-6 h-6" />}
              title="Redis (Optional)"
              description="Caching for improved performance"
              link="https://redis.io/"
            />
          </div>

          <div className="mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-yellow-400 text-sm">
              <strong>💡 Tip:</strong> MongoDB and Redis are optional but recommended for production deployments. The bot will work without them using in-memory storage.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Start with Docker */}
      <section className="py-16 bg-[#1a1a2e]">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#2496ed]/20 flex items-center justify-center text-[#2496ed]">
              <FaDocker className="w-5 h-5" />
            </span>
            Quick Start with Docker
            <span className="ml-2 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">Recommended</span>
          </h2>

          <p className="text-gray-400 mb-6">
            The fastest way to get started is using Docker. Just one command and you&apos;re ready to go!
          </p>

          <CodeBlock title="Terminal">
{`docker run -d \\
  -e "TOKEN=your-discord-bot-token" \\
  -e "MONGODB_URI=mongodb://localhost:27017/musicbot" \\
  -e "REDIS_URL=redis://localhost:6379" \\
  --name bypass-bot \\
  eduair94/music-bot`}
          </CodeBlock>

          <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <p className="text-blue-400 text-sm">
              <strong>🐳 Docker Compose:</strong> For a complete setup with MongoDB and Redis, check out our{" "}
              <a href="https://github.com/eduair94/music-bot/blob/main/docker-compose.yml" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-300">
                docker-compose.yml
              </a>{" "}
              file on GitHub.
            </p>
          </div>
        </div>
      </section>

      {/* Manual Installation */}
      <section className="py-16 bg-[#0f0f23]">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2]">
              <SiTypescript className="w-5 h-5" />
            </span>
            Manual Installation
          </h2>

          {/* Step 1 */}
          <div className="mb-10">
            <div className="flex items-start gap-4 mb-4">
              <StepNumber number={1} />
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Clone the Repository</h3>
                <p className="text-gray-400 mb-4">Download the source code from GitHub.</p>
              </div>
            </div>
            <div className="ml-14">
              <CodeBlock>
{`git clone https://github.com/eduair94/music-bot.git
cd music-bot`}
              </CodeBlock>
            </div>
          </div>

          {/* Step 2 */}
          <div className="mb-10">
            <div className="flex items-start gap-4 mb-4">
              <StepNumber number={2} />
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Install Dependencies</h3>
                <p className="text-gray-400 mb-4">Install all required Node.js packages.</p>
              </div>
            </div>
            <div className="ml-14">
              <CodeBlock>npm install</CodeBlock>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-10">
            <div className="flex items-start gap-4 mb-4">
              <StepNumber number={3} />
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Create Discord Bot</h3>
                <p className="text-gray-400 mb-4">Set up your bot application in the Discord Developer Portal.</p>
              </div>
            </div>
            <div className="ml-14 space-y-4">
              <ol className="list-decimal list-inside text-gray-300 space-y-3 bg-white/5 rounded-xl p-6 border border-white/10">
                <li>Go to the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-[#5865f2] hover:underline">Discord Developer Portal</a></li>
                <li>Click <strong>&quot;New Application&quot;</strong> and give it a name</li>
                <li>Go to the <strong>&quot;Bot&quot;</strong> tab and click <strong>&quot;Add Bot&quot;</strong></li>
                <li>Copy the <strong>Bot Token</strong> (keep this secret!)</li>
                <li>Enable <strong>&quot;Message Content Intent&quot;</strong> under Privileged Gateway Intents</li>
                <li>Go to <strong>&quot;OAuth2 &gt; URL Generator&quot;</strong></li>
                <li>Select scopes: <code className="bg-white/10 px-2 py-1 rounded">bot</code> and <code className="bg-white/10 px-2 py-1 rounded">applications.commands</code></li>
                <li>Select bot permissions: <code className="bg-white/10 px-2 py-1 rounded">Administrator</code> (or specific permissions)</li>
                <li>Copy the generated URL and use it to invite the bot to your server</li>
              </ol>
            </div>
          </div>

          {/* Step 4 */}
          <div className="mb-10">
            <div className="flex items-start gap-4 mb-4">
              <StepNumber number={4} />
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Configure the Bot</h3>
                <p className="text-gray-400 mb-4">Create and edit the configuration file with your settings.</p>
              </div>
            </div>
            <div className="ml-14 space-y-4">
              <CodeBlock title="Copy the example config">
{`cp config.json.example config.json`}
              </CodeBlock>
              
              <p className="text-gray-400">Edit <code className="bg-white/10 px-2 py-1 rounded">config.json</code> with your values:</p>
              
              <CodeBlock title="config.json">
{`{
  "TOKEN": "your-discord-bot-token",
  "MONGODB_URI": "mongodb://localhost:27017/musicbot",
  "REDIS_URL": "redis://localhost:6379",
  "MAX_PLAYLIST_SIZE": 100,
  "PRUNING": false,
  "LOCALE": "en",
  "STAY_TIME": 30,
  "DEFAULT_VOLUME": 100,
  "OWNER_ID": "your-discord-user-id"
}`}
              </CodeBlock>
            </div>
          </div>

          {/* Step 5 */}
          <div className="mb-10">
            <div className="flex items-start gap-4 mb-4">
              <StepNumber number={5} />
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Start the Bot</h3>
                <p className="text-gray-400 mb-4">Run the bot and start playing music!</p>
              </div>
            </div>
            <div className="ml-14 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 mb-2 text-sm font-medium">Development Mode</p>
                  <CodeBlock>npm run dev</CodeBlock>
                </div>
                <div>
                  <p className="text-gray-400 mb-2 text-sm font-medium">Production Mode</p>
                  <CodeBlock>npm run start</CodeBlock>
                </div>
              </div>
            </div>
          </div>

          {/* Success Message */}
          <div className="ml-14 p-6 rounded-xl bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🎉</span>
              <h4 className="text-lg font-semibold text-green-400">You&apos;re all set!</h4>
            </div>
            <p className="text-gray-300">
              Your bot should now be online. Use <code className="bg-white/10 px-2 py-1 rounded">/play</code> in your Discord server to start playing music!
            </p>
          </div>
        </div>
      </section>

      {/* Configuration Options */}
      <section className="py-16 bg-[#1a1a2e]">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#5865f2]/20 flex items-center justify-center">⚙️</span>
            Configuration Options
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 px-4 text-gray-400 font-medium">Option</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">Required</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4"><code className="text-green-400">TOKEN</code></td>
                  <td className="py-3 px-4"><span className="text-red-400">Yes</span></td>
                  <td className="py-3 px-4">Your Discord bot token</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4"><code className="text-green-400">MONGODB_URI</code></td>
                  <td className="py-3 px-4"><span className="text-gray-500">No</span></td>
                  <td className="py-3 px-4">MongoDB connection string for persistent storage</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4"><code className="text-green-400">REDIS_URL</code></td>
                  <td className="py-3 px-4"><span className="text-gray-500">No</span></td>
                  <td className="py-3 px-4">Redis URL for caching</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4"><code className="text-green-400">MAX_PLAYLIST_SIZE</code></td>
                  <td className="py-3 px-4"><span className="text-gray-500">No</span></td>
                  <td className="py-3 px-4">Maximum tracks per playlist (default: 100)</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4"><code className="text-green-400">LOCALE</code></td>
                  <td className="py-3 px-4"><span className="text-gray-500">No</span></td>
                  <td className="py-3 px-4">Default language (en, es, fr, de, etc.)</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4"><code className="text-green-400">DEFAULT_VOLUME</code></td>
                  <td className="py-3 px-4"><span className="text-gray-500">No</span></td>
                  <td className="py-3 px-4">Default volume level 0-100 (default: 100)</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4"><code className="text-green-400">STAY_TIME</code></td>
                  <td className="py-3 px-4"><span className="text-gray-500">No</span></td>
                  <td className="py-3 px-4">Seconds to stay in VC after queue ends (default: 30)</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4"><code className="text-green-400">OWNER_ID</code></td>
                  <td className="py-3 px-4"><span className="text-gray-500">No</span></td>
                  <td className="py-3 px-4">Your Discord user ID for owner commands</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Need Help Section */}
      <section className="py-16 bg-[#0f0f23]">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Need Help?</h2>
          <p className="text-gray-400 mb-8">
            Having trouble with the installation? We&apos;re here to help!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/support" 
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl transition-colors font-semibold"
            >
              <FaDiscord className="w-5 h-5" />
              Join Discord Support
            </Link>
            <a 
              href="https://github.com/eduair94/music-bot/issues" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-semibold"
            >
              <FaGithub className="w-5 h-5" />
              Open GitHub Issue
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

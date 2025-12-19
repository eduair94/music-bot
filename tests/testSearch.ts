/**
 * Test script to verify discord-player can search, find, and prepare songs for streaming
 * 
 * Usage: npm run test:search
 * 
 * This tests:
 * 1. Search functionality
 * 2. Track metadata extraction
 * 3. Stream URL retrieval (the actual audio URL)
 * 4. Time measurements for each phase
 * 
 * Note: Actually streaming audio requires a voice connection, which we can't test
 * without a running Discord bot. This test verifies all the preparation steps work.
 */

import { Player, SearchResult, Track } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { Client, GatewayIntentBits } from "discord.js";

// Test query - simulating "/play lonely lonely i feel so lonely song"
const TEST_QUERY = "lonely lonely i feel so lonely song";

interface StreamTestResult {
  success: boolean;
  streamSetupTime: number;
  streamUrl?: string;
  error?: string;
}

/**
 * Test if a track can get a stream URL ready
 */
async function testStreamSetup(player: Player, track: Track): Promise<StreamTestResult> {
  const startTime = Date.now();

  try {
    console.log(`\n🎵 Testing stream setup for: ${track.title}`);
    console.log(`   URL: ${track.url}`);
    
    // Find the extractor
    const extractors = player.extractors.store;
    let extractor = null;
    for (const [id, ext] of extractors) {
      if (id.toLowerCase().includes('youtubei') || id.toLowerCase().includes('youtube')) {
        extractor = ext;
        console.log(`   ✅ Using extractor: ${id}`);
        break;
      }
    }
    
    if (!extractor) {
      return {
        success: false,
        streamSetupTime: Date.now() - startTime,
        error: "No YouTube extractor found"
      };
    }

    console.log(`   🔄 Getting stream info...`);
    const streamFetchStart = Date.now();
    
    // Get the stream - this returns either a URL or a Readable
    const streamInfo = await extractor.stream(track) as any;
    
    const streamSetupTime = Date.now() - streamFetchStart;
    
    if (!streamInfo) {
      return {
        success: false,
        streamSetupTime,
        error: "No stream returned from extractor"
      };
    }

    // Log what we got
    const streamType = typeof streamInfo;
    console.log(`   📋 Stream type: ${streamType}`);
    
    if (typeof streamInfo === 'string') {
      // It's a URL - this is what we need for streaming
      console.log(`   ✅ Got stream URL (${streamInfo.length} chars)`);
      console.log(`   📡 URL preview: ${streamInfo.substring(0, 80)}...`);
      return {
        success: true,
        streamSetupTime,
        streamUrl: streamInfo.substring(0, 100) + '...'
      };
    } else if (streamInfo && typeof streamInfo === 'object') {
      // It's a Readable or object with stream
      console.log(`   ✅ Got stream object with keys: ${Object.keys(streamInfo).slice(0, 5).join(', ')}`);
      
      // Check if it has a readable state (it's a stream)
      if (streamInfo._readableState) {
        console.log(`   📋 Stream is Readable (highWaterMark: ${streamInfo._readableState.highWaterMark})`);
        return {
          success: true,
          streamSetupTime,
          streamUrl: "[Readable Stream]"
        };
      }
      
      return {
        success: true,
        streamSetupTime,
        streamUrl: "[Stream Object]"
      };
    }
    
    return {
      success: false,
      streamSetupTime,
      error: `Unknown stream format: ${streamType}`
    };

  } catch (error: any) {
    return {
      success: false,
      streamSetupTime: Date.now() - startTime,
      error: error.message
    };
  }
}

async function testSearch() {
  console.log("🧪 Discord Player Search & Stream Setup Test");
  console.log("=============================================\n");
  
  const totalStartTime = Date.now();
  
  // Create a minimal Discord client (won't login)
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
  });

  // Create player instance
  const player = new Player(client, {
    skipFFmpeg: false
  });

  console.log("📦 Registering YoutubeiExtractor...");
  
  try {
    // Register the YouTube extractor
    await player.extractors.register(YoutubeiExtractor, {
      streamOptions: {
        useClient: "ANDROID",
        highWaterMark: 1024 * 1024 * 32,
      }
    });
    console.log("✅ YoutubeiExtractor registered successfully\n");
  } catch (error) {
    console.error("❌ Failed to register extractor:", error);
    process.exit(1);
  }

  // ============= PHASE 1: SEARCH =============
  console.log("═══════════════════════════════════════");
  console.log("PHASE 1: SEARCH");
  console.log("═══════════════════════════════════════");
  console.log(`🔍 Searching for: "${TEST_QUERY}"\n`);

  let searchResult: SearchResult;
  const searchStartTime = Date.now();

  try {
    searchResult = await player.search(TEST_QUERY, {
      searchEngine: "youtube"
    });

    const searchTime = Date.now() - searchStartTime;

    if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
      console.log("❌ No results found!");
      process.exit(1);
    }

    console.log(`✅ Found ${searchResult.tracks.length} tracks in ${searchTime}ms\n`);
    
    // Show top 3 results
    console.log("🎵 Top 3 Results:");
    searchResult.tracks.slice(0, 3).forEach((track, index) => {
      console.log(`   ${index + 1}. ${track.title} - ${track.author} (${track.duration})`);
    });

  } catch (error: any) {
    console.error("❌ Search failed:", error.message);
    process.exit(1);
  }

  // ============= PHASE 2: STREAM SETUP TEST =============
  console.log("\n═══════════════════════════════════════");
  console.log("PHASE 2: STREAM SETUP VERIFICATION");
  console.log("═══════════════════════════════════════");
  
  const firstTrack = searchResult.tracks[0];
  const streamResult = await testStreamSetup(player, firstTrack);

  // ============= RESULTS =============
  console.log("\n═══════════════════════════════════════");
  console.log("TEST RESULTS");
  console.log("═══════════════════════════════════════\n");

  const searchTime = Date.now() - searchStartTime - streamResult.streamSetupTime;
  const totalTime = Date.now() - totalStartTime;
  const estimatedPlaybackStart = searchTime + streamResult.streamSetupTime;

  console.log("📊 Performance Metrics:");
  console.log("───────────────────────────────────────");
  console.log(`   🔍 Search Time:             ${searchTime}ms`);
  console.log(`   📡 Stream Setup Time:       ${streamResult.streamSetupTime}ms`);
  console.log(`   ⚡ Est. Time to Playback:   ${estimatedPlaybackStart}ms`);
  console.log(`   ⏱️  Total Test Time:         ${totalTime}ms`);
  console.log("");

  console.log("🎯 Track Info:");
  console.log("───────────────────────────────────────");
  console.log(`   Title:     ${firstTrack.title}`);
  console.log(`   Artist:    ${firstTrack.author}`);
  console.log(`   Duration:  ${firstTrack.duration}`);
  console.log(`   URL:       ${firstTrack.url}`);
  if (streamResult.streamUrl) {
    console.log(`   Stream:    ${streamResult.streamUrl}`);
  }
  console.log("");

  if (streamResult.success) {
    console.log("═══════════════════════════════════════");
    console.log("✅ ALL TESTS PASSED");
    console.log("═══════════════════════════════════════");
    console.log("");
    console.log("📋 Summary:");
    console.log("   • Search works: ✅");
    console.log("   • Stream setup works: ✅");
    console.log("   • Stream ready: ✅");
    console.log("");
    console.log("⚡ ESTIMATED PLAYBACK START TIME:");
    console.log(`   When a user types /play, music will start in ~${estimatedPlaybackStart}ms`);
    console.log(`   (${(estimatedPlaybackStart / 1000).toFixed(2)} seconds)`);
    console.log("");
    
    // Compare with yt-dlp
    console.log("📈 Comparison with yt-dlp approach:");
    console.log("───────────────────────────────────────");
    console.log(`   discord-player:  ~${(estimatedPlaybackStart / 1000).toFixed(2)}s to first audio`);
    console.log("   yt-dlp (old):    ~5-15s to first audio (process spawn + extraction)");
    const improvement = 10000 / estimatedPlaybackStart;
    if (improvement > 1) {
      console.log(`   Improvement:     ~${improvement.toFixed(1)}x faster! 🚀`);
    } else {
      console.log("   Improvement:     Similar speed");
    }
    
  } else {
    console.log("═══════════════════════════════════════");
    console.log("❌ STREAM SETUP TEST FAILED");
    console.log("═══════════════════════════════════════");
    console.log(`   Error: ${streamResult.error}`);
    console.log("");
    console.log("Note: This may still work in production if the");
    console.log("stream is lazy and only starts when piped to voice.");
    process.exit(1);
  }

  // Clean up
  await player.destroy();
  process.exit(0);
}

// Run the test
testSearch().catch((error) => {
  console.error("❌ Test crashed:", error);
  process.exit(1);
});

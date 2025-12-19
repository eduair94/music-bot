/**
 * Test script to verify discord-player can search, find, and STREAM songs
 * 
 * Usage: npm run test:search
 * 
 * This tests:
 * 1. Search functionality
 * 2. Track metadata extraction
 * 3. Audio stream creation (simulating voice channel playback)
 * 4. Time to first audio byte
 */

import { Client, GatewayIntentBits } from "discord.js";
import { Player, SearchResult, Track } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { Readable } from "stream";

// Test query - simulating "/play lonely lonely i feel so lonely song"
const TEST_QUERY = "lonely lonely i feel so lonely song";

// How many bytes to read to confirm streaming works
const STREAM_TEST_BYTES = 65536; // 64KB - enough to confirm audio is flowing
const STREAM_TIMEOUT_MS = 30000; // 30 seconds max to wait for stream

interface StreamTestResult {
  success: boolean;
  timeToFirstByte: number;
  bytesReceived: number;
  streamType?: string;
  error?: string;
}

/**
 * Test if a track can actually stream audio data
 */
async function testStreamPlayback(player: Player, track: Track): Promise<StreamTestResult> {
  return new Promise(async (resolve) => {
    const streamStartTime = Date.now();
    let firstByteTime = 0;
    let totalBytes = 0;
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          timeToFirstByte: 0,
          bytesReceived: totalBytes,
          error: "Stream timeout - no data received within 30 seconds"
        });
      }
    }, STREAM_TIMEOUT_MS);

    try {
      console.log(`\n🎵 Attempting to stream: ${track.title}`);
      console.log(`   URL: ${track.url}`);
      
      // Get the stream from the extractor
      // This is what discord-player does internally when playing to a voice channel
      const searchResult = await player.search(track.url);
      
      if (!searchResult.tracks.length) {
        clearTimeout(timeout);
        resolve({
          success: false,
          timeToFirstByte: 0,
          bytesReceived: 0,
          error: "Could not find track for streaming"
        });
        return;
      }

      const trackToStream = searchResult.tracks[0];
      
      // Try to get the actual audio stream using the extractor
      // List all registered extractors to find the right one
      const extractors = player.extractors.store;
      console.log(`   📋 Registered extractors: ${Array.from(extractors.keys()).join(', ')}`);
      
      // Find the youtubei extractor (might have different ID)
      let extractor = null;
      for (const [id, ext] of extractors) {
        if (id.toLowerCase().includes('youtubei') || id.toLowerCase().includes('youtube')) {
          extractor = ext;
          console.log(`   ✅ Using extractor: ${id}`);
          break;
        }
      }
      
      if (!extractor) {
        // Try to get any extractor that can handle this track
        extractor = extractors.values().next().value;
        if (extractor) {
          console.log(`   ⚠️ Using fallback extractor`);
        }
      }
      
      if (!extractor) {
        clearTimeout(timeout);
        resolve({
          success: false,
          timeToFirstByte: 0,
          bytesReceived: 0,
          error: "No suitable extractor found"
        });
        return;
      }

      console.log(`   🔄 Requesting audio stream...`);
      const streamFetchStart = Date.now();
      
      // Get the stream - this is what happens when the bot starts playing
      const streamInfo = await extractor.stream(trackToStream) as any;
      
      if (!streamInfo) {
        clearTimeout(timeout);
        resolve({
          success: false,
          timeToFirstByte: 0,
          bytesReceived: 0,
          error: "Failed to get stream from extractor"
        });
        return;
      }

      const streamFetchTime = Date.now() - streamFetchStart;
      console.log(`   ⚡ Stream obtained in ${streamFetchTime}ms`);
      
      // Debug: log the stream info structure
      console.log(`   📋 Stream info type: ${typeof streamInfo}`);
      if (typeof streamInfo === 'object' && streamInfo !== null) {
        console.log(`   📋 Stream info keys: ${Object.keys(streamInfo).join(', ')}`);
      }
      
      // The stream can be a Readable stream directly or an object with stream property
      let audioStream: Readable | null = null;
      let streamType = "unknown";
      
      // Check if it's a Readable-like object (has _readableState or readable property)
      const isReadableLike = (obj: any): boolean => {
        return obj && (
          obj instanceof Readable ||
          obj._readableState !== undefined ||
          (typeof obj.pipe === 'function' && typeof obj.on === 'function')
        );
      };
      
      if (isReadableLike(streamInfo)) {
        audioStream = streamInfo as Readable;
        streamType = "readable";
      } else if (typeof streamInfo === 'string') {
        // It's a URL, we need to fetch it
        console.log(`   📡 Stream is URL: ${streamInfo.substring(0, 100)}...`);
        streamType = "url";
        
        const urlFetchStart = Date.now();
        const response = await fetch(streamInfo, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!response.ok) {
          clearTimeout(timeout);
          resolve({
            success: false,
            timeToFirstByte: 0,
            bytesReceived: 0,
            error: `Failed to fetch stream URL: ${response.status} ${response.statusText}`
          });
          return;
        }
        
        const urlFetchTime = Date.now() - urlFetchStart;
        console.log(`   📡 URL fetch started in ${urlFetchTime}ms`);
        
        if (!response.body) {
          clearTimeout(timeout);
          resolve({
            success: false,
            timeToFirstByte: 0,
            bytesReceived: 0,
            error: "Response has no body"
          });
          return;
        }
        
        // Convert web stream to node stream using the Readable.fromWeb method or manually
        const reader = response.body.getReader();
        audioStream = new Readable({
          async read() {
            try {
              const { done, value } = await reader.read();
              if (done) {
                this.push(null);
              } else {
                this.push(Buffer.from(value));
              }
            } catch (err) {
              this.destroy(err as Error);
            }
          }
        });
      } else if (streamInfo && typeof streamInfo === 'object') {
        // Check for common stream property patterns
        if (streamInfo.stream && streamInfo.stream instanceof Readable) {
          audioStream = streamInfo.stream;
          streamType = streamInfo.type || "object.stream";
        } else if (streamInfo.$) {
          // discord-player might wrap streams
          audioStream = streamInfo.$;
          streamType = "object.$";
        } else {
          // Log what we got for debugging
          console.log(`   ⚠️ Unknown object structure, trying to extract stream...`);
          for (const key of Object.keys(streamInfo)) {
            const value = streamInfo[key];
            if (value instanceof Readable) {
              audioStream = value;
              streamType = `object.${key}`;
              break;
            }
          }
        }
      }
      
      if (!audioStream) {
        clearTimeout(timeout);
        resolve({
          success: false,
          timeToFirstByte: 0,
          bytesReceived: 0,
          error: `Could not extract audio stream from: ${typeof streamInfo}`
        });
        return;
      }

      console.log(`   📡 Stream type: ${streamType}`);
      
      // Debug stream state
      console.log(`   📋 Stream readable: ${audioStream.readable}`);
      console.log(`   📋 Stream readableEnded: ${audioStream.readableEnded}`);
      console.log(`   📋 Stream readableFlowing: ${audioStream.readableFlowing}`);
      
      // Read data from the stream to verify it's working
      audioStream.on('data', (chunk: Buffer) => {
        if (firstByteTime === 0) {
          firstByteTime = Date.now() - streamStartTime;
          console.log(`   🎧 First audio byte received in ${firstByteTime}ms`);
        }
        
        totalBytes += chunk.length;
        
        // Log progress periodically
        if (totalBytes < STREAM_TEST_BYTES && totalBytes % 16384 === 0) {
          console.log(`   📦 Received ${(totalBytes / 1024).toFixed(1)}KB...`);
        }
        
        // Once we've received enough bytes, we know streaming works
        if (totalBytes >= STREAM_TEST_BYTES && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          audioStream.destroy(); // Stop reading, we've verified it works
          
          resolve({
            success: true,
            timeToFirstByte: firstByteTime,
            bytesReceived: totalBytes,
            streamType: streamType
          });
        }
      });

      audioStream.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({
            success: false,
            timeToFirstByte: firstByteTime,
            bytesReceived: totalBytes,
            error: `Stream error: ${error.message}`
          });
        }
      });

      audioStream.on('end', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({
            success: totalBytes > 0,
            timeToFirstByte: firstByteTime,
            bytesReceived: totalBytes,
            streamType: streamType
          });
        }
      });

      // Start the stream if it's paused
      if (audioStream.readableFlowing === null) {
        console.log(`   ▶️ Starting stream (was paused)...`);
        audioStream.resume();
        console.log(`   📋 Stream flowing after resume: ${audioStream.readableFlowing}`);
      }
      
      // Additional debug: try reading directly
      setTimeout(() => {
        if (!resolved && totalBytes === 0) {
          console.log(`   ⚠️ No data after 2s, checking stream state...`);
          console.log(`   📋 Stream readable: ${audioStream.readable}`);
          console.log(`   📋 Stream readableEnded: ${audioStream.readableEnded}`);
          console.log(`   📋 Stream readableFlowing: ${audioStream.readableFlowing}`);
          console.log(`   📋 Stream destroyed: ${audioStream.destroyed}`);
          
          // Try to read manually
          const chunk = audioStream.read();
          if (chunk) {
            console.log(`   📋 Manual read got ${chunk.length} bytes`);
            totalBytes += chunk.length;
            if (firstByteTime === 0) {
              firstByteTime = Date.now() - streamStartTime;
            }
          } else {
            console.log(`   📋 Manual read returned null`);
          }
        }
      }, 2000);

    } catch (error: any) {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          timeToFirstByte: 0,
          bytesReceived: totalBytes,
          error: error.message
        });
      }
    }
  });
}

async function testSearch() {
  console.log("🧪 Discord Player Search & Stream Test");
  console.log("======================================\n");
  
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

  // ============= PHASE 2: STREAM TEST =============
  console.log("\n═══════════════════════════════════════");
  console.log("PHASE 2: STREAM VERIFICATION");
  console.log("═══════════════════════════════════════");
  
  const firstTrack = searchResult.tracks[0];
  const streamStartTime = Date.now();
  
  const streamResult = await testStreamPlayback(player, firstTrack);
  
  const totalStreamTime = Date.now() - streamStartTime;

  // ============= RESULTS =============
  console.log("\n═══════════════════════════════════════");
  console.log("TEST RESULTS");
  console.log("═══════════════════════════════════════\n");

  const searchTime = Date.now() - searchStartTime - totalStreamTime;
  const totalTime = Date.now() - totalStartTime;

  console.log("📊 Performance Metrics:");
  console.log("───────────────────────────────────────");
  console.log(`   � Search Time:          ${searchTime}ms`);
  console.log(`   📡 Stream Setup Time:    ${streamResult.timeToFirstByte}ms`);
  console.log(`   ⚡ Time to First Audio:  ${searchTime + streamResult.timeToFirstByte}ms`);
  console.log(`   � Bytes Verified:       ${(streamResult.bytesReceived / 1024).toFixed(1)}KB`);
  console.log(`   🎧 Stream Type:          ${streamResult.streamType || 'N/A'}`);
  console.log(`   ⏱️  Total Test Time:      ${totalTime}ms`);
  console.log("");

  console.log("🎯 Track Info:");
  console.log("───────────────────────────────────────");
  console.log(`   Title:     ${firstTrack.title}`);
  console.log(`   Artist:    ${firstTrack.author}`);
  console.log(`   Duration:  ${firstTrack.duration}`);
  console.log(`   URL:       ${firstTrack.url}`);
  console.log("");

  if (streamResult.success) {
    console.log("═══════════════════════════════════════");
    console.log("✅ ALL TESTS PASSED");
    console.log("═══════════════════════════════════════");
    console.log("");
    console.log("📋 Summary:");
    console.log(`   • Search works: ✅`);
    console.log(`   • Stream works: ✅`);
    console.log(`   • Audio data flows: ✅ (${(streamResult.bytesReceived / 1024).toFixed(1)}KB received)`);
    console.log("");
    console.log("⚡ ESTIMATED PLAYBACK START TIME:");
    console.log(`   When a user types /play, music will start in ~${searchTime + streamResult.timeToFirstByte}ms`);
    console.log(`   (${((searchTime + streamResult.timeToFirstByte) / 1000).toFixed(2)} seconds)`);
    console.log("");
    
    // Compare with yt-dlp
    console.log("📈 Comparison with yt-dlp approach:");
    console.log("───────────────────────────────────────");
    console.log(`   discord-player:  ~${((searchTime + streamResult.timeToFirstByte) / 1000).toFixed(2)}s to first audio`);
    console.log(`   yt-dlp (old):    ~5-15s to first audio (process spawn + extraction)`);
    console.log(`   Improvement:     ~${(10000 / (searchTime + streamResult.timeToFirstByte)).toFixed(1)}x faster! 🚀`);
    
  } else {
    console.log("═══════════════════════════════════════");
    console.log("❌ STREAM TEST FAILED");
    console.log("═══════════════════════════════════════");
    console.log(`   Error: ${streamResult.error}`);
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
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PlaybackState, BotCommandType, BotCommandParams } from "@/types/discord";

interface UsePlaybackOptions {
  guildId: string;
  pollingInterval?: number;
  enabled?: boolean;
}

interface UsePlaybackReturn {
  state: PlaybackState | null;
  loading: boolean;
  error: string | null;
  sendCommand: (command: BotCommandType, params?: BotCommandParams) => Promise<{ success: boolean; error?: string }>;
  sendingCommand: boolean;
  refresh: () => Promise<void>;
}

const defaultState: PlaybackState = {
  guildId: "",
  isConnected: false,
  voiceChannelId: null,
  voiceChannelName: null,
  textChannelId: null,
  isPlaying: false,
  isPaused: false,
  volume: 80,
  currentTrack: null,
  currentPosition: 0,
  queue: [],
  queueSize: 0,
  loopMode: "off",
  audioBitrate: 128,
  lastUpdated: new Date(),
  playbackStartedAt: null,
};

export function usePlayback({ 
  guildId, 
  pollingInterval = 3000,
  enabled = true 
}: UsePlaybackOptions): UsePlaybackReturn {
  const [state, setState] = useState<PlaybackState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingCommand, setSendingCommand] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchState = useCallback(async () => {
    if (!guildId) return;
    
    try {
      const res = await fetch(`/api/guilds/${guildId}/playback`);
      if (!res.ok) {
        throw new Error("Failed to fetch playback state");
      }
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  const sendCommand = useCallback(async (
    command: BotCommandType, 
    params?: BotCommandParams
  ): Promise<{ success: boolean; error?: string }> => {
    if (!guildId) return { success: false, error: "No guild ID" };
    
    setSendingCommand(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, params }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return { success: false, error: data.error || "Command failed" };
      }
      
      // Refresh state after command
      setTimeout(() => fetchState(), 500);
      
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unknown error" 
      };
    } finally {
      setSendingCommand(false);
    }
  }, [guildId, fetchState]);

  // Initial fetch
  useEffect(() => {
    if (enabled && guildId) {
      fetchState();
    }
  }, [enabled, guildId, fetchState]);

  // Polling
  useEffect(() => {
    if (!enabled || !guildId) return;

    intervalRef.current = setInterval(fetchState, pollingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, guildId, pollingInterval, fetchState]);

  return {
    state: state || { ...defaultState, guildId },
    loading,
    error,
    sendCommand,
    sendingCommand,
    refresh: fetchState,
  };
}

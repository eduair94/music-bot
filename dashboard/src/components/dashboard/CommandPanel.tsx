"use client";

import type { BotCommandParams, BotCommandType } from "@/types/discord";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SettingsIcon from "@mui/icons-material/Settings";
import TuneIcon from "@mui/icons-material/Tune";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

interface CommandPanelProps {
  sendCommand: (command: BotCommandType, params?: BotCommandParams) => Promise<{ success: boolean; error?: string }>;
  sendingCommand: boolean;
}

interface CommandConfig {
  name: string;
  command: BotCommandType;
  description: string;
  params?: {
    name: string;
    type: "number" | "string" | "select" | "slider";
    label: string;
    required?: boolean;
    options?: { value: string | number; label: string }[];
    min?: number;
    max?: number;
    step?: number;
    default?: string | number;
  }[];
}

const commandCategories: { name: string; icon: React.ReactNode; commands: CommandConfig[] }[] = [
  {
    name: "Audio Settings",
    icon: <TuneIcon />,
    commands: [
      {
        name: "Bass Boost",
        command: "bassboost",
        description: "Adjust bass boost level",
        params: [
          {
            name: "level",
            type: "slider",
            label: "Level",
            min: 0,
            max: 100,
            default: 50,
          },
        ],
      },
      {
        name: "Nightcore",
        command: "nightcore",
        description: "Toggle nightcore effect",
      },
      {
        name: "Speed",
        command: "speed",
        description: "Adjust playback speed",
        params: [
          {
            name: "speed",
            type: "slider",
            label: "Speed",
            min: 0.5,
            max: 2,
            step: 0.1,
            default: 1,
          },
        ],
      },
      {
        name: "Set Bitrate",
        command: "setbitrate",
        description: "Set audio bitrate",
        params: [
          {
            name: "bitrate",
            type: "select",
            label: "Bitrate",
            options: [
              { value: 64, label: "64 kbps" },
              { value: 96, label: "96 kbps" },
              { value: 128, label: "128 kbps" },
              { value: 192, label: "192 kbps" },
              { value: 256, label: "256 kbps" },
              { value: 320, label: "320 kbps" },
            ],
            default: 96,
          },
        ],
      },
      {
        name: "Reset Bitrate",
        command: "resetbitrate",
        description: "Reset bitrate to default",
      },
    ],
  },
  {
    name: "Playback",
    icon: <PlayArrowIcon />,
    commands: [
      {
        name: "Forward",
        command: "forward",
        description: "Skip forward in current track",
        params: [
          {
            name: "seconds",
            type: "number",
            label: "Seconds",
            default: 10,
          },
        ],
      },
      {
        name: "Rewind",
        command: "rewind",
        description: "Rewind in current track",
        params: [
          {
            name: "seconds",
            type: "number",
            label: "Seconds",
            default: 10,
          },
        ],
      },
      {
        name: "Wind",
        command: "wind",
        description: "Wind to specific position",
        params: [
          {
            name: "position",
            type: "string",
            label: "Position (e.g., 1:30)",
            required: true,
          },
        ],
      },
      {
        name: "Replay",
        command: "replay",
        description: "Replay current track",
      },
      {
        name: "Previous",
        command: "previous",
        description: "Play previous track",
      },
      {
        name: "Loop",
        command: "loop",
        description: "Toggle loop mode",
      },
      {
        name: "Loop Queue",
        command: "loopqueue",
        description: "Toggle queue loop",
      },
      {
        name: "Repeat",
        command: "repeat",
        description: "Set repeat mode",
        params: [
          {
            name: "mode",
            type: "select",
            label: "Mode",
            options: [
              { value: "off", label: "Off" },
              { value: "one", label: "One" },
              { value: "all", label: "All" },
            ],
            default: "off",
          },
        ],
      },
    ],
  },
  {
    name: "Session",
    icon: <SettingsIcon />,
    commands: [
      {
        name: "Join",
        command: "join",
        description: "Join a voice channel",
      },
      {
        name: "Leave",
        command: "leave",
        description: "Leave the voice channel",
      },
      {
        name: "Autoplay",
        command: "autoplay",
        description: "Toggle autoplay mode",
      },
    ],
  },
  {
    name: "Info",
    icon: <MusicNoteIcon />,
    commands: [
      {
        name: "Now Playing",
        command: "nowplaying",
        description: "Show current track info",
      },
      {
        name: "Lyrics",
        command: "lyrics",
        description: "Get lyrics for current song",
      },
      {
        name: "History",
        command: "history",
        description: "Show playback history",
      },
      {
        name: "Recently Played",
        command: "recentlyplayed",
        description: "Show recently played tracks",
      },
    ],
  },
];

export function CommandPanel({ sendCommand, sendingCommand }: CommandPanelProps) {
  const [expanded, setExpanded] = useState<string | false>(false);
  const [commandParams, setCommandParams] = useState<Record<string, Record<string, string | number>>>({});
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [executingCommand, setExecutingCommand] = useState<string | null>(null);

  const handleAccordionChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const getParamValue = (commandName: string, paramName: string, defaultValue?: string | number) => {
    return commandParams[commandName]?.[paramName] ?? defaultValue ?? "";
  };

  const setParamValue = (commandName: string, paramName: string, value: string | number) => {
    setCommandParams((prev) => ({
      ...prev,
      [commandName]: {
        ...prev[commandName],
        [paramName]: value,
      },
    }));
  };

  const executeCommand = async (config: CommandConfig) => {
    setExecutingCommand(config.command);
    try {
      const params: BotCommandParams = {};
      
      if (config.params) {
        for (const param of config.params) {
          const value = getParamValue(config.name, param.name, param.default);
          if (value !== "" && value !== undefined) {
            (params as Record<string, string | number>)[param.name] = value;
          }
        }
      }

      const result = await sendCommand(config.command, Object.keys(params).length > 0 ? params : undefined);
      
      if (result.success) {
        setActionMessage({ type: "success", message: `${config.name} executed successfully` });
      } else {
        setActionMessage({ type: "error", message: result.error || `${config.name} failed` });
      }
    } catch (err) {
      setActionMessage({ type: "error", message: `Failed to execute ${config.name}` });
    } finally {
      setExecutingCommand(null);
    }
  };

  return (
    <Card sx={{ 
       
       
    }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Advanced Commands
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {actionMessage && (
          <Alert 
            severity={actionMessage.type} 
            sx={{ mb: 2 }}
            onClose={() => setActionMessage(null)}
          >
            {actionMessage.message}
          </Alert>
        )}

        {commandCategories.map((category) => (
          <Accordion
            key={category.name}
            expanded={expanded === category.name}
            onChange={handleAccordionChange(category.name)}
            sx={{
              background: "rgba(255, 255, 255, 0.02)",
              "&:before": { display: "none" },
              mb: 1,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center">
                {category.icon}
                <Typography>{category.name}</Typography>
                <Chip label={category.commands.length} size="small" variant="outlined" />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {category.commands.map((cmd) => (
                  <Box
                    key={cmd.command}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      bgcolor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {cmd.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {cmd.description}
                        </Typography>
                      </Box>

                      {cmd.params && (
                        <Stack spacing={2}>
                          {cmd.params.map((param) => (
                            <Box key={param.name}>
                              {param.type === "number" && (
                                <TextField
                                  type="number"
                                  label={param.label}
                                  value={getParamValue(cmd.name, param.name, param.default)}
                                  onChange={(e) => setParamValue(cmd.name, param.name, Number(e.target.value))}
                                  size="small"
                                  fullWidth
                                />
                              )}
                              {param.type === "string" && (
                                <TextField
                                  label={param.label}
                                  value={getParamValue(cmd.name, param.name, param.default)}
                                  onChange={(e) => setParamValue(cmd.name, param.name, e.target.value)}
                                  size="small"
                                  fullWidth
                                  required={param.required}
                                />
                              )}
                              {param.type === "select" && (
                                <FormControl size="small" fullWidth>
                                  <InputLabel>{param.label}</InputLabel>
                                  <Select
                                    value={getParamValue(cmd.name, param.name, param.default)}
                                    label={param.label}
                                    onChange={(e) => setParamValue(cmd.name, param.name, e.target.value)}
                                  >
                                    {param.options?.map((opt) => (
                                      <MenuItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              )}
                              {param.type === "slider" && (
                                <Box>
                                  <Typography variant="caption" color="text.secondary">
                                    {param.label}: {getParamValue(cmd.name, param.name, param.default)}
                                  </Typography>
                                  <Slider
                                    value={Number(getParamValue(cmd.name, param.name, param.default))}
                                    onChange={(_e, value) => setParamValue(cmd.name, param.name, value as number)}
                                    min={param.min}
                                    max={param.max}
                                    step={param.step || 1}
                                    size="small"
                                  />
                                </Box>
                              )}
                            </Box>
                          ))}
                        </Stack>
                      )}

                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => executeCommand(cmd)}
                        disabled={sendingCommand || executingCommand === cmd.command}
                        startIcon={
                          executingCommand === cmd.command ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : undefined
                        }
                      >
                        Execute
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </CardContent>
    </Card>
  );
}

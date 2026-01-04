"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Grid2 as Grid,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Button,
  Slider,
  Chip,
  Stack,
  Alert,
  Snackbar,
  Divider,
  Autocomplete,
  alpha,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import MicIcon from "@mui/icons-material/Mic";
import ChatIcon from "@mui/icons-material/Chat";
import SecurityIcon from "@mui/icons-material/Security";
import SettingsIcon from "@mui/icons-material/Settings";
import PaletteIcon from "@mui/icons-material/Palette";
import type { GuildSettings, DiscordChannel, DiscordRole } from "@/types/discord";

interface Props {
  guildId: string;
  settings: GuildSettings;
  voiceChannels: DiscordChannel[];
  textChannels: DiscordChannel[];
  roles: DiscordRole[];
}

const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt_br", name: "Portuguese (Brazil)" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh_cn", name: "Chinese (Simplified)" },
  { code: "ru", name: "Russian" },
];

export function ServerSettingsForm({
  guildId,
  settings,
  voiceChannels,
  textChannels,
  roles,
}: Props) {
  const [formData, setFormData] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/guilds/${guildId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setSnackbar({ open: true, message: "Settings saved successfully!", severity: "success" });
    } catch (error) {
      setSnackbar({ open: true, message: "Failed to save settings", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const SectionCard = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <Card sx={{ background: "rgba(22, 33, 62, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <Box sx={{ color: "primary.main" }}>{icon}</Box>
          <Typography variant="h6" fontWeight={600}>
            {title}
          </Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Playback Settings */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="Playback Settings" icon={<VolumeUpIcon />}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Default Volume: {formData.defaultVolume}%
                </Typography>
                <Slider
                  value={formData.defaultVolume}
                  onChange={(_, value) => updateField("defaultVolume", value)}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                />
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Maximum Volume: {formData.maxVolume}%
                </Typography>
                <Slider
                  value={formData.maxVolume}
                  onChange={(_, value) => updateField("maxVolume", value)}
                  min={0}
                  max={200}
                  valueLabelDisplay="auto"
                />
              </Box>

              <TextField
                label="Max Queue Size"
                type="number"
                value={formData.maxQueueSize}
                onChange={(e) => updateField("maxQueueSize", parseInt(e.target.value) || 100)}
                InputProps={{ inputProps: { min: 1, max: 1000 } }}
                fullWidth
              />

              <TextField
                label="Max Song Duration (seconds, 0 = unlimited)"
                type="number"
                value={formData.maxSongDuration}
                onChange={(e) => updateField("maxSongDuration", parseInt(e.target.value) || 0)}
                InputProps={{ inputProps: { min: 0 } }}
                fullWidth
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.preventDuplicates}
                    onChange={(e) => updateField("preventDuplicates", e.target.checked)}
                  />
                }
                label="Prevent Duplicate Songs"
              />
            </Stack>
          </SectionCard>
        </Grid>

        {/* Channel Settings */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="Channel Settings" icon={<MicIcon />}>
            <Stack spacing={3}>
              <Autocomplete
                multiple
                options={voiceChannels}
                getOptionLabel={(option) => option.name}
                value={voiceChannels.filter((c) => formData.allowedVoiceChannels.includes(c.id))}
                onChange={(_, newValue) => updateField("allowedVoiceChannels", newValue.map((c) => c.id))}
                renderInput={(params) => (
                  <TextField {...params} label="Allowed Voice Channels" placeholder="Leave empty for all channels" />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.name}
                      size="small"
                      {...getTagProps({ index })}
                      key={option.id}
                    />
                  ))
                }
              />

              <Autocomplete
                multiple
                options={textChannels}
                getOptionLabel={(option) => option.name}
                value={textChannels.filter((c) => formData.allowedTextChannels.includes(c.id))}
                onChange={(_, newValue) => updateField("allowedTextChannels", newValue.map((c) => c.id))}
                renderInput={(params) => (
                  <TextField {...params} label="Allowed Text Channels" placeholder="Leave empty for all channels" />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.name}
                      size="small"
                      {...getTagProps({ index })}
                      key={option.id}
                    />
                  ))
                }
              />

              <FormControl fullWidth>
                <InputLabel>Log Channel</InputLabel>
                <Select
                  value={formData.logChannelId || ""}
                  onChange={(e) => updateField("logChannelId", e.target.value || null)}
                  label="Log Channel"
                >
                  <MenuItem value="">None</MenuItem>
                  {textChannels.map((channel) => (
                    <MenuItem key={channel.id} value={channel.id}>
                      #{channel.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </SectionCard>
        </Grid>

        {/* Role Settings */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="Role Permissions" icon={<SecurityIcon />}>
            <Stack spacing={3}>
              <FormControl fullWidth>
                <InputLabel>DJ Role</InputLabel>
                <Select
                  value={formData.djRoleId || ""}
                  onChange={(e) => updateField("djRoleId", e.target.value || null)}
                  label="DJ Role"
                >
                  <MenuItem value="">None (Everyone can DJ)</MenuItem>
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      @{role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Admin Role</InputLabel>
                <Select
                  value={formData.adminRoleId || ""}
                  onChange={(e) => updateField("adminRoleId", e.target.value || null)}
                  label="Admin Role"
                >
                  <MenuItem value="">None (Use Server Admin)</MenuItem>
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      @{role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Alert severity="info" variant="outlined">
                Users with the DJ role can skip, remove, and control playback.
                Users with the Admin role can change bot settings.
              </Alert>
            </Stack>
          </SectionCard>
        </Grid>

        {/* Behavior Settings */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="Behavior Settings" icon={<SettingsIcon />}>
            <Stack spacing={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.announceNowPlaying}
                    onChange={(e) => updateField("announceNowPlaying", e.target.checked)}
                  />
                }
                label="Announce Now Playing"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.autoLeaveEmpty}
                    onChange={(e) => updateField("autoLeaveEmpty", e.target.checked)}
                  />
                }
                label="Leave when channel is empty"
              />

              {formData.autoLeaveEmpty && (
                <TextField
                  label="Leave Timeout (seconds)"
                  type="number"
                  value={formData.autoLeaveTimeout}
                  onChange={(e) => updateField("autoLeaveTimeout", parseInt(e.target.value) || 300)}
                  InputProps={{ inputProps: { min: 30 } }}
                  fullWidth
                />
              )}
            </Stack>
          </SectionCard>
        </Grid>

        {/* Customization */}
        <Grid size={{ xs: 12 }}>
          <SectionCard title="Customization" icon={<PaletteIcon />}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Language</InputLabel>
                  <Select
                    value={formData.language}
                    onChange={(e) => updateField("language", e.target.value)}
                    label="Language"
                  >
                    {languages.map((lang) => (
                      <MenuItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Embed Color"
                  type="color"
                  value={formData.embedColor}
                  onChange={(e) => updateField("embedColor", e.target.value)}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          bgcolor: formData.embedColor,
                          mr: 1,
                        }}
                      />
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Grid>
      </Grid>

      {/* Save Button */}
      <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{ px: 4 }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

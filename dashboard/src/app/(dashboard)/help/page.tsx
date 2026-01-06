import {
  Box,
  Card,
  CardContent,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Chip,
  Alert,
  Button,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import QueueMusicIcon from "@mui/icons-material/QueueMusic";
import SettingsIcon from "@mui/icons-material/Settings";
import SecurityIcon from "@mui/icons-material/Security";
import SupportIcon from "@mui/icons-material/Support";
import Link from "next/link";

const commandCategories = [
  {
    name: "Playback",
    icon: <MusicNoteIcon />,
    commands: [
      { name: "/play", description: "Play a song from YouTube, Spotify, or SoundCloud", usage: "/play <song name or URL>" },
      { name: "/pause", description: "Pause the current track", usage: "/pause" },
      { name: "/resume", description: "Resume playback", usage: "/resume" },
      { name: "/stop", description: "Stop playback and clear the queue", usage: "/stop" },
      { name: "/skip", description: "Skip the current track", usage: "/skip" },
      { name: "/volume", description: "Set the playback volume", usage: "/volume <1-100>" },
      { name: "/nowplaying", description: "Show the currently playing track", usage: "/nowplaying" },
    ],
  },
  {
    name: "Queue Management",
    icon: <QueueMusicIcon />,
    commands: [
      { name: "/queue", description: "View the current queue", usage: "/queue" },
      { name: "/shuffle", description: "Shuffle the queue", usage: "/shuffle" },
      { name: "/loop", description: "Toggle loop mode", usage: "/loop [off|track|queue]" },
      { name: "/remove", description: "Remove a track from the queue", usage: "/remove <position>" },
      { name: "/skipto", description: "Skip to a specific track in the queue", usage: "/skipto <position>" },
      { name: "/move", description: "Move a track to a different position", usage: "/move <from> <to>" },
    ],
  },
  {
    name: "Search & Discovery",
    icon: <HelpOutlineIcon />,
    commands: [
      { name: "/search", description: "Search for tracks and select from results", usage: "/search <query>" },
      { name: "/lyrics", description: "Get lyrics for the current or specified song", usage: "/lyrics [song name]" },
      { name: "/playlist", description: "Save and load playlists", usage: "/playlist <save|load|list>" },
    ],
  },
  {
    name: "Settings",
    icon: <SettingsIcon />,
    commands: [
      { name: "/settings", description: "View and manage server settings", usage: "/settings" },
      { name: "/setbitrate", description: "Set the audio bitrate", usage: "/setbitrate <64-384>" },
      { name: "/resetbitrate", description: "Reset bitrate to default", usage: "/resetbitrate" },
    ],
  },
];

const faqs = [
  {
    question: "How do I add the bot to my server?",
    answer: "Click the 'Add to Server' button on the homepage or go to the Servers page and click 'Invite Bot' on any server where you have Manage Server permissions.",
  },
  {
    question: "Why can't I use certain commands?",
    answer: "Some commands require specific permissions. Make sure you have the DJ role (if configured) or the necessary Discord permissions. Server admins can configure command permissions in the dashboard.",
  },
  {
    question: "How do I restrict commands to specific channels?",
    answer: "Go to your Server Settings in the dashboard and configure allowed text and voice channels. Only those channels will be able to use bot commands.",
  },
  {
    question: "What audio sources are supported?",
    answer: "The bot supports YouTube, Spotify, SoundCloud, and direct audio file URLs. For Spotify, the bot will search for matching tracks on YouTube.",
  },
  {
    question: "How do I get premium features?",
    answer: "Visit our Patreon page to subscribe. Premium benefits include higher audio quality, longer queue limits, and priority support.",
  },
  {
    question: "The bot is not responding to commands",
    answer: "Make sure the bot has the necessary permissions (View Channel, Send Messages, Connect, Speak). Also check if you're using the bot in an allowed channel.",
  },
];

export default function HelpPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Help & Documentation
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Learn how to use the music bot and get answers to common questions.
        </Typography>
      </Box>

      {/* Quick Links */}
      <Alert
        severity="info"
        sx={{
          mb: 4,
          backgroundColor: "rgba(88, 101, 242, 0.1)",
          border: "1px solid rgba(88, 101, 242, 0.3)",
        }}
        action={
          <Button
            component={Link}
            href="https://discord.gg/5w6PErKpyK"
            target="_blank"
            color="inherit"
            size="small"
          >
            Join Discord
          </Button>
        }
      >
        Need more help? Join our support Discord server for live assistance!
      </Alert>

      {/* Commands Section */}
      <Typography variant="h5" fontWeight={700} gutterBottom sx={{ mt: 4 }}>
        Bot Commands
      </Typography>

      <Stack spacing={2} sx={{ mb: 4 }}>
        {commandCategories.map((category) => (
          <Card
            key={category.name}
            sx={{
              background: "rgba(22, 33, 62, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <Accordion
              sx={{
                background: "transparent",
                boxShadow: "none",
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ px: 3 }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box sx={{ color: "primary.main" }}>{category.icon}</Box>
                  <Typography variant="h6" fontWeight={600}>
                    {category.name}
                  </Typography>
                  <Chip
                    label={`${category.commands.length} commands`}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3 }}>
                <Stack spacing={2}>
                  {category.commands.map((cmd) => (
                    <Box
                      key={cmd.name}
                      sx={{
                        p: 2,
                        borderRadius: 1,
                        bgcolor: "rgba(0, 0, 0, 0.2)",
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                      >
                        <Box>
                          <Typography
                            variant="subtitle1"
                            fontWeight={600}
                            sx={{ color: "#57F287", fontFamily: "monospace" }}
                          >
                            {cmd.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {cmd.description}
                          </Typography>
                        </Box>
                        <Chip
                          label={cmd.usage}
                          size="small"
                          sx={{
                            fontFamily: "monospace",
                            fontSize: "0.75rem",
                            bgcolor: "rgba(88, 101, 242, 0.2)",
                          }}
                        />
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Card>
        ))}
      </Stack>

      {/* FAQ Section */}
      <Typography variant="h5" fontWeight={700} gutterBottom sx={{ mt: 4 }}>
        Frequently Asked Questions
      </Typography>

      <Stack spacing={2}>
        {faqs.map((faq, index) => (
          <Card
            key={index}
            sx={{
              background: "rgba(22, 33, 62, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <Accordion
              sx={{
                background: "transparent",
                boxShadow: "none",
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ px: 3 }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Card>
        ))}
      </Stack>

      {/* Support Card */}
      <Card
        sx={{
          mt: 4,
          background: "linear-gradient(135deg, rgba(88, 101, 242, 0.2) 0%, rgba(22, 33, 62, 0.8) 100%)",
          border: "1px solid rgba(88, 101, 242, 0.3)",
        }}
      >
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          <SupportIcon sx={{ fontSize: 48, color: "primary.main", mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Still need help?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: "auto" }}>
            Our support team is ready to help. Join our Discord server or check out our premium support options.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="contained"
              component={Link}
              href="https://discord.gg/5w6PErKpyK"
              target="_blank"
            >
              Join Support Server
            </Button>
            <Button
              variant="outlined"
              component={Link}
              href="/premium"
            >
              Premium Support
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

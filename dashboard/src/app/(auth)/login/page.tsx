import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  Box,
  Card,
  CardContent,
  Container,
  Typography,
  Stack,
} from "@mui/material";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import { LoginButton } from "@/components/auth/LoginButton";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            background: "rgba(22, 33, 62, 0.8)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <CardContent sx={{ p: 6, textAlign: "center" }}>
            <Stack spacing={4} alignItems="center">
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #5865F2 0%, #F8AA2A 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 32px rgba(88, 101, 242, 0.3)",
                }}
              >
                <MusicNoteIcon sx={{ fontSize: 40, color: "white" }} />
              </Box>

              <Box>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  Welcome Back
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Sign in with your Discord account to manage your music bot settings.
                </Typography>
              </Box>

              <LoginButton />

              <Typography variant="caption" color="text.secondary">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

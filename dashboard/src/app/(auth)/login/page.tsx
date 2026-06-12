import { auth } from "@/auth";
import { LoginButton } from "@/components/auth/LoginButton";
import BrandMark from "@/components/common/BrandMark";
import {
  Box,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import { redirect } from "next/navigation";

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
        bgcolor: "#0c0a09",
        backgroundImage: "radial-gradient(#2b2520 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: 6, textAlign: "center" }}>
            <Stack spacing={4} alignItems="center">
              <BrandMark size={72} />

              <Box>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  Step into the booth
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Sign in with your Discord account to manage your music bot settings.
                </Typography>
              </Box>

              <LoginButton />

              <Typography variant="caption" color="text.disabled">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

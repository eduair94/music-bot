import { auth } from "@/auth";
import { LoginButton } from "@/components/auth/LoginButton";
import BrandMark from "@/components/common/BrandMark";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { redirect } from "next/navigation";

/** Auth.js sends failed sign-ins here with ?error=<type>. */
function errorMessage(error: string) {
  if (error === "OAuthCallbackError" || error === "AccessDenied") {
    return "Discord didn't finish the sign-in, so nothing was changed. Try again when you're ready.";
  }
  return "Sign-in failed on our side. Please try again in a moment.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;
  const errorType = Array.isArray(error) ? error[0] : error;

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

              {errorType && (
                <Alert severity="error" variant="outlined" sx={{ width: "100%", textAlign: "left" }}>
                  {errorMessage(errorType)} If it keeps happening, tell us in the{" "}
                  <Link href="/support" prefetch={false} style={{ color: "inherit" }}>
                    support server
                  </Link>
                  .
                </Alert>
              )}

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

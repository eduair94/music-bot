import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid2 as Grid,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StarIcon from "@mui/icons-material/Star";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import DiamondIcon from "@mui/icons-material/Diamond";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for small servers",
    features: [
      "128kbps audio quality",
      "100 songs max queue",
      "Basic commands",
      "Community support",
    ],
    current: true,
    icon: <StarIcon />,
    color: "#72767d",
  },
  {
    name: "Basic",
    price: "$3",
    period: "per month",
    description: "Great for growing communities",
    features: [
      "256kbps audio quality",
      "500 songs max queue",
      "All basic features",
      "Priority queue",
      "Custom embed colors",
      "Email support",
    ],
    popular: true,
    icon: <WorkspacePremiumIcon />,
    color: "#F8AA2A",
  },
  {
    name: "Pro",
    price: "$7",
    period: "per month",
    description: "For serious music lovers",
    features: [
      "320kbps audio quality",
      "Unlimited queue size",
      "All basic features",
      "24/7 playback mode",
      "Audio effects & filters",
      "Lyrics display",
      "Priority support",
      "Custom bot nickname",
    ],
    icon: <DiamondIcon />,
    color: "#5865F2",
  },
];

export default function PremiumPage() {
  return (
    <Box>
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Upgrade to Premium
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: "auto" }}>
          Unlock the full potential of your music bot with premium features, higher quality audio, and priority support.
        </Typography>
      </Box>

      <Grid container spacing={3} justifyContent="center">
        {plans.map((plan) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={plan.name}>
            <Card
              sx={{
                height: "100%",
                background: plan.popular
                  ? `linear-gradient(135deg, ${plan.color}20 0%, rgba(22, 33, 62, 0.8) 100%)`
                  : "rgba(22, 33, 62, 0.6)",
                border: plan.popular
                  ? `2px solid ${plan.color}`
                  : "1px solid rgba(255, 255, 255, 0.1)",
                position: "relative",
                overflow: "visible",
              }}
            >
              {plan.popular && (
                <Chip
                  label="MOST POPULAR"
                  size="small"
                  sx={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    bgcolor: plan.color,
                    color: "white",
                    fontWeight: 700,
                  }}
                />
              )}

              <CardContent sx={{ p: 4 }}>
                <Stack spacing={3}>
                  <Box sx={{ textAlign: "center" }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: "16px",
                        bgcolor: `${plan.color}20`,
                        color: plan.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mx: "auto",
                        mb: 2,
                      }}
                    >
                      {plan.icon}
                    </Box>

                    <Typography variant="h5" fontWeight={700}>
                      {plan.name}
                    </Typography>

                    <Box sx={{ mt: 1 }}>
                      <Typography
                        variant="h3"
                        component="span"
                        fontWeight={800}
                        sx={{ color: plan.color }}
                      >
                        {plan.price}
                      </Typography>
                      <Typography variant="body2" component="span" color="text.secondary">
                        {" "}/ {plan.period}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {plan.description}
                    </Typography>
                  </Box>

                  <List dense>
                    {plan.features.map((feature, index) => (
                      <ListItem key={index} sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircleIcon
                            sx={{ fontSize: 18, color: plan.color }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={feature}
                          primaryTypographyProps={{ variant: "body2" }}
                        />
                      </ListItem>
                    ))}
                  </List>

                  <Button
                    variant={plan.current ? "outlined" : "contained"}
                    fullWidth
                    disabled={plan.current}
                    sx={{
                      py: 1.5,
                      ...(plan.popular && !plan.current && {
                        bgcolor: plan.color,
                        "&:hover": {
                          bgcolor: plan.color,
                          opacity: 0.9,
                        },
                      }),
                    }}
                  >
                    {plan.current ? "Current Plan" : "Get Started"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* FAQ Section */}
      <Box sx={{ mt: 8, textAlign: "center" }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Frequently Asked Questions
        </Typography>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                background: "rgba(22, 33, 62, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                textAlign: "left",
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  How do payments work?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  We use Patreon for all payments. Your subscription is billed monthly and you can cancel anytime. Benefits are applied automatically to your Discord account.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                background: "rgba(22, 33, 62, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                textAlign: "left",
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Can I cancel anytime?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Yes! You can cancel your subscription at any time. Your premium benefits will remain active until the end of your billing period.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

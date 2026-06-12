import { Box, CircularProgress } from "@mui/material";

export default function DashboardLoading() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
      }}
    >
      <CircularProgress color="primary" />
    </Box>
  );
}

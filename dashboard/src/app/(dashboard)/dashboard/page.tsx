'use client';

import { useSession } from 'next-auth/react';
import {
  Box,
  Typography,
  Grid2 as Grid,
  Card,
  CardContent,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  MusicNote,
  QueueMusic,
  WorkspacePremium,
  LibraryMusic,
  Headphones,
} from '@mui/icons-material';
import { useEffect, useState } from 'react';

interface Stats {
  collectionsCount: number;
  totalTracks: number;
  premiumGuildsCount: number;
  isPremium: boolean;
  isFounder: boolean;
  tierTitle: string | null;
  audioBitrate: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.accessToken) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [session]);

  if (status === 'loading') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const statCards = [
    {
      title: 'Saved Playlists',
      value: stats?.collectionsCount ?? '-',
      icon: <LibraryMusic sx={{ fontSize: 40 }} />,
      color: '#EB459E',
    },
    {
      title: 'Total Tracks',
      value: stats?.totalTracks ?? '-',
      icon: <QueueMusic sx={{ fontSize: 40 }} />,
      color: '#5865F2',
    },
    {
      title: 'Premium Servers',
      value: stats?.premiumGuildsCount ?? '-',
      icon: <WorkspacePremium sx={{ fontSize: 40 }} />,
      color: '#FEE75C',
    },
    {
      title: 'Audio Quality',
      value: stats ? `${stats.audioBitrate}kbps` : '-',
      icon: <Headphones sx={{ fontSize: 40 }} />,
      color: '#57F287',
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Typography variant="h4" fontWeight="bold">
          Welcome back, {session?.user?.name}!
        </Typography>
        {stats?.isPremium && (
          <Chip 
            label={stats.isFounder ? "🌟 Founder" : stats.tierTitle || "Premium"}
            sx={{ 
              bgcolor: stats.isFounder ? '#F96854' : '#5865F2',
              color: 'white',
              fontWeight: 600,
            }}
          />
        )}
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage your music bot settings and view statistics
      </Typography>

      <Grid container spacing={3}>
        {statCards.map((stat, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.1) 0%, rgba(30, 30, 46, 0.9) 100%)',
                border: '1px solid rgba(88, 101, 242, 0.2)',
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {loading ? <CircularProgress size={24} /> : stat.value}
                    </Typography>
                  </Box>
                  <Box sx={{ color: stat.color, opacity: 0.8 }}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(87, 242, 135, 0.1) 0%, rgba(30, 30, 46, 0.9) 100%)',
                border: '1px solid rgba(87, 242, 135, 0.2)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
              }}
              onClick={() => window.location.href = '/servers'}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Manage Servers
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure your bot settings for each server
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(235, 69, 158, 0.1) 0%, rgba(30, 30, 46, 0.9) 100%)',
                border: '1px solid rgba(235, 69, 158, 0.2)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
              }}
              onClick={() => window.location.href = '/premium'}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Upgrade to Premium
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Unlock advanced features and support development
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

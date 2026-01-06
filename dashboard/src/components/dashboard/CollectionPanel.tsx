"use client";

import { useCollections } from "@/hooks/useCollections";
import type { BotCommandParams, BotCommandType, Track } from "@/types/discord";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import FolderIcon from "@mui/icons-material/Folder";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";

interface CollectionPanelProps {
  queue: Track[];
  currentTrack: Track | null;
  sendCommand: (command: BotCommandType, params?: BotCommandParams) => Promise<{ success: boolean; error?: string }>;
  sendingCommand: boolean;
}

export function CollectionPanel({
  queue,
  currentTrack,
  sendCommand,
  sendingCommand,
}: CollectionPanelProps) {
  const {
    collections,
    loading,
    error,
    createCollection,
    saveQueueToCollection,
    refresh,
  } = useCollections();

  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newCollectionDialogOpen, setNewCollectionDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingCollection, setLoadingCollection] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Get all tracks including current track
  const allTracks = currentTrack ? [currentTrack, ...queue] : queue;

  const handleLoadCollection = async (collectionId: string, tracks: any[]) => {
    if (tracks.length === 0) {
      setActionMessage({ type: "error", message: "This collection is empty" });
      return;
    }

    setLoadingCollection(collectionId);
    try {
      // Play each track in the collection
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const result = await sendCommand("play", { query: track.url || track.title });
        if (!result.success) {
          setActionMessage({ type: "error", message: `Failed to add track: ${track.title}` });
        }
      }
      setActionMessage({ type: "success", message: `Loaded ${tracks.length} tracks from collection` });
      setLoadDialogOpen(false);
    } catch (err) {
      setActionMessage({ type: "error", message: "Failed to load collection" });
    } finally {
      setLoadingCollection(null);
    }
  };

  const handleSaveToExisting = async (collectionId: string) => {
    if (allTracks.length === 0) {
      setActionMessage({ type: "error", message: "No tracks to save" });
      return;
    }

    setSaving(true);
    try {
      await saveQueueToCollection(collectionId, allTracks);
      setActionMessage({ type: "success", message: `Saved ${allTracks.length} tracks to collection` });
      setSaveDialogOpen(false);
    } catch (err) {
      setActionMessage({ type: "error", message: "Failed to save tracks" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndSave = async () => {
    if (!newCollectionName.trim()) {
      setActionMessage({ type: "error", message: "Please enter a collection name" });
      return;
    }

    if (allTracks.length === 0) {
      setActionMessage({ type: "error", message: "No tracks to save" });
      return;
    }

    setSaving(true);
    try {
      const newCollection = await createCollection(
        newCollectionName.trim(),
        newCollectionDescription.trim() || undefined
      );
      if (newCollection) {
        await saveQueueToCollection(newCollection._id, allTracks);
        setActionMessage({ type: "success", message: `Created collection and saved ${allTracks.length} tracks` });
        setNewCollectionDialogOpen(false);
        setSaveDialogOpen(false);
        setNewCollectionName("");
        setNewCollectionDescription("");
      } else {
        setActionMessage({ type: "error", message: "Failed to create collection" });
      }
    } catch (err) {
      setActionMessage({ type: "error", message: "Failed to create collection" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card sx={{ 
        background: "rgba(22, 33, 62, 0.6)", 
        border: "1px solid rgba(255, 255, 255, 0.1)" 
      }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Collections
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

          <Stack spacing={2}>
            <Button
              variant="outlined"
              startIcon={<PlaylistPlayIcon />}
              onClick={() => {
                refresh();
                setLoadDialogOpen(true);
              }}
              fullWidth
            >
              Load Collection
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={() => {
                refresh();
                setSaveDialogOpen(true);
              }}
              disabled={allTracks.length === 0}
              fullWidth
            >
              Save Queue to Collection
            </Button>

            {allTracks.length === 0 && (
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Add some songs to save them to a collection
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Load Collection Dialog */}
      <Dialog 
        open={loadDialogOpen} 
        onClose={() => setLoadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Load Collection</Typography>
            <IconButton onClick={() => setLoadDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : collections.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <FolderIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
              <Typography color="text.secondary">
                You don&apos;t have any collections yet
              </Typography>
              <Button 
                startIcon={<AddIcon />} 
                onClick={() => window.location.href = "/collections"}
                sx={{ mt: 2 }}
              >
                Create Collection
              </Button>
            </Box>
          ) : (
            <List>
              {collections.map((collection) => (
                <ListItem key={collection._id} disablePadding>
                  <ListItemButton
                    onClick={() => handleLoadCollection(collection._id, collection.tracks)}
                    disabled={loadingCollection === collection._id || sendingCommand}
                  >
                    <ListItemIcon>
                      {loadingCollection === collection._id ? (
                        <CircularProgress size={24} />
                      ) : (
                        <PlaylistPlayIcon />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={collection.name}
                      secondary={`${collection.tracks.length} tracks`}
                    />
                    <Chip 
                      label={collection.isPublic ? "Public" : "Private"} 
                      size="small" 
                      variant="outlined"
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>

      {/* Save to Collection Dialog */}
      <Dialog 
        open={saveDialogOpen} 
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Save to Collection</Typography>
            <IconButton onClick={() => setSaveDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Save {allTracks.length} track{allTracks.length !== 1 ? "s" : ""} to a collection
          </Typography>

          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setNewCollectionDialogOpen(true)}
            fullWidth
            sx={{ mb: 2 }}
          >
            Create New Collection
          </Button>

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Or add to existing
            </Typography>
          </Divider>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : collections.length === 0 ? (
            <Typography color="text.secondary" textAlign="center">
              No existing collections
            </Typography>
          ) : (
            <List>
              {collections.map((collection) => (
                <ListItem key={collection._id} disablePadding>
                  <ListItemButton
                    onClick={() => handleSaveToExisting(collection._id)}
                    disabled={saving}
                  >
                    <ListItemIcon>
                      <PlaylistAddIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={collection.name}
                      secondary={`${collection.tracks.length} tracks`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>

      {/* Create New Collection Dialog */}
      <Dialog 
        open={newCollectionDialogOpen} 
        onClose={() => setNewCollectionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Collection</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Collection Name"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Description (optional)"
              value={newCollectionDescription}
              onChange={(e) => setNewCollectionDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewCollectionDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateAndSave}
            disabled={saving || !newCollectionName.trim()}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            Create & Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

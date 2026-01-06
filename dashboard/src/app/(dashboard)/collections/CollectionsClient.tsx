"use client";

import { Collection, CollectionTrack, useCollections } from "@/hooks/useCollections";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockIcon from "@mui/icons-material/Lock";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import PublicIcon from "@mui/icons-material/Public";
import ShareIcon from "@mui/icons-material/Share";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Avatar,
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
    FormControlLabel,
    Grid2 as Grid,
    IconButton,
    List,
    ListItem,
    ListItemAvatar,
    ListItemSecondaryAction,
    ListItemText,
    Skeleton,
    Snackbar,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useState } from "react";

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTotalDuration(tracks: CollectionTrack[]): string {
  const totalSeconds = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} min`;
}

export function CollectionsClient() {
  const {
    collections,
    loading,
    error,
    createCollection,
    updateCollection,
    deleteCollection,
    removeTracks,
    refresh,
  } = useCollections();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [newCollectionPublic, setNewCollectionPublic] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
  const [saving, setSaving] = useState(false);

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    
    setSaving(true);
    const result = await createCollection(
      newCollectionName.trim(),
      newCollectionDescription.trim() || undefined,
      newCollectionPublic
    );
    setSaving(false);

    if (result) {
      setCreateDialogOpen(false);
      setNewCollectionName("");
      setNewCollectionDescription("");
      setNewCollectionPublic(false);
      setSnackbar({ open: true, message: "Collection created successfully!" });
    }
  };

  const handleEditCollection = async () => {
    if (!selectedCollection || !newCollectionName.trim()) return;

    setSaving(true);
    const success = await updateCollection(selectedCollection._id, {
      name: newCollectionName.trim(),
      description: newCollectionDescription.trim() || undefined,
      isPublic: newCollectionPublic,
    });
    setSaving(false);

    if (success) {
      setEditDialogOpen(false);
      setSelectedCollection(null);
      setSnackbar({ open: true, message: "Collection updated successfully!" });
    }
  };

  const handleDeleteCollection = async () => {
    if (!selectedCollection) return;

    setSaving(true);
    const success = await deleteCollection(selectedCollection._id);
    setSaving(false);

    if (success) {
      setDeleteDialogOpen(false);
      setSelectedCollection(null);
      setSnackbar({ open: true, message: "Collection deleted successfully!" });
    }
  };

  const handleRemoveTrack = async (collectionId: string, index: number) => {
    await removeTracks(collectionId, [index]);
  };

  const handleCopyShareCode = (shareCode: string) => {
    navigator.clipboard.writeText(shareCode);
    setSnackbar({ open: true, message: "Share code copied to clipboard!" });
  };

  const openEditDialog = (collection: Collection) => {
    setSelectedCollection(collection);
    setNewCollectionName(collection.name);
    setNewCollectionDescription(collection.description || "");
    setNewCollectionPublic(collection.isPublic);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (collection: Collection) => {
    setSelectedCollection(collection);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 12, md: 6, lg: 4 }}>
            <Skeleton variant="rounded" height={200} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load collections: {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Action Bar */}
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          New Collection
        </Button>
      </Stack>

      {/* Collections Grid */}
      {collections.length === 0 ? (
        <Card sx={{ 
          background: "rgba(22, 33, 62, 0.6)", 
          border: "1px solid rgba(255, 255, 255, 0.1)",
          textAlign: "center",
          py: 6,
        }}>
          <CardContent>
            <PlaylistPlayIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Collections Yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Create your first collection to save and organize your favorite tracks.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Collection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box>
          {collections.map((collection) => (
            <Accordion
              key={collection._id}
              sx={{
                background: "rgba(22, 33, 62, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                mb: 2,
                "&:before": { display: "none" },
                borderRadius: "8px !important",
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ width: "100%" }}>
                  <Avatar sx={{ bgcolor: "primary.main" }}>
                    <PlaylistPlayIcon />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography fontWeight={600}>{collection.name}</Typography>
                      {collection.isPublic ? (
                        <Chip icon={<PublicIcon />} label="Public" size="small" color="success" variant="outlined" />
                      ) : (
                        <Chip icon={<LockIcon />} label="Private" size="small" variant="outlined" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {collection.tracks.length} tracks - {formatTotalDuration(collection.tracks)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                    {collection.shareCode && (
                      <Tooltip title="Copy share code">
                        <IconButton size="small" onClick={() => handleCopyShareCode(collection.shareCode!)}>
                          <ShareIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(collection)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => openDeleteDialog(collection)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Divider sx={{ mb: 2 }} />
                {collection.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {collection.description}
                  </Typography>
                )}
                {collection.tracks.length === 0 ? (
                  <Typography color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
                    No tracks in this collection. Add tracks from the player!
                  </Typography>
                ) : (
                  <List dense>
                    {collection.tracks.map((track, index) => (
                      <ListItem key={`${track.url}-${index}`}>
                        <ListItemAvatar>
                          <Avatar src={track.thumbnail} variant="rounded" sx={{ width: 40, height: 40 }}>
                            <MusicNoteIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={track.title}
                          secondary={`${track.author} - ${formatDuration(track.duration)}`}
                          primaryTypographyProps={{ noWrap: true }}
                          secondaryTypographyProps={{ noWrap: true }}
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end" size="small" onClick={() => handleRemoveTrack(collection._id, index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Create Collection Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Collection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Collection Name"
            fullWidth
            variant="outlined"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={newCollectionDescription}
            onChange={(e) => setNewCollectionDescription(e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={<Switch checked={newCollectionPublic} onChange={(e) => setNewCollectionPublic(e.target.checked)} />}
            label="Make this collection public (shareable)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateCollection} disabled={!newCollectionName.trim() || saving}>
            {saving ? <CircularProgress size={24} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Collection Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Collection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Collection Name"
            fullWidth
            variant="outlined"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={newCollectionDescription}
            onChange={(e) => setNewCollectionDescription(e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={<Switch checked={newCollectionPublic} onChange={(e) => setNewCollectionPublic(e.target.checked)} />}
            label="Make this collection public (shareable)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditCollection} disabled={!newCollectionName.trim() || saving}>
            {saving ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Collection</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{selectedCollection?.name}&quot;? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteCollection} disabled={saving}>
            {saving ? <CircularProgress size={24} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}

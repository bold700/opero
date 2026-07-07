import { useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { HAIRLINE, TAP_TARGET } from "../../../theme/tokens";
import { createCategory, renameCategory, deleteCategory, type Category } from "../api";

// Manage the org's material categories: add, rename (cascades to materials),
// delete (blocked when in use — the count is shown and delete is disabled). One
// flat scrollable list inside a bottom sheet / dialog. Admin only.
export function CategoryManagerDialog({
  open,
  categories,
  onClose,
  onChanged,
}: {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  /** Refetch categories (and materials, since a rename changes their category). */
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which category is being renamed + the draft + busy id for row actions.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const localizedLabel = (name: string) =>
    t(`materials.category.${name}`, { defaultValue: name });

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      await createCategory(name);
      setNewName("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("materials.categoryManager.createError"));
    } finally {
      setAdding(false);
    }
  };

  const startRename = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
    setError(null);
  };

  const commitRename = async (c: Category) => {
    const name = editName.trim();
    if (!name || name === c.name) {
      setEditingId(null);
      return;
    }
    setBusyId(c.id);
    setError(null);
    try {
      await renameCategory(c.id, name);
      setEditingId(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("materials.categoryManager.renameError"));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: Category) => {
    setBusyId(c.id);
    setError(null);
    try {
      await deleteCategory(c.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("materials.categoryManager.deleteError"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={busyId || adding ? undefined : onClose}
      maxWidth="sm"
      title={t("materials.categoryManager.title")}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>
        {t("materials.categoryManager.title")}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("materials.categoryManager.subtitle")}
        </Typography>

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        {/* Add row */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 2 }}>
          <TextField
            label={t("materials.categoryManager.newName")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            disabled={adding}
            size="small"
            fullWidth
          />
          <Button
            variant="contained"
            onClick={() => void add()}
            disabled={adding || !newName.trim()}
            startIcon={adding ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            sx={{ flexShrink: 0, minHeight: { xs: TAP_TARGET, sm: "auto" } }}
          >
            {t("common.actions.add")}
          </Button>
        </Box>

        {/* List */}
        {categories.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            {t("materials.categoryManager.empty")}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {categories.map((c) => {
              const editing = editingId === c.id;
              const rowBusy = busyId === c.id;
              const inUse = c.count > 0;
              return (
                <Box
                  key={c.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 1,
                    borderBottom: `1px solid ${HAIRLINE}`,
                    "&:last-child": { borderBottom: 0 },
                  }}
                >
                  {editing ? (
                    <>
                      <TextField
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void commitRename(c);
                          } else if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        disabled={rowBusy}
                        size="small"
                        autoFocus
                        fullWidth
                      />
                      <IconButton
                        size="small"
                        color="primary"
                        aria-label={t("common.actions.confirm")}
                        onClick={() => void commitRename(c)}
                        disabled={rowBusy || !editName.trim()}
                      >
                        {rowBusy ? <CircularProgress size={18} /> : <CheckIcon fontSize="small" />}
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={t("common.actions.cancel")}
                        onClick={() => setEditingId(null)}
                        disabled={rowBusy}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {localizedLabel(c.name)}
                        </Typography>
                        {inUse ? (
                          <Typography variant="caption" color="text.secondary">
                            {t("materials.categoryManager.usedCount", { count: c.count })}
                          </Typography>
                        ) : null}
                      </Box>
                      <IconButton
                        size="small"
                        aria-label={t("common.actions.edit")}
                        onClick={() => startRename(c)}
                        disabled={rowBusy}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      {/* Delete blocked while in use — disabled + tooltip explains. */}
                      <Tooltip title={inUse ? t("materials.categoryManager.inUseTooltip") : ""}>
                        <span>
                          <IconButton
                            size="small"
                            aria-label={t("common.actions.delete")}
                            onClick={() => void remove(c)}
                            disabled={rowBusy || inUse}
                          >
                            {rowBusy ? (
                              <CircularProgress size={18} />
                            ) : (
                              <DeleteOutlineIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={Boolean(busyId) || adding}>
          {t("common.actions.close")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}

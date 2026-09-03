import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { HAIRLINE, STATUS_TONES } from "../../../theme/tokens";
import { formatPrice } from "../constants";
import {
  type Article,
  type ArticleInput,
  getArticles,
  createArticle,
  updateArticle,
  deleteArticle,
} from "../api";
import { ArticleFormDialog } from "./ArticleFormDialog";

// Other products & services (labour hours, logistics, misc sales items) — the
// flat article price list next to the material catalog. Everyone may browse
// (prices stripped server-side for field staff); admins manage the list.
export function ArticlesSection({
  canManage,
  showPrices,
}: {
  canManage: boolean;
  showPrices: boolean;
}) {
  const { t } = useTranslation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [deleting, setDeleting] = useState<Article | null>(null);

  const load = useCallback(async () => {
    try {
      setArticles(await getArticles());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (input: ArticleInput) => {
    setBusy(true);
    setError(null);
    try {
      if (editing) await updateArticle(editing.id, input);
      else await createArticle(input);
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await deleteArticle(deleting.id);
      setDeleting(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card noPadding>
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("materials.articles.title")}
        </Typography>
        {canManage ? (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            {t("materials.articles.add")}
          </Button>
        ) : null}
      </Box>

      {error ? (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      ) : null}

      {articles.length === 0 ? (
        <Box sx={{ px: { xs: 2, md: 3 }, py: 4, color: "text.secondary" }}>
          {t("materials.articles.empty")}
        </Box>
      ) : (
        articles.map((a) => (
          <Box
            key={a.id}
            sx={{
              px: { xs: 2, md: 3 },
              py: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              borderBottom: `1px solid ${HAIRLINE}`,
              "&:last-of-type": { borderBottom: "none" },
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {a.name}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {showPrices && a.unitPrice != null
                  ? `${formatPrice(a.unitPrice)} / ${a.unit}`
                  : a.unit}
              </Typography>
            </Box>
            <StatusBadge
              label={t(`materials.articles.categories.${a.category}`)}
              tone={STATUS_TONES.info}
            />
            {canManage ? (
              <>
                <IconButton
                  size="small"
                  aria-label={t("common.actions.edit")}
                  onClick={() => {
                    setEditing(a);
                    setFormOpen(true);
                  }}
                  disabled={busy}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t("common.actions.delete")}
                  onClick={() => setDeleting(a)}
                  disabled={busy}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </>
            ) : null}
          </Box>
        ))
      )}

      <ArticleFormDialog
        open={formOpen}
        article={editing}
        busy={busy}
        error={error}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={submit}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t("materials.articles.deleteTitle")}
        body={deleting ? t("materials.articles.deleteBody", { name: deleting.name }) : undefined}
        busy={busy}
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={runDelete}
      />
    </Card>
  );
}

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import SendIcon from "@mui/icons-material/Send";
import { Card } from "./Card";
import { HAIRLINE } from "../theme/tokens";

// One row of a project's activity feed, as delivered by the backend
// (GET /projects/:id — `activity`, or GET /projects/:id/activity).
// System/status/scheduled events carry a messageKey + params for i18n;
// comments carry free user text in `body`.
export type ActivityEntry = {
  id: string;
  type: string;
  messageKey?: string;
  params?: Record<string, unknown>;
  body?: string;
  userName?: string;
  createdAt: string;
};

type TFunc = (key: string, options?: Record<string, unknown>) => string;

// Resolve an activity row to display text. Comments carry the user's own words
// in `body`; system/status/scheduled events carry a messageKey + params that we
// translate via i18n. Internals are English; only the rendered text is localized.
function activityText(t: TFunc, a: ActivityEntry): string {
  if (a.type === "comment") return a.body ?? "";
  if (!a.messageKey) return a.body ?? "";

  const params = { ...(a.params ?? {}) };

  // Compose the over/under-plan suffix for usage changes (kept as a separate
  // keyed fragment so each language phrases it naturally).
  if (a.messageKey === "material.usageChanged") {
    const kind = params.deltaKind;
    params.suffix =
      kind === "over"
        ? t("activity.material.usageOver", params)
        : kind === "under"
          ? t("activity.material.usageUnder", params)
          : "";
  }

  return t(`activity.${a.messageKey}`, params);
}

function commentContent(a: ActivityEntry): ReactNode {
  const body = a.body ?? "";
  const rawMentions = Array.isArray(a.params?.mentions) ? a.params.mentions : [];
  const names = rawMentions
    .map((mention) =>
      typeof mention === "object" && mention !== null && "name" in mention
        ? String(mention.name)
        : "",
    )
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return body;

  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const mentionPattern = new RegExp(`(@(?:${escaped.join("|")}))`, "g");
  return body.split(mentionPattern).map((part, index) =>
    part.startsWith("@") && names.includes(part.slice(1)) ? (
      <Box
        component="span"
        key={`${part}-${index}`}
        sx={{ color: "primary.main", fontWeight: 700 }}
      >
        {part}
      </Box>
    ) : (
      part
    ),
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The audit trail: a project's chronological activity log (newest first).
// Shared between the werkbon detail page and the project detail page.
export function ActivityPanel({
  activity,
  bare = false,
  onAddComment,
  emptyText,
}: {
  activity: ActivityEntry[];
  /** Rendered inside the sheet, which already supplies the card and the title. */
  bare?: boolean;
  /** When set, a comment composer renders above the feed. */
  onAddComment?: (body: string) => Promise<void>;
  /** Override for a context-specific empty state, such as the Notes sheet. */
  emptyText?: string;
}) {
  const { t } = useTranslation();
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const rows = [...activity].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  // In the sheet the horizontal padding comes from DialogContent, and the sheet
  // body is the scroller — so no inset and no height cap in `bare` mode.
  const px = bare ? 0 : { xs: 2, md: 3 };

  const send = async () => {
    const body = comment.trim();
    if (!body || !onAddComment) return;
    setSending(true);
    try {
      await onAddComment(body);
      setComment("");
    } finally {
      setSending(false);
    }
  };

  const composer = onAddComment ? (
    <Box sx={{ display: "flex", gap: 1, px, py: 1.5, borderBottom: `1px solid ${HAIRLINE}` }}>
      <TextField
        placeholder={t("activity.commentPlaceholder")}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        disabled={sending}
        size="small"
        fullWidth
        multiline
        maxRows={4}
      />
      <IconButton
        aria-label={t("activity.commentSend")}
        onClick={() => void send()}
        disabled={sending || !comment.trim()}
        color="primary"
      >
        <SendIcon fontSize="small" />
      </IconButton>
    </Box>
  ) : null;

  const body =
    rows.length === 0 ? (
      <Box sx={{ px, py: 4, color: "text.secondary" }}>
        {emptyText ?? t("activity.empty")}
      </Box>
    ) : (
      // On mobile the card GROWS and the page scrolls it (no scroll-within-scroll);
      // on desktop it's a bounded panel that scrolls internally beside the rest.
      <Box
        sx={
          bare
            ? undefined
            : { maxHeight: { xs: "none", md: 420 }, overflowY: { xs: "visible", md: "auto" } }
        }
      >
        {rows.map((a) => (
          <Box
            key={a.id}
            sx={{ px, py: 1.5, borderBottom: `1px solid ${HAIRLINE}`, "&:last-child": { borderBottom: 0 } }}
          >
            <Typography variant="body2">
              {a.type === "comment" ? commentContent(a) : activityText(t, a)}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {a.userName ? `${a.userName} · ` : ""}
              {formatDateTime(a.createdAt)}
            </Typography>
          </Box>
        ))}
      </Box>
    );

  if (bare)
    return (
      <>
        {composer}
        {body}
      </>
    );

  return (
    <Card noPadding>
      {/* Fixed header */}
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("activity.title")}
        </Typography>
      </Box>
      {composer}
      {body}
    </Card>
  );
}

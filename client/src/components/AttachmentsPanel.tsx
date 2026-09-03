import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { Card } from "./Card";
import { FileViewer } from "./FileViewer";
import { HAIRLINE } from "../theme/tokens";

// One attachment row as both the werkbon and the project DTO deliver it.
export type AttachmentItem = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  // Werkbon files only: "document" (default) or "packing_slip".
  kind?: string;
  // Packing slips only: set when receipt was confirmed.
  receivedAt?: string;
  createdAt: string;
};

// Documents (PDFs / images) as a file LIST (not a photo grid): icon + name +
// size, open in the in-app viewer, delete. Shared between the werkbon page
// (job-level files) and the project page (project-level files). The caller
// supplies the title/empty/add copy from its own i18n namespace.
export function AttachmentsPanel({
  attachments,
  canWrite,
  busy,
  title,
  emptyText,
  addLabel,
  onUpload,
  onDelete,
  receivedToggle,
  bare = false,
}: {
  attachments: AttachmentItem[];
  canWrite: boolean;
  busy: boolean;
  title: string;
  emptyText: string;
  addLabel: string;
  onUpload: (file: File) => void;
  onDelete: (attachmentId: string) => void;
  /** When set (a pakbonnen list), every row gets a "received" checkbox. */
  receivedToggle?: {
    label: string;
    onToggle: (attachmentId: string, received: boolean) => void;
  };
  /**
   * Rows only, no Card and no header — for a read-only list inside another
   * card (the project's files in the Projectinfo panel).
   */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  // Non-null → the in-app viewer is showing that attachment.
  const [viewing, setViewing] = useState<AttachmentItem | null>(null);

  const pick = () => inputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const px = bare ? 0 : { xs: 2, md: 3 };

  const rows =
    attachments.length === 0 ? (
      <Box sx={{ px, py: bare ? 1 : 4, color: "text.secondary" }}>{emptyText}</Box>
    ) : (
      attachments.map((a) => {
        const kind = fileKind(a.contentType);
        const Icon =
          kind === "pdf"
            ? PictureAsPdfOutlinedIcon
            : kind === "word"
              ? DescriptionOutlinedIcon
              : kind === "excel"
                ? TableChartOutlinedIcon
                : ImageOutlinedIcon;
        return (
          <Box
            key={a.id}
            sx={{
              px,
              py: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              borderBottom: `1px solid ${HAIRLINE}`,
              "&:last-of-type": { borderBottom: "none" },
            }}
          >
            <Icon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              {/* Opens in the in-app viewer, not a new tab: on a phone,
                  navigating away loses the monteur's place in the werkbon.
                  Office files open in a new tab (no in-app renderer). Still a
                  real <button> so it's keyboard- and SR-reachable. */}
              <Link
                component="button"
                type="button"
                onClick={() =>
                  kind === "word" || kind === "excel"
                    ? window.open(a.url, "_blank", "noopener,noreferrer")
                    : setViewing(a)
                }
                disabled={!a.url}
                underline="hover"
                sx={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: 500,
                  font: "inherit",
                  border: "none",
                  background: "none",
                  p: 0,
                  cursor: "pointer",
                }}
              >
                {a.filename}
              </Link>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {formatBytes(a.size)}
              </Typography>
            </Box>
            {receivedToggle ? (
              <FormControlLabel
                sx={{ mr: 0, flexShrink: 0 }}
                control={
                  <Checkbox
                    size="small"
                    checked={!!a.receivedAt}
                    disabled={busy || !canWrite}
                    onChange={(e) => receivedToggle.onToggle(a.id, e.target.checked)}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {receivedToggle.label}
                  </Typography>
                }
              />
            ) : null}
            {canWrite ? (
              <IconButton
                size="small"
                aria-label={t("common.actions.delete")}
                onClick={() => onDelete(a.id)}
                disabled={busy}
                sx={{ flexShrink: 0 }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Box>
        );
      })
    );

  const viewer = (
    <FileViewer
      file={
        viewing?.url
          ? { url: viewing.url, contentType: viewing.contentType, filename: viewing.filename }
          : null
      }
      onClose={() => setViewing(null)}
    />
  );

  if (bare)
    return (
      <>
        {rows}
        {viewer}
      </>
    );

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
          {title}
        </Typography>
        {canWrite ? (
          <>
            <Button
              size="small"
              startIcon={<UploadFileOutlinedIcon />}
              onClick={pick}
              disabled={busy}
            >
              {addLabel}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
              hidden
              onChange={onFile}
            />
          </>
        ) : null}
      </Box>

      {rows}
      {viewer}
    </Card>
  );
}

function fileKind(contentType: string): "pdf" | "word" | "excel" | "image" {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "application/msword" || contentType.includes("wordprocessingml")) return "word";
  if (contentType === "application/vnd.ms-excel" || contentType.includes("spreadsheetml")) return "excel";
  return "image";
}

// "1536" → "1,5 kB", "2400000" → "2,4 MB". Compact, nl-style decimal comma.
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace(".", ",")} kB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

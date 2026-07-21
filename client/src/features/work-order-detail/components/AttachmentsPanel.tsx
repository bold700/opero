import { useRef } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { Card } from "../../../components/Card";
import { HAIRLINE } from "../../../theme/tokens";
import type { WorkOrderAttachment } from "../api";

// Job-level documents (PDFs / images) for a werkbon — quotes, floor plans,
// permits, supplier docs. A file LIST (not a photo grid): icon + name + size,
// open in a new tab, delete. Uploading/deleting is gated by canWrite (admin +
// assigned technician) and hidden once the werkbon is signed off.
export function AttachmentsPanel({
  attachments,
  canWrite,
  busy,
  onUpload,
  onDelete,
}: {
  attachments: WorkOrderAttachment[];
  canWrite: boolean;
  busy: boolean;
  onUpload: (file: File) => void;
  onDelete: (attachmentId: string) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = () => inputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = ""; // allow re-selecting the same file
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
          {t("workOrderDetail.attachments.title")}
        </Typography>
        {canWrite ? (
          <>
            <Button
              size="small"
              startIcon={<UploadFileOutlinedIcon />}
              onClick={pick}
              disabled={busy}
            >
              {t("workOrderDetail.attachments.add")}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              hidden
              onChange={onFile}
            />
          </>
        ) : null}
      </Box>

      {attachments.length === 0 ? (
        <Box sx={{ px: { xs: 2, md: 3 }, py: 4, color: "text.secondary" }}>
          {t("workOrderDetail.attachments.empty")}
        </Box>
      ) : (
        attachments.map((a) => {
          const isPdf = a.contentType === "application/pdf";
          const Icon = isPdf ? PictureAsPdfOutlinedIcon : ImageOutlinedIcon;
          return (
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
              <Icon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Link
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  underline="hover"
                  sx={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 500,
                  }}
                >
                  {a.filename}
                </Link>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {formatBytes(a.size)}
                </Typography>
              </Box>
              {canWrite ? (
                <IconButton
                  size="small"
                  aria-label={t("workOrderDetail.attachments.deleteAria")}
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
      )}
    </Card>
  );
}

// "1536" → "1,5 kB", "2400000" → "2,4 MB". Compact, nl-style decimal comma.
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace(".", ",")} kB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

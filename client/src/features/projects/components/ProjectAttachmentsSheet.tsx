import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import {
  AttachmentsPanel,
  type AttachmentItem,
} from "../../../components/AttachmentsPanel";
import { SideSheet } from "../../../components/SideSheet";
import { PAGE_PADDING_RESPONSIVE } from "../../../theme/tokens";

export function ProjectAttachmentsSheet({
  open,
  onClose,
  attachments,
  canWrite,
  busy,
  onUpload,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  attachments: AttachmentItem[];
  canWrite: boolean;
  busy: boolean;
  onUpload: (file: File) => void;
  onDelete: (attachmentId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={t("projects.attachments.title")}
      closeLabel={t("common.actions.close")}
    >
      <Box sx={{ p: PAGE_PADDING_RESPONSIVE }}>
        <AttachmentsPanel
          attachments={attachments}
          canWrite={canWrite}
          busy={busy}
          title={t("projects.attachments.documents")}
          emptyText={t("projects.attachments.empty")}
          addLabel={t("projects.attachments.add")}
          onUpload={onUpload}
          onDelete={onDelete}
        />
      </Box>
    </SideSheet>
  );
}

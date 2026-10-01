import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import { AttachmentsPanel } from "../../../components/AttachmentsPanel";
import { PAGE_PADDING_RESPONSIVE, SPACING } from "../../../theme/tokens";
import { SideSheet } from "../../../components/SideSheet";
import { TaskPhotosPanel } from "./TaskPhotosPanel";
import type { WorkOrderAttachment, WorkOrderTask } from "../api";

export function AttachmentsSheet({
  open,
  onClose,
  attachments,
  tasks,
  canWrite,
  busy,
  onUploadAttachment,
  onUploadPackingSlip,
  onDelete,
  onSetReceived,
}: {
  open: boolean;
  onClose: () => void;
  attachments: WorkOrderAttachment[];
  tasks: WorkOrderTask[];
  canWrite: boolean;
  busy: boolean;
  onUploadAttachment: (file: File) => void;
  onUploadPackingSlip: (file: File) => void;
  onDelete: (attachmentId: string) => void;
  onSetReceived: (attachmentId: string, received: boolean) => void;
}) {
  const { t } = useTranslation();
  const documents = attachments.filter((attachment) => attachment.kind !== "packing_slip");
  const packingSlips = attachments.filter((attachment) => attachment.kind === "packing_slip");

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={t("workOrderDetail.attachments.title")}
      closeLabel={t("common.actions.close")}
    >
      <Box
        sx={{
          p: PAGE_PADDING_RESPONSIVE,
          display: "flex",
          flexDirection: "column",
          gap: SPACING.sectionGap,
        }}
      >
        <AttachmentsPanel
          attachments={documents}
          canWrite={canWrite}
          busy={busy}
          title={t("workOrderDetail.attachments.documents")}
          emptyText={t("workOrderDetail.attachments.empty")}
          addLabel={t("workOrderDetail.attachments.add")}
          onUpload={onUploadAttachment}
          onDelete={onDelete}
        />
        <TaskPhotosPanel tasks={tasks} />
        <AttachmentsPanel
          attachments={packingSlips}
          canWrite={canWrite}
          busy={busy}
          title={t("workOrderDetail.packingSlips.title")}
          emptyText={t("workOrderDetail.packingSlips.empty")}
          addLabel={t("workOrderDetail.packingSlips.add")}
          onUpload={onUploadPackingSlip}
          onDelete={onDelete}
          receivedToggle={{
            label: t("workOrderDetail.packingSlips.received"),
            onToggle: onSetReceived,
          }}
        />
      </Box>
    </SideSheet>
  );
}

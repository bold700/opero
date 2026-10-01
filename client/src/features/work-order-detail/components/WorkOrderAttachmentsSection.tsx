import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import { AttachmentsPanel } from "../../../components/AttachmentsPanel";
import { SPACING } from "../../../theme/tokens";
import type { WorkOrderAttachment, WorkOrderTask } from "../api";
import { TaskPhotosPanel } from "./TaskPhotosPanel";

export function WorkOrderAttachmentsSection({
  projectAttachments,
  attachments,
  tasks,
  canWrite,
  busy,
  onUploadAttachment,
  onUploadPackingSlip,
  onDelete,
  onSetReceived,
}: {
  projectAttachments: WorkOrderAttachment[];
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
      <AttachmentsPanel
        attachments={projectAttachments}
        canWrite={false}
        busy={busy}
        title={t("workOrderDetail.attachments.projectDocuments")}
        emptyText={t("workOrderDetail.attachments.projectEmpty")}
        addLabel=""
        onUpload={() => {}}
        onDelete={() => {}}
      />
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
  );
}

import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import { ActivityPanel } from "../../../components/ActivityPanel";
import { PAGE_PADDING_RESPONSIVE } from "../../../theme/tokens";
import { SideSheet } from "../../../components/SideSheet";
import { MentionComposer } from "./MentionComposer";
import type { Activity, MentionCandidate } from "../api";

export function NotesSheet({
  open,
  onClose,
  notes,
  mentionCandidates,
  onAddNote,
}: {
  open: boolean;
  onClose: () => void;
  notes: Activity[];
  mentionCandidates: MentionCandidate[];
  onAddNote: (body: string, mentionUserIds: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={t("workOrderDetail.notes.title")}
      closeLabel={t("common.actions.close")}
    >
      <Box sx={{ px: PAGE_PADDING_RESPONSIVE }}>
        <MentionComposer candidates={mentionCandidates} onSubmit={onAddNote} />
        <ActivityPanel
          activity={notes}
          bare
          emptyText={t("workOrderDetail.notes.empty")}
        />
      </Box>
    </SideSheet>
  );
}

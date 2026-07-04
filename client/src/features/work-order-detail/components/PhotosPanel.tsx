import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import { PhotoGrid } from "../../../components/PhotoGrid";
import { HAIRLINE } from "../../../theme/tokens";
import type { WorkOrder } from "../api";

// Photos panel — real upload, grouped per task (zone) with separate "before"
// and "result" sets, matching the on-site monteur flow. The parent owns the
// upload/delete actions (which refresh the work order).
export function PhotosPanel({
  workOrder,
  canWrite,
  busy,
  onUpload,
  onDelete,
}: {
  workOrder: WorkOrder;
  canWrite: boolean;
  busy: boolean;
  onUpload: (taskId: string, kind: "before" | "result", file: File) => void;
  onDelete: (taskId: string, key: string) => void;
}) {
  const { t } = useTranslation();
  const tasks = workOrder.tasks;

  return (
    <Card noPadding>
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.photos.title")}
        </Typography>
      </Box>

      <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5, display: "flex", flexDirection: "column", gap: 3 }}>
        {tasks.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("workOrderDetail.photos.noTasks")}
          </Typography>
        ) : (
          tasks.map((task) => (
            <Box key={task.id}>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>
                {task.description || t("workOrderDetail.photos.untitledZone")}
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                    {t("workOrderDetail.photos.before")}
                  </Typography>
                  <PhotoGrid
                    photos={task.beforePhotos}
                    canEdit={canWrite}
                    busy={busy}
                    onAdd={(file) => onUpload(task.id, "before", file)}
                    onRemove={(key) => onDelete(task.id, key)}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                    {t("workOrderDetail.photos.result")}
                  </Typography>
                  <PhotoGrid
                    photos={task.resultPhotos}
                    canEdit={canWrite}
                    busy={busy}
                    onAdd={(file) => onUpload(task.id, "result", file)}
                    onRemove={(key) => onDelete(task.id, key)}
                  />
                </Box>
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Card>
  );
}

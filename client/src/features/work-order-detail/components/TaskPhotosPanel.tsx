import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import { PhotoGrid } from "../../../components/PhotoGrid";
import { HAIRLINE, SPACING } from "../../../theme/tokens";
import type { WorkOrderTask } from "../api";

export function TaskPhotosPanel({ tasks }: { tasks: WorkOrderTask[] }) {
  const { t } = useTranslation();
  const tasksWithPhotos = tasks.filter(
    (task) => task.beforePhotos.length > 0 || task.resultPhotos.length > 0,
  );

  return (
    <Card noPadding>
      <Box
        sx={{
          px: { xs: 2, md: SPACING.cardPadding },
          py: SPACING.itemGap,
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.attachments.taskPhotos")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("workOrderDetail.attachments.taskPhotosHint")}
        </Typography>
      </Box>

      {tasksWithPhotos.length === 0 ? (
        <Box
          sx={{
            px: { xs: 2, md: SPACING.cardPadding },
            py: SPACING.sectionGap,
            color: "text.secondary",
          }}
        >
          {t("workOrderDetail.attachments.taskPhotosEmpty")}
        </Box>
      ) : (
        tasksWithPhotos.map((task) => (
          <Box
            key={task.id}
            sx={{
              px: { xs: 2, md: SPACING.cardPadding },
              py: SPACING.cardPadding,
              borderBottom: `1px solid ${HAIRLINE}`,
              "&:last-of-type": { borderBottom: "none" },
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: SPACING.itemGap }}>
              {task.description || t("workOrderDetail.zone.untitled")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                gap: SPACING.sectionGap,
              }}
            >
              {task.beforePhotos.length > 0 ? (
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" color="text.secondary">
                    {t("workOrderDetail.photos.before")}
                  </Typography>
                  <PhotoGrid photos={task.beforePhotos} canEdit={false} />
                </Box>
              ) : null}
              {task.resultPhotos.length > 0 ? (
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" color="text.secondary">
                    {t("workOrderDetail.photos.result")}
                  </Typography>
                  <PhotoGrid photos={task.resultPhotos} canEdit={false} />
                </Box>
              ) : null}
            </Box>
          </Box>
        ))
      )}
    </Card>
  );
}

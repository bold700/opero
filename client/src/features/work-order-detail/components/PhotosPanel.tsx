import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import { Card } from "../../../components/Card";
import { HAIRLINE } from "../../../theme/tokens";

// Photos (spec: "Add Photos"). Not yet functional — photo upload depends on the
// file-storage phase. Rendered as an honest, clearly-disabled placeholder so the
// layout is complete and the feature is visibly "coming", not faked.
export function PhotosPanel() {
  const { t } = useTranslation();
  return (
    <Card noPadding>
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.photos.title")}
        </Typography>
        <Button size="small" startIcon={<PhotoCameraOutlinedIcon />} disabled>
          {t("workOrderDetail.photos.comingSoon")}
        </Button>
      </Box>
      <Box sx={{ px: 3, py: 4, color: "text.secondary" }}>
        {t("workOrderDetail.photos.hint")}
      </Box>
    </Card>
  );
}

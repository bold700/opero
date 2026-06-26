import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import { STATUS_LABEL_KEY } from "../constants";
import type { ClientDashboard } from "../api";

export function ClientView({ data }: { data: ClientDashboard }) {
  const { t } = useTranslation();
  return (
    <Card sx={{ p: 2.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {t("dashboard.client.title")}
      </Typography>
      {data.projects.length === 0 ? (
        <Typography color="text.secondary">{t("dashboard.client.noProjects")}</Typography>
      ) : (
        data.projects.map((p, i, arr) => (
          <Box key={p.id}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>{p.projectNumber}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(`domain.nextStep.${p.nextStepKey}`)}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {STATUS_LABEL_KEY[p.status] ? t(STATUS_LABEL_KEY[p.status]) : p.status}
              </Typography>
            </Box>
            {i < arr.length - 1 ? <Divider /> : null}
          </Box>
        ))
      )}
    </Card>
  );
}

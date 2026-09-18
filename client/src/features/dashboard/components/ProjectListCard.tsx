import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import ButtonBase from "@mui/material/ButtonBase";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import type { TechnicianProjectRow } from "../api";

// The field-staff work list: one flat, date-ordered list of the werkbonnen
// assigned to this person.
//
// Rows link to the WERKBON, not the project — /projects/:id is not open to
// technicians, so sending a monteur there would bounce them off the route guard. A row with no
// single werkbon to open (several under one project) renders as plain text
// instead of a button, so the chevron only ever appears where tapping works.
export function ProjectListCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: TechnicianProjectRow[];
  empty: string;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short" }) : "";

  return (
    <Card sx={{ p: 2.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography color="text.secondary">{empty}</Typography>
      ) : (
        rows.map((p, i, arr) => {
          const content = (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, width: "100%" }}>
              <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <Typography sx={{ fontWeight: 700 }}>{p.customerName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {p.address}, {p.city}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {/* Undated work is still assigned; it just has no date to show. */}
                {p.plannedDate ? formatDate(p.plannedDate) : t("dashboard.technician.unplanned")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("dashboard.technician.taskCount", { count: p.openTaskCount })}
              </Typography>
              {p.workOrderId ? (
                <ChevronRightIcon sx={{ color: "text.disabled", fontSize: 20 }} />
              ) : null}
            </Box>
          );

          return (
            <Box key={p.id}>
              {p.workOrderId ? (
                <ButtonBase
                  onClick={() => navigate(`/work-orders/${p.workOrderId}`)}
                  sx={{ width: "100%", display: "block", borderRadius: 1 }}
                >
                  {content}
                </ButtonBase>
              ) : (
                content
              )}
              {i < arr.length - 1 ? <Divider /> : null}
            </Box>
          );
        })
      )}
    </Card>
  );
}

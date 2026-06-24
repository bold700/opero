import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { Card } from "../../../components/Card";
import { STATUS_LABEL } from "../constants";
import type { ClientDashboard } from "../api";

export function ClientView({ data }: { data: ClientDashboard }) {
  return (
    <Card sx={{ p: 2.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Mijn projecten
      </Typography>
      {data.projects.length === 0 ? (
        <Typography color="text.secondary">Geen projecten gevonden.</Typography>
      ) : (
        data.projects.map((p, i, arr) => (
          <Box key={p.id}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>{p.projectNumber}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {p.nextStep}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {STATUS_LABEL[p.status] ?? p.status}
              </Typography>
            </Box>
            {i < arr.length - 1 ? <Divider /> : null}
          </Box>
        ))
      )}
    </Card>
  );
}

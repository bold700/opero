import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import { ROWS, STATUS } from "../constants";

// The work orders table card: columns, demo rows, and pagination footer.
export function WorkOrdersTable() {
  return (
    <Card noPadding>
      <Table
        sx={{
          "& th, & td": { borderColor: "#F0EDF1", px: 3 },
          "& th": { py: 2 },
          "& td": { py: 2.25 },
        }}
      >
        <TableHead>
          <TableRow sx={{ "& th": { color: "text.secondary", fontWeight: 600, fontSize: 13 } }}>
            <TableCell>Werkbon #</TableCell>
            <TableCell>Klant</TableCell>
            <TableCell>Locatie</TableCell>
            <TableCell>Type werk</TableCell>
            <TableCell>Monteur</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Datum</TableCell>
            <TableCell align="right">Actie</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ROWS.map((r) => (
            <TableRow key={r.number} hover sx={{ "&:last-child td": { border: 0 } }}>
              <TableCell sx={{ fontWeight: 700 }}>{r.number}</TableCell>
              <TableCell>{r.customer}</TableCell>
              <TableCell sx={{ color: "text.secondary" }}>{r.location}</TableCell>
              <TableCell sx={{ color: "text.secondary" }}>{r.type}</TableCell>
              <TableCell sx={{ color: "text.secondary" }}>{r.monteur}</TableCell>
              <TableCell>
                <StatusBadge label={STATUS[r.status].label} tone={STATUS[r.status].tone} />
              </TableCell>
              <TableCell sx={{ color: "text.secondary" }}>{r.date}</TableCell>
              <TableCell align="right">
                <IconButton size="small" aria-label="bekijken">
                  <VisibilityOutlinedIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderTop: "1px solid", borderColor: "#F0EDF1" }}>
        <Typography variant="body2" color="text.secondary">
          Pagina 1 van 5
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Button size="small" disabled sx={{ textTransform: "none", color: "text.secondary" }}>
            Vorige
          </Button>
          {[1, 2, 3].map((p) => (
            <IconButton
              key={p}
              size="small"
              sx={
                p === 1
                  ? { bgcolor: "primary.main", color: "#fff", width: 32, height: 32, "&:hover": { bgcolor: "primary.dark" } }
                  : { color: "text.secondary", width: 32, height: 32 }
              }
            >
              {p}
            </IconButton>
          ))}
          <Button size="small" sx={{ textTransform: "none", color: "primary.main", fontWeight: 600 }}>
            Volgende
          </Button>
        </Box>
      </Box>
    </Card>
  );
}

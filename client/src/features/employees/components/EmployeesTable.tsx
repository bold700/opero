import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import { ROWS, STATUS } from "../constants";

// The employees table card: columns, demo rows, and pagination footer.
export function EmployeesTable() {
  return (
    <Card noPadding>
      <Table
        sx={{
          "& th, & td": { borderColor: "#F0EDF1", px: 3 },
          "& th": { py: 2 },
          "& td": { py: 2 },
        }}
      >
        <TableHead>
          <TableRow sx={{ "& th": { color: "text.secondary", fontWeight: 600, fontSize: 13 } }}>
            <TableCell>Naam</TableCell>
            <TableCell>Functie</TableCell>
            <TableCell>Werkbonnen</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actie</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ROWS.map((r) => (
            <TableRow key={r.name} hover sx={{ "&:last-child td": { border: 0 } }}>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Avatar sx={{ width: 36, height: 36, bgcolor: "#FBD9A8", color: "#B45309", fontSize: 14, fontWeight: 700 }}>
                    {r.initial}
                  </Avatar>
                  <Typography sx={{ fontWeight: 600 }}>{r.name}</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ color: "text.secondary" }}>{r.role}</TableCell>
              <TableCell sx={{ color: "text.secondary" }}>{r.workOrders}</TableCell>
              <TableCell>
                <StatusBadge label={STATUS[r.status].label} tone={STATUS[r.status].tone} />
              </TableCell>
              <TableCell align="right">
                <IconButton size="small" aria-label="meer">
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderTop: "1px solid", borderColor: "#F0EDF1" }}>
        <Typography variant="body2" color="text.secondary">
          1-6 van 12 medewerkers
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton size="small" disabled>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <IconButton size="small">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Card>
  );
}

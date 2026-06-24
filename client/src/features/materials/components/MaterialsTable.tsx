import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
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

// The materials table card: columns, demo rows, and pagination footer.
export function MaterialsTable() {
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
            <TableCell>Categorie</TableCell>
            <TableCell>Eenheid</TableCell>
            <TableCell>Voorraad</TableCell>
            <TableCell>Min. voorraad</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actie</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ROWS.map((r) => (
            <TableRow key={r.name} hover sx={{ "&:last-child td": { border: 0 } }}>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: r.color, flexShrink: 0 }} />
                  <Typography sx={{ fontWeight: 600 }}>{r.name}</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ color: "text.secondary" }}>{r.category}</TableCell>
              <TableCell sx={{ color: "text.secondary" }}>{r.unit}</TableCell>
              <TableCell sx={{ color: "text.secondary" }}>{r.stock}</TableCell>
              <TableCell sx={{ color: "text.secondary" }}>{r.minStock}</TableCell>
              <TableCell>
                <StatusBadge label={STATUS[r.status].label} tone={STATUS[r.status].tone} />
              </TableCell>
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
          Tonen 1-6 van 34 materialen
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Pagina 1 van 6
        </Typography>
      </Box>
    </Card>
  );
}

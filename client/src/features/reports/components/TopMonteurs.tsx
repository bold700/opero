import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { Card } from "../../../components/Card";
import { LAVENDER } from "../../../theme/tokens";
import { TOP } from "../constants";

// Top monteurs ranking table.
export function TopMonteurs() {
  return (
    <Card>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Top monteurs
      </Typography>
      <Table sx={{ "& th, & td": { borderColor: "#F0EDF1" } }}>
        <TableHead>
          <TableRow sx={{ "& th": { color: "text.secondary", fontWeight: 600, fontSize: 13 } }}>
            <TableCell>Naam</TableCell>
            <TableCell align="right">Werkbonnen</TableCell>
            <TableCell align="right">Uren</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {TOP.map((t) => (
            <TableRow key={t.name} sx={{ "&:last-child td": { border: 0 } }}>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: LAVENDER, color: "primary.main", fontSize: 13, fontWeight: 700 }}>
                    {t.initial}
                  </Avatar>
                  <Typography sx={{ fontWeight: 600 }}>{t.name}</Typography>
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ color: "text.secondary" }}>{t.workOrders}</TableCell>
              <TableCell align="right" sx={{ color: "text.secondary" }}>{t.hours}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

import { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// The identity line shared by a task line and a meerwerk line: what the line is,
// how much of it, what it costs — plus whatever trailing controls the context
// needs (status badge, edit/delete, approval badge).
//
// Task lines and meerwerk lines are DIFFERENT entities (meerwerk carries an
// approval workflow a task line has none of), but the client's observation was
// fair: on screen they were two visually different renderings of the same
// "one priced line" idea, opened by the same AddTaskLineDialog. This component
// makes the shared part actually shared, so the only visible difference is the
// approval state — the difference that's real.
export function LineSummary({
  description,
  meta,
  price,
  leading,
  trailing,
  struck = false,
}: {
  description: string;
  // "3 m²" / "2 st · €80" — the quantity/unit line under the description.
  meta?: ReactNode;
  // Right-aligned price block (kept separate so it can be hidden per role).
  price?: ReactNode;
  // Checkbox or similar, before the description.
  leading?: ReactNode;
  // Status badge / action buttons, after the price.
  trailing?: ReactNode;
  struck?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, minWidth: 0 }}>
      {leading ?? null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 600,
            color: struck ? "text.secondary" : "text.primary",
            textDecoration: struck ? "line-through" : "none",
          }}
        >
          {description}
        </Typography>
        {meta ? (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
            {meta}
          </Typography>
        ) : null}
      </Box>
      {price ? <Box sx={{ flexShrink: 0, textAlign: "right" }}>{price}</Box> : null}
      {trailing ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          {trailing}
        </Box>
      ) : null}
    </Box>
  );
}

import Paper, { type PaperProps } from "@mui/material/Paper";
import { CARD_BG, CARD_SHADOW, RADIUS } from "../theme/tokens";

// The one card surface. Soft shadow, no hard border, standard radius. Pass
// `noPadding` for tables/lists that manage their own internal padding.
export function Card({ children, sx, noPadding, ...rest }: PaperProps & { noPadding?: boolean }) {
  return (
    <Paper
      elevation={0}
      {...rest}
      sx={{
        bgcolor: CARD_BG,
        borderRadius: `${RADIUS.card}px`,
        boxShadow: CARD_SHADOW,
        // Both branches clip. A card must never be the thing that lets a child
        // push the page sideways on a phone — if something inside can't shrink,
        // clip it here rather than growing the whole layout. (Previously only
        // the `noPadding` branch did this.)
        overflow: "hidden",
        minWidth: 0,
        ...(noPadding ? null : { p: 3 }),
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

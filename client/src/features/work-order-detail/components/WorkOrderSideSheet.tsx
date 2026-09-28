import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import {
  HAIRLINE,
  PAGE_PADDING_RESPONSIVE,
  SIDE_SHEET_WIDTH,
  SPACING,
} from "../../../theme/tokens";

export function WorkOrderSideSheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      slotProps={{
        paper: {
          sx: {
            width: { xs: "100%", sm: SIDE_SHEET_WIDTH },
            maxWidth: "100vw",
          },
        },
      }}
    >
      <Box
        sx={{
          px: PAGE_PADDING_RESPONSIVE,
          py: SPACING.itemGap,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACING.itemGap,
          borderBottom: `1px solid ${HAIRLINE}`,
          flexShrink: 0,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <IconButton aria-label={closeLabel} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{children}</Box>
    </Drawer>
  );
}

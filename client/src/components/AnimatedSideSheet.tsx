import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Drawer, { type DrawerProps } from "@mui/material/Drawer";
import Fade from "@mui/material/Fade";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

export function AnimatedSideSheet({
  open,
  children,
  ...drawerProps
}: Omit<DrawerProps, "anchor" | "children"> & {
  children: ReactNode;
}) {
  const theme = useTheme();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const duration = reduceMotion
    ? { enter: 0, exit: 0 }
    : {
        enter: theme.transitions.duration.enteringScreen,
        exit: theme.transitions.duration.leavingScreen,
      };

  return (
    <Drawer
      {...drawerProps}
      anchor="right"
      open={open}
      transitionDuration={duration}
    >
      <Fade in={open} timeout={duration} appear>
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {children}
        </Box>
      </Fade>
    </Drawer>
  );
}

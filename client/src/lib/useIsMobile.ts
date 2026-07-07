import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

// True on phone-sized screens (below "sm") — the same breakpoint ResponsiveDialog
// and SelectField switch on. Use it to gate desktop-only niceties, e.g.
// `autoFocus={!isMobile}`: auto-focusing an input when a bottom sheet opens
// summons the keyboard uninvited and breaks the sheet's open animation.
export function useIsMobile(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("sm"));
}

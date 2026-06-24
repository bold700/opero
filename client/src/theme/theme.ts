import { createTheme } from "@mui/material/styles";

// Roboto is loaded via @fontsource in main.tsx; reference it by family name here.
const ROBOTO_FONT_FAMILY = "Roboto, Helvetica, Arial, sans-serif";

// Material 3 theme. Purple primary matching the WerkbonApp login mockup.
// (Full M3 token palette can be generated later from a brand color — Kenny said
// the final color stylesheet comes afterwards.)
export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: {
      main: "#6750A4", // M3 primary (purple)
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#625B71",
    },
    background: {
      default: "#F5F5F5", // neutral page surface (matches the Figma)
      paper: "#FFFFFF",
    },
    text: {
      primary: "#1D1B20",
      secondary: "#49454F",
    },
  },
  shape: {
    borderRadius: 12,
  },
  // Standardized type scale — the only sizes to use. Reach for these variants
  // (variant="h4" etc.) instead of hardcoding fontSize on Typography.
  typography: {
    fontFamily: ROBOTO_FONT_FAMILY,
    h4: { fontSize: 28, fontWeight: 700, lineHeight: 1.2 }, // page greeting / big stat
    h5: { fontSize: 22, fontWeight: 700, lineHeight: 1.25 }, // page header (Settings)
    h6: { fontSize: 18, fontWeight: 700, lineHeight: 1.3 }, // section / card titles, top bar
    subtitle1: { fontSize: 16, fontWeight: 600 },
    subtitle2: { fontSize: 14, fontWeight: 600 },
    body1: { fontSize: 15 },
    body2: { fontSize: 14 },
    caption: { fontSize: 12 },
    button: { fontSize: 14, fontWeight: 500 },
    overline: { fontSize: 11, fontWeight: 700, letterSpacing: 0.6 },
  },
  components: {
    // M3 buttons are pill-shaped.
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 100,
          textTransform: "none",
          fontWeight: 500,
          paddingInline: 24,
          paddingBlock: 10,
        },
        sizeSmall: { paddingInline: 16, paddingBlock: 6 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 100, fontWeight: 500 },
      },
    },
    // Inputs use the control radius (8px), not the card radius.
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
    },
  },
});

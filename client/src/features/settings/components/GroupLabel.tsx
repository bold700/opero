import Typography from "@mui/material/Typography";

// A labelled field-group header inside a form.
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.6, display: "block", mb: 1.5 }}
    >
      {children}
    </Typography>
  );
}

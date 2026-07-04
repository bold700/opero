import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { BrandPanel } from "./components/BrandPanel";
import { AuthPanel } from "./components/AuthPanel";
import { confirmEmailChange } from "../../lib/api/auth";
import { ApiError } from "../../lib/api/client";

// Confirm a pending email change from the emailed link (?token=...). On success
// the login email is switched and all sessions are revoked, so the user signs in
// fresh with their new address.
export function VerifyEmail() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [state, setState] = useState<"working" | "done" | "error">(
    token ? "working" : "error",
  );
  // Confirm exactly once on mount (StrictMode double-invoke guard).
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    confirmEmailChange(token)
      .then(() => setState("done"))
      .catch((e) => {
        // A 400 = invalid/expired/taken; treat any failure as an invalid link.
        void (e instanceof ApiError);
        setState("error");
      });
  }, [token]);

  const body = () => {
    if (state === "working") {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }
    if (state === "done") {
      return (
        <Stack spacing={2}>
          <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
            {t("auth.verifyEmail.done")}
          </Alert>
          <Button component={RouterLink} to="/login" variant="contained">
            {t("auth.verifyEmail.goToLogin")}
          </Button>
        </Stack>
      );
    }
    return (
      <Stack spacing={2}>
        <Alert severity="error">{t("auth.verifyEmail.invalidLink")}</Alert>
        <Link component={RouterLink} to="/login" underline="hover" sx={{ color: "primary.main", fontWeight: 500 }}>
          {t("auth.verifyEmail.goToLogin")}
        </Link>
      </Stack>
    );
  };

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: { xs: "column", md: "row" } }}>
      <BrandPanel />
      <AuthPanel title={t("auth.verifyEmail.title")} subtitle={t("auth.verifyEmail.subtitle")}>
        {body()}
      </AuthPanel>
    </Box>
  );
}

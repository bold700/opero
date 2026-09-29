import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from "@mui/icons-material/FilterList";
import { FILTER_SHEET_WIDTH, SPACING } from "../theme/tokens";
import { AnimatedSideSheet } from "./AnimatedSideSheet";

export function FilterSideSheet({
  open,
  onOpen,
  onClose,
  activeCount = 0,
  onClear,
  children,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  activeCount?: number;
  onClear?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Tooltip title={t("common.filters.open")}>
        <Badge badgeContent={activeCount} color="primary" invisible={activeCount === 0}>
          <IconButton
            aria-label={t("common.filters.open")}
            onClick={onOpen}
            color="primary"
            sx={{ border: "1px solid", borderColor: "primary.main" }}
          >
            <FilterListIcon />
          </IconButton>
        </Badge>
      </Tooltip>
      <AnimatedSideSheet
        open={open}
        onClose={onClose}
        slotProps={{ paper: { sx: { width: { xs: "100%", sm: FILTER_SHEET_WIDTH }, maxWidth: "100%" } } }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACING.itemGap,
              p: SPACING.pagePadding,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t("common.filters.title")}
            </Typography>
            <IconButton aria-label={t("common.actions.close")} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider />
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: SPACING.sectionGap,
              p: SPACING.pagePadding,
              overflowY: "auto",
              flex: 1,
            }}
          >
            {children}
          </Box>
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: SPACING.itemGap, p: SPACING.pagePadding }}>
            <Button onClick={onClear} disabled={!onClear || activeCount === 0}>
              {t("common.filters.clear")}
            </Button>
            <Button variant="contained" onClick={onClose}>
              {t("common.filters.done")}
            </Button>
          </Box>
        </Box>
      </AnimatedSideSheet>
    </>
  );
}

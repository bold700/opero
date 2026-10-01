import { useTranslation } from "react-i18next";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { Card } from "../../../components/Card";
import {
  LAVENDER,
  LAVENDER_HOVER,
  SPACING,
  TAP_TARGET,
  WORK_ORDER_SECTION_MENU_WIDTH,
} from "../../../theme/tokens";

export type WorkOrderSection = "details" | "control" | "execution" | "attachments";

const sections: WorkOrderSection[] = ["details", "control", "execution", "attachments"];

export function WorkOrderSectionMenu({
  value,
  onChange,
}: {
  value: WorkOrderSection;
  onChange: (section: WorkOrderSection) => void;
}) {
  const { t } = useTranslation();

  return (
    <Card
      noPadding
      component="nav"
      aria-label={t("workOrderDetail.sections.label")}
      sx={{
        width: { xs: "100%", lg: WORK_ORDER_SECTION_MENU_WIDTH },
        flexShrink: 0,
        alignSelf: "flex-start",
      }}
    >
      <List
        disablePadding
        role="tablist"
        sx={{
          display: { xs: "flex", lg: "block" },
          overflowX: { xs: "auto", lg: "visible" },
        }}
      >
        {sections.map((section) => (
          <ListItemButton
            key={section}
            role="tab"
            aria-selected={value === section}
            selected={value === section}
            onClick={() => onChange(section)}
            sx={{
              minHeight: TAP_TARGET,
              minWidth: { xs: "max-content", lg: 0 },
              flex: { xs: "1 0 auto", lg: "initial" },
              px: SPACING.menuItemPadding,
              "&.Mui-selected": { bgcolor: LAVENDER, color: "primary.main" },
              "&.Mui-selected:hover": { bgcolor: LAVENDER_HOVER },
            }}
          >
            <ListItemText
              primary={t(`workOrderDetail.sections.${section}`)}
              slotProps={{
                primary: {
                  variant: "body2",
                  sx: { fontWeight: value === section ? 700 : 500 },
                },
              }}
            />
          </ListItemButton>
        ))}
      </List>
    </Card>
  );
}

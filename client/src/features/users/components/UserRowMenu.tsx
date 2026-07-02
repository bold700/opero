import { useState } from "react";
import { useTranslation } from "react-i18next";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import type { UserAccount } from "../api";

// The per-row overflow (kebab) menu. Actions are gated by account status; adding
// more later is a one-line MenuItem here.
export function UserRowMenu({
  user,
  isSelf,
  busy,
  onResend,
  onDisable,
  onEnable,
}: {
  user: UserAccount;
  isSelf: boolean;
  busy: boolean;
  onResend: (u: UserAccount) => void;
  onDisable: (u: UserAccount) => void;
  onEnable: (u: UserAccount) => void;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const open = Boolean(anchor);
  const close = () => setAnchor(null);

  const run = (fn: (u: UserAccount) => void) => () => {
    close();
    fn(user);
  };

  // Which actions this row offers. Resend for invited, enable for disabled,
  // otherwise disable. The disable item is always shown for an active user, but
  // is inert on your OWN row — you can't revoke your own access.
  const canResend = user.status === "invited";
  const canEnable = user.status === "disabled";
  const showDisable = user.status !== "disabled";

  return (
    <>
      <IconButton
        size="small"
        aria-label={t("users.table.action")}
        disabled={busy}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={open} onClose={close}>
        {canResend ? (
          <MenuItem onClick={run(onResend)}>
            <ListItemIcon>
              <SendOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("users.actions.resend")}</ListItemText>
          </MenuItem>
        ) : null}
        {canEnable ? (
          <MenuItem onClick={run(onEnable)}>
            <ListItemIcon>
              <CheckCircleOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("users.actions.enable")}</ListItemText>
          </MenuItem>
        ) : null}
        {showDisable ? (
          <MenuItem
            onClick={run(onDisable)}
            disabled={isSelf}
            sx={isSelf ? undefined : { color: "error.main" }}
          >
            <ListItemIcon>
              <BlockOutlinedIcon fontSize="small" color={isSelf ? "disabled" : "error"} />
            </ListItemIcon>
            <ListItemText>{t("users.actions.disable")}</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>
    </>
  );
}

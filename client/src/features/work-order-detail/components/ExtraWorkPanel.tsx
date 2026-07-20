import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import { PhotoGrid } from "../../../components/PhotoGrid";
import { HAIRLINE, TAP_TARGET } from "../../../theme/tokens";
import { extraWorkBadge, euro } from "../constants";
import { AddTaskLineDialog } from "./AddTaskLineDialog";
import type { ExtraWork, NewExtraWork } from "../api";

// The blockage / extra-work panel — the heart of the product. Anyone on the job
// (admin/technician) can report extra work; office (admin) approves; client
// approves; admin can reject. Each row shows its approval state.
//
// Reporting has two paths (client's call): pick a real catalog article (price
// resolved server-side) or free text for uncatalogued work. A technician's
// free-text row carries no price — the office prices it later — so the free
// form's price field is admin-only.
export function ExtraWorkPanel({
  items,
  role,
  showPrices,
  showMargin,
  busy,
  onReport,
  onReportFromCatalog,
  onUpdate,
  onUpdateFromCatalog,
  onApproveOffice,
  onApproveClient,
  onReject,
  onUploadPhoto,
  onDeletePhoto,
}: {
  items: ExtraWork[];
  role: "admin" | "technician" | "client";
  showPrices: boolean;
  showMargin: boolean;
  busy: boolean;
  onReport: (input: NewExtraWork) => void;
  onReportFromCatalog: (input: { variantId: string; quantity: number }) => void;
  onUpdate: (id: string, input: NewExtraWork) => void;
  onUpdateFromCatalog: (id: string, input: { variantId: string; quantity: number }) => void;
  onApproveOffice: (id: string) => void;
  onApproveClient: (id: string) => void;
  onReject: (id: string) => void;
  onUploadPhoto: (id: string, file: File) => void;
  onDeletePhoto: (id: string, key: string) => void;
}) {
  const { t } = useTranslation();
  const [reporting, setReporting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  // A row being edited: catalog rows re-open the picker; free-text rows re-open
  // the inline form prefilled.
  const [editingCatalog, setEditingCatalog] = useState<ExtraWork | null>(null);
  const [editingFree, setEditingFree] = useState<ExtraWork | null>(null);
  const canReport = role === "admin" || role === "technician";
  const isAdmin = role === "admin";

  return (
    <Card noPadding>
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.extraWork.title")}
        </Typography>
        {canReport && !reporting ? (
          <Button
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            disabled={busy}
          >
            {t("workOrderDetail.extraWork.report")}
          </Button>
        ) : null}
        <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setPickerOpen(true);
            }}
          >
            {t("workOrderDetail.extraWork.pickArticle")}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setReporting(true);
            }}
          >
            {t("workOrderDetail.extraWork.freeText")}
          </MenuItem>
        </Menu>
      </Box>

      {/* Catalog path — same picker as task lines; price resolved server-side. */}
      <AddTaskLineDialog
        open={pickerOpen}
        busy={busy}
        showMargin={showMargin}
        onClose={() => setPickerOpen(false)}
        onAdd={(input) => {
          onReportFromCatalog(input);
          setPickerOpen(false);
        }}
      />

      {/* Edit a catalog-backed meerwerk row — same picker, pre-selected. */}
      {editingCatalog?.variantId &&
      editingCatalog.variantMaterialId &&
      editingCatalog.variantSize ? (
        <AddTaskLineDialog
          open
          mode="edit"
          busy={busy}
          showMargin={showMargin}
          initial={{
            materialId: editingCatalog.variantMaterialId,
            size: editingCatalog.variantSize,
            variantId: editingCatalog.variantId,
            quantity: editingCatalog.quantity ?? 1,
          }}
          onClose={() => setEditingCatalog(null)}
          onAdd={(input) => {
            onUpdateFromCatalog(editingCatalog.id, input);
            setEditingCatalog(null);
          }}
        />
      ) : null}

      {reporting ? (
        <ReportForm
          canSetPrice={isAdmin}
          busy={busy}
          onSubmit={(input) => {
            onReport(input);
            setReporting(false);
          }}
          onCancel={() => setReporting(false)}
        />
      ) : null}

      {items.length === 0 && !reporting ? (
        <Box sx={{ px: { xs: 2, md: 3 }, py: 4, color: "text.secondary" }}>
          {t("workOrderDetail.extraWork.empty")}
        </Box>
      ) : (
        items.map((m) => {
          const badge = extraWorkBadge(m);
          // Free-text row being edited → the inline form replaces its display.
          if (editingFree?.id === m.id) {
            return (
              <ReportForm
                key={m.id}
                canSetPrice={isAdmin}
                busy={busy}
                initial={{
                  name: m.name ?? "",
                  quantity: m.quantity != null ? String(m.quantity) : "",
                  unit: m.unit ?? "",
                  unitPrice: m.unitPrice != null ? String(m.unitPrice) : "",
                }}
                submitLabel={t("common.actions.save")}
                onSubmit={(input) => {
                  onUpdate(m.id, input);
                  setEditingFree(null);
                }}
                onCancel={() => setEditingFree(null)}
              />
            );
          }
          return (
            <Box key={m.id} sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {m.name || m.description}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
                    {m.quantity != null ? `${m.quantity} ${m.unit ?? ""}` : ""}
                    {showPrices && m.amount != null
                      ? `${m.quantity != null ? " · " : ""}${euro(m.amount)}`
                      : ""}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                  {/* Edit: catalog rows re-open the picker; free-text rows
                      re-open the inline form. Hidden on rejected rows. */}
                  {canReport && !m.rejected ? (
                    <IconButton
                      size="small"
                      aria-label={t("common.actions.edit")}
                      onClick={() =>
                        m.variantId ? setEditingCatalog(m) : setEditingFree(m)
                      }
                      disabled={busy}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                  <StatusBadge label={t(`workOrderDetail.extraWorkStatus.${badge.key}`)} tone={badge.tone} />
                </Box>
              </Box>

              {/* Role-gated approval actions */}
              <Box sx={{ display: "flex", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
                {role === "admin" && !m.rejected ? (
                  <>
                    <Button
                      size="small"
                      variant={m.approvedByOffice ? "outlined" : "contained"}
                      onClick={() => onApproveOffice(m.id)}
                      disabled={busy}
                      sx={{ minHeight: { xs: TAP_TARGET, sm: "auto" } }}
                    >
                      {m.approvedByOffice
                        ? t("workOrderDetail.extraWork.officeApproved")
                        : t("workOrderDetail.extraWork.officeApprove")}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => onReject(m.id)}
                      disabled={busy}
                      sx={{ minHeight: { xs: TAP_TARGET, sm: "auto" } }}
                    >
                      {t("workOrderDetail.extraWork.reject")}
                    </Button>
                  </>
                ) : null}
                {role === "client" && m.approvedByOffice && !m.rejected ? (
                  <Button
                    size="small"
                    variant={m.approvedByClient ? "outlined" : "contained"}
                    onClick={() => onApproveClient(m.id)}
                    disabled={busy}
                    sx={{ minHeight: { xs: TAP_TARGET, sm: "auto" } }}
                  >
                    {m.approvedByClient
                      ? t("workOrderDetail.extraWork.clientApproved")
                      : t("workOrderDetail.extraWork.clientApprove")}
                  </Button>
                ) : null}
              </Box>

              {/* Photo evidence for the extra work / blockage report. */}
              {m.photos.length > 0 || canReport ? (
                <Box sx={{ mt: 1.5 }}>
                  <PhotoGrid
                    photos={m.photos}
                    canEdit={canReport}
                    busy={busy}
                    onAdd={(file) => onUploadPhoto(m.id, file)}
                    onRemove={(key) => onDeletePhoto(m.id, key)}
                  />
                </Box>
              ) : null}
            </Box>
          );
        })
      )}
    </Card>
  );
}

function ReportForm({
  canSetPrice,
  busy,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  // Only admins may price free-text meerwerk (the server enforces this too).
  canSetPrice: boolean;
  busy: boolean;
  // Prefill for edit mode (empty strings for a new report).
  initial?: { name: string; quantity: string; unit: string; unitPrice: string };
  submitLabel?: string;
  onSubmit: (input: NewExtraWork) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [unitPrice, setUnitPrice] = useState(initial?.unitPrice ?? "");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      quantity: quantity ? Number(quantity) : undefined,
      unit: unit.trim() || undefined,
      unitPrice: canSetPrice && unitPrice ? Number(unitPrice) : undefined,
    });
  };

  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        py: 2,
        borderBottom: `1px solid ${HAIRLINE}`,
        display: "flex",
        gap: 1,
        flexWrap: "wrap",
        alignItems: { xs: "stretch", sm: "center" },
      }}
    >
      <TextField
        size="small"
        placeholder={t("workOrderDetail.extraWork.descriptionPlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        sx={{ flex: { sm: 1 }, width: { xs: "100%", sm: "auto" }, minWidth: { sm: 200 } }}
      />
      {/* qty + unit share a row on xs, inline on sm+ */}
      <Box sx={{ display: "flex", gap: 1, width: { xs: "100%", sm: "auto" } }}>
        <TextField
          size="small"
          placeholder={t("workOrderDetail.material.quantity")}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          sx={{ width: { xs: "50%", sm: 90 } }}
        />
        <TextField
          size="small"
          placeholder={t("workOrderDetail.material.unit")}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          sx={{ width: { xs: "50%", sm: 100 } }}
        />
      </Box>
      {canSetPrice ? (
        <TextField
          size="small"
          placeholder={t("workOrderDetail.material.price")}
          type="number"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          sx={{ width: { xs: "100%", sm: 100 } }}
        />
      ) : null}
      <Box sx={{ display: "flex", gap: 1, width: { xs: "100%", sm: "auto" } }}>
        <Button
          size="small"
          variant="contained"
          onClick={submit}
          disabled={busy || !name.trim()}
          sx={{ flex: { xs: 1, sm: "none" }, minHeight: { xs: TAP_TARGET, sm: "auto" } }}
        >
          {submitLabel ?? t("workOrderDetail.extraWork.submit")}
        </Button>
        <Button
          size="small"
          onClick={onCancel}
          disabled={busy}
          sx={{ flex: { xs: 1, sm: "none" }, minHeight: { xs: TAP_TARGET, sm: "auto" } }}
        >
          {t("common.actions.cancel")}
        </Button>
      </Box>
    </Box>
  );
}

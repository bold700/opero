import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { TAP_TARGET } from "../../../theme/tokens";

// Inline form to add a free-text material line to a task. Name is required;
// qty/unit/price optional. Price field hidden when prices aren't shown.
export function AddMaterialRow({
  showPrices,
  busy,
  onAdd,
  onCancel,
}: {
  showPrices: boolean;
  busy: boolean;
  onAdd: (m: {
    name: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
  }) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({
      name: trimmed,
      quantity: quantity ? Number(quantity) : undefined,
      unit: unit.trim() || undefined,
      unitPrice: showPrices && unitPrice ? Number(unitPrice) : undefined,
    });
  };

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        flexWrap: "wrap",
        alignItems: { xs: "stretch", sm: "center" },
        py: 0.75,
      }}
    >
      <TextField
        size="small"
        placeholder={t("workOrderDetail.material.placeholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        sx={{ flex: { sm: 1 }, width: { xs: "100%", sm: "auto" }, minWidth: { sm: 160 } }}
      />
      {/* qty + unit share a row on xs, sit inline on sm+ */}
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
      {showPrices ? (
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
          {t("common.actions.add")}
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

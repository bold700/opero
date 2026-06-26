import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

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
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", py: 0.75 }}>
      <TextField
        size="small"
        placeholder={t("workOrderDetail.material.placeholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        sx={{ flex: 1, minWidth: 160 }}
      />
      <TextField
        size="small"
        placeholder={t("workOrderDetail.material.quantity")}
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        sx={{ width: 90 }}
      />
      <TextField
        size="small"
        placeholder={t("workOrderDetail.material.unit")}
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        sx={{ width: 100 }}
      />
      {showPrices ? (
        <TextField
          size="small"
          placeholder={t("workOrderDetail.material.price")}
          type="number"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          sx={{ width: 100 }}
        />
      ) : null}
      <Button size="small" variant="contained" onClick={submit} disabled={busy || !name.trim()}>
        {t("common.actions.add")}
      </Button>
      <Button size="small" onClick={onCancel} disabled={busy}>
        {t("common.actions.cancel")}
      </Button>
    </Box>
  );
}

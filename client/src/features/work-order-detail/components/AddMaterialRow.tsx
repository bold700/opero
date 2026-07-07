import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { SelectField } from "../../../components/SelectField";
import { TAP_TARGET } from "../../../theme/tokens";
import type { MaterialPickOption } from "../api";

// Add a material line to a task by PICKING from the org's Materials catalog.
// Name, unit and price come from the catalog — they're never typed. The user
// only picks the material and enters a quantity. There is no free-text material
// entry: if a material isn't in the catalog, it must be added there first.
export function AddMaterialRow({
  showPrices,
  materials,
  busy,
  onAdd,
  onCancel,
}: {
  showPrices: boolean;
  materials: MaterialPickOption[];
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
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");

  const picked = useMemo(
    () => materials.find((a) => a.id === materialId) ?? null,
    [materials, materialId],
  );

  const selectMaterial = (id: string) => {
    setMaterialId(id);
  };

  const submit = () => {
    if (!picked) return;
    onAdd({
      name: picked.name,
      quantity: quantity ? Number(quantity) : undefined,
      unit: picked.unit || undefined,
      // Price only when the role can see it and the catalog carries one.
      unitPrice: showPrices && picked.unitPrice != null ? picked.unitPrice : undefined,
    });
  };

  // Empty catalog → can't pick anything; no free-text fallback by design.
  if (materials.length === 0) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, py: 0.75 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("workOrderDetail.material.emptyCatalog")}
        </Typography>
        <Box>
          <Button size="small" onClick={onCancel} disabled={busy}>
            {t("common.actions.cancel")}
          </Button>
        </Box>
      </Box>
    );
  }

  const options = materials.map((a) => ({
    value: a.id,
    // "Steenwol 100mm · m² · € 38,00" — unit always; price only when visible.
    label: [
      a.name,
      a.unit,
      showPrices && a.unitPrice != null
        ? `€ ${a.unitPrice.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, py: 0.75 }}>
      <Box
        sx={{
          display: "flex",
          gap: 1,
          flexWrap: "wrap",
          alignItems: { xs: "stretch", sm: "flex-end" },
        }}
      >
        <SelectField
          label={t("workOrderDetail.material.pickMaterial")}
          value={materialId}
          onChange={selectMaterial}
          disabled={busy}
          options={options}
          sx={{ flex: { sm: 1 }, width: { xs: "100%", sm: "auto" }, minWidth: { sm: 220 } }}
        />
        <TextField
          size="small"
          label={t("workOrderDetail.material.quantity")}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={busy || !picked}
          sx={{ width: { xs: "100%", sm: 120 } }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Button
          size="small"
          variant="contained"
          onClick={submit}
          disabled={busy || !picked}
          sx={{ minHeight: { xs: TAP_TARGET, sm: "auto" } }}
        >
          {t("common.actions.add")}
        </Button>
        <Button
          size="small"
          onClick={onCancel}
          disabled={busy}
          sx={{ minHeight: { xs: TAP_TARGET, sm: "auto" } }}
        >
          {t("common.actions.cancel")}
        </Button>
      </Box>
    </Box>
  );
}

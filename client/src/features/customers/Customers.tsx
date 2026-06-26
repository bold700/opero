import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../../components/PageLayout";
import { LAVENDER, RADIUS } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { getCustomers, type Customer } from "./api";
import { FILTERS, type CustomerFilter } from "./constants";
import { CustomersActions } from "./components/CustomersActions";
import { CustomersTable } from "./components/CustomersTable";

export function Customers() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<CustomerFilter>("all");
  const { data, loading, error } = useApi<Customer[]>(getCustomers);

  const customers = data ?? [];

  // Real counts derived from the loaded customers. `key` resolves to a
  // "customers.counts.<key>" label at render time.
  const counts = useMemo(
    () => [
      { key: "total", value: customers.length },
      { key: "business", value: customers.filter((c) => c.type === "business").length },
      { key: "private", value: customers.filter((c) => c.type === "private").length },
    ],
    [customers],
  );

  const filtered = useMemo(() => {
    if (activeFilter === "business") return customers.filter((c) => c.type === "business");
    if (activeFilter === "private") return customers.filter((c) => c.type === "private");
    return customers;
  }, [customers, activeFilter]);

  return (
    <PageLayout title={t("customers.title")} actions={<CustomersActions />}>
      {/* Summary counts */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        {counts.map((c) => (
          <Box
            key={c.key}
            sx={{ px: 2, py: 1, borderRadius: `${RADIUS.control}px`, bgcolor: "#FFFFFF", border: "1px solid", borderColor: "divider", fontSize: 14, fontWeight: 600, color: "text.secondary" }}
          >
            {t(`customers.counts.${c.key}`)}: {c.value}
          </Box>
        ))}
      </Box>

      {/* Filter chips */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const active = f === activeFilter;
          return (
            <Chip
              key={f}
              label={t(`customers.filters.${f}`)}
              onClick={() => setActiveFilter(f)}
              variant={active ? "filled" : "outlined"}
              sx={active ? { bgcolor: LAVENDER, color: "primary.main", fontWeight: 600 } : { color: "text.secondary" }}
            />
          );
        })}
      </Box>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <CustomersTable customers={filtered} />
      )}
    </PageLayout>
  );
}

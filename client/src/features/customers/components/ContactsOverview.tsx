import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useNavigate } from "react-router-dom";
import { usePagedApi } from "../../../lib/api/usePagedApi";
import {
  getContactPersonsPage,
  type ContactPersonOverview,
} from "../api";
import { AllContactsTable } from "./AllContactsTable";

export function ContactsOverview({ search }: { search: string }) {
  const navigate = useNavigate();
  const { items, loading, loadingMore, error, hasMore, loadMore } =
    usePagedApi<ContactPersonOverview>(
      (cursor) =>
        getContactPersonsPage({
          cursor,
          search: search || undefined,
        }),
      [search],
    );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <AllContactsTable
      contacts={items}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
      onOpenCustomer={(customerId) => navigate(`/customers/${customerId}`)}
    />
  );
}

import { Navigate, Outlet, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuth } from "./AuthContext";
import { canAccessPath } from "../app/navigation";

// Gate the authenticated app: unauthenticated users go to /login. While the
// session is still being restored (/auth/me), show a spinner instead of
// flashing the login screen.
export function RequireAuth() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

// Gate a route by role: if the current user's role can't access this path,
// send them back to the dashboard.
export function RequireRouteAccess() {
  const { user } = useAuth();
  const location = useLocation();
  if (user && !canAccessPath(location.pathname, user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

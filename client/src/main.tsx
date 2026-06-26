import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "./index.css";
import "./i18n";
import { ThemeRegistry } from "./theme/ThemeRegistry";
import { AuthProvider } from "./auth/AuthContext";
import { router } from "./app/router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeRegistry>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeRegistry>
  </StrictMode>,
);

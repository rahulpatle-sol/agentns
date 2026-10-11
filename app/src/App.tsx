import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/ui/Toast";
import { ActivityPage } from "./routes/ActivityPage";
import { NameDetailPage } from "./routes/NameDetailPage";
import { MyNamesPage } from "./routes/MyNamesPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { OverviewPage } from "./routes/OverviewPage";
import { RegisterPage } from "./routes/RegisterPage";
import { Providers } from "./state/client";

export function App() {
  return (
    <Providers>
      <ToastProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/names" element={<MyNamesPage />} />
            {/* The PDA is a base58 address, so it stays readable in the URL. */}
            <Route path="/names/:pda" element={<NameDetailPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/overview" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell>
      </ToastProvider>
    </Providers>
  );
}

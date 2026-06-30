import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { Layout } from "./components/Layout";
import { AppProviders } from "./providers/AppProviders";
import { BoardPage } from "./pages/BoardPage";
import { HallPage } from "./pages/HallPage";
import { MissionPage } from "./pages/MissionPage";
import { OutboxPage } from "./pages/OutboxPage";
import { DiscoveringHallPage } from "./pages/DiscoveringHallPage";
import { IdeaPage } from "./pages/IdeaPage";

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout onOpenSettings={() => setSettingsOpen(true)} />}>
            <Route index element={<BoardPage />} />
            <Route path="hall" element={<HallPage />} />
            <Route path="outbox" element={<OutboxPage />} />
            <Route path="discovering" element={<DiscoveringHallPage />} />
            <Route path="ideas/:id" element={<IdeaPage />} />
            <Route path="missions/:id" element={<MissionPage />} />
          </Route>
        </Routes>
        <ApiKeyModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </BrowserRouter>
    </AppProviders>
  );
}

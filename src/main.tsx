import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { SearchPage } from "./components/SearchPage";
import { GamePage } from "./components/GamePage";
import { ImportPage } from "./components/ImportPage";
import { MelodicePage } from "./components/MelodicePage";
import { APP_WINDOW_NAME } from "./melodice/bookmarklet";
import { BackendProvider } from "./backend/BackendProvider";
import { SettingsProvider } from "./settings/SettingsProvider";

// Named so the Melodice bookmarklet can send to this tab instead of opening another.
window.name = APP_WINDOW_NAME;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BackendProvider>
      <SettingsProvider>
        {/* Hash routing so deep links work on GitHub Pages without a 404 fallback. */}
        <HashRouter>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/game/:slug" element={<GamePage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/melodice" element={<MelodicePage />} />
            <Route path="*" element={<SearchPage />} />
          </Routes>
        </HashRouter>
      </SettingsProvider>
    </BackendProvider>
  </StrictMode>,
);

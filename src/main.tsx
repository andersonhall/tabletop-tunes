import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { SearchPage } from "./components/SearchPage";
import { GamePage } from "./components/GamePage";
import { BackendProvider } from "./backend/BackendProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BackendProvider>
      {/* Hash routing so deep links work on GitHub Pages without a 404 fallback. */}
      <HashRouter>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/game/:slug" element={<GamePage />} />
          <Route path="*" element={<SearchPage />} />
        </Routes>
      </HashRouter>
    </BackendProvider>
  </StrictMode>,
);

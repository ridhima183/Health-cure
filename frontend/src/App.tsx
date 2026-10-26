import { NavLink, Route, Routes } from "react-router-dom";

import { DiagnosePage } from "./pages/Diagnose.tsx";
import { HistoryPage } from "./pages/History.tsx";
import { ModelCardPage } from "./pages/ModelCardPage.tsx";
import { PerformancePage } from "./pages/Performance.tsx";
import { ReportPage } from "./pages/Report.tsx";

const links = [
  { to: "/", label: "Diagnose" },
  { to: "/report", label: "Report" },
  { to: "/history", label: "History" },
  { to: "/performance", label: "Performance" },
  { to: "/model-card", label: "Model card" },
];

export default function App() {
  return (
    <div className="min-h-svh bg-ivory text-charcoal">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="font-display text-2xl text-primary">HealthCure</p>
            <p className="text-xs uppercase tracking-wide text-muted">Decision support only</p>
          </div>
          <nav className="flex gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm ${isActive ? "bg-primary text-ivory" : "text-muted hover:bg-teal-tint"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<DiagnosePage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/model-card" element={<ModelCardPage />} />
        </Routes>
      </main>
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted">
        Decision support only — not a diagnosis, prescription, or medical device. Consult a qualified clinician.
      </footer>
    </div>
  );
}

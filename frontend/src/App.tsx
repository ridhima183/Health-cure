import { NavLink, Route, Routes } from "react-router-dom";

import { DiagnosePage } from "./pages/Diagnose.tsx";
import { HistoryPage } from "./pages/History.tsx";
import { ModelCardPage } from "./pages/ModelCardPage.tsx";
import { PerformancePage } from "./pages/Performance.tsx";
import { ReportPage } from "./pages/Report.tsx";
import { cn } from "./lib/cn.ts";

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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div>
            <p className="font-display text-xl text-charcoal">HealthCure</p>
            <p className="text-xs text-muted">Decision support only</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "shrink-0 border-b-2 px-3 py-2 text-sm outline-none transition-colors duration-200",
                    "focus-visible:ring-2 focus-visible:ring-primary/30",
                    isActive
                      ? "border-primary text-charcoal"
                      : "border-transparent text-muted hover:text-charcoal",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Routes>
          <Route path="/" element={<DiagnosePage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/model-card" element={<ModelCardPage />} />
        </Routes>
      </main>
      <footer className="border-t border-border px-4 py-5 text-center text-xs text-muted md:px-6">
        Decision support only — not a diagnosis, prescription, or medical device. Consult a qualified clinician.
      </footer>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { BiomarkerProgression } from "../components/BiomarkerProgression.tsx";
import { RiskBadge } from "../components/RiskBadge.tsx";
import { RiskProgressionChart } from "../components/RiskProgressionChart.tsx";
import { ScanComparison } from "../components/ScanComparison.tsx";
import {
  clearAllCases,
  deleteCase,
  formatCaseTime,
  formatVisitDate,
  getCase,
  groupCasesByPatient,
  loadCases,
  seedDemoLongitudinalCases,
  type CaseSummary,
  listCaseSummaries,
} from "../lib/cases.ts";
import { useSession } from "../state/SessionContext.tsx";
import type { DiagnoseSession } from "../state/types.ts";

type ViewMode = "longitudinal" | "flat";

export function HistoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSession, session } = useSession();

  const [version, setVersion] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("longitudinal");
  const [notification, setNotification] = useState<string | null>(null);

  // Load all sessions
  const allSessions = useMemo(() => {
    void version;
    return loadCases();
  }, [version]);
  const summaries = useMemo<CaseSummary[]>(() => {
    void version;
    return listCaseSummaries();
  }, [version]);

  // Group by patient
  const patientGroups = useMemo(() => groupCasesByPatient(allSessions), [allSessions]);

  // Read active patient from URL or default to first group
  const paramPatientId = searchParams.get("patientId");
  const activePatientId = useMemo(() => {
    if (paramPatientId && patientGroups.some((g) => g.patientId === paramPatientId)) {
      return paramPatientId;
    }
    return patientGroups[0]?.patientId || "";
  }, [paramPatientId, patientGroups]);

  const activeGroup = useMemo(
    () => patientGroups.find((g) => g.patientId === activePatientId) ?? patientGroups[0],
    [patientGroups, activePatientId],
  );

  function selectPatient(id: string) {
    setSearchParams({ patientId: id });
  }

  function openCase(id: string) {
    const stored = getCase(id);
    if (!stored) return;
    setSession(stored);
    navigate("/report");
  }

  function handleOpenReport(sessionObj: DiagnoseSession) {
    setSession(sessionObj);
    navigate("/report");
  }

  function removeCase(id: string) {
    deleteCase(id);
    if (session?.id === id) setSession(null);
    setVersion((v) => v + 1);
  }

  function handleClearAll() {
    if (window.confirm("Are you sure you want to clear all patient history? This cannot be undone.")) {
      clearAllCases();
      setSession(null);
      setVersion((v) => v + 1);
      setNotification("All case records have been cleared.");
      setTimeout(() => setNotification(null), 4000);
    }
  }

  function handleSeedDemo() {
    seedDemoLongitudinalCases();
    setVersion((v) => v + 1);
    selectPatient("PT-1001");
    setNotification(
      "Loaded sample longitudinal cohorts: PT-1001 (Cardio-Pulmonary) & PT-1002 (Metabolic Diabetes) with baseline and follow-up visits.",
    );
    setTimeout(() => setNotification(null), 5000);
  }

  // Calculate next visit suggestion
  const nextVisitWeek = activeGroup ? Math.max(4, activeGroup.totalVisits * 4) : 4;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-charcoal">
            Longitudinal Patient Tracking & History
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Track patient recovery across visits, compare baseline vs. follow-up scans with Grad-CAM,
            and visualize cardiovascular and metabolic risk curves.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSeedDemo}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-ivory hover:opacity-90"
          >
            ⚡ Load Demo Longitudinal Patients
          </button>
          <Link
            to="/"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-charcoal hover:bg-teal-tint"
          >
            + New Diagnosis
          </Link>
          {allSessions.length > 0 ? (
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-full border border-border px-3 py-2 text-sm text-muted hover:text-risk-high"
            >
              Clear All
            </button>
          ) : null}
        </div>
      </div>

      {notification ? (
        <div
          className="rounded-xl border border-primary/20 bg-teal-tint/40 px-4 py-3 text-sm font-medium text-primary flex items-center justify-between"
          role="status"
        >
          <span>{notification}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs text-muted hover:text-charcoal ml-2"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Empty State */}
      {allSessions.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-tint text-primary text-2xl font-bold">
            📈
          </div>
          <h2 className="mt-4 font-display text-2xl text-charcoal">No Patient Cases Yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Run a diagnosis or load our pre-configured longitudinal demo to see side-by-side chest X-rays,
            Grad-CAM heatmap diffs, and risk progression curves.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleSeedDemo}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-ivory"
            >
              ⚡ Load Demo Patients (Baseline & Week 4)
            </button>
            <Link
              to="/"
              className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium text-charcoal"
            >
              Go to Diagnose
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* View Mode Selector Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewMode("longitudinal")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  viewMode === "longitudinal"
                    ? "bg-primary text-ivory"
                    : "border border-border bg-card text-muted hover:text-charcoal"
                }`}
              >
                👥 Longitudinal Patient Dossiers ({patientGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("flat")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  viewMode === "flat"
                    ? "bg-primary text-ivory"
                    : "border border-border bg-card text-muted hover:text-charcoal"
                }`}
              >
                📋 All Case Records ({summaries.length})
              </button>
            </div>
            <span className="text-xs text-muted">
              {allSessions.length} total encounters across {patientGroups.length} patient cohorts
            </span>
          </div>

          {viewMode === "longitudinal" && activeGroup ? (
            <div className="space-y-6">
              {/* Patient Selector Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Patients:
                </span>
                {patientGroups.map((group) => {
                  const isActive = group.patientId === activeGroup.patientId;
                  const deltaPct = Math.round(group.riskDelta * 100);

                  return (
                    <button
                      key={group.patientId}
                      type="button"
                      onClick={() => selectPatient(group.patientId)}
                      className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-left text-xs transition ${
                        isActive
                          ? "border-primary bg-primary text-ivory ring-2 ring-primary/20 shadow-sm"
                          : "border-border bg-card text-charcoal hover:border-primary/40"
                      }`}
                    >
                      <div>
                        <span className="font-bold">{group.patientId}</span>
                        <span className={`ml-1.5 ${isActive ? "text-ivory/80" : "text-muted"}`}>
                          ({group.totalVisits} {group.totalVisits === 1 ? "visit" : "visits"})
                        </span>
                        <div
                          className={`mt-0.5 text-[11px] font-normal truncate max-w-[170px] ${
                            isActive ? "text-ivory/80" : "text-muted"
                          }`}
                        >
                          {group.latestCase.report.diagnosis}
                        </div>
                      </div>

                      {group.totalVisits > 1 ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isActive
                              ? "bg-ivory/20 text-ivory"
                              : group.riskDelta < 0
                                ? "bg-risk-low/15 text-risk-low"
                                : "bg-risk-high/15 text-risk-high"
                          }`}
                        >
                          {group.riskDelta < 0 ? `↓ ${Math.abs(deltaPct)}%` : `↑ +${deltaPct}%`}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Selected Patient Overview Header */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-3xl text-charcoal">
                        Patient {activeGroup.patientId}
                      </h2>
                      <span className="rounded-full bg-teal-tint px-3 py-1 text-xs font-semibold text-primary capitalize">
                        {activeGroup.dataset} Cohort
                      </span>
                      {activeGroup.improved ? (
                        <span className="rounded-full bg-risk-low/15 px-3 py-1 text-xs font-semibold text-risk-low ring-1 ring-risk-low/30">
                          Significant Clinical Improvement
                        </span>
                      ) : activeGroup.riskDelta > 0.05 ? (
                        <span className="rounded-full bg-risk-high/15 px-3 py-1 text-xs font-semibold text-risk-high ring-1 ring-risk-high/30">
                          Elevated Clinical Attention
                        </span>
                      ) : (
                        <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted ring-1 ring-border">
                          Stable Trajectory
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      Tracking {activeGroup.totalVisits} clinical encounters from{" "}
                      <strong className="text-charcoal font-medium">
                        {formatVisitDate(activeGroup.earliestCase.createdAt)}
                      </strong>{" "}
                      to{" "}
                      <strong className="text-charcoal font-medium">
                        {formatVisitDate(activeGroup.latestCase.createdAt)}
                      </strong>
                      . Latest diagnosis:{" "}
                      <strong className="text-primary font-medium">
                        {activeGroup.latestCase.report.diagnosis}
                      </strong>
                      .
                    </p>
                  </div>

                  {/* Add Next Visit CTA */}
                  <Link
                    to={`/?patientId=${encodeURIComponent(
                      activeGroup.patientId,
                    )}&visitLabel=${encodeURIComponent(
                      `Follow-up (Week ${nextVisitWeek})`,
                    )}&dataset=${activeGroup.dataset}`}
                    className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-ivory hover:opacity-90 shadow-sm"
                  >
                    + Record Follow-up Visit (Week {nextVisitWeek})
                  </Link>
                </div>
              </div>

              {/* 1. Risk Score Progression Curve */}
              <RiskProgressionChart cases={activeGroup.cases} />

              {/* 2. Key Biomarker Trajectories (Blood Pressure, Glucose, etc.) */}
              <BiomarkerProgression cases={activeGroup.cases} />

              {/* 3. Side-by-Side Scan & Clinical Comparison Engine */}
              <ScanComparison cases={activeGroup.cases} onOpenReport={handleOpenReport} />

              {/* 4. Chronological Encounter Timeline */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl text-charcoal">Encounter Timeline</h3>
                  <span className="text-xs text-muted">
                    {activeGroup.cases.length} recorded {activeGroup.cases.length === 1 ? "visit" : "visits"}
                  </span>
                </div>

                <div className="space-y-3">
                  {[...activeGroup.cases]
                    .reverse()
                    .map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition hover:border-primary/40"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-teal-tint px-2.5 py-0.5 text-xs font-bold text-primary">
                              {item.visitLabel || `Visit ${activeGroup.cases.length - idx}`}
                            </span>
                            <span className="font-display text-lg text-charcoal">
                              {item.report.diagnosis}
                            </span>
                          </div>
                          <p className="text-xs text-muted">
                            <span className="font-medium text-primary">{item.id}</span>
                            {" · "}
                            {formatCaseTime(item.createdAt)}
                            {" · "}
                            Image: {item.image.label} ({(item.image.confidence * 100).toFixed(0)}%) ·
                            Notes: {item.textPrediction.label}
                          </p>
                          <p className="text-xs text-muted line-clamp-1 italic">"{item.text}"</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <RiskBadge level={item.risk.level} score={item.risk.risk_score} />
                          <button
                            type="button"
                            onClick={() => openCase(item.id)}
                            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-ivory hover:opacity-90"
                          >
                            Open Report
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCase(item.id)}
                            className="rounded-full border border-border px-3 py-2 text-xs text-muted hover:text-risk-high"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          ) : (
            /* Flat List of All Scans */
            <div className="space-y-3">
              {summaries.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-ivory px-2 py-0.5 text-xs font-semibold text-charcoal ring-1 ring-border">
                        {item.patientId}
                      </span>
                      <span className="rounded-full bg-teal-tint px-2.5 py-0.5 text-xs font-medium text-primary">
                        {item.visitLabel}
                      </span>
                      <p className="font-display text-lg text-charcoal">{item.diagnosis}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      <span className="font-medium text-primary">{item.id}</span>
                      {" · "}
                      {formatCaseTime(item.createdAt)}
                      {" · "}
                      Dataset: {item.dataset}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Image {item.imageLabel} ({(item.imageConfidence * 100).toFixed(0)}%) · Notes{" "}
                      {item.notesLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge level={item.riskLevel} score={item.riskScore} />
                    <button
                      type="button"
                      onClick={() => openCase(item.id)}
                      className="rounded-full bg-primary px-4 py-2 text-sm text-ivory hover:opacity-90"
                    >
                      Open report
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCase(item.id)}
                      className="rounded-full border border-border px-4 py-2 text-sm text-muted hover:text-risk-high"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

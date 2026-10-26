import { History as HistoryIcon, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { BiomarkerProgression } from "../components/BiomarkerProgression.tsx";
import { RiskBadge } from "../components/RiskBadge.tsx";
import { RiskProgressionChart } from "../components/RiskProgressionChart.tsx";
import { ScanComparison } from "../components/ScanComparison.tsx";
import { Button, ButtonLink } from "../components/ui/Button.tsx";
import { Card, CardHeader } from "../components/ui/Card.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { SegmentedControl } from "../components/ui/SegmentedControl.tsx";
import { StatusBadge } from "../components/ui/StatusBadge.tsx";
import { cn } from "../lib/cn.ts";
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

  const allSessions = useMemo(() => {
    void version;
    return loadCases();
  }, [version]);
  const summaries = useMemo<CaseSummary[]>(() => {
    void version;
    return listCaseSummaries();
  }, [version]);

  const patientGroups = useMemo(() => groupCasesByPatient(allSessions), [allSessions]);

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
      "Loaded sample cohorts PT-1001 and PT-1002 with baseline and follow-up visits.",
    );
    setTimeout(() => setNotification(null), 5000);
  }

  const nextVisitWeek = activeGroup ? Math.max(4, activeGroup.totalVisits * 4) : 4;

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        description="Track recovery across visits, compare scans, and review risk over time."
        actions={
          <>
            <Button onClick={handleSeedDemo}>Load demo patients</Button>
            <ButtonLink to="/" variant="ghost">
              <Plus className="size-4" strokeWidth={1.75} />
              New diagnosis
            </ButtonLink>
            {allSessions.length > 0 ? (
              <Button variant="danger" onClick={handleClearAll}>
                Clear all
              </Button>
            ) : null}
          </>
        }
      />

      {notification ? (
        <div
          className="flex items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3 text-sm text-charcoal"
          role="status"
        >
          <span>{notification}</span>
          <Button variant="text" size="sm" className="h-8 px-2" onClick={() => setNotification(null)}>
            <X className="size-4" strokeWidth={1.75} />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      ) : null}

      {allSessions.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No patient cases yet"
          description="Run a diagnosis or load the demo cohort to see side-by-side scans and risk curves."
          action={<Button onClick={handleSeedDemo}>Load demo patients</Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              ariaLabel="History view"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "longitudinal", label: `Patients (${patientGroups.length})` },
                { value: "flat", label: `Records (${summaries.length})` },
              ]}
            />
            <span className="text-xs text-muted">
              {allSessions.length} encounters · {patientGroups.length} patients
            </span>
          </div>

          {viewMode === "longitudinal" && activeGroup ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                {patientGroups.map((group) => {
                  const isActive = group.patientId === activeGroup.patientId;
                  const deltaPct = Math.round(group.riskDelta * 100);
                  return (
                    <button
                      key={group.patientId}
                      type="button"
                      onClick={() => selectPatient(group.patientId)}
                      className={cn(
                        "rounded-card border px-3 py-2 text-left text-sm outline-none transition-colors duration-200",
                        "focus-visible:ring-2 focus-visible:ring-primary/30",
                        isActive
                          ? "border-primary bg-card text-charcoal"
                          : "border-border bg-card text-muted hover:text-charcoal",
                      )}
                    >
                      <span className="font-medium text-charcoal">{group.patientId}</span>
                      <span className="ml-1.5 text-xs text-muted">
                        {group.totalVisits} {group.totalVisits === 1 ? "visit" : "visits"}
                      </span>
                      {group.totalVisits > 1 ? (
                        <span className="ml-2 text-xs tabular-nums">
                          {group.riskDelta < 0 ? `↓ ${Math.abs(deltaPct)}%` : `↑ +${deltaPct}%`}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <Card>
                <CardHeader
                  title={`Patient ${activeGroup.patientId}`}
                  description={`${activeGroup.totalVisits} encounters from ${formatVisitDate(activeGroup.earliestCase.createdAt)} to ${formatVisitDate(activeGroup.latestCase.createdAt)}. Latest: ${activeGroup.latestCase.report.diagnosis}.`}
                  badge={
                    <>
                      <StatusBadge tone="primary">
                        {activeGroup.dataset === "heart" ? "Heart" : "Diabetes"}
                      </StatusBadge>
                      {activeGroup.improved ? (
                        <StatusBadge tone="success">Improving</StatusBadge>
                      ) : activeGroup.riskDelta > 0.05 ? (
                        <StatusBadge tone="danger">Needs attention</StatusBadge>
                      ) : (
                        <StatusBadge>Stable</StatusBadge>
                      )}
                    </>
                  }
                  action={
                    <ButtonLink
                      to={`/?patientId=${encodeURIComponent(activeGroup.patientId)}&visitLabel=${encodeURIComponent(`Follow-up (Week ${nextVisitWeek})`)}&dataset=${activeGroup.dataset}`}
                    >
                      Record follow-up
                    </ButtonLink>
                  }
                />
              </Card>

              <RiskProgressionChart cases={activeGroup.cases} />
              <BiomarkerProgression cases={activeGroup.cases} />
              <ScanComparison cases={activeGroup.cases} onOpenReport={handleOpenReport} />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl text-charcoal">Encounter timeline</h3>
                  <span className="text-xs text-muted">
                    {activeGroup.cases.length} {activeGroup.cases.length === 1 ? "visit" : "visits"}
                  </span>
                </div>
                <div className="space-y-2">
                  {[...activeGroup.cases].reverse().map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-card px-4 py-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge>
                            {item.visitLabel || `Visit ${activeGroup.cases.length - idx}`}
                          </StatusBadge>
                          <span className="font-medium text-charcoal">{item.report.diagnosis}</span>
                        </div>
                        <p className="text-xs text-muted">
                          {item.id} · {formatCaseTime(item.createdAt)} · {item.image.label}{" "}
                          {(item.image.confidence * 100).toFixed(0)}% · {item.textPrediction.label}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <RiskBadge level={item.risk.level} score={item.risk.risk_score} />
                        <Button size="sm" onClick={() => openCase(item.id)}>
                          Open report
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => removeCase(item.id)}>
                          <Trash2 className="size-3.5" strokeWidth={1.75} />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-2">
              {summaries.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge>{item.patientId}</StatusBadge>
                      <StatusBadge tone="primary">{item.visitLabel}</StatusBadge>
                      <p className="font-medium text-charcoal">{item.diagnosis}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {item.id} · {formatCaseTime(item.createdAt)} · {item.dataset}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge level={item.riskLevel} score={item.riskScore} />
                    <Button size="sm" onClick={() => openCase(item.id)}>
                      Open report
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => removeCase(item.id)}>
                      Delete
                    </Button>
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

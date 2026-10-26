import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { saveCase, withCaseMeta } from "../lib/cases.ts";
import type { DiagnoseSession, SessionDraft } from "./types.ts";

export type { DiagnoseSession, SessionDraft };

type SessionContextValue = {
  session: DiagnoseSession | null;
  setSession: (session: SessionDraft | DiagnoseSession | null) => DiagnoseSession | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = "healthcure.session";

function loadSession(): DiagnoseSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionDraft;
    if (!parsed?.report) return null;
    const stored = withCaseMeta({
      ...parsed,
      id: parsed.id ?? "",
      createdAt: parsed.createdAt ?? "",
    });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    saveCase(stored);
    return stored;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<DiagnoseSession | null>(loadSession);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      setSession: (next) => {
        if (!next) {
          setSessionState(null);
          sessionStorage.removeItem(STORAGE_KEY);
          return null;
        }
        const stored = withCaseMeta({
          ...next,
          id: next.id ?? "",
          createdAt: next.createdAt ?? "",
        });
        setSessionState(stored);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        saveCase(stored);
        return stored;
      },
    }),
    [session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

import type { DiagnoseSession } from "../state/types.ts";

const HISTORY_KEY = "healthcure.cases";
const MAX_CASES = 35;

export type CaseSummary = {
  id: string;
  patientId: string;
  visitLabel: string;
  createdAt: string;
  diagnosis: string;
  dataset: DiagnoseSession["dataset"];
  imageLabel: string;
  imageConfidence: number;
  notesLabel: string;
  riskLevel: DiagnoseSession["risk"]["level"];
  riskScore: number;
  features: Record<string, number>;
  originalImageUrl: string;
};

export type PatientGroup = {
  patientId: string;
  cases: DiagnoseSession[];
  latestCase: DiagnoseSession;
  earliestCase: DiagnoseSession;
  totalVisits: number;
  dataset: DiagnoseSession["dataset"];
  riskDelta: number; // latest.risk_score - earliest.risk_score
  improved: boolean;
};

export function newCaseId(): string {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "");
  const rand = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `HC-${stamp}-${rand}`;
}

export function derivePatientId(caseId: string): string {
  const parts = caseId.split("-");
  return parts.length >= 3 ? `PT-${parts[2]}` : "PT-1001";
}

export function withCaseMeta(session: DiagnoseSession): DiagnoseSession {
  const id = session.id || newCaseId();
  const patientId = session.patientId?.trim() || derivePatientId(id);
  const visitLabel = session.visitLabel?.trim() || "Baseline (Week 0)";
  return {
    ...session,
    id,
    patientId,
    visitLabel,
    createdAt: session.createdAt || new Date().toISOString(),
  };
}

export function loadCases(): DiagnoseSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDiagnoseSession);
  } catch {
    return [];
  }
}

export function listCaseSummaries(): CaseSummary[] {
  return loadCases()
    .map((item) => ({
      id: item.id,
      patientId: item.patientId || derivePatientId(item.id),
      visitLabel: item.visitLabel || "Baseline (Week 0)",
      createdAt: item.createdAt,
      diagnosis: item.report.diagnosis,
      dataset: item.dataset,
      imageLabel: item.image.label,
      imageConfidence: item.image.confidence,
      notesLabel: item.textPrediction.label,
      riskLevel: item.risk.level,
      riskScore: item.risk.risk_score,
      features: item.features,
      originalImageUrl: item.originalImageUrl,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function groupCasesByPatient(cases: DiagnoseSession[]): PatientGroup[] {
  const map = new Map<string, DiagnoseSession[]>();
  for (const c of cases) {
    const pid = c.patientId || derivePatientId(c.id);
    const existing = map.get(pid) ?? [];
    existing.push(c);
    map.set(pid, existing);
  }

  const groups: PatientGroup[] = [];
  for (const [patientId, patientCases] of map.entries()) {
    // Sort ascending by time (earliest first, latest last)
    const sorted = [...patientCases].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    const riskDelta = latest.risk.risk_score - earliest.risk.risk_score;
    groups.push({
      patientId,
      cases: sorted,
      latestCase: latest,
      earliestCase: earliest,
      totalVisits: sorted.length,
      dataset: latest.dataset,
      riskDelta,
      improved: riskDelta < -0.05,
    });
  }

  // Sort groups by latest case timestamp descending
  return groups.sort((a, b) => b.latestCase.createdAt.localeCompare(a.latestCase.createdAt));
}

export function listDistinctPatientIds(): string[] {
  const set = new Set<string>();
  for (const c of loadCases()) {
    set.add(c.patientId || derivePatientId(c.id));
  }
  return Array.from(set);
}

export function getCase(id: string): DiagnoseSession | null {
  return loadCases().find((item) => item.id === id) ?? null;
}

export function saveCase(session: DiagnoseSession): void {
  const next = withCaseMeta(session);
  const others = loadCases().filter((item) => item.id !== next.id);
  const cases = [next, ...others].slice(0, MAX_CASES);
  persistCases(cases);
}

export function deleteCase(id: string): void {
  persistCases(loadCases().filter((item) => item.id !== id));
}

export function clearAllCases(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

function persistCases(cases: DiagnoseSession[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(cases));
  } catch {
    if (cases.length <= 1) return;
    persistCases(cases.slice(0, Math.max(1, cases.length - 1)));
  }
}

function isDiagnoseSession(value: unknown): value is DiagnoseSession {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DiagnoseSession>;
  return Boolean(item.id && item.createdAt && item.report && item.image && item.risk);
}

export function formatCaseTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatVisitDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function compressDataUrl(url: string, maxEdge = 640, quality = 0.72): Promise<string> {
  if (!url.startsWith("data:") && !url.startsWith("blob:")) return url;
  const image = await loadImage(url);
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return url;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to read image for storage."));
    image.src = url;
  });
}

const PNEUMONIA_GRADCAM_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="inf1" cx="64%" cy="60%" r="35%">
      <stop offset="0%" stop-color="#ff2200" stop-opacity="0.92" />
      <stop offset="45%" stop-color="#ffaa00" stop-opacity="0.75" />
      <stop offset="75%" stop-color="#ffff00" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#0066ff" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="inf2" cx="36%" cy="56%" r="24%">
      <stop offset="0%" stop-color="#ff8800" stop-opacity="0.8" />
      <stop offset="65%" stop-color="#ffcc00" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#0066ff" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="transparent" />
  <ellipse cx="256" cy="240" rx="95" ry="115" fill="url(#inf1)" />
  <ellipse cx="144" cy="225" rx="65" ry="85" fill="url(#inf2)" />
</svg>
`.trim());

const NORMAL_GRADCAM_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="clearField" cx="50%" cy="50%" r="48%">
      <stop offset="0%" stop-color="#00bb99" stop-opacity="0.3" />
      <stop offset="65%" stop-color="#0066aa" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#000033" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="transparent" />
  <circle cx="200" cy="200" r="185" fill="url(#clearField)" />
</svg>
`.trim());

export function seedDemoLongitudinalCases(): DiagnoseSession[] {
  const now = new Date();
  const date4WeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const date2WeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const dateNow = now.toISOString();

  const demoCases: DiagnoseSession[] = [
    // Patient PT-1001: Respiratory Infection with Elevated Cardiovascular Risk -> Follow-up Recovery
    {
      id: "HC-DEMO-PT1001-W0",
      patientId: "PT-1001",
      visitLabel: "Baseline (Week 0)",
      createdAt: date4WeeksAgo,
      originalImageUrl: "/samples/pneumonia.jpg",
      text: "Four days of severe productive cough, fever 39.1°C, pleuritic chest pain on inspiration, and shortness of breath.",
      dataset: "heart",
      features: {
        age: 62,
        sex: 1,
        cp: 0,
        trestbps: 156,
        chol: 278,
        fbs: 1,
        restecg: 1,
        thalach: 124,
        exang: 1,
        oldpeak: 2.3,
        slope: 2,
        ca: 1,
        thal: 3,
      },
      image: {
        label: "PNEUMONIA",
        confidence: 0.942,
        probs: { NORMAL: 0.058, PNEUMONIA: 0.942 },
        gradcam_base64: PNEUMONIA_GRADCAM_SVG,
        mock: false,
      },
      textPrediction: {
        label: "Pneumonia",
        confidence: 0.915,
        top_3: [
          { label: "Pneumonia", confidence: 0.915 },
          { label: "Bronchitis", confidence: 0.062 },
          { label: "COVID-19", confidence: 0.023 },
        ],
        lime_word_weights: { cough: 0.42, fever: 0.38, pleuritic: 0.35, "shortness of breath": 0.31 },
        mock: false,
      },
      risk: {
        risk_score: 0.82,
        level: "high",
        shap_contributions: {
          trestbps: 0.28,
          chol: 0.21,
          oldpeak: 0.18,
          thalach: -0.12,
          age: 0.15,
        },
        mock: false,
      },
      report: {
        image: {
          label: "PNEUMONIA",
          confidence: 0.942,
          probs: { NORMAL: 0.058, PNEUMONIA: 0.942 },
          gradcam_base64: PNEUMONIA_GRADCAM_SVG,
          mock: false,
        },
        text: {
          label: "Pneumonia",
          confidence: 0.915,
          top_3: [
            { label: "Pneumonia", confidence: 0.915 },
            { label: "Bronchitis", confidence: 0.062 },
            { label: "COVID-19", confidence: 0.023 },
          ],
          lime_word_weights: { cough: 0.42, fever: 0.38, pleuritic: 0.35, "shortness of breath": 0.31 },
          mock: false,
        },
        risk: {
          risk_score: 0.82,
          level: "high",
          shap_contributions: {
            trestbps: 0.28,
            chol: 0.21,
            oldpeak: 0.18,
            thalach: -0.12,
            age: 0.15,
          },
          mock: false,
        },
        agreement: true,
        diagnosis: "Pneumonia with Elevated Cardiovascular Risk",
        next_step:
          "Seek urgent in-person care. Possible pneumonia plus elevated clinical risk warrants prompt evaluation of breathing, fever, and cardiovascular status.",
        disclaimer:
          "HealthCure is an educational decision-support prototype, not a medical device. Always consult a qualified clinician.",
      },
    },
    {
      id: "HC-DEMO-PT1001-W4",
      patientId: "PT-1001",
      visitLabel: "Follow-up (Week 4)",
      createdAt: dateNow,
      originalImageUrl: "/samples/normal.jpg",
      text: "Follow-up after completing antibiotic course and initiating antihypertensive regimen: cough fully resolved, no fever, breathing easily, walking 30 minutes daily.",
      dataset: "heart",
      features: {
        age: 62,
        sex: 1,
        cp: 2,
        trestbps: 126,
        chol: 212,
        fbs: 0,
        restecg: 0,
        thalach: 154,
        exang: 0,
        oldpeak: 0.5,
        slope: 0,
        ca: 0,
        thal: 1,
      },
      image: {
        label: "NORMAL",
        confidence: 0.928,
        probs: { NORMAL: 0.928, PNEUMONIA: 0.072 },
        gradcam_base64: NORMAL_GRADCAM_SVG,
        mock: false,
      },
      textPrediction: {
        label: "Normal / Recovered",
        confidence: 0.932,
        top_3: [
          { label: "Normal / Recovered", confidence: 0.932 },
          { label: "Mild Fatigue", confidence: 0.045 },
          { label: "Bronchitis", confidence: 0.023 },
        ],
        lime_word_weights: { resolved: -0.45, easily: -0.38, walking: -0.32, "no fever": -0.41 },
        mock: false,
      },
      risk: {
        risk_score: 0.34,
        level: "low",
        shap_contributions: {
          trestbps: -0.18,
          chol: -0.14,
          oldpeak: -0.22,
          thalach: -0.16,
          age: 0.12,
        },
        mock: false,
      },
      report: {
        image: {
          label: "NORMAL",
          confidence: 0.928,
          probs: { NORMAL: 0.928, PNEUMONIA: 0.072 },
          gradcam_base64: NORMAL_GRADCAM_SVG,
          mock: false,
        },
        text: {
          label: "Normal / Recovered",
          confidence: 0.932,
          top_3: [
            { label: "Normal / Recovered", confidence: 0.932 },
            { label: "Mild Fatigue", confidence: 0.045 },
            { label: "Bronchitis", confidence: 0.023 },
          ],
          lime_word_weights: { resolved: -0.45, easily: -0.38, walking: -0.32, "no fever": -0.41 },
          mock: false,
        },
        risk: {
          risk_score: 0.34,
          level: "low",
          shap_contributions: {
            trestbps: -0.18,
            chol: -0.14,
            oldpeak: -0.22,
            thalach: -0.16,
            age: 0.12,
          },
          mock: false,
        },
        agreement: true,
        diagnosis: "Normal / Lung Fields Cleared",
        next_step:
          "Clear imaging and low tabulated risk. Maintain healthy habits, activity routines, and attend scheduled cardiovascular screening.",
        disclaimer:
          "HealthCure is an educational decision-support prototype, not a medical device. Always consult a qualified clinician.",
      },
    },

    // Patient PT-1002: Metabolic & Diabetes Longitudinal Cohort
    {
      id: "HC-DEMO-PT1002-W0",
      patientId: "PT-1002",
      visitLabel: "Baseline (Week 0)",
      createdAt: date4WeeksAgo,
      originalImageUrl: "/samples/normal.jpg",
      text: "Unexplained weight gain, intense thirst (polydipsia), frequent nighttime urination (polyuria), and persistent lethargy for three weeks.",
      dataset: "diabetes",
      features: {
        Pregnancies: 3,
        Glucose: 194,
        BloodPressure: 88,
        SkinThickness: 34,
        Insulin: 215,
        BMI: 34.8,
        DiabetesPedigreeFunction: 0.78,
        Age: 49,
      },
      image: {
        label: "NORMAL",
        confidence: 0.88,
        probs: { NORMAL: 0.88, PNEUMONIA: 0.12 },
        gradcam_base64: NORMAL_GRADCAM_SVG,
        mock: false,
      },
      textPrediction: {
        label: "Diabetes",
        confidence: 0.941,
        top_3: [
          { label: "Diabetes", confidence: 0.941 },
          { label: "Hypertension", confidence: 0.04 },
          { label: "Hyperthyroidism", confidence: 0.019 },
        ],
        lime_word_weights: { thirst: 0.44, urination: 0.41, lethargy: 0.32 },
        mock: false,
      },
      risk: {
        risk_score: 0.86,
        level: "high",
        shap_contributions: {
          Glucose: 0.38,
          BMI: 0.24,
          Insulin: 0.16,
          Age: 0.12,
        },
        mock: false,
      },
      report: {
        image: {
          label: "NORMAL",
          confidence: 0.88,
          probs: { NORMAL: 0.88, PNEUMONIA: 0.12 },
          gradcam_base64: NORMAL_GRADCAM_SVG,
          mock: false,
        },
        text: {
          label: "Diabetes",
          confidence: 0.941,
          top_3: [
            { label: "Diabetes", confidence: 0.941 },
            { label: "Hypertension", confidence: 0.04 },
            { label: "Hyperthyroidism", confidence: 0.019 },
          ],
          lime_word_weights: { thirst: 0.44, urination: 0.41, lethargy: 0.32 },
          mock: false,
        },
        risk: {
          risk_score: 0.86,
          level: "high",
          shap_contributions: {
            Glucose: 0.38,
            BMI: 0.24,
            Insulin: 0.16,
            Age: 0.12,
          },
          mock: false,
        },
        agreement: false,
        diagnosis: "High Risk Metabolic Syndrome / Type 2 Diabetes",
        next_step:
          "High diabetes-related risk. Contact a clinician soon to review glucose, weight, and cardiovascular factors.",
        disclaimer:
          "HealthCure is an educational decision-support prototype, not a medical device. Always consult a qualified clinician.",
      },
    },
    {
      id: "HC-DEMO-PT1002-W2",
      patientId: "PT-1002",
      visitLabel: "Interim (Week 2)",
      createdAt: date2WeeksAgo,
      originalImageUrl: "/samples/normal.jpg",
      text: "Two weeks after medical dietary adjustment and metformin initiation: thirst diminished, waking up once at night instead of 4 times.",
      dataset: "diabetes",
      features: {
        Pregnancies: 3,
        Glucose: 154,
        BloodPressure: 82,
        SkinThickness: 33,
        Insulin: 160,
        BMI: 33.6,
        DiabetesPedigreeFunction: 0.78,
        Age: 49,
      },
      image: {
        label: "NORMAL",
        confidence: 0.89,
        probs: { NORMAL: 0.89, PNEUMONIA: 0.11 },
        gradcam_base64: NORMAL_GRADCAM_SVG,
        mock: false,
      },
      textPrediction: {
        label: "Diabetes",
        confidence: 0.81,
        top_3: [
          { label: "Diabetes", confidence: 0.81 },
          { label: "Normal / Recovered", confidence: 0.12 },
          { label: "Hypertension", confidence: 0.07 },
        ],
        lime_word_weights: { diminished: -0.32, adjustment: -0.28 },
        mock: false,
      },
      risk: {
        risk_score: 0.62,
        level: "moderate",
        shap_contributions: {
          Glucose: 0.22,
          BMI: 0.18,
          Insulin: 0.12,
        },
        mock: false,
      },
      report: {
        image: {
          label: "NORMAL",
          confidence: 0.89,
          probs: { NORMAL: 0.89, PNEUMONIA: 0.11 },
          gradcam_base64: NORMAL_GRADCAM_SVG,
          mock: false,
        },
        text: {
          label: "Diabetes",
          confidence: 0.81,
          top_3: [
            { label: "Diabetes", confidence: 0.81 },
            { label: "Normal / Recovered", confidence: 0.12 },
            { label: "Hypertension", confidence: 0.07 },
          ],
          lime_word_weights: { diminished: -0.32, adjustment: -0.28 },
          mock: false,
        },
        risk: {
          risk_score: 0.62,
          level: "moderate",
          shap_contributions: {
            Glucose: 0.22,
            BMI: 0.18,
            Insulin: 0.12,
          },
          mock: false,
        },
        agreement: false,
        diagnosis: "Moderate Diabetes Risk (Improving)",
        next_step: "Moderate diabetes risk. Continue lifestyle modifications and medication adherence.",
        disclaimer:
          "HealthCure is an educational decision-support prototype, not a medical device. Always consult a qualified clinician.",
      },
    },
    {
      id: "HC-DEMO-PT1002-W4",
      patientId: "PT-1002",
      visitLabel: "Follow-up (Week 4)",
      createdAt: dateNow,
      originalImageUrl: "/samples/normal.jpg",
      text: "One month post-intervention: energy returned to baseline, normal thirst, waking up refreshed, average fasting glucose 118 mg/dL.",
      dataset: "diabetes",
      features: {
        Pregnancies: 3,
        Glucose: 122,
        BloodPressure: 76,
        SkinThickness: 31,
        Insulin: 98,
        BMI: 31.8,
        DiabetesPedigreeFunction: 0.78,
        Age: 49,
      },
      image: {
        label: "NORMAL",
        confidence: 0.91,
        probs: { NORMAL: 0.91, PNEUMONIA: 0.09 },
        gradcam_base64: NORMAL_GRADCAM_SVG,
        mock: false,
      },
      textPrediction: {
        label: "Controlled / Stable",
        confidence: 0.89,
        top_3: [
          { label: "Controlled / Stable", confidence: 0.89 },
          { label: "Diabetes", confidence: 0.08 },
          { label: "Normal", confidence: 0.03 },
        ],
        lime_word_weights: { normal: -0.42, refreshed: -0.36, returned: -0.29 },
        mock: false,
      },
      risk: {
        risk_score: 0.38,
        level: "low",
        shap_contributions: {
          Glucose: -0.15,
          BMI: 0.08,
          BloodPressure: -0.11,
        },
        mock: false,
      },
      report: {
        image: {
          label: "NORMAL",
          confidence: 0.91,
          probs: { NORMAL: 0.91, PNEUMONIA: 0.09 },
          gradcam_base64: NORMAL_GRADCAM_SVG,
          mock: false,
        },
        text: {
          label: "Controlled / Stable",
          confidence: 0.89,
          top_3: [
            { label: "Controlled / Stable", confidence: 0.89 },
            { label: "Diabetes", confidence: 0.08 },
            { label: "Normal", confidence: 0.03 },
          ],
          lime_word_weights: { normal: -0.42, refreshed: -0.36, returned: -0.29 },
          mock: false,
        },
        risk: {
          risk_score: 0.38,
          level: "low",
          shap_contributions: {
            Glucose: -0.15,
            BMI: 0.08,
            BloodPressure: -0.11,
          },
          mock: false,
        },
        agreement: false,
        diagnosis: "Controlled Glycemia / Low Metabolic Risk",
        next_step:
          "Low tabulated diabetes risk. Maintain nutritious eating and regular activity, revisit screening on schedule.",
        disclaimer:
          "HealthCure is an educational decision-support prototype, not a medical device. Always consult a qualified clinician.",
      },
    },
  ];

  const existing = loadCases();
  // Merge demo cases while preventing duplicates
  const existingIds = new Set(existing.map((c) => c.id));
  const newCases = [...demoCases.filter((d) => !existingIds.has(d.id)), ...existing].slice(0, MAX_CASES);
  persistCases(newCases);
  return newCases;
}

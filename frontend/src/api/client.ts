import type { components } from "./types.ts";

export type HealthResponse = components["schemas"]["HealthResponse"];
export type ImagePrediction = components["schemas"]["ImagePrediction"];
export type TextRequest = components["schemas"]["TextRequest"];
export type TextPrediction = components["schemas"]["TextPrediction"];
export type RiskRequest = components["schemas"]["RiskRequest"];
export type RiskPrediction = components["schemas"]["RiskPrediction"];
export type ReportRequest = components["schemas"]["ReportRequest"];
export type ReportResponse = components["schemas"]["ReportResponse"];
export type MetricsResponse = components["schemas"]["MetricsResponse"];
export type DatasetName = RiskRequest["dataset"];
export type RiskLevel = RiskPrediction["level"];

export type ModelModalityCard = {
  id: string;
  name: string;
  version: string;
  architecture: string;
  task: string;
  training_data: string;
  evaluation_set: string;
  known_failure_modes: string[];
  intended_use: string;
  out_of_scope: string[];
};

export type ModelCardResponse = {
  product: string;
  version: string;
  last_evaluated: string | null;
  intended_use: string;
  disclaimer: string;
  modalities: ModelModalityCard[];
};

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(formatError(status, body));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function formatError(status: number, body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && "detail" in parsed) {
      const detail = (parsed as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      return JSON.stringify(detail);
    }
  } catch {
    /* use raw body */
  }
  return body || `Request failed with status ${status}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text);
  }
  return (await response.json()) as T;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health");
  return parseJson<HealthResponse>(response);
}

export async function getMetrics(): Promise<MetricsResponse> {
  const response = await fetch("/api/metrics");
  return parseJson<MetricsResponse>(response);
}

export async function getModelCard(): Promise<ModelCardResponse> {
  const response = await fetch("/api/model-card");
  const raw = await parseJson<Partial<ModelCardResponse>>(response);
  return {
    product: raw.product ?? "HealthCure",
    version: raw.version ?? "0.1.0",
    last_evaluated: raw.last_evaluated ?? null,
    intended_use: raw.intended_use ?? "",
    disclaimer: raw.disclaimer ?? "",
    modalities: (raw.modalities ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      version: item.version,
      architecture: item.architecture,
      task: item.task,
      training_data: item.training_data,
      evaluation_set: item.evaluation_set,
      known_failure_modes: item.known_failure_modes ?? [],
      intended_use: item.intended_use ?? "",
      out_of_scope: item.out_of_scope ?? [],
    })),
  };
}

export async function predictImage(file: File): Promise<ImagePrediction> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/image", { method: "POST", body });
  return parseJson<ImagePrediction>(response);
}

export async function predictText(payload: TextRequest): Promise<TextPrediction> {
  const response = await fetch("/api/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<TextPrediction>(response);
}

export async function predictRisk(payload: RiskRequest): Promise<RiskPrediction> {
  const response = await fetch("/api/risk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<RiskPrediction>(response);
}

export async function predictReport(payload: ReportRequest): Promise<ReportResponse> {
  const response = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<ReportResponse>(response);
}

export function toDataUrl(value: string, mime = "image/png"): string {
  if (value.startsWith("data:")) return value;
  return `data:${mime};base64,${value}`;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

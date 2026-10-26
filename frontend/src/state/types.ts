import type {
  DatasetName,
  ImagePrediction,
  ReportResponse,
  RiskPrediction,
  TextPrediction,
} from "../api/client.ts";

export type DiagnoseSession = {
  id: string;
  patientId?: string;
  visitLabel?: string;
  createdAt: string;
  originalImageUrl: string;
  text: string;
  dataset: DatasetName;
  features: Record<string, number>;
  image: ImagePrediction;
  textPrediction: TextPrediction;
  risk: RiskPrediction;
  report: ReportResponse;
};

export type SessionDraft = Omit<DiagnoseSession, "id" | "createdAt"> &
  Partial<Pick<DiagnoseSession, "id" | "createdAt">>;

import type { DatasetName } from "../api/client.ts";

export type SampleCase = {
  id: string;
  patientId?: string;
  visitLabel?: string;
  title: string;
  summary: string;
  imageUrl: string;
  fileName: string;
  notes: string;
  dataset: DatasetName;
  features: Record<string, number>;
};

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "pneumonia-heart",
    patientId: "PT-1001",
    visitLabel: "Baseline (Week 0)",
    title: "Fever and productive cough",
    summary: "Pediatric-style chest film with pneumonia-like opacities, plus heart-risk labs.",
    imageUrl: "/samples/pneumonia.jpg",
    fileName: "sample-pneumonia.jpg",
    notes:
      "Three days of high fever, productive cough, and shortness of breath. Chest pain worse with inspiration. No known COVID exposure. Reduced oral intake.",
    dataset: "heart",
    features: {
      age: 62,
      sex: 1,
      cp: 0,
      trestbps: 148,
      chol: 268,
      fbs: 1,
      restecg: 1,
      thalach: 128,
      exang: 1,
      oldpeak: 2.1,
      slope: 2,
      ca: 1,
      thal: 3,
    },
  },
  {
    id: "normal-heart",
    patientId: "PT-1001",
    visitLabel: "Follow-up (Week 4)",
    title: "Mild cough, clearer film",
    summary: "Visually normal chest X-ray with milder notes and typical heart features.",
    imageUrl: "/samples/normal.jpg",
    fileName: "sample-normal.jpg",
    notes:
      "Dry cough for two days after a cold. No fever now, mild fatigue, breathing comfortable at rest. Asking whether the chest film looks clear.",
    dataset: "heart",
    features: {
      age: 48,
      sex: 0,
      cp: 2,
      trestbps: 122,
      chol: 198,
      fbs: 0,
      restecg: 0,
      thalach: 162,
      exang: 0,
      oldpeak: 0.4,
      slope: 0,
      ca: 0,
      thal: 1,
    },
  },
  {
    id: "diabetes-metabolic",
    patientId: "PT-1002",
    visitLabel: "Baseline (Week 0)",
    title: "Polyuria and high glucose",
    summary: "Same demo film with diabetes features and metabolic symptom notes.",
    imageUrl: "/samples/normal.jpg",
    fileName: "sample-diabetes.jpg",
    notes:
      "Increased thirst and urination for two weeks, blurred vision, and family history of diabetes. Occasional chest tightness after meals. No acute respiratory distress.",
    dataset: "diabetes",
    features: {
      Pregnancies: 3,
      Glucose: 168,
      BloodPressure: 88,
      SkinThickness: 32,
      Insulin: 190,
      BMI: 34.2,
      DiabetesPedigreeFunction: 0.72,
      Age: 47,
    },
  },
];

export async function sampleFile(sample: SampleCase): Promise<File> {
  const response = await fetch(sample.imageUrl);
  if (!response.ok) throw new Error(`Could not load sample image ${sample.fileName}.`);
  const blob = await response.blob();
  return new File([blob], sample.fileName, { type: blob.type || "image/jpeg" });
}

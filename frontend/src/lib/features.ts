import type { DatasetName } from "../api/client.ts";

export type FieldKind = "number" | "select";

export type FeatureField = {
  name: string;
  label: string;
  hint: string;
  kind: FieldKind;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  options?: { value: number; label: string }[];
};

export const HEART_FIELDS: FeatureField[] = [
  { name: "age", label: "Age", hint: "Years", kind: "number", min: 20, max: 90, step: 1, defaultValue: 54 },
  {
    name: "sex",
    label: "Sex",
    hint: "Biological sex in the training data",
    kind: "select",
    min: 0,
    max: 1,
    step: 1,
    defaultValue: 1,
    options: [
      { value: 0, label: "Female (0)" },
      { value: 1, label: "Male (1)" },
    ],
  },
  {
    name: "cp",
    label: "Chest pain type",
    hint: "0 typical, 1 atypical, 2 non-anginal, 3 asymptomatic",
    kind: "select",
    min: 0,
    max: 3,
    step: 1,
    defaultValue: 0,
    options: [
      { value: 0, label: "Typical angina (0)" },
      { value: 1, label: "Atypical angina (1)" },
      { value: 2, label: "Non-anginal (2)" },
      { value: 3, label: "Asymptomatic (3)" },
    ],
  },
  { name: "trestbps", label: "Resting BP", hint: "mmHg", kind: "number", min: 80, max: 200, step: 1, defaultValue: 130 },
  { name: "chol", label: "Cholesterol", hint: "mg/dL", kind: "number", min: 100, max: 600, step: 1, defaultValue: 246 },
  {
    name: "fbs",
    label: "Fasting blood sugar",
    hint: "> 120 mg/dL",
    kind: "select",
    min: 0,
    max: 1,
    step: 1,
    defaultValue: 0,
    options: [
      { value: 0, label: "≤ 120 mg/dL (0)" },
      { value: 1, label: "> 120 mg/dL (1)" },
    ],
  },
  {
    name: "restecg",
    label: "Resting ECG",
    hint: "0 normal, 1 ST-T, 2 LVH",
    kind: "select",
    min: 0,
    max: 2,
    step: 1,
    defaultValue: 1,
    options: [
      { value: 0, label: "Normal (0)" },
      { value: 1, label: "ST-T abnormality (1)" },
      { value: 2, label: "LV hypertrophy (2)" },
    ],
  },
  { name: "thalach", label: "Max heart rate", hint: "bpm", kind: "number", min: 60, max: 220, step: 1, defaultValue: 150 },
  {
    name: "exang",
    label: "Exercise angina",
    hint: "Pain on exercise",
    kind: "select",
    min: 0,
    max: 1,
    step: 1,
    defaultValue: 0,
    options: [
      { value: 0, label: "No (0)" },
      { value: 1, label: "Yes (1)" },
    ],
  },
  { name: "oldpeak", label: "ST depression", hint: "oldpeak", kind: "number", min: 0, max: 6.2, step: 0.1, defaultValue: 1 },
  {
    name: "slope",
    label: "ST slope",
    hint: "Peak exercise ST segment",
    kind: "select",
    min: 0,
    max: 2,
    step: 1,
    defaultValue: 1,
    options: [
      { value: 0, label: "Upsloping (0)" },
      { value: 1, label: "Flat (1)" },
      { value: 2, label: "Downsloping (2)" },
    ],
  },
  { name: "ca", label: "Major vessels", hint: "Fluoroscopy count 0–3", kind: "number", min: 0, max: 3, step: 1, defaultValue: 0 },
  {
    name: "thal",
    label: "Thalassemia",
    hint: "1 normal, 2 fixed, 3 reversible",
    kind: "select",
    min: 0,
    max: 3,
    step: 1,
    defaultValue: 2,
    options: [
      { value: 0, label: "Unknown (0)" },
      { value: 1, label: "Normal (1)" },
      { value: 2, label: "Fixed defect (2)" },
      { value: 3, label: "Reversible defect (3)" },
    ],
  },
];

export const DIABETES_FIELDS: FeatureField[] = [
  { name: "Pregnancies", label: "Pregnancies", hint: "Count", kind: "number", min: 0, max: 17, step: 1, defaultValue: 2 },
  { name: "Glucose", label: "Glucose", hint: "mg/dL", kind: "number", min: 40, max: 200, step: 1, defaultValue: 120 },
  { name: "BloodPressure", label: "Blood pressure", hint: "mmHg", kind: "number", min: 40, max: 130, step: 1, defaultValue: 70 },
  { name: "SkinThickness", label: "Skin thickness", hint: "mm", kind: "number", min: 0, max: 99, step: 1, defaultValue: 20 },
  { name: "Insulin", label: "Insulin", hint: "µU/mL", kind: "number", min: 0, max: 900, step: 1, defaultValue: 80 },
  { name: "BMI", label: "BMI", hint: "kg/m²", kind: "number", min: 15, max: 70, step: 0.1, defaultValue: 28 },
  {
    name: "DiabetesPedigreeFunction",
    label: "Pedigree function",
    hint: "Family history score",
    kind: "number",
    min: 0.05,
    max: 2.5,
    step: 0.01,
    defaultValue: 0.4,
  },
  { name: "Age", label: "Age", hint: "Years", kind: "number", min: 21, max: 90, step: 1, defaultValue: 33 },
];

export function fieldsFor(dataset: DatasetName): FeatureField[] {
  return dataset === "heart" ? HEART_FIELDS : DIABETES_FIELDS;
}

export function defaultFeatures(dataset: DatasetName): Record<string, number> {
  return Object.fromEntries(fieldsFor(dataset).map((field) => [field.name, field.defaultValue]));
}

import type { DatasetName } from "../api/client.ts";

export type FieldKind = "number" | "select";

export type FeatureField = {
  name: string;
  label: string;
  group: string;
  unit?: string;
  hint?: string;
  kind: FieldKind;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  options?: { value: number; label: string }[];
};

export const HEART_FIELDS: FeatureField[] = [
  {
    name: "age",
    label: "Age",
    group: "Demographics",
    unit: "yr",
    kind: "number",
    min: 20,
    max: 90,
    step: 1,
    defaultValue: 54,
  },
  {
    name: "sex",
    label: "Sex",
    group: "Demographics",
    hint: "Biological sex as coded in the training data.",
    kind: "select",
    min: 0,
    max: 1,
    step: 1,
    defaultValue: 1,
    options: [
      { value: 0, label: "Female" },
      { value: 1, label: "Male" },
    ],
  },
  {
    name: "trestbps",
    label: "Resting BP",
    group: "Vitals and labs",
    unit: "mmHg",
    kind: "number",
    min: 80,
    max: 200,
    step: 1,
    defaultValue: 130,
  },
  {
    name: "chol",
    label: "Cholesterol",
    group: "Vitals and labs",
    unit: "mg/dL",
    kind: "number",
    min: 100,
    max: 600,
    step: 1,
    defaultValue: 246,
  },
  {
    name: "fbs",
    label: "Fasting glucose",
    group: "Vitals and labs",
    hint: "Whether fasting blood sugar exceeded 120 mg/dL.",
    kind: "select",
    min: 0,
    max: 1,
    step: 1,
    defaultValue: 0,
    options: [
      { value: 0, label: "120 mg/dL or below" },
      { value: 1, label: "Above 120 mg/dL" },
    ],
  },
  {
    name: "thalach",
    label: "Max heart rate",
    group: "Vitals and labs",
    unit: "bpm",
    kind: "number",
    min: 60,
    max: 220,
    step: 1,
    defaultValue: 150,
  },
  {
    name: "cp",
    label: "Chest pain",
    group: "ECG and exercise",
    hint: "Chest-pain category used by the heart-risk model.",
    kind: "select",
    min: 0,
    max: 3,
    step: 1,
    defaultValue: 0,
    options: [
      { value: 0, label: "Typical angina" },
      { value: 1, label: "Atypical angina" },
      { value: 2, label: "Non-anginal" },
      { value: 3, label: "Asymptomatic" },
    ],
  },
  {
    name: "restecg",
    label: "Resting ECG",
    group: "ECG and exercise",
    hint: "Resting electrocardiographic result.",
    kind: "select",
    min: 0,
    max: 2,
    step: 1,
    defaultValue: 1,
    options: [
      { value: 0, label: "Normal" },
      { value: 1, label: "ST-T abnormality" },
      { value: 2, label: "Left ventricular hypertrophy" },
    ],
  },
  {
    name: "exang",
    label: "Exercise angina",
    group: "ECG and exercise",
    hint: "Whether exercise induced angina.",
    kind: "select",
    min: 0,
    max: 1,
    step: 1,
    defaultValue: 0,
    options: [
      { value: 0, label: "No" },
      { value: 1, label: "Yes" },
    ],
  },
  {
    name: "oldpeak",
    label: "ST depression",
    group: "ECG and exercise",
    unit: "mm",
    hint: "ST depression induced by exercise relative to rest.",
    kind: "number",
    min: 0,
    max: 6.2,
    step: 0.1,
    defaultValue: 1,
  },
  {
    name: "slope",
    label: "ST slope",
    group: "ECG and exercise",
    hint: "Slope of the peak exercise ST segment.",
    kind: "select",
    min: 0,
    max: 2,
    step: 1,
    defaultValue: 1,
    options: [
      { value: 0, label: "Upsloping" },
      { value: 1, label: "Flat" },
      { value: 2, label: "Downsloping" },
    ],
  },
  {
    name: "ca",
    label: "Major vessels",
    group: "ECG and exercise",
    unit: "n",
    hint: "Number of major vessels colored by fluoroscopy.",
    kind: "number",
    min: 0,
    max: 3,
    step: 1,
    defaultValue: 0,
  },
  {
    name: "thal",
    label: "Thalassemia",
    group: "ECG and exercise",
    hint: "Thalium stress-test result.",
    kind: "select",
    min: 0,
    max: 3,
    step: 1,
    defaultValue: 2,
    options: [
      { value: 0, label: "Unknown" },
      { value: 1, label: "Normal" },
      { value: 2, label: "Fixed defect" },
      { value: 3, label: "Reversible defect" },
    ],
  },
];

export const DIABETES_FIELDS: FeatureField[] = [
  {
    name: "Age",
    label: "Age",
    group: "Demographics",
    unit: "yr",
    kind: "number",
    min: 21,
    max: 90,
    step: 1,
    defaultValue: 33,
  },
  {
    name: "Pregnancies",
    label: "Pregnancies",
    group: "Demographics",
    unit: "n",
    kind: "number",
    min: 0,
    max: 17,
    step: 1,
    defaultValue: 2,
  },
  {
    name: "Glucose",
    label: "Glucose",
    group: "Vitals and labs",
    unit: "mg/dL",
    kind: "number",
    min: 40,
    max: 200,
    step: 1,
    defaultValue: 120,
  },
  {
    name: "BloodPressure",
    label: "Blood pressure",
    group: "Vitals and labs",
    unit: "mmHg",
    kind: "number",
    min: 40,
    max: 130,
    step: 1,
    defaultValue: 70,
  },
  {
    name: "SkinThickness",
    label: "Skin thickness",
    group: "Vitals and labs",
    unit: "mm",
    kind: "number",
    min: 0,
    max: 99,
    step: 1,
    defaultValue: 20,
  },
  {
    name: "Insulin",
    label: "Insulin",
    group: "Vitals and labs",
    unit: "µU/mL",
    kind: "number",
    min: 0,
    max: 900,
    step: 1,
    defaultValue: 80,
  },
  {
    name: "BMI",
    label: "BMI",
    group: "Vitals and labs",
    unit: "kg/m²",
    kind: "number",
    min: 15,
    max: 70,
    step: 0.1,
    defaultValue: 28,
  },
  {
    name: "DiabetesPedigreeFunction",
    label: "Pedigree",
    group: "Vitals and labs",
    hint: "Diabetes pedigree function — a family-history score.",
    kind: "number",
    min: 0.05,
    max: 2.5,
    step: 0.01,
    defaultValue: 0.4,
  },
];

export function fieldsFor(dataset: DatasetName): FeatureField[] {
  return dataset === "heart" ? HEART_FIELDS : DIABETES_FIELDS;
}

export function defaultFeatures(dataset: DatasetName): Record<string, number> {
  return Object.fromEntries(fieldsFor(dataset).map((field) => [field.name, field.defaultValue]));
}

export function groupedFields(dataset: DatasetName): { title: string; fields: FeatureField[] }[] {
  const groups: { title: string; fields: FeatureField[] }[] = [];
  for (const field of fieldsFor(dataset)) {
    const last = groups[groups.length - 1];
    if (last && last.title === field.group) {
      last.fields.push(field);
    } else {
      groups.push({ title: field.group, fields: [field] });
    }
  }
  return groups;
}

const NAMES: Record<string, string> = {
  resnet50: "ResNet50",
  ResNet50: "ResNet50",
  tiny_cnn: "Baseline CNN",
  baseline_cnn: "Baseline CNN",
  cnn: "Baseline CNN",
  logistic_regression: "Logistic regression",
  random_forest: "Random forest",
  xgboost: "XGBoost",
  svm: "SVM",
  bert: "BERT",
  tfidf: "TF-IDF",
  clinical_bert: "Clinical BERT",
};

export function friendlyModelName(raw: string): string {
  if (NAMES[raw]) return NAMES[raw];
  return raw
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

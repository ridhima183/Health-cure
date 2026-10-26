# HealthCure — Complete Execution & Operational Guide (`run.md`)

An end-to-end, reproducible guide for setting up, training, evaluating, running, testing, and deploying **HealthCure**: an explainable multimodal clinical decision-support system.

---

## Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Prerequisites & System Requirements](#2-prerequisites--system-requirements)
3. [Repository Structure](#3-repository-structure)
4. [Environment Setup & Installation](#4-environment-setup--installation)
   - [4.1 Python Environment & Dependencies](#41-python-environment--dependencies)
   - [4.2 Frontend Dependencies](#42-frontend-dependencies)
   - [4.3 Environment Variables Reference](#43-environment-variables-reference)
5. [Data Discovery & Verification](#5-data-discovery--verification)
   - [5.1 Content-Based Discovery](#51-content-based-discovery)
   - [5.2 Dataset Verification Command](#52-dataset-verification-command)
   - [5.3 Exploratory Data Analysis (EDA)](#53-exploratory-data-analysis-eda)
6. [Model Training & Artifacts Generation](#6-model-training--artifacts-generation)
   - [6.1 Tabular Risk Models (Heart & Diabetes)](#61-tabular-risk-models-heart--diabetes)
   - [6.2 Symptom Text Classifier (DistilBERT + Baseline)](#62-symptom-text-classifier-distilbert--baseline)
   - [6.3 Chest X-Ray Classifier (ResNet50 + Baseline CNN)](#63-chest-x-ray-classifier-resnet50--baseline-cnn)
   - [6.4 Artifacts & Metrics Manifest](#64-artifacts--metrics-manifest)
7. [Stand-Alone CLI & Explainability Inferences](#7-stand-alone-cli--explainability-inferences)
8. [Running the Application](#8-running-the-application)
   - [8.1 Quick Start (Mock Mode)](#81-quick-start-mock-mode)
   - [8.2 Production Start (Live Models Mode)](#82-production-start-live-models-mode)
   - [8.3 Starting the Backend (FastAPI / Uvicorn)](#83-starting-the-backend-fastapi--uvicorn)
   - [8.4 Starting the Frontend (Vite / React)](#84-starting-the-frontend-vite--react)
   - [8.5 Running Both Simultaneously](#85-running-both-simultaneously)
9. [Application Interface & Workflow Tour](#9-application-interface--workflow-tour)
10. [API Reference & Contract](#10-api-reference--contract)
    - [10.1 Endpoints Summary](#101-endpoints-summary)
    - [10.2 OpenAPI Export & TypeScript Code Generation](#102-openapi-export--typescript-code-generation)
11. [Testing & Quality Assurance](#11-testing--quality-assurance)
    - [11.1 Backend Pytest Suite](#111-backend-pytest-suite)
    - [11.2 Frontend TypeScript Check & Build](#112-frontend-typescript-check--build)
    - [11.3 Frontend Code Linting](#113-frontend-code-linting)
12. [Production Deployment & Containerization](#12-production-deployment--containerization)
13. [Troubleshooting & FAQ](#13-troubleshooting--faq)
14. [Clinical Safety & Ethics Disclaimer](#14-clinical-safety--ethics-disclaimer)

---

## 1. System Overview & Architecture

HealthCure combines three complementary modalities with state-of-the-art model explainability to support clinical triage and workflow:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            HEALTHCURE ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

       [Chest X-Ray]                 [Symptom Notes]            [Lab & Vitals]
             │                              │                          │
             ▼                              ▼                          ▼
   ResNet50 Classifier           DistilBERT Classifier       PyTorch MLP & Trees
     (Pneumonia/Normal)            (24 Disease Classes)     (Heart/Diabetes Risk)
             │                              │                          │
             ▼                              ▼                          ▼
         Grad-CAM                         LIME                        SHAP
   Visual Saliency Map           Word Importance Scores     Feature Contributions
             │                              │                          │
             └──────────────────────┬───────┴──────────────────────────┘
                                    │
                                    ▼
                     Multimodal Fusion Engine
                     ├─ Cross-Modality Agreement
                     ├─ Fused Primary Diagnosis
                     ├─ Risk-Stratified Action Plan
                     └─ Clinical Safety Disclaimers
                                    │
                                    ▼
                        FastAPI REST Backend (:8000)
                                    ▲
                                    │ Reverse Proxy (/api)
                                    ▼
                     React 19 + Vite Frontend (:5173)
                     ├─ Multimodal Diagnostic Console
                     ├─ Interactive Heatmaps & Explanations
                     ├─ Longitudinal Patient History
                     ├─ Model Validation & ROC Analytics
                     └─ Model Governance & Transparency Card
```

- **Vision Modality**: Fine-tuned ResNet50 (and a lightweight baseline CNN) diagnosing Normal vs. Pneumonia on chest radiographs, explained with PyTorch Grad-CAM heatmaps.
- **Text Modality**: Fine-tuned DistilBERT (and a TF-IDF Logistic Regression baseline) categorizing free-text symptoms across 24 diseases, explained with LIME word-level importance weights.
- **Tabular Modality**: PyTorch Multi-Layer Perceptron (MLP), XGBoost, Random Forest, and Logistic Regression risk scoring on Cleveland Heart Disease and Pima Indian Diabetes cohorts, explained with SHAP feature contribution attributions.
- **Fused Report Engine**: Cross-references image findings and NLP predictions to verify diagnostic agreement, factors in the tabular risk profile, and formulates structured next-step clinical recommendations.

---

## 2. Prerequisites & System Requirements

### Hardware Requirements
- **CPU**: Dual-core x86_64 or Apple Silicon (quad-core or higher recommended for faster training).
- **RAM**: 8 GB minimum; 16 GB recommended when training all models locally.
- **Storage**: ~3 GB free disk space (for PyTorch checkpoints, Transformer weights, and datasets).
- **GPU (Optional)**: NVIDIA GPU with CUDA 11.8+ / 12.1+ supported for PyTorch acceleration. CPU-only execution is fully supported out-of-the-box.

### Software Requirements
- **Operating System**: Windows 10/11, Ubuntu 20.04/22.04/24.04, Debian 11+, macOS 12+ (tested on Windows 11 with PowerShell).
- **Python**: Version `3.10`, `3.11`, `3.12`, `3.13`, or `3.14` (verified on Python 3.14.3).
- **Node.js & npm**: Node.js `18.x` or higher (verified on Node 20+ and npm 10+).
- **Git**: For source control.

---

## 3. Repository Structure

```
HealthCure/
├── backend/                    # FastAPI web server and routing
│   ├── main.py                 # App entrypoint, middleware, /api router, 10MB upload guard
│   ├── openapi.json            # OpenAPI 3.1 schema specification
│   ├── schemas.py              # Pydantic v2 request/response models
│   ├── services/               # Model integration and business logic
│   │   ├── __init__.py         # Mock mode toggle (HEALTHCURE_MOCK)
│   │   ├── image.py            # ResNet50 loader + Grad-CAM service
│   │   ├── metrics.py          # Cached evaluation metrics loader
│   │   ├── model_card.py       # Model card and evaluation metadata
│   │   ├── report.py           # Multimodal fusion and triage recommendations
│   │   ├── risk.py             # Tabular MLP + SHAP attribution service
│   │   └── text.py             # DistilBERT + LIME explanation service
│   └── tests/                  # Pytest test suite (23 integration tests)
│       ├── test_api.py         # HTTP endpoint tests & validation rules
│       ├── test_image.py       # Grad-CAM and ResNet validation
│       ├── test_model_card.py  # Model governance card verification
│       └── test_text.py        # NLP prediction and LIME testing
│
├── datasets/                   # Medical datasets (content-discovered)
│   ├── chest_xray/             # Pediatric Chest X-ray dataset (train/val/test)
│   ├── Heartdisease-dataset/   # Cleveland Heart Disease (processed.cleveland.data)
│   ├── Symptom2Disease.csv     # 1,200 symptom descriptions across 24 diseases
│   └── dataset_37_diabetes.arff# Pima Indians Diabetes ARFF database
│
├── frontend/                   # React 19 + TypeScript + Vite SPA
│   ├── index.html              # HTML shell
│   ├── package.json            # Node dependencies and scripts
│   ├── vite.config.ts          # Vite configuration with /api -> :8000 proxy
│   ├── src/
│   │   ├── App.tsx             # Root component and navigation bar
│   │   ├── api/                # API client and generated TypeScript types
│   │   │   ├── client.ts       # Typed fetch wrapper & error handler
│   │   │   └── types.ts        # Generated OpenAPI TypeScript interfaces
│   │   ├── components/         # Reusable UI widgets
│   │   │   ├── ImageUpload.tsx # Drag-and-drop chest X-ray dropzone
│   │   │   ├── ModelCard.tsx   # Model transparency cards
│   │   │   └── SampleCases.tsx # Quick-load clinical demonstration cases
│   │   ├── lib/                # Utility functions, case compression, features
│   │   ├── pages/              # Primary view pages
│   │   │   ├── Diagnose.tsx    # Multimodal diagnostic input console
│   │   │   ├── History.tsx     # Longitudinal patient visit timeline
│   │   │   ├── ModelCardPage.tsx# Model governance & ethics page
│   │   │   ├── Performance.tsx # Live metrics, ROC curves & confusion matrices
│   │   │   └── Report.tsx      # Comprehensive fused report with PDF export
│   │   └── state/              # Patient session context & state
│
├── models/                     # Trained weights and bundles
│   ├── image/                  # resnet50_pneumonia.pt, baseline_cnn.pt
│   ├── tabular/                # heart/ and diabetes/ (mlp.pt, bundle.joblib, background.npy)
│   └── text/                   # DistilBERT model.safetensors, tokenizer, bundle.joblib
│
├── reports/                    # Generated metrics, summaries, and plots
│   ├── eda_summary.json        # Quantitative EDA statistics
│   ├── model_card.json         # Static model card specification
│   ├── figures/                # EDA and Grad-CAM sample figures
│   └── metrics/                # image.json, text.json, tabular.json, and ROC/calibration plots
│
├── scripts/
│   └── export_openapi.py       # Dumps FastAPI schema to backend/openapi.json
│
├── src/                        # Machine learning library and pipelines
│   ├── common/                 # Data loaders and path auto-discovery
│   │   ├── data.py             # Robust CSV and ARFF data loaders
│   │   └── paths.py            # Content-based dataset locator
│   ├── eda.py                  # Exploratory data analysis pipeline
│   ├── image/                  # ResNet50 training and Grad-CAM explanation module
│   ├── tabular/                # MLP/Trees training and SHAP explanation module
│   └── text/                   # DistilBERT training and LIME explanation module
│
├── requirements.txt            # Python dependencies
└── run.md                      # This comprehensive operational runbook
```

---

## 4. Environment Setup & Installation

### 4.1 Python Environment & Dependencies

1. **Open your terminal or PowerShell** and navigate to the project root:
   ```bash
   cd "e:\project folder\HealthCure"
   ```

2. **Create a virtual environment** (recommended to isolate dependencies):
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Upgrade pip and install required packages**:
   ```bash
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

   *Core dependencies included:*
   - Data & ML: `numpy`, `pandas`, `scikit-learn`, `xgboost`, `matplotlib`
   - Deep Learning & XAI: `torch`, `torchvision`, `transformers`, `shap`, `lime`, `grad-cam`, `Pillow`
   - API Framework: `fastapi`, `uvicorn[standard]`, `pydantic`, `python-multipart`
   - Testing: `pytest`, `httpx`

### 4.2 Frontend Dependencies

1. Navigate into the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install Node modules:
   ```bash
   npm install
   ```

3. Return to project root:
   ```bash
   cd ..
   ```

### 4.3 Environment Variables Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `HEALTHCURE_DATA` | Automatically discovered (`datasets` or `dataset`) | Path to root folder containing medical datasets. |
| `HEALTHCURE_MOCK` | `0` (or empty) | When set to `1`, `true`, or `yes`, forces all backend services to use lightweight mock data without loading PyTorch weights or transformers. |
| `PORT` (Uvicorn) | `8000` | Port for the FastAPI backend server. |
| `VITE_PORT` | `5173` | Port for the Vite dev frontend server. |

---

## 5. Data Discovery & Verification

### 5.1 Content-Based Discovery
HealthCure uses intelligent, content-based discovery rather than hard-coded file paths in [`src/common/paths.py`](file:///e:/project%20folder/HealthCure/src/common/paths.py):
- Scans `datasets/` and `dataset/` directories.
- Identifies X-ray sets by searching for directories containing `train/NORMAL` and `train/PNEUMONIA`.
- Identifies text CSV by detecting `label` and `text` columns.
- Identifies heart tabular data by detecting `cp` and `chol` columns or 14-column UCI formats.
- Identifies diabetes tabular data by parsing ARFF attributes or detecting `Outcome` columns.

### 5.2 Dataset Verification Command
Run the discovery script to inspect and verify dataset presence:

```bash
python -m src.common.paths
```

*Expected output format:*
```text
Dataset root: E:\project folder\HealthCure\datasets
xray:     E:\project folder\HealthCure\datasets\chest_xray | images: 17568
text:     E:\project folder\HealthCure\datasets\Symptom2Disease.csv | rows: 1200
heart:    E:\project folder\HealthCure\datasets\Heartdisease-dataset\processed.cleveland.data | rows: 303
diabetes: E:\project folder\HealthCure\datasets\dataset_37_diabetes.arff | rows: 768
```

### 5.3 Exploratory Data Analysis (EDA)
Generate data distribution figures, class balances, and demographic statistics:

```bash
python -m src.eda
```

*Outputs produced:*
- Quantitative report: [`reports/eda_summary.json`](file:///e:/project%20folder/HealthCure/reports/eda_summary.json)
- Visualizations: [`reports/figures/`](file:///e:/project%20folder/HealthCure/reports/figures/) (image distributions, symptom length histograms, correlation matrices).

---

## 6. Model Training & Artifacts Generation

*(Note: Pre-trained weights and metric benchmarks are already provided in `models/` and `reports/metrics/`. Re-training is optional and can be run whenever updated models are desired.)*

### 6.1 Tabular Risk Models (Heart & Diabetes)
Trains Logistic Regression, Random Forest, XGBoost, and a PyTorch MLP with background dataset generation for SHAP explainability:

```bash
python -m src.tabular.train
```
- **Inputs**: Cleveland Heart data and Pima Diabetes data.
- **Outputs**:
  - `models/tabular/heart/` (`mlp.pt`, `bundle.joblib`, `background.npy`)
  - `models/tabular/diabetes/` (`mlp.pt`, `bundle.joblib`, `background.npy`)
  - `reports/metrics/tabular.json`
  - ROC and calibration curve PNGs in `reports/metrics/`.

### 6.2 Symptom Text Classifier (DistilBERT + Baseline)
Trains DistilBERT sequence classification and a TF-IDF Logistic Regression baseline:

- **Quick verification run (CPU-friendly, ~1 minute)**:
  ```bash
  python -m src.text.train --quick
  ```

- **Full fine-tuning (recommended if GPU or time permits)**:
  ```bash
  python -m src.text.train --epochs 4 --lr 3e-5 --max-len 128
  ```
- **Outputs**:
  - `models/text/` (`model.safetensors`, `config.json`, `label_map.json`, `tokenizer.json`, `bundle.joblib`)
  - `reports/metrics/text.json`

### 6.3 Chest X-Ray Classifier (ResNet50 + Baseline CNN)
Fine-tunes ResNet50 with transfer learning on chest radiographs alongside a baseline CNN:

- **Quick verification run (small subset, ~2 minutes)**:
  ```bash
  python -m src.image.train --quick
  ```

- **Full production fine-tuning**:
  ```bash
  python -m src.image.train --epochs-head 2 --epochs-full 4 --batch-size 32
  ```
- **Outputs**:
  - `models/image/resnet50_pneumonia.pt`
  - `models/image/baseline_cnn.pt`
  - `reports/metrics/image.json`
  - Saliency and ROC plots in `reports/metrics/` and `reports/figures/`.

### 6.4 Artifacts & Metrics Manifest
The system automatically populates the `reports/metrics/` directory with standardized JSON evaluations:
- `image.json`: Accuracy, sensitivity, specificity, F1-score, ROC-AUC, confusion matrices for ResNet50 vs. Baseline CNN.
- `text.json`: Macro F1, per-class metrics, confusion matrices comparing DistilBERT vs. TF-IDF baseline.
- `tabular.json`: Test metrics, Brier score, calibration loss, and ROC curves across all tabular classifiers.

---

## 7. Stand-Alone CLI & Explainability Inferences

You can test individual model explainability pipelines directly from the terminal without starting the web servers:

### 1. Test Chest X-Ray Grad-CAM Heatmap
```bash
python -m src.image.explain --save-examples
```
*Generates sample Grad-CAM overlay images in `reports/figures/` (e.g. `gradcam_correct_1.png`).*

To test on a custom image:
```bash
python -m src.image.explain --image "datasets/chest_xray/test/PNEUMONIA/person1_virus_6.jpeg"
```

### 2. Test Symptom Text Classification & LIME
```bash
python -m src.text.explain "patient has persistent high fever, cough with sputum, and sharp chest pain"
```
*Displays predicted disease, top-3 candidates with confidence scores, and word-level LIME influence weights.*

### 3. Test Tabular Risk Scoring & SHAP Contributions
Run a quick Python command:
```bash
python -c "from src.tabular.explain import explain_risk; print(explain_risk('heart', {'age': 55, 'sex': 1, 'cp': 0, 'trestbps': 140, 'chol': 250, 'fbs': 0, 'restecg': 1, 'thalach': 145, 'exang': 0, 'oldpeak': 1.2, 'slope': 1, 'ca': 0, 'thal': 2}))"
```
*Returns `risk_score`, `level` ('low'/'moderate'/'high'), and feature-by-feature SHAP contributions.*

---

## 8. Running the Application

### 8.1 Quick Start (Mock Mode)
Mock mode allows running both backend and frontend with **zero latency** and minimal RAM, without loading heavy deep-learning checkpoints:

- **Windows (PowerShell)**:
  ```powershell
  $env:HEALTHCURE_MOCK = "1"
  uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
  ```
- **Linux / macOS**:
  ```bash
  HEALTHCURE_MOCK=1 uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
  ```

### 8.2 Production Start (Live Models Mode)
By default (`HEALTHCURE_MOCK=0`), the backend loads your trained ResNet50, DistilBERT, and Tabular PyTorch MLP models with live Grad-CAM, LIME, and SHAP explainers.

### 8.3 Starting the Backend (FastAPI / Uvicorn)

1. Make sure your Python virtual environment is active.
2. In the project root, launch the Uvicorn ASGI server:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. **Verify backend health**:
   - In your browser or curl: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
   - Expected response: `{"status":"ok","service":"healthcure"}`
   - **Interactive API Documentation (Swagger)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - **Alternative ReDoc UI**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### 8.4 Starting the Frontend (Vite / React)

1. Open a second terminal window and navigate to the frontend directory:
   ```bash
   cd "e:\project folder\HealthCure\frontend"
   ```

2. Launch Vite development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to:
   ```text
   http://localhost:5173
   ```
   *(The Vite dev server automatically proxies any calls starting with `/api` to the backend on `http://127.0.0.1:8000` via `vite.config.ts`.)*

### 8.5 Running Both Simultaneously

#### Option A: Split Terminals (Recommended)
- **Terminal 1 (Backend)**:
  ```powershell
  uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
  ```
- **Terminal 2 (Frontend)**:
  ```powershell
  cd frontend
  npm run dev
  ```

#### Option B: Background Task (PowerShell)
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"
```

---

## 9. Application Interface & Workflow Tour

The HealthCure UI is built around five synchronized clinical views:

### 1. Diagnose Console (`/`)
- **Patient Identification**: Assign a Patient ID (e.g., `PT-1001`) and Visit Tag (e.g., `Baseline (Week 0)` or `Follow-up (Week 4)`).
- **Sample Case Quick-Loader**: One-click preset cases (e.g., "Pneumonia with Moderate Cardiovascular Risk", "Normal Lung with High Diabetes Risk").
- **Chest Radiograph Dropzone**: Drag-and-drop or file upload (PNG/JPEG/WEBP) up to 10 MB with image preview.
- **Symptom Notes Input**: Clinical narrative text box with live character count and sample clinical descriptions.
- **Tabular Risk Form**: Interactive toggle between **Heart Disease** (Cleveland vitals: age, resting BP, cholesterol, ECG, thalach, ST depression) and **Diabetes** (Pima parameters: glucose, BMI, insulin, blood pressure, pedigree).
- **Run Multimodal Analysis**: Submits all modalities in parallel, triggering Grad-CAM, LIME, and SHAP computation.

### 2. Comprehensive Multimodal Report (`/report`)
- **Diagnostic Agreement Badge**: Clearly flags whether vision classification and symptom NLP findings match (e.g., Both agree on Pneumonia) or diverge.
- **Integrated Clinical Summary**: Primary suggested diagnosis combined with a risk-stratified clinical recommendation.
- **Interactive Grad-CAM Heatmap**: Side-by-side or overlaid visualization of pulmonary consolidations with an opacity blend slider.
- **LIME Word Importance Breakdown**: Color-coded badges highlighting which symptom tokens increased or decreased diagnosis probability.
- **SHAP Feature Contribution Plot**: Waterfall chart visualizing the exact physiological features pushing risk higher or lower.
- **One-Click PDF Export**: Uses `jspdf` to generate a formatted clinical decision-support document ready for archiving.

### 3. Longitudinal History (`/history`)
- Tracks patient journeys across multiple visits stored locally.
- Visualizes progression of risk scores, symptom shifts, and radiological changes over time.
- Search and filter records by Patient ID and date.

### 4. Model Performance Dashboard (`/performance`)
- Displays real, evaluated metrics parsed from `reports/metrics/`.
- Features ROC curves, Area Under the Curve (AUC), confusion matrices, Sensitivity, Specificity, and F1 scores across all three model architectures.

### 5. Model Transparency Card (`/model-card`)
- In-depth compliance and governance card following modern AI transparency standards.
- Details model versioning, training data distributions, known edge cases & failure modes, intended clinical use, and strictly out-of-scope scenarios.

---

## 10. API Reference & Contract

All API routes are served under the `/api` prefix.

### 10.1 Endpoints Summary

| Method | Endpoint | Request Body | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | Service liveness and health status. |
| `GET` | `/api/metrics` | None | Returns cached evaluation metrics from `reports/metrics/`. |
| `GET` | `/api/model-card` | None | Returns model metadata, training sets, and failure modes. |
| `POST` | `/api/image` | `multipart/form-data` (`file`) | Classifies X-ray; returns label, confidence, and Grad-CAM base64 PNG. |
| `POST` | `/api/text` | JSON `{"text": "...", "num_samples": 150}` | Classifies symptoms; returns top 3 classes and LIME word weights. |
| `POST` | `/api/risk` | JSON `{"dataset": "heart", "features": {...}}` | Calculates tabular risk score, category ('low'/'moderate'/'high'), and SHAP weights. |
| `POST` | `/api/report` | JSON (multimodal payload) | Fuses all predictions into a unified diagnostic report and action plan. |

#### Example: Analyzing an X-ray via `curl`
```bash
curl -X POST "http://127.0.0.1:8000/api/image" \
  -H "accept: application/json" \
  -F "file=@datasets/chest_xray/test/PNEUMONIA/person1_virus_6.jpeg;type=image/jpeg"
```

#### Example: Scoring Cardiovascular Risk via `curl`
```bash
curl -X POST "http://127.0.0.1:8000/api/risk" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "heart",
    "features": {
      "age": 62, "sex": 1, "cp": 0, "trestbps": 145, "chol": 260,
      "fbs": 0, "restecg": 1, "thalach": 130, "exang": 1,
      "oldpeak": 2.2, "slope": 1, "ca": 1, "thal": 3
    }
  }'
```

### 10.2 OpenAPI Export & TypeScript Code Generation
Whenever schemas or backend endpoints are modified, regenerate the contract and frontend types:

1. **Export the OpenAPI schema**:
   ```bash
   python scripts/export_openapi.py
   ```
   *(Saves updated schema to `backend/openapi.json`)*

2. **Regenerate frontend TypeScript definitions**:
   ```bash
   cd frontend
   npm run generate:api
   ```
   *(Generates strongly-typed types in `frontend/src/api/types.ts` via `openapi-typescript`)*

---

## 11. Testing & Quality Assurance

HealthCure includes a test suite covering the HTTP contract, input validation limits, model loading, and explainers.

### 11.1 Backend Pytest Suite
Run the full test suite with:

```bash
python -m pytest -v
```

*All 23 integration and regression tests:*
```text
backend/tests/test_api.py::test_health PASSED
backend/tests/test_api.py::test_metrics PASSED
backend/tests/test_api.py::test_model_card PASSED
backend/tests/test_api.py::test_image_predict PASSED
backend/tests/test_api.py::test_text_predict PASSED
backend/tests/test_api.py::test_risk_predict PASSED
backend/tests/test_api.py::test_report PASSED
backend/tests/test_api.py::test_text_bad_input_422 PASSED
backend/tests/test_api.py::test_risk_bad_dataset_422 PASSED
backend/tests/test_api.py::test_report_bad_input_422 PASSED
backend/tests/test_api.py::test_image_missing_file_422 PASSED
backend/tests/test_api.py::test_upload_over_10mb_413 PASSED
backend/tests/test_image.py::test_metrics_json_exists_and_valid PASSED
backend/tests/test_image.py::test_predict_image_output_structure PASSED
backend/tests/test_image.py::test_predict_image_unpacking PASSED
backend/tests/test_image.py::test_predict_image_with_bytes PASSED
backend/tests/test_image.py::test_gradcam_png_std_greater_than_zero PASSED
backend/tests/test_image.py::test_roc_and_confusion_plots_exist PASSED
backend/tests/test_model_card.py::test_model_card_includes_version_training_data_and_failure_modes PASSED
backend/tests/test_text.py::test_metrics_json_exists_and_valid PASSED
backend/tests/test_text.py::test_predict_text_output_structure PASSED
backend/tests/test_text.py::test_predict_text_unpacking PASSED
backend/tests/test_text.py::test_num_samples_capped_at_200 PASSED

======================== 23 passed in ~60s ========================
```

### 11.2 Frontend TypeScript Check & Build
Validate React TypeScript typings and compile the production bundle:

```bash
cd frontend
npm run build
```
*Expected: `tsc --noEmit` exits with 0 and Vite produces bundled assets in `frontend/dist/`.*

### 11.3 Frontend Code Linting
Run Oxlint across all TypeScript and React files:

```bash
cd frontend
npm run lint
```
*Expected: 0 errors.*

---

## 12. Production Deployment & Containerization

### 12.1 Building for Production
1. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```
   The compiled static assets are located in `frontend/dist/`.

2. **Serve Frontend**:
   Use Nginx, Caddy, or static cloud hosting (e.g. Cloudflare Pages, AWS S3 + CloudFront). Configure the web server to proxy `/api/` requests to the FastAPI backend.

3. **Serve Backend**:
   Run Uvicorn with multiple workers behind a reverse proxy:
   ```bash
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.main:app --bind 0.0.0.0:8000
   ```

### 12.2 Dockerfile Blueprint (Backend)
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY src/ ./src/
COPY models/ ./models/
COPY reports/ ./reports/

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 13. Troubleshooting & FAQ

### Q1: The backend returns HTTP 413 "Upload exceeds 10 MB limit."
- **Cause**: HealthCure enforces a safety limit of 10 MB per image upload to prevent memory exhaustion attacks.
- **Solution**: Compress or downscale your chest radiograph to under 10 MB before submission. Standard diagnostic JPEGs are typically 1–4 MB.

### Q2: Dataset not found when running scripts.
- **Cause**: Dataset directory moved or not located at standard `./datasets` or `./dataset`.
- **Solution**: Set the environment variable to your custom location:
  - PowerShell: `$env:HEALTHCURE_DATA = "C:\path\to\your\datasets"`
  - Bash: `export HEALTHCURE_DATA="/path/to/your/datasets"`

### Q3: How do I run everything in low-memory or offline mode?
- **Solution**: Set `HEALTHCURE_MOCK=1`. This activates built-in deterministic mock fallbacks for all three modalities without loading PyTorch weights or downloading tokenizer caches.

### Q4: Port 8000 or 5173 is already in use.
- **Backend Port Change**:
  ```bash
  uvicorn backend.main:app --host 127.0.0.1 --port 8080
  ```
  *(Remember to update `target` in `frontend/vite.config.ts` if changing backend port.)*
- **Frontend Port Change**:
  ```bash
  cd frontend
  npx vite --port 3000
  ```

### Q5: Windows PowerShell Script Execution Policy Error.
- **Cause**: PowerShell blocks activation scripts by default.
- **Solution**: Open PowerShell as Administrator or run for the current session:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```

---

## 14. Clinical Safety & Ethics Disclaimer

> [!IMPORTANT]
> **HealthCure is an educational decision-support prototype, not an FDA-cleared, CE-marked, or clinically certified medical device.**
>
> 1. **No Medical Advice**: Predictions, confidence scores, Grad-CAM visual heatmaps, LIME word highlights, and SHAP risk contributions are for educational, research, and algorithmic transparency demonstrations only.
> 2. **Clinician Primacy**: Outputs must never replace professional clinical judgment, laboratory testing, physical examination, or diagnostic imaging performed by a licensed healthcare professional.
> 3. **Non-Prescriptive**: Under no circumstances should medications, treatments, or clinical interventions be altered based on this software.
> 4. **Known Failure Modes**: Consult the [Model Card](http://localhost:5173/model-card) or [`reports/model_card.json`](file:///e:/project%20folder/HealthCure/reports/model_card.json) for explicit documentation on pediatric distribution shift, image rotation sensitivity, note negation issues, and dataset demographic constraints.

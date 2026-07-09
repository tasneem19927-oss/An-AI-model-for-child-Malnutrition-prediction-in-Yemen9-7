# System Architecture & Scientific Methodology: Malnutrition CDSS

This document details the software architecture, mathematical models, and machine learning pipelines powering the Child Malnutrition Clinical Decision Support System (CDSS) for Yemen. The design balances clinical accuracy with operational resilience under severely constrained computing and networking environments.

---

## 1. Demographic and Clinical Feature Engineering (Yemen DHS/MICS6)

The predictive core of this system is designed around localized factors influencing pediatric malnutrition. The feature space is trained using data representing Yemen’s demographic profile, sourced from the Multiple Indicator Cluster Surveys (MICS6) and Demographic and Health Surveys (DHS) for Yemen.

### Feature Space Matrix (24+ Variables)
The machine learning models ingest a unified, multi-dimensional feature vector containing anthropometric measurements, recent morbidity history, maternal indicators, and household socio-economic indices:

| Feature Name | Type | Domain / Values | Clinical & Epidemiological Significance |
| :--- | :--- | :--- | :--- |
| `age_months` | Continuous | `0.0 - 59.0` | Controls age-dependent growth velocities. |
| `sex` | Categorical | `Male (1)`, `Female (2)` | Determines physiological reference curves. |
| `weight_kg` | Continuous | `1.5 - 35.0` | Fundamental indicator for acute weight shifts. |
| `height_cm` | Continuous | `40.0 - 130.0` | Baseline indicator for linear physical development. |
| `muac_mm` | Continuous | `80 - 200` | Mid-Upper Arm Circumference; detects severe wasting. |
| `oedema` | Binary | `0` or `1` | Detects bilateral pitting oedema (Kwashiorkor). |
| `haz` | Continuous | `-6.0` to `6.0` | Height-for-Age Z-score (indicates chronic stunting). |
| `whz` | Continuous | `-6.0` to `6.0` | Weight-for-Height Z-score (indicates acute wasting). |
| `waz` | Continuous | `-6.0` to `6.0` | Weight-for-Age Z-score (indicates underweight status). |
| `bmi` | Continuous | `8.0 - 30.0` | Body Mass Index ($kg/m^2$); tracks body mass proportion. |
| `recent_morbidity_count`| Integer | `0` to `3` | Sum of diarrhea, fever, and cough in the last 14 days. |
| `wealth_index` | Ordinal | `1` (Poorest) to `5` (Richest) | Socio-economic proxy for food and clean water access. |
| `maternal_education`| Ordinal | `0` (None) to `3` (Higher) | Primary social proxy for pediatric nutritional care. |
| `vulnerability_index`| Continuous | `0.0 - 1.0` | Composite risk score based on demographic factors. |
| `stunting_risk_index`| Continuous | `0.0 - 1.0` | Statistical risk derived from historical linear growth. |

---

## 2. WHO Growth Chart Algorithmic Foundations

The CDSS calculates Height-for-Age (HAZ), Weight-for-Height (WHZ), and Weight-for-Age (WAZ) Z-scores based on the **2006 WHO Child Growth Standards**. 

### Mathematical Formulation
The Z-score for a given measurement $y$ (e.g., weight, height, or BMI) for a child of a specific age $t$ and sex $s$ is computed using the LMS method:

$$Z = \frac{\left( \frac{y}{M(t,s)} \right)^{L(t,s)} - 1}{L(t,s) \cdot S(t,s)}$$

Where:
*   $L(t,s)$ represents the Box-Cox power transformation coefficient, which accounts for skewness in the reference distribution.
*   $M(t,s)$ represents the median value of the reference population at age $t$ and sex $s$.
*   $S(t,s)$ represents the coefficient of variation, measuring dispersion.

In cases where the Box-Cox transformation is not required ($L = 1$, such as for normal distributions), the calculation simplifies to:

$$Z = \frac{y - M(t,s)}{M(t,s) \cdot S(t,s)}$$

### Boundary Corrections
To prevent extreme outliers from skewing risk indices, the Z-scores are bounded in compliance with the WHO guideline protocols:
*   $\text{HAZ Range:} \quad [-6.0, \, +6.0]$
*   $\text{WHZ Range:} \quad [-5.0, \, +5.0]$
*   $\text{WAZ Range:} \quad [-6.0, \, +5.0]$

Values exceeding these boundaries trigger automated data-entry validation checks to catch measurement typos before inference.

---

## 3. XGBoost Ensemble Predictor Modeling

To provide highly accurate predictions on low-power devices, the CDSS uses compiled Gradient Boosted Decision Tree (GBDT) ensembles. These are exported directly from trained XGBoost estimators into compact, low-overhead JSON schemas.

### Mathematical Formulation of GBDT Inference
The prediction for a pediatric subject's feature vector $x_i$ is computed by summing the raw margin predictions across $K$ trees:

$$\hat{y}_i = \phi(x_i) = \sum_{k=1}^{K} f_k(x_i)$$

Where $f_k \in \mathcal{F}$ represents an individual regression tree mapping features to a leaf score. Each tree $f_k$ splits the feature space hierarchically.

To calculate the probability $P(y_i = 1 \mid x_i)$ that the child is at risk for severe malnutrition, the raw ensemble margin score is passed through the sigmoid function:

$$P(y_i = 1 \mid x_i) = \sigma(\hat{y}_i) = \frac{1}{1 + e^{-\hat{y}_i}}$$

### Traversal and Missing Value Routing
Each node in the decision tree represents a binary split. In low-resource settings, clinical data often has missing features (e.g., a missing MUAC reading). The ensemble models handle these via **XGBoost's Default Missing Direction** protocol:

$$\text{Next Node} = \begin{cases} 
\text{node.yes} & \text{if } x_{i,j} < \theta \\
\text{node.no} & \text{if } x_{i,j} \geq \theta \\
\text{node.missing} & \text{if } x_{i,j} \text{ is undefined} 
\end{cases}$$

This structure guarantees that the system always returns a prediction, even when certain field diagnostic readings are unavailable.

---

## 4. BioMobileBERT Named Entity Recognition Pipeline

To extract medical metrics from unstructured clinical notes, the CDSS runs a localized Natural Language Processing (NLP) pipeline based on a distilled **BioMobileBERT** model architecture.

```
[Unstructured Note] ==> [RegEx & Lexical Match] ==> [Context Boundary Extraction] ==> [Entity Map]
  "Infant presents      - Weight: 6.2 kg              - Value: 6.2 (weight_kg)         - Weight: 6.2 kg
   with 6.2 kg weight   - Morbidity: diarrhea         - Value: "diarrhea" (diarrhea)   - Diarrhea: True
   and severe diarrhea"
```

### Extraction Methodology
Because running heavy transformer models on client-side mobile browsers in rural clinics is computationally impractical, the system uses a optimized hybrid pipeline:
1.  **Lexical Entity Spotting:** Scans the narrative text using optimized regular expressions to locate raw clinical measurements, numbers, and symptoms.
2.  **Context Boundary Checking:** Evaluates the surrounding context windows (5 words before and after) to determine negation (e.g., "no diarrhea") or clinical qualification.
3.  **Semantic NER Mapping:** Resolves the parsed entities to standard clinical dictionary terms:
    *   `WEIGHT` $\rightarrow$ numeric value mapped to `weight_kg`.
    *   `HEIGHT`/`LENGTH` $\rightarrow$ numeric value mapped to `height_cm`.
    *   `MUAC` $\rightarrow$ numeric value mapped to `muac_mm`.
    *   `DIARRHEA`/`FEVER`/`COUGH` $\rightarrow$ boolean mapping of active symptoms.
    *   `OEDEMA` $\rightarrow$ presence of "pitting", "oedema", "swelling" in extremities.

---

## 5. Clinical Retrieval-Augmented Generation (RAG) Architecture

The Clinical RAG system bridges statistical predictions with authoritative medical literature to generate evidence-based intervention steps.

```
                      +---------------------------------------+
                      |         Clinician Inquiry /           |
                      |        Patient Diagnostic Vector      |
                      +---------------------------------------+
                                          |
                                          v
+-----------------------+     +-----------------------+     +-----------------------+
|  Reference Guidelines |     |   Semantic Context    |     |   Generative Model    |
| - WHO SAM Protocols   |====>|       Retrieval       |====>|    (Server Gemini)    |
| - Yemen MoPHP 2021    |     | (TF-IDF / BM25 Index) |     |                       |
+-----------------------+     +-----------------------+     +-----------------------+
                                                                        |
                                                                        v
                                                            +-----------------------+
                                                            | Verified Clinical CDSS|
                                                            |     Recommendation    |
                                                            +-----------------------+
```

### Semantic Retrieval Protocol
1.  **Document Indexing:** Authoritative guidelines (WHO Severe Acute Malnutrition protocols, Yemen MoPHP Pediatric Treatment Manuals) are split into semantically coherent passages.
2.  **Vector/Term Matching:** Clinician queries and patient risk profiles are combined into a search query. The system runs local TF-IDF and BM25 search queries over the document index.
3.  **Context-Bounded Prompting:** The top $N$ retrieved passages are injected into the prompt context for the server-side Gemini generative model:
    ```
    You are an expert pediatric clinician in Yemen.
    Use ONLY the following verified medical reference guidelines to formulate your response:
    ---
    [Retrieved Context Passage 1]
    [Retrieved Context Passage 2]
    ---
    Patient Diagnosis: Stunting (Severe), Wasting (Moderate).
    Socioeconomic Risk: Poorest, Mother has no formal education.
    Formulate a localized treatment plan with proper clinical rationale.
    ```
This design guarantees that the generated recommendations remain grounded in verified medical literature, preventing hallucinations.

---

## 6. Offline-First Synchronization & Conflict Resolution

Operating in areas with intermittent connectivity requires an offline-first data model that can gracefully handle network drops and reconnects.

### Client-Side IndexedDB
The local browser runs an asynchronous, transactional **IndexedDB** instance containing tables for:
*   `patients`: Metadata, demographic fields, registration dates, and local sync states.
*   `measurements`: Anthropometric indicators and clinical symptoms.
*   `predictions`: Saved XGBoost risk assessment outputs.
*   `recommendations`: Retrieved clinical guidelines and treatment plans.
*   `syncQueue`: An append-only transaction ledger of changes that have not yet been pushed to the central server.

### State Transition & Sync Queue Protocol

```
+------------------+         +------------------+         +------------------+
| Clinician Action | =======>| Save to Local DB | =======>| Push Transaction |
|                  |         |  (IndexedDB)     |         |  to Sync Queue   |
+------------------+         +------------------+         +------------------+
                                                                   |
                                                                   v
+------------------+         +------------------+         +------------------+
| Cloud Firestore  | <=======| Process Payload  | <=======| If Online: Trigger|
|   Database       |         | on Central Server|         | Bulk Sync Upload |
+------------------+         +------------------+         +------------------+
```

### Conflict Resolution Strategy
When multiple offline devices register or update a patient's records, conflicts can arise during synchronization. The system resolves these using a **Last-Write-Wins (LWW)** strategy backed by structured clinical logic:
*   **Demographics:** The record with the most recent `updatedAt` timestamp is preserved.
*   **Measurements:** Multiple measurements are treated as a chronological sequence. They are appended to the patient’s clinical history rather than overwriting previous entries, preserving the child's developmental trajectory.
*   **Device Status Tracking:** Each sync transaction registers a unique client device ID, allowing administrators to audit historical offline updates.

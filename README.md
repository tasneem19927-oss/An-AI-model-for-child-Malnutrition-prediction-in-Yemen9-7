# Clinical Decision Support System (CDSS) for Child Malnutrition Prediction in Yemen

## Project Overview & Academic Positioning
This repository houses an advanced, offline-first Clinical Decision Support System (CDSS) designed to predict and diagnose child malnutrition (ages 0–59 months) in the low-resource, conflict-affected healthcare environments of Yemen. Leveraging machine learning (XGBoost), Natural Language Processing (BioMobileBERT Named Entity Recognition), and Clinical Retrieval-Augmented Generation (RAG), this system bridges the gap between sophisticated computational modeling and local clinical utility where reliable internet connectivity is absent.

The primary research objective is to provide frontline pediatric clinicians, medical personnel, and humanitarian nurses with real-time, validated diagnostic classifications and clinical guidelines aligned directly with the World Health Organization (WHO) and Yemen Ministry of Public Health & Population (MoPHP) standards.

---

### Project Researcher and Developer
**Engineer Tasnim Al-Ahami**  
**المهندسة تسنيم العهامي**  
*Senior Software Architect, Machine Learning Developer, and Healthcare Systems Researcher*

---

## Technical Highlights
*   **Ensemble Predictive Core:** Utilizes three distinct XGBoost classification models trained on localized demographic, clinical, and socioeconomic indicators from the Demographic and Health Surveys (DHS) / Multiple Indicator Cluster Surveys (MICS6) dataset for Yemen.
*   **BioMobileBERT NLP Pipeline:** Features a specialized client-side Named Entity Recognition (NER) pipeline capable of parsing clinical notes to extract anthropometrics, medical conditions, and socio-economic risks directly from clinical narrative text.
*   **Clinical Retrieval-Augmented Generation (RAG):** Integrates semantic retrieval over a curated knowledge base of WHO and Yemen-specific pediatric treatment guidelines, generating personalized evidence-based recommendations and intervention procedures.
*   **Offline-First & Fault-Tolerant Sync Architecture:** Features a robust dual-database model using client-side IndexedDB for complete offline diagnostic, predicting, and caching autonomy, coupled with an automated bidirectional synchronization protocol powered by server-side Firebase Firestore and Express.js REST APIs.

---

## System Architecture

```
                                +---------------------------------------------+
                                |             Front-End CDSS UI               |
                                |     (React / Vite / Tailwind / Lucide)      |
                                +---------------------------------------------+
                                                       |
                                                       v
                                +---------------------------------------------+
                                |               IndexedDB                     |
                                |      (Local Offline Cache & Storage)        |
                                +---------------------------------------------+
                                        ^                             ^
                                        | (Local Sync Queue)          | (Predict / RAG)
                                        v                             v
+-----------------------+       +-------------------+         +------------------------+
|      Firebase         |<=====>|    SyncManager    |         |   Local AI Engines     |
| (Auth & Firestore DB) |       | (Offline Queue &  |         | - XGBoost Ensembles    |
+-----------------------+       |   Bulk Upload)    |         | - BioMobileBERT NER    |
                                +-------------------+         | - Semantic Clinical RAG|
                                        ^                     +------------------------+
                                        | (REST APIs)
                                        v
                                +---------------------------------------------+
                                |             Express.js Server               |
                                |      (Analytical RAG & Cloud Persistence)   |
                                +---------------------------------------------+
```

---

## File and Project Directory Structure

```
├── .env.example                # Sample configurations for server and API keys
├── Dockerfile                  # Production-grade deployment container manifest
├── README.md                   # Primary academic and project overview (this file)
├── ARCHITECTURE.md             # Detailed engineering and ML methodology overview
├── DEPLOYMENT.md               # Detailed deployment, Docker, and environment guide
├── API_DOCUMENTATION.md        # Comprehensive REST API and data contract definitions
├── TECHNICAL_REVIEW_REPORT.md  # Formal thesis pre-evaluation and gap analysis report
├── docker-compose.yml          # Container orchestration suite configuration
├── firebase-applet-config.json # Generated Firebase project credentials and DB settings
├── package.json                # Project dependencies and script endpoints
├── server.ts                   # Express.js REST API gateway and clinical controller
├── src/                        # Core Front-End Application Directory
│   ├── App.tsx                 # Application entry point and view router
│   ├── index.css               # Tailwind utility bindings and typography
│   ├── types.ts                # Strict TypeScript interfaces and domain schemas
│   ├── components/             # High-fidelity dashboard views and components
│   │   ├── AIMonitoringDashboard.tsx # Real-time predictive latency and drift monitor
│   │   ├── AdminDashboard.tsx       # System access controls and clinical registries
│   │   ├── AnalyticsDashboard.tsx   # Aggregated public health epidemiological metrics
│   │   ├── DoctorDashboard.tsx      # Comprehensive clinical assessment interface
│   │   ├── KnowledgeBaseDashboard.tsx # RAG index management and vector curation
│   │   ├── NurseDashboard.tsx       # Rapid field triage and anthropometric interface
│   │   ├── RecordsSyncDashboard.tsx # Decentralized ledger and merge conflict manager
│   │   └── SyncDashboard.tsx        # Device connectivity and sync-queue dashboard
│   ├── data/                   # Seed data and integrated computational constants
│   │   ├── scientific_knowledge.ts  # Curated WHO guidelines and medical corpus
│   │   └── trained_models.ts        # Compact XGBoost trees derived from MICS6
│   └── utils/                  # Algorithmic models and backend system proxies
│       ├── aiSearchService.ts  # Intelligent context-aware medical search coordinator
│       ├── firebase.ts         # Client-side Firebase Firestore and OAuth gateway
│       ├── growth.ts           # WHO growth charts (Z-Score algorithms: HAZ, WHZ, WAZ)
│       ├── indexedDbService.ts # High-capacity transactional offline clinical storage
│       ├── internetRetrieval.ts # Multi-source clinical web grounding proxy
│       ├── kbService.ts        # Client-side RAG document manager and vector pipeline
│       ├── ner.ts              # Local BioMobileBERT clinical narrative extractor
│       ├── prediction.ts       # Local ensemble XGBoost inference engine
│       ├── syncManager.ts      # Bidirectional transaction synchronization controller
│       └── translation.ts      # Fully localized English and Arabic dictionary
└── backend/                    # Core Python Modeling & Pipeline Training Assets
    ├── Dockerfile              # Docker container manifest for modeling backend
    ├── main.py                 # FastAPI microservice for clinical extraction
    ├── database.py             # Relational schema adapter for analytics
    ├── requirements.txt        # Deep learning packages and dependencies
    └── train_pipeline.py       # Supervised learning scripts for XGBoost models
```

---

## Standard Licensing & Reference Compliance
This research project is developed and structured for humanitarian and medical CDSS validation. All Z-score algorithms strictly conform to the 2006 WHO Child Growth Standards. All clinical guideline inferences represent localized protocols adjusted for the context of Yemen (MoPHP, 2021).

For detailed methodology, structural parameters, and technical review checklists, please refer to the accompanying academic files:
*   **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Deep dive into XGBoost features and Clinical RAG pipelines.
*   **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Secure configurations, containerization, and offline caching specifications.
*   **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**: API endpoints and network payload specifications.
*   **[TECHNICAL_REVIEW_REPORT.md](./TECHNICAL_REVIEW_REPORT.md)**: Thesis-ready evaluation, limitations, and future work.

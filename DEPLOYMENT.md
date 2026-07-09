# Deployment & Operational Configuration Guide

This guide details the step-by-step procedure for deploying and configuring the Child Malnutrition CDSS in both local development and production-grade environments.

---

## 1. Prerequisites and System Requirements

Before deploying the CDSS, ensure the target hosting environment meets the following specifications:

### Software Dependencies
*   **Operating System:** Linux (Ubuntu 20.04 LTS or newer recommended), macOS, or Windows 11 with WSL2.
*   **Runtime Environment:** Node.js v18.x or v20.x (LTS releases).
*   **Containerization Engine:** Docker Engine v20.10+ and Docker Compose v2.0+.
*   **Database Service:** Firebase Project (Spark or Blaze tier) with Firestore and Firebase Authentication enabled.

### Hardware Footprint
*   **Minimal:** 1 vCPU, 1 GB RAM (for simple clinic workloads).
*   **Recommended:** 2 vCPUs, 4 GB RAM (supports heavy concurrent RAG querying and client sync threads).

---

## 2. Local Development Environment Setup

To run the application locally with hot-reloading and debug-level logging, follow these steps:

### Step A: Clone the Repository and Install Dependencies
```bash
# Clone the project repository
git clone https://github.com/tasnim-alahami/malnutrition-cdss-yemen.git
cd malnutrition-cdss-yemen

# Install Node.js package dependencies
npm install
```

### Step B: Configure Environment Variables
Create a `.env` file in the root directory by copying the example file:
```bash
cp .env.example .env
```
Edit the `.env` file to include your API keys and configuration settings:
```env
# Server Binding Configurations
PORT=3000
NODE_ENV=development

# LLM & RAG Orchestration Secrets
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere

# Firebase Project Configuration Details
FIREBASE_PROJECT_ID=extended-discipline-s9ffs
FIREBASE_APP_ID=1:476538380502:web:c9ff2a2023e6729849e977
FIREBASE_API_KEY=AIzaSyDdymZWBogqMpXpCQvW6-q1ap-D93SsXBc
```

### Step C: Provision the Firebase Project
Ensure your `firebase-applet-config.json` contains the correct Firebase project credentials. The file must match this structure:
```json
{
  "projectId": "extended-discipline-s9ffs",
  "appId": "1:476538380502:web:c9ff2a2023e6729849e977",
  "apiKey": "AIzaSyDdymZWBogqMpXpCQvW6-q1ap-D93SsXBc",
  "authDomain": "extended-discipline-s9ffs.firebaseapp.com",
  "storageBucket": "extended-discipline-s9ffs.firebasestorage.app",
  "messagingSenderId": "476538380502",
  "firestoreDatabaseId": "ai-studio-anaimodelforchil-f69a6a34-a3fb-4b32-88c5-205f33fa827e"
}
```

### Step D: Launch the Development Environment
```bash
# Start the Express server and Vite development bundler
npm run dev
```
The server will boot and bind to `http://localhost:3000`.

---

## 3. Docker Containerization & Orchestration

To run the application in an isolated, production-ready container, use the included Docker configuration.

### Multi-Service Docker Compose Architecture
The `docker-compose.yml` file defines a high-availability environment incorporating the web app and reverse proxy:

```yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - PORT=3000
    restart: always
```

### Building and Running the Container
To build the Docker images and start the services in detached mode, run:

```bash
# Build the production Docker image
docker-compose build

# Boot the container stack in the background
docker-compose up -d

# Verify container statuses
docker-compose ps
```

---

## 4. Production Build & Deployment

To prepare the application for production hosting (e.g., Cloud Run, AWS ECS, or a virtual machine), run the optimized build pipeline.

### Step A: Execute the Compilation Pipeline
```bash
npm run build
```
This single command runs the following build steps:
1.  **Vite Bundler:** Compiles and minifies the React front-end assets, outputting static HTML, JS, and CSS to the `/dist` directory.
2.  **esbuild Compiler:** Compiles the Express.js backend server TypeScript file (`server.ts`) into a single, optimized, standalone CommonJS file located at `dist/server.cjs`.

### Step B: Launch the Production Application
Launch the compiled backend server, which will serve both the REST API endpoints and the static React assets:
```bash
NODE_ENV=production npm start
```

---

## 5. Security & Network Topologies

### Firebase Authentication Rules
Verify that Google Sign-in is enabled in your Firebase console. Set your Firestore Security Rules to restrict document read/write actions to authorized clinical accounts in Yemen's registry:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Nginx Reverse Proxy Setup
For production deployments, we recommend placing the Express application behind an **Nginx** reverse proxy to handle SSL termination, rate-limiting, and request buffering:

```nginx
server {
    listen 80;
    server_name cdss-yemen.gov.ye;

    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cdss-yemen.gov.ye;

    ssl_certificate /etc/letsencrypt/live/cdss-yemen.gov.ye/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cdss-yemen.gov.ye/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
This configuration keeps your backend secure and ensures robust handling of incoming traffic.

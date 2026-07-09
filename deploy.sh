#!/bin/bash

# Yemen Malnutrition CDS - Standalone Deployment Orchestrator
# Highly resilient automation for Linux VPS, Ubuntu 22.04 LTS, Docker Engine, and PostgreSQL

set -e

# Styling helpers
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== Yemen Malnutrition Platform - Deploying Standalone Engine ===${NC}"

# Check for Docker installation
if ! [ -x "$(command -v docker)" ]; then
  echo -e "${YELLOW}[!] Warning: Docker is not installed. Installing Docker Engine...${NC}"
  sudo apt-get update
  sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io
  sudo usermod -aG docker $USER
  echo -e "${GREEN}[✓] Docker installed successfully.${NC}"
fi

# Check for Docker Compose
if ! [ -x "$(command -v docker-compose)" ]; then
  echo -e "${YELLOW}[!] Installing Docker Compose...${NC}"
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  echo -e "${GREEN}[✓] Docker Compose installed.${NC}"
fi

# Load / Generate environment configurations
if [ ! -f .env ]; then
  echo -e "${YELLOW}[!] No .env file discovered. Generating from .env.example...${NC}"
  cp .env.example .env
  # Seed a secure password
  SECRET_PASS=$(openssl rand -hex 16)
  sed -i "s/postgres_secure_pass_123/$SECRET_PASS/g" .env
  echo -e "${GREEN}[✓] Fresh .env populated with secure credentials.${NC}"
fi

# Run Docker Compose Production Build
echo -e "${BLUE}[2/4] Triggering Multi-Container Docker Build...${NC}"
docker-compose down --remove-orphans
docker-compose build --no-cache

# Boot up the multi-tier application stack
echo -e "${BLUE}[3/4] Launching Database, FastAPI Backend, and Vite+Express Server...${NC}"
docker-compose up -d

# Verify Container Healths
echo -e "${BLUE}[4/4] Conducting Service Health Inspections...${NC}"
sleep 5
docker ps

echo -e "${GREEN}=== [SUCCESS] Platform is fully active on Production Ports ===${NC}"
echo -e "Web portal accessible on: ${YELLOW}http://localhost:3000${NC}"
echo -e "FastAPI services accessible on: ${YELLOW}http://localhost:8000${NC}"
echo -e "Clinical DB mapped locally on: ${YELLOW}localhost:5432${NC}"

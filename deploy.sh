#!/bin/bash
# ============================================
# YouTube Blend — DigitalOcean Deploy Script
# ============================================
# Run this on your DigitalOcean server after:
#   1. Installing Docker & Docker Compose
#   2. Cloning the repo
#   3. Creating .env from .env.example
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  YouTube Blend — Deploy Script${NC}"
echo -e "${BLUE}========================================${NC}"

# ---------- Pre-flight checks ----------

echo -e "\n${YELLOW}[1/6] Pre-flight checks...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Install it first:${NC}"
    echo "   curl -fsSL https://get.docker.com | sh"
    echo "   sudo usermod -aG docker \$USER"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found. Install it first:${NC}"
    echo "   sudo apt install docker-compose-plugin"
    exit 1
fi

if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found.${NC}"
    echo "   Copy the example and fill in your values:"
    echo "   cp .env.example .env"
    echo "   nano .env"
    exit 1
fi

echo -e "${GREEN}✅ Docker, Compose, and .env found${NC}"

# ---------- Pull latest code ----------

echo -e "\n${YELLOW}[2/6] Pulling latest code...${NC}"
git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "⚠️  Git pull skipped (not a git repo or no remote)"
echo -e "${GREEN}✅ Code up to date${NC}"

# ---------- Build containers ----------

echo -e "\n${YELLOW}[3/6] Building Docker images (using cache)...${NC}"
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# ---------- Start containers ----------

echo -e "\n${YELLOW}[4/6] Starting containers...${NC}"
docker compose up -d --build
echo -e "${GREEN}✅ Containers started${NC}"

# ---------- Wait for health ----------

echo -e "\n${YELLOW}[5/6] Waiting for backend health check...${NC}"
MAX_RETRIES=15
RETRY=0
until docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
        echo -e "${RED}❌ Backend didn't become healthy after ${MAX_RETRIES} attempts${NC}"
        echo "   Check logs: docker compose logs backend"
        exit 1
    fi
    echo "   Waiting... (attempt $RETRY/$MAX_RETRIES)"
    sleep 3
done
echo -e "${GREEN}✅ Backend is healthy${NC}"

# ---------- Verify ----------

echo -e "\n${YELLOW}[6/6] Verifying services...${NC}"

BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8005/health 2>/dev/null || echo "000")
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/ 2>/dev/null || echo "000")

if [ "$BACKEND_RESPONSE" = "200" ]; then
    echo -e "   Backend  (port 8005): ${GREEN}✅ OK${NC}"
else
    echo -e "   Backend  (port 8005): ${RED}❌ HTTP $BACKEND_RESPONSE${NC}"
fi

if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "   Frontend (port 3005): ${GREEN}✅ OK${NC}"
else
    echo -e "   Frontend (port 3005): ${RED}❌ HTTP $FRONTEND_RESPONSE${NC}"
fi

# ---------- Done ----------

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}🚀 Deployment complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Your services are running at:"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "Your app is live at:"
echo "  https://youtube-blend.tanmaytiwari.me"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f          # View live logs"
echo "  docker compose logs backend     # Backend logs only"
echo "  docker compose restart          # Restart all services"
echo "  docker compose down             # Stop all services"
echo "  docker compose ps               # Check running status"

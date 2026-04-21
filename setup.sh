#!/bin/bash

# YouTube Blend - Setup Script
# This script sets up both backend and frontend for development

set -e

echo "🚀 YouTube Blend - Development Setup"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Setup Backend
echo -e "${BLUE}Setting up Backend...${NC}"
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -q -r requirements.txt

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file template..."
    cat > .env << 'EOF'
# MongoDB Connection
MONGODB_URI=your_mongodb_connection_string

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key

# URLs
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
EOF
    echo "⚠️  Please configure .env file with your credentials"
fi

deactivate

cd ..
echo -e "${GREEN}✓ Backend setup complete${NC}"
echo ""

# Setup Frontend
echo -e "${BLUE}Setting up Frontend...${NC}"
cd frontend

# Install dependencies
echo "Installing Node dependencies..."
if command -v bun &> /dev/null; then
    bun install --quiet
else
    npm install --quiet
fi

# Create .env if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local file..."
    cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
EOF
    echo "⚠️  Please configure .env.local file with your credentials"
fi

cd ..
echo -e "${GREEN}✓ Frontend setup complete${NC}"
echo ""

# Print next steps
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Configure environment variables:"
echo "   - backend/.env"
echo "   - frontend/.env.local"
echo ""
echo "2. Start Backend:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""
echo "3. In a new terminal, start Frontend:"
echo "   cd frontend"
echo "   npm run dev  # or 'bun run dev'"
echo ""
echo "Backend will run on:  http://localhost:8000"
echo "Frontend will run on: http://localhost:5173"
echo ""
echo -e "${GREEN}Setup complete! Happy coding! 🎉${NC}"

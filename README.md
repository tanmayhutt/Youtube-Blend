# YouTube Blend

Compare your YouTube taste with friends and discover your compatibility score instantly.

**Live:** [youtube-blend.vercel.app](https://youtube-blend.vercel.app) | **Backend:** [youtube-blend-backend.onrender.com](https://youtube-blend-backend.onrender.com)

---

## Overview

YouTube Blend allows users to:
- Securely connect their YouTube account via Google OAuth
- Generate shareable blend links (2-hour expiration)
- Compare compatibility with friends across subscriptions, videos, and music preferences
- Receive a 0-100% compatibility score based on Jaccard similarity algorithm

**Key Points:** Read-only access • No data stored permanently • Secure & encrypted tokens

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.11) + MongoDB + JWT |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Auth | Google OAuth 2.0 |
| Hosting | DigitalOcean (Docker) • Vercel (domain proxy) |

---

## Project Structure

```
youtube-blend/
├── backend/
│   ├── main.py              # FastAPI app & OAuth routes
│   ├── services/
│   │   ├── youtube.py       # YouTube API integration
│   │   └── comparison.py     # Jaccard similarity algorithm
│   ├── requirements.txt
│   ├── runtime.txt
│   └── .env.example
│
├── frontend/
│   ├── src/pages/           # Landing, Dashboard, Compare pages
│   ├── src/components/      # UI components (shadcn/ui)
│   ├── src/lib/auth.ts      # Authentication utilities
│   ├── vite.config.ts
│   ├── vercel.json          # SPA routing config
│   └── package.json
│
└── README.md
```

---

## Security Features

- Rate limiting (20 req/min per IP)
- CSRF tokens on all comparison links
- XSS prevention (JSON-safe escaping)
- Secure random codes (128-bit entropy)
- 2-hour link expiration
- Read-only YouTube API access
- JWT authentication with expiration

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB Atlas account
- Google OAuth credentials

### Backend
```bash
cd backend
pip install -r requirements.txt

# Set environment variables
export MONGO_URI=your_mongodb_uri
export GOOGLE_CLIENT_ID=your_client_id
export GOOGLE_CLIENT_SECRET=your_client_secret
export JWT_SECRET=$(openssl rand -base64 32)
export DEPLOYED_DOMAIN=http://localhost:8000
export FRONTEND_URL=http://localhost:5173

python -m uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
export VITE_API_URL=http://localhost:8000
npm run dev
```

Access at `http://localhost:5173`

---

## How It Works

### Comparison Algorithm

Uses **Jaccard Similarity** across 5 dimensions:

```
Similarity = (Common Items / Total Unique Items) × 100

Example:
User1 subscriptions: [MrBeast, Vsauce, Kurzgesagt]
User2 subscriptions: [Vsauce, Kurzgesagt, Veritasium]

Score = (2 / 4) × 100 = 50%
```

**Overall Score** = Average of:
1. Subscriptions similarity
2. Subscription genres similarity
3. Saved videos similarity
4. Video genres similarity
5. Music listened similarity

---

## API Endpoints

### Authentication
- `GET /auth/login` - Initiate OAuth flow
- `GET /auth/callback` - OAuth callback handler

### Data & Comparison
- `GET /data/me` - Get current user's YouTube data (authenticated)
- `POST /compare/generate_link` - Create comparison link (authenticated)
- `GET /compare/run/{id}` - Get comparison results (authenticated)
- `GET /compare/join/{id}` - Join comparison & redirect to login

---

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for full configuration.

**Backend requires:**
- `MONGO_URI` - MongoDB connection string
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `JWT_SECRET` - Secret for JWT signing
- `DEPLOYED_DOMAIN` - Backend URL
- `FRONTEND_URL` - Frontend URL

**Frontend requires:**
- `VITE_API_URL` - Backend API URL

---

## Deployment

### Option 1: Docker on DigitalOcean + Vercel Proxy (Recommended)

Both frontend and backend run on your server. Vercel acts as a free domain proxy — no IP exposed.

```
User → youtube-blend.vercel.app → (Vercel rewrites) → Your Server
         /api/*  →  server:8000 (backend)
         /*      →  server:3000 (frontend)
```

#### Step 1: Set up DigitalOcean Server

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Install Docker (if not already installed)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone the repo
git clone https://github.com/tanmayhutt/Youtube-Blend.git
cd Youtube-Blend

# Create .env from template
cp .env.example .env
nano .env   # Fill in your actual values
```

#### Step 2: Configure Environment Variables

Edit `.env` with these production values:

```env
DEPLOYED_DOMAIN=https://youtube-blend.vercel.app/api
FRONTEND_URL=https://youtube-blend.vercel.app
VITE_API_URL=/api
# ... plus MONGO_URI, GOOGLE_CLIENT_ID, etc.
```

#### Step 3: Update Google Cloud Console

Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):

1. Open your OAuth 2.0 Client ID
2. Under **Authorized redirect URIs**, add:
   ```
   https://youtube-blend.vercel.app/api/auth/callback
   ```
3. Under **Authorized JavaScript origins**, add:
   ```
   https://youtube-blend.vercel.app
   ```
4. Save

#### Step 4: Deploy with Docker

```bash
# One-command deploy
./deploy.sh

# Or manually:
docker compose build
docker compose up -d
docker compose logs -f   # Watch logs
```

#### Step 5: Set up Vercel as Domain Proxy

1. Go to [vercel.com](https://vercel.com) → Import the same GitHub repo
2. Change **Root Directory** to `/` (repo root, NOT `frontend`)
3. Set **Build Command** to empty (or leave blank)
4. Set **Output Directory** to `public`
5. Deploy — Vercel will use the root `vercel.json` which proxies all traffic to your server
6. **Edit `vercel.json`**: Replace `YOUR_SERVER_IP` with your DigitalOcean droplet IP

> **Note:** If your repo is public, your server IP will be visible in `vercel.json`. To avoid this, either keep the repo private or create a separate private repo with just the `vercel.json`.

#### Step 6: Test the Full Flow

1. Visit `https://youtube-blend.vercel.app`
2. Click login → should redirect to Google OAuth
3. After auth → should land on dashboard
4. Generate a comparison link → share with a friend

---

### Option 2: Render + Vercel (Legacy)

#### Render (Backend)
1. Connect GitHub repository
2. Set root directory to `backend`
3. Add environment variables
4. Deploy

#### Vercel (Frontend)
1. Connect GitHub repository
2. Set root directory to `frontend`
3. Add `VITE_API_URL` environment variable
4. Deploy

---

## Useful Docker Commands

```bash
docker compose logs -f            # Live logs (all services)
docker compose logs backend       # Backend logs only
docker compose restart            # Restart all services
docker compose down               # Stop everything
docker compose ps                 # Check status
docker compose build --no-cache   # Force rebuild
```

---

## Known Limitations

- Comparison links expire after 2 hours
- YouTube API free tier limits to ~50 subscriptions per request
- Comparison results cached after first run
- Music data requires YouTube Music account

---

## Contributing

Issues and pull requests are welcome. Please open an issue for bugs or feature requests.

---

## License

MIT - Feel free to fork, modify, and use this project.

---

**GitHub:** [tanmayhutt/Youtube-Blend](https://github.com/tanmayhutt/Youtube-Blend)

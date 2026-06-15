# Blend (formerly YouTube Blend)

Compare your YouTube taste with friends and discover your compatibility score instantly. 

**Live:** [youtube-blend.vercel.app](https://youtube-blend.vercel.app)
*(Fully compliant with Google API Branding & Trademark Guidelines)*

---

## ⚡ Performance & CI/CD Innovations

We recently completely overhauled the deployment pipeline to achieve **blazing fast, automated deployments**:

1. **Bun instead of NPM:** We ripped out Node.js/NPM from the frontend Docker build stage and replaced it with `oven/bun:1-alpine`. This reduced dependency installation time from **4+ minutes down to 2 seconds**.
2. **Automated GitHub Actions CI/CD:** Every push to `main` triggers a lightweight GitHub Action that securely SSHs into the DigitalOcean droplet and runs our custom `deploy.sh` script.
3. **Smart Docker BuildKit Caching:** We implemented advanced layer caching and `--mount=type=cache` for Python's `pip`. If a push only touches the backend, Docker completely skips the 50-second Vite frontend build, resulting in **sub-2-minute full deployments**.
4. **Crisp Mathematical SVG Branding:** We replaced all legacy `.png`/`.svg` assets with a mathematically pixel-perfect, custom minimal abstract logo built directly in raw SVG code for infinite scalability and zero Google trademark infringement.

---

## Overview

Blend allows users to:
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
| Frontend | React 19 + TypeScript + Vite + Bun + Tailwind CSS |
| Auth | Google OAuth 2.0 |
| Hosting | DigitalOcean (Docker Compose) • Vercel (Domain Proxy) |
| CI/CD | GitHub Actions • Automated SSH Deployments |

---

## Project Structure

```
youtube-blend/
├── .github/workflows/       # GitHub Actions CI/CD pipeline
├── backend/
│   ├── main.py              # FastAPI app & OAuth routes
│   ├── services/
│   │   ├── youtube.py       # YouTube API integration
│   │   └── comparison.py    # Jaccard similarity algorithm
│   ├── Dockerfile           # Optimized with pip BuildKit caching
│   └── requirements.txt
│
├── frontend/
│   ├── src/pages/           # Landing, Dashboard, Compare pages
│   ├── src/components/      # UI components (shadcn/ui)
│   ├── Dockerfile           # Blazing fast multi-stage Bun build
│   └── package.json
│
├── deploy.sh                # Smart zero-downtime deploy script
├── vercel.json              # Reverse proxy configuration
└── README.md
```

---

## Security Features

- **Google Site Verification:** Domain ownership verified via HTML meta-tags.
- **Rate limiting:** 20 req/min per IP.
- **CSRF & XSS prevention:** JSON-safe escaping and secure tokens.
- **Read-only APIs:** We request the absolute minimum permissions needed.
- **JWT authentication:** Encrypted sessions with strict expirations.

---

## How It Works: The Algorithm

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

## Local Development Quick Start

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

### Frontend (Using Bun)
```bash
cd frontend
bun install
export VITE_API_URL=http://localhost:8000
bun run dev
```

---

## Production Deployment (DigitalOcean + Vercel)

Both frontend and backend run natively on a DigitalOcean Docker droplet. Vercel acts purely as a free reverse-proxy to attach the `youtube-blend.vercel.app` domain and handle SSL.

#### Step 1: Push to GitHub
Simply merge your code to the `main` branch. 

#### Step 2: GitHub Actions Takes Over
Our configured `.github/workflows/deploy.yml` will automatically:
1. SSH into the DigitalOcean droplet.
2. Run `./deploy.sh`.
3. Pull the latest code and intelligently determine which containers need rebuilding.
4. Hot-swap the containers with zero downtime.

#### Useful Docker Commands (on the server)
```bash
docker compose logs -f            # Live logs (all services)
docker compose restart            # Restart all services
docker compose build --no-cache   # Force a complete rebuild
```

---

## Known Limitations

- Comparison links expire after 2 hours
- YouTube API free tier limits to ~50 subscriptions per request
- Comparison results cached after first run
- Music data requires YouTube Music account

---

## License

MIT - Feel free to fork, modify, and use this project.

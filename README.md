# YouTube Blend

Compare your YouTube taste with friends and discover your compatibility score now ==> https://blend-youtube.onrender.com

## Project Structure

```
youtube-blend/
├── youtube-blend-backend/    # FastAPI backend
│   ├── main.py              # Main application
│   ├── auth_setup.py        # OAuth setup
│   ├── services/            # Business logic
│   │   ├── youtube.py      # YouTube API integration
│   │   └── comparison.py    # Comparison logic
│   └── requirements.txt     # Python dependencies
│
├── youtube-blend-frontend/  # React frontend
│   ├── src/                # Source code
│   ├── public/             # Static assets
│   ├── package.json        # Node dependencies
│   └── server.js           # Express server for SPA routing
│
└── README.md               # This file
```

## Tech Stack

- **Backend:** FastAPI (Python)
- **Frontend:** React + TypeScript + Vite
- **Database:** MongoDB Atlas
- **Authentication:** Google OAuth 2.0
- **Hosting:** Render (free tier)

## Quick Start

### Backend
```bash
cd youtube-blend-backend
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd youtube-blend-frontend
npm install
npm run dev
```

## Features

- YouTube data fetching (subscriptions, videos, playlists)
- Comparison algorithm (Jaccard similarity)
- Shareable comparison links
- Real-time compatibility scores


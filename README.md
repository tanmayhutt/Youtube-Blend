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

## Setup

See `SETUP_GUIDE.md` for detailed setup instructions.

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

## Deployment

Both services are deployed separately on Render:
- Backend: Configured as Web Service
- Frontend: Configured as Web Service (for SPA routing)

See `SETUP_GUIDE.md` for deployment details.

## Features

- Google OAuth authentication
- YouTube data fetching (subscriptions, videos, playlists)
- Comparison algorithm (Jaccard similarity)
- Shareable comparison links
- Real-time compatibility scores

## License

MIT


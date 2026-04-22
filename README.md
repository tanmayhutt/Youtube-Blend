# YouTube Blend 🎬

Stop wondering if your friend's taste is actually as bad as you think. Compare YouTube profiles, get compatibility scores, and settle the great debate once and for all.

**🚀 Live:** https://youtube-blend.vercel.app

## ✨ What It Does

1. **Connect YouTube** - Securely link your Google account (read-only access)
2. **Generate Blend Link** - Get a unique 2-hour shareable link
3. **Share with Friends** - Send it to someone and let them join
4. **See Compatibility** - Get a 0-100% match score across:
   - Subscriptions & channels
   - Saved videos & playlists
   - Music listening habits
   - Video genre preferences
5. **Find Common Ground** - Discover channels/videos you both love

## 🏗️ Project Structure

```
youtube-blend/
├── backend/                 # FastAPI backend (Python)
│   ├── main.py             # Core app & routes
│   ├── auth_setup.py       # Google OAuth flow
│   ├── services/
│   │   ├── youtube.py      # YouTube API integration
│   │   └── comparison.py    # Jaccard similarity algorithm
│   ├── requirements.txt     # Python 3.11 dependencies
│   ├── runtime.txt         # Python version
│   └── Procfile            # Render deployment config
│
├── frontend/                # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/          # Landing, Dashboard, Compare pages
│   │   ├── components/     # UI components
│   │   ├── lib/            # Auth utilities
│   │   └── main.tsx        # Entry point
│   ├── package.json        # Node dependencies
│   ├── vite.config.ts      # Vite build config
│   ├── tailwind.config.ts  # Tailwind CSS config
│   ├── vercel.json         # Vercel SPA routing config
│   └── Procfile            # Legacy config
│
└── README.md              # This file
```

## 🔧 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | FastAPI (Python 3.11) + uvicorn |
| **Frontend** | React 19 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Database** | MongoDB Atlas (free tier) |
| **Auth** | Google OAuth 2.0 + JWT |
| **APIs** | YouTube Data API v3 |
| **Hosting** | Render (backend), Vercel (frontend) |

## 🔒 Security Features

✅ **Rate Limiting** - 20 requests/min per IP on sensitive endpoints
✅ **CSRF Protection** - Secure tokens on comparison links
✅ **XSS Prevention** - JSON-safe token escaping
✅ **Secure Codes** - 128-bit random comparison IDs (not guessable UUIDs)
✅ **Short Expiration** - Links expire after 2 hours
✅ **OAuth** - Industry-standard Google authentication
✅ **Read-Only Access** - Only subscriptions/videos read, never write

## 🚀 Live Deployment

**Frontend:** https://youtube-blend.vercel.app
**Backend API:** https://youtube-blend-backend.onrender.com

## 🏃 Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB Atlas account
- Google OAuth credentials

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
export MONGO_URI=your_mongodb_uri
export GOOGLE_CLIENT_ID=your_client_id
export GOOGLE_CLIENT_SECRET=your_client_secret
export JWT_SECRET=$(openssl rand -base64 32)
export DEPLOYED_DOMAIN=http://localhost:8000
export FRONTEND_URL=http://localhost:5173
python -m uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
export VITE_API_URL=http://localhost:8000
npm run dev
```

Visit http://localhost:5173

## 📊 How Comparison Works

The algorithm uses **Jaccard Similarity** for each category:

```
Similarity = (Intersection / Union) × 100

Example:
User1 subscriptions: [MrBeast, Vsauce, Kurzgesagt]
User2 subscriptions: [Vsauce, Kurzgesagt, Veritasium]

Common: 2 (Vsauce, Kurzgesagt)
Total: 4 (all unique channels)
Similarity = (2/4) × 100 = 50%
```

**Overall Score** = Average of:
- Subscriptions similarity
- Subscription genres similarity
- Saved videos similarity
- Video genres similarity
- Music listened similarity

## 🎯 Features

### User Features
- ✅ Google OAuth login (secure, read-only)
- ✅ View your YouTube data summary
- ✅ Generate unique blend links
- ✅ Join friend's blends
- ✅ See detailed compatibility breakdown
- ✅ Find common channels/videos

### Technical Features
- ✅ Real-time comparison algorithm
- ✅ MongoDB TTL auto-cleanup (2 hour expiry)
- ✅ JWT token authentication
- ✅ Rate limiting & CSRF protection
- ✅ Responsive mobile UI
- ✅ Dark mode support

## 🛠️ Environment Variables

**Backend (.env):**
```
MONGO_URI=mongodb+srv://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=...
DEPLOYED_DOMAIN=https://youtube-blend-backend.onrender.com
FRONTEND_URL=https://youtube-blend.vercel.app
```

**Frontend (.env):**
```
VITE_API_URL=https://youtube-blend-backend.onrender.com
```

## 📝 API Endpoints

### Public
- `GET /` - Health check
- `GET /auth/login` - Start OAuth flow
- `GET /auth/callback` - OAuth callback
- `GET /compare/join/{comparison_id}` - Join a comparison

### Protected (JWT Required)
- `GET /data/me` - Get current user's YouTube data
- `POST /compare/generate_link` - Create new comparison link
- `GET /compare/run/{comparison_id}` - Get comparison results
- `POST /compare/run/{comparison_id}` - Run comparison (alias)

## 🐛 Known Limitations

- Links expire after 2 hours
- Only reads first 50 subscriptions (YouTube API limit for free tier)
- Comparison runs once per link (cached after)
- Music data requires YouTube Music account

## 📄 License

MIT - Feel free to fork and build on this!

## 🤝 Contributing

Found a bug? Have a feature idea? Open an issue or submit a PR!

## 📞 Support

For issues or questions:
1. Check if it's a known limitation above
2. Review the code in `backend/main.py`
3. Open an issue on GitHub

---

**Made with ❤️ by [Your Name]**
Live at: https://youtube-blend.vercel.app

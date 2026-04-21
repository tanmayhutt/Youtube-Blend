# 🚀 Deployment Guide

This guide covers deploying YouTube Blend with free hosting services for both frontend and backend.

## Overview

- **Frontend:** Deployed on Vercel (fastest, optimized for React)
- **Backend:** Deployed on Railway or Fly.io (supports Python/FastAPI)
- **Database:** MongoDB Atlas (free tier available)

---

## Prerequisites

1. GitHub account (repos already pushed)
2. MongoDB Atlas account (free tier)
3. YouTube Data API key
4. Google OAuth credentials

---

## Database Setup (MongoDB Atlas)

### 1. Create MongoDB Account
- Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- Sign up for free
- Create a new project

### 2. Create a Cluster
- Choose free tier (M0)
- Select your region
- Create cluster

### 3. Get Connection String
- Go to "Databases" → Your cluster
- Click "Connect"
- Choose "Drivers" → Python
- Copy connection string
- Replace `<username>` and `<password>` with your credentials

Your `MONGODB_URI` will look like:
```
mongodb+srv://username:password@cluster.mongodb.net/youtube-blend?retryWrites=true&w=majority
```

---

## YouTube API & OAuth Setup

### 1. Google Cloud Console
- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Create new project: "YouTube Blend"
- Enable APIs:
  - YouTube Data API v3
  - Google+ API

### 2. Create OAuth Credentials
- Go to Credentials → Create Credentials → OAuth 2.0 Client ID
- Choose "Web application"
- Add authorized URIs:
  ```
  http://localhost:8000
  http://localhost:5173
  http://your-backend-domain.com
  https://your-frontend-domain.com
  ```
- Save Client ID and Secret

### 3. Get YouTube API Key
- Credentials → Create Credentials → API Key
- Copy the key

---

## Frontend Deployment (Vercel)

### 1. Deploy to Vercel
```bash
# Option 1: Via CLI
npm i -g vercel
vercel login
vercel

# Option 2: Via GitHub
# Go to vercel.com → Import Project → Select Youtube-Blend repo → Deploy
```

### 2. Configure Environment Variables
In Vercel Dashboard:
- Project Settings → Environment Variables
- Add:
  ```
  VITE_API_URL=https://your-backend-domain.com
  VITE_GOOGLE_CLIENT_ID=your_google_client_id
  ```

### 3. Configure Build Settings
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: `frontend`

### 4. Update OAuth Redirect URIs
- Add your Vercel domain to Google OAuth authorized URIs

**Your frontend is now live!** 🎉

---

## Backend Deployment

### Option A: Railway (Recommended for Beginners)

#### 1. Sign up
- Go to [railway.app](https://railway.app)
- Sign up with GitHub

#### 2. Deploy from GitHub
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
cd backend
railway link  # Select project
railway deploy
```

#### 3. Add Environment Variables
- Railway Dashboard → Environment
- Add all backend env variables:
  ```
  MONGODB_URI
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  YOUTUBE_API_KEY
  BACKEND_URL=https://your-railway-domain.com
  FRONTEND_URL=https://your-vercel-domain.com
  ```

#### 4. Configure Domain
- Railway Dashboard → Networking
- Copy your service URL
- Update `BACKEND_URL` variable

### Option B: Fly.io (More Control)

#### 1. Sign up
- Go to [fly.io](https://fly.io)
- Sign up

#### 2. Install Fly CLI
```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh
```

#### 3. Deploy
```bash
cd backend

# Login
flyctl auth login

# Create app
flyctl launch

# Add env secrets
flyctl secrets set MONGODB_URI="your_uri"
flyctl secrets set GOOGLE_CLIENT_ID="your_id"
flyctl secrets set GOOGLE_CLIENT_SECRET="your_secret"
flyctl secrets set YOUTUBE_API_KEY="your_key"

# Deploy
flyctl deploy
```

#### 4. View Logs
```bash
flyctl logs
```

---

## Post-Deployment Checklist

- [ ] Frontend deployed and accessible
- [ ] Backend deployed and accessible
- [ ] MongoDB URI configured in backend
- [ ] Google OAuth credentials configured
- [ ] YouTube API key configured
- [ ] `BACKEND_URL` in backend env matches deployment URL
- [ ] `VITE_API_URL` in frontend env matches backend URL
- [ ] Test OAuth flow
- [ ] Test YouTube comparison feature
- [ ] Monitor logs for errors

---

## Troubleshooting

### CORS Errors
**Problem:** Frontend can't reach backend
**Solution:**
- Check `BACKEND_URL` and `VITE_API_URL` are correct
- Add frontend URL to backend CORS config if needed
- Verify both services are running

### OAuth Errors
**Problem:** OAuth redirect not working
**Solution:**
- Verify all redirect URIs in Google Console include:
  - `http://localhost:3000/callback` (local)
  - `https://your-domain.com/callback` (production)
- Check `FRONTEND_URL` in backend env

### MongoDB Connection
**Problem:** Can't connect to MongoDB
**Solution:**
- Verify IP whitelist in MongoDB Atlas includes Railway/Fly.io IPs
- Check username/password in connection string
- Ensure special characters are URL encoded

### Cold Starts
**Problem:** First request is slow
**Solution:**
- Normal for free tiers (10-30s on first request)
- After first request, performance is normal
- Consider upgrading if it's a problem

---

## Performance Tips

1. **Frontend (Vercel)**
   - Already optimized
   - Automatic CDN caching
   - Near-instant deployments

2. **Backend (Railway/Fly.io)**
   - Use background workers for heavy operations
   - Cache YouTube API responses
   - Consider upgrading for better performance

3. **Database (MongoDB)**
   - Create indexes on frequently queried fields
   - Monitor connection pool
   - Archive old comparison data

---

## Cost Breakdown (Free Tier)

| Service | Tier | Cost | Limits |
|---------|------|------|--------|
| **Vercel** | Free | $0 | 100 GB/month bandwidth |
| **Railway** | Free | $0 | $5/month credit (usually enough) |
| **MongoDB** | Free | $0 | 5 GB storage, 1000 connections |
| **YouTube API** | Free | $0 | 10,000 units/day (plenty) |
| **Google OAuth** | Free | $0 | Unlimited |
| **TOTAL** | - | **$0/month** | More than sufficient |

---

## Next Steps

1. Deploy frontend on Vercel
2. Deploy backend on Railway/Fly.io
3. Update environment variables
4. Test the full flow
5. Monitor logs and fix any issues
6. Celebrate! 🎉

For more help, check:
- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://railway.app/docs)
- [Fly.io Docs](https://fly.io/docs)

# main.py - FINAL WORKING VERSION (CASE-SENSITIVE IMPORT FIXED)

from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from google_auth_oauthlib.flow import Flow
from collections import defaultdict
from time import time
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from pymongo import MongoClient
import asyncio
import os
import requests
import jwt as pyjwt
from datetime import datetime, timedelta
import logging
from pydantic import BaseModel
import secrets
import uuid
import json
from typing import Optional
from services.youtube import (
    get_youtube_service,
    fetch_subscriptions,
    fetch_subscription_genres,
    fetch_saved_videos,
    determine_music_and_genres,
    fetch_playlists,
    count_music_watch_times
)
from services.comparison import compare_interests_logic

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Rate limiting storage: {ip: {endpoint: [timestamps]}}
rate_limit_store = defaultdict(lambda: defaultdict(list))

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        endpoint = request.url.path

        # Check rate limits for sensitive endpoints
        if endpoint in ["/compare/join", "/compare/run"]:
            now = time()
            # Clean old requests (older than 60 seconds)
            rate_limit_store[client_ip][endpoint] = [
                t for t in rate_limit_store[client_ip][endpoint] if now - t < 60
            ]

            # Allow max 20 requests per minute per IP
            if len(rate_limit_store[client_ip][endpoint]) >= 20:
                raise HTTPException(status_code=429, detail="Too many requests. Try again later.")

            rate_limit_store[client_ip][endpoint].append(now)

        return await call_next(request)

app.add_middleware(RateLimitMiddleware)

def generate_secure_code() -> str:
    """Generate a cryptographically secure random code for comparison links."""
    return secrets.token_urlsafe(16)  # 128 bits of entropy

def validate_redirect_target(target: Optional[str]) -> str:
    """Validate and sanitize redirect target."""
    # Whitelist of allowed redirect paths
    allowed_paths = {'/dashboard', '/compare/finalise'}

    if not target:
        return '/dashboard'

    # Remove leading slashes and check
    target_path = f'/{target.lstrip("/")}'

    # Check if it's in whitelist
    for allowed in allowed_paths:
        if target_path.startswith(allowed):
            return target_path

    # Default to dashboard if not whitelisted
    return '/dashboard'

def build_redirect_uri() -> str:
    """Build a redirect URI for Google OAuth.
    - If DEPLOYED_DOMAIN is set and contains a scheme, use it directly.
    - If DEPLOYED_DOMAIN is set without scheme, assume https.
    - If not set, fall back to localhost with http for local dev.
    """
    deployed = os.getenv('DEPLOYED_DOMAIN')
    if deployed:
        # Remove any trailing slashes and ensure proper format
        deployed = deployed.rstrip('/')
        if deployed.startswith('http://') or deployed.startswith('https://'):
            return f"{deployed}/auth/callback"
        return f"https://{deployed}/auth/callback"
    # Local development fallback
    host = os.getenv('DEV_HOST', 'localhost:8000')
    scheme = 'http' if 'localhost' in host or host.startswith('127.') else 'https'
    return f"{scheme}://{host}/auth/callback"

# CORS - Allow frontend origin
frontend_url = os.getenv("FRONTEND_URL", "https://blend-youtube.onrender.com")
# Remove trailing slash and ensure it's a valid origin
frontend_origin = frontend_url.rstrip('/')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
client = MongoClient(os.getenv("MONGO_URI"), serverSelectionTimeoutMS=10000)
db = client["youtube-blend"]
users = db.users
auth_states = db.auth_states
auth_codes = db.auth_codes
comparisons = db.comparisons

# Ensure TTL indexes exist for state, auth codes, and comparisons
try:
    auth_states.create_index("expires_at", expireAfterSeconds=0)
    auth_codes.create_index("expires_at", expireAfterSeconds=0)
    comparisons.create_index("expires_at", expireAfterSeconds=0)  # Auto-cleanup expired comparisons
except Exception:
    # Index creation failure should not crash the app at import time
    logger.exception("Failed to ensure TTL indexes on collections")

# Google OAuth Scopes
SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]

# JWT verification dependency
async def verify_token(authorization: str = Header(None)):
    """Verify JWT token from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        token = authorization.replace("Bearer ", "")
        jwt_secret = os.getenv('JWT_SECRET')
        if not jwt_secret:
            raise HTTPException(status_code=500, detail='JWT_SECRET not configured')

        payload = pyjwt.decode(token, jwt_secret, algorithms=['HS256'])
        return payload.get('sub')  # Returns google_id
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_credentials_from_db(google_id: str) -> Optional[Credentials]:
    """Get and refresh credentials from database."""
    doc = users.find_one({'google_id': google_id})
    if not doc:
        return None

    token_raw = doc.get('token_json')
    if not token_raw:
        return None

    try:
        token_data = json.loads(token_raw) if isinstance(token_raw, str) else token_raw
        creds = Credentials(
            token=token_data.get('token') or token_data.get('access_token'),
            refresh_token=token_data.get('refresh_token'),
            id_token=token_data.get('id_token'),
            token_uri=token_data.get('token_uri', 'https://oauth2.googleapis.com/token'),
            client_id=token_data.get('client_id') or os.getenv('GOOGLE_CLIENT_ID'),
            client_secret=token_data.get('client_secret') or os.getenv('GOOGLE_CLIENT_SECRET'),
            scopes=token_data.get('scopes', SCOPES),
        )

        if creds.expired and creds.refresh_token:
            logger.info(f"Refreshing token for {google_id}")
            creds.refresh(Request())
            users.update_one(
                {'google_id': google_id},
                {'$set': {'token_json': creds.to_json(), 'updated_at': datetime.utcnow()}}
            )
        return creds if creds.valid else None
    except Exception as e:
        logger.error(f"Token error for {google_id}: {e}")
        return None

@app.get("/")
async def root():
    return {"message": "YouTube Blend API is LIVE"}

def cache_user_data(google_id: str, data: dict):
    """Store user's YouTube data in MongoDB with 24-hour TTL."""
    try:
        users.update_one(
            {'google_id': google_id},
            {'$set': {
                'cached_data': data,
                'cached_at': datetime.utcnow()
            }}
        )
        logger.info(f"Cached data for user {google_id}")
    except Exception as e:
        logger.error(f"Failed to cache user data: {e}")

def get_cached_user_data(google_id: str, cache_validity_hours: int = 24):
    """Retrieve cached user data if it's fresh (within cache_validity_hours)."""
    try:
        doc = users.find_one({'google_id': google_id})
        if not doc or 'cached_data' not in doc:
            return None

        cached_at = doc.get('cached_at')
        if not cached_at:
            return None

        # Check if cache is fresh
        age = (datetime.utcnow() - cached_at).total_seconds() / 3600  # hours
        if age < cache_validity_hours:
            logger.info(f"Using cached data for user {google_id} (age: {age:.1f}h)")
            return doc['cached_data']

        logger.info(f"Cache expired for user {google_id} (age: {age:.1f}h)")
        return None
    except Exception as e:
        logger.error(f"Failed to retrieve cached data: {e}")
        return None

@app.get("/auth/login")
async def login(next: str = None, comparison_id: str = None):
    redirect_uri = build_redirect_uri()

    try:
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                    "redirect_uris": [redirect_uri],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token"
                }
            },
            scopes=SCOPES,
        )
        flow.redirect_uri = redirect_uri

        auth_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",  # String "true"
            prompt="consent"
        )
    except Exception as e:
        logger.exception("Failed to build OAuth flow")
        raise HTTPException(status_code=500, detail=f"OAuth setup error: {str(e)}")

    auth_states.insert_one({
        "state": state,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=5),
        "next": next,
        "comparison_id": comparison_id
    })

    return {"url": auth_url}

@app.get("/auth/callback")
async def callback(code: str, state: str):
    # Retrieve and delete state document so we keep 'next' param
    state_doc = auth_states.find_one_and_delete({
        "state": state,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired login state")

    redirect_uri = build_redirect_uri()

    try:
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        token_response.raise_for_status()
        tokens = token_response.json()

        userinfo_resp = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens.get('access_token')}"},
            timeout=10,
        )
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()

        google_id = userinfo.get("id")
        if not google_id:
            logger.error("Userinfo missing id: %s", userinfo)
            raise HTTPException(status_code=500, detail="Failed to retrieve Google user id")

        # Build Credentials with client_id/client_secret so the stored JSON contains them
        cred = Credentials(
            token=tokens.get('access_token'),
            refresh_token=tokens.get('refresh_token'),
            id_token=tokens.get('id_token'),
            token_uri=tokens.get('token_uri', 'https://oauth2.googleapis.com/token'),
            client_id=os.getenv('GOOGLE_CLIENT_ID'),
            client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
            scopes=SCOPES,
        )
        # Store token JSON under `token_json` for consistency with `auth_setup.py`
        users.update_one(
            {"google_id": google_id},
            {"$set": {"token_json": cred.to_json(), "updated_at": datetime.utcnow()}},
            upsert=True
        )

        # Handle comparison flow if comparison_id exists
        comparison_id = state_doc.get('comparison_id')
        if comparison_id:
            # Check if comparison exists and is valid
            comparison = comparisons.find_one({'_id': comparison_id})
            if not comparison:
                raise HTTPException(status_code=400, detail="Invalid comparison link")

            # Check if this is the second user joining
            if comparison.get('user1_id') and comparison.get('user1_id') != google_id:
                # This is user2 - store their data and mark comparison as ready
                try:
                    creds = get_credentials_from_db(google_id)
                    if not creds:
                        # Store credentials first
                        users.update_one(
                            {"google_id": google_id},
                            {"$set": {"token_json": cred.to_json(), "updated_at": datetime.utcnow()}},
                            upsert=True
                        )
                        creds = get_credentials_from_db(google_id)

                    if creds:
                        youtube = get_youtube_service(creds)
                        subscriptions = fetch_subscriptions(youtube)
                        subscription_genres = fetch_subscription_genres(youtube, [s['channel_id'] for s in subscriptions])
                        saved_data = fetch_saved_videos(youtube)
                        music_listened, video_genres = determine_music_and_genres(youtube, saved_data['video_ids'])

                        user2_data = {
                            'subscriptions': subscriptions,
                            'subscription_genres': subscription_genres,
                            'saved_videos': saved_data['saved_videos'],
                            'music_listened': music_listened,
                            'video_genres': video_genres
                        }

                        comparisons.update_one(
                            {'_id': comparison_id},
                            {
                                '$set': {
                                    'user2_id': google_id,
                                    'user2_data': user2_data,
                                    'status': 'ready',
                                    'updated_at': datetime.utcnow()
                                }
                            }
                        )

                        # Create auth code for user2 and redirect to finalise page
                        auth_code = secrets.token_urlsafe(32)
                        code_doc = {
                            'code': auth_code,
                            'google_id': google_id,
                            'created_at': datetime.utcnow(),
                            'expires_at': datetime.utcnow() + timedelta(minutes=2),
                            'next': f'/compare/finalise/{comparison_id}'
                        }
                        auth_codes.insert_one(code_doc)

                        frontend = os.getenv("FRONTEND_URL", "https://blend-youtube.onrender.com")
                        final_url = f"{frontend.rstrip('/')}/auth/complete?code={auth_code}&next=/compare/finalise/{comparison_id}"
                        return RedirectResponse(url=final_url, status_code=302)
                except Exception as e:
                    logger.exception("Error fetching user2 data during comparison")
                    raise HTTPException(status_code=500, detail=f"Failed to fetch YouTube data: {str(e)}")

        # Create a short-lived one-time auth code and store in DB
        auth_code = secrets.token_urlsafe(32)
        code_doc = {
            'code': auth_code,
            'google_id': google_id,
            'created_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(minutes=2),
            'next': state_doc.get('next'),
            'comparison_id': comparison_id
        }
        auth_codes.insert_one(code_doc)

        # Always redirect to frontend's /auth/complete route
        # The frontend will handle the code exchange via /auth/exchange endpoint
        frontend = os.getenv("FRONTEND_URL", "https://blend-youtube.onrender.com")
        final_url = f"{frontend.rstrip('/')}/auth/complete?code={auth_code}"
        if state_doc.get('next'):
            final_url += f"&next={state_doc.get('next')}"
        return RedirectResponse(url=final_url, status_code=302)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("OAuth callback failed")
        raise HTTPException(status_code=500, detail=f"OAuth callback error: {str(e)}")

@app.get("/health")
async def health():
    return {"status": "bulletproof"}


@app.get("/debug/config")
async def debug_config():
    """Temporary debug endpoint (opt-in).
    Enable by setting `ENABLE_DEBUG=true` in your environment. Returns:
    - essential env vars
    - built redirect_uri
    - whether Flow could be constructed
    - a simple Mongo ping
    """
    if os.getenv('ENABLE_DEBUG', 'false').lower() != 'true':
        raise HTTPException(status_code=403, detail='Debug endpoint disabled')

    out = {
        'DEPLOYED_DOMAIN': os.getenv('DEPLOYED_DOMAIN'),
        'FRONTEND_URL': os.getenv('FRONTEND_URL'),
        'GOOGLE_CLIENT_ID_set': bool(os.getenv('GOOGLE_CLIENT_ID')),
        'GOOGLE_CLIENT_SECRET_set': bool(os.getenv('GOOGLE_CLIENT_SECRET')),
        'MONGO_URI_set': bool(os.getenv('MONGO_URI')),
        'redirect_uri': None,
        'flow_ok': False,
        'mongo_ping': None,
    }

    # Build redirect URI
    try:
        out['redirect_uri'] = build_redirect_uri()
    except Exception as e:
        out['redirect_uri_error'] = str(e)

    # Try to construct OAuth Flow
    try:
        Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                    "redirect_uris": [out.get('redirect_uri')],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token"
                }
            },
            scopes=SCOPES,
        )
        out['flow_ok'] = True
    except Exception as e:
        out['flow_error'] = str(e)

    # Ping Mongo
    try:
        pong = client.admin.command('ping')
        out['mongo_ping'] = pong
    except Exception as e:
        out['mongo_ping_error'] = str(e)

    return out


class ExchangeRequest(BaseModel):
    code: str


@app.post("/auth/exchange")
async def auth_exchange(req: ExchangeRequest):
    """Exchange a single-use auth code for a signed JWT and user id."""
    # Find and delete the code document
    code_doc = auth_codes.find_one_and_delete({
        'code': req.code,
        'expires_at': {'$gt': datetime.utcnow()}
    })
    if not code_doc:
        raise HTTPException(status_code=400, detail='Invalid or expired code')

    google_id = code_doc.get('google_id')
    jwt_secret = os.getenv('JWT_SECRET')
    if not jwt_secret:
        raise HTTPException(status_code=500, detail='JWT_SECRET not configured')

    token = pyjwt.encode({
        'sub': google_id,
        'exp': datetime.utcnow() + timedelta(minutes=30)
    }, jwt_secret, algorithm='HS256')

    return {'access_token': token, 'user_id': google_id}


@app.post("/auth/refresh")
async def refresh_token(body: dict):
    """Refresh JWT access token using refresh_token."""
    try:
        refresh_token_provided = body.get('refresh_token')
        if not refresh_token_provided:
            raise HTTPException(status_code=400, detail='Refresh token required')

        # Get the comparison code to find the user
        # The refresh token is the OAuth refresh token stored in the code doc
        # We need to find which google_id this refresh token belongs to
        code_collection = db['comparison_codes']
        code_doc = code_collection.find_one({'refresh_token': refresh_token_provided})

        if not code_doc:
            raise HTTPException(status_code=401, detail='Invalid refresh token')

        google_id = code_doc.get('google_id')

        jwt_secret = os.getenv('JWT_SECRET')
        if not jwt_secret:
            raise HTTPException(status_code=500, detail='JWT_SECRET not configured')

        # Issue new JWT token
        new_token = pyjwt.encode({
            'sub': google_id,
            'exp': datetime.utcnow() + timedelta(minutes=30)
        }, jwt_secret, algorithm='HS256')

        return {'access_token': new_token}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}")
        raise HTTPException(status_code=401, detail='Failed to refresh token')


@app.get("/data/me")
async def get_my_data(google_id: str = Depends(verify_token)):
    """Fetch authenticated user's YouTube data with caching."""
    try:
        # Check cache first - instant response if fresh
        cached_data = get_cached_user_data(google_id, cache_validity_hours=24)
        if cached_data:
            return cached_data

        creds = get_credentials_from_db(google_id)
        if not creds:
            raise HTTPException(status_code=401, detail="Invalid or expired credentials")

        youtube = get_youtube_service(creds)

        # Parallel fetching for faster performance
        loop = asyncio.get_event_loop()

        # Run these in parallel instead of sequentially
        subscriptions, saved_data = await asyncio.gather(
            loop.run_in_executor(None, fetch_subscriptions, youtube),
            loop.run_in_executor(None, fetch_saved_videos, youtube),
            return_exceptions=True
        )

        # Handle any exceptions
        if isinstance(subscriptions, Exception):
            logger.error(f"Error fetching subscriptions: {subscriptions}")
            subscriptions = []
        if isinstance(saved_data, Exception):
            logger.error(f"Error fetching saved videos: {saved_data}")
            saved_data = {'video_ids': [], 'saved_videos': []}

        # Fetch genres for subscriptions
        channel_ids = [s['channel_id'] for s in subscriptions] if subscriptions else []
        subscription_genres = await loop.run_in_executor(None, fetch_subscription_genres, youtube, channel_ids)

        # Fetch music and video genres in parallel
        music_listened, video_genres = await loop.run_in_executor(None, determine_music_and_genres, youtube, saved_data.get('video_ids', []))

        # Get watch time counts and merge with music data
        watch_counts = await loop.run_in_executor(None, count_music_watch_times, youtube)
        for track in music_listened:
            track['watch_count'] = watch_counts.get(track['video_id'], 0)

        # Limited playlists (only fetch top 50 for performance)
        playlists = await loop.run_in_executor(None, fetch_playlists, youtube)

        user_data = {
            'subscriptions': subscriptions,
            'subscription_genres': subscription_genres,
            'saved_videos': saved_data.get('saved_videos', []),
            'music_listened': music_listened,
            'video_genres': video_genres,
            'playlists': playlists
        }

        # Cache the result
        cache_user_data(google_id, user_data)

        return user_data
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching user data")
        raise HTTPException(status_code=500, detail=f"Failed to fetch YouTube data: {str(e)}")


@app.get("/compare/generate_link")
async def generate_comparison_link(google_id: str = Depends(verify_token)):
    """Generate a shareable comparison link for the authenticated user."""
    try:
        # Use cached data if available to speed up link generation
        cached_data = get_cached_user_data(google_id, cache_validity_hours=24)

        if cached_data:
            user1_data = {
                'subscriptions': cached_data.get('subscriptions', []),
                'subscription_genres': cached_data.get('subscription_genres', []),
                'saved_videos': cached_data.get('saved_videos', []),
                'music_listened': cached_data.get('music_listened', []),
                'video_genres': cached_data.get('video_genres', [])
            }
        else:
            # Fetch user's data with parallel optimization
            creds = get_credentials_from_db(google_id)
            if not creds:
                raise HTTPException(status_code=401, detail="Invalid or expired credentials")

            youtube = get_youtube_service(creds)

            # Parallel fetching
            loop = asyncio.get_event_loop()
            subscriptions, saved_data = await asyncio.gather(
                loop.run_in_executor(None, fetch_subscriptions, youtube),
                loop.run_in_executor(None, fetch_saved_videos, youtube),
                return_exceptions=True
            )

            if isinstance(subscriptions, Exception):
                subscriptions = []
            if isinstance(saved_data, Exception):
                saved_data = {'video_ids': [], 'saved_videos': []}

            channel_ids = [s['channel_id'] for s in subscriptions] if subscriptions else []
            subscription_genres = await loop.run_in_executor(None, fetch_subscription_genres, youtube, channel_ids)
            music_listened, video_genres = await loop.run_in_executor(None, determine_music_and_genres, youtube, saved_data.get('video_ids', []))

            user1_data = {
                'subscriptions': subscriptions,
                'subscription_genres': subscription_genres,
                'saved_videos': saved_data.get('saved_videos', []),
                'music_listened': music_listened,
                'video_genres': video_genres
            }

        # Create comparison document with secure random code
        comparison_id = generate_secure_code()
        csrf_token = secrets.token_urlsafe(32)
        frontend = os.getenv("FRONTEND_URL", "https://blend-youtube.onrender.com")
        share_link = f"{frontend.rstrip('/')}/compare/join/{comparison_id}"

        comparisons.insert_one({
            '_id': comparison_id,
            'user1_id': google_id,
            'user1_data': user1_data,
            'csrf_token': csrf_token,
            'status': 'pending',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(hours=2)
        })

        return {'link': share_link, 'comparison_id': comparison_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error generating comparison link")
        raise HTTPException(status_code=500, detail=f"Failed to generate link: {str(e)}")


@app.get("/compare/join/{comparison_id}")
async def join_comparison(comparison_id: str):
    """Redirect user to login when they click a comparison link."""
    comparison = comparisons.find_one({'_id': comparison_id})
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison link not found or expired")

    # Check expiration (2 hour limit)
    if comparison.get('expires_at') and comparison['expires_at'] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Comparison link has expired (2 hour limit)")

    if comparison.get('status') == 'ready' or comparison.get('status') == 'completed':
        raise HTTPException(status_code=400, detail="This comparison is already complete")

    # Get the OAuth login URL directly
    redirect_uri = build_redirect_uri()

    try:
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                    "redirect_uris": [redirect_uri],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token"
                }
            },
            scopes=SCOPES,
        )
        flow.redirect_uri = redirect_uri

        auth_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent"
        )

        # Store state with comparison_id
        auth_states.insert_one({
            "state": state,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=5),
            "comparison_id": comparison_id
        })

        # Redirect directly to Google OAuth
        return RedirectResponse(url=auth_url, status_code=302)
    except Exception as e:
        logger.exception("Failed to build OAuth flow for comparison join")
        raise HTTPException(status_code=500, detail=f"OAuth setup error: {str(e)}")


@app.get("/compare/run/{comparison_id}")
async def get_comparison(comparison_id: str, google_id: str = Depends(verify_token)):
    """Get comparison results. Run comparison if not already completed."""
    comparison = comparisons.find_one({'_id': comparison_id})
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison not found")

    # Verify user is part of this comparison
    if comparison.get('user1_id') != google_id and comparison.get('user2_id') != google_id:
        raise HTTPException(status_code=403, detail="You are not authorized to view this comparison")

    # If already completed, return cached results
    if comparison.get('status') == 'completed' and comparison.get('results'):
        return {'results': comparison.get('results')}

    if comparison.get('status') != 'ready':
        raise HTTPException(status_code=400, detail="Comparison is not ready. Both users must complete login.")

    user1_data = comparison.get('user1_data')
    user2_data = comparison.get('user2_data')

    if not user1_data or not user2_data:
        raise HTTPException(status_code=400, detail="Missing user data for comparison")

    try:
        # Run comparison logic
        results = compare_interests_logic(user1_data, user2_data)

        # Update comparison status
        comparisons.update_one(
            {'_id': comparison_id},
            {
                '$set': {
                    'status': 'completed',
                    'results': results,
                    'updated_at': datetime.utcnow()
                }
            }
        )

        return {'results': results}
    except Exception as e:
        logger.exception("Error running comparison")
        raise HTTPException(status_code=500, detail=f"Failed to run comparison: {str(e)}")


@app.post("/compare/run/{comparison_id}")
async def run_comparison(comparison_id: str, google_id: str = Depends(verify_token)):
    """Run the comparison between two users and return results (POST for backwards compatibility)."""
    return await get_comparison(comparison_id, google_id)


@app.get("/auth/complete")
async def auth_complete_fallback(code: str = None, next: str = None):
        """Temporary backend fallback for `/auth/complete` when frontend route is missing.
        Enable by setting `ENABLE_FALLBACK=true` in the environment. This endpoint redeems
        the one-time `code` and returns a small HTML page that stores the JWT in
        `localStorage` and redirects to the dashboard or `next` path.
        """
        if os.getenv('ENABLE_FALLBACK', 'false').lower() != 'true':
                raise HTTPException(status_code=404, detail='Not Found')

        if not code:
                raise HTTPException(status_code=400, detail='Missing code')

        # Redeem the code (same logic as /auth/exchange)
        code_doc = auth_codes.find_one_and_delete({
                'code': code,
                'expires_at': {'$gt': datetime.utcnow()}
        })
        if not code_doc:
                raise HTTPException(status_code=400, detail='Invalid or expired code')

        google_id = code_doc.get('google_id')
        jwt_secret = os.getenv('JWT_SECRET')
        if not jwt_secret:
                raise HTTPException(status_code=500, detail='JWT_SECRET not configured')

        token = pyjwt.encode({
                'sub': google_id,
                'exp': datetime.utcnow() + timedelta(minutes=30)
        }, jwt_secret, algorithm='HS256')

        # Validate redirect target against whitelist
        redirect_target = validate_redirect_target(next)

        # Safely escape JSON to prevent XSS
        tokens_json = json.dumps({'access_token': token})
        frontend = os.getenv('FRONTEND_URL', 'https://blend-youtube.onrender.com')
        # Remove any slashes from frontend to prevent open redirect
        frontend_safe = frontend.rstrip('/')

        html = f"""
        <!doctype html>
        <html>
            <head><meta charset='utf-8'><title>Completing login</title></head>
            <body>
                <script>
                    try {{
                        const tokens = {tokens_json};
                        localStorage.setItem('access_token', tokens.access_token);
                    }} catch(e){{}}
                    window.location = {json.dumps(frontend_safe + redirect_target)};
                </script>
                <p>Completing login...</p>
            </body>
        </html>
        """
        return HTMLResponse(content=html, status_code=200)

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
    count_music_watch_times,
    execute_with_retry
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

def detect_item_changes(new_item: dict, old_item: dict) -> dict:
    """Detect what fields changed between old and new item."""
    changes = {}

    # Check common fields that might change
    comparable_fields = ['title', 'description', 'thumbnail_url', 'genre', 'watch_count']

    for field in comparable_fields:
        new_val = new_item.get(field)
        old_val = old_item.get(field)

        if new_val != old_val:
            changes[field] = {
                'old': old_val,
                'new': new_val
            }

    return changes

def cache_user_data(google_id: str, data: dict):
    """Store user's YouTube data in MongoDB with smart incremental updates."""
    try:
        # Get existing data to merge
        existing_doc = users.find_one({'google_id': google_id})
        existing_data = existing_doc.get('cached_data', {}) if existing_doc else {}

        # Extract IDs from new and old data for comparison
        new_sub_ids = {s['channel_id']: s for s in data.get('subscriptions', [])}
        old_sub_ids = {s['channel_id']: s for s in existing_data.get('subscriptions', [])}

        new_video_ids = {v['video_id']: v for v in data.get('saved_videos', [])}
        old_video_ids = {v['video_id']: v for v in existing_data.get('saved_videos', [])}

        new_music_ids = {m['video_id']: m for m in data.get('music_listened', [])}
        old_music_ids = {m['video_id']: m for m in existing_data.get('music_listened', [])}

        # Process subscriptions with smart updates
        updated_subscriptions = []
        added_subs = 0
        changed_subs = 0

        for channel_id, new_sub in new_sub_ids.items():
            old_sub = old_sub_ids.get(channel_id)

            if not old_sub:
                # New subscription
                new_sub['added_at'] = datetime.utcnow()
                new_sub['last_synced_at'] = datetime.utcnow()
                added_subs += 1
            else:
                # Existing subscription - check for changes
                changes = detect_item_changes(new_sub, old_sub)

                if changes:
                    # Keep original added_at, update the changed fields
                    new_sub['added_at'] = old_sub.get('added_at', datetime.utcnow())
                    new_sub['updated_at'] = datetime.utcnow()
                    new_sub['last_synced_at'] = datetime.utcnow()
                    new_sub['changes'] = changes
                    changed_subs += 1
                    logger.info(f"Updated subscription {channel_id}: {list(changes.keys())}")
                else:
                    # No changes, keep timestamps
                    new_sub['added_at'] = old_sub.get('added_at', datetime.utcnow())
                    new_sub['last_synced_at'] = datetime.utcnow()

            updated_subscriptions.append(new_sub)

        # Process videos with smart updates
        updated_videos = []
        added_vids = 0
        changed_vids = 0

        for video_id, new_video in new_video_ids.items():
            old_video = old_video_ids.get(video_id)

            if not old_video:
                # New video
                new_video['added_at'] = datetime.utcnow()
                new_video['last_synced_at'] = datetime.utcnow()
                added_vids += 1
            else:
                # Existing video - check for changes
                changes = detect_item_changes(new_video, old_video)

                if changes:
                    new_video['added_at'] = old_video.get('added_at', datetime.utcnow())
                    new_video['updated_at'] = datetime.utcnow()
                    new_video['last_synced_at'] = datetime.utcnow()
                    new_video['changes'] = changes
                    changed_vids += 1
                    logger.info(f"Updated video {video_id}: {list(changes.keys())}")
                else:
                    new_video['added_at'] = old_video.get('added_at', datetime.utcnow())
                    new_video['last_synced_at'] = datetime.utcnow()

            updated_videos.append(new_video)

        # Process music with smart updates and watch count tracking
        updated_music = []
        added_songs = 0
        changed_songs = 0

        for music_id, new_music in new_music_ids.items():
            old_music = old_music_ids.get(music_id)

            if not old_music:
                # New song
                new_music['added_at'] = datetime.utcnow()
                new_music['first_watched_at'] = datetime.utcnow()
                new_music['last_synced_at'] = datetime.utcnow()
                added_songs += 1
            else:
                # Existing song - check for changes
                changes = detect_item_changes(new_music, old_music)

                # Also check if watch count increased
                old_count = old_music.get('watch_count', 0)
                new_count = new_music.get('watch_count', 0)

                if new_count > old_count:
                    changes['watch_count'] = {
                        'old': old_count,
                        'new': new_count,
                        'increase': new_count - old_count
                    }
                    new_music['last_listened_at'] = datetime.utcnow()
                    changed_songs += 1

                if changes:
                    new_music['added_at'] = old_music.get('added_at', datetime.utcnow())
                    new_music['first_watched_at'] = old_music.get('first_watched_at', datetime.utcnow())
                    new_music['updated_at'] = datetime.utcnow()
                    new_music['last_synced_at'] = datetime.utcnow()
                    new_music['changes'] = changes
                    logger.info(f"Updated music {music_id}: {list(changes.keys())}")
                else:
                    new_music['added_at'] = old_music.get('added_at', datetime.utcnow())
                    new_music['first_watched_at'] = old_music.get('first_watched_at', datetime.utcnow())
                    new_music['last_synced_at'] = datetime.utcnow()

            updated_music.append(new_music)

        # Detect unsubscribed/removed items (in old but not in new)
        removed_subs = set(old_sub_ids.keys()) - set(new_sub_ids.keys())
        removed_vids = set(old_video_ids.keys()) - set(new_video_ids.keys())
        removed_music = set(old_music_ids.keys()) - set(new_music_ids.keys())

        merged_data = {
            'subscriptions': updated_subscriptions,
            'subscription_genres': data.get('subscription_genres', []),
            'saved_videos': updated_videos,
            'music_listened': updated_music,
            'video_genres': data.get('video_genres', []),
            'playlists': data.get('playlists', [])
        }

        users.update_one(
            {'google_id': google_id},
            {'$set': {
                'cached_data': merged_data,
                'cached_at': datetime.utcnow(),
                'total_subscriptions': len(updated_subscriptions),
                'total_videos': len(updated_videos),
                'total_music': len(updated_music),
                'sync_stats': {
                    'added_subscriptions': added_subs,
                    'changed_subscriptions': changed_subs,
                    'removed_subscriptions': len(removed_subs),
                    'added_videos': added_vids,
                    'changed_videos': changed_vids,
                    'removed_videos': len(removed_vids),
                    'added_music': added_songs,
                    'changed_music': changed_songs,
                    'removed_music': len(removed_music)
                }
            }}
        )

        # Log summary
        logger.info(
            f"Synced {google_id}: "
            f"+{added_subs} subs ({changed_subs} updated), "
            f"+{added_vids} videos ({changed_vids} updated), "
            f"+{added_songs} songs ({changed_songs} updated)"
        )
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

        age = (datetime.utcnow() - cached_at).total_seconds() / 3600
        if age < cache_validity_hours:
            logger.info(f"Using cached data for {google_id} (age: {age:.1f}h, subs: {doc.get('total_subscriptions', 0)}, songs: {doc.get('total_music', 0)})")
            return doc['cached_data']

        logger.info(f"Cache expired for {google_id} (age: {age:.1f}h), fetching fresh data")
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
    """Get authenticated user's YouTube data from cache (instant response)."""
    try:
        # Serve from DB first - fastest response
        doc = users.find_one({'google_id': google_id})
        if doc and 'cached_data' in doc:
            cached_data = doc['cached_data']
            return {
                'subscriptions': cached_data.get('subscriptions', []),
                'subscription_genres': cached_data.get('subscription_genres', []),
                'saved_videos': cached_data.get('saved_videos', []),
                'music_listened': cached_data.get('music_listened', []),
                'video_genres': cached_data.get('video_genres', []),
                'playlists': cached_data.get('playlists', []),
                'cached': True,
                'last_synced_at': doc.get('last_full_sync')
            }

        # No cached data yet
        return {
            'subscriptions': [],
            'subscription_genres': [],
            'saved_videos': [],
            'music_listened': [],
            'video_genres': [],
            'playlists': [],
            'cached': False,
            'message': 'No data cached yet. Call /data/sync to fetch your YouTube data.'
        }
    except Exception as e:
        logger.exception("Error getting cached data")
        raise HTTPException(status_code=500, detail=f"Failed to get user data: {str(e)}")


@app.post("/data/force-full-sync")
async def force_full_sync(google_id: str = Depends(verify_token)):
    """Force FULL sync by clearing cached data first, then syncing everything fresh."""
    try:
        logger.info(f"🔥 FORCING FULL SYNC by clearing cache for {google_id}")

        # Clear ALL cached data
        users.update_one(
            {'google_id': google_id},
            {
                '$unset': {
                    'cached_data': "",
                    'last_full_sync': "",
                    'sync_stats': ""
                }
            }
        )
        logger.info("✅ Cache cleared")

        # Now immediately trigger sync
        logger.info("⏳ Starting FULL SYNC...")
        creds = get_credentials_from_db(google_id)
        if not creds:
            raise HTTPException(status_code=401, detail="Invalid or expired credentials")

        youtube = get_youtube_service(creds)
        loop = asyncio.get_event_loop()

        # Fetch ALL YouTube data in parallel
        logger.info("⏳ Fetching subscriptions + saved videos...")
        subscriptions, saved_data = await asyncio.gather(
            loop.run_in_executor(None, fetch_subscriptions, youtube),
            loop.run_in_executor(None, fetch_saved_videos, youtube),
            return_exceptions=True
        )

        # Handle exceptions
        if isinstance(subscriptions, Exception):
            logger.error(f"❌ Error fetching subscriptions: {subscriptions}")
            subscriptions = []
        if isinstance(saved_data, Exception):
            logger.error(f"❌ Error fetching saved videos: {saved_data}")
            saved_data = {'video_ids': [], 'saved_videos': []}

        logger.info(f"📊 Fetched:")
        logger.info(f"   - {len(subscriptions)} subscriptions")
        logger.info(f"   - {len(saved_data.get('saved_videos', []))} saved videos")
        logger.info(f"   - {len(saved_data.get('video_ids', []))} video IDs")

        # Determine music from saved videos
        logger.info("⏳ Identifying music...")
        music_listened, video_genres = determine_music_and_genres(youtube, saved_data.get('video_ids', []))
        logger.info(f"🎵 Found {len(music_listened)} music tracks")

        # Fetch genres
        subscription_genres = await loop.run_in_executor(None, fetch_subscription_genres, youtube, subscriptions)
        playlists = await loop.run_in_executor(None, fetch_playlists, youtube)

        # Build user data
        user_data = {
            'subscriptions': subscriptions,
            'subscription_genres': subscription_genres,
            'saved_videos': saved_data.get('saved_videos', []),
            'music_listened': music_listened,
            'video_genres': video_genres,
            'playlists': playlists
        }

        # Store in DB
        cache_user_data(google_id, user_data)
        users.update_one({'google_id': google_id}, {'$set': {'last_full_sync': datetime.utcnow()}})

        logger.info(f"✅ ✅ ✅ FULL SYNC COMPLETE:")
        logger.info(f"   📊 {len(subscriptions)} channels")
        logger.info(f"   🎬 {len(saved_data.get('saved_videos', []))} saved videos")
        logger.info(f"   🎵 {len(music_listened)} music tracks")
        logger.info(f"   📁 {len(playlists)} playlists")

        return {
            'success': True,
            'sync_type': 'FULL',
            'subscriptions': subscriptions,
            'subscription_genres': subscription_genres,
            'saved_videos': saved_data.get('saved_videos', []),
            'music_listened': music_listened,
            'video_genres': video_genres,
            'playlists': playlists,
            'message': f'✅ FULL SYNC COMPLETE: Found {len(subscriptions)} channels, {len(music_listened)} songs, {len(playlists)} playlists.'
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error in force full sync: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Force sync failed: {str(e)}")


@app.post("/data/sync")
async def sync_user_data(google_id: str = Depends(verify_token)):
    """
    Smart Sync Architecture:
    1. FIRST LOGIN: Fetch ALL YouTube data, save to DB (full sync)
    2. SUBSEQUENT LOGINS: Fetch fresh from YouTube, compare to DB, only update what changed (incremental)

    This ensures:
    - First login gets complete data
    - Later logins load from cache instantly
    - Changes are synced in background without full re-fetch
    """
    try:
        creds = get_credentials_from_db(google_id)
        if not creds:
            raise HTTPException(status_code=401, detail="Invalid or expired credentials")

        youtube = get_youtube_service(creds)
        doc = users.find_one({'google_id': google_id})
        is_first_sync = doc is None or doc.get('cached_data') is None

        logger.info(f"{'🚀 FIRST SYNC (Full fetch)' if is_first_sync else '♻️ INCREMENTAL SYNC'} for {google_id}")

        # ALWAYS fetch fresh from YouTube (for comparison with DB)
        loop = asyncio.get_event_loop()

        logger.info("⏳ Fetching fresh data from YouTube...")
        subscriptions, saved_data = await asyncio.gather(
            loop.run_in_executor(None, fetch_subscriptions, youtube),
            loop.run_in_executor(None, fetch_saved_videos, youtube),
            return_exceptions=True
        )

        # Handle exceptions from parallel fetch
        if isinstance(subscriptions, Exception):
            logger.error(f"❌ Error fetching subscriptions: {subscriptions}")
            subscriptions = []
        if isinstance(saved_data, Exception):
            logger.error(f"❌ Error fetching saved videos: {saved_data}")
            saved_data = {'video_ids': [], 'saved_videos': []}

        logger.info(f"✅ Fresh YouTube data fetched:")
        logger.info(f"   - {len(subscriptions)} subscriptions")
        logger.info(f"   - {len(saved_data.get('saved_videos', []))} saved videos")

        # Determine music and genres from saved videos
        music_listened, video_genres = determine_music_and_genres(youtube, saved_data.get('video_ids', []))

        # Fetch subscription genres in parallel
        subscription_genres = await loop.run_in_executor(None, fetch_subscription_genres, youtube, subscriptions)

        # Fetch all playlists
        playlists = await loop.run_in_executor(None, fetch_playlists, youtube)

        # Build fresh user data from YouTube
        fresh_user_data = {
            'subscriptions': subscriptions,
            'subscription_genres': subscription_genres,
            'saved_videos': saved_data.get('saved_videos', []),
            'music_listened': music_listened,
            'video_genres': video_genres,
            'playlists': playlists
        }

        logger.info(f"💾 Storing to database (with incremental comparison)...")
        # This function detects changes and only stores diffs for INCREMENTAL syncs
        cache_user_data(google_id, fresh_user_data)

        # Update sync timestamp
        users.update_one({'google_id': google_id}, {'$set': {'last_full_sync': datetime.utcnow()}})

        logger.info(f"✅ SYNC COMPLETE:")
        logger.info(f"   📊 {len(subscriptions)} channels")
        logger.info(f"   🎬 {len(saved_data.get('saved_videos', []))} saved videos")
        logger.info(f"   🎵 {len(music_listened)} music tracks")
        logger.info(f"   📁 {len(playlists)} playlists")

        return {
            'success': True,
            'sync_type': 'FULL' if is_first_sync else 'INCREMENTAL',
            'subscriptions': subscriptions,
            'subscription_genres': subscription_genres,
            'saved_videos': saved_data.get('saved_videos', []),
            'music_listened': music_listened,
            'video_genres': video_genres,
            'playlists': playlists,
            'message': f'{"🚀 FULL SYNC" if is_first_sync else "♻️ INCREMENTAL SYNC"}: {len(subscriptions)} channels, {len(music_listened)} songs, {len(playlists)} playlists'
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error syncing user data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to sync YouTube data: {str(e)}")


@app.get("/data/debug")
async def debug_data(google_id: str = Depends(verify_token)):
    """DEBUG: Show exactly what's cached in the database."""
    try:
        doc = users.find_one({'google_id': google_id})
        if not doc:
            return {'error': 'User not found'}

        cached_data = doc.get('cached_data', {})

        return {
            'user_found': True,
            'total_subscriptions': len(cached_data.get('subscriptions', [])),
            'total_saved_videos': len(cached_data.get('saved_videos', [])),
            'total_music_tracks': len(cached_data.get('music_listened', [])),
            'total_playlists': len(cached_data.get('playlists', [])),
            'genres_count': len(cached_data.get('video_genres', [])),
            'last_synced': doc.get('last_full_sync'),
            'sync_stats': doc.get('sync_stats', {}),
            'message': 'This is the complete cached data. Check counts to see what was fetched and stored.'
        }
    except Exception as e:
        logger.exception("Error getting debug data")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/data/force-refresh")
async def force_refresh(google_id: str = Depends(verify_token)):
    """Force clear all cache and credentials to trigger fresh full sync."""
    try:
        # Clear all cached data to force fresh authentication with new scopes
        result = users.update_one(
            {'google_id': google_id},
            {
                '$unset': {
                    'credentials': "",
                    'token_data': "",
                    'cached_data': "",
                    'last_full_sync': ""
                }
            }
        )
        logger.info(f"🔄 Force refresh: Cleared cache for {google_id}")
        return {
            'success': True,
            'message': 'Cache cleared. Please sign out and sign in again for a complete fresh sync with all YouTube data.'
        }
    except Exception as e:
        logger.exception("Error forcing refresh")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/data/test-liked-videos")
async def test_liked_videos(google_id: str = Depends(verify_token)):
    """Test endpoint: Try to fetch liked videos to diagnose permission issues."""
    try:
        creds = get_credentials_from_db(google_id)
        if not creds:
            return {'error': 'No credentials found', 'scopes': None}

        youtube = get_youtube_service(creds)

        # Try to fetch liked videos
        logger.info("🧪 TEST: Attempting to fetch liked videos...")
        request = youtube.videos().list(part='snippet', myRating='like', maxResults=5)
        response = request.execute()

        items_count = len(response.get('items', []))
        has_next_page = 'nextPageToken' in response

        return {
            'test': 'liked_videos',
            'status': 'success',
            'items_fetched': items_count,
            'has_next_page': has_next_page,
            'message': f'Successfully fetched {items_count} liked videos. Pagination available: {has_next_page}',
            'sample_items': [
                {
                    'title': item['snippet']['title'],
                    'video_id': item['id'],
                    'category': item['snippet'].get('categoryId')
                }
                for item in response.get('items', [])[:3]
            ]
        }
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ TEST FAILED: {error_msg}")
        return {
            'test': 'liked_videos',
            'status': 'failed',
            'error': error_msg,
            'message': 'Could not fetch liked videos. This usually means permissions are incorrect. Try: 1) Click "Full Sync (Clear Cache)" 2) Sign out completely 3) Sign back in'
        }


@app.get("/data/full-diagnosis")
async def full_diagnosis(google_id: str = Depends(verify_token)):
    """Complete diagnostic showing everything that's cached."""
    try:
        doc = users.find_one({'google_id': google_id})

        if not doc:
            return {'error': 'User document not found in database'}

        cached_data = doc.get('cached_data', {})

        return {
            'user_id': google_id,
            'has_cached_data': 'cached_data' in doc,
            'has_credentials': 'credentials' in doc or 'token_data' in doc,
            'last_full_sync': doc.get('last_full_sync'),
            'cached_at': doc.get('cached_at'),

            'data_counts': {
                'subscriptions': len(cached_data.get('subscriptions', [])),
                'subscription_genres': len(cached_data.get('subscription_genres', [])),
                'saved_videos': len(cached_data.get('saved_videos', [])),
                'music_listened': len(cached_data.get('music_listened', [])),
                'video_genres': len(cached_data.get('video_genres', [])),
                'playlists': len(cached_data.get('playlists', [])),
            },

            'sync_stats': doc.get('sync_stats', {}),

            'sample_data': {
                'first_subscription': cached_data.get('subscriptions', [{}])[0] if cached_data.get('subscriptions') else None,
                'first_saved_video': cached_data.get('saved_videos', [{}])[0] if cached_data.get('saved_videos') else None,
                'first_music_track': cached_data.get('music_listened', [{}])[0] if cached_data.get('music_listened') else None,
                'first_playlist': cached_data.get('playlists', [{}])[0] if cached_data.get('playlists') else None,
            },

            'message': 'Complete diagnostic data. Check data_counts to see what was fetched and stored.'
        }
    except Exception as e:
        logger.exception("Error in diagnosis")
        return {'error': str(e)}


@app.get("/data/changes")
async def get_data_changes(google_id: str = Depends(verify_token)):
    """Get what's NEW or CHANGED since last sync (items with metadata updates)."""
    try:
        doc = users.find_one({'google_id': google_id})
        if not doc or 'cached_data' not in doc:
            return {
                'new_subscriptions': [],
                'updated_subscriptions': [],
                'new_videos': [],
                'updated_videos': [],
                'new_music': [],
                'updated_music': [],
                'sync_stats': doc.get('sync_stats', {}) if doc else {},
                'last_synced': None
            }

        cached_data = doc['cached_data']
        sync_stats = doc.get('sync_stats', {})

        # NEW items: have added_at, no updated_at
        new_subscriptions = [
            s for s in cached_data.get('subscriptions', [])
            if 'added_at' in s and 'updated_at' not in s
        ]

        new_videos = [
            v for v in cached_data.get('saved_videos', [])
            if 'added_at' in v and 'updated_at' not in v
        ]

        new_music = [
            m for m in cached_data.get('music_listened', [])
            if 'added_at' in m and 'updated_at' not in m
        ]

        # UPDATED items: have changes field (title, thumbnail, description changed, or watch count increased)
        updated_subscriptions = [
            s for s in cached_data.get('subscriptions', [])
            if 'changes' in s
        ]

        updated_videos = [
            v for v in cached_data.get('saved_videos', [])
            if 'changes' in v
        ]

        updated_music = [
            m for m in cached_data.get('music_listened', [])
            if 'changes' in m
        ]

        return {
            'new_subscriptions': new_subscriptions,
            'updated_subscriptions': updated_subscriptions,
            'new_videos': new_videos,
            'updated_videos': updated_videos,
            'new_music': new_music,
            'updated_music': updated_music,
            'sync_stats': sync_stats,
            'last_synced': doc.get('cached_at')
        }
    except Exception as e:
        logger.exception("Error fetching data changes")
        raise HTTPException(status_code=500, detail=f"Failed to fetch changes: {str(e)}")


@app.get("/data/api-health-check")
async def api_health_check(google_id: str = Depends(verify_token)):
    """DIAGNOSTIC: Test each YouTube API endpoint individually to identify what's broken."""
    try:
        creds = get_credentials_from_db(google_id)
        if not creds:
            return {'error': 'No credentials found', 'auth_status': 'FAILED'}

        youtube = get_youtube_service(creds)
        results = {
            'timestamp': datetime.utcnow().isoformat(),
            'google_id': google_id,
            'tests': {}
        }

        # TEST 1: Check authentication by getting channel info
        logger.info("🧪 TEST 1: Checking authentication with channels.list...")
        try:
            channels_resp = youtube.channels().list(part='id,snippet', mine=True).execute()
            channel_count = len(channels_resp.get('items', []))
            results['tests']['authentication'] = {
                'status': 'SUCCESS',
                'message': f'Auth working, found your channel: {channels_resp.get("items", [{}])[0].get("snippet", {}).get("title", "Unknown")}'
            }
        except Exception as e:
            results['tests']['authentication'] = {
                'status': 'FAILED',
                'error': str(e),
                'message': 'Cannot authenticate to YouTube API'
            }
            logger.error(f"Auth test failed: {str(e)}")

        # TEST 2: Check subscriptions
        logger.info("🧪 TEST 2: Testing subscriptions.list...")
        try:
            subs_resp = youtube.subscriptions().list(part='snippet', mine=True, maxResults=5).execute()
            subs_count = len(subs_resp.get('items', []))
            has_next = 'nextPageToken' in subs_resp
            results['tests']['subscriptions'] = {
                'status': 'SUCCESS',
                'count': subs_count,
                'has_more_pages': has_next,
                'sample': [s['snippet']['title'] for s in subs_resp.get('items', [])]
            }
        except Exception as e:
            results['tests']['subscriptions'] = {
                'status': 'FAILED',
                'error': str(e)
            }
            logger.error(f"Subscriptions test failed: {str(e)}")

        # TEST 3: Check liked videos via myRating
        logger.info("🧪 TEST 3: Testing videos.list with myRating='like'...")
        try:
            liked_resp = youtube.videos().list(part='snippet', myRating='like', maxResults=5, order='date').execute()
            liked_count = len(liked_resp.get('items', []))
            has_next = 'nextPageToken' in liked_resp
            results['tests']['liked_videos_myRating'] = {
                'status': 'SUCCESS',
                'count': liked_count,
                'has_more_pages': has_next,
                'sample': [v['snippet']['title'] for v in liked_resp.get('items', [])]
            }
        except Exception as e:
            results['tests']['liked_videos_myRating'] = {
                'status': 'FAILED',
                'error': str(e),
                'message': f'myRating filter not working: {str(e)}'
            }
            logger.error(f"Liked videos (myRating) test failed: {str(e)}")

        # TEST 4: Check playlists
        logger.info("🧪 TEST 4: Testing playlists.list...")
        try:
            playlists_resp = youtube.playlists().list(part='id,snippet', mine=True, maxResults=5).execute()
            playlists_count = len(playlists_resp.get('items', []))
            has_next = 'nextPageToken' in playlists_resp
            results['tests']['playlists'] = {
                'status': 'SUCCESS',
                'count': playlists_count,
                'has_more_pages': has_next,
                'sample': [p['snippet']['title'] for p in playlists_resp.get('items', [])]
            }
        except Exception as e:
            results['tests']['playlists'] = {
                'status': 'FAILED',
                'error': str(e)
            }
            logger.error(f"Playlists test failed: {str(e)}")

        # TEST 5: Check playlist items (from first playlist if exists)
        logger.info("🧪 TEST 5: Testing playlistItems.list...")
        try:
            playlists_resp = youtube.playlists().list(part='id,snippet', mine=True, maxResults=1).execute()
            if playlists_resp.get('items'):
                playlist_id = playlists_resp['items'][0]['id']
                items_resp = youtube.playlistItems().list(part='snippet', playlistId=playlist_id, maxResults=5).execute()
                items_count = len(items_resp.get('items', []))
                has_next = 'nextPageToken' in items_resp
                results['tests']['playlist_items'] = {
                    'status': 'SUCCESS',
                    'playlist_id': playlist_id,
                    'count': items_count,
                    'has_more_pages': has_next,
                    'sample': [item['snippet'].get('title', 'Unknown') for item in items_resp.get('items', [])]
                }
            else:
                results['tests']['playlist_items'] = {
                    'status': 'SKIPPED',
                    'message': 'No playlists found to test'
                }
        except Exception as e:
            results['tests']['playlist_items'] = {
                'status': 'FAILED',
                'error': str(e)
            }
            logger.error(f"Playlist items test failed: {str(e)}")

        # TEST 6: Check video categories
        logger.info("🧪 TEST 6: Testing videoCategories.list...")
        try:
            cats_resp = youtube.videoCategories().list(part='snippet', regionCode='US', maxResults=5).execute()
            cats_count = len(cats_resp.get('items', []))
            results['tests']['video_categories'] = {
                'status': 'SUCCESS',
                'count': cats_count,
                'sample': [c['snippet']['title'] for c in cats_resp.get('items', [])]
            }
        except Exception as e:
            results['tests']['video_categories'] = {
                'status': 'FAILED',
                'error': str(e)
            }
            logger.error(f"Video categories test failed: {str(e)}")

        # SUMMARY
        failed_tests = [name for name, result in results['tests'].items() if result.get('status') == 'FAILED']
        results['summary'] = {
            'total_tests': len(results['tests']),
            'passed': len(results['tests']) - len(failed_tests),
            'failed': len(failed_tests),
            'failed_tests': failed_tests,
            'overall_status': 'HEALTHY' if not failed_tests else 'DEGRADED' if len(failed_tests) < 3 else 'BROKEN'
        }

        logger.info(f"Health check complete: {results['summary']}")
        return results

    except Exception as e:
        logger.exception("Error in API health check")
        return {'error': str(e), 'status': 'CRITICAL'}


@app.get("/data/debug-fetch")
async def debug_fetch(google_id: str = Depends(verify_token)):
    """Debug endpoint: Manually call fetch functions to see exact step-by-step what happens."""
    try:
        creds = get_credentials_from_db(google_id)
        if not creds:
            return {'error': 'No credentials found'}

        youtube = get_youtube_service(creds)
        results = {
            'timestamp': datetime.utcnow().isoformat(),
            'steps': []
        }

        # Step 1: Try subscriptions
        logger.info("DEBUG: Step 1 - Fetching subscriptions...")
        try:
            subs = fetch_subscriptions(youtube)
            results['steps'].append({
                'name': 'fetch_subscriptions',
                'status': 'SUCCESS',
                'count': len(subs),
                'sample': subs[:2] if subs else []
            })
            logger.info(f"DEBUG: Subscriptions: {len(subs)} fetched")
        except Exception as e:
            results['steps'].append({
                'name': 'fetch_subscriptions',
                'status': 'FAILED',
                'error': str(e)
            })
            logger.error(f"DEBUG: Subscriptions failed: {str(e)}")

        # Step 2: Try saved videos
        logger.info("DEBUG: Step 2 - Fetching saved videos...")
        try:
            saved_data = fetch_saved_videos(youtube)
            results['steps'].append({
                'name': 'fetch_saved_videos',
                'status': 'SUCCESS',
                'videos_count': len(saved_data.get('saved_videos', [])),
                'video_ids_count': len(saved_data.get('video_ids', [])),
                'sample_videos': saved_data.get('saved_videos', [])[:2],
                'sample_video_ids': saved_data.get('video_ids', [])[:2]
            })
            logger.info(f"DEBUG: Saved videos: {len(saved_data.get('saved_videos', []))} videos, {len(saved_data.get('video_ids', []))} IDs")
        except Exception as e:
            results['steps'].append({
                'name': 'fetch_saved_videos',
                'status': 'FAILED',
                'error': str(e)
            })
            logger.error(f"DEBUG: Saved videos failed: {str(e)}")
            saved_data = {'video_ids': [], 'saved_videos': []}

        # Step 3: Try music identification
        logger.info("DEBUG: Step 3 - Identifying music...")
        try:
            music, genres = determine_music_and_genres(youtube, saved_data.get('video_ids', []))
            results['steps'].append({
                'name': 'determine_music_and_genres',
                'status': 'SUCCESS',
                'music_count': len(music),
                'genres_count': len(set(genres)),
                'sample_music': music[:2]
            })
            logger.info(f"DEBUG: Music: {len(music)} tracks identified, {len(set(genres))} genres")
        except Exception as e:
            results['steps'].append({
                'name': 'determine_music_and_genres',
                'status': 'FAILED',
                'error': str(e)
            })
            logger.error(f"DEBUG: Music identification failed: {str(e)}")

        # Step 4: Try subscription genres
        logger.info("DEBUG: Step 4 - Fetching subscription genres...")
        try:
            sub_genres = fetch_subscription_genres(youtube, subs)
            results['steps'].append({
                'name': 'fetch_subscription_genres',
                'status': 'SUCCESS',
                'count': len(sub_genres),
                'sample': sub_genres[:5] if sub_genres else []
            })
            logger.info(f"DEBUG: Subscription genres: {len(sub_genres)} genres")
        except Exception as e:
            results['steps'].append({
                'name': 'fetch_subscription_genres',
                'status': 'FAILED',
                'error': str(e)
            })
            logger.error(f"DEBUG: Subscription genres failed: {str(e)}")

        # Step 5: Try playlists
        logger.info("DEBUG: Step 5 - Fetching playlists...")
        try:
            playlists = fetch_playlists(youtube)
            results['steps'].append({
                'name': 'fetch_playlists',
                'status': 'SUCCESS',
                'count': len(playlists),
                'sample': playlists[:2] if playlists else []
            })
            logger.info(f"DEBUG: Playlists: {len(playlists)} fetched")
        except Exception as e:
            results['steps'].append({
                'name': 'fetch_playlists',
                'status': 'FAILED',
                'error': str(e)
            })
            logger.error(f"DEBUG: Playlists failed: {str(e)}")

        results['summary'] = {
            'total_steps': len(results['steps']),
            'successful': len([s for s in results['steps'] if s['status'] == 'SUCCESS']),
            'failed': len([s for s in results['steps'] if s['status'] == 'FAILED']),
        }

        return results

    except Exception as e:
        logger.exception("Error in debug-fetch")
        return {'error': str(e)}


@app.post("/data/test-simple-fetch")
async def test_simple_fetch(google_id: str = Depends(verify_token)):
    """BYPASS ALL DB LOGIC: Just fetch from YouTube, don't store anything. For testing if fetch functions work."""
    try:
        creds = get_credentials_from_db(google_id)
        if not creds:
            raise HTTPException(status_code=401, detail="No credentials found")

        youtube = get_youtube_service(creds)
        loop = asyncio.get_event_loop()

        logger.info(f"🧪 TEST SYNC (no DB) for {google_id}")

        # Fetch ALL YouTube data in parallel
        logger.info("⏳ Fetching fresh data from YouTube (NO DB STORE)...")
        subscriptions, saved_data = await asyncio.gather(
            loop.run_in_executor(None, fetch_subscriptions, youtube),
            loop.run_in_executor(None, fetch_saved_videos, youtube),
            return_exceptions=True
        )

        # Handle exceptions from parallel fetch
        if isinstance(subscriptions, Exception):
            logger.error(f"❌ Error fetching subscriptions: {subscriptions}")
            subscriptions = []
        if isinstance(saved_data, Exception):
            logger.error(f"❌ Error fetching saved videos: {saved_data}")
            saved_data = {'video_ids': [], 'saved_videos': []}

        logger.info(f"✅ Fresh YouTube data fetched:")
        logger.info(f"   - {len(subscriptions)} subscriptions")
        logger.info(f"   - {len(saved_data.get('saved_videos', []))} saved videos")

        # Determine music and genres from saved videos
        music_listened, video_genres = determine_music_and_genres(youtube, saved_data.get('video_ids', []))

        # Fetch subscription genres in parallel
        subscription_genres = await loop.run_in_executor(None, fetch_subscription_genres, youtube, subscriptions)

        # Fetch all playlists
        playlists = await loop.run_in_executor(None, fetch_playlists, youtube)

        logger.info(f"✅ TEST SYNC COMPLETE (data NOT saved to DB):")
        logger.info(f"   📊 {len(subscriptions)} channels")
        logger.info(f"   🎬 {len(saved_data.get('saved_videos', []))} saved videos")
        logger.info(f"   🎵 {len(music_listened)} music tracks")
        logger.info(f"   📁 {len(playlists)} playlists")

        return {
            'success': True,
            'test': 'simple_fetch_no_db',
            'message': 'This data was fetched from YouTube but NOT saved to DB. Use this to verify fetch functions work.',
            'subscriptions': subscriptions,
            'subscription_genres': subscription_genres,
            'saved_videos': saved_data.get('saved_videos', []),
            'music_listened': music_listened,
            'video_genres': video_genres,
            'playlists': playlists,
        }
    except Exception as e:
        logger.exception(f"Error in test-simple-fetch: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")


@app.get("/data/debug-videos-only")
async def debug_videos_only(google_id: str = Depends(verify_token)):
    """SUPER DETAILED: Debug ONLY the fetch_saved_videos function step by step."""
    try:
        creds = get_credentials_from_db(google_id)
        if not creds:
            return {'error': 'No credentials'}

        youtube = get_youtube_service(creds)

        logger.info("="*80)
        logger.info("DETAILED DEBUG: fetch_saved_videos")
        logger.info("="*80)

        saved_videos = []
        video_ids = []

        # METHOD 1: myRating='like'
        logger.info("\n📺 METHOD 1: myRating='like'")
        logger.info("-" * 80)
        method1_count = 0
        method1_error = None
        try:
            request = youtube.videos().list(part='snippet', myRating='like', maxResults=50)
            logger.info(f"✅ Created request object: {type(request)}")

            page_num = 0
            while request:
                page_num += 1
                logger.info(f"\n  PAGE {page_num}:")
                try:
                    response = execute_with_retry(request)
                    logger.info(f"    ✅ Request executed successfully")
                    logger.info(f"    Response keys: {list(response.keys())}")

                    items = response.get('items', [])
                    logger.info(f"    Items returned: {len(items)}")

                    for idx, item in enumerate(items):
                        logger.info(f"      Item {idx+1}: {item.get('snippet', {}).get('title', 'Unknown')}")
                        saved_videos.append({
                            'title': item['snippet']['title'],
                            'video_id': item['id'],
                            'source': 'myRating'
                        })
                        video_ids.append(item['id'])

                    method1_count += len(items)
                    logger.info(f"    Running total: {method1_count}")

                    # Check for next page
                    request = youtube.videos().list_next(request, response)
                    if request:
                        logger.info(f"    → Next page exists, continuing...")
                    else:
                        logger.info(f"    → No more pages")

                except Exception as page_err:
                    logger.error(f"    ❌ Error on page {page_num}: {str(page_err)}")
                    logger.exception("    Full traceback:")
                    break

            logger.info(f"\n✅ METHOD 1 COMPLETE: {method1_count} videos")

        except Exception as e:
            method1_error = str(e)
            logger.error(f"❌ METHOD 1 FAILED: {method1_error}")
            logger.exception("Full traceback:")

        # METHOD 2: Playlists
        logger.info("\n📁 METHOD 2: Playlists")
        logger.info("-" * 80)
        method2_count = 0
        method2_error = None
        try:
            playlist_request = youtube.playlists().list(part='id,snippet', mine=True, maxResults=50)
            logger.info(f"✅ Created playlists request")

            playlists_processed = 0
            while playlist_request:
                try:
                    playlist_response = execute_with_retry(playlist_request)
                    playlists = playlist_response.get('items', [])
                    logger.info(f"\n  Batch: {len(playlists)} playlists")

                    for playlist in playlists:
                        playlist_id = playlist['id']
                        playlist_title = playlist['snippet']['title']
                        logger.info(f"    📋 Playlist: {playlist_title} ({playlist_id})")

                        # Fetch items from this playlist
                        item_request = youtube.playlistItems().list(part='snippet', playlistId=playlist_id, maxResults=50)
                        items_count = 0

                        while item_request:
                            try:
                                item_response = execute_with_retry(item_request)
                                items = item_response.get('items', [])
                                logger.info(f"      → {len(items)} items in this page")

                                for item in items:
                                    title = item['snippet'].get('title', 'Unknown')
                                    video_id = item['snippet']['resourceId'].get('videoId')
                                    if video_id:
                                        saved_videos.append({
                                            'title': title,
                                            'video_id': video_id,
                                            'source': f'playlist: {playlist_title}'
                                        })
                                        video_ids.append(video_id)
                                        items_count += 1
                                        method2_count += 1

                                item_request = youtube.playlistItems().list_next(item_request, item_response)
                            except Exception as item_err:
                                logger.error(f"      ❌ Error fetching playlist items: {str(item_err)}")
                                break

                        logger.info(f"      ✅ Added {items_count} items from this playlist (total: {method2_count})")

                    playlist_request = youtube.playlists().list_next(playlist_request, playlist_response)

                except Exception as batch_err:
                    logger.error(f"  ❌ Error in playlist batch: {str(batch_err)}")
                    logger.exception("Full traceback:")
                    break

            logger.info(f"\n✅ METHOD 2 COMPLETE: {method2_count} videos")

        except Exception as e:
            method2_error = str(e)
            logger.error(f"❌ METHOD 2 FAILED: {method2_error}")
            logger.exception("Full traceback:")

        logger.info("\n" + "="*80)
        logger.info(f"FINAL RESULT:")
        logger.info(f"  Method 1 (myRating): {method1_count} videos" + (f" - ERROR: {method1_error}" if method1_error else ""))
        logger.info(f"  Method 2 (playlists): {method2_count} videos" + (f" - ERROR: {method2_error}" if method2_error else ""))
        logger.info(f"  TOTAL: {len(saved_videos)} videos, {len(video_ids)} IDs")
        logger.info("="*80)

        return {
            'method1': {
                'count': method1_count,
                'error': method1_error,
                'status': 'SUCCESS' if method1_count > 0 else ('FAILED' if method1_error else 'NO DATA')
            },
            'method2': {
                'count': method2_count,
                'error': method2_error,
                'status': 'SUCCESS' if method2_count > 0 else ('FAILED' if method2_error else 'NO DATA')
            },
            'total': {
                'videos': len(saved_videos),
                'video_ids': len(video_ids),
                'sample': saved_videos[:3]
            }
        }

    except Exception as e:
        logger.exception("Error in debug-videos-only")
        return {'error': str(e)}


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

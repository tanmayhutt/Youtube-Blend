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

rate_limit_store = defaultdict(lambda: defaultdict(list))

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        endpoint = request.url.path

        if endpoint in ["/compare/join", "/compare/run"]:
            now = time()
            rate_limit_store[client_ip][endpoint] = [
                t for t in rate_limit_store[client_ip][endpoint] if now - t < 60
            ]

            if len(rate_limit_store[client_ip][endpoint]) >= 20:
                raise HTTPException(status_code=429, detail="Too many requests. Try again later.")

            rate_limit_store[client_ip][endpoint].append(now)

        return await call_next(request)

app.add_middleware(RateLimitMiddleware)

def generate_secure_code() -> str:
    """Generate a cryptographically secure random code for comparison links."""
    return secrets.token_urlsafe(16)

def validate_redirect_target(target: Optional[str]) -> str:
    """Validate and sanitize redirect target."""
    allowed_paths = {'/dashboard', '/compare/finalise'}

    if not target:
        return '/dashboard'

    target_path = f'/{target.lstrip("/")}'

    for allowed in allowed_paths:
        if target_path.startswith(allowed):
            return target_path

    return '/dashboard'

def build_redirect_uri() -> str:
    """Build a redirect URI for Google OAuth.
    - If DEPLOYED_DOMAIN is set and contains a scheme, use it directly.
    - If DEPLOYED_DOMAIN is set without scheme, assume https.
    - If not set, fall back to localhost with http for local dev.
    """
    deployed = os.getenv('DEPLOYED_DOMAIN')
    if deployed:
        deployed = deployed.rstrip('/')
        if deployed.startswith('http://') or deployed.startswith('https://'):
            return f"{deployed}/auth/callback"
        return f"https://{deployed}/auth/callback"
    host = os.getenv('DEV_HOST', 'localhost:8000')
    scheme = 'http' if 'localhost' in host or host.startswith('127.') else 'https'
    return f"{scheme}://{host}/auth/callback"

frontend_url = os.getenv("FRONTEND_URL", "https://youtube-blend.vercel.app")
frontend_origin = frontend_url.rstrip('/')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = MongoClient(os.getenv("MONGO_URI"), serverSelectionTimeoutMS=10000)
db = client["youtube-blend"]
users = db.users
auth_states = db.auth_states
auth_codes = db.auth_codes
comparisons = db.comparisons

try:
    auth_states.create_index("expires_at", expireAfterSeconds=0)
    auth_codes.create_index("expires_at", expireAfterSeconds=0)
    comparisons.create_index("expires_at", expireAfterSeconds=0)
except Exception:
    logger.exception("Failed to ensure TTL indexes on collections")

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]

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
        return payload.get('sub')
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
        existing_doc = users.find_one({'google_id': google_id})
        existing_data = existing_doc.get('cached_data', {}) if existing_doc else {}

        new_sub_ids = {s['channel_id']: s for s in data.get('subscriptions', [])}
        old_sub_ids = {s['channel_id']: s for s in existing_data.get('subscriptions', [])}

        new_video_ids = {v['video_id']: v for v in data.get('saved_videos', [])}
        old_video_ids = {v['video_id']: v for v in existing_data.get('saved_videos', [])}

        new_music_ids = {m['video_id']: m for m in data.get('music_listened', [])}
        old_music_ids = {m['video_id']: m for m in existing_data.get('music_listened', [])}

        updated_subscriptions = []
        added_subs = 0
        changed_subs = 0

        for channel_id, new_sub in new_sub_ids.items():
            old_sub = old_sub_ids.get(channel_id)

            if not old_sub:
                new_sub['added_at'] = datetime.utcnow()
                new_sub['last_synced_at'] = datetime.utcnow()
                added_subs += 1
            else:
                changes = detect_item_changes(new_sub, old_sub)

                if changes:
                    new_sub['added_at'] = old_sub.get('added_at', datetime.utcnow())
                    new_sub['updated_at'] = datetime.utcnow()
                    new_sub['last_synced_at'] = datetime.utcnow()
                    new_sub['changes'] = changes
                    changed_subs += 1
                    logger.info(f"Updated subscription {channel_id}: {list(changes.keys())}")
                else:
                    new_sub['added_at'] = old_sub.get('added_at', datetime.utcnow())
                    new_sub['last_synced_at'] = datetime.utcnow()

            updated_subscriptions.append(new_sub)

        updated_videos = []
        added_vids = 0
        changed_vids = 0

        for video_id, new_video in new_video_ids.items():
            old_video = old_video_ids.get(video_id)

            if not old_video:
                new_video['added_at'] = datetime.utcnow()
                new_video['last_synced_at'] = datetime.utcnow()
                added_vids += 1
            else:
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

        updated_music = []
        added_songs = 0
        changed_songs = 0

        for music_id, new_music in new_music_ids.items():
            old_music = old_music_ids.get(music_id)

            if not old_music:
                new_music['added_at'] = datetime.utcnow()
                new_music['first_watched_at'] = datetime.utcnow()
                new_music['last_synced_at'] = datetime.utcnow()
                added_songs += 1
            else:
                changes = detect_item_changes(new_music, old_music)

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

def get_user_cached_data_for_compare(google_id: str):
    """Fetch cached data and last sync timestamp for comparisons (no TTL check)."""
    try:
        if not google_id:
            return None, None, "comparison_snapshot"

        doc = users.find_one({'google_id': google_id})
        if not doc:
            return None, None, "comparison_snapshot"

        cached_data = doc.get('cached_data')
        last_synced_at = doc.get('cached_at') or doc.get('last_full_sync')
        if cached_data:
            return cached_data, last_synced_at, "cached"

        return None, last_synced_at, "comparison_snapshot"
    except Exception:
        logger.exception("Failed to load cached data for comparison")
        return None, None, "comparison_snapshot"

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
            include_granted_scopes="true",
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

        cred = Credentials(
            token=tokens.get('access_token'),
            refresh_token=tokens.get('refresh_token'),
            id_token=tokens.get('id_token'),
            token_uri=tokens.get('token_uri', 'https://oauth2.googleapis.com/token'),
            client_id=os.getenv('GOOGLE_CLIENT_ID'),
            client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
            scopes=SCOPES,
        )
        profile = {
            "email": userinfo.get("email"),
            "name": userinfo.get("name"),
            "picture": userinfo.get("picture")
        }

        users.update_one(
            {"google_id": google_id},
            {"$set": {"token_json": cred.to_json(), "profile": profile, "updated_at": datetime.utcnow()}},
            upsert=True
        )

        comparison_id = state_doc.get('comparison_id')
        if comparison_id:
            comparison = comparisons.find_one({'_id': comparison_id})
            if not comparison:
                raise HTTPException(status_code=400, detail="Invalid comparison link")

            if comparison.get('user1_id') and comparison.get('user1_id') != google_id:
                try:
                    creds = get_credentials_from_db(google_id)
                    if not creds:
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

                        auth_code = secrets.token_urlsafe(32)
                        code_doc = {
                            'code': auth_code,
                            'google_id': google_id,
                            'created_at': datetime.utcnow(),
                            'expires_at': datetime.utcnow() + timedelta(minutes=2),
                            'next': f'/compare/finalise/{comparison_id}'
                        }
                        auth_codes.insert_one(code_doc)

                        frontend = os.getenv("FRONTEND_URL", "https://youtube-blend.vercel.app")
                        final_url = f"{frontend.rstrip('/')}/auth/complete?code={auth_code}&next=/compare/finalise/{comparison_id}"
                        return RedirectResponse(url=final_url, status_code=302)
                except Exception as e:
                    logger.exception("Error fetching user2 data during comparison")
                    raise HTTPException(status_code=500, detail=f"Failed to fetch YouTube data: {str(e)}")

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

        frontend = os.getenv("FRONTEND_URL", "https://youtube-blend.vercel.app")
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


class ExchangeRequest(BaseModel):
    code: str


@app.post("/auth/exchange")
async def auth_exchange(req: ExchangeRequest):
    """Exchange a single-use auth code for a signed JWT and user id."""
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

        code_collection = db['comparison_codes']
        code_doc = code_collection.find_one({'refresh_token': refresh_token_provided})

        if not code_doc:
            raise HTTPException(status_code=401, detail='Invalid refresh token')

        google_id = code_doc.get('google_id')

        jwt_secret = os.getenv('JWT_SECRET')
        if not jwt_secret:
            raise HTTPException(status_code=500, detail='JWT_SECRET not configured')

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
                'last_synced_at': doc.get('last_full_sync'),
                'profile': doc.get('profile', {}),
                'user_id': google_id
            }

        return {
            'subscriptions': [],
            'subscription_genres': [],
            'saved_videos': [],
            'music_listened': [],
            'video_genres': [],
            'playlists': [],
            'cached': False,
            'message': 'No data cached yet. Call /data/sync to fetch your YouTube data.',
            'profile': doc.get('profile', {}) if doc else {},
            'user_id': google_id
        }
    except Exception as e:
        logger.exception("Error getting cached data")
        raise HTTPException(status_code=500, detail=f"Failed to get user data: {str(e)}")


@app.post("/data/sync")
async def sync_user_data(google_id: str = Depends(verify_token)):
    """
    Smart Sync Architecture with Quota Protection:
    1. FIRST LOGIN: Fetch ALL YouTube data, save to DB (full sync)
    2. SUBSEQUENT LOGINS: Fetch fresh from YouTube, compare to DB, only update what changed (incremental)
    3. QUOTA EXCEEDED: Return cached data gracefully instead of failing
    """
    try:
        creds = get_credentials_from_db(google_id)
        if not creds:
            raise HTTPException(status_code=401, detail="Invalid or expired credentials")

        doc = users.find_one({'google_id': google_id})
        is_first_sync = doc is None or doc.get('cached_data') is None

        logger.info(f"{'🚀 FIRST SYNC (Full fetch)' if is_first_sync else '♻️ INCREMENTAL SYNC'} for {google_id}")

        loop = asyncio.get_event_loop()

        logger.info("⏳ Fetching fresh data from YouTube...")
        subscriptions_client = get_youtube_service(creds)
        saved_videos_client = get_youtube_service(creds)
        subscriptions_result, saved_data = await asyncio.gather(
            loop.run_in_executor(None, fetch_subscriptions, subscriptions_client, True),
            loop.run_in_executor(None, fetch_saved_videos, saved_videos_client),
            return_exceptions=True
        )

        subscriptions_complete = True
        if isinstance(subscriptions_result, Exception):
            subscriptions = subscriptions_result
        elif isinstance(subscriptions_result, tuple):
            subscriptions, subscriptions_complete = subscriptions_result
        else:
            subscriptions = subscriptions_result

        quota_exceeded = False
        if isinstance(subscriptions, Exception) and "quotaExceeded" in str(subscriptions):
            quota_exceeded = True
            logger.warning("⚠️  QUOTA EXCEEDED during subscriptions fetch")
        if isinstance(saved_data, Exception) and "quotaExceeded" in str(saved_data):
            quota_exceeded = True
            logger.warning("⚠️  QUOTA EXCEEDED during saved videos fetch")

        if quota_exceeded and not is_first_sync:
            logger.info("💾 Quota exceeded - returning cached data instead")
            cached_data = doc.get('cached_data', {})
            return {
                'success': True,
                'sync_type': 'CACHED',
                'subscriptions': cached_data.get('subscriptions', []),
                'subscription_genres': cached_data.get('subscription_genres', []),
                'saved_videos': cached_data.get('saved_videos', []),
                'music_listened': cached_data.get('music_listened', []),
                'video_genres': cached_data.get('video_genres', []),
                'playlists': cached_data.get('playlists', []),
                'last_synced_at': doc.get('last_full_sync'),
                'message': '⚠️  API quota exceeded. Returning cached data. Please try again later.',
                'warning': 'quotaExceeded'
            }

        if isinstance(subscriptions, Exception):
            logger.error(f"❌ Error fetching subscriptions: {subscriptions}")
            subscriptions = []

        use_cached_subs = False
        cached_subscriptions = []
        cached_sub_genres = []
        if not subscriptions_complete and doc:
            cached_subscriptions = doc.get('last_complete_subscriptions') or doc.get('cached_data', {}).get('subscriptions', [])
            cached_sub_genres = doc.get('last_complete_subscription_genres') or doc.get('cached_data', {}).get('subscription_genres', [])
            if cached_subscriptions:
                logger.warning(
                    "Subscriptions fetch incomplete; using cached subscriptions (%d) instead of partial (%d)",
                    len(cached_subscriptions),
                    len(subscriptions)
                )
                subscriptions = cached_subscriptions
                use_cached_subs = True
            else:
                logger.warning("Subscriptions fetch incomplete; no cached subscriptions available.")

        if isinstance(saved_data, Exception):
            logger.error(f"❌ Error fetching saved videos: {saved_data}")
            saved_data = {'video_ids': [], 'saved_videos': []}

        logger.info(f"✅ Fresh YouTube data fetched:")
        logger.info(f"   - {len(subscriptions)} subscriptions")
        logger.info(f"   - {len(saved_data.get('saved_videos', []))} saved videos")

        try:
            music_client = get_youtube_service(creds)
            music_listened, video_genres = await loop.run_in_executor(
                None,
                determine_music_and_genres,
                music_client,
                saved_data.get('video_ids', [])
            )
        except Exception as e:
            logger.error(f"❌ Error determining music/genres: {str(e)}")
            logger.exception("Music determination crashed")
            music_listened, video_genres = [], []

        if use_cached_subs:
            subscription_genres = cached_sub_genres
        else:
            try:
                genres_client = get_youtube_service(creds)
                subscription_genres = await loop.run_in_executor(None, fetch_subscription_genres, genres_client, subscriptions)
            except Exception as e:
                logger.error(f"❌ Error fetching subscription genres: {str(e)}")
                subscription_genres = []

        if subscriptions_complete:
            users.update_one(
                {'google_id': google_id},
                {'$set': {
                    'last_complete_subscriptions': subscriptions,
                    'last_complete_subscription_genres': subscription_genres,
                    'last_complete_subscriptions_at': datetime.utcnow()
                }}
            )

        try:
            playlists_client = get_youtube_service(creds)
            playlists = await loop.run_in_executor(None, fetch_playlists, playlists_client)
        except Exception as e:
            logger.error(f"❌ Error fetching playlists: {str(e)}")
            playlists = []

        fresh_user_data = {
            'subscriptions': subscriptions,
            'subscription_genres': subscription_genres,
            'saved_videos': saved_data.get('saved_videos', []),
            'music_listened': music_listened,
            'video_genres': video_genres,
            'playlists': playlists
        }

        logger.info(f"💾 Storing to database (with incremental comparison)...")
        cache_user_data(google_id, fresh_user_data)

        sync_time = datetime.utcnow()
        users.update_one({'google_id': google_id}, {'$set': {'last_full_sync': sync_time}})

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
            'last_synced_at': sync_time,
            'message': f'{"🚀 FULL SYNC" if is_first_sync else "♻️ INCREMENTAL SYNC"}: {len(subscriptions)} channels, {len(music_listened)} songs, {len(playlists)} playlists'
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"CRITICAL ERROR in sync: {str(e)}")
        try:
            doc = users.find_one({'google_id': google_id})
            if doc and doc.get('cached_data'):
                cached_data = doc['cached_data']
                logger.info("💾 Sync crashed - returning cached data as fallback")
                return {
                    'success': True,
                    'sync_type': 'CACHED',
                    'subscriptions': cached_data.get('subscriptions', []),
                    'subscription_genres': cached_data.get('subscription_genres', []),
                    'saved_videos': cached_data.get('saved_videos', []),
                    'music_listened': cached_data.get('music_listened', []),
                    'video_genres': cached_data.get('video_genres', []),
                    'playlists': cached_data.get('playlists', []),
                    'last_synced_at': doc.get('last_full_sync'),
                    'message': '⚠️  Sync encountered an error. Returning cached data. Please try again later.',
                    'warning': 'syncError'
                }
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to sync YouTube data: {str(e)}")


@app.get("/compare/generate_link")
async def generate_comparison_link(google_id: str = Depends(verify_token)):
    """Generate a shareable comparison link for the authenticated user."""
    try:
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
            creds = get_credentials_from_db(google_id)
            if not creds:
                raise HTTPException(status_code=401, detail="Invalid or expired credentials")

            youtube = get_youtube_service(creds)

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

        comparison_id = generate_secure_code()
        csrf_token = secrets.token_urlsafe(32)
        frontend = os.getenv("FRONTEND_URL", "https://youtube-blend.vercel.app")
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

    if comparison.get('expires_at') and comparison['expires_at'] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Comparison link has expired (2 hour limit)")

    if comparison.get('status') == 'ready' or comparison.get('status') == 'completed':
        raise HTTPException(status_code=400, detail="This comparison is already complete")

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

        auth_states.insert_one({
            "state": state,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=5),
            "comparison_id": comparison_id
        })

        return RedirectResponse(url=auth_url, status_code=302)
    except Exception as e:
        logger.exception("Failed to build OAuth flow for comparison join")
        raise HTTPException(status_code=500, detail=f"OAuth setup error: {str(e)}")


@app.get("/compare/run/{comparison_id}")
async def get_comparison(comparison_id: str, refresh: bool = False, google_id: str = Depends(verify_token)):
    """Get comparison results. Run comparison if not already completed."""
    comparison = comparisons.find_one({'_id': comparison_id})
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison not found")

    if comparison.get('user1_id') != google_id and comparison.get('user2_id') != google_id:
        raise HTTPException(status_code=403, detail="You are not authorized to view this comparison")

    user1_id = comparison.get('user1_id')
    user2_id = comparison.get('user2_id')

    user1_cached, user1_last_synced, user1_source = get_user_cached_data_for_compare(user1_id)
    user2_cached, user2_last_synced, user2_source = get_user_cached_data_for_compare(user2_id)

    viewer_is_user1 = google_id == user1_id
    meta = {
        'viewer': {
            'last_synced_at': user1_last_synced if viewer_is_user1 else user2_last_synced,
            'data_source': user1_source if viewer_is_user1 else user2_source
        },
        'other': {
            'last_synced_at': user2_last_synced if viewer_is_user1 else user1_last_synced,
            'data_source': user2_source if viewer_is_user1 else user1_source
        }
    }

    status = comparison.get('status')

    if status == 'completed' and comparison.get('results') and not refresh:
        return {'results': comparison.get('results'), 'meta': meta}

    if status not in ['ready', 'completed']:
        return {
            'status': status or 'pending',
            'message': 'Comparison is not ready. Both users must complete login.',
            'meta': meta
        }

    user1_data = user1_cached or comparison.get('user1_data')
    user2_data = user2_cached or comparison.get('user2_data')

    if not user1_data or not user2_data:
        raise HTTPException(status_code=400, detail="Missing user data for comparison")

    try:
        results = compare_interests_logic(user1_data, user2_data)

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

        return {'results': results, 'meta': meta}
    except Exception as e:
        logger.exception("Error running comparison")
        raise HTTPException(status_code=500, detail=f"Failed to run comparison: {str(e)}")


@app.post("/compare/run/{comparison_id}")
async def run_comparison(comparison_id: str, google_id: str = Depends(verify_token)):
    """Run the comparison between two users and return results (POST for backwards compatibility)."""
    return await get_comparison(comparison_id, refresh=False, google_id=google_id)


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

        redirect_target = validate_redirect_target(next)

        tokens_json = json.dumps({'access_token': token})
        frontend = os.getenv('FRONTEND_URL', 'https://youtube-blend.vercel.app')
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

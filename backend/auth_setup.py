# auth_setup.py - FINAL WORKING (Google accepts "true" as string)

from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
import json
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

SCOPES = [
    'https://www.googleapis.com/auth/youtube',  # Full access needed for liked videos
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
]

mongo_uri = os.getenv('MONGO_URI')
if not mongo_uri:
    logger.error("MONGO_URI not set.")
    raise Exception("MONGO_URI environment variable not configured.")

client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
db = client['youtube-blend']
users_collection = db['users']
comparisons_collection = db['comparisons']
auth_state_collection = db['auth_states']


def get_google_auth_flow(redirect_uri: str) -> Flow:
    config = {
        "web": {
            "client_id": os.getenv('GOOGLE_CLIENT_ID'),
            "client_secret": os.getenv('GOOGLE_CLIENT_SECRET'),
            "redirect_uris": [redirect_uri],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
        }
    }
    flow = Flow.from_client_config(config, SCOPES)
    flow.redirect_uri = redirect_uri  # Force it
    return flow


def generate_auth_url_and_state(redirect_uri: str, comparison_id: Optional[str] = None) -> Tuple[str, str]:
    flow = get_google_auth_flow(redirect_uri)

    auth_url, state = flow.authorization_url(
        prompt='consent',
        access_type='offline',
        include_granted_scopes="true"   # STRING "true" — GOOGLE ACCEPTS THIS
    )

    auth_state_collection.insert_one({
        'state': state,
        'redirect_uri': redirect_uri,
        'comparison_id': comparison_id,
        'created_at': datetime.utcnow(),
        'expires_at': datetime.utcnow() + timedelta(minutes=5)
    })
    auth_state_collection.create_index("expires_at", expireAfterSeconds=0)

    return auth_url, state


def get_credentials_from_db(google_id: str) -> Optional[Credentials]:
    doc = users_collection.find_one({'google_id': google_id})
    if not doc:
        return None

    # Backwards-compat: some records may use `credentials` while newer ones use `token_json`
    token_raw = doc.get('token_json') or doc.get('credentials') or doc.get('credentials_json')
    if not token_raw:
        return None

    try:
        # token_raw may be a JSON string or already a dict
        token_data = json.loads(token_raw) if isinstance(token_raw, str) else token_raw

        # Create Credentials defensively using available fields; prefer stored values,
        # fall back to environment variables for client id/secret.
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
            users_collection.update_one(
                {'google_id': google_id},
                {'$set': {'token_json': creds.to_json(), 'updated_at': datetime.utcnow()}}
            )
        return creds if creds.valid else None
    except Exception as e:
        logger.error(f"Token error for {google_id}: {e}")
        users_collection.delete_one({'google_id': google_id})
        return None

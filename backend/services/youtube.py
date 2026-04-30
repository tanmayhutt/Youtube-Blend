# services/youtube.py - YouTube API functions for data fetching
# Lovable AI: Frontend calls /data/me, which triggers these - display subscriptions, videos in UI.

from googleapiclient.discovery import build
import json
from google.oauth2.credentials import Credentials
from typing import List, Dict, Tuple
import logging
import time
import ssl

logger = logging.getLogger(__name__)

def execute_with_retry(request, max_retries=3, backoff_factor=1):
    """Execute a request with retry logic for SSL and transient errors."""
    for attempt in range(max_retries):
        try:
            return request.execute()
        except (ssl.SSLError, ConnectionError, TimeoutError) as e:
            if attempt < max_retries - 1:
                wait_time = backoff_factor * (2 ** attempt)
                logger.warning(f"  Transient error (attempt {attempt + 1}/{max_retries}): {str(e)}")
                logger.warning(f"  Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                logger.error(f"  Failed after {max_retries} attempts: {str(e)}")
                raise
        except Exception as e:
            # Don't retry on other errors
            raise

def sanitize_string(s: str) -> str:
    if not isinstance(s, str):
        return str(s)
    return json.dumps(s)[1:-1]

def get_youtube_service(creds: Credentials):
    """Creates a YouTube API client from credentials."""
    return build('youtube', 'v3', credentials=creds)

def fetch_subscriptions(youtube):
    """Fetches user's subscriptions."""
    subscriptions = []
    try:
        logger.info("👥 Starting fetch_subscriptions...")
        request = youtube.subscriptions().list(part='snippet', mine=True, maxResults=50)
        batch_num = 0
        while request:
            batch_num += 1
            response = execute_with_retry(request)
            batch_size = len(response.get('items', []))
            subscriptions.extend([{
                'title': sanitize_string(sub['snippet']['title']),
                'channel_id': sub['snippet']['resourceId']['channelId'],
                'logo_url': sub['snippet']['thumbnails'].get('medium', {}).get('url', '')
            } for sub in response.get('items', [])])
            logger.info(f"  Batch {batch_num}: {batch_size} subscriptions (total: {len(subscriptions)})")
            request = youtube.subscriptions().list_next(request, response)
        logger.info(f"✅ fetch_subscriptions complete: {len(subscriptions)} total")
    except Exception as e:
        logger.error(f"❌ Error fetching subscriptions: {str(e)}")
        logger.exception("Full traceback for subscriptions:")
    return subscriptions

def fetch_subscription_genres(youtube, subscriptions_or_channel_ids):
    """Fetches genres/topics for subscriptions. Accepts either list of subscription dicts or channel ID strings."""
    genres = []
    try:
        # Extract channel IDs if we received subscription objects
        if subscriptions_or_channel_ids and isinstance(subscriptions_or_channel_ids[0], dict):
            channel_ids = [sub.get('channel_id') for sub in subscriptions_or_channel_ids if sub.get('channel_id')]
        else:
            channel_ids = subscriptions_or_channel_ids

        logger.info(f"  Fetching genres for {len(channel_ids)} channels (batch size: 50)")

        for i in range(0, len(channel_ids), 50):
            batch_ids = channel_ids[i:i+50]
            channel_request = youtube.channels().list(part='topicDetails', id=','.join(batch_ids))
            channel_response = execute_with_retry(channel_request)
            for channel in channel_response.get('items', []):
                topics = channel.get('topicDetails', {}).get('topicCategories', [])
                genres.extend([sanitize_string(topic.split('/')[-1]) for topic in topics])
            logger.info(f"  Batch {i//50 + 1}: Added {len([sanitize_string(topic.split('/')[-1]) for topic in genres])} genres")
    except Exception as e:
        logger.error(f"Error fetching subscription genres: {str(e)}")
        logger.exception("Full traceback for subscription genres:")
    return list(set(genres))

def fetch_saved_videos(youtube):
    """Fetches liked videos and saved videos from playlists."""
    saved_videos = []
    video_ids = []
    try:
        logger.info("🎬 Starting fetch_saved_videos...")

        # Try Method 1: Liked videos via myRating
        logger.info("📺 Method 1: Fetching liked videos (myRating='like')...")
        try:
            # Note: 'order' parameter is NOT valid for myRating filter, only for search
            request = youtube.videos().list(part='snippet', myRating='like', maxResults=50)
            logger.info(f"  Request created: {request}")
            liked_count = 0
            page_num = 0
            while request:
                page_num += 1
                logger.info(f"  Executing page {page_num}...")
                response = execute_with_retry(request)
                batch_size = len(response.get('items', []))
                liked_count += batch_size
                logger.info(f"  ✅ Page {page_num}: {batch_size} items (total: {liked_count})")
                logger.info(f"  Response keys: {list(response.keys())}")
                if batch_size == 0:
                    logger.info(f"  ⚠️ Empty page! No more items.")

                for sub in response.get('items', []):
                    title = sanitize_string(sub['snippet']['title'])
                    if title not in [v['title'] for v in saved_videos]:
                        saved_videos.append({
                            'title': title,
                            'video_id': sub['id'],
                            'thumbnail_url': sub['snippet']['thumbnails'].get('medium', {}).get('url', '')
                        })
                        video_ids.append(sub['id'])

                request = youtube.videos().list_next(request, response)
                if request:
                    logger.info(f"  ⏳ Next page token found, continuing...")
                else:
                    logger.info(f"  ✅ No more pages")

            logger.info(f"✅ Method 1 Complete: {len(saved_videos)} videos total, {len(video_ids)} IDs")
        except Exception as e:
            logger.error(f"❌ Method 1 FAILED: {str(e)}")
            logger.exception("Full traceback for method 1:")


        # Method 2: Fetch from "Liked Videos" playlist if it exists
        logger.info("📁 Method 2: Fetching from playlists (including 'Liked Videos' playlist)...")
        try:
            playlist_request = youtube.playlists().list(part='id,snippet', mine=True, maxResults=50)
            playlists_found = 0
            while playlist_request:
                playlist_response = execute_with_retry(playlist_request)
                playlists_found += len(playlist_response.get('items', []))
                logger.info(f"  Found {len(playlist_response.get('items', []))} playlists")

                for playlist in playlist_response.get('items', []):
                    playlist_id = playlist['id']
                    playlist_title = playlist['snippet']['title']
                    logger.info(f"    Processing playlist: {playlist_title}")

                    item_request = youtube.playlistItems().list(part='snippet', playlistId=playlist_id, maxResults=50)
                    items_from_this_playlist = 0

                    while item_request:
                        item_response = execute_with_retry(item_request)
                        batch_size = len(item_response.get('items', []))
                        items_from_this_playlist += batch_size

                        for item in item_response.get('items', []):
                            title = sanitize_string(item['snippet'].get('title', 'Unknown'))
                            video_id = item['snippet']['resourceId'].get('videoId')
                            if title not in [v['title'] for v in saved_videos] and video_id:
                                saved_videos.append({
                                    'title': title,
                                    'video_id': video_id,
                                    'thumbnail_url': item['snippet']['thumbnails'].get('medium', {}).get('url', ''),
                                    'from_playlist': playlist_title
                                })
                                video_ids.append(video_id)

                        item_request = youtube.playlistItems().list_next(item_request, item_response)

                    logger.info(f"      Added {items_from_this_playlist} items from this playlist")

                playlist_request = youtube.playlists().list_next(playlist_request, playlist_response)

            logger.info(f"✅ Method 2 Result: Total {len(saved_videos)} videos, {len(video_ids)} IDs")
        except Exception as e:
            logger.warning(f"⚠️ Method 2 (playlists) failed: {str(e)}")

        logger.info(f"🎬 fetch_saved_videos returning: {len(saved_videos)} videos, {len(video_ids)} IDs")

    except Exception as e:
        logger.error(f"❌ Error in fetch_saved_videos: {str(e)}")
        logger.exception("Full traceback:")

    return {'saved_videos': saved_videos, 'video_ids': video_ids}


def determine_music_and_genres(youtube, video_ids: List[str]) -> Tuple[List[Dict], List[str]]:
    """Identifies music videos and genres from video IDs."""
    music_listened = []
    video_genres = []

    logger.info(f"🎵 Starting music identification for {len(video_ids)} video IDs")

    if not video_ids:
        logger.warning("❌ No video IDs provided for music identification!")
        return [], []

    try:
        for i in range(0, len(video_ids), 50):
            batch_ids = video_ids[i:i+50]
            logger.info(f"Processing batch {i//50 + 1}: {len(batch_ids)} videos")

            # Include statistics to get viewCount for sorting
            request = youtube.videos().list(part='snippet,statistics', id=','.join(batch_ids))
            response = execute_with_retry(request)

            for video in response.get('items', []):
                title = sanitize_string(video['snippet']['title'])
                category_id = video['snippet'].get('categoryId')
                is_music = category_id == '10' or any(keyword in title.lower() for keyword in ['song', 'music', 'album', 'track', 'playlist'])

                if is_music:
                    # Get view count from statistics
                    view_count = int(video.get('statistics', {}).get('viewCount', 0))
                    music_listened.append({
                        'title': title,
                        'video_id': video['id'],
                        'thumbnail_url': video['snippet']['thumbnails'].get('medium', {}).get('url', ''),
                        'view_count': view_count
                    })
                    logger.info(f"  ✅ Found music: {title} (category: {category_id})")

                if category_id:
                    category_request = youtube.videoCategories().list(part='snippet', id=category_id)
                    category_response = execute_with_retry(category_request)
                    genre = category_response['items'][0]['snippet']['title'] if category_response.get('items') else 'Unknown'
                    video_genres.append(sanitize_string(genre))

        logger.info(f"✅ Music identification complete: Found {len(music_listened)} music tracks from {len(video_ids)} videos")
    except Exception as e:
        logger.error(f"❌ Error determining music/genres: {str(e)}")
        logger.exception("Full traceback for music identification:")

    logger.info(f"🎵 determine_music_and_genres returning: {len(music_listened)} music, {len(set(video_genres))} genres")
def fetch_playlists(youtube):
    """Fetches user's playlists."""
    playlists = []
    try:
        request = youtube.playlists().list(part='snippet,id', mine=True, maxResults=50)
        while request:
            response = execute_with_retry(request)
            for playlist in response.get('items', []):
                playlists.append({
                    'title': sanitize_string(playlist['snippet']['title']),
                    'playlist_id': playlist['id'],
                    'thumbnail_url': playlist['snippet']['thumbnails'].get('medium', {}).get('url', '')
                })
            request = youtube.playlists().list_next(request, response)
    except Exception as e:
        logger.error(f"Error fetching playlists: {str(e)}")
    return playlists

def count_music_watch_times(youtube) -> Dict[str, int]:
    """Counts how many times each video appears in watch history AND identifies music.
    Returns dict with video_id -> watch_count mapping, with music metadata."""
    video_watch_counts = {}
    music_data = {}  # Store full music metadata
    try:
        # Find watch history playlist (usually titled "Watch History")
        playlist_request = youtube.playlists().list(part='snippet,id', mine=True, maxResults=50)
        watch_history_id = None

        while playlist_request and not watch_history_id:
            playlist_response = playlist_request.execute()
            for playlist in playlist_response.get('items', []):
                if 'history' in playlist['snippet']['title'].lower() or playlist['snippet']['title'] == 'Watch History':
                    watch_history_id = playlist['id']
                    break
            playlist_request = youtube.playlists().list_next(playlist_request, playlist_response)

        # If watch history playlist found, count video appearances in it
        if watch_history_id:
            item_request = youtube.playlistItems().list(part='snippet', playlistId=watch_history_id, maxResults=50)

            while item_request:
                item_response = item_request.execute()
                for item in item_response.get('items', []):
                    video_id = item['snippet']['resourceId'].get('videoId')
                    if video_id:
                        # Each appearance in watch history = 1 listen
                        video_watch_counts[video_id] = video_watch_counts.get(video_id, 0) + 1

                item_request = youtube.playlistItems().list_next(item_request, item_response)

            # Now fetch video details for all watched videos to identify music
            if video_watch_counts:
                for i in range(0, len(video_watch_counts), 50):
                    batch_ids = list(video_watch_counts.keys())[i:i+50]
                    try:
                        video_request = youtube.videos().list(part='snippet,statistics', id=','.join(batch_ids))
                        video_response = video_request.execute()
                        for video in video_response.get('items', []):
                            video_id = video['id']
                            title = sanitize_string(video['snippet']['title'])
                            category_id = video['snippet'].get('categoryId')
                            is_music = category_id == '10' or any(keyword in title.lower() for keyword in ['song', 'music', 'album', 'track', 'playlist'])

                            if is_music:
                                music_data[video_id] = {
                                    'title': title,
                                    'video_id': video_id,
                                    'thumbnail_url': video['snippet']['thumbnails'].get('medium', {}).get('url', ''),
                                    'watch_count': video_watch_counts[video_id]
                                }
                    except Exception as e:
                        logger.error(f"Error fetching video details for music identification: {e}")
        else:
            # Fallback: count from playlists if watch history not accessible
            playlist_request = youtube.playlists().list(part='id', mine=True, maxResults=50)
            while playlist_request:
                playlist_response = playlist_request.execute()
                for playlist in playlist_response.get('items', []):
                    playlist_id = playlist['id']
                    item_request = youtube.playlistItems().list(part='snippet', playlistId=playlist_id, maxResults=50)
                    while item_request:
                        item_response = item_request.execute()
                        for item in item_response.get('items', []):
                            video_id = item['snippet']['resourceId'].get('videoId')
                            if video_id:
                                # Each playlist appearance counts as 1
                                video_watch_counts[video_id] = video_watch_counts.get(video_id, 0) + 1
                        item_request = youtube.playlistItems().list_next(item_request, item_response)
                playlist_request = youtube.playlists().list_next(playlist_request, playlist_response)
    except Exception as e:
        logger.error(f"Error counting music watch times: {str(e)}")

    return video_watch_counts, music_data

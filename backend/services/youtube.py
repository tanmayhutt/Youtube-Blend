# services/youtube.py - YouTube API functions for data fetching
# Lovable AI: Frontend calls /data/me, which triggers these - display subscriptions, videos in UI.

from googleapiclient.discovery import build
import json
from google.oauth2.credentials import Credentials
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

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
        request = youtube.subscriptions().list(part='snippet', mine=True, maxResults=50)
        while request:
            response = request.execute()
            for sub in response.get('items', []):
                subscriptions.append({
                    'title': sanitize_string(sub['snippet']['title']),
                    'channel_id': sub['snippet']['resourceId']['channelId'],
                    'logo_url': sub['snippet']['thumbnails'].get('medium', {}).get('url', '')
                })
            request = youtube.subscriptions().list_next(request, response)
    except Exception as e:
        logger.error(f"Error fetching subscriptions: {str(e)}")
    return subscriptions

def fetch_subscription_genres(youtube, channel_ids: List[str]):
    """Fetches genres/topics for subscriptions."""
    genres = []
    try:
        for i in range(0, len(channel_ids), 50):
            batch_ids = channel_ids[i:i+50]
            channel_request = youtube.channels().list(part='topicDetails', id=','.join(batch_ids))
            channel_response = channel_request.execute()
            for channel in channel_response.get('items', []):
                topics = channel.get('topicDetails', {}).get('topicCategories', [])
                genres.extend([sanitize_string(topic.split('/')[-1]) for topic in topics])
    except Exception as e:
        logger.error(f"Error fetching subscription genres: {str(e)}")
    return list(set(genres))

def fetch_saved_videos(youtube):
    """Fetches liked videos and playlist items."""
    saved_videos = []
    video_ids = []
    try:
        # Liked videos
        request = youtube.videos().list(part='snippet', myRating='like', maxResults=50)
        while request:
            response = request.execute()
            for video in response.get('items', []):
                title = sanitize_string(video['snippet']['title'])
                if title not in [v['title'] for v in saved_videos]:
                    saved_videos.append({
                        'title': title,
                        'video_id': video['id'],
                        'thumbnail_url': video['snippet']['thumbnails'].get('medium', {}).get('url', '')
                    })
                    video_ids.append(video['id'])
            request = youtube.videos().list_next(request, response)
        # Playlist items
        playlist_request = youtube.playlists().list(part='id', mine=True, maxResults=50)
        while playlist_request:
            playlist_response = playlist_request.execute()
            for playlist in playlist_response.get('items', []):
                playlist_id = playlist['id']
                item_request = youtube.playlistItems().list(part='snippet', playlistId=playlist_id, maxResults=50)
                while item_request:
                    item_response = item_request.execute()
                    for item in item_response.get('items', []):
                        title = sanitize_string(item['snippet'].get('title', 'Unknown'))
                        video_id = item['snippet']['resourceId'].get('videoId')
                        if title not in [v['title'] for v in saved_videos] and video_id:
                            saved_videos.append({
                                'title': title,
                                'video_id': video_id,
                                'thumbnail_url': item['snippet']['thumbnails'].get('medium', {}).get('url', '')
                            })
                            video_ids.append(video_id)
                    item_request = youtube.playlistItems().list_next(item_request, item_response)
            playlist_request = youtube.playlists().list_next(playlist_request, playlist_response)
    except Exception as e:
        logger.error(f"Error fetching saved videos: {str(e)}")
    return {'saved_videos': saved_videos, 'video_ids': video_ids}

def determine_music_and_genres(youtube, video_ids: List[str]) -> Tuple[List[Dict], List[str]]:
    """Identifies music videos and genres from video IDs."""
    music_listened = []
    video_genres = []
    try:
        for i in range(0, len(video_ids), 50):
            batch_ids = video_ids[i:i+50]
            # Include statistics to get viewCount for sorting
            request = youtube.videos().list(part='snippet,statistics', id=','.join(batch_ids))
            response = request.execute()
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
                if category_id:
                    category_request = youtube.videoCategories().list(part='snippet', id=category_id)
                    category_response = category_request.execute()
                    genre = category_response['items'][0]['snippet']['title'] if category_response.get('items') else 'Unknown'
                    video_genres.append(sanitize_string(genre))
    except Exception as e:
        logger.error(f"Error determining music/genres: {str(e)}")
    return music_listened, list(set(video_genres))

def fetch_playlists(youtube):
    """Fetches user's playlists."""
    playlists = []
    try:
        request = youtube.playlists().list(part='snippet,id', mine=True, maxResults=50)
        while request:
            response = request.execute()
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
    """Counts how many times each music video appears across playlists and likes.
    Higher count = watched/added more times = higher priority."""
    video_watch_counts = {}
    try:
        # Count from liked videos
        request = youtube.videos().list(part='snippet', myRating='like', maxResults=50)
        while request:
            response = request.execute()
            for video in response.get('items', []):
                video_id = video['id']
                # Liked videos count as 1 watch
                video_watch_counts[video_id] = video_watch_counts.get(video_id, 0) + 0.5
            request = youtube.videos().list_next(request, response)

        # Count from playlists (multiple playlist appearances = more engagement)
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

    return video_watch_counts

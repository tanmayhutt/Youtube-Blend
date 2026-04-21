# services/comparison.py - Comparison logic for YouTube data
# Lovable AI: Frontend calls /compare/run/{id} to get this - display match % and common items in UI.

from typing import Dict, List
import numpy as np

def calculate_similarity(list1: List, list2: List) -> float:
    """Jaccard similarity: (Intersection / Union) * 100."""
    set1, set2 = set(list1), set(list2)
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return (intersection / union * 100) if union > 0 else 0.0

def compare_interests_logic(user1_data: Dict, user2_data: Dict) -> Dict:
    """Compares two users' YouTube data for common interests and scores."""
    # Prepare lists for comparison
    u1_subs = [s['title'] for s in user1_data['subscriptions']]
    u2_subs = [s['title'] for s in user2_data['subscriptions']]
    u1_saved = [v['title'] for v in user1_data['saved_videos']]
    u2_saved = [v['title'] for v in user2_data['saved_videos']]
    u1_music = [m['title'] for m in user1_data['music_listened']]
    u2_music = [m['title'] for m in user2_data['music_listened']]

    # Common items
    common_subs = set(u1_subs) & set(u2_subs)
    common_sub_genres = set(user1_data['subscription_genres']) & set(user2_data['subscription_genres'])
    common_saved = set(u1_saved) & set(u2_saved)
    common_video_genres = set(user1_data['video_genres']) & set(user2_data['video_genres'])
    common_music = set(u1_music) & set(u2_music)

    # Scores - compute component scores first, then overall
    component_scores = {
        'subscriptions': calculate_similarity(u1_subs, u2_subs),
        'subscription_genres': calculate_similarity(user1_data.get('subscription_genres', []), user2_data.get('subscription_genres', [])),
        'saved_videos': calculate_similarity(u1_saved, u2_saved),
        'video_genres': calculate_similarity(user1_data.get('video_genres', []), user2_data.get('video_genres', [])),
        'music_listened': calculate_similarity(u1_music, u2_music),
    }
    # overall is the mean of the component scores
    overall = float(np.mean(list(component_scores.values()))) if component_scores else 0.0
    scores = {**component_scores, 'overall': overall}

    # Common details
    def get_common_details(titles: set, data1: List[Dict], data2: List[Dict]) -> List[Dict]:
        all_data = {item['title']: item for item in data1 + data2}
        return [all_data.get(title, {'title': title}) for title in titles]

    common_subscriptions = get_common_details(common_subs, user1_data['subscriptions'], user2_data['subscriptions'])
    common_saved_videos = get_common_details(common_saved, user1_data['saved_videos'], user2_data['saved_videos'])
    common_music_listened = get_common_details(common_music, user1_data['music_listened'], user2_data['music_listened'])

    return {
        "common_subscriptions": common_subscriptions,
        "common_subscription_genres": list(common_sub_genres),
        "common_saved_videos": common_saved_videos,
        "common_video_genres": list(common_video_genres),
        "common_music_listened": common_music_listened,
        "scores": {k: round(v, 1) for k, v in scores.items()},
        "platforms": ["youtube", "youtube_music"]
    }

import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
mongo_uri = os.getenv('MONGO_URI')

if not mongo_uri:
    print("❌ MONGO_URI not set")
    exit(1)

client = MongoClient(mongo_uri)
db = client['youtube_blend']
users = db['users']

# Get all users
all_users = list(users.find({}, {'google_id': 1, 'email': 1}))

if not all_users:
    print("No users found")
    exit(0)

print("Users in database:")
for i, user in enumerate(all_users):
    print(f"{i+1}. {user.get('email', user['google_id'])}")

choice = input("\nEnter number to clear tokens (or 'all' for all users): ")

if choice.lower() == 'all':
    result = users.update_many({}, {
        '$unset': {
            'credentials': "",
            'token_data': "",
            'cached_data': ""
        }
    })
    print(f"✅ Cleared tokens for {result.modified_count} users")
else:
    try:
        idx = int(choice) - 1
        user = all_users[idx]
        result = users.update_one(
            {'google_id': user['google_id']},
            {
                '$unset': {
                    'credentials': "",
                    'token_data': "",
                    'cached_data': ""
                }
            }
        )
        print(f"✅ Cleared tokens for {user.get('email', user['google_id'])}")
    except:
        print("Invalid selection")

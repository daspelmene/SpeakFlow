import json
import random
import pandas as pd
from faker import Faker

fake = Faker()
Faker.seed(42)
random.seed(42)

LANGUAGES = ["English", "Spanish", "French", "German", "Russian", "Chinese", "Japanese", "Korean", "Italian",
             "Portuguese", "Arabic", "Turkish"]
CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
INTERESTS_POOL = [
    "IT & Programming", "Traveling", "Gaming", "Cooking", "Sports",
    "Music", "Movies", "Art", "Reading", "Photography",
    "History", "Science", "Fitness", "Nature", "Fashion",
    "Anime", "Startups", "Psychology", "Languages"
]


def generate_bio(name, native_lang, target_lang, interests):
    i1, i2 = interests[0].lower(), interests[1].lower()

    templates = [
        f"Hi, I'm {name}. I'm a native {native_lang} speaker looking to practice my {target_lang}. In my free time, I really enjoy {i1} and {i2}.",
        f"Passionate about {i1} and {i2}. I want to improve my {target_lang} for future travels or work. I can definitely help you with {native_lang}!",
        f"Enthusiast of {i1}. Currently learning {target_lang} and looking for native speakers to chat with. I also like {i2} and would love to discuss it.",
        f"Hello! I am learning {target_lang} and my native language is {native_lang}. My main hobbies include {i1}, {i2}, and just meeting new people from different countries.",
        f"I work in a field related to {i1} and love {i2} on the weekends. My goal is to reach a fluent level in {target_lang}. Hit me up if you want to practice {native_lang}!",
        f"{fake.sentence()} Mostly here to talk about {i1} and {i2} in {target_lang}. Let's have a great conversation!"
    ]
    return random.choice(templates)


def create_synthetic_profiles(num_profiles=500):
    profiles = []

    for i in range(1, num_profiles + 1):
        name = fake.first_name()

        langs = random.sample(LANGUAGES, 2)
        native_lang = langs[0]
        target_lang = langs[1]

        target_level = random.choice(CEFR_LEVELS)
        num_interests = random.randint(2, 4)
        user_interests = random.sample(INTERESTS_POOL, num_interests)

        bio = generate_bio(name, native_lang, target_lang, user_interests)

        profile = {
            "user_id": i,
            "name": name,
            "native_language": native_lang,
            "target_language": target_lang,
            "target_level": target_level,
            "interests": user_interests,
            "bio": bio
        }
        profiles.append(profile)

    return profiles


if __name__ == "__main__":
    print("Generating 500+ synthetic user profiles...")
    dataset = create_synthetic_profiles(550)

    with open("speakflow_mock_users.json", "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=4, ensure_ascii=False)

    df = pd.DataFrame(dataset)
    df['interests'] = df['interests'].apply(lambda x: ", ".join(x))
    df.to_csv("speakflow_mock_users.csv", index=False, encoding="utf-8")

    print("Successfully generated 'speakflow_mock_users.json' and 'speakflow_mock_users.csv'.")
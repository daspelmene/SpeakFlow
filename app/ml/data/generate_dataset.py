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
SEMANTIC_VARIATIONS = {
    "IT & Programming": [
        "writing code in Python",
        "building web applications",
        "reading about new tech frameworks",
        "fixing bugs in my pet projects"
    ],
    "Traveling": [
        "backpacking across Europe",
        "exploring new cultures and cities",
        "taking spontaneous road trips",
        "visiting places I've never been before"
    ],
    "Gaming": [
        "playing competitive multiplayer games",
        "speedrunning retro platformers",
        "grinding ranks in e-sports titles",
        "getting lost in massive open-world RPGs"
    ],
    "Cooking": [
        "trying out new recipes",
        "baking desserts on weekends",
        "experimenting with Italian cuisine",
        "spending hours in the kitchen making dinner"
    ],
    "Sports": [
        "going for morning runs",
        "playing football with friends",
        "watching the Champions League",
        "training for a local marathon"
    ],
    "Music": [
        "going to live indie gigs",
        "playing the acoustic guitar",
        "curating the perfect Spotify playlists",
        "producing electronic beats"
    ],
    "Movies": [
        "binge-watching classic cinema",
        "discussing plot twists in thrillers",
        "going to midnight premieres",
        "analyzing directing styles"
    ],
    "Art": [
        "visiting contemporary galleries",
        "sketching portraits in my notebook",
        "painting with watercolors",
        "studying Renaissance masterpieces"
    ],
    "Reading": [
        "devouring sci-fi novels",
        "collecting hardcover first editions",
        "reading fantasy series before bed",
        "joining local book club discussions"
    ],
    "Photography": [
        "shooting on 35mm film",
        "editing raw photos in Lightroom",
        "doing street photography on weekends",
        "capturing beautiful landscapes"
    ],
    "History": [
        "reading biographies of historical figures",
        "watching documentaries about ancient Rome",
        "visiting local museums",
        "discussing 20th-century geopolitical events"
    ],
    "Science": [
        "keeping up with space exploration news",
        "reading popular physics books",
        "discussing biotech breakthroughs",
        "learning about quantum mechanics"
    ],
    "Fitness": [
        "hitting the gym after work",
        "doing crossfit workouts",
        "practicing yoga in the mornings",
        "tracking my macronutrients"
    ],
    "Nature": [
        "hiking in the national parks",
        "camping over the weekend",
        "bird watching in the forest",
        "growing indoor houseplants"
    ],
    "Fashion": [
        "following runway trends",
        "thrift shopping for vintage clothes",
        "putting together unique outfits",
        "reading design magazines"
    ],
    "Anime": [
        "watching seasonal Japanese animation",
        "reading the latest manga chapters",
        "going to cosplay conventions",
        "discussing my favorite shounen arcs"
    ],
    "Startups": [
        "pitching new business ideas",
        "reading about venture capital",
        "building my own SaaS product",
        "networking with local entrepreneurs"
    ],
    "Psychology": [
        "learning about human behavior",
        "reading cognitive science research",
        "understanding personality types",
        "discussing mental health awareness"
    ],
    "Languages": [
        "doing my daily Duolingo streak",
        "learning kanji characters",
        "doing language exchange calls",
        "studying foreign grammar rules"
    ]
}


def generate_bio(name, native_lang, target_lang, interests):
    phrase_1 = random.choice(SEMANTIC_VARIATIONS[interests[0]])
    phrase_2 = random.choice(SEMANTIC_VARIATIONS[interests[1]])

    templates = [
        f"Hi, I'm {name}. I'm a native {native_lang} speaker looking to practice my {target_lang}. In my free time, I really enjoy {phrase_1} and {phrase_2}.",
        f"I want to improve my {target_lang} for future goals. I can definitely help you with {native_lang}. When I'm offline, you can usually find me {phrase_1}.",
        f"Currently learning {target_lang}. I am super passionate about {phrase_2} and would love to discuss it with native speakers!",
        f"Hello! My native language is {native_lang}. My main hobbies include {phrase_1}, {phrase_2}, and just meeting new people from different countries.",
        f"I'm mostly here to talk about {phrase_1} and {phrase_2} in {target_lang}. Let's have a great conversation!"
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
        user_interests = random.sample(list(SEMANTIC_VARIATIONS.keys()), num_interests)

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
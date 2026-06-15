REGISTER_DATA = {
    "email": "pytest_user@test.com",
    "password": "TestPass123",
    "fullname": "Test User",
    "native_language": "ru",
    "target_language": "en",
    "interests": ["music", "sports"],
    "bio": "Hello world",
}

LOGIN_DATA = {
    "email": REGISTER_DATA["email"],
    "password": REGISTER_DATA["password"],
}

UPDATE_DATA = {
    "fullname": "Updated User",
    "bio": "Updated bio",
    "interests": ["reading", "coding"],
}

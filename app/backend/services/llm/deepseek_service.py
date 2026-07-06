from utils.deepseek import client

async def generate_json(messages, temperature: float = 0.3):
    response = await client.chat.completions.create(
        model="deepseek-chat",
        response_format={"type": "json_object"},
        messages=messages,
        temperature=temperature,
    )

    return response.choices[0].message.content
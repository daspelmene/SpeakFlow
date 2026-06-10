FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/speakflow .

EXPOSE 80
ENTRYPOINT ["python", "main.py"]
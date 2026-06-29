FROM python:3.14.0-slim-trixie

RUN apt-get update && apt-get install -y lame && rm -rf /var/lib/apt/lists/*

RUN adduser --disabled-password app

WORKDIR /app

COPY app/backend/requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY app/backend/ .
# For documentation purposes
COPY app/backend/entrypoint.sh .

RUN mkdir -p /recordings && chown -R app:app /recordings
RUN chown -R app:app /app

RUN chmod +x entrypoint.sh

USER app

EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]

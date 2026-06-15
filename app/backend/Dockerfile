FROM python:3.12-slim

WORKDIR /app

COPY app/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY app/backend/entrypoint.sh .

RUN adduser --disabled-password app && chmod +x entrypoint.sh
USER app

CMD ["./entrypoint.sh"]

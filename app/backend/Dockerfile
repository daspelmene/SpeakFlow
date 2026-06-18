FROM python:3.14.0-slim-trixie

RUN adduser --disabled-password app

WORKDIR /app

COPY app/backend/requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY --chown=app:app app/ .
COPY --chown=app:app app/backend/entrypoint.sh .

RUN chmod +x entrypoint.sh

USER app

EXPOSE 8000
CMD ["./entrypoint.sh"]

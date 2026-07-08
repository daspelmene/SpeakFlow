FROM python:3.14.0-slim-trixie

RUN adduser --disabled-password test

WORKDIR /tests

COPY app/tests/requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY app/tests/ .
RUN chown -R test:test /tests

USER test

ENTRYPOINT [ "pytest", "-v", "." ]

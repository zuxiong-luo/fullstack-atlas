FROM python:3.12.14-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY app.py oom_fixture.py /app/
RUN mkdir -p /data && chown 10001:10001 /data
USER 10001:10001
EXPOSE 8080
STOPSIGNAL SIGTERM
CMD ["python", "-u", "/app/app.py"]

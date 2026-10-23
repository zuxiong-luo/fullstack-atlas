# Build context: examples/agent-workshop, not python-v2 alone.
FROM python:3.12.14-slim
WORKDIR /app
COPY python-v2/requirements.lock /app/requirements.lock
RUN pip install --no-cache-dir -r requirements.lock && useradd --uid 10001 --create-home app && mkdir /data && chown app:app /data
COPY python-v2/*.py /app/
COPY shared/v2 /shared/v2
USER 10001
ENV CHAPTER=8 MODEL_PROVIDER=mock SQLITE_PATH=/data/agent.sqlite
EXPOSE 8002
CMD ["python","-m","uvicorn","app:create_app","--factory","--host","0.0.0.0","--port","8002"]

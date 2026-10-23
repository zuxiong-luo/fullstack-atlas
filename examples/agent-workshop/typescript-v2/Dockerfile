FROM node:22.12.0-bookworm-slim
WORKDIR /workshop
COPY typescript-v2/package*.json ./typescript-v2/
RUN cd typescript-v2 && npm ci
COPY shared/v2 ./shared/v2
COPY typescript-v2 ./typescript-v2
RUN cd typescript-v2 && npm run build
WORKDIR /workshop/typescript-v2
ENV CHAPTER=8 PORT=4340 DATABASE_PATH=/data/workshop.sqlite MODEL_PROVIDER=mock
# Build from examples/agent-workshop: docker build -f typescript-v2/Dockerfile .
# Teaching server remains loopback-only; not a published network service.
RUN mkdir -p /data && chown -R node:node /workshop /data
USER node
VOLUME ["/data"]
CMD ["npm", "start"]

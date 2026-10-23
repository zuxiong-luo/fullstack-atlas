# 教学复现版本，部署前应按实际支持周期和安全公告更新。
FROM node:22.12.0-alpine
WORKDIR /app
COPY app.mjs .
USER node
EXPOSE 8080
CMD ["node","app.mjs"]

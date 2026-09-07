# ==============================================================================
# Stage 1: 前端静态资源构建 (Node 20 Alpine)
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# 优先利用 Docker 缓存机制
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Python 极简轻量运行镜像 (Python 3.11 Slim)
# ==============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8899 \
    HOST=0.0.0.0 \
    MEDIA_DIR=/data/movies

# 安装后端依赖
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# 复制后端业务源码
COPY backend/ ./backend/

# 复制 Stage 1 构建完成的前端静态资产
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 创建默认挂载目录
RUN mkdir -p /data/movies /data/movies/电影 /data/movies/电视剧

WORKDIR /app/backend

EXPOSE 8899

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8899/api/trending')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8899"]

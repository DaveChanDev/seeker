<div align="center">

<img src="./assets/logo.png" alt="Seeker Logo" width="120" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);" />

# 🎬 Seeker (觅影)

**现代化全网影视聚合搜索 · 在线流媒体播放 · AI 智能选片分析 · 离线自动落盘中枢**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![TailwindCSS](https://img.shields.io/badge/CSS-TailwindCSS%203-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

</div>

---

## 📖 项目简介

**Seeker (觅影)** 是一套专为家庭影音玩家、Homelab 爱好者及影视发烧友打造的现代化影视聚合与流媒体下钻工具。

它将**全网多源资源聚合搜索**、**网盘目录树深度解析**、**AI 智能选片决策与版本导视**、**在线流畅视频直播嗅探**以及**本地存储安全落盘**融为一体。无论是作为日常看片找片的首选桌面应用，还是部署在家庭 NAS 上作为私有化影音中枢，都能提供媲美主流商业流媒体软件的极致丝滑体验。

---

## ✨ 核心特性

- 🔍 **全网聚合搜索**：秒级并发检索海量多网盘与公共资源，智能去重与热度排序。
- 🎨 **流媒体级现代 UI**：基于 **React 19 + Tailwind CSS** 构建，深度适配手机触控抽屉（Mobile Bottom Drawer）与 PC 宽屏沉浸式大卡片。
- 🧠 **AI 智能选片专家**：集成大语言模型（Google Gemini 等），智能对比多个候选源画质，识别 4K 原盘/杜比视界/未删减导剪版，并生成精准观影导视与剧集差异对比。
- 📺 **秒播级在线流媒体解析**：深度解析网盘目录与视频文件流，支持多码率直链嗅探与网页端无缝点播。
- 📥 **自动化离线转存与落盘**：可无缝联动 AList 或本地文件系统，支持后台异步下载、实时进度流式追踪与任务管理。
- 🛡️ **安全闭环文件治理**：内置安全的影视库管理系统，支持重命名、规范归档及高危操作安全拦截（需输入 `DELETE` 口令确认）。
- 🐳 **开箱即用单容器**：前后端整合编译，零复杂外部依赖，一条 Docker 命令即可完整拉起。

---

## 🚀 极速部署 (Quick Start)

### 方式 1：使用 Docker Compose（推荐）

1. 创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  seeker:
    image: ghcr.io/your-username/seeker:latest # 或本地构建: build: .
    container_name: seeker
    restart: unless-stopped
    ports:
      - "8899:8899"
    environment:
      - PORT=8899
      - MEDIA_DIR=/data/movies
      # 可选：配置 TMDB API Key (已有默认内置 Key)
      # - TMDB_API_KEY=your_tmdb_key
      # 可选：配置 Gemini AI 选片分析
      # - GEMINI_API_KEY=your_gemini_key
    volumes:
      # 映射您的本地/NAS 电影存放目录
      - /path/to/your/movies:/data/movies
```

2. 启动服务：
```bash
docker compose up -d
```

3. 打开浏览器访问：`http://你的服务器IP:8899` 即可畅享体验！

---

### 方式 2：使用 Docker 命令一行运行

```bash
docker run -d \
  --name seeker \
  --restart unless-stopped \
  -p 8899:8899 \
  -v /path/to/your/movies:/data/movies \
  ghcr.io/your-username/seeker:latest
```

---

## 🛠️ 本地手动开发与构建

### 1. 环境要求
- **Node.js**: >= 18.0.0
- **Python**: >= 3.10

### 2. 构建前端
```bash
cd frontend
npm install
npm run build
```

### 3. 运行后端
```bash
cd ../backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 启动开发服务器
python3 -m uvicorn main:app --host 0.0.0.0 --port 8899 --reload
```

---

## ⚙️ 环境变量配置说明 (Configuration)

可在 `.env` 或 Docker Compose 的 `environment` 中配置以下参数：

| 环境变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `PORT` | `8899` | 网页与 API 服务监听端口 |
| `MEDIA_DIR` | `/data/movies` | 媒体库核心根路径，影视下载落盘的目标目录 |
| `LOCAL_MEDIA_PATHS` | `/data/movies` | 本地媒体库扫描路径，多路径用英文逗号分隔 |
| `TMDB_API_KEY` | *(内置通用Key)* | TMDB 电影海报与元数据 API Key |
| `GEMINI_API_KEY` | *(留空)* | 可选，启用 Gemini AI 选片分析与剧集对比 |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini 使用的大模型版本 |
| `GEMINI_PROXY` | *(留空)* | 可选，国内直连 Google API 的 HTTP 代理地址 |
| `ALIST_URL` | `http://127.0.0.1:5244` | 可选，AList 服务的访问地址 |
| `ALIST_USER` | *(留空)* | 可选，AList 管理员账号 |
| `ALIST_PASS` | *(留空)* | 可选，AList 管理员密码 |
| `JELLYFIN_URL` | `http://127.0.0.1:40097` | 可选，Jellyfin 服务地址 |
| `QUARK_COOKIE` | *(留空)* | 可选，默认网盘 Cookie（支持在网页前端随时配置） |

---

## ⚠️ 免责声明 (Disclaimer)

1. 本项目仅用于个人学习、编程技术交流以及学术研究，严禁用于任何商业牟利或非法用途。
2. 本项目作为开源播放与聚合检索工具，**不存储、不上传、亦不分发任何音视频源文件或受版权保护的内容**。所有搜索结果与网络数据均来源于公共网络接口或第三方用户自定义输入。
3. 使用本项目所产生的一切版权争议或法律后果，均由使用者自行承担，与本项目原作者及贡献者无关。
4. 请自觉尊重知识产权，支持正版影视影视作品。

---

## 📄 开源许可证 (License)

本项目基于 [MIT License](LICENSE) 协议开源。

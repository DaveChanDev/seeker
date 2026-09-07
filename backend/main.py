import asyncio
import os
import threading
for key in ['http_proxy', 'https_proxy', 'all_proxy', 'ALL_PROXY', 'HTTP_PROXY', 'HTTPS_PROXY']:
    os.environ.pop(key, None)
import re
import json
import time
import hashlib
import urllib.parse
from typing import List, Optional, Tuple, Dict, Any
from fastapi import FastAPI, Query, HTTPException, Response, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
from gemini_brain import (
    call_gemini_smart_recommend,
    call_gemini_natural_curate,
    diff_tv_episodes,
    rule_based_fallback_select,
    extract_episode_num
)

app = FastAPI(title="Seeker (觅影) API", version="6.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOUBAN_CACHE = {}
CACHE_TTL = 86400
tasks_lock = threading.Lock()

# 锁定默认 NAS 存储起点
BASE_NAS_DIR = os.environ.get("MEDIA_DIR", "/data/movies")
MOVIES_ROOT = os.path.join(BASE_NAS_DIR, "电影")
TV_ROOT = os.path.join(BASE_NAS_DIR, "电视剧")

for d in [BASE_NAS_DIR, MOVIES_ROOT, TV_ROOT]:
    if not os.path.exists(d):
        try:
            os.makedirs(d, exist_ok=True)
        except Exception:
            pass

TASKS_FILE = os.path.join(os.path.dirname(__file__), "download_tasks.json")

def load_download_tasks():
    with tasks_lock:
        if os.path.exists(TASKS_FILE):
            try:
                with open(TASKS_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

def save_download_tasks(tasks):
    with tasks_lock:
        try:
            with open(TASKS_FILE, "w", encoding="utf-8") as f:
                json.dump(tasks, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Save tasks error: {e}")

REAL_DOWNLOAD_TASKS = load_download_tasks()

def infer_media_type(title: str, file_names: Optional[List[str]] = None, tags: Optional[List[str]] = None) -> str:
    combined_parts = [title or ""]
    if file_names:
        combined_parts.extend(file_names)
    if tags:
        combined_parts.extend(tags)

    full_text = " ".join(combined_parts)
    clean_text = re.sub(r"\b(19\d\d|20\d\d)\b", "", full_text, flags=re.IGNORECASE)
    clean_text = re.sub(r"\b(1080p|2160p|720p|4k|8k|5\.1|7\.1|mkv|mp4|avi)\b", "", clean_text, flags=re.IGNORECASE)

    tv_patterns = [
        r"\bEP?\d{1,3}\b",
        r"\bS\d{1,2}E\d{1,2}\b",
        r"第\s*\d{1,3}\s*[集期話话]",
        r"全\s*\d{1,3}\s*[集期]",
        r"\b\d{1,3}\s*[集期]\b",
        r"\b(0[1-9]|[1-9]\d)\s*[\. \-\_\)\]]",
        r"电视剧|剧集|动漫|国漫|美剧|日剧|韩剧|纪录片|综艺|动画"
    ]

    for pat in tv_patterns:
        if re.search(pat, clean_text, re.IGNORECASE):
            return "tv"

    if file_names and len(file_names) > 1:
        return "tv"

    if tags:
        tag_str = "".join(tags).upper()
        if "电影" in tag_str or "MOVIE" in tag_str:
            return "movie"

    return "movie" if (file_names and len(file_names) == 1) else "tv"


@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# -------------------------------------------------------------
# 图片防盗链与持久化磁盘缓存代理接口 (30天强缓存 + 304 极速协商)
# -------------------------------------------------------------
IMAGE_DISK_CACHE_DIR = os.path.join(os.path.dirname(__file__), "image_cache")
os.makedirs(IMAGE_DISK_CACHE_DIR, exist_ok=True)

@app.get("/api/img_proxy")
async def image_proxy(request: Request, url: str = Query(..., description="图片源URL")):
    if not url:
        raise HTTPException(status_code=400, detail="Missing URL")
    
    # 1. 计算唯一哈希
    url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()
    cache_path = os.path.join(IMAGE_DISK_CACHE_DIR, f"{url_hash}.img")
    etag = f'W/"{url_hash}"'

    cache_headers = {
        "Cache-Control": "public, max-age=2592000, immutable",
        "ETag": etag,
    }

    # 2. 检查客户端 ETag (304 极速返回)
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=cache_headers)

    # 3. 检查本地磁盘缓存
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "rb") as f:
                content = f.read()
            media_type = "image/webp" if url.endswith(".webp") else "image/jpeg"
            return Response(content=content, media_type=media_type, headers=cache_headers)
        except Exception:
            pass

    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Referer": "https://movie.douban.com/",
    }
    
    content = None
    media_type = "image/jpeg"

    try:
        async with httpx.AsyncClient(timeout=6.0, headers=headers, follow_redirects=True, proxy="http://127.0.0.1:7890") as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                content = resp.content
                media_type = resp.headers.get("content-type", "image/jpeg")
    except Exception as e:
        try:
            async with httpx.AsyncClient(timeout=6.0, headers=headers, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    content = resp.content
                    media_type = resp.headers.get("content-type", "image/jpeg")
        except Exception as ex:
            print(f"Img fetch error: {ex}")

    if content:
        # 写入本地磁盘缓存
        try:
            with open(cache_path, "wb") as f:
                f.write(content)
        except Exception:
            pass
        return Response(content=content, media_type=media_type, headers=cache_headers)
        
    raise HTTPException(status_code=404, detail="Image fetch failed")


# -------------------------------------------------------------
# 真实豆瓣元数据接口 (含 24h 缓存与防盗链代理 URL)
# -------------------------------------------------------------
@app.get("/api/search_meta")
async def search_douban_meta(q: str = Query(..., description="影视搜索名称")):
    now = time.time()
    clean_q = q.strip()
    cache_key = clean_q.lower()

    if cache_key in DOUBAN_CACHE:
        cached_data, timestamp = DOUBAN_CACHE[cache_key]
        if now - timestamp < CACHE_TTL:
            return cached_data

    headers = {
        "Authorization": f"Bearer {TMDB_BEARER_TOKEN}",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    meta_info = {
        "title": clean_q,
        "original_title": "",
        "rating": "",
        "year": "",
        "cover": "",
        "tags": [],
        "summary": "",
    }

    # 1. 优先从 TMDB 官方 API 检索真实剧情简介、真实评分、真实原名与高清海报
    try:
        async with httpx.AsyncClient(timeout=6.0, proxy="http://127.0.0.1:7890", verify=False) as client:
            search_url = f"https://api.themoviedb.org/3/search/multi?api_key={TMDB_API_KEY}&language=zh-CN&query={urllib.parse.quote(clean_q)}"
            s_resp = await client.get(search_url, headers=headers)
            if s_resp.status_code == 200:
                s_data = s_resp.json()
                results = s_data.get("results", [])
                if results:
                    # 过滤只保留 movie 和 tv
                    media_items = [r for r in results if r.get("media_type") in ("movie", "tv")]
                    if media_items:
                        top = media_items[0]
                        m_type = top.get("media_type", "movie")
                        m_id = top.get("id")

                        # 抓取真实深度详情
                        endpoint = "tv" if m_type == "tv" else "movie"
                        detail_url = f"https://api.themoviedb.org/3/{endpoint}/{m_id}?api_key={TMDB_API_KEY}&language=zh-CN"
                        d_resp = await client.get(detail_url, headers=headers)
                        if d_resp.status_code == 200:
                            d_json = d_resp.json()
                            
                            t_name = d_json.get("title") or d_json.get("name") or clean_q
                            orig_name = d_json.get("original_title") or d_json.get("original_name") or ""
                            
                            meta_info["title"] = t_name
                            # 若原名与中文名相同，则置空以防界面重复显示“好先生 好先生”
                            meta_info["original_title"] = orig_name if orig_name.strip().lower() != t_name.strip().lower() else ""
                            
                            r_date = d_json.get("release_date") or d_json.get("first_air_date") or ""
                            meta_info["year"] = r_date[:4] if len(r_date) >= 4 else ""
                            
                            vote_avg = d_json.get("vote_average", 0)
                            if vote_avg and vote_avg > 0:
                                meta_info["rating"] = f"{float(vote_avg):.1f}"
                                
                            poster = d_json.get("poster_path")
                            if poster:
                                meta_info["cover"] = f"/api/img_proxy?url={urllib.parse.quote('https://image.tmdb.org/t/p/w500' + poster, safe='')}"
                                
                            # 真实题材分类标签
                            genres = d_json.get("genres", [])
                            meta_info["tags"] = [g.get("name") for g in genres if g.get("name")]
                            
                            # 真实剧情简介
                            overview = d_json.get("overview", "").strip()
                            if overview:
                                meta_info["summary"] = overview
                                
                            DOUBAN_CACHE[cache_key] = (meta_info, now)
                            return meta_info
    except Exception as e:
        print(f"TMDB search meta error for '{clean_q}': {e}")

    # 2. 兜底策略：若 TMDB 检索未命中，通过豆瓣官方 Suggest 联想真实影视条目
    try:
        async with httpx.AsyncClient(timeout=5.0, headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)"}, follow_redirects=True) as client:
            resp = await client.get("https://movie.douban.com/j/subject_suggest", params={"q": clean_q})
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    top_item = data[0]
                    d_title = top_item.get("title", clean_q)
                    d_sub = top_item.get("sub_title") or ""
                    
                    meta_info["title"] = d_title
                    # 避免原名与主标题重复
                    meta_info["original_title"] = d_sub if d_sub.strip().lower() != d_title.strip().lower() else ""
                    meta_info["year"] = top_item.get("year", "")
                    
                    raw_cover = top_item.get("img", "")
                    if raw_cover:
                        high_res_cover = raw_cover.replace("s_ratio_poster", "m_ratio_poster")
                        meta_info["cover"] = f"/api/img_proxy?url={high_res_cover}"
                    
                    m_type_label = "剧集" if top_item.get("type") == "tv" else "电影"
                    meta_info["tags"] = [m_type_label, f"{meta_info['year']}年" if meta_info['year'] else "精选佳作"]
                    if not meta_info["summary"]:
                        meta_info["summary"] = f"《{d_title}》是由多位知名演员出演的经典{m_type_label}作品，欢迎探索全网高清云盘与离线资源。"
    except Exception as e:
        print(f"Douban suggest fallback error for '{clean_q}': {e}")

    # 兜底默认占位
    if not meta_info["summary"]:
        meta_info["summary"] = f"《{clean_q}》影视聚合精选资源，已关联夸克网盘极速转存与离线下载通道。"

    DOUBAN_CACHE[cache_key] = (meta_info, now)
    return meta_info


# -------------------------------------------------------------
# 真实 Pansou 搜索与真实夸克网盘链接解析
# -------------------------------------------------------------
PANSOU_URL = os.environ.get("PANSOU_URL", "http://127.0.0.1:9933")
PANSOU_USER = os.environ.get("PANSOU_USER", "")
PANSOU_PASS = os.environ.get("PANSOU_PASS", "")
PANSOU_AUTH_CACHE = {"token": "", "expiry": 0}

ALIST_URL = os.environ.get("ALIST_URL", "http://127.0.0.1:5244")
ALIST_USER = os.environ.get("ALIST_USER", "")
ALIST_PASS = os.environ.get("ALIST_PASS", "")

async def get_pansou_token():
    now = time.time()
    if PANSOU_AUTH_CACHE["token"] and now < PANSOU_AUTH_CACHE["expiry"]:
        return PANSOU_AUTH_CACHE["token"]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(f"{PANSOU_URL}/api/auth/login", json={"username": PANSOU_USER, "password": PANSOU_PASS})
            if res.status_code == 200:
                token = res.json().get("token")
                if token:
                    PANSOU_AUTH_CACHE["token"] = token
                    PANSOU_AUTH_CACHE["expiry"] = now + 3600
                    return token
    except Exception as e:
        print(f"Pansou login error: {e}")
    return ""


def parse_five_dimensional_media_meta(title: str, raw_size_str: str = ""):
    t_lower = title.lower()

    # 1) 枪版剔除过滤
    if re.search(r"cam|ts|tc|枪版|抢先版|hd-cam|hdcam|广告", t_lower):
        return None

    # 2) 第一维：分辨率
    if re.search(r"2160p|4k|uhd", t_lower):
        res = "4K"
    elif re.search(r"1080p|fhd", t_lower):
        res = "1080P"
    elif re.search(r"720p", t_lower):
        res = "720P"
    else:
        res = "HD"

    # 3) 第二维：片源血统
    if re.search(r"bderemux|remux", t_lower):
        source = "REMUX"
    elif re.search(r"bluray|bdrip|\bbdr\b", t_lower):
        source = "BluRay"
    elif re.search(r"web-dl|webdl|\bweb\b", t_lower):
        source = "WEB-DL"
    elif re.search(r"webrip|hdtv", t_lower):
        source = "WEBRip"
    else:
        source = "WEB-DL" if "web" in t_lower else "HD"

    # 4) 第三维：动态色彩
    if re.search(r"dovi|dolby\s*vision|dolbyvision|\bdv\b", t_lower):
        hdr = "杜比视界"
    elif re.search(r"hdr10\+|hdr10|hdr", t_lower):
        hdr = "HDR"
    else:
        hdr = ""

    # 5) 第四维：声音声场
    if re.search(r"atmos|dolby\s*atmos", t_lower):
        audio = "全景声"
    elif re.search(r"dts-hd|truehd|5\.1|7\.1", t_lower):
        audio = "5.1/7.1"
    else:
        audio = ""

    # 解析 size_gb
    size_gb = 0.0
    if raw_size_str:
        s_upper = raw_size_str.upper()
        m_gb = re.search(r"([\d\.]+)\s*GB", s_upper)
        m_mb = re.search(r"([\d\.]+)\s*MB", s_upper)
        if m_gb:
            try: size_gb = float(m_gb.group(1))
            except: pass
        elif m_mb:
            try: size_gb = float(m_mb.group(1)) / 1024.0
            except: pass

    # 从 title 中再匹配提取 GB 大小（若 raw_size_str 未包含）
    if size_gb == 0.0:
        m_title_gb = re.search(r"([\d\.]+)\s*(?:GB|G)", title, re.IGNORECASE)
        if m_title_gb:
            try: size_gb = float(m_title_gb.group(1))
            except: pass

    # 6) 第五维：码率防伪与智能打分
    badge = ""
    score_weight = 30

    if res == "4K" and 0 < size_gb < 3.0:
        badge = "⚠️伪4K"
        score_weight = 10
    elif res == "4K" and source == "WEB-DL" and 8.0 <= size_gb <= 18.0:
        badge = "🏆甜点"
        score_weight = 100
    elif source == "REMUX" and size_gb >= 40.0:
        badge = "🔥原盘"
        score_weight = 90
    elif res == "4K":
        badge = "4K"
        score_weight = 70
    elif res == "1080P":
        badge = "1080P"
        score_weight = 50

    tags = []
    if badge: tags.append(badge)
    if res and res not in badge: tags.append(res)
    if source: tags.append(source)
    if hdr: tags.append(hdr)
    if audio: tags.append(audio)
    if size_gb > 0: tags.append(f"{size_gb:.1f}G")

    return {
        "res": res,
        "source": source,
        "hdr": hdr,
        "audio": audio,
        "badge": badge,
        "size_gb": size_gb,
        "score_weight": score_weight,
        "tags": tags
    }


@app.get("/api/search_pansou")
async def search_pansou(q: str = Query(..., description="搜索关键词")):
    token = await get_pansou_token()
    raw_results = []
    
    if token:
        try:
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(f"{PANSOU_URL}/api/search", json={"kw": q}, headers=headers)
                if resp.status_code == 200:
                    res_json = resp.json()
                    merged = res_json.get("data", {}).get("merged_by_type", {})
                    quark_list = merged.get("quark", [])[:20]
                    magnet_list = merged.get("magnet", [])[:10]
                    
                    for idx, x in enumerate(quark_list):
                        note = x.get("note", q)
                        url = x.get("url", "")
                        pwd = x.get("password", "")
                        dt = x.get("datetime", "")
                        if dt and "T" in dt:
                            dt = dt.split("T")[0]

                        # 五维防伪与规则解析
                        parsed = parse_five_dimensional_media_meta(note, "")
                        if not parsed:
                            continue  # 枪版/垃圾资源过滤剔除

                        raw_results.append({
                            "id": f"quark_{idx}",
                            "title": note,
                            "link": url,
                            "password": pwd,
                            "netdisk": "夸克网盘",
                            "source": x.get("source", "夸克云盘"),
                            "size": f"{parsed['size_gb']:.1f}GB" if parsed['size_gb'] > 0 else "夸克网盘",
                            "datetime": dt or "2024-01-01",
                            "res": parsed["res"],
                            "source_type": parsed["source"],
                            "hdr": parsed["hdr"],
                            "audio": parsed["audio"],
                            "badge": parsed["badge"],
                            "size_gb": parsed["size_gb"],
                            "score_weight": parsed["score_weight"],
                            "five_tags": parsed["tags"]
                        })
                    
                    for idx, x in enumerate(magnet_list):
                        note = x.get("note", q)
                        parsed = parse_five_dimensional_media_meta(note, "")
                        if not parsed:
                            continue
                        dt = x.get("datetime", "")
                        if dt and "T" in dt:
                            dt = dt.split("T")[0]
                        raw_results.append({
                            "id": f"mag_{idx}",
                            "title": note,
                            "link": x.get("url", ""),
                            "password": "",
                            "netdisk": "磁力资源",
                            "source": x.get("source", "磁力"),
                            "size": f"{parsed['size_gb']:.1f}GB" if parsed['size_gb'] > 0 else "BT种子/磁力",
                            "datetime": dt or "2024-01-01",
                            "res": parsed["res"],
                            "source_type": parsed["source"],
                            "hdr": parsed["hdr"],
                            "audio": parsed["audio"],
                            "badge": parsed["badge"],
                            "size_gb": parsed["size_gb"],
                            "score_weight": parsed["score_weight"],
                            "five_tags": parsed["tags"]
                        })
                        
                    # 根据五维防伪得分与智能评分倒序精选排序
                    raw_results.sort(key=lambda item: item.get("score_weight", 0), reverse=True)
        except Exception as e:
            print(f"Pansou search error: {e}")

    return {"query": q, "total": len(raw_results), "data": raw_results}


@app.get("/api/parse_quark")
def parse_quark_share(
    url: str = Query(..., description="网盘分享链接或资源标题"),
    pwd: str = Query("", description="提取码密码"),
    pdir_fid: str = Query("0", description="当前目录 FID")
):
    files = []
    share_title = "网盘资源"
    error_msg = ""
    auto_drilled = False
    auto_drilled_name = ""

    quark_url_match = re.search(r"https?://pan\.quark\.cn/s/[a-zA-Z0-9]+", url) or re.search(r"https?://[^\s\]\"']+", url)
    clean_quark_url = quark_url_match.group(0) if quark_url_match else ""

    if clean_quark_url and "pan.quark.cn" in clean_quark_url:
        try:
            for k in ['all_proxy', 'ALL_PROXY', 'http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY']:
                os.environ.pop(k, None)

            quark_cookie = QUARK_COOKIE_STORE
            if not quark_cookie and ALIST_USER and ALIST_PASS:
                try:
                    with httpx.Client(timeout=4.0, trust_env=False) as client:
                        l_res = client.post(f"{ALIST_URL}/api/auth/login", json={"username": ALIST_USER, "password": ALIST_PASS})
                        if l_res.status_code == 200:
                            alist_token = l_res.json().get("data", {}).get("token", "")
                            storage_res = client.get(f"{ALIST_URL}/api/admin/storage/get?id=2", headers={"Authorization": alist_token})
                            addition = json.loads(storage_res.json().get("data", {}).get("addition", "{}"))
                            quark_cookie = addition.get("cookie", "")
                except Exception:
                    pass

            if quark_cookie:
                from quark_client import QuarkClient
                qc = QuarkClient(cookies=quark_cookie)
                share_id, parsed_pwd = qc.shares.parse_share_url(clean_quark_url)
                final_pwd = pwd.strip() or parsed_pwd or ""
                token = qc.shares.get_share_token(share_id, final_pwd)

                info = qc.shares.get_share_info(share_id, token, pdir_fid=pdir_fid)
                raw_items = info.get("data", {}).get("list", [])
                share_title = info.get("data", {}).get("share_title") or "夸克网盘资源"

                for idx, f_item in enumerate(raw_items):
                    f_name = f_item.get("file_name", "未知文件")
                    is_dir = f_item.get("dir", False)
                    size_bytes = f_item.get("size", 0)
                    if is_dir:
                        size_str = "文件夹"
                    elif size_bytes > 1024 * 1024 * 1024:
                        size_str = f"{size_bytes / (1024*1024*1024):.2f} GB"
                    elif size_bytes > 1024 * 1024:
                        size_str = f"{size_bytes / (1024*1024):.1f} MB"
                    else:
                        size_str = f"{size_bytes / 1024:.1f} KB"

                    ext = os.path.splitext(f_name)[1].lower()
                    is_real_video = False
                    if not is_dir:
                        if ext in ['.mkv', '.mp4', '.ts', '.mov', '.avi', '.flv', '.iso', '.rmvb', '.wmv', '.m2ts']:
                            is_real_video = True
                        elif size_bytes >= 150 * 1024 * 1024 and ext not in ['.zip', '.rar', '.7z', '.tar', '.gz', '.txt', '.jpg', '.jpeg', '.png', '.url', '.html', '.torrent', '.apk', '.exe']:
                            is_real_video = True

                    files.append({
                        "id": f_item.get("fid") or f"file_{idx}",
                        "name": f_name,
                        "size": size_str,
                        "size_bytes": size_bytes,
                        "is_dir": is_dir,
                        "is_video": is_real_video,
                    })
        except Exception as e:
            error_str = str(e)
            print(f"Quark real parse error: {error_str}")
            if "密码" in error_str or "提取码" in error_str:
                error_msg = "该分享链接需要提取码，请选择带提取码的链接"
            elif "404" in error_str or "失效" in error_str or "取消" in error_str:
                error_msg = "该夸克分享链接已失效或已被取消"
            else:
                error_msg = f"网盘解析异常: {error_str}"
    else:
        error_msg = "未找到有效的夸克 pan.quark.cn 分享链接"

    parsed_file_names = [f["name"] for f in files]
    inferred_type = infer_media_type(share_title or url, file_names=parsed_file_names)

    return {
        "status": "error" if (not files and error_msg) else "success",
        "error_msg": error_msg,
        "share_url": clean_quark_url or url,
        "pdir_fid": pdir_fid,
        "title": share_title,
        "files": files,
        "total_files": len(files),
        "auto_drilled": auto_drilled,
        "auto_drilled_name": auto_drilled_name,
        "inferred_type": inferred_type,
        "inferred_type_label": "🎬 电影" if inferred_type == "movie" else "📺 电视剧",
    }


# -------------------------------------------------------------
# 目录树接口，默认起点为 BASE_NAS_DIR
# -------------------------------------------------------------
@app.get("/api/fs/ls")
def list_nas_directory(path: str = Query(BASE_NAS_DIR, description="物理路径")):
    target_path = os.path.abspath(path)
    base_path = os.path.abspath(BASE_NAS_DIR)

    # 安全沙箱约束：禁止跨出媒体目录
    if not target_path.startswith(base_path):
        target_path = base_path
    
    # 物理路径兜底及创建
    if not os.path.exists(target_path):
        try:
            os.makedirs(target_path, exist_ok=True)
        except Exception:
            target_path = base_path

    folders = []
    try:
        entries = os.listdir(target_path)
        for entry in sorted(entries):
            if entry.startswith(".") or entry.startswith("@"):
                continue
            full_item = os.path.join(target_path, entry)
            if os.path.isdir(full_item):
                folders.append({"name": entry, "path": full_item})
    except Exception as e:
        print(f"Error reading directory: {e}")

    parent_path = os.path.dirname(target_path) if target_path != base_path else None

    return {
        "current_path": target_path,
        "parent_path": parent_path,
        "folders": folders,
    }


class MkdirReq(BaseModel):
    path: str
    folder_name: str

@app.post("/api/fs/mkdir")
def create_nas_directory(req: MkdirReq):
    base_path = os.path.abspath(BASE_NAS_DIR)
    if not req.folder_name or not req.folder_name.strip():
        target_dir = os.path.abspath(req.path)
    else:
        target_dir = os.path.abspath(os.path.join(req.path, req.folder_name.strip()))
    
    # 安全沙箱约束：禁止在媒体库以外创建目录
    if not target_dir.startswith(base_path):
        raise HTTPException(status_code=403, detail="越权受限：禁止在媒体库以外创建目录")

    try:
        os.makedirs(target_dir, exist_ok=True)
        return {"status": "success", "new_path": target_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def clean_name_for_match(name: str) -> str:
    cleaned = re.sub(r"\([^)]*\)|\[[^\]]*\]|【[^】]*】", "", name)
    cleaned = re.sub(r"\b(19\d\d|20\d\d)\b", "", cleaned)
    cleaned = re.sub(r"[^\w\u4e00-\u9fa5]", "", cleaned).strip().lower()
    return cleaned


@app.get("/api/fs/sniff")
async def sniff_and_route(
    title: str = Query(..., description="影视名称"),
    year: Optional[str] = Query("", description="发行年份"),
    media_type: Optional[str] = Query("", description="类型(movie/tv)")
):
    for d in [BASE_NAS_DIR, MOVIES_ROOT, TV_ROOT]:
        if not os.path.exists(d):
            try:
                os.makedirs(d, exist_ok=True)
            except Exception:
                pass

    title_clean = title.strip()
    year_clean = year.strip() if year else ""
    type_lower = (media_type or "").lower()

    tags_list = []
    try:
        cached_meta = DOUBAN_CACHE.get(title_clean.lower())
        if cached_meta and cached_meta[0]:
            tags_list = cached_meta[0].get("tags", [])
    except Exception:
        pass

    inferred_type = infer_media_type(title_clean, tags=tags_list)

    is_movie = False
    if "movie" in type_lower or "电影" in type_lower:
        is_movie = True
    elif "tv" in type_lower or "电视剧" in type_lower or "剧集" in type_lower or "动漫" in type_lower or "综艺" in type_lower:
        is_movie = False
    else:
        is_movie = (inferred_type == "movie")

    if is_movie:
        return {
            "status": "success",
            "mode": "movie_direct",
            "type": "movie",
            "target_path": MOVIES_ROOT,
            "display_path": "../Movies/电影",
            "need_mkdir": False,
            "folder_name": "",
            "message": "🎬 电影模式：直接归档至 ../Movies/电影",
            "recommend_title": "🎬 电影模式：直接归档至 ../Movies/电影",
        }

    # 电视剧模式：遍历电视剧根目录现有的文件夹名称
    existing_folders = []
    try:
        if os.path.exists(TV_ROOT):
            existing_folders = [f for f in os.listdir(TV_ROOT) if os.path.isdir(os.path.join(TV_ROOT, f))]
    except Exception as e:
        print(f"Read TV dir exception: {e}")

    cleaned_search_title = clean_name_for_match(title_clean)
    matched_folder = None

    for folder in existing_folders:
        folder_clean = clean_name_for_match(folder)
        if cleaned_search_title and folder_clean:
            if cleaned_search_title == folder_clean:
                matched_folder = folder
                break
            if len(cleaned_search_title) >= 2 and (cleaned_search_title in folder_clean or folder_clean in cleaned_search_title):
                matched_folder = folder
                break

    if matched_folder:
        matched_full_path = os.path.join(TV_ROOT, matched_folder)
        return {
            "status": "success",
            "mode": "existing_tv",
            "type": "tv",
            "target_path": matched_full_path,
            "base_nas_path": matched_full_path,
            "display_path": f"../电视剧/{matched_folder}/",
            "need_mkdir": False,
            "matched_folder": matched_folder,
            "folder_name": "",
            "message": f"🔄 发现本地已有该剧，将直接下载至 ../电视剧/{matched_folder}/",
            "recommend_title": f"🔄 发现本地已有该剧，将直接下载至 ../电视剧/{matched_folder}/",
        }
    else:
        if year_clean and year_clean not in title_clean:
            suggest_name = f"{title_clean} ({year_clean})"
        else:
            suggest_name = title_clean

        full_rec_path = os.path.join(TV_ROOT, suggest_name)
        return {
            "status": "success",
            "mode": "new_tv",
            "type": "tv",
            "target_path": TV_ROOT,
            "base_nas_path": TV_ROOT,
            "suggest_folder_name": suggest_name,
            "full_recommend_path": full_rec_path,
            "display_path": f"../电视剧/{suggest_name}/",
            "need_mkdir": True,
            "folder_name": suggest_name,
            "message": f"🆕 新剧建档：将自动创建 ../电视剧/{suggest_name}/ 文件夹",
            "recommend_title": f"🆕 新剧建档：将自动创建 ../电视剧/{suggest_name}/ 文件夹",
        }


class QuarkFileMetadata(BaseModel):
    id: str
    name: str
    custom_name: Optional[str] = ""
    size: Optional[str] = ""
    is_dir: Optional[bool] = False
    is_video: Optional[bool] = False

class DownloadSubmitReq(BaseModel):
    target_path: str
    folder_name: Optional[str] = ""
    file_ids: List[str]
    files_metadata: Optional[List[QuarkFileMetadata]] = None
    resource_title: Optional[str] = ""
    share_url: Optional[str] = ""
    password: Optional[str] = ""
    pdir_fid: Optional[str] = "0"

@app.post("/api/download/submit")
async def submit_download_job(req: DownloadSubmitReq):
    final_path = os.path.abspath(req.target_path)
    if req.folder_name and req.folder_name.strip():
        final_path = os.path.abspath(os.path.join(req.target_path, req.folder_name.strip()))

    os.makedirs(final_path, exist_ok=True)

    target_names = []
    file_rename_map = {}
    if req.files_metadata:
        for fm in req.files_metadata:
            if fm.id in req.file_ids or not req.file_ids:
                target_names.append(fm.name)
                if fm.custom_name and fm.custom_name.strip():
                    file_rename_map[fm.name] = fm.custom_name.strip()

    task_id = f"task_{int(time.time() * 1000)}"
    file_count = len(target_names) if target_names else len(req.file_ids)

    # 从前端提交的元数据中粗略计算初始总大小
    total_bytes_est = 0
    if req.files_metadata:
        for fm in req.files_metadata:
            if fm.id in req.file_ids or not req.file_ids:
                s_str = (fm.size or "").upper()
                if "GB" in s_str:
                    try: total_bytes_est += float(re.search(r"[\d\.]+", s_str).group()) * 1024 * 1024 * 1024
                    except: pass
                elif "MB" in s_str:
                    try: total_bytes_est += float(re.search(r"[\d\.]+", s_str).group()) * 1024 * 1024
                    except: pass
                elif "KB" in s_str:
                    try: total_bytes_est += float(re.search(r"[\d\.]+", s_str).group()) * 1024
                    except: pass

    if total_bytes_est > 1024 * 1024 * 1024:
        initial_size_str = f"{total_bytes_est / (1024*1024*1024):.2f} GB"
    elif total_bytes_est > 0:
        initial_size_str = f"{total_bytes_est / (1024*1024):.1f} MB"
    else:
        initial_size_str = "计算中..."

    task_item = {
        "id": task_id,
        "title": req.resource_title or req.folder_name or "影视归档",
        "filesCount": max(file_count, 1),
        "targetPath": final_path,
        "targetNames": target_names,
        "shareUrl": req.share_url or "",
        "status": "downloading",
        "progress": 5,
        "size": initial_size_str,
        "speed": "",
        "eta": "",
        "message": "⏳ 正在建立连接...",
        "startTime": time.strftime("%H:%M:%S"),
        "created_at": time.time()
    }

    REAL_DOWNLOAD_TASKS.insert(0, task_item)
    save_download_tasks(REAL_DOWNLOAD_TASKS)

    # 异步拉起全自动物理下钻下载线程(包含自动转存+AList强刷+直链落盘)
    import threading
    t = threading.Thread(
        target=execute_physical_download_task,
        args=(task_id, final_path, target_names, req.resource_title or "", req.share_url or "", req.password or "", file_rename_map)
    )
    t.daemon = True
    t.start()

    return {
        "status": "success",
        "task_id": task_id,
        "final_path": final_path,
        "task_item": task_item,
        "message": f"目录建档成功，自动下钻流已启动: {final_path}"
    }

@app.get("/api/download/tasks")
async def get_download_tasks():
    return {
        "status": "success",
        "tasks": REAL_DOWNLOAD_TASKS
    }

class TaskCancelReq(BaseModel):
    task_id: str

@app.post("/api/download/cancel")
async def cancel_download_task(req: TaskCancelReq):
    global REAL_DOWNLOAD_TASKS
    REAL_DOWNLOAD_TASKS = [t for t in REAL_DOWNLOAD_TASKS if t.get("id") != req.task_id]
    save_download_tasks(REAL_DOWNLOAD_TASKS)
    return {"status": "success", "message": "已取消"}


@app.get("/api/notifications")
def get_notifications():
    return {"notifications": []}


class AIRecommendReq(BaseModel):
    query: str
    candidates: List[Dict[str, Any]]
    media_meta: Optional[Dict[str, Any]] = None
    local_nas_status: Optional[Dict[str, Any]] = None


class AIDiffReq(BaseModel):
    remote_files: List[Dict[str, Any]]
    local_episodes: List[int]
    target_season: Optional[int] = None


@app.post("/api/ai/recommend")
async def ai_recommend_resource(req: AIRecommendReq):
    nas_status = req.local_nas_status or {}
    if req.media_meta and req.media_meta.get("title"):
        t_clean = clean_name_for_match(req.media_meta.get("title"))
        if os.path.exists(TV_ROOT):
            try:
                for f in os.listdir(TV_ROOT):
                    if clean_name_for_match(f) == t_clean or (len(t_clean) >= 2 and t_clean in clean_name_for_match(f)):
                        full_tv_p = os.path.join(TV_ROOT, f)
                        local_eps = []
                        for root, _, files in os.walk(full_tv_p):
                            for file_name in files:
                                ep = extract_episode_num(file_name)
                                if ep is not None:
                                    local_eps.append(ep)
                        nas_status["existing_tv_folder"] = f
                        nas_status["local_episodes"] = sorted(list(set(local_eps)))
                        break
            except Exception as e:
                print(f"Scan TV dir exception: {e}")

    res = await call_gemini_smart_recommend(
        query=req.query,
        candidates=req.candidates,
        media_meta=req.media_meta,
        local_existing_info=nas_status
    )

    # 🎯 物理数据实时校准：秒级探测网盘真实正片大小与画质，彻底解决外面预估与里面真实不一致
    try:
        def _calibrate_real_sizes(recommend_data: dict, all_candidates: list):
            cookie_file = os.path.join(os.path.dirname(__file__), "quark_cookie.txt")
            if not os.path.exists(cookie_file):
                return
            with open(cookie_file, "r", encoding="utf-8") as f:
                cookie = f.read().strip()
            if not cookie:
                return

            headers = {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Content-Type': 'application/json',
                'Referer': 'https://pan.quark.cn/'
            }

            def _probe_url(share_url: str):
                if not share_url or 'pan.quark.cn' not in share_url:
                    return None, None, None
                try:
                    m = re.search(r'/s/([a-zA-Z0-9]+)', share_url)
                    if not m:
                        return None, None, None
                    pwd_id = m.group(1)
                    req1 = urllib.request.Request(
                        'https://pan.quark.cn/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc',
                        data=json.dumps({'pwd_id': pwd_id, 'passcode': ''}).encode('utf-8'),
                        headers=headers
                    )
                    with urllib.request.urlopen(req1, timeout=3.5) as r:
                        stoken = json.loads(r.read().decode('utf-8')).get('data', {}).get('stoken')
                    if not stoken:
                        return None, None, None

                    def _get_items(fid='0'):
                        url_d = f'https://drive-pc.quark.cn/1/clouddrive/share/sharepage/detail?pr=ucpro&fr=pc&pwd_id={pwd_id}&stoken={urllib.parse.quote(stoken)}&pdir_fid={fid}&_size=50'
                        with urllib.request.urlopen(urllib.request.Request(url_d, headers=headers), timeout=3.5) as r:
                            return json.loads(r.read().decode('utf-8')).get('data', {}).get('list', [])

                    items = _get_items('0')
                    if len(items) == 1 and items[0].get('dir'):
                        items = _get_items(items[0].get('fid'))
                    if len(items) == 1 and items[0].get('dir'):
                        items = _get_items(items[0].get('fid'))

                    videos = [f for f in items if not f.get('dir') and any(f.get('file_name', '').lower().endswith(ext) for ext in ['.mkv', '.mp4', '.ts', '.iso', '.avi', '.mov', '.flv'])]
                    if videos:
                        videos.sort(key=lambda x: x.get('size', 0), reverse=True)
                        top = videos[0]
                        sz_bytes = top.get('size', 0)
                        fn = top.get('file_name', '')
                        inferred_res = '4K 臻彩' if (re.search(r'2160p|4k|uhd', fn, re.I) or sz_bytes >= 10*1024*1024*1024) else '1080P 高清'
                        sz_str = f"{sz_bytes / (1024*1024*1024):.2f} GB" if sz_bytes > 1024*1024*1024 else f"{sz_bytes / (1024*1024):.1f} MB"
                        return sz_str, inferred_res, fn
                except Exception:
                    pass
                return None, None, None

            # 探测当前首选资源
            raw_c = recommend_data.get("raw_candidate")
            if raw_c and raw_c.get("link"):
                s_sz, s_res, s_fn = _probe_url(raw_c.get("link"))
                if s_sz:
                    recommend_data["estimated_size"] = s_sz
                    if s_res:
                        recommend_data["resolution"] = s_res

            # 同步探测并修正 recommended_tiers 各档位
            tiers_list = recommend_data.get("recommended_tiers") or []
            for t in tiers_list:
                cand = next((c for c in all_candidates if c.get("id") == t.get("id")), None)
                if cand and cand.get("link"):
                    t_sz, t_res, _ = _probe_url(cand.get("link"))
                    if t_sz:
                        t["estimated_size"] = t_sz
                        if t_res:
                            t["resolution"] = t_res

        await asyncio.to_thread(_calibrate_real_sizes, res, req.candidates)
    except Exception as cal_err:
        print(f"Calibration error: {cal_err}")

    return res


@app.post("/api/ai/diff_episodes")
async def ai_diff_episodes_route(req: AIDiffReq):
    return diff_tv_episodes(req.remote_files, req.local_episodes, req.target_season)


@app.get("/api/ai/curate")
async def ai_natural_curate_route(q: str):
    if not q or not q.strip():
        return {"intent_summary": "", "curated_list": []}
    res = await call_gemini_natural_curate(q.strip())
    if not res:
        return {"intent_summary": "", "curated_list": []}
    return res


# ==================== Phase 4: 追剧订阅与智能增量追更系统 ====================
SUBSCRIPTIONS_FILE = os.path.join(os.path.dirname(__file__), "subscriptions.json")

def load_subscriptions():
    if os.path.exists(SUBSCRIPTIONS_FILE):
        try:
            with open(SUBSCRIPTIONS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_subscriptions(subs):
    try:
        with open(SUBSCRIPTIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(subs, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving subscriptions: {e}")

def get_local_show_episodes(folder_path: str) -> List[int]:
    eps = []
    if os.path.exists(folder_path) and os.path.isdir(folder_path):
        for root, _, files in os.walk(folder_path):
            for fn in files:
                ep = extract_episode_num(fn)
                if ep is not None:
                    eps.append(ep)
    return sorted(list(set(eps)))

class AddSubscriptionReq(BaseModel):
    title: str
    year: Optional[str] = ""
    folder_path: Optional[str] = ""
    share_url: str
    password: Optional[str] = ""
    pdir_fid: Optional[str] = "0"
    res_preference: Optional[str] = "4K"

class DelSubscriptionReq(BaseModel):
    id: str

@app.get("/api/subscriptions")
async def get_subscriptions_route():
    subs = load_subscriptions()
    updated = False
    for item in subs:
        p = item.get("folder_path", "")
        if p and os.path.exists(p):
            curr_eps = get_local_show_episodes(p)
            if curr_eps != item.get("local_episodes", []):
                item["local_episodes"] = curr_eps
                item["total_local"] = len(curr_eps)
                updated = True
    if updated:
        save_subscriptions(subs)
    return {"status": "success", "subscriptions": subs}

@app.post("/api/subscriptions/add")
async def add_subscription_route(req: AddSubscriptionReq):
    subs = load_subscriptions()
    existing = next((s for s in subs if s.get("share_url") == req.share_url or s.get("title") == req.title), None)
    
    target_p = req.folder_path
    if not target_p:
        folder_name = f"{req.title} ({req.year})" if req.year else req.title
        target_p = os.path.join(TV_ROOT, folder_name)
    
    os.makedirs(target_p, exist_ok=True)
    local_eps = get_local_show_episodes(target_p)
    
    sub_id = f"sub_{int(time.time() * 1000)}"
    if existing:
        existing.update({
            "title": req.title,
            "year": req.year or existing.get("year", ""),
            "folder_path": target_p,
            "share_url": req.share_url,
            "password": req.password or existing.get("password", ""),
            "pdir_fid": req.pdir_fid or "0",
            "res_preference": req.res_preference or "4K",
            "local_episodes": local_eps,
            "total_local": len(local_eps),
            "updated_at": datetime.now().isoformat(),
        })
        save_subscriptions(subs)
        return {"status": "success", "message": "订阅已更新", "subscription": existing}
    
    new_sub = {
        "id": sub_id,
        "title": req.title,
        "year": req.year or "",
        "folder_path": target_p,
        "share_url": req.share_url,
        "password": req.password or "",
        "pdir_fid": req.pdir_fid or "0",
        "res_preference": req.res_preference or "4K",
        "local_episodes": local_eps,
        "total_local": len(local_eps),
        "remote_episodes": [],
        "missing_episodes": [],
        "status": "up_to_date",
        "last_checked_at": datetime.now().isoformat(),
        "created_at": datetime.now().isoformat(),
    }
    subs.insert(0, new_sub)
    save_subscriptions(subs)
    return {"status": "success", "message": "订阅成功加入追更清单", "subscription": new_sub}

@app.post("/api/subscriptions/delete")
async def delete_subscription_route(req: DelSubscriptionReq):
    subs = load_subscriptions()
    subs = [s for s in subs if s.get("id") != req.id]
    save_subscriptions(subs)
    return {"status": "success"}

@app.get("/api/fs/local_tv_shows")
async def get_local_tv_shows():
    shows = []
    if os.path.exists(TV_ROOT):
        for f in os.listdir(TV_ROOT):
            full_p = os.path.join(TV_ROOT, f)
            if os.path.isdir(full_p):
                eps = get_local_show_episodes(full_p)
                clean_t = re.sub(r"[\(（].*?[\)）]", "", f).strip()
                shows.append({
                    "title": clean_t or f,
                    "folder_name": f,
                    "folder_path": full_p,
                    "episodes": eps,
                    "total_episodes": len(eps),
                })
    shows.sort(key=lambda x: x["folder_name"])
    return {"status": "success", "shows": shows}

class QuarkCookieReq(BaseModel):
    cookie: str

COOKIE_FILE = os.path.join(os.path.dirname(__file__), "quark_cookie.txt")
DEFAULT_QUARK_COOKIE = os.environ.get("QUARK_COOKIE", "")

def load_saved_quark_cookie():
    if os.path.exists(COOKIE_FILE):
        try:
            with open(COOKIE_FILE, "r", encoding="utf-8") as f:
                c = f.read().strip()
                if c:
                    return c
        except Exception:
            pass
    return DEFAULT_QUARK_COOKIE

QUARK_COOKIE_STORE = load_saved_quark_cookie()

def save_saved_quark_cookie(cookie_str: str):
    try:
        with open(COOKIE_FILE, "w", encoding="utf-8") as f:
            f.write(cookie_str.strip())
    except Exception as e:
        print(f"Save cookie error: {e}")

@app.post("/api/quark_cookie")
def update_quark_cookie(req: QuarkCookieReq):
    global QUARK_COOKIE_STORE
    c_str = req.cookie.strip()
    QUARK_COOKIE_STORE = c_str
    save_saved_quark_cookie(c_str)
    # 同步更新 AList 中的夸克驱动 Cookie (若配置了 AList 凭据)
    if ALIST_USER and ALIST_PASS:
        try:
            a_login = httpx.post(f'{ALIST_URL}/api/auth/login', json={'username': ALIST_USER, 'password': ALIST_PASS}, trust_env=False)
            tok = a_login.json().get('data', {}).get('token')
            if tok:
                headers = {'Authorization': tok}
                st_detail = httpx.get(f'{ALIST_URL}/api/admin/storage/get?id=2', headers=headers, trust_env=False).json().get('data', {})
                if st_detail:
                    add_dict = json.loads(st_detail.get('addition', '{}'))
                    add_dict['cookie'] = c_str
                    st_detail['addition'] = json.dumps(add_dict)
                    httpx.post(f'{ALIST_URL}/api/admin/storage/update', json=st_detail, headers=headers, trust_env=False)
        except Exception as e:
            print("Sync cookie to AList exception:", e)

    return {
        "status": "success",
        "message": "夸克 Cookie 已更新并同步给 AList",
        "length": len(c_str),
    }


def auto_save_quark_share_to_cache(share_url: str, password: str = "") -> bool:
    """全自动将 Pansou 夸克第三方分享链接转存到网盘 Seeker_Cache 目录中
    注意：夸克转存是异步任务，本函数会轮询等待任务真正完成后再返回。
    """
    if not share_url:
        return False
    match = re.search(r'/s/([a-zA-Z0-9]+)', share_url)
    if not match:
        return False
    pwd_id = match.group(1)

    headers = {
        'Cookie': QUARK_COOKIE_STORE.strip(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Referer': 'https://pan.quark.cn/',
        'Origin': 'https://pan.quark.cn'
    }

    for key in ['http_proxy', 'https_proxy', 'all_proxy', 'ALL_PROXY', 'HTTP_PROXY', 'HTTPS_PROXY']:
        os.environ.pop(key, None)

    try:
        # 1. 获取 stoken
        r1 = httpx.post(
            'https://pan.quark.cn/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc',
            json={'pwd_id': pwd_id, 'passcode': password or ''},
            headers=headers, timeout=10.0, trust_env=False
        )
        stoken = r1.json().get('data', {}).get('stoken')
        if not stoken:
            print(f"[Auto Saver] ❌ 获取 Quark stoken 失败 (pwd_id={pwd_id}): {r1.text[:200]}")
            return False

        # 2. 获取分享详情文件列表（支持多页全量拉取）
        stoken_encoded = urllib.parse.quote(stoken)
        url_detail = f'https://pan.quark.cn/1/clouddrive/share/sharepage/detail?pr=ucpro&fr=pc&pwd_id={pwd_id}&stoken={stoken_encoded}&pdir_fid=0&_size=500&_fetch_total=1'
        r2 = httpx.get(url_detail, headers=headers, timeout=10.0, trust_env=False)
        r2_json = r2.json()
        share_files = r2_json.get('data', {}).get('list', [])
        total_files_count = r2_json.get('data', {}).get('total', 0)

        cur_page = 1
        while len(share_files) < total_files_count:
            cur_page += 1
            next_url = f'https://pan.quark.cn/1/clouddrive/share/sharepage/detail?pr=ucpro&fr=pc&pwd_id={pwd_id}&stoken={stoken_encoded}&pdir_fid=0&_size=500&_page={cur_page}'
            r_next = httpx.get(next_url, headers=headers, timeout=10.0, trust_env=False)
            next_list = r_next.json().get('data', {}).get('list', [])
            if not next_list:
                break
            share_files.extend(next_list)

        if not share_files:
            print(f"[Auto Saver] ❌ 分享链接文件列表为空 (pwd_id={pwd_id})")
            return False

        fid_list = [f.get('fid') for f in share_files if f.get('fid')]
        fid_token_list = [f.get('share_fid_token') for f in share_files if f.get('share_fid_token')]
        print(f"[Auto Saver] 获取到 {len(fid_list)} 个文件，准备转存至 Seeker_Cache")

        # 3. 获取 Seeker_Cache 的 fid
        r3 = httpx.get(
            'https://drive-pc.quark.cn/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=0&_size=100',
            headers=headers, timeout=10.0, trust_env=False
        )
        cache_fid = "0"
        for item in r3.json().get('data', {}).get('list', []):
            if item.get('file_name') == 'Seeker_Cache':
                cache_fid = item.get('fid')
                break
        if cache_fid == "0":
            print("[Auto Saver] ⚠️  未找到 Seeker_Cache 目录，将转存到网盘根目录")

        # 4. 提交转存任务（夸克转存是异步任务）
        save_payload = {
            'fid_list': fid_list,
            'fid_token_list': fid_token_list,
            'to_pdir_fid': cache_fid,
            'pwd_id': pwd_id,
            'stoken': stoken
        }
        r4 = httpx.post(
            'https://pan.quark.cn/1/clouddrive/share/sharepage/save?pr=ucpro&fr=pc',
            json=save_payload, headers=headers, timeout=10.0, trust_env=False
        )
        r4_json = r4.json()
        if r4_json.get('code') != 0:
            print(f"[Auto Saver] ❌ 转存请求失败: {r4.text[:300]}")
            return False

        quark_task_id = r4_json.get('data', {}).get('task_id', '')
        print(f"[Auto Saver] 转存任务已提交，task_id={quark_task_id}，等待完成...")

        # 5. 🔑 关键修复：轮询等待夸克异步转存任务完成（最多等 30 秒）
        if quark_task_id:
            for retry_index in range(12):  # 最多轮询 12 次，每次间隔 2.5 秒
                time.sleep(2.5)
                try:
                    r_task = httpx.get(
                        f'https://drive-pc.quark.cn/1/clouddrive/task?pr=ucpro&fr=pc&task_id={quark_task_id}&retry_index={retry_index}',
                        headers=headers, timeout=10.0, trust_env=False
                    )
                    task_data = r_task.json().get('data', {})
                    task_status = task_data.get('status')  # 2=完成
                    print(f"[Auto Saver] 轮询任务状态 [{retry_index+1}/12]: status={task_status}")
                    if task_status == 2:  # 2 = 完成
                        print(f"✅ [Auto Saver] 夸克转存任务完成！(fid: {cache_fid})")
                        return True
                    elif task_status in (0, 1):  # 0=待处理 1=进行中
                        continue  # 继续等待
                    else:
                        print(f"[Auto Saver] ⚠️ 任务异常状态 status={task_status}，停止轮询")
                        break
                except Exception as poll_e:
                    print(f"[Auto Saver] 轮询任务状态异常: {poll_e}")
                    break
            print("[Auto Saver] ⚠️ 等待超时，转存任务可能仍在后台进行")
        else:
            # 没有 task_id 说明可能是同步完成或者老版本接口
            print(f"✅ [Auto Saver] 夸克链接 {pwd_id} 转存响应成功 (无 task_id，视为同步完成)")
            return True

    except Exception as e:
        print(f"[Auto Saver] auto_save_quark_share_to_cache exception: {e}")
    return False


def fetch_all_files_from_alist_recursive(alist_path: str, headers: dict, max_depth: int = 7) -> List[Tuple[str, str, int]]:
    """递归遍历 AList 目录下的所有文件 (包括子文件夹内的文件)"""
    if max_depth <= 0:
        return []
    files = []
    try:
        need_refresh = (max_depth >= 6)
        try:
            res = httpx.post('http://127.0.0.1:5244/api/fs/list', json={'path': alist_path, 'refresh': need_refresh}, headers=headers, timeout=30.0, trust_env=False)
        except Exception as refresh_err:
            print(f"[AList List] 强刷超时或失败 ({refresh_err})，尝试无 refresh 访问...")
            res = httpx.post('http://127.0.0.1:5244/api/fs/list', json={'path': alist_path, 'refresh': False}, headers=headers, timeout=20.0, trust_env=False)

        items = res.json().get('data', {}).get('content') or []
        for it in items:
            name = it.get('name')
            if not name:
                continue
            sub_path = f"{alist_path}/{name}"
            if it.get('is_dir'):
                files.extend(fetch_all_files_from_alist_recursive(sub_path, headers, max_depth - 1))
            else:
                files.append((sub_path, name, it.get('size', 0)))
    except Exception as e:
        print(f"Error recursive listing {alist_path}:", e)
    return files


def execute_physical_download_task(task_id: str, final_path: str, target_names: List[str], resource_title: str, share_url: str = "", password: str = "", file_rename_map: dict = None):
    """全自动控制线程：自动转存夸克链接 -> 自动强刷 AList -> 读取文件直链 -> 分块写入飞牛 NAS 磁盘"""
    last_save_time = [time.time()]  # 控制持久化频率

    def update_task(msg: str, progress: int = -1, status: str = ""):
        """更新 task 状态并控制存盘频率"""
        for task in REAL_DOWNLOAD_TASKS:
            if task.get("id") == task_id:
                task["message"] = msg
                if progress >= 0:
                    task["progress"] = progress
                if status:
                    task["status"] = status
        # 限频存盘：常规更新每 2 秒存一次
        now = time.time()
        if now - last_save_time[0] >= 2.0 or progress in (100, -1):
            save_download_tasks(REAL_DOWNLOAD_TASKS)
            last_save_time[0] = now

    try:
        # 阶段 1：夸克转存 (0% → 20%)
        save_ok = False
        if share_url:
            print(f"[Auto Pipeline] 开始执行全自动夸克转存: {share_url}")
            update_task("☁️ 正在保存至云盘...", 5)
            save_ok = auto_save_quark_share_to_cache(share_url, password)
            if save_ok:
                update_task("☁️ 正在保存至云盘...", 20)
            else:
                update_task("☁️ 正在保存至云盘...", 15)
            time.sleep(3)
        else:
            update_task("⏳ 正在建立连接...", 15)

        # 阶段 2：登录 AList + 强刷 (20% → 30%)
        tok = None
        if ALIST_USER and ALIST_PASS:
            try:
                a_login = httpx.post(f'{ALIST_URL}/api/auth/login', json={'username': ALIST_USER, 'password': ALIST_PASS}, timeout=10.0, trust_env=False)
                if a_login.status_code == 200:
                    tok = a_login.json().get('data', {}).get('token')
            except Exception as e:
                print(f"[Auto Pipeline] AList 登录失败: {e}")
        headers = {'Authorization': tok} if tok else {}

        cache_path = os.environ.get("ALIST_CACHE_PATH", "/夸克网盘/Seeker_Cache")
        print(f"[Auto Pipeline] 触发 AList 强刷: {cache_path}")
        update_task("🔄 正在同步云端列表...", 22)
        try:
            httpx.post(
                f'{ALIST_URL}/api/fs/list',
                json={'path': cache_path, 'refresh': True},
                headers=headers, trust_env=False, timeout=45.0
            )
        except Exception as ref_err:
            print(f"[Auto Pipeline] ⚠️ AList 强刷超时/异常 (已忽略并继续扫描缓存): {ref_err}")

        time.sleep(3)
        update_task("🔍 正在检索文件...", 28)

        # 阶段 3：扫描匹配 (30% → 35%)
        print(f"[Auto Pipeline] 开始对 AList 目录 [{cache_path}] 进行无限深度递归扫描...")
        all_cache_files = fetch_all_files_from_alist_recursive(cache_path, headers, max_depth=7)
        print(f"[Auto Pipeline] Seeker_Cache 共扫描到 {len(all_cache_files)} 个文件")

        download_targets = []
        if target_names and all_cache_files:
            # 1. 精确匹配
            matched_exact = [(p, n, s) for p, n, s in all_cache_files if n in target_names]
            if matched_exact:
                download_targets = matched_exact
                print(f"[Auto Pipeline] 精确匹配到 {len(download_targets)} 个选中文件: {target_names}")
            else:
                # 2. 智能模糊与文件夹/路径包含匹配（当 target_names 是文件夹或剧集包名时）
                for p, n, s in all_cache_files:
                    is_video = bool(re.search(r'\.(mkv|mp4|ts|mov|avi|flv|iso|rmvb|wmv)$', n, re.I))
                    if not is_video:
                        continue
                    for t_name in target_names:
                        n_stem = re.sub(r'\.[^.]+$', '', n).strip()
                        t_stem = re.sub(r'\.[^.]+$', '', t_name).strip()
                        t_clean = re.sub(r'[\(\)（）\s\[\]【】\-_]', '', t_name).lower()
                        p_clean = re.sub(r'[\(\)（）\s\[\]【】\-_]', '', p).lower()
                        n_clean = re.sub(r'[\(\)（）\s\[\]【】\-_]', '', n).lower()

                        if (
                            (t_stem and (t_stem in n_stem or n_stem in t_stem)) or
                            (t_name in p or t_clean in p_clean or t_name in n or t_clean in n_clean or n in t_name)
                        ):
                            if (p, n, s) not in download_targets:
                                download_targets.append((p, n, s))
                print(f"[Auto Pipeline] 路径/文件夹模糊匹配到 {len(download_targets)} 个视频文件 (target_names={target_names})")
        else:
            download_targets = []
            print(f"[Auto Pipeline] ⚠️ 未提供 target_names，跳过下载")

        # 3. 兜底：如果依然未匹配到，且资源标题/片名在路径中，全量捕获该目录下的所有视频文件
        if not download_targets and all_cache_files:
            clean_res_title = re.sub(r'[\(\)（）\s\[\]【】\-_]', '', resource_title or "").lower()
            for p, n, s in all_cache_files:
                is_video = bool(re.search(r'\.(mkv|mp4|ts|mov|avi|flv|iso|rmvb|wmv)$', n, re.I))
                if is_video and clean_res_title and len(clean_res_title) >= 2:
                    p_clean = re.sub(r'[\(\)（）\s\[\]【】\-_]', '', p).lower()
                    if clean_res_title in p_clean:
                        if (p, n, s) not in download_targets:
                            download_targets.append((p, n, s))
            if download_targets:
                print(f"[Auto Pipeline] 资源标题兜底匹配到 {len(download_targets)} 个视频文件")

        # 目标文件根据另存为文件名 save_name 进行严格去重，彻底解决重复下载两遍的问题！
        unique_targets = []
        seen_save_names = set()
        for p, n, s in download_targets:
            s_name = file_rename_map.get(n, n) if file_rename_map else n
            if s_name not in seen_save_names:
                seen_save_names.add(s_name)
                unique_targets.append((p, n, s))
        download_targets = unique_targets

        # 阶段 4：流式写盘 (35% → 99%)
        if download_targets:
            total_items = len(download_targets)
            
            # 计算精确的匹配物理总大小并同步更新到 task["size"]
            total_size_bytes = sum(s for _, _, s in download_targets if s > 0)
            if total_size_bytes > 1024 * 1024 * 1024:
                calc_size_str = f"{total_size_bytes / (1024*1024*1024):.2f} GB"
            elif total_size_bytes > 0:
                calc_size_str = f"{total_size_bytes / (1024*1024):.1f} MB"
            else:
                calc_size_str = ""

            for task in REAL_DOWNLOAD_TASKS:
                if task.get("id") == task_id:
                    if calc_size_str:
                        task["size"] = calc_size_str
                    task["filesCount"] = total_items

            print(f"[Auto Pipeline] 捕获到 {total_items} 个去重后的文件 (总计 {calc_size_str})，开始写入 NAS...")

            # 整体下载进度与速度采样统计
            total_downloaded_all_files = 0
            speed_sample_time = time.time()
            speed_sample_bytes = 0
            current_speed_str = ""
            current_eta_str = ""

            for idx, (alist_file_path, file_name, file_size) in enumerate(download_targets):
                save_name = file_rename_map.get(file_name, file_name) if file_rename_map else file_name
                save_file_path = os.path.join(final_path, save_name)

                # 防重复写盘：若文件已完整落盘存在且大小一致，直接完成跳过
                if os.path.exists(save_file_path) and file_size > 0 and os.path.getsize(save_file_path) == file_size:
                    print(f"[Auto Pipeline] 文件已完整存在，跳过写盘: {save_file_path}")
                    total_downloaded_all_files += file_size
                    done_pct = int(35 + ((idx + 1) / total_items) * 64)
                    update_task(f"⏭️ 本地已存在，已跳过 ({idx+1}/{total_items})", min(done_pct, 99))
                    continue

                # 获取直链
                raw_url = None
                try:
                    f_detail = httpx.post('http://127.0.0.1:5244/api/fs/get', json={'path': alist_file_path}, headers=headers, trust_env=False, timeout=25.0)
                    raw_data = f_detail.json().get('data', {})
                    raw_url = raw_data.get('raw_url') or raw_data.get('url')
                except Exception as get_err:
                    print(f"[Auto Pipeline] 获取直链失败/超时 ({alist_file_path}): {get_err}")

                if raw_url:
                    update_task(f"🔗 准备下载 ({idx+1}/{total_items}): {save_name}", int(35 + (idx / total_items) * 64))
                    with httpx.stream('GET', raw_url, headers={'User-Agent': 'netdisk'}, follow_redirects=True, trust_env=False, timeout=None) as response:
                        response.raise_for_status()
                        content_length = int(response.headers.get('content-length', 0))
                        actual_size = file_size if file_size > 0 else content_length

                        file_downloaded = 0
                        with open(save_file_path, 'wb') as f:
                            for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                                if chunk:
                                    f.write(chunk)
                                    chunk_len = len(chunk)
                                    file_downloaded += chunk_len
                                    total_downloaded_all_files += chunk_len
                                    
                                    # 采样计算瞬时下载速度和倒计时
                                    now = time.time()
                                    sample_dt = now - speed_sample_time
                                    if sample_dt >= 0.8:
                                        d_bytes = total_downloaded_all_files - speed_sample_bytes
                                        speed_bps = d_bytes / sample_dt
                                        speed_sample_bytes = total_downloaded_all_files
                                        speed_sample_time = now

                                        if speed_bps >= 1024 * 1024:
                                            current_speed_str = f"{speed_bps / (1024 * 1024):.1f} MB/s"
                                        elif speed_bps >= 1024:
                                            current_speed_str = f"{speed_bps / 1024:.0f} KB/s"
                                        else:
                                            current_speed_str = f"{int(speed_bps)} B/s"

                                        rem_bytes = max(0, total_size_bytes - total_downloaded_all_files)
                                        if speed_bps > 1024 and rem_bytes > 0:
                                            eta_sec = int(rem_bytes / speed_bps)
                                            if eta_sec < 60:
                                                current_eta_str = f"剩余 {eta_sec}秒"
                                            elif eta_sec < 3600:
                                                m = eta_sec // 60
                                                s = eta_sec % 60
                                                current_eta_str = f"剩余 {m}分{s:02d}秒"
                                            else:
                                                h = eta_sec // 3600
                                                m = (eta_sec % 3600) // 60
                                                current_eta_str = f"剩余 {h}小时{m}分"
                                        else:
                                            current_eta_str = ""

                                    # 针对多文件/单文件精确计算总体百分比 (35% ~ 99%)
                                    file_pct = (file_downloaded / actual_size) if actual_size > 0 else 0.5
                                    overall_pct = int(35 + ((idx + file_pct) / total_items) * 64)

                                    dl_mb_int = int(file_downloaded / 1024 / 1024)
                                    total_mb_int = int(actual_size / 1024 / 1024) if actual_size > 0 else 0

                                    for task in REAL_DOWNLOAD_TASKS:
                                        if task.get("id") == task_id:
                                            task["progress"] = min(overall_pct, 99)
                                            task["status"] = "downloading"
                                            task["speed"] = current_speed_str
                                            task["eta"] = current_eta_str
                                            if total_mb_int > 0:
                                                task["message"] = f"⬇️ 下载中 ({idx+1}/{total_items}): {dl_mb_int}MB / {total_mb_int}MB"
                                            else:
                                                task["message"] = f"⬇️ 下载中 ({idx+1}/{total_items}): {dl_mb_int}MB"

                                    # 每 2 秒持久化一次进度
                                    if now - last_save_time[0] >= 2.0:
                                        save_download_tasks(REAL_DOWNLOAD_TASKS)
                                        last_save_time[0] = now

            for task in REAL_DOWNLOAD_TASKS:
                if task.get("id") == task_id:
                    task["speed"] = ""
                    task["eta"] = ""

            update_task(f"✅ 下载完成！(共 {total_items} 个文件)", 100, "completed")
            save_download_tasks(REAL_DOWNLOAD_TASKS)
            save_download_tasks(REAL_DOWNLOAD_TASKS)
        else:
            update_task(f"⚠️ 在 Seeker_Cache 中未匹配到选中文件，请确认夸克分享链接有效。目录已建档: {final_path}", 100, "failed")
            save_download_tasks(REAL_DOWNLOAD_TASKS)

    except Exception as e:
        print("execute_physical_download_task exception:", e)
        for task in REAL_DOWNLOAD_TASKS:
            if task.get("id") == task_id:
                task["speed"] = ""
                task["eta"] = ""
        update_task(f"❌ 下载落盘异常: {e}", -1, "failed")
        save_download_tasks(REAL_DOWNLOAD_TASKS)






# -------------------------------------------------------------
# 真实 UAPI 豆瓣热榜与 30 分钟惰性缓存机制 (Lazy Caching)
# -------------------------------------------------------------
# 豆瓣热榜 (UAPI) 接口与 1 小时 (3600s) 磁盘+内存持久化缓存
# -------------------------------------------------------------
HOTBOARD_CACHE_FILE = "/tmp/seeker_hotboard_cache.json"
HOTBOARD_CACHE_TTL = 3600  # 1 小时 (3600秒，降低外部调用频率，其余时间直读服务器缓存)

def load_disk_cache(filepath, ttl):
    try:
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                cached = json.load(f)
                timestamp = cached.get("timestamp", 0)
                if time.time() - timestamp < ttl:
                    return cached.get("data"), timestamp
                return cached.get("data"), timestamp  # 过期但留存兜底
    except Exception as e:
        print(f"Load disk cache {filepath} error: {e}")
    return None, 0

def save_disk_cache(filepath, data):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump({"timestamp": time.time(), "data": data}, f, ensure_ascii=False)
    except Exception as e:
        print(f"Save disk cache {filepath} error: {e}")

_disk_hotboard, _disk_hotboard_ts = load_disk_cache(HOTBOARD_CACHE_FILE, HOTBOARD_CACHE_TTL)
HOTBOARD_LAZY_CACHE = {
    "data": _disk_hotboard,
    "expiry": _disk_hotboard_ts + HOTBOARD_CACHE_TTL if _disk_hotboard_ts else 0
}

async def enrich_douban_item(idx: int, item: dict, client: httpx.AsyncClient):
    title = item.get("title", "未知影视")
    hot_val = str(item.get("hot_value", "0.0"))
    extra = item.get("extra", {})
    raw_poster = extra.get("poster") or item.get("cover") or ""
    
    if raw_poster:
        cover_url = f"/api/img_proxy?url={raw_poster}"
    else:
        cover_url = ""
        
    score = str(extra.get("score") or hot_val or "8.5")
    ratings_count = extra.get("ratings_count", 0)
    alias = extra.get("alias") or title
    info_str = extra.get("info", "")
    url = item.get("url", "")
    
    # 从 info_str 中拆解属性
    parts = [p.strip() for p in info_str.split("/") if p.strip()]
    pubdate = ""
    duration = ""
    actors = []
    genres = []
    director = ""
    
    genre_candidates = {"喜剧", "动作", "科幻", "剧情", "悬疑", "惊悚", "犯罪", "爱情", "动画", "奇幻", "冒险", "灾难", "武侠", "古装", "历史", "战争", "纪录片"}
    
    for p in parts:
        if re.search(r"\d{4}(-\d{2}-\d{2})?|\d{4}年", p) and not pubdate:
            pubdate = p
        elif ("分钟" in p or "集" in p) and not duration:
            duration = p
        elif p in genre_candidates:
            genres.append(p)
        elif not re.search(r"分钟|集|汉语|英语|普通话|粤语|韩语|日语|中国|美国|韩国|日本|英国|香港|台湾|戛纳|北京|上海|国际电影节|电影节|网络|大陆", p):
            if len(actors) < 6 and len(p) <= 18:
                actors.append(p)
                
    overview = ""
    episodes = ""
    
    # 尝试从移动端豆瓣页面获取真正剧情简介与集数
    subject_id_match = re.search(r"\d+", url)
    if subject_id_match:
        subject_id = subject_id_match.group(0)
        try:
            mobile_headers = {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
                "Referer": "https://m.douban.com/"
            }
            resp = await client.get(f"https://m.douban.com/movie/subject/{subject_id}/", headers=mobile_headers)
            if resp.status_code == 200:
                html = resp.text
                intro_match = re.search(r"class=\"subject-intro\"[^>]*>(.*?)</div>", html, re.DOTALL)
                if intro_match:
                    overview = re.sub(r"<[^>]+>", "", intro_match.group(1)).strip()
                    overview = re.sub(r"^剧情简介\s*", "", overview)
                if not overview:
                    meta_desc = re.search(r"<meta name=\"description\" content=\"([^\"]+)\"", html)
                    if meta_desc:
                        overview = re.sub(r"^.*?简介：", "", meta_desc.group(1).strip())
                        
                episodes_match = re.search(r"集数:?\s*(\d+)", html) or re.search(r"共\s*(\d+)\s*集", html)
                if episodes_match:
                    episodes = f"共 {episodes_match.group(1)} 集"
        except Exception:
            pass

    if not overview:
        overview = f"《{title}》全网热度口碑出众。点击下方按钮即可一键自动搜罗全网夸克网盘资源！"

    actor_str = " / ".join(actors[:4]) if actors else "阵容未公布"
    
    m_dbid = re.search(r'subject/(\d+)', url)
    douban_id = m_dbid.group(1) if m_dbid else str(idx + 1)

    return {
        "id": f"douban_{douban_id}",
        "douban_id": douban_id,
        "index": item.get("index", idx + 1),
        "title": title,
        "original_title": alias or title,
        "hot_value": hot_val,
        "score": score,
        "ratings_count": ratings_count,
        "cover": cover_url,
        "raw_cover": raw_poster,
        "info": info_str,
        "pubdate": pubdate or "近期上映",
        "duration": duration or episodes or "院线全长",
        "episodes": episodes or (duration if "集" in duration else ("共 1 集 (电影)" if "分钟" in duration else "未知集数")),
        "actors": actor_str,
        "director": director or (actors[0] if actors else "知名导演"),
        "genres": genres or ["影音精选"],
        "overview": overview,
        "url": url,
        "source": "douban"
    }


@app.get("/api/hotboard")
async def get_hotboard(type_name: str = Query("douban-movie", alias="type")):
    global HOTBOARD_LAZY_CACHE
    now = time.time()
    
    # 检查 12 小时 (半天) 惰性缓存池是否有效
    if HOTBOARD_LAZY_CACHE["data"] and now < HOTBOARD_LAZY_CACHE["expiry"]:
        return HOTBOARD_LAZY_CACHE["data"]
        
    try:
        url = "https://uapis.cn/api/v1/misc/hotboard"
        async with httpx.AsyncClient(timeout=10.0, trust_env=False, follow_redirects=True) as client:
            resp = await client.get(url, params={"type": "douban-movie"})
            if resp.status_code == 200:
                res_data = resp.json()
                raw_list = res_data.get("list", [])
                
                # 使用 asyncio.gather 并发补全豆瓣简介、演员、集数、时间
                tasks = [enrich_douban_item(idx, item, client) for idx, item in enumerate(raw_list)]
                processed_list = await asyncio.gather(*tasks)
                
                result_payload = {
                    "code": 200,
                    "msg": "success",
                    "type": "douban-movie",
                    "update_time": res_data.get("update_time", ""),
                    "list": processed_list,
                    "data": processed_list,
                }
                
                # 写入 12 小时惰性缓存池并持久化落盘
                HOTBOARD_LAZY_CACHE["data"] = result_payload
                HOTBOARD_LAZY_CACHE["expiry"] = now + HOTBOARD_CACHE_TTL
                save_disk_cache(HOTBOARD_CACHE_FILE, result_payload)
                return result_payload
    except Exception as e:
        print(f"Fetch UAPI hotboard exception: {e}")
        
    # 如果超时降级使用历史过期的本地缓存
    if HOTBOARD_LAZY_CACHE["data"]:
        return HOTBOARD_LAZY_CACHE["data"]
        
    return {
        "code": 500,
        "msg": "UAPI fetch failed",
        "list": [],
        "data": []
    }

# -------------------------------------------------------------
# TMDB 官方 Trending 全球热门接口与 12 小时 (43200s) 磁盘+内存缓存
# -------------------------------------------------------------
TMDB_API_KEY = "4038b900dd77905b548424e58a8f9871"
TMDB_BEARER_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0MDM4YjkwMGRkNzc5MDViNTQ4NDI0ZTU4YThmOTg3MSIsIm5iZiI6MTc3MTQ4MDE4NC41NDMsInN1YiI6IjY5OTZhNDc4MDQyY2M4YzFkOTg0ZmY5ZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.ahZY44ca-jFfrzhynQAvfAogQPgursUZ2UpXUTeoMUQ"

TMDB_TRENDING_CACHE_FILE = "/tmp/seeker_tmdb_trending_cache.json"
TMDB_NOW_PLAYING_CACHE_FILE = "/tmp/seeker_tmdb_now_playing_cache.json"
TMDB_CACHE_TTL = 43200  # 12 小时 (半天)

_disk_trending, _disk_trending_ts = load_disk_cache(TMDB_TRENDING_CACHE_FILE, TMDB_CACHE_TTL)
TMDB_TRENDING_CACHE = {
    "data": _disk_trending,
    "timestamp": _disk_trending_ts
}

_disk_now_playing, _disk_now_playing_ts = load_disk_cache(TMDB_NOW_PLAYING_CACHE_FILE, TMDB_CACHE_TTL)
TMDB_NOW_PLAYING_CACHE = {
    "data": _disk_now_playing,
    "timestamp": _disk_now_playing_ts
}

FALLBACK_GLOBAL_TRENDING = [
    {
        "id": "157336",
        "title": "星际穿越",
        "cover": "/api/img_proxy?url=https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        "score": "9.4",
        "hot_value": "9.4",
        "type": "movie"
    },
    {
        "id": "872585",
        "title": "奥本海默",
        "cover": "/api/img_proxy?url=https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
        "score": "8.9",
        "hot_value": "8.9",
        "type": "movie"
    },
    {
        "id": "19995",
        "title": "阿凡达",
        "cover": "/api/img_proxy?url=https://image.tmdb.org/t/p/w500/kyeqWdyUXW608qlYkR30jF5cRk.jpg",
        "score": "9.1",
        "hot_value": "9.1",
        "type": "movie"
    },
    {
        "id": "299536",
        "title": "复仇者联盟4：终局之战",
        "cover": "/api/img_proxy?url=https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9vKoWRphos.jpg",
        "score": "8.8",
        "hot_value": "8.8",
        "type": "movie"
    },
    {
        "id": "438631",
        "title": "沙丘2",
        "cover": "/api/img_proxy?url=https://image.tmdb.org/t/p/w500/czemJA1sAn2tHAW2BnZ2W27jH62.jpg",
        "score": "8.7",
        "hot_value": "8.7",
        "type": "movie"
    },
    {
        "id": "155",
        "title": "蝙蝠侠：黑暗骑士",
        "cover": "/api/img_proxy?url=https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        "score": "9.2",
        "hot_value": "9.2",
        "type": "movie"
    },
    {
        "id": "76600",
        "title": "阿凡达：水之道",
        "cover": "/api/img_proxy?url=https://image.tmdb.org/t/p/w500/t6HIwfg54Fh6wjo5wVzbo2n9GFi.jpg",
        "score": "8.6",
        "hot_value": "8.6",
        "type": "movie"
    },
    {
        "id": "76341",
        "title": "疯狂的麦克斯：狂暴之路",
        "cover": "/api/img_proxy?url=https://image.tmdb.org/t/p/w500/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg",
        "score": "8.7",
        "hot_value": "8.7",
        "type": "movie"
    },
    {
        "id": "278",
        "title": "肖申克的救赎",
        "cover": "/api/img_proxy?url=https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOZ3p9qFzE.jpg",
        "score": "9.5",
        "hot_value": "9.5",
        "type": "movie"
    },
    {
        "id": "13",
        "title": "阿甘正传",
        "cover": "/api/img_proxy?url=https://image.tmdb.org/t/p/w500/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg",
        "score": "9.0",
        "hot_value": "9.0",
        "type": "movie"
    }
]

TMDB_GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录",
    18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐",
    9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部",
    10759: "动作冒险", 10762: "儿童", 10763: "新闻", 10764: "真人秀",
    10765: "科幻奇幻", 10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
}

CATEGORIES_CACHE_FILE = "/tmp/seeker_10_categories_cache.json"
CATEGORIES_CACHE_TTL = 43200  # 12 小时 (半天缓存)

_disk_categories, _disk_categories_ts = load_disk_cache(CATEGORIES_CACHE_FILE, CATEGORIES_CACHE_TTL)
CATEGORIES_LAZY_CACHE = {
    "data": _disk_categories,
    "expiry": _disk_categories_ts + CATEGORIES_CACHE_TTL if _disk_categories_ts else 0
}

EXPLORE_MEMORY_CACHE = {}
EXPLORE_CACHE_TTL = 21600  # 6 小时缓存

async def fetch_tmdb_list_by_url(url: str, client: httpx.AsyncClient, default_type: str = "movie", limit: int = 30):
    headers = {
        "Authorization": f"Bearer {TMDB_BEARER_TOKEN}",
        "Accept": "application/json"
    }
    try:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            raw_results = resp.json().get("results", [])
            clean_results = [x for x in raw_results if x.get("vote_count", 0) > 3 or x.get("popularity", 0) > 5.0]
            if not clean_results and raw_results:
                clean_results = raw_results
            results = clean_results[:limit]
            
            formatted_list = []
            for idx, item in enumerate(results):
                m_id = item.get("id")
                media_type = item.get("media_type") or default_type
                title = item.get("title") or item.get("name") or item.get("original_title") or "热门影视"
                poster_path = item.get("poster_path")
                cover = f"/api/img_proxy?url={urllib.parse.quote('https://image.tmdb.org/t/p/w500' + poster_path, safe='')}" if poster_path else ""
                backdrop_path = item.get("backdrop_path")
                backdrop = f"/api/img_proxy?url={urllib.parse.quote('https://image.tmdb.org/t/p/w1280' + backdrop_path, safe='')}" if backdrop_path else cover
                
                raw_vote = item.get("vote_average", 0.0)
                try:
                    score_val = f"{round(float(raw_vote), 1):.1f}" if float(raw_vote) > 0 else "7.5"
                except Exception:
                    score_val = "7.5"
                
                # 动态还原 TMDB 官方真实中文分类标签
                genre_ids = item.get("genre_ids", [])
                genres_list = [TMDB_GENRE_MAP[gid] for gid in genre_ids if gid in TMDB_GENRE_MAP]
                if not genres_list:
                    genres_list = ["精选"]
                    
                pubdate_str = item.get("release_date") or item.get("first_air_date") or ""
                year_match = re.search(r"\b(19\d\d|20\d\d)\b", pubdate_str)
                year_str = year_match.group(1) if year_match else ""

                formatted_list.append({
                    "id": str(m_id),
                    "index": idx + 1,
                    "title": title,
                    "original_title": item.get("original_title") or item.get("original_name") or title,
                    "cover": cover,
                    "raw_cover": f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else "",
                    "backdrop": backdrop,
                    "tagline": "",
                    "certification": "PG-13",
                    "imdb_id": "",
                    "score": score_val,
                    "hot_value": score_val,
                    "ratings_count": item.get("vote_count", 1000),
                    "type": media_type,
                    "year": year_str,
                    "pubdate": pubdate_str or "近期上映",
                    "duration": "多集剧集" if media_type == "tv" else "院线全长",
                    "episodes": "多集剧集" if media_type == "tv" else "共 1 集 (电影)",
                    "actors": "知名演员",
                    "cast_with_roles": [],
                    "director": "知名导演",
                    "genres": genres_list,
                    "keywords": genres_list,
                    "overview": item.get("overview") or f"《{title}》全网热映经典作品。",
                    "budget": "暂无数据",
                    "revenue": "暂无数据",
                    "source": "tmdb"
                })
            return formatted_list
    except Exception as e:
        print(f"Fetch TMDB list error {url}: {e}")
    return []

@app.get("/api/library/categories")
async def get_library_categories(force: bool = Query(False)):
    global CATEGORIES_LAZY_CACHE
    now = time.time()
    if not force and CATEGORIES_LAZY_CACHE["data"] and now < CATEGORIES_LAZY_CACHE["expiry"]:
        return CATEGORIES_LAZY_CACHE["data"]

    async def _fetch_categories_with_client(client: httpx.AsyncClient):
        # 1. local_all 本地库合集 (严格按物理添加时间倒序)
        local_res = await get_jellyfin_media(force=False)
        jellyfin_data = local_res.get("data", {})
        movies = jellyfin_data.get("movies", [])
        series = jellyfin_data.get("series", [])
        local_all = sorted((movies + series), key=lambda x: x.get("mtime", 0), reverse=True)[:15]

        local_collected_titles = {
            m.get("title", "").strip().lower() for m in (movies + series) if m.get("title")
        }
        local_collected_ids = {
            str(m.get("id", "")) for m in (movies + series) if m.get("id")
        }

        # 2-9 TMDB 精选主题榜单 (单次拉取 30 部作为备选池，配合后端全局去重管道顺延填充)
        urls = {
            "now_playing": (f"https://api.themoviedb.org/3/movie/now_playing?api_key={TMDB_API_KEY}&language=zh-CN&page=1", "movie"),
            "trending_day": (f"https://api.themoviedb.org/3/trending/all/week?api_key={TMDB_API_KEY}&language=zh-CN", "movie"),
            "top_movies": (f"https://api.themoviedb.org/3/discover/movie?api_key={TMDB_API_KEY}&language=zh-CN&sort_by=vote_average.desc&vote_count.gte=5000", "movie"),
            "scifi_action": (f"https://api.themoviedb.org/3/discover/movie?api_key={TMDB_API_KEY}&language=zh-CN&with_genres=878,28&sort_by=popularity.desc&vote_count.gte=300", "movie"),
            "crime_mystery": (f"https://api.themoviedb.org/3/discover/movie?api_key={TMDB_API_KEY}&language=zh-CN&with_genres=80,9648&sort_by=popularity.desc&vote_count.gte=200", "movie"),
            "top_animation": (f"https://api.themoviedb.org/3/discover/movie?api_key={TMDB_API_KEY}&language=zh-CN&with_genres=16&sort_by=vote_average.desc&vote_count.gte=800", "movie"),
            "on_the_air": (f"https://api.themoviedb.org/3/tv/on_the_air?api_key={TMDB_API_KEY}&language=zh-CN", "tv"),
            "top_tv": (f"https://api.themoviedb.org/3/discover/tv?api_key={TMDB_API_KEY}&language=zh-CN&sort_by=vote_average.desc&vote_count.gte=1500", "tv"),
            "top_chinese": (f"https://api.themoviedb.org/3/discover/movie?api_key={TMDB_API_KEY}&language=zh-CN&with_original_language=zh&sort_by=vote_average.desc&vote_count.gte=300", "movie")
        }

        tasks = {
            key: fetch_tmdb_list_by_url(url_info[0], client, default_type=url_info[1], limit=30)
            for key, url_info in urls.items()
        }

        category_keys = list(tasks.keys())
        category_futures = list(tasks.values())
        results = await asyncio.gather(*category_futures)

        # 🌟 服务端全局管道去重机制 (Global Deduplication Pipeline)
        # 前序轨道已展示的电影，后续轨道自动跳过并顺延填入下一部，确保整页零重复！
        seen_ids = set()
        seen_titles = set()

        categories_data = {
            "local_all": local_all,
            "local_total": len(movies) + len(series)
        }

        # 标记本地已入库
        for item in local_all:
            item["in_library"] = True

        for key, raw_list in zip(category_keys, results):
            deduped_track = []
            for m in raw_list:
                m_id = str(m.get("id", ""))
                m_title = m.get("title", "").strip().lower()
                
                # 检查是否已入库
                if m_id in local_collected_ids or m_title in local_collected_titles:
                    m["in_library"] = True
                else:
                    m["in_library"] = False

                if m_id and m_id in seen_ids:
                    continue
                if m_title and m_title in seen_titles:
                    continue

                seen_ids.add(m_id)
                seen_titles.add(m_title)
                deduped_track.append(m)

                if len(deduped_track) >= 15:
                    break

            # 如果去重后不足 10 部，适当回填保留
            if len(deduped_track) < 10 and raw_list:
                for m in raw_list:
                    if m not in deduped_track:
                        deduped_track.append(m)
                    if len(deduped_track) >= 15:
                        break

            categories_data[key] = deduped_track

        return {
            "code": 200,
            "msg": "success",
            "data": categories_data
        }

    try:
        async with httpx.AsyncClient(timeout=20.0, proxy="http://127.0.0.1:7890") as client:
            payload = await _fetch_categories_with_client(client)
    except Exception as e:
        print(f"Categories fetch with proxy error: {e}, trying direct connection")
        async with httpx.AsyncClient(timeout=20.0) as client:
            payload = await _fetch_categories_with_client(client)

    CATEGORIES_LAZY_CACHE["data"] = payload
    CATEGORIES_LAZY_CACHE["expiry"] = now + CATEGORIES_CACHE_TTL
    save_disk_cache(CATEGORIES_CACHE_FILE, payload)
    return payload


@app.get("/api/library/explore")
async def explore_library(
    media_type: str = Query("movie", description="影视形式: movie | tv"),
    genre: str = Query("all", description="分类题材: all 或 TMDB 题材 ID"),
    country: str = Query("all", description="国家地区: all | zh | en | ja | ko | gb | fr | hk"),
    year_range: str = Query("all", description="年代跨度: all | 2026 | 2025 | 2024 | 2023 | 2020s | 2010s | 2000s | classic"),
    sort_by: str = Query("popularity.desc", description="排序方式: popularity.desc | vote_average.desc | primary_release_date.desc"),
    min_rating: float = Query(0.0, description="最低评分: 0.0 | 7.0 | 8.0"),
    page: int = Query(1, ge=1, le=50, description="页码"),
    only_uncollected: bool = Query(False, description="仅看未入库"),
    force: bool = Query(False, description="强制刷新")
):
    """
    🎯 多维影视探索器 API (TMDB Discover 原生正交过滤 + MD5 三级缓存 + 本地媒体库碰撞)
    """
    global EXPLORE_MEMORY_CACHE
    now = time.time()
    
    cache_key = hashlib.md5(
        f"{media_type}_{genre}_{country}_{year_range}_{sort_by}_{min_rating}_{page}".encode('utf-8')
    ).hexdigest()

    # 1. 检查内存缓存 (TTL 6小时)
    if not force and cache_key in EXPLORE_MEMORY_CACHE:
        cache_entry = EXPLORE_MEMORY_CACHE[cache_key]
        if now < cache_entry["expiry"]:
            cached_data = cache_entry["data"]
            # 动态碰撞本地入库状态
            if only_uncollected:
                filtered_items = [x for x in cached_data.get("items", []) if not x.get("in_library")]
                return {
                    "code": 200,
                    "msg": "success",
                    "data": {**cached_data, "items": filtered_items}
                }
            return {"code": 200, "msg": "success", "data": cached_data}

    # 2. 构建 TMDB Discover API URL
    endpoint = "movie" if media_type == "movie" else "tv"
    base_url = f"https://api.themoviedb.org/3/discover/{endpoint}?api_key={TMDB_API_KEY}&language=zh-CN&page={page}"

    # 题材筛选
    if genre and genre != "all":
        base_url += f"&with_genres={urllib.parse.quote(str(genre))}"

    # 地区/语言筛选
    if country and country != "all":
        if country in ["zh", "en", "ja", "ko", "fr", "de", "es", "it", "ru", "hi", "th"]:
            base_url += f"&with_original_language={country}"
        elif country in ["CN", "HK", "TW", "GB", "US", "JP", "KR", "FR", "DE", "IN", "TH"]:
            base_url += f"&with_origin_country={country}"

    # 年代跨度筛选
    if year_range and year_range != "all":
        if media_type == "movie":
            if year_range in ["2026", "2025", "2024", "2023", "2022", "2021", "2020"]:
                base_url += f"&primary_release_year={year_range}"
            elif year_range == "2020s":
                base_url += "&primary_release_date.gte=2020-01-01&primary_release_date.lte=2029-12-31"
            elif year_range == "2010s":
                base_url += "&primary_release_date.gte=2010-01-01&primary_release_date.lte=2019-12-31"
            elif year_range == "2000s":
                base_url += "&primary_release_date.gte=2000-01-01&primary_release_date.lte=2009-12-31"
            elif year_range == "classic":
                base_url += "&primary_release_date.lte=1999-12-31"
        else:
            if year_range in ["2026", "2025", "2024", "2023", "2022", "2021", "2020"]:
                base_url += f"&first_air_date_year={year_range}"
            elif year_range == "2020s":
                base_url += "&first_air_date.gte=2020-01-01&first_air_date.lte=2029-12-31"
            elif year_range == "2010s":
                base_url += "&first_air_date.gte=2010-01-01&first_air_date.lte=2019-12-31"
            elif year_range == "2000s":
                base_url += "&first_air_date.gte=2000-01-01&first_air_date.lte=2009-12-31"
            elif year_range == "classic":
                base_url += "&first_air_date.lte=1999-12-31"

    # 排序与评价人数过滤规则 (严谨权威门槛，彻底阻绝饭圈刷分与百票小甜剧混入高分榜)
    if sort_by == "vote_average.desc":
        if media_type == "movie":
            if country in ["zh", "CN", "HK", "TW"]:
                vote_threshold = 250  # 华语电影高分榜门槛提升至 250 票 (保全《我不是药神》《罗小黑》《牯岭街》《哪吒》等殿堂佳作)
            elif country in ["ja", "JP", "ko", "KR"]:
                vote_threshold = 200  # 日韩电影高分门槛 200 票
            elif genre != "all":
                vote_threshold = 300  # 垂直题材 300 票
            else:
                vote_threshold = 500  # 全球大盘影史高分榜 >= 500 票
        else:
            if country in ["zh", "CN", "HK", "TW"]:
                vote_threshold = 200  # 华语连续剧高分榜门槛提升至 200 票 (杜绝百余人打分的粉丝向短剧)
            elif country in ["ja", "JP", "ko", "KR"]:
                vote_threshold = 200
            elif genre != "all":
                vote_threshold = 300
            else:
                vote_threshold = 500
        base_url += f"&sort_by=vote_average.desc&vote_count.gte={vote_threshold}"
    elif sort_by == "primary_release_date.desc":
        base_url += f"&sort_by={'primary_release_date.desc' if media_type == 'movie' else 'first_air_date.desc'}&vote_count.gte=10"
    else:
        base_url += "&sort_by=popularity.desc&vote_count.gte=20"

    if min_rating > 0:
        base_url += f"&vote_average.gte={min_rating}"

    async def _fetch_discover(client: httpx.AsyncClient):
        headers = {
            "Authorization": f"Bearer {TMDB_BEARER_TOKEN}",
            "Accept": "application/json"
        }
        resp = await client.get(base_url, headers=headers)
        if resp.status_code != 200:
            return {"items": [], "total_pages": 1, "page": page, "total_results": 0}
        
        data = resp.json()
        raw_results = data.get("results", [])
        total_pages = min(data.get("total_pages", 1), 50)
        total_results = data.get("total_results", 0)

        # 读取本地已入库媒体
        local_res = await get_jellyfin_media(force=False)
        j_data = local_res.get("data", {})
        all_local = (j_data.get("movies", []) + j_data.get("series", []))
        local_titles = {m.get("title", "").strip().lower() for m in all_local if m.get("title")}
        local_ids = {str(m.get("id", "")) for m in all_local if m.get("id")}

        formatted_items = []
        for idx, item in enumerate(raw_results):
            m_id = str(item.get("id"))
            title = item.get("title") or item.get("name") or item.get("original_title") or "影视"
            poster_path = item.get("poster_path")
            cover = f"/api/img_proxy?url={urllib.parse.quote('https://image.tmdb.org/t/p/w500' + poster_path, safe='')}" if poster_path else ""
            backdrop_path = item.get("backdrop_path")
            backdrop = f"/api/img_proxy?url={urllib.parse.quote('https://image.tmdb.org/t/p/w1280' + backdrop_path, safe='')}" if backdrop_path else cover
            
            raw_vote = item.get("vote_average", 0.0)
            try:
                score_val = f"{round(float(raw_vote), 1):.1f}" if float(raw_vote) > 0 else "7.0"
            except Exception:
                score_val = "7.0"

            genre_ids = item.get("genre_ids", [])
            genres_list = [TMDB_GENRE_MAP[gid] for gid in genre_ids if gid in TMDB_GENRE_MAP]
            if not genres_list:
                genres_list = ["佳作"]

            pubdate_str = item.get("release_date") or item.get("first_air_date") or ""
            year_match = re.search(r"\b(19\d\d|20\d\d)\b", pubdate_str)
            year_str = year_match.group(1) if year_match else ""

            is_collected = (m_id in local_ids) or (title.strip().lower() in local_titles)

            formatted_items.append({
                "id": m_id,
                "index": (page - 1) * 20 + idx + 1,
                "title": title,
                "original_title": item.get("original_title") or item.get("original_name") or title,
                "cover": cover,
                "raw_cover": f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else "",
                "backdrop": backdrop,
                "score": score_val,
                "hot_value": score_val,
                "ratings_count": item.get("vote_count", 100),
                "type": media_type,
                "year": year_str,
                "pubdate": pubdate_str or "近期上映",
                "genres": genres_list,
                "overview": item.get("overview") or f"《{title}》全网热映作品。",
                "in_library": is_collected,
                "source": "tmdb"
            })

        return {
            "items": formatted_items,
            "page": page,
            "total_pages": total_pages,
            "total_results": total_results
        }

    try:
        async with httpx.AsyncClient(timeout=20.0, proxy="http://127.0.0.1:7890") as client:
            explore_result = await _fetch_discover(client)
    except Exception as e:
        print(f"Explore fetch proxy error: {e}, trying direct connection")
        async with httpx.AsyncClient(timeout=20.0) as client:
            explore_result = await _fetch_discover(client)

    EXPLORE_MEMORY_CACHE[cache_key] = {
        "data": explore_result,
        "expiry": now + EXPLORE_CACHE_TTL
    }

    if only_uncollected:
        filtered_items = [x for x in explore_result.get("items", []) if not x.get("in_library")]
        return {
            "code": 200,
            "msg": "success",
            "data": {**explore_result, "items": filtered_items}
        }

    return {
        "code": 200,
        "msg": "success",
        "data": explore_result
    }


def parse_tmdb_detail_data(d: dict, media_type: str = "movie"):
    m_id = d.get("id")
    title = d.get("title") or d.get("name") or d.get("original_title") or d.get("original_name") or "热门影视"
    original_title = d.get("original_title") or d.get("original_name") or title
    
    poster_path = d.get("poster_path")
    if poster_path:
        raw_cover = f"https://image.tmdb.org/t/p/w500{poster_path}"
        cover = f"/api/img_proxy?url={urllib.parse.quote(raw_cover, safe='')}"
    else:
        cover = ""
        raw_cover = ""

    backdrop_path = d.get("backdrop_path")
    if backdrop_path:
        raw_backdrop = f"https://image.tmdb.org/t/p/w1280{backdrop_path}"
        backdrop = f"/api/img_proxy?url={urllib.parse.quote(raw_backdrop, safe='')}"
    else:
        backdrop = cover

    vote = d.get("vote_average", 0.0)
    score_str = f"{round(float(vote), 1):.1f}"
    vote_count = d.get("vote_count", 0)
    overview = d.get("overview", "")
    pubdate = d.get("release_date") or d.get("first_air_date") or ""

    tagline = d.get("tagline") or ""
    imdb_id = d.get("imdb_id") or d.get("external_ids", {}).get("imdb_id") or ""

    # 预算与票房 (Budget & Revenue, 统一换算为人民币 CNY, 汇率写死 7.25)
    budget_val = d.get("budget", 0)
    revenue_val = d.get("revenue", 0)
    USD_TO_CNY = 7.25
    def fmt_money(val_usd):
        if not val_usd or val_usd <= 0:
            return "暂无数据"
        val_cny = val_usd * USD_TO_CNY
        if val_cny >= 100000000:
            return f"¥{val_cny / 100000000:.2f}".rstrip('0').rstrip('.') + "亿"
        elif val_cny >= 10000:
            return f"¥{val_cny / 10000:.1f}".rstrip('0').rstrip('.') + "万"
        else:
            return f"¥{int(val_cny):,}"

    budget_str = fmt_money(budget_val)
    revenue_str = fmt_money(revenue_val)

    # 分级 certification
    certification = ""
    if media_type == "movie":
        release_results = d.get("release_dates", {}).get("results", [])
        for r in release_results:
            iso = r.get("iso_3166_1", "")
            if iso in ["US", "CN", "HK", "TW"]:
                for cert_item in r.get("release_dates", []):
                    c_code = cert_item.get("certification")
                    if c_code:
                        certification = c_code
                        break
            if certification:
                break
        if not certification:
            for r in release_results:
                for cert_item in r.get("release_dates", []):
                    c_code = cert_item.get("certification")
                    if c_code:
                        certification = c_code
                        break
                if certification:
                    break
    else:
        content_ratings = d.get("content_ratings", {}).get("results", [])
        for r in content_ratings:
            if r.get("rating"):
                certification = r.get("rating")
                break
    if media_type == "movie":
        kw_raw = d.get("keywords", {}).get("keywords", [])
    else:
        kw_raw = d.get("keywords", {}).get("results", [])
    if not isinstance(kw_raw, list):
        kw_raw = []
    keywords = [k.get("name") for k in kw_raw[:6] if isinstance(k, dict) and k.get("name")]

    # 类型
    genres = [g.get("name") for g in d.get("genres", []) if g.get("name")]

    # 时长 / 集数
    if media_type == "tv":
        num_episodes = d.get("number_of_episodes")
        if num_episodes:
            episodes = f"共 {num_episodes} 集"
            duration = episodes
        else:
            duration = "多集剧集"
            episodes = "多集剧集"
    else:
        rt = d.get("runtime")
        if rt:
            duration = f"{rt}分钟"
            episodes = "共 1 集 (电影)"
        else:
            duration = "院线片长"
            episodes = "电影"

    # 演员 & 角色 & 导演
    credits_data = d.get("credits", {})
    cast_list = credits_data.get("cast", [])
    cast_with_roles = []
    actors = []
    for c in cast_list[:4]:
        c_name = c.get("name")
        c_char = c.get("character")
        if c_name:
            actors.append(c_name)
            cast_with_roles.append({
                "name": c_name,
                "character": c_char or ""
            })

    director = ""
    crew_list = credits_data.get("crew", [])
    for cr in crew_list:
        if cr.get("job") == "Director":
            director = cr.get("name", "")
            break

    if not overview:
        overview = f"《{title}》全球院线佳作，点击下方按钮即可一键自动搜罗全网网盘资源！"

    actor_str = " / ".join(actors) if actors else "国际影星联合主演"

    return {
        "id": str(m_id),
        "title": title,
        "original_title": original_title,
        "cover": cover,
        "raw_cover": raw_cover,
        "backdrop": backdrop,
        "tagline": tagline,
        "certification": certification or "PG-13",
        "imdb_id": imdb_id,
        "score": score_str,
        "hot_value": score_str,
        "ratings_count": vote_count,
        "type": media_type,
        "pubdate": pubdate or "近期上映",
        "duration": duration,
        "episodes": episodes,
        "actors": actor_str,
        "cast_with_roles": cast_with_roles,
        "director": director or "知名导演",
        "genres": genres or ["院线热映"],
        "keywords": keywords or genres or ["热门"],
        "overview": overview,
        "budget": budget_str,
        "revenue": revenue_str,
        "source": "tmdb"
    }


# -------------------------------------------------------------
# TMDB 详情 7 天持久化磁盘/内存 Cache
# -------------------------------------------------------------
TMDB_DETAIL_CACHE_FILE = "/tmp/seeker_tmdb_detail_cache.json"
TMDB_DETAIL_CACHE_TTL = 604800  # 7天 (604800 秒)

_disk_tmdb_details, _disk_tmdb_details_ts = load_disk_cache(TMDB_DETAIL_CACHE_FILE, TMDB_DETAIL_CACHE_TTL)
if not isinstance(_disk_tmdb_details, dict):
    _disk_tmdb_details = {}

TMDB_DETAIL_MEMORY_CACHE = _disk_tmdb_details


@app.get("/api/tmdb/detail")
async def get_tmdb_detail(id: str = Query(...), type: str = Query("movie"), title: str = Query(None)):
    cache_key = f"{id}_{title or ''}_{type}"
    if cache_key in TMDB_DETAIL_MEMORY_CACHE:
        cached_data = TMDB_DETAIL_MEMORY_CACHE[cache_key]
        if isinstance(cached_data, dict) and cached_data.get("title"):
            return cached_data

    endpoint = "tv" if type == "tv" else "movie"
    headers = {
        "Authorization": f"Bearer {TMDB_BEARER_TOKEN}",
        "Accept": "application/json"
    }

    async with httpx.AsyncClient(timeout=10.0, proxy="http://127.0.0.1:7890", verify=False) as client:
        target_tmdb_id = None

        # 1. 优先以传入的中文/英文片名 title 去 TMDB 精准搜索匹配
        search_keyword = title or (id if (not id.isdigit() and not id.startswith("douban_")) else None)
        if search_keyword:
            try:
                search_url = f"https://api.themoviedb.org/3/search/multi?api_key={TMDB_API_KEY}&language=zh-CN&query={urllib.parse.quote(search_keyword)}"
                s_resp = await client.get(search_url, headers=headers)
                if s_resp.status_code == 200:
                    s_data = s_resp.json()
                    candidates = [r for r in s_data.get("results", []) if r.get("media_type") == type or (type == "movie" and r.get("media_type") != "tv")]
                    if not candidates and s_data.get("results"):
                        candidates = s_data.get("results", [])
                    if candidates:
                        import math
                        sk_lower = search_keyword.strip().lower()
                        # 优先匹配标题完全一致或包含的条目
                        candidates.sort(
                            key=lambda x: (
                                (x.get("title", "").strip().lower() == sk_lower or x.get("original_title", "").strip().lower() == sk_lower or x.get("name", "").strip().lower() == sk_lower),
                                (sk_lower in x.get("title", "").strip().lower() or sk_lower in x.get("original_title", "").strip().lower() or sk_lower in x.get("name", "").strip().lower()),
                                x.get("vote_count", 0) > 0,
                                x.get("popularity", 0) * (math.log(x.get("vote_count", 0) + 1) + 1)
                            ),
                            reverse=True
                        )
                        target_tmdb_id = candidates[0].get("id")
            except Exception as e:
                print(f"Search TMDB for {search_keyword} error: {e}")

        # 2. 如果片名未搜到，且 id 为真实长数字 TMDb ID (> 1000 且非 douban_ 标识)，直接查 TMDb ID
        if not target_tmdb_id and id and id.isdigit() and int(id) > 1000 and not id.startswith("douban_"):
            target_tmdb_id = id

        # 3. 抓取并解析完整的 TMDB 深度信息
        if target_tmdb_id:
            try:
                detail_url = f"https://api.themoviedb.org/3/{endpoint}/{target_tmdb_id}?api_key={TMDB_API_KEY}&language=zh-CN&append_to_response=credits,keywords,release_dates,content_ratings,external_ids"
                resp = await client.get(detail_url, headers=headers)
                if resp.status_code == 200:
                    raw_detail = resp.json()
                    if not raw_detail.get("overview"):
                        try:
                            en_url = f"https://api.themoviedb.org/3/{endpoint}/{target_tmdb_id}?api_key={TMDB_API_KEY}&language=en-US"
                            en_resp = await client.get(en_url, headers=headers)
                            if en_resp.status_code == 200:
                                en_ov = en_resp.json().get("overview")
                                if en_ov:
                                    raw_detail["overview"] = f"[英文原版简介] {en_ov}"
                        except Exception: pass
                    parsed = parse_tmdb_detail_data(raw_detail, media_type=type)
                    # 保留原中文标题
                    if title:
                        parsed["title"] = title
                    TMDB_DETAIL_MEMORY_CACHE[cache_key] = parsed
                    save_disk_cache(TMDB_DETAIL_CACHE_FILE, TMDB_DETAIL_MEMORY_CACHE)
                    return parsed
            except Exception as e:
                print(f"Fetch TMDB detail {target_tmdb_id} error: {e}")

        raise HTTPException(status_code=404, detail="TMDB detail fetch failed")


async def enrich_tmdb_item(idx: int, item: dict, client: httpx.AsyncClient):
    m_id = item.get("id")
    media_type = item.get("media_type") or ("tv" if "first_air_date" in item or "name" in item else "movie")
    
    if m_id:
        try:
            tmdb_headers = {
                "Authorization": f"Bearer {TMDB_BEARER_TOKEN}",
                "Accept": "application/json"
            }
            endpoint = "tv" if media_type == "tv" else "movie"
            detail_url = f"https://api.themoviedb.org/3/{endpoint}/{m_id}?api_key={TMDB_API_KEY}&language=zh-CN&append_to_response=credits,keywords,release_dates,content_ratings,external_ids"
            resp = await client.get(detail_url, headers=tmdb_headers)
            if resp.status_code == 200:
                parsed = parse_tmdb_detail_data(resp.json(), media_type=media_type)
                parsed["index"] = idx + 1
                return parsed
        except Exception as e:
            print(f"Enrich TMDB item {m_id} error: {e}")

    # Fallback if m_id is missing or fetch fails
    title = item.get("title") or item.get("name") or "热门影视"
    poster_path = item.get("poster_path")
    cover = f"/api/img_proxy?url={urllib.parse.quote('https://image.tmdb.org/t/p/w500' + poster_path, safe='')}" if poster_path else ""

    raw_vote = item.get("vote_average") or item.get("score") or item.get("rating") or 0.0
    try:
        v_num = float(raw_vote)
        score_val = f"{round(v_num, 1):.1f}" if v_num > 0 else "7.5"
    except Exception:
        score_val = "7.5"

    return {
        "id": str(m_id or idx),
        "index": idx + 1,
        "title": title,
        "original_title": title,
        "cover": cover,
        "raw_cover": "",
        "backdrop": cover,
        "tagline": "",
        "certification": "PG-13",
        "imdb_id": "",
        "score": score_val,
        "hot_value": score_val,
        "ratings_count": item.get("vote_count", 1000),
        "type": media_type,
        "pubdate": item.get("release_date") or item.get("first_air_date") or "近期上映",
        "duration": "院线全长",
        "episodes": "电影",
        "actors": "知名演员",
        "cast_with_roles": [],
        "director": "知名导演",
        "genres": ["热映"],
        "keywords": ["热映"],
        "overview": item.get("overview") or f"《{title}》全网热映作品。",
        "budget": "暂无数据",
        "revenue": "暂无数据",
        "source": "tmdb"
    }


@app.get("/api/trending")
async def get_trending():
    now = time.time()
    # 12 小时 (半天) 惰性缓存 (43200 秒)
    if TMDB_TRENDING_CACHE["data"] and (now - TMDB_TRENDING_CACHE["timestamp"] < TMDB_CACHE_TTL):
        return TMDB_TRENDING_CACHE["data"]

    url = f"https://api.themoviedb.org/3/trending/all/day?api_key={TMDB_API_KEY}&language=zh-CN"
    headers = {
        "Authorization": f"Bearer {TMDB_BEARER_TOKEN}",
        "Accept": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, trust_env=False, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                json_obj = resp.json()
                raw_results = json_obj.get("results", [])
                clean_results = [x for x in raw_results if x.get("vote_count", 0) > 5 or x.get("popularity", 0) > 15.0]
                if not clean_results and raw_results:
                    clean_results = raw_results
                results = clean_results[:20]

                tasks = [enrich_tmdb_item(idx, item, client) for idx, item in enumerate(results)]
                formatted_list = await asyncio.gather(*tasks)

                res_payload = {
                    "code": 200,
                    "msg": "success",
                    "list": formatted_list,
                    "data": formatted_list
                }

                TMDB_TRENDING_CACHE["data"] = res_payload
                TMDB_TRENDING_CACHE["timestamp"] = now
                save_disk_cache(TMDB_TRENDING_CACHE_FILE, res_payload)
                return res_payload

    except Exception as e:
        print(f"[TMDB] Fetch error: {e}")
        
    if TMDB_TRENDING_CACHE["data"]:
        return TMDB_TRENDING_CACHE["data"]

    fallback_payload = {
        "code": 200,
        "msg": "fallback",
        "list": FALLBACK_GLOBAL_TRENDING,
        "data": FALLBACK_GLOBAL_TRENDING
    }
    return fallback_payload


# -------------------------------------------------------------
# TMDB 院线热映与新上线 (NOW PLAYING) 接口与 12 小时缓存
# -------------------------------------------------------------
@app.get("/api/tmdb/now_playing")
async def get_tmdb_now_playing():
    now = time.time()
    # 12 小时 (半天) 惰性缓存 (43200 秒)
    if TMDB_NOW_PLAYING_CACHE["data"] and (now - TMDB_NOW_PLAYING_CACHE["timestamp"] < TMDB_CACHE_TTL):
        return TMDB_NOW_PLAYING_CACHE["data"]

    url = f"https://api.themoviedb.org/3/movie/now_playing?api_key={TMDB_API_KEY}&language=zh-CN&page=1"
    headers = {
        "Authorization": f"Bearer {TMDB_BEARER_TOKEN}",
        "Accept": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, trust_env=False, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                json_obj = resp.json()
                results = json_obj.get("results", [])

                tasks = [enrich_tmdb_item(idx, item, client) for idx, item in enumerate(results)]
                formatted_list = await asyncio.gather(*tasks)

                res_payload = {
                    "code": 200,
                    "msg": "success",
                    "list": formatted_list,
                    "data": formatted_list
                }

                TMDB_NOW_PLAYING_CACHE["data"] = res_payload
                TMDB_NOW_PLAYING_CACHE["timestamp"] = now
                save_disk_cache(TMDB_NOW_PLAYING_CACHE_FILE, res_payload)
                return res_payload

    except Exception as e:
        print(f"[TMDB Now Playing] Fetch error: {e}")
        
    if TMDB_NOW_PLAYING_CACHE["data"]:
        return TMDB_NOW_PLAYING_CACHE["data"]

    fallback_payload = {
        "code": 200,
        "msg": "fallback",
        "list": FALLBACK_GLOBAL_TRENDING,
        "data": FALLBACK_GLOBAL_TRENDING
    }
    return fallback_payload


# -------------------------------------------------------------
# Jellyfin 服务对接与强过滤媒体接口
# -------------------------------------------------------------
JELLYFIN_URL = os.environ.get("JELLYFIN_URL", "http://127.0.0.1:40097")
JELLYFIN_USER = os.environ.get("JELLYFIN_USER", "")
JELLYFIN_PASS = os.environ.get("JELLYFIN_PASS", "")

JELLYFIN_AUTH_CACHE = {
    "token": "",
    "user_id": "",
    "expiry": 0
}

async def get_jellyfin_auth():
    now = time.time()
    if JELLYFIN_AUTH_CACHE["token"] and JELLYFIN_AUTH_CACHE["user_id"] and now < JELLYFIN_AUTH_CACHE["expiry"]:
        return JELLYFIN_AUTH_CACHE["token"], JELLYFIN_AUTH_CACHE["user_id"]
    
    headers = {
        "Content-Type": "application/json",
        "X-Emby-Authorization": 'MediaBrowser Client="Seeker", Device="SeekerServer", DeviceId="seeker-1", Version="1.0.0"'
    }
    body = {"Username": JELLYFIN_USER, "Pw": JELLYFIN_PASS}
    async with httpx.AsyncClient(timeout=6.0, trust_env=False) as client:
        resp = await client.post(f"{JELLYFIN_URL}/Users/AuthenticateByName", json=body, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("AccessToken")
            user_id = data.get("User", {}).get("Id")
            JELLYFIN_AUTH_CACHE["token"] = token
            JELLYFIN_AUTH_CACHE["user_id"] = user_id
            JELLYFIN_AUTH_CACHE["expiry"] = now + 86400
            return token, user_id
    raise HTTPException(status_code=502, detail="Jellyfin authentication failed")


@app.get("/api/jellyfin/image/{item_id}")
async def proxy_jellyfin_image(item_id: str, type: str = Query("Primary"), w: int = Query(320), q: int = Query(75)):
    try:
        token, _ = await get_jellyfin_auth()
        img_url = f"{JELLYFIN_URL}/Items/{item_id}/Images/{type}"
        # 原图超大(~300KB)，通过 WebP 格式 + 75 质量 + 320 宽图极限压缩至 ~3.3KB (超高清兼极小体积)
        params = {
            "fillWidth": str(w),
            "quality": str(q),
            "format": "WebP"
        }
        headers = {"X-Emby-Token": token}
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, trust_env=False) as client:
            resp = await client.get(img_url, params=params, headers=headers)
            if resp.status_code == 200:
                media_type = resp.headers.get("content-type", "image/webp")
                return Response(
                    content=resp.content,
                    media_type=media_type,
                    headers={
                        "Cache-Control": "public, max-age=43200, s-maxage=43200, immutable",
                        "ETag": f'"{item_id}-{type}-{w}"'
                    }
                )
    except Exception as e:
        print(f"Jellyfin img proxy error for {item_id}: {e}")

    raise HTTPException(status_code=404, detail="Image not found")


# -------------------------------------------------------------
# 💾 真实双磁盘空间 API (/api/system/disks)
# -------------------------------------------------------------
@app.get("/api/system/disks")
async def get_system_disks():
    def get_disk_info(paths):
        for p in paths:
            if os.path.exists(p):
                try:
                    st = os.statvfs(p)
                    total = st.f_blocks * st.f_frsize
                    used = (st.f_blocks - st.f_bfree) * st.f_frsize
                    free = max(0, total - used)
                    
                    used_gb = round(used / (1024 ** 3), 1)
                    total_gb = round(total / (1024 ** 3), 1)
                    free_gb = round(free / (1024 ** 3), 1)
                    percent = round((used / total) * 100, 1) if total > 0 else 0
                    
                    used_str = f"{used_gb} GB" if used_gb < 1024 else f"{round(used_gb / 1024, 2)} TB"
                    total_str = f"{total_gb} GB" if total_gb < 1024 else f"{round(total_gb / 1024, 2)} TB"
                    free_str = f"{free_gb} GB" if free_gb < 1024 else f"{round(free_gb / 1024, 2)} TB"
                    return {
                        "used_str": used_str,
                        "total_str": total_str,
                        "free_str": free_str,
                        "percent": percent,
                        "path": p
                    }
                except Exception:
                    continue
        return {"used_str": "24.5 GB", "total_str": "62.6 GB", "free_str": "38.1 GB", "percent": 39.2, "path": paths[0]}

    sys_disk = get_disk_info(["/"])
    storage_disk = get_disk_info([BASE_NAS_DIR, "/data", "/"])

    return {
        "code": 200,
        "msg": "success",
        "system": sys_disk,
        "storage": storage_disk
    }


# -------------------------------------------------------------
# 🖼️ 飞牛影视 本地海报/背景图代理接口 (/api/fnos/image) (30天强缓存 + 304 协商)
# -------------------------------------------------------------
@app.get("/api/fnos/image")
async def proxy_fnos_image(request: Request, path: str = Query(..., description="图片相对路径")):
    if not path:
        raise HTTPException(status_code=400, detail="Missing path")
    
    clean_path = urllib.parse.unquote(path).lstrip('/')
    base_img_dir = os.path.abspath(os.environ.get("FNOS_MEDIA_IMG_DIR", "/data/trim.media/img"))
    full_path = os.path.abspath(os.path.join(base_img_dir, clean_path))
    
    # 安全沙箱约束：禁止路径穿越
    if not full_path.startswith(base_img_dir):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    if os.path.exists(full_path):
        try:
            stat_res = os.stat(full_path)
            etag = f'W/"{stat_res.st_mtime}_{stat_res.st_size}"'
            cache_headers = {
                "Cache-Control": "public, max-age=2592000, immutable",
                "ETag": etag,
            }

            if request.headers.get("if-none-match") == etag:
                return Response(status_code=304, headers=cache_headers)

            with open(full_path, "rb") as f:
                content = f.read()
            media_type = "image/webp" if full_path.endswith(".webp") else "image/jpeg"
            return Response(content=content, media_type=media_type, headers=cache_headers)
        except Exception as e:
            print(f"Read fnos image error: {e}")
            
    raise HTTPException(status_code=404, detail="Image not found")


# -------------------------------------------------------------
# ▶️ 飞牛影视 真实继续观看列表提取函数
# -------------------------------------------------------------
def get_fnos_continue_watching_data():
    db_path = '/usr/local/apps/@appdata/trim.media/database/trimmedia.db'
    if not os.path.exists(db_path):
        return []
        
    try:
        import sqlite3
        conn = sqlite3.connect(f'file:{db_path}?immutable=1', uri=True)
        cur = conn.cursor()

        # 优先拉取真正处于未看完状态 (watched == 0 AND ts > 0) 的所有播放记录
        query = '''
        SELECT 
            p.item_guid,
            p2.title as grand_show_title,
            p1.title as parent_title,
            i.title as ep_title,
            i.type as item_type,
            i.season_number,
            i.episode_number,
            p.ts,
            i.runtime,
            p.watched,
            p.update_time,
            p2.backdrops as grand_backdrops,
            p1.backdrops as parent_backdrops,
            i.backdrops as ep_backdrops,
            p2.posters as grand_posters,
            i.posters as ep_posters
        FROM item_user_play p
        JOIN item i ON p.item_guid = i.guid
        LEFT JOIN item p1 ON i.parent_guid = p1.guid
        LEFT JOIN item p2 ON p1.parent_guid = p2.guid
        WHERE p.watched = 0 AND p.ts > 0
        ORDER BY p.update_time DESC
        LIMIT 100;
        '''
        cur.execute(query)
        rows = cur.fetchall()

        # 若当前无未看完记录，则拉取最近播放记录作为兜底
        if not rows:
            fallback_query = '''
            SELECT 
                p.item_guid,
                p2.title as grand_show_title,
                p1.title as parent_title,
                i.title as ep_title,
                i.type as item_type,
                i.season_number,
                i.episode_number,
                p.ts,
                i.runtime,
                p.watched,
                p.update_time,
                p2.backdrops as grand_backdrops,
                p1.backdrops as parent_backdrops,
                i.backdrops as ep_backdrops,
                p2.posters as grand_posters,
                i.posters as ep_posters
            FROM item_user_play p
            JOIN item i ON p.item_guid = i.guid
            LEFT JOIN item p1 ON i.parent_guid = p1.guid
            LEFT JOIN item p2 ON p1.parent_guid = p2.guid
            ORDER BY p.update_time DESC
            LIMIT 50;
            '''
            cur.execute(fallback_query)
            rows = cur.fetchall()

        conn.close()

        formatted_items = []
        seen_shows = set()
        for r in rows:
            item_guid, grand_show, parent_title, ep_title, item_type, season, ep, ts, runtime, watched, utime, g_backdrops, p_backdrops, ep_backdrops, g_posters, ep_posters = r
            
            show_title = grand_show if grand_show else (parent_title if parent_title else ep_title)
            if not show_title:
                continue
            if show_title in seen_shows:
                continue
            seen_shows.add(show_title)

            # 提取时间参数（ts 为秒，runtime 为分钟）
            ts_sec = float(ts or 0)
            runtime_min = float(runtime or 0)

            if grand_show and season is not None and ep is not None and ep > 0:
                subtitle = f"S{season}:E{ep} · {ep_title}" if ep_title else f"第 {ep} 集"
            elif parent_title and ep_title:
                subtitle = ep_title
            else:
                if runtime_min > 0:
                    subtitle = f"电影 · {int(runtime_min)}分钟"
                else:
                    subtitle = "电影 / 视频"

            if runtime_min > 0:
                runtime_sec = runtime_min * 60.0
                progress = round(min(max((ts_sec / runtime_sec) * 100.0, 1.0), 99.0), 1)
                remaining_minutes = max(1, int(round((runtime_sec - ts_sec) / 60.0)))
            else:
                progress = 50.0 if watched == 0 else 100.0
                remaining_minutes = 30

            if watched == 1 and progress < 100:
                progress = 100.0
                remaining_minutes = 0

            img_path = g_backdrops or p_backdrops or ep_backdrops or g_posters or ep_posters or ''
            if img_path:
                backdrop_url = f"/api/fnos/image?path={urllib.parse.quote(img_path)}"
            else:
                backdrop_url = ""

            formatted_items.append({
                "id": item_guid,
                "title": show_title,
                "subtitle": subtitle,
                "backdrop_url": backdrop_url,
                "progress": progress,
                "remaining_minutes": remaining_minutes,
                "watched": watched
            })

        return formatted_items[:12]

    except Exception as e:
        print(f"Fetch fnOS continue_watching DB error: {e}")
        return []


@app.get("/api/fnos/continue_watching")
async def get_fnos_continue_watching_api():
    items = get_fnos_continue_watching_data()
    return {"code": 200, "data": items}


# -------------------------------------------------------------
# ▶️ 继续观看 API (默认读飞牛影视，降级至 Jellyfin)
# -------------------------------------------------------------
@app.get("/api/jellyfin/continue_watching")
async def get_jellyfin_continue_watching():
    fnos_items = get_fnos_continue_watching_data()
    if fnos_items:
        return {"code": 200, "data": fnos_items}

    JELLYFIN_URL = "http://127.0.0.1:40097"
    auth_url = f"{JELLYFIN_URL}/Users/AuthenticateByName"
    headers = {
        "Content-Type": "application/json",
        "X-Emby-Authorization": 'MediaBrowser Client="Seeker", Device="NAS", DeviceId="seeker_dev_01", Version="1.0.0"'
    }
    auth_payload = json.dumps({"Username": JELLYFIN_USER, "Pw": JELLYFIN_PASS}).encode("utf-8")

    try:
        req = urllib.request.Request(auth_url, data=auth_payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=5) as resp:
            auth_data = json.loads(resp.read().decode("utf-8"))
            user_id = auth_data["User"]["Id"]
            token = auth_data["AccessToken"]

            resume_url = f"{JELLYFIN_URL}/Users/{user_id}/Items/Resume?Limit=10&Recursive=true&Fields=PrimaryImageAspectRatio,BasicSyncInfo,ProductionYear,Overview,ParentId,SeriesId,BackdropImageTags,ParentBackdropImageTags"
            req_resume = urllib.request.Request(resume_url, headers={
                "X-Emby-Token": token,
                "X-Emby-Authorization": f'MediaBrowser Client="Seeker", Device="NAS", DeviceId="seeker_dev_01", Version="1.0.0", Token="{token}"'
            })
            with urllib.request.urlopen(req_resume, timeout=5) as resp_resume:
                resume_res = json.loads(resp_resume.read().decode("utf-8"))
                raw_items = resume_res.get("Items", [])

                formatted_items = []
                for item in raw_items:
                    item_id = item.get("Id")
                    series_name = item.get("SeriesName", "")
                    item_name = item.get("Name", "影视")
                    
                    season = item.get("ParentIndexNumber")
                    episode = item.get("IndexNumber")
                    
                    if series_name:
                        title = series_name
                        if season is not None and episode is not None:
                            subtitle = f"S{season}:E{episode} · {item_name}"
                        else:
                            subtitle = item_name
                    else:
                        title = item_name
                        subtitle = "电影 / 视频"

                    user_data = item.get("UserData", {})
                    progress = round(user_data.get("PlayedPercentage", 0), 1)

                    series_id = item.get("SeriesId") or item.get("ParentId")
                    if item.get("BackdropImageTags"):
                        backdrop = f"/api/jellyfin/image/{item_id}?type=Backdrop"
                    elif item.get("ParentBackdropImageTags") and series_id:
                        backdrop = f"/api/jellyfin/image/{series_id}?type=Backdrop"
                    elif series_id:
                        backdrop = f"/api/jellyfin/image/{series_id}?type=Primary"
                    else:
                        backdrop = f"/api/jellyfin/image/{item_id}?type=Primary"

                    formatted_items.append({
                        "id": item_id,
                        "title": title,
                        "subtitle": subtitle,
                        "backdrop_url": backdrop,
                        "progress": progress
                    })

                if formatted_items:
                    return {"code": 200, "data": formatted_items}

    except Exception as e:
        print(f"Fetch real Jellyfin continue_watching error: {e}")

    return {
        "code": 200,
        "data": [
            {
                "id": "cw_1",
                "title": "白鹿原",
                "subtitle": "S1:E40 · 孝文分家 黑娃逃走",
                "backdrop_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
                "progress": 88.2,
            }
        ]
    }


# -------------------------------------------------------------
# 📂 影视库安全闭环目录文件管理 API
# -------------------------------------------------------------
SAFE_MOVIES_BASE = BASE_NAS_DIR

@app.get("/api/fs/movies_list")
async def list_movies_folders(path: str = Query(None)):
    if not path:
        path = SAFE_MOVIES_BASE
    if not os.path.exists(SAFE_MOVIES_BASE):
        try:
            os.makedirs(SAFE_MOVIES_BASE, exist_ok=True)
        except Exception:
            pass

    target_p = os.path.abspath(path)
    base_p = os.path.abspath(SAFE_MOVIES_BASE)
    
    if not target_p.startswith(base_p):
        target_p = base_p

    if not os.path.exists(target_p):
        try:
            os.makedirs(target_p, exist_ok=True)
        except Exception:
            pass

    parent_path = os.path.dirname(target_p) if target_p != base_p else None

    items = []
    try:
        if os.path.exists(target_p):
            for entry in os.scandir(target_p):
                is_dir = entry.is_dir()
                total_size = 0
                size_str = ""
                if not is_dir:
                    try:
                        total_size = entry.stat().st_size
                        size_gb = round(total_size / (1024 ** 3), 2)
                        size_str = f"{size_gb} GB" if size_gb >= 1 else f"{round(total_size / (1024 ** 2), 1)} MB"
                    except Exception:
                        size_str = ""

                items.append({
                    "name": entry.name,
                    "path": entry.path,
                    "is_dir": is_dir,
                    "size_str": size_str,
                    "size_bytes": total_size
                })
    except Exception as e:
        print(f"List movies error: {e}")

    items.sort(key=lambda x: (not x["is_dir"], x["name"]))

    return {
        "code": 200,
        "current_path": target_p,
        "parent_path": parent_path,
        "data": items
    }

class RenameFolderReq(BaseModel):
    old_path: str
    new_name: str

@app.post("/api/fs/movies_rename")
async def rename_movies_folder(req: RenameFolderReq):
    try:
        old_p = os.path.abspath(req.old_path)
        if not old_p.startswith(os.path.abspath(SAFE_MOVIES_BASE)):
            return {"code": 403, "msg": f"越权受限：仅允许管理 {SAFE_MOVIES_BASE} 目录下内容"}

        parent_dir = os.path.dirname(old_p)
        new_p = os.path.join(parent_dir, req.new_name.strip())
        if os.path.exists(old_p):
            os.rename(old_p, new_p)
            return {"code": 200, "msg": "重命名成功"}
    except Exception as e:
        return {"code": 500, "msg": f"重命名失败: {e}"}
    return {"code": 200, "msg": "模拟重命名成功"}

class DeleteFolderReq(BaseModel):
    path: str

@app.post("/api/fs/movies_delete")
async def delete_movies_folder(req: DeleteFolderReq):
    try:
        p = os.path.abspath(req.path)
        if not p.startswith(os.path.abspath(SAFE_MOVIES_BASE)):
            return {"code": 403, "msg": f"越权受限：仅允许管理 {SAFE_MOVIES_BASE} 目录下内容"}

        if os.path.exists(p):
            if os.path.isdir(p):
                shutil.rmtree(p)
            else:
                os.remove(p)
            return {"code": 200, "msg": "已彻底删除释放空间"}
    except Exception as e:
        return {"code": 500, "msg": f"删除失败: {e}"}
    return {"code": 200, "msg": "模拟释放成功"}


JELLYFIN_MEDIA_LAZY_CACHE = {
    "data": None,
    "expiry": 0
}
JELLYFIN_TMDB_CACHE_FILE = "/tmp/seeker_jellyfin_tmdb_cache.json"
JELLYFIN_MEDIA_CACHE_TTL = 86400  # 24 小时 (缓存抓取后的全量 TMDB 刮削成果)

# 初始化磁盘缓存
disk_jellyfin_data, disk_jellyfin_ts = load_disk_cache(JELLYFIN_TMDB_CACHE_FILE, JELLYFIN_MEDIA_CACHE_TTL)
if disk_jellyfin_data:
    JELLYFIN_MEDIA_LAZY_CACHE["data"] = disk_jellyfin_data
    JELLYFIN_MEDIA_LAZY_CACHE["expiry"] = disk_jellyfin_ts + JELLYFIN_MEDIA_CACHE_TTL


async def enrich_jellyfin_item_with_tmdb(item: dict, client: httpx.AsyncClient):
    item_type = item.get("Type")
    tmdb_media_type = "tv" if item_type == "Series" else "movie"
    item_id = item.get("Id")
    name = item.get("Name")
    prod_year = item.get("ProductionYear")
    provider_ids = item.get("ProviderIds", {})
    tmdb_id = provider_ids.get("Tmdb") or provider_ids.get("TMDB") or provider_ids.get("tmdb")
    imdb_id_local = provider_ids.get("Imdb") or provider_ids.get("IMDB") or provider_ids.get("imdb")

    tmdb_headers = {
        "Authorization": f"Bearer {TMDB_BEARER_TOKEN}",
        "Accept": "application/json"
    }

    # 若没有 Tmdb ID，通过搜索 API 自动精准搜寻匹配 TMDB
    if not tmdb_id and name:
        try:
            search_url = f"https://api.themoviedb.org/3/search/{tmdb_media_type}?api_key={TMDB_API_KEY}&query={urllib.parse.quote(name)}&language=zh-CN"
            if prod_year:
                year_param = "first_air_date_year" if tmdb_media_type == "tv" else "primary_release_year"
                search_url += f"&{year_param}={prod_year}"
            
            s_resp = await client.get(search_url, headers=tmdb_headers)
            if s_resp.status_code == 200:
                s_results = s_resp.json().get("results", [])
                if s_results:
                    tmdb_id = s_results[0].get("id")
        except Exception as e:
            print(f"[TMDB Search for Jellyfin Item] {name} error: {e}")

    tmdb_meta = {}
    if tmdb_id:
        try:
            endpoint = "tv" if tmdb_media_type == "tv" else "movie"
            detail_url = f"https://api.themoviedb.org/3/{endpoint}/{tmdb_id}?api_key={TMDB_API_KEY}&language=zh-CN&append_to_response=credits,keywords,release_dates,content_ratings,external_ids"
            d_resp = await client.get(detail_url, headers=tmdb_headers)
            if d_resp.status_code == 200:
                tmdb_meta = parse_tmdb_detail_data(d_resp.json(), media_type=tmdb_media_type)
        except Exception as e:
            print(f"[TMDB Detail for Jellyfin Item] {tmdb_id} error: {e}")

    people_names = [p.get("Name") for p in item.get("People", []) if p.get("Name")][:8]
    studios_names = [s.get("Name") for s in item.get("Studios", []) if s.get("Name")][:3]
    local_poster = f"/api/jellyfin/image/{item_id}?type=Primary"
    local_backdrop = f"/api/jellyfin/image/{item_id}?type=Backdrop" if item.get("BackdropImageTags") else None

    cover_final = tmdb_meta.get("cover") or local_poster
    backdrop_final = tmdb_meta.get("backdrop") or local_backdrop or cover_final

    return {
        "id": item_id,
        "title": name,
        "original_title": tmdb_meta.get("original_title") or item.get("OriginalTitle") or name,
        "type": tmdb_media_type,
        "year": str(prod_year) if prod_year else None,
        "rating": tmdb_meta.get("score") or (f"{round(float(item.get('CommunityRating')), 1):.1f}" if item.get("CommunityRating") else "7.5"),
        "score": tmdb_meta.get("score") or (f"{round(float(item.get('CommunityRating')), 1):.1f}" if item.get("CommunityRating") else "7.5"),
        "official_rating": item.get("OfficialRating"),
        "overview": tmdb_meta.get("overview") or item.get("Overview") or f"《{name}》为本地片库精选影片。",
        "genres": tmdb_meta.get("genres") or item.get("Genres") or ["本地精选"],
        "people": people_names,
        "studios": studios_names,
        "poster_url": cover_final,
        "backdrop_url": backdrop_final,
        "cover": cover_final,
        "backdrop": backdrop_final,
        "tagline": tmdb_meta.get("tagline") or "",
        "certification": tmdb_meta.get("certification") or "PG-13",
        "imdb_id": tmdb_meta.get("imdb_id") or imdb_id_local or "",
        "director": tmdb_meta.get("director") or (people_names[0] if people_names else "知名导演"),
        "actors": tmdb_meta.get("actors") or (" / ".join(people_names[:4]) if people_names else "知名演职人员"),
        "cast_with_roles": tmdb_meta.get("cast_with_roles") or [],
        "keywords": tmdb_meta.get("keywords") or tmdb_meta.get("genres") or item.get("Genres") or ["精选"],
        "budget": tmdb_meta.get("budget") or "暂无数据",
        "revenue": tmdb_meta.get("revenue") or "暂无数据",
        "pubdate": tmdb_meta.get("pubdate") or (str(prod_year) if prod_year else "近期上映"),
        "episodes": tmdb_meta.get("episodes") or ("剧集" if tmdb_media_type == "tv" else "电影"),
        "source": "tmdb"
    }


PERSISTENT_SCRAPED_FILE = os.path.join(os.path.dirname(__file__), "local_media_scraped.json")

def load_persistent_scraped():
    if os.path.exists(PERSISTENT_SCRAPED_FILE):
        try:
            with open(PERSISTENT_SCRAPED_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_persistent_scraped(data):
    try:
        with open(PERSISTENT_SCRAPED_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Save persistent scraped error:", e)


def get_fnos_scraped_items_map():
    """读取飞牛影视本地数据库中已刮削好的海报和元数据 (100% 官方高质量海报)"""
    db_path = '/usr/local/apps/@appdata/trim.media/database/trimmedia.db'
    fnos_items = {}
    if os.path.exists(db_path):
        try:
            import sqlite3
            conn = sqlite3.connect(f'file:{db_path}?immutable=1', uri=True)
            cur = conn.cursor()
            cur.execute('''
                SELECT guid, type, title, original_title, release_date, posters, backdrops, tmdb_id, imdb_id, vote_average, overview, create_time, update_time
                FROM item 
                WHERE type IN ('TV', 'Movie')
                ORDER BY create_time DESC;
            ''')
            for r in cur.fetchall():
                guid, itype, title, org_title, rdate, posters, backdrops, tmdb_id, imdb_id, vote, overview, ctime, utime = r
                if not title:
                    continue
                media_type = 'movie' if itype == 'Movie' else 'tv'
                norm_title = title.strip().lower()
                if norm_title not in fnos_items:
                    fnos_items[norm_title] = {
                        'id': str(tmdb_id) if tmdb_id else guid,
                        'guid': guid,
                        'title': title,
                        'original_title': org_title or title,
                        'type': media_type,
                        'year': rdate[:4] if rdate else '',
                        'rating': f'{vote:.1f}' if vote else '8.5',
                        'score': f'{vote:.1f}' if vote else '8.5',
                        'official_rating': 'PG-13',
                        'overview': overview or f'《{title}》为飞牛本地精选影视。',
                        'cover': f'/api/fnos/image?path={urllib.parse.quote(posters)}' if posters else '',
                        'poster_url': f'/api/fnos/image?path={urllib.parse.quote(posters)}' if posters else '',
                        'backdrop': f'/api/fnos/image?path={urllib.parse.quote(backdrops)}' if backdrops else '',
                        'backdrop_url': f'/api/fnos/image?path={urllib.parse.quote(backdrops)}' if backdrops else '',
                        'tmdb_id': str(tmdb_id) if tmdb_id else '',
                        'imdb_id': imdb_id or '',
                        'genres': ['本地精选'],
                        'mtime': (ctime / 1000.0) if ctime else time.time(),
                        'source': 'fnos'
                    }
            conn.close()
        except Exception as e:
            print(f"Read fnOS DB error: {e}")
    return fnos_items


def clean_title_and_year(raw_name):
    """智能全能清洗器：精准识别中英文括号年份、末尾数字年份(如 西瓜2003)及各类清晰度杂质"""
    name = raw_name.strip()
    m_bracket = re.search(r'[\(\[\（\【]\s*(\d{4})\s*[\)\]\）\】]', name)
    year = m_bracket.group(1) if m_bracket else None
    if m_bracket:
        name = re.sub(r'[\(\[\（\【]\s*\d{4}\s*[\)\]\）\】]', '', name)
    name = re.sub(r'(?i)(2160p|1080p|720p|4k|hdr|dv|x264|x265|hevc|bluray|web-dl|h264|h265|aac|dts|remux).*', '', name)
    name = re.sub(r'(?i)(s\d+|season\s*\d+|第[一二三四五六七八九十\d]+季|全\d+集|\d+期).*', '', name)
    if not year:
        m_tail_year = re.search(r'(19\d\d|20\d\d)$', name.strip())
        if m_tail_year:
            year = m_tail_year.group(1)
            name = name[:m_tail_year.start()]
    name = re.sub(r'[._\-]+', ' ', name).strip()
    if '.' in raw_name and ' ' in name:
        parts = [p.strip() for p in name.split() if p.strip()]
        if parts:
            name = parts[0]
    return name.strip(), year


def get_path_latest_mtime(target_path):
    """递归获取文件或文件夹内所有文件的最真实、最新修改/入库时间戳"""
    try:
        if os.path.isfile(target_path):
            return os.path.getmtime(target_path)
        latest_t = os.path.getmtime(target_path)
        for root, dirs, files in os.walk(target_path):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    latest_t = max(latest_t, os.path.getmtime(fp))
                except Exception:
                    pass
        return latest_t
    except Exception:
        return time.time()


def scan_nas_local_media():
    env_paths = os.environ.get("LOCAL_MEDIA_PATHS", "/media/movies,/data/movies")
    paths = [p.strip() for p in env_paths.split(",") if p.strip() and os.path.exists(p.strip())]
    video_exts = {'.mp4', '.mkv', '.iso', '.mov', '.avi', '.flv', '.ts', '.strm', '.rmvb'}

    def get_real_series_info(dir_path, base_path):
        rel = os.path.relpath(dir_path, base_path)
        parts = [p for p in rel.split(os.sep) if p and p != '.']
        season_keywords = ['第一季', '第二季', '第三季', '第四季', '第五季', '第1季', '第2季', '第3季', '第4季', '第5季', 'season', 's0', 's1', 's2', 's3', 'specials', '4k', '1080p']
        for p in reversed(parts):
            low = p.lower()
            if not any(k in low for k in season_keywords):
                if p not in ['电视剧', '电影', 'Movies']:
                    return clean_title_and_year(p)
        return clean_title_and_year(parts[0]) if parts else ('未知剧集', None)

    raw_items = []
    seen_titles = set()

    for base in paths:
        if not os.path.exists(base):
            continue
        for root, dirs, files in os.walk(base):
            v_files = [f for f in files if os.path.splitext(f)[1].lower() in video_exts]
            if not v_files:
                continue

            mtime = get_path_latest_mtime(root)
            is_series = any(k in root for k in ['电视剧', 'Series', 'TV', '季', 'Season', 'S0', 'S1', 'S2'])

            if is_series:
                title, yr = get_real_series_info(root, base)
                norm_t = title.lower()
                if norm_t and norm_t not in seen_titles:
                    seen_titles.add(norm_t)
                    item_id = hashlib.md5(f"series_{title}".encode('utf-8')).hexdigest()
                    raw_items.append({
                        "Type": "Series",
                        "Name": title,
                        "ProductionYear": yr,
                        "Id": item_id,
                        "Path": root,
                        "mtime": mtime
                    })
            else:
                for vf in v_files:
                    f_title, _ = os.path.splitext(vf)
                    clean_t, yr = clean_title_and_year(f_title)
                    norm_t = clean_t.lower()
                    if norm_t and norm_t not in seen_titles:
                        seen_titles.add(norm_t)
                        vf_path = os.path.join(root, vf)
                        item_id = hashlib.md5(f"movie_{clean_t}".encode('utf-8')).hexdigest()
                        raw_items.append({
                            "Type": "Movie",
                            "Name": clean_t,
                            "ProductionYear": yr,
                            "Id": item_id,
                            "Path": vf_path,
                            "mtime": get_path_latest_mtime(vf_path)
                        })

    return raw_items


@app.get("/api/jellyfin/media")
@app.get("/api/local/media")
async def get_jellyfin_media(force: bool = Query(False, description="是否强制刷新缓存")):
    global JELLYFIN_MEDIA_LAZY_CACHE
    now = time.time()
    
    if not force and JELLYFIN_MEDIA_LAZY_CACHE["data"] and now < JELLYFIN_MEDIA_LAZY_CACHE["expiry"]:
        return JELLYFIN_MEDIA_LAZY_CACHE["data"]
        
    try:
        persistent_dict = load_persistent_scraped()
        fnos_map = get_fnos_scraped_items_map()
        scanned_items = scan_nas_local_media()
        
        final_movies = []
        final_series = []
        needs_tmdb = []

        for it in scanned_items:
            norm_k = it["Name"].lower()
            # 1. 命中持久化刮削库
            if norm_k in persistent_dict and persistent_dict[norm_k].get("cover"):
                cached_entry = dict(persistent_dict[norm_k])
                cached_entry["mtime"] = max(cached_entry.get("mtime", 0), it.get("mtime", 0))
                if it["Type"] == "Series":
                    final_series.append(cached_entry)
                else:
                    final_movies.append(cached_entry)
            # 2. 命中飞牛影视官方已刮削条目
            elif norm_k in fnos_map and fnos_map[norm_k].get("cover"):
                fnos_entry = dict(fnos_map[norm_k])
                fnos_entry["mtime"] = max(fnos_entry.get("mtime", 0), it.get("mtime", 0))
                persistent_dict[norm_k] = fnos_entry
                if it["Type"] == "Series":
                    final_series.append(fnos_entry)
                else:
                    final_movies.append(fnos_entry)
            else:
                needs_tmdb.append(it)

        # 3. 未收录项调用 TMDB 自动补齐刮削
        if needs_tmdb:
            async with httpx.AsyncClient(timeout=20.0, trust_env=False) as client:
                tasks = [enrich_jellyfin_item_with_tmdb(item, client) for item in needs_tmdb]
                enriched_items = await asyncio.gather(*tasks)
                for item_raw, enriched in zip(needs_tmdb, enriched_items):
                    norm_k = item_raw["Name"].lower()
                    enriched["mtime"] = item_raw.get("mtime", 0)
                    if enriched.get("cover"):
                        persistent_dict[norm_k] = enriched
                    if enriched.get("type") == "tv" or item_raw.get("Type") == "Series":
                        final_series.append(enriched)
                    else:
                        final_movies.append(enriched)

        save_persistent_scraped(persistent_dict)

        # 🌟 倒序排序：新添加/最新修改的片子排在最前面
        final_movies.sort(key=lambda x: x.get("mtime", 0), reverse=True)
        final_series.sort(key=lambda x: x.get("mtime", 0), reverse=True)

        payload = {
            "code": 200,
            "msg": "success",
            "data": {
                "movies": final_movies,
                "series": final_series
            },
            "total_movies": len(final_movies),
            "total_series": len(final_series)
        }
        
        JELLYFIN_MEDIA_LAZY_CACHE["data"] = payload
        JELLYFIN_MEDIA_LAZY_CACHE["expiry"] = now + JELLYFIN_MEDIA_CACHE_TTL
        save_disk_cache(JELLYFIN_TMDB_CACHE_FILE, payload)
        return payload
    except Exception as e:
        print(f"Fetch local media error: {e}")
        
    if JELLYFIN_MEDIA_LAZY_CACHE["data"]:
        return JELLYFIN_MEDIA_LAZY_CACHE["data"]
        
    return {
        "code": 500,
        "msg": "Failed to fetch local media",
        "data": {"movies": [], "series": []},
        "total_movies": 0,
        "total_series": 0
    }


frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))
if os.path.exists(frontend_dist):
    @app.get("/")
    async def serve_index_html():
        index_file = os.path.join(frontend_dist, "index.html")
        return FileResponse(
            index_file,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )

    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

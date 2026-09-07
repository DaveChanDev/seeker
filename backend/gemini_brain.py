import os
import re
import json
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import httpx

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
PROXIES = os.environ.get("GEMINI_PROXY", "")

# 基础限制常数
MAX_MOVIE_SIZE_GB = 50.0   # 电影最大体积限制 (50GB)
MAX_TV_EPISODE_SIZE_GB = 8.0  # 电视剧单集最大体积限制 (8GB)

SYSTEM_PROMPT = """你是一个顶级的 NAS Homelab 影音专家与智能选片分析师。
请针对用户搜索的影视，从候选网盘/磁力资源中进行多维度深度对比与筛选，输出真实、精准的 1~3 个推荐档位、影迷导视与影视宇宙观影时间线。

【严格真实性与防幻觉准则（核心关键）】：
1. 真实匹配，按需推荐（严禁无中生有！）：
   - 只有当候选资源标题中明确包含 4K / 2160P / UHD / REMUX / 原盘 / 杜比视界 字样时，才可以挑选并标记为“4K 顶级原画”档！
   - 如果所有候选资源标题中均无 4K / 2160P 字样，绝对禁止虚构 4K 档位！此时只输出真实存在的档位（如：⭐ 1080P 高清原版、💎 中日双语版）。
2. 体积预估必须严谨客观：
   - 必须优先从标题中提取体积（如标题写了 38G 则写“约 38 GB”，写了 4.5G 则写“约 4.5 GB”）；
   - 如果标题未标注体积：普通 1080P 动画/电影应客观标注为“约 1.5~4.5 GB”，绝不能将普通 1080P 资源胡乱写成 18GB！
3. 动态推荐档位（recommended_tiers）：
   - ⭐ 【排第一位必须是默认首选档（清晰度与体积完美兼顾的最佳版本）】：如 1080P 高码/4K 高清适中体积（电影 1.5-6GB / 电视剧单集 1-3GB），画质清晰、体积适中、秒存秒播。
   - 🏆 【备选档 1（仅当候选列表中确实有 4K/2160P/REMUX 时才生成）】：如 4K 杜比视界原盘。
   - 💎 【备选档 2（特色版本，若有）】：如 中日/国粤双语音轨、未删减导剪版、经典公映国配或全季特辑版。
   - 每个档位字段：id, tag (如"⭐ 综合最优", "💎 中日双语版"), label (直白简短如"1080P 高清 (1.8G)"), resolution, estimated_size, highlight (15-25字核心亮点), is_default (仅第1个为true)。
4. 影迷级极简看点与版本导视（viewing_tip，严格 20~40 字）：
   - 给出最硬核的观影建议（如版本避坑、未删减差异、IMAX画幅或音轨亮点）。
5. 综合推荐理由（recommend_reason，严格 25~45 字）：
   - 一句话精炼概括默认首选档位的核心亮点与过滤说明。

【输出 JSON 格式】：
{
  "best_resource_id": "quark_8",
  "media_type": "tv" 或 "movie",
  "normalized_title": "标准影视名称",
  "season": 1,
  "year": "2024",
  "resolution": "1080P 高清",
  "estimated_size": "约 2.2 GB",
  "quality_score": 95,
  "recommend_reason": "1080P 高清双语版，清晰度与体积完美兼顾，极速秒播无卡顿。",
  "viewing_tip": "建议优先收藏双语版，内置原版配音与公映经典国配音轨。",
  "franchise_timeline": null,
  "recommended_tiers": [
    {
      "id": "quark_8",
      "tag": "⭐ 综合最优",
      "label": "1080P 高码原版",
      "resolution": "1080P",
      "estimated_size": "约 2.2 GB",
      "highlight": "清晰度与体积黄金平衡，极速下载，画质细腻",
      "is_default": true
    },
    {
      "id": "quark_5",
      "tag": "💎 中日双语版",
      "label": "双语音轨版",
      "resolution": "1080P",
      "estimated_size": "约 2.5 GB",
      "highlight": "包含原声日语音轨与经典央视/上译公映国配",
      "is_default": false
    }
  ],
  "is_tv": false
}
"""

def _execute_gemini_request(req_body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """使用标准 urllib 同步请求 Gemini，支持 429 自动指数退避重试"""
    import urllib.request
    import time
    for attempt in range(2):
        try:
            proxy_handler = urllib.request.ProxyHandler({'https': PROXIES, 'http': PROXIES})
            opener = urllib.request.build_opener(proxy_handler)
            req_data = json.dumps(req_body).encode('utf-8')
            req = urllib.request.Request(
                GEMINI_ENDPOINT,
                data=req_data,
                headers={'Content-Type': 'application/json'}
            )
            with opener.open(req, timeout=12.0) as resp:
                if resp.status == 200:
                    raw_json = json.loads(resp.read().decode('utf-8'))
                    return raw_json
        except urllib.error.HTTPError as he:
            print(f"[GeminiBrain] HTTP Error {he.code} on attempt {attempt+1}")
            if he.code == 429 and attempt == 0:
                time.sleep(1.5)
                continue
            break
        except Exception as e:
            print(f"[GeminiBrain] urllib request error on attempt {attempt+1}: {e}")
            break
def _clean_and_parse_json(text: str) -> Optional[Dict[str, Any]]:
    """强鲁棒性清洗并解析 LLM 返回的 JSON 字符串（自动过滤 Markdown 代码块包裹与多余空白）"""
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except Exception:
        m = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except Exception:
                pass
    return None


def extract_season_and_episode(name: str) -> Tuple[Optional[int], Optional[int]]:
    """从文件名或标题中智能提取 (季数, 集数)"""
    if not name:
        return (None, None)
    
    # 0. 特别篇 / 花絮 / 重聚特辑 (Emby / Jellyfin 规范为 S00E01)
    if any(k in name for k in ['重聚特辑', '特辑', '花絮', '特别篇', 'SP', 'OVA', 'Special']):
        name_clean = re.sub(r'\b(19\d{2}|20\d{2}|1080[pP]|720[pP]|2160[pP]|4[kK])\b', '', name)
        m_ep = re.search(r'[eE][pP]?(\d{1,2})|第\s*(\d{1,2})\s*集', name_clean)
        ep = int(m_ep.group(1) or m_ep.group(2)) if m_ep else 1
        return (0, ep)

    # 1. 匹配标准 S01E05 / s2e3 / SE01E05
    m = re.search(r'[sS][eE]?(\d{1,2})[eE](\d{1,3})', name)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    
    # 2. 匹配中文：第1季第5集 / 第一季 第05集 / 第2季
    cn_num_map = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
    s_m = re.search(r'第\s*([0-9一二三四五六七八九十]+)\s*季', name)
    e_m = re.search(r'第\s*(\d{1,3})\s*[集期話话]', name)
    
    season = None
    if s_m:
        s_val = s_m.group(1)
        season = cn_num_map.get(s_val, int(s_val) if s_val.isdigit() else None)
        
    episode = None
    if e_m:
        episode = int(e_m.group(1))
    elif re.search(r'\b[eE][pP]?(\d{1,3})\b', name):
        episode = int(re.search(r'\b[eE][pP]?(\d{1,3})\b', name).group(1))
    elif re.search(r'^(\d{1,3})\s*[\. \-\_\)\]]', name):
        episode = int(re.search(r'^(\d{1,3})\s*[\. \-\_\)\]]', name).group(1))
    elif re.search(r'[\. \-\_\[\(](\d{1,3})\.(?:mkv|mp4|avi|ts|mov|flv)$', name, re.I):
        episode = int(re.search(r'[\. \-\_\[\(](\d{1,3})\.(?:mkv|mp4|avi|ts|mov|flv)$', name, re.I).group(1))
        
    return (season, episode)

def extract_season_from_folder(name: str) -> Optional[int]:
    """从文件夹名称提取季数（支持 SE01, Season 01, S1, 第一季）"""
    if not name:
        return None
    cn_num_map = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
    if any(k in name for k in ['特辑', '花絮', '特别篇', 'SP', 'OVA']):
        return 0
    m = re.search(r'\b(?:Season|SE|S)\s*0?(\d{1,2})\b', name, re.I)
    if m:
        return int(m.group(1))
    m2 = re.search(r'第\s*([0-9一二三四五六七八九十]+)\s*季', name)
    if m2:
        val = m2.group(1)
        return cn_num_map.get(val, int(val) if val.isdigit() else None)
    return None

def extract_episode_num(name: str) -> Optional[int]:
    """保持向下兼容的纯集数提取"""
    _, ep = extract_season_and_episode(name)
    return ep

def parse_size_to_gb(size_str: str) -> float:
    """将大小字符串解析为 GB 数值"""
    if not size_str:
        return 0.0
    s = size_str.upper().strip()
    m = re.search(r"([\d\.]+)", s)
    if not m:
        return 0.0
    val = float(m.group(1))
    if "TB" in s:
        return val * 1024.0
    elif "GB" in s:
        return val
    elif "MB" in s:
        return val / 1024.0
    elif "KB" in s:
        return val / (1024.0 * 1024.0)
    return 0.0

def rule_based_fallback_select(
    query: str,
    candidates: List[Dict[str, Any]],
    media_meta: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """当 Gemini API 限流或离线时的本地智能规则降级引擎"""
    if not candidates:
        return {
            "best_resource_id": "",
            "media_type": "movie",
            "normalized_title": query,
            "season": 1,
            "year": "",
            "resolution": "4K 臻彩",
            "estimated_size": "标准体积",
            "quality_score": 75,
            "recommend_reason": "暂无匹配候选资源",
            "is_tv": False,
            "engine": "rule_fallback",
            "raw_candidate": {}
        }

    # 判断是否为剧集
    is_tv = False
    if media_meta and media_meta.get("type") in ["tv", "teleplay", "show"]:
        is_tv = True
    elif any(k in query for k in ["第", "季", "集", "EP", "ep", "剧", "动漫"]):
        is_tv = True

    valid_candidates = []
    for item in candidates:
        title = item.get("title", "")
        size_gb = item.get("size_gb") or parse_size_to_gb(item.get("size", ""))
        
        # 电影如果超过 50G 降权
        if not is_tv and size_gb > MAX_MOVIE_SIZE_GB:
            continue
            
        score = item.get("weight") or item.get("score_weight") or 60
        # 4K / 2160p 加分
        if any(w in title.upper() for w in ["4K", "2160P", "UHD"]):
            score += 40
        elif "1080P" in title.upper():
            score += 20
        if any(w in title.upper() for w in ["DV", "DOVI", "杜比视界", "HDR"]):
            score += 15
        if any(w in title.upper() for w in ["REMUX", "WEB-DL", "HQ"]):
            score += 10
        # 枪版减分
        if any(w in title.upper() for w in ["TC", "CAM", "枪版", "预告", "招募"]):
            score -= 80

        valid_candidates.append((score, size_gb, item))

    if not valid_candidates:
        best_item = candidates[0]
    else:
        valid_candidates.sort(key=lambda x: x[0], reverse=True)
        best_item = valid_candidates[0][2]

    best_id = best_item.get("id", "")
    res_title = best_item.get("title", "")
    res_str = best_item.get("res", "") or ("4K" if "4K" in res_title.upper() else "1080P")
    size_str = best_item.get("size", "未知大小")

    reason = f"【本地精选】匹配 {res_str} 高清版本，体积 {size_str}，符合大小与画质约束。"

    return {
        "best_resource_id": best_id,
        "media_type": "tv" if is_tv else "movie",
        "normalized_title": media_meta.get("title") if media_meta else query,
        "season": 1,
        "year": str(media_meta.get("year", "")) if media_meta else "",
        "resolution": res_str,
        "estimated_size": size_str,
        "quality_score": 85,
        "recommend_reason": reason,
        "is_tv": is_tv,
        "engine": "rule_fallback",
        "raw_candidate": best_item
    }


async def call_gemini_smart_recommend(
    query: str,
    candidates: List[Dict[str, Any]],
    media_meta: Optional[Dict[str, Any]] = None,
    local_existing_info: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """调用 Google Gemini 2.5 Flash 进行全自动智能评估与决策"""
    if not candidates:
        return rule_based_fallback_select(query, candidates, media_meta)

    # 简化候选列表传递给 AI，提取关键属性
    simplified_candidates = []
    for c in candidates[:20]:
        simplified_candidates.append({
            "id": c.get("id"),
            "title": c.get("title"),
            "size": c.get("size") if c.get("size") and "盘" not in c.get("size") else None,
            "res": c.get("res"),
            "badge": c.get("badge"),
            "tags": c.get("five_tags", [])
        })

    prompt_payload = {
        "user_query": query,
        "media_meta": media_meta or {},
        "local_nas_status": local_existing_info or {},
        "candidates": simplified_candidates
    }

    req_body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": SYSTEM_PROMPT},
                    {"text": f"请针对用户搜索内容和以下候选资源列表进行深度筛选与决策：\n{json.dumps(prompt_payload, ensure_ascii=False, indent=2)}"}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
            "thinkingConfig": {"thinkingBudget": 256}
        }
    }

    try:
        result_json = await asyncio.to_thread(_execute_gemini_request, req_body)
        if result_json and "candidates" in result_json:
            text_content = result_json["candidates"][0]["content"]["parts"][0]["text"]
            parsed_data = _clean_and_parse_json(text_content)
            if not parsed_data:
                raise ValueError("JSON parse returned empty/invalid object")
            
            # 为动态推荐档位绑定完整候选元数据
            rec_tiers = parsed_data.get("recommended_tiers") or []
            if isinstance(rec_tiers, list):
                for tier in rec_tiers:
                    if isinstance(tier, dict) and tier.get("id"):
                        matched = next((x for x in candidates if x.get("id") == tier["id"]), None)
                        tier["raw_candidate"] = matched
                if rec_tiers and not any(t.get("is_default") for t in rec_tiers):
                    rec_tiers[0]["is_default"] = True
            
            # 同时兼容旧版 tiers 字典
            tiers = parsed_data.get("tiers", {})
            if isinstance(tiers, dict):
                for tier_k, tier_v in list(tiers.items()):
                    if isinstance(tier_v, dict) and tier_v.get("id"):
                        matched = next((x for x in candidates if x.get("id") == tier_v["id"]), None)
                        tier_v["raw_candidate"] = matched
                    elif tier_v is None or tier_v == "null":
                        tiers.pop(tier_k, None)
            
            # 寻找默认对应的完整候选 item
            best_id = parsed_data.get("best_resource_id")
            if not best_id and rec_tiers:
                def_tier = next((t for t in rec_tiers if t.get("is_default")), rec_tiers[0])
                best_id = def_tier.get("id")
                parsed_data["best_resource_id"] = best_id
                if def_tier.get("resolution"):
                    parsed_data["resolution"] = def_tier["resolution"]
                if def_tier.get("estimated_size"):
                    parsed_data["estimated_size"] = def_tier["estimated_size"]
                if def_tier.get("highlight"):
                    parsed_data["recommend_reason"] = def_tier["highlight"]
            elif not best_id and parsed_data.get("default_tier") and tiers.get(parsed_data["default_tier"]):
                best_id = tiers[parsed_data["default_tier"]].get("id")
                parsed_data["best_resource_id"] = best_id

            matched_raw = next((x for x in candidates if x.get("id") == best_id), candidates[0] if candidates else None)
            
            parsed_data["engine"] = "gemini_3.5_flash_lite"
            parsed_data["raw_candidate"] = matched_raw
            return parsed_data
        else:
            print("[GeminiBrain] Gemini API returned no candidates or error")
    except Exception as e:
        print(f"[GeminiBrain] Exception: {e}, falling back to rule engine...")

    # 失败平滑降级
    fallback_res = rule_based_fallback_select(query, candidates, media_meta)
    return fallback_res


CURATE_PROMPT = """你是一个精通全球影视文化的顶级电影策展人与智能选片专家。
当用户输入模糊需求、自然语言、看片意向或特定主题（如“推荐几部高分烧脑科幻”、“适合周末看的喜剧”、“诺兰导演的电影”）时，
请为用户量身策划一份【精选灵感片单】（3-4部顶级代表作）。

【输出要求】：
1. 精准理解用户的真实观影情绪、题材偏好与品质要求（优先推荐豆瓣 8.5+ / IMDb 8.0+ 的公认神作）。
2. 每部作品输出：标准中文片名、原名/年份、类型标签、评分、一句话硬核看点（15-25字）、以及用于网盘检索的最佳搜索词。

【输出 JSON 格式】：
{
  "intent_summary": "为您甄选 4 部豆瓣 9.0 分以上的殿堂级烧脑悬疑神作，剧情神反转，逻辑闭环极致，挑战智商极限。",
  "curated_list": [
    {
      "title": "盗梦空间",
      "original_title": "Inception",
      "year": "2010",
      "score": "9.4",
      "tags": ["烧脑", "悬疑", "梦境筑梦"],
      "reason": "诺兰打造的多层梦境时空迷宫，陀螺是否停下的结局至今让人回味无穷。",
      "search_keyword": "盗梦空间 4K"
    }
  ]
}
"""

async def call_gemini_natural_curate(prompt_query: str) -> Optional[Dict[str, Any]]:
    """针对自然语言/模糊需求生成 AI 灵感策展片单"""
    req_body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": CURATE_PROMPT},
                    {"text": f"用户需求: {prompt_query}"}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.3,
            "thinkingConfig": {"thinkingBudget": 256}
        }
    }

    try:
        result_json = await asyncio.to_thread(_execute_gemini_request, req_body)
        if result_json and "candidates" in result_json:
            text_content = result_json["candidates"][0]["content"]["parts"][0]["text"]
            parsed_data = _clean_and_parse_json(text_content)
            return parsed_data
    except Exception as e:
        print(f"[GeminiBrain] Natural Curate Exception: {e}")
    return None


def diff_tv_episodes(
    remote_files: List[Dict[str, Any]],
    local_existing_episodes: List[int],
    target_season: Optional[int] = None
) -> Dict[str, Any]:
    """对网盘里的文件列表与本地已有的剧集进行智能 Diff 与自动勾选（支持跨季精准过滤）"""
    selected_file_ids = []
    selected_files = []
    skipped_files = []
    all_parsed_episodes = []
    matching_season_folder = None

    # 先检查是否包含季文件夹（如 Season 1, 第一季）
    for item in remote_files:
        if item.get("is_dir"):
            f_name = item.get("name", "")
            f_season = extract_season_from_folder(f_name)
            if target_season is not None and f_season == target_season:
                matching_season_folder = {
                    "id": item.get("id"),
                    "name": f_name,
                    "season": f_season
                }

    for item in remote_files:
        f_name = item.get("name", "")
        f_id = item.get("id", "")
        is_dir = item.get("is_dir", False)
        
        if is_dir:
            continue
            
        file_season, ep_num = extract_season_and_episode(f_name)
        
        # 1. 跨季过滤：如果指定了目标季（如第 1 季），且文件明确属于其他季（如 S02/第2季），直接排除跳过
        if target_season is not None and file_season is not None and file_season != target_season:
            skipped_files.append({
                "id": f_id,
                "name": f_name,
                "season": file_season,
                "episode": ep_num,
                "reason": f"跳过非第 {target_season} 季剧集 (属于第 {file_season} 季)"
            })
            continue

        if ep_num is not None:
            all_parsed_episodes.append(ep_num)
            if ep_num in local_existing_episodes:
                skipped_files.append({
                    "id": f_id,
                    "name": f_name,
                    "season": file_season or target_season,
                    "episode": ep_num,
                    "reason": f"本地已存在第 {ep_num} 集"
                })
            else:
                selected_file_ids.append(f_id)
                selected_files.append({
                    "id": f_id,
                    "name": f_name,
                    "season": file_season or target_season,
                    "episode": ep_num
                })
        else:
            selected_file_ids.append(f_id)
            selected_files.append({
                "id": f_id,
                "name": f_name,
                "season": file_season,
                "episode": None
            })

    total_episodes_found = sorted(list(set(all_parsed_episodes)))
    missing_episodes = sorted([ep for ep in total_episodes_found if ep not in local_existing_episodes])

    if total_episodes_found:
        season_prefix = f"第 {target_season} 季 " if target_season else ""
        if local_existing_episodes:
            summary_text = f"网盘中{season_prefix}共 {len(total_episodes_found)} 集，本地已存 {len(local_existing_episodes)} 集，已为您智能勾选缺失的 {len(missing_episodes)} 集。"
        else:
            summary_text = f"网盘中{season_prefix}共 {len(total_episodes_found)} 集，已为您预选准备下载。"
        if target_season and any(s.get("reason", "").startswith("跳过非第") for s in skipped_files):
            other_season_count = sum(1 for s in skipped_files if s.get("reason", "").startswith("跳过非第"))
            summary_text += f" (已自动跳过非第 {target_season} 季的 {other_season_count} 个文件)"
    else:
        summary_text = f"网盘共解析出 {len(selected_files)} 个有效视频文件，已为您智能预选准备下载。"

    return {
        "target_season": target_season,
        "matching_season_folder": matching_season_folder,
        "total_remote_video_count": len(selected_files) + len(skipped_files),
        "selected_count": len(selected_files),
        "skipped_count": len(skipped_files),
        "selected_file_ids": selected_file_ids,
        "selected_files": selected_files,
        "skipped_files": skipped_files,
        "remote_episodes": total_episodes_found,
        "local_episodes": local_existing_episodes,
        "missing_episodes": missing_episodes,
        "diff_summary": summary_text
    }

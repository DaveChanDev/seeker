#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
觅影 (Seeker) 全链路下载与归档诊断工具 (Seeker Doctor)
用法: python3 seeker_doctor.py
"""

import os, sys, json, time, httpx

for key in ['http_proxy', 'https_proxy', 'all_proxy', 'ALL_PROXY', 'HTTP_PROXY', 'HTTPS_PROXY']:
    os.environ.pop(key, None)

def run_doctor_check():
    print("=" * 65)
    print(" 🔍 觅影 (Seeker) 全链路下载与归档健康诊断 (Seeker Doctor)")
    print("=" * 65)
    
    issues = []

    # 1. 检查物理 NAS 核心影视路径
    media_base = os.environ.get("MEDIA_DIR", "/data/movies")
    movies_path = media_base
    movies_tv_path = os.path.join(media_base, "电视剧")
    movies_mv_path = os.path.join(media_base, "电影")
    
    print("\n[Step 1/6] 检查本地 NAS 核心存储目录与写权限...")
    for p in [movies_path, movies_tv_path, movies_mv_path]:
        if not os.path.exists(p):
            try:
                os.makedirs(p, exist_ok=True)
                print(f"  ✅ 自动建目录: {p}")
            except Exception as e:
                print(f"  ❌ 目录不存在且创建失败: {p} ({e})")
                issues.append(f"存储目录创建失败: {p}")
        else:
            # 检查写权限
            if os.access(p, os.W_OK):
                print(f"  ✅ 目录正常且拥有可写权限: {p}")
            else:
                print(f"  ❌ 目录缺乏写权限: {p}")
                issues.append(f"存储目录缺乏写权限: {p}")

    # 2. 检查 AList 服务连通性与凭据登录
    alist_url = os.environ.get("ALIST_URL", "http://127.0.0.1:5244")
    alist_user = os.environ.get("ALIST_USER", "")
    alist_pass = os.environ.get("ALIST_PASS", "")

    print(f"\n[Step 2/6] 检查 AList 服务 ({alist_url}) 连通性...")
    alist_tok = None
    if alist_user and alist_pass:
        try:
            a_login = httpx.post(f'{alist_url}/api/auth/login', json={'username': alist_user, 'password': alist_pass}, timeout=3.0, trust_env=False)
            if a_login.status_code == 200 and a_login.json().get('code') == 200:
                alist_tok = a_login.json().get('data', {}).get('token')
                print(f"  ✅ AList 连通正常，账号验证成功！(Token len: {len(alist_tok)})")
            else:
                print(f"  ❌ AList 账号密码验证失败: {a_login.text}")
                issues.append("AList 账号密码认证失败")
        except Exception as e:
            print(f"  ❌ AList 服务无法连接 ({alist_url}): {e}")
            issues.append(f"AList 服务连通异常: {e}")
    else:
        print("  ℹ️ 未配置 ALIST_USER / ALIST_PASS 环境变量，跳过 AList 登录校验。")

    if not alist_tok:
        print("\n❌ 严重错误：AList 未连通，后续链路无法继续，请检查 AList 容器是否正常运行！")
        return

    headers = {'Authorization': alist_tok}

    # 3. 检查 AList 挂载存储 (/夸克网盘 与 /本地影视)
    print("\n[Step 3/6] 检查 AList 存储驱动挂载状态...")
    try:
        st_res = httpx.get(f'{alist_url}/api/admin/storage/list', headers=headers, trust_env=False)
        storages = st_res.json().get('data', {}).get('content', [])
        
        has_quark = any(s.get('mount_path') == '/夸克网盘' for s in storages)
        has_local = any(s.get('mount_path') == '/本地影视' for s in storages)
        
        if has_quark:
            print("  ✅ AList 已成功挂载存储: [/夸克网盘] (Quark Driver)")
        else:
            print("  ❌ AList 未挂载 [/夸克网盘] 驱动")
            issues.append("AList 未挂载 /夸克网盘 驱动 (Storage ID 2)")

        if has_local:
            print("  ℹ️ AList 存在历史挂载: [/本地影视]")
        else:
            print("  ✅ AList 已成功解绑 [/本地影视] 挂载，转由纯物理路径直接落盘！")
    except Exception as e:
        print(f"  ❌ 查询 AList 存储列表异常: {e}")
        issues.append(f"查询 AList 存储列表异常: {e}")

    # 4. 检查夸克 Client 登录与 Cookie 效验
    print("\n[Step 4/6] 检查夸克网盘 Cookie 凭据有效性...")
    try:
        st_detail = httpx.get(f'{alist_url}/api/admin/storage/get?id=2', headers=headers, trust_env=False)
        addition = json.loads(st_detail.json().get('data', {}).get('addition', '{}'))
        quark_cookie = addition.get('cookie', '')
        if quark_cookie:
            print("  ✅ AList 夸克驱动已配置有 Cookie (包含 _UP_A4_BASE_ID 等)")
        else:
            print("  ❌ 夸克驱动未发现有效 Cookie，转存功能受限！")
            issues.append("夸克驱动缺少 Cookie")
    except Exception as e:
        print(f"  ❌ 检查夸克 Cookie 异常: {e}")

    # 5. 检查 AList 强刷夸克网盘缓存能力
    print("\n[Step 5/6] 检查 AList 实时缓存强刷机制...")
    try:
        ref_res = httpx.post(f'{alist_url}/api/fs/list', json={'path': '/夸克网盘', 'refresh': True}, headers=headers, trust_env=False)
        if ref_res.status_code == 200 and ref_res.json().get('code') == 200:
            count = len(ref_res.json().get('data', {}).get('content') or [])
            print(f"  ✅ AList 强刷 [/夸克网盘] 成功，实时感知到夸克云盘 {count} 个文件项！")
        else:
            print(f"  ❌ AList 强刷 [/夸克网盘] 异常: {ref_res.text}")
            issues.append("AList 强刷 /夸克网盘 路径返回异常")
    except Exception as e:
        print(f"  ❌ 强刷 AList 路径异常: {e}")

    # 6. 检查 AList Copy 任务与落盘引擎
    print("\n[Step 6/6] 检查 AList 原生任务引擎 (Copy / Download Task)...")
    try:
        undone = httpx.get(f'{alist_url}/api/admin/task/copy/undone', headers=headers, trust_env=False).json()
        done = httpx.get(f'{alist_url}/api/admin/task/copy/done', headers=headers, trust_env=False).json()
        print(f"  ✅ AList 任务引擎工作正常！未完成 Copy 任务: {len(undone.get('data') or [])} 项 | 已完成历史: {len(done.get('data') or [])} 项")
    except Exception as e:
        print(f"  ❌ 检查 AList 任务引擎异常: {e}")

    # 总结与诊断结论
    print("\n" + "=" * 65)
    if not issues:
        print(" 🎉 诊断完成！觅影 (Seeker) 全链路环境 100% 健康，完全具备物理落盘能力！")
    else:
        print(f" ⚠️ 诊断完成！发现 {len(issues)} 个可能影响物理落盘的隐患项:")
        for idx, iss in enumerate(issues, 1):
            print(f"   {idx}. {iss}")
    print("=" * 65)

if __name__ == '__main__':
    run_doctor_check()

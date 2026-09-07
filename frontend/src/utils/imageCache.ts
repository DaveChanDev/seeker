// -------------------------------------------------------------
// 🖼️ Seeker 高性能浏览器图片缓存管理器 (CacheStorage + 0ms 秒开)
// -------------------------------------------------------------

const CACHE_NAME = 'seeker-poster-cache-v1'
const CACHE_META_KEY = 'seeker_poster_meta_v1'

interface CacheMetaItem {
  url: string
  size: number
  cachedAt: number
  lastAccessed: number
}

// 内存中的 Blob URL 映射表，避免多次创建 URL.createObjectURL
const memoryBlobMap = new Map<string, string>()

export const ImageCacheManager = {
  /**
   * 获取缓存的图片 URL (若命中缓存返回 blob: 内存URL，0ms 渲染；若未命中则后台下载并缓存)
   */
  async getOrCacheImage(url: string): Promise<string> {
    if (!url || typeof window === 'undefined' || !('caches' in window)) {
      return url
    }

    // 1. 内存已有直接返回
    if (memoryBlobMap.has(url)) {
      return memoryBlobMap.get(url)!
    }

    try {
      const cache = await caches.open(CACHE_NAME)
      const cachedResp = await cache.match(url)

      if (cachedResp && cachedResp.ok) {
        const blob = await cachedResp.blob()
        const blobUrl = URL.createObjectURL(blob)
        memoryBlobMap.set(url, blobUrl)
        this.updateMetaAccess(url)
        return blobUrl
      }

      // 未命中，后台静默拉取并写入 CacheStorage
      fetch(url, { mode: 'cors', credentials: 'omit' })
        .then(async (resp) => {
          if (resp.ok) {
            const clone = resp.clone()
            await cache.put(url, clone)
            const blob = await resp.blob()
            const blobUrl = URL.createObjectURL(blob)
            memoryBlobMap.set(url, blobUrl)
            this.recordMetaItem(url, blob.size)
          }
        })
        .catch(() => {})

      return url
    } catch (e) {
      return url
    }
  },

  /**
   * 记录缓存元数据
   */
  recordMetaItem(url: string, size: number) {
    try {
      const raw = localStorage.getItem(CACHE_META_KEY)
      const map: Record<string, CacheMetaItem> = raw ? JSON.parse(raw) : {}
      const now = Date.now()
      map[url] = {
        url,
        size,
        cachedAt: now,
        lastAccessed: now,
      }
      localStorage.setItem(CACHE_META_KEY, JSON.stringify(map))
    } catch (e) {}
  },

  /**
   * 更新访问时间
   */
  updateMetaAccess(url: string) {
    try {
      const raw = localStorage.getItem(CACHE_META_KEY)
      if (!raw) return
      const map: Record<string, CacheMetaItem> = JSON.parse(raw)
      if (map[url]) {
        map[url].lastAccessed = Date.now()
        localStorage.setItem(CACHE_META_KEY, JSON.stringify(map))
      }
    } catch (e) {}
  },

  /**
   * 获取当前缓存统计 (条数与体积 MB)
   */
  async getStats(): Promise<{ count: number; sizeMB: string }> {
    try {
      if (typeof window === 'undefined' || !('caches' in window)) {
        return { count: 0, sizeMB: '0.0' }
      }
      const cache = await caches.open(CACHE_NAME)
      const keys = await cache.keys()
      const raw = localStorage.getItem(CACHE_META_KEY)
      const map: Record<string, CacheMetaItem> = raw ? JSON.parse(raw) : {}

      let totalBytes = 0
      for (const k of keys) {
        const item = map[k.url]
        totalBytes += item ? item.size : 150 * 1024 // 估算 150KB
      }

      const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1)
      return { count: keys.length, sizeMB }
    } catch (e) {
      return { count: 0, sizeMB: '0.0' }
    }
  },

  /**
   * 一键清空所有图片缓存
   */
  async clearAll(): Promise<boolean> {
    try {
      // 释放内存 Blob URL
      for (const bUrl of memoryBlobMap.values()) {
        try {
          URL.revokeObjectURL(bUrl)
        } catch (e) {}
      }
      memoryBlobMap.clear()

      if (typeof window !== 'undefined' && 'caches' in window) {
        await caches.delete(CACHE_NAME)
      }
      localStorage.removeItem(CACHE_META_KEY)
      return true
    } catch (e) {
      console.warn('Clear image cache error:', e)
      return false
    }
  },

  /**
   * 自动定期清理超过 maxAgeDays (默认 14 天) 的陈旧缓存
   */
  async autoPrune(maxAgeDays = 14) {
    try {
      if (typeof window === 'undefined' || !('caches' in window)) return
      const raw = localStorage.getItem(CACHE_META_KEY)
      if (!raw) return
      const map: Record<string, CacheMetaItem> = JSON.parse(raw)
      const now = Date.now()
      const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000

      const cache = await caches.open(CACHE_NAME)
      let changed = false

      for (const [url, item] of Object.entries(map)) {
        if (now - (item.lastAccessed || item.cachedAt) > maxAgeMs) {
          await cache.delete(url)
          delete map[url]
          changed = true
          if (memoryBlobMap.has(url)) {
            URL.revokeObjectURL(memoryBlobMap.get(url)!)
            memoryBlobMap.delete(url)
          }
        }
      }

      if (changed) {
        localStorage.setItem(CACHE_META_KEY, JSON.stringify(map))
      }
    } catch (e) {}
  },
}

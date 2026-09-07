import { create } from 'zustand'

export interface PanSouItem {
  id: string
  title: string
  link: string
  password?: string
  netdisk: string
  size: string
  datetime: string
  weight?: number
  five_tags?: string[]
  badge?: string
  res?: string
  source_type?: string
  source?: string
}

export interface MovieMeta {
  title: string
  original_title?: string
  rating?: string | number
  year?: string
  cover?: string
  tags?: string[]
  summary?: string
}

export interface QuarkFile {
  id: string
  name: string
  size: string
  size_bytes?: number
  is_dir: boolean
  is_video: boolean
}

export interface NasFolder {
  name: string
  path: string
}

export interface SniffResult {
  status: string
  mode: 'movie_direct' | 'existing_tv' | 'new_tv'
  type: 'movie' | 'tv'
  target_path: string
  display_path: string
  need_mkdir: boolean
  folder_name?: string
  matched_folder?: string
  suggest_folder_name?: string
  message: string
  recommend_title: string
}

export interface NotificationItem {
  id: string
  time: string
  title: string
  desc: string
  type: string
}

export interface AiTierItem {
  id: string
  tag?: string
  label: string
  resolution: string
  estimated_size: string
  highlight: string
  is_default?: boolean
  raw_candidate?: PanSouItem
}

export interface FranchiseTimelineItem {
  title: string
  year: string
  is_current: boolean
  keyword: string
}

export interface FranchiseTimeline {
  universe_name: string
  timeline: FranchiseTimelineItem[]
}

export interface AiRecommendation {
  best_resource_id: string
  media_type: 'movie' | 'tv'
  normalized_title: string
  season?: number
  year?: string
  resolution: string
  estimated_size: string
  quality_score: number
  recommend_reason: string
  viewing_tip?: string
  franchise_timeline?: FranchiseTimeline
  recommended_tiers?: AiTierItem[]
  tiers?: {
    best_4k?: AiTierItem
    best_1080p?: AiTierItem
    best_special?: AiTierItem
  }
  default_tier?: 'best_4k' | 'best_1080p' | 'best_special'
  selected_tier?: string
  selected_tier_id?: string
  is_tv: boolean
  engine: 'gemini_3.5_flash_lite' | 'gemini_2.5_flash' | 'rule_fallback'
  raw_candidate?: PanSouItem
  alternative_versions?: Array<{ label: string; keyword: string }>
}

export interface CuratedMovieItem {
  title: string
  original_title?: string
  year?: string
  score?: string
  tags?: string[]
  reason?: string
  search_keyword: string
}

export interface AiCurateResult {
  intent_summary: string
  curated_list: CuratedMovieItem[]
}

export interface AiDiffResult {
  total_remote_video_count: number
  selected_count: number
  skipped_count: number
  selected_file_ids: string[]
  selected_files: Array<{ id: string; name: string; episode: number | null }>
  skipped_files: Array<{ id: string; name: string; episode: number | null; reason: string }>
  remote_episodes: number[]
  local_episodes: number[]
  missing_episodes: number[]
  diff_summary: string
}

export interface SubscriptionItem {
  id: string
  title: string
  year?: string
  folder_path: string
  share_url: string
  password?: string
  pdir_fid?: string
  res_preference?: string
  local_episodes: number[]
  total_local: number
  remote_episodes?: number[]
  missing_episodes?: number[]
  status: 'up_to_date' | 'has_updates' | 'checking'
  last_checked_at?: string
  created_at: string
}

export interface LocalTvShowItem {
  title: string
  folder_name: string
  folder_path: string
  episodes: number[]
  total_episodes: number
}

export interface JellyfinItem {
  id: string
  title: string
  original_title?: string
  type: 'Movie' | 'Series'
  year?: string
  rating?: number
  official_rating?: string
  overview?: string
  genres?: string[]
  people?: string[]
  studios?: string[]
  poster_url: string
  cover?: string
  raw_cover?: string
  backdrop_url?: string
}

export interface DownloadTaskItem {
  id: string
  title: string
  filesCount: number
  targetPath: string
  status: 'downloading' | 'completed' | 'failed'
  progress: number
  size?: string
  speed?: string
  eta?: string
  message?: string
  startTime: string
}

interface AppState {
  query: string
  setQuery: (q: string) => void
  loading: boolean
  searched: boolean
  movieMeta: MovieMeta | null
  
  allSearchResults: PanSouItem[]
  visibleSearchResults: PanSouItem[]
  hasMoreResults: boolean
  loadMoreResults: () => Promise<void>
  
  hotboard: any[]
  trending: any[]
  categories: Record<string, any>
  fetchCategories: () => Promise<void>

  // 🎯 精选片库 / 自由探索模式
  libraryMode: 'curated' | 'explore'
  setLibraryMode: (mode: 'curated' | 'explore') => void
  exploreFilter: {
    media_type: 'movie' | 'tv'
    genre: string
    country: string
    year_range: string
    sort_by: string
    min_rating: number
    only_uncollected: boolean
  }
  setExploreFilter: (patch: Partial<{
    media_type: 'movie' | 'tv'
    genre: string
    country: string
    year_range: string
    sort_by: string
    min_rating: number
    only_uncollected: boolean
  }>) => void
  exploreItems: any[]
  explorePage: number
  exploreTotalPages: number
  exploreTotalResults: number
  loadingExplore: boolean
  loadingMoreExplore: boolean
  fetchExplore: (resetPage?: boolean) => Promise<void>
  loadMoreExplore: () => Promise<void>
  
  // Jellyfin 媒体库
  jellyfinMedia: { movies: JellyfinItem[]; series: JellyfinItem[] }
  loadingJellyfin: boolean
  fetchJellyfinMedia: (force?: boolean) => Promise<void>

  // 查看更多 Modal
  jellyfinDetailModalVisible: boolean
  jellyfinDetailType: 'All' | 'Movie' | 'Series' | null
  openJellyfinDetail: (type: 'All' | 'Movie' | 'Series') => void
  setJellyfinDetailType: (type: 'All' | 'Movie' | 'Series') => void
  closeJellyfinDetail: () => void

  // 影片卡片详情 Modal
  selectedJellyfinItem: JellyfinItem | null
  jellyfinItemModalVisible: boolean
  openJellyfinItemModal: (item: JellyfinItem) => void
  closeJellyfinItemModal: () => void

  // 下载任务列表
  downloadTasks: DownloadTaskItem[]
  fetchDownloadTasks: () => Promise<void>
  addDownloadTask: (task: any) => void
  removeDownloadTask: (id: string) => void

  // Popup 选集与 NAS 路径 (起点为 /data/movies)
  popupVisible: boolean
  popupStep: 1 | 2 | 3
  selectedResource: PanSouItem | null
  quarkFiles: QuarkFile[]
  quarkParseError: string
  selectedFileIds: string[]
  fileCustomNames: Record<string, string>
  setFileCustomName: (id: string, customName: string) => void
  quarkPdirFid: string
  quarkPathHistory: { fid: string; name: string }[]
  customFolderName: string
  setCustomFolderName: (name: string) => void
  targetMediaType: 'tv' | 'movie'
  setTargetMediaType: (type: 'tv' | 'movie') => void
  currentNasPath: string
  parentNasPath: string
  nasFolders: NasFolder[]
  loadingFiles: boolean
  loadingNas: boolean

  notifPopupVisible: boolean
  cookieModalVisible: boolean
  notifications: NotificationItem[]
  hasUnreadNotifications: boolean
  markNotificationsRead: () => void
  clearNotifications: () => void
  quarkCookie: string
  setNotifPopupVisible: (v: boolean) => void
  setCookieModalVisible: (v: boolean) => void
  fetchNotifications: () => Promise<void>
  saveQuarkCookie: (cookieStr: string) => Promise<boolean>

  // 智能归档建议嗅探
  sniffResult: SniffResult | null
  loadingSniff: boolean
  useManualPath: boolean
  setUseManualPath: (v: boolean) => void
  sniffNasPath: (title: string, year?: string, mediaType?: string) => Promise<void>

  searchHistory: string[]
  addSearchHistory: (kw: string) => void
  search: (kw: string) => Promise<void>
  fetchHotboard: () => Promise<void>
  fetchTrending: () => Promise<void>

  // ✨ Gemini AI 智能选片与极简两步流
  aiRecommendation: AiRecommendation | null
  loadingAiRecommend: boolean
  fetchAiRecommendation: (kw: string, candidates: PanSouItem[], meta: MovieMeta | null) => Promise<void>
  aiCurateResult: AiCurateResult | null
  loadingAiCurate: boolean
  fetchAiCurate: (kw: string) => Promise<void>
  aiConfirmModalVisible: boolean
  setAiConfirmModalVisible: (v: boolean) => void
  loadingAiAction: boolean
  aiDiffResult: AiDiffResult | null
  selectAiTier: (tierKey: 'best_4k' | 'best_1080p' | 'best_special') => void
  selectAiTierItem: (targetTier: AiTierItem) => void
  startAiOneClickFlow: () => Promise<void>
  executeAiDownload: () => Promise<boolean>
  folderChildrenMap: Record<string, QuarkFile[]>
  loadingFolderIds: string[]
  fetchFolderChildren: (folderId: string, folderName: string) => Promise<void>
  setCurrentNasPath: (p: string) => void
  
  // 🔔 追剧订阅与智能增量追更
  subscriptions: SubscriptionItem[]
  loadingSubscriptions: boolean
  subscriptionModalVisible: boolean
  setSubscriptionModalVisible: (v: boolean) => void
  localTvShows: LocalTvShowItem[]
  fetchSubscriptions: () => Promise<void>
  addSubscription: (sub: { title: string; year?: string; folder_path?: string; share_url: string; password?: string; pdir_fid?: string; res_preference?: string }) => Promise<boolean>
  deleteSubscription: (id: string) => Promise<boolean>
  fetchLocalTvShows: () => Promise<void>
  
  openDownloadPopup: (item: PanSouItem) => void
  closeDownloadPopup: () => void
  fetchQuarkFiles: (pdirFid?: string, folderName?: string) => Promise<void>
  popQuarkPathHistory: () => Promise<void>
  setPopupStep: (step: 1 | 2 | 3) => void
  setSelectedFileIds: (ids: string[]) => void
  toggleSelectAllFiles: () => void
  fetchNasPath: (path?: string) => Promise<void>
  createNasFolder: (folderName: string) => Promise<string | null>
}

const API_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8899'
const PAGE_SIZE = 5

const loadInitialJellyfinMedia = () => {
  try {
    const raw = localStorage.getItem('popcorn_jellyfin_media')
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return { movies: [], series: [] }
}

const loadInitialHotboard = () => {
  try {
    const raw = localStorage.getItem('popcorn_hotboard')
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return []
}

const loadInitialNotifications = (): NotificationItem[] => {
  try {
    const raw = localStorage.getItem('popcorn_notifications')
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return []
}

const loadInitialNotifiedKeys = (): Set<string> => {
  try {
    const raw = localStorage.getItem('popcorn_notified_task_keys')
    if (raw) return new Set(JSON.parse(raw))
  } catch (e) {}
  return new Set<string>()
}

const notifiedTaskKeys = loadInitialNotifiedKeys()

const saveNotifiedKeys = () => {
  try {
    localStorage.setItem('popcorn_notified_task_keys', JSON.stringify(Array.from(notifiedTaskKeys)))
  } catch (e) {}
}

const loadInitialTrending = () => {
  try {
    const raw = localStorage.getItem('popcorn_trending')
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return []
}

export const generateDefaultFolderName = (rawTitle: string, meta?: MovieMeta | null) => {
  if (meta && meta.title && meta.title.trim()) {
    const mTitle = meta.title.trim()
    const mYear = meta.year ? String(meta.year).trim() : ''
    if (mYear && !mTitle.includes(mYear)) {
      return `${mTitle} (${mYear})`
    }
    return mTitle
  }

  if (!rawTitle) return '未命名影视'

  let cleaned = rawTitle
    .replace(/\[(夸克下载|夸克|下载|电影|电视剧|动漫|综艺|网盘|WEB-MKV|8\.4G|GB|MB|1080P|2160P|4K|全\d+集|\d+期|日英双语|中字|豆瓣评分[\d\.]+)\]/gi, '')
    .replace(/【(夸克下载|夸克|下载|电影|电视剧|动漫|综艺|网盘|WEB-MKV|8\.4G|GB|MB|1080P|2160P|4K|全\d+集|\d+期|日英双语|中字|豆瓣评分[\d\.]+)】/gi, '')

  const yearMatch = rawTitle.match(/\b(19\d\d|20\d\d)\b/)
  const year = yearMatch ? yearMatch[1] : ''

  cleaned = cleaned.replace(/[【\]\[\]]/g, ' ').replace(/https?:\/\/[^\s]+/g, '')
  cleaned = cleaned.replace(/\b(19\d\d|20\d\d)\b/g, '')
  cleaned = cleaned.replace(/[^\w\s\u4e00-\u9fa5：·]/g, ' ').trim()
  cleaned = cleaned.replace(/\s+/g, ' ')

  if (!cleaned) cleaned = '未命名影视'

  if (year && !cleaned.includes(year)) {
    return `${cleaned} (${year})`
  }
  return cleaned
}

const loadInitialHasUnread = () => {
  try {
    const notifs = loadInitialNotifications()
    if (!notifs || notifs.length === 0) return false
    const val = localStorage.getItem('seeker_notif_read')
    if (val === 'true') return false
  } catch (e) {}
  return true
}

const loadInitialSearchHistory = () => {
  try {
    const raw = localStorage.getItem('popcorn_search_history')
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return ['沙丘 2', '三体', '边缘行者', '奥本海默', '星际穿越']
}

export const useAppStore = create<AppState>((set, get) => ({
  query: '',
  setQuery: (q) => set({ query: q }),
  loading: false,
  searched: false,
  movieMeta: null,
  allSearchResults: [],
  visibleSearchResults: [],
  hasMoreResults: false,
  hotboard: loadInitialHotboard(),
  trending: loadInitialTrending(),
  categories: {},

  libraryMode: 'explore',
  setLibraryMode: (mode) => set({ libraryMode: mode }),
  exploreFilter: {
    media_type: 'movie',
    genre: 'all',
    country: 'all',
    year_range: 'all',
    sort_by: 'popularity.desc',
    min_rating: 0,
    only_uncollected: false,
  },
  setExploreFilter: (patch) => {
    const current = get().exploreFilter
    set({ exploreFilter: { ...current, ...patch } })
    get().fetchExplore(true)
  },
  exploreItems: [],
  explorePage: 1,
  exploreTotalPages: 1,
  exploreTotalResults: 0,
  loadingExplore: false,
  loadingMoreExplore: false,

  jellyfinMedia: loadInitialJellyfinMedia(),
  loadingJellyfin: false,
  jellyfinDetailModalVisible: false,
  jellyfinDetailType: null,
  selectedJellyfinItem: null,
  jellyfinItemModalVisible: false,
  downloadTasks: [],

  openJellyfinDetail: (type) => set({ jellyfinDetailModalVisible: true, jellyfinDetailType: type }),
  setJellyfinDetailType: (type) => set({ jellyfinDetailType: type }),
  closeJellyfinDetail: () => set({ jellyfinDetailModalVisible: false, jellyfinDetailType: null }),

  openJellyfinItemModal: (item) => set({ jellyfinItemModalVisible: true, selectedJellyfinItem: item }),
  closeJellyfinItemModal: () => set({ jellyfinItemModalVisible: false, selectedJellyfinItem: null }),

  popupVisible: false,
  popupStep: 1,
  selectedResource: null,
  quarkFiles: [],
  quarkParseError: '',
  selectedFileIds: [],
  notifPopupVisible: false,
  cookieModalVisible: false,
  notifications: loadInitialNotifications(),
  hasUnreadNotifications: loadInitialHasUnread(),
  markNotificationsRead: () => {
    try {
      localStorage.setItem('seeker_notif_read', 'true')
    } catch (e) {}
    set({ hasUnreadNotifications: false })
  },
  clearNotifications: () => {
    try {
      localStorage.removeItem('popcorn_notifications')
      localStorage.setItem('seeker_notif_read', 'true')
    } catch (e) {}
    set({ notifications: [], hasUnreadNotifications: false })
  },
  quarkCookie: '',

  setNotifPopupVisible: (v) => set({ notifPopupVisible: v }),
  setCookieModalVisible: (v) => set({ cookieModalVisible: v }),

  searchHistory: loadInitialSearchHistory(),
  addSearchHistory: (kw: string) => {
    const cleanKw = kw.trim()
    if (!cleanKw) return
    const current = get().searchHistory
    const filtered = current.filter(item => item.toLowerCase() !== cleanKw.toLowerCase())
    const updated = [cleanKw, ...filtered].slice(0, 8)
    try {
      localStorage.setItem('popcorn_search_history', JSON.stringify(updated))
    } catch (e) {}
    set({ searchHistory: updated })
  },

  fetchJellyfinMedia: async (force?: boolean) => {
    if (get().jellyfinMedia.movies.length === 0 && get().jellyfinMedia.series.length === 0) {
      set({ loadingJellyfin: true })
    }
    try {
      const url = `${API_BASE}/api/jellyfin/media${force ? '?force=true' : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.code === 200 && data.data) {
        const mediaObj = {
          movies: data.data.movies || [],
          series: data.data.series || [],
        }
        try {
          localStorage.setItem('popcorn_jellyfin_media', JSON.stringify(mediaObj))
        } catch (e) {}
        set({
          jellyfinMedia: mediaObj,
          loadingJellyfin: false,
        })
      } else {
        set({ loadingJellyfin: false })
      }
    } catch (err) {
      console.error('Fetch jellyfin media error:', err)
      set({ loadingJellyfin: false })
    }
  },

  fetchDownloadTasks: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/download/tasks`)
      const data = await res.json()
      if (data && Array.isArray(data.tasks)) {
        const fetchedTasks: DownloadTaskItem[] = data.tasks
        set({ downloadTasks: fetchedTasks })

        // 自动比较任务状态变迁，向铃铛推单
        fetchedTasks.forEach((task) => {
          const isDone = task.status === 'completed' || task.progress >= 100
          const isFailed = task.status === 'failed'
          const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

          if (isDone) {
            const key = `${task.id}_completed`
            if (!notifiedTaskKeys.has(key)) {
              notifiedTaskKeys.add(key)
              saveNotifiedKeys()
              const cur = get().notifications || []
              const newNotif: NotificationItem = {
                id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                time: timeStr,
                title: '下载完成通知',
                desc: `✅ ${task.title} 已下载完毕！`,
                type: 'completed',
              }
              const updated = [newNotif, ...cur].slice(0, 30)
              try { localStorage.setItem('popcorn_notifications', JSON.stringify(updated)) } catch (e) {}
              try { localStorage.removeItem('seeker_notif_read') } catch (e) {}
              set({ notifications: updated, hasUnreadNotifications: true })
            }
          } else if (isFailed) {
            const key = `${task.id}_failed`
            if (!notifiedTaskKeys.has(key)) {
              notifiedTaskKeys.add(key)
              saveNotifiedKeys()
              const cur = get().notifications || []
              const newNotif: NotificationItem = {
                id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                time: timeStr,
                title: '传输中断通知',
                desc: `❌ ${task.title} 传输中断，请检查`,
                type: 'failed',
              }
              const updated = [newNotif, ...cur].slice(0, 30)
              try { localStorage.setItem('popcorn_notifications', JSON.stringify(updated)) } catch (e) {}
              try { localStorage.removeItem('seeker_notif_read') } catch (e) {}
              set({ notifications: updated, hasUnreadNotifications: true })
            }
          } else {
            const key = `${task.id}_downloading`
            if (!notifiedTaskKeys.has(key)) {
              notifiedTaskKeys.add(key)
              saveNotifiedKeys()
              const cur = get().notifications || []
              const newNotif: NotificationItem = {
                id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                time: timeStr,
                title: '下载任务通知',
                desc: `⏳ ${task.title} 正在传输下载中...`,
                type: 'downloading',
              }
              const updated = [newNotif, ...cur].slice(0, 30)
              try { localStorage.setItem('popcorn_notifications', JSON.stringify(updated)) } catch (e) {}
              try { localStorage.removeItem('seeker_notif_read') } catch (e) {}
              set({ notifications: updated, hasUnreadNotifications: true })
            }
          }
        })
      }
    } catch (err) {
      console.error('Fetch download tasks error:', err)
    }
  },

  addDownloadTask: (task) => {
    const currentTasks = Array.isArray(get().downloadTasks) ? get().downloadTasks : []
    const newTask: DownloadTaskItem = {
      id: (task as any)?.id || `task_${Date.now()}`,
      title: task?.title || '影视归档任务',
      filesCount: task?.filesCount || 1,
      targetPath: task?.targetPath || '',
      status: task?.status || 'downloading',
      progress: typeof task?.progress === 'number' ? task.progress : 5,
      size: task?.size || '大小计算中',
      startTime: task?.startTime || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    }

    const key = `${newTask.id}_downloading`
    notifiedTaskKeys.add(key)
    saveNotifiedKeys()
    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const curNotifs = get().notifications || []
    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      time: timeStr,
      title: '下载任务通知',
      desc: `⏳ ${newTask.title} 正在传输下载中...`,
      type: 'downloading',
    }
    const updatedNotifs = [newNotif, ...curNotifs].slice(0, 30)
    try { localStorage.setItem('popcorn_notifications', JSON.stringify(updatedNotifs)) } catch (e) {}
    try { localStorage.removeItem('seeker_notif_read') } catch (e) {}

    set({
      downloadTasks: [newTask, ...currentTasks.filter((t) => t.id !== newTask.id)],
      notifications: updatedNotifs,
      hasUnreadNotifications: true,
    })
  },

  removeDownloadTask: async (id) => {
    set({ downloadTasks: get().downloadTasks.filter((t) => t.id !== id) })
    try {
      await fetch(`${API_BASE}/api/download/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: id }),
      })
    } catch (e) {}
  },

  fetchNotifications: async () => {
    // 保持本地基于实际下载任务通知为主，不做测试假数据强覆盖
  },

  saveQuarkCookie: async (cookieStr: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/quark_cookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookieStr }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        set({ quarkCookie: cookieStr, cookieModalVisible: false })
        return true
      }
    } catch (err) {
      console.error('Save quark cookie error:', err)
    }
    return false
  },

  // ✨ Gemini AI 智能选片与状态
  aiRecommendation: null,
  loadingAiRecommend: false,
  aiCurateResult: null,
  loadingAiCurate: false,
  aiConfirmModalVisible: false,
  setAiConfirmModalVisible: (v) => set({ aiConfirmModalVisible: v }),
  loadingAiAction: false,
  aiDiffResult: null,
  folderChildrenMap: {},
  loadingFolderIds: [],
  setCurrentNasPath: (p) => set({ currentNasPath: p }),

  // 🔔 追剧订阅与智能增量追更
  subscriptions: [],
  loadingSubscriptions: false,
  subscriptionModalVisible: false,
  setSubscriptionModalVisible: (v) => set({ subscriptionModalVisible: v }),
  localTvShows: [],

  fetchSubscriptions: async () => {
    set({ loadingSubscriptions: true })
    try {
      const res = await fetch(`${API_BASE}/api/subscriptions`)
      if (res.ok) {
        const data = await res.json()
        set({ subscriptions: data.subscriptions || [], loadingSubscriptions: false })
        return
      }
    } catch (e) {
      console.error('Fetch subscriptions error:', e)
    }
    set({ loadingSubscriptions: false })
  },

  addSubscription: async (sub) => {
    try {
      const res = await fetch(`${API_BASE}/api/subscriptions/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      if (res.ok) {
        get().fetchSubscriptions()
        return true
      }
    } catch (e) {
      console.error('Add subscription error:', e)
    }
    return false
  },

  deleteSubscription: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/subscriptions/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        get().fetchSubscriptions()
        return true
      }
    } catch (e) {
      console.error('Delete subscription error:', e)
    }
    return false
  },

  fetchLocalTvShows: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/fs/local_tv_shows`)
      if (res.ok) {
        const data = await res.json()
        set({ localTvShows: data.shows || [] })
      }
    } catch (e) {
      console.error('Fetch local tv shows error:', e)
    }
  },

  fetchAiCurate: async (kw: string) => {
    set({ loadingAiCurate: true })
    try {
      const res = await fetch(`${API_BASE}/api/ai/curate?q=${encodeURIComponent(kw)}`)
      if (res.ok) {
        const data = await res.json()
        if (data && data.curated_list && data.curated_list.length > 0) {
          set({ aiCurateResult: data, loadingAiCurate: false })
          return
        }
      }
    } catch (e) {
      console.error('Fetch AI curate error:', e)
    }
    set({ aiCurateResult: null, loadingAiCurate: false })
  },

  fetchAiRecommendation: async (kw: string, candidates: PanSouItem[], meta: MovieMeta | null) => {
    set({ loadingAiRecommend: true })
    try {
      const res = await fetch(`${API_BASE}/api/ai/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: kw,
          candidates: candidates,
          media_meta: meta || {},
        }),
      })
      if (res.ok) {
        const data: AiRecommendation = await res.json()
        if (data.default_tier && !data.selected_tier) {
          data.selected_tier = data.default_tier
        }
        set({ aiRecommendation: data, loadingAiRecommend: false })
      } else {
        set({ loadingAiRecommend: false })
      }
    } catch (e) {
      console.error('Fetch AI recommendation error:', e)
      set({ loadingAiRecommend: false })
    }
  },

  selectAiTier: (tierKey: 'best_4k' | 'best_1080p' | 'best_special') => {
    const aiRec = get().aiRecommendation
    if (!aiRec || !aiRec.tiers) return
    const targetTier = aiRec.tiers[tierKey]
    if (!targetTier) return

    set({
      aiRecommendation: {
        ...aiRec,
        selected_tier: tierKey,
        selected_tier_id: targetTier.id,
        best_resource_id: targetTier.id,
        resolution: targetTier.resolution || aiRec.resolution,
        estimated_size: targetTier.estimated_size || aiRec.estimated_size,
        recommend_reason: targetTier.highlight || aiRec.recommend_reason,
        raw_candidate: targetTier.raw_candidate || aiRec.raw_candidate,
      },
    })
  },

  selectAiTierItem: (targetTier: AiTierItem) => {
    const aiRec = get().aiRecommendation
    if (!aiRec || !targetTier) return

    set({
      aiRecommendation: {
        ...aiRec,
        selected_tier_id: targetTier.id,
        best_resource_id: targetTier.id,
        resolution: targetTier.resolution || aiRec.resolution,
        estimated_size: targetTier.estimated_size || aiRec.estimated_size,
        recommend_reason: targetTier.highlight || aiRec.recommend_reason,
        raw_candidate: targetTier.raw_candidate || aiRec.raw_candidate,
      },
    })
  },

  startAiOneClickFlow: async () => {
    const aiRec = get().aiRecommendation
    const allItems = get().allSearchResults
    const meta = get().movieMeta
    if (!aiRec) return

    set({ loadingAiAction: true, aiConfirmModalVisible: true, aiDiffResult: null })

    // 1. 匹配目标资源
    let targetCandidate = aiRec.raw_candidate
    if (!targetCandidate && aiRec.best_resource_id) {
      targetCandidate = allItems.find((x) => x.id === aiRec.best_resource_id)
    }
    if (!targetCandidate && allItems.length > 0) {
      targetCandidate = allItems[0]
    }
    if (!targetCandidate) {
      set({ loadingAiAction: false, aiConfirmModalVisible: false })
      return
    }

    set({ selectedResource: targetCandidate })

    // 2. 嗅探目标 NAS 路径
    const mediaTypeStr = aiRec.is_tv ? 'tv' : 'movie'
    const titleStr = aiRec.normalized_title || meta?.title || get().query
    const detectedYear = (aiRec.year || meta?.year || '').trim()
    
    let resolvedNasPath = aiRec.is_tv ? '/data/movies/电视剧' : '/data/movies/电影'
    let resolvedFolderName = ''
    try {
      const qParams = new URLSearchParams({
        title: titleStr,
        year: detectedYear,
        media_type: mediaTypeStr,
      })
      const sniffRes = await fetch(`${API_BASE}/api/fs/sniff?${qParams.toString()}`)
      if (sniffRes.ok) {
        const sniffData = await sniffRes.json()
        set({ sniffResult: sniffData })
        if (sniffData.target_path) {
          resolvedNasPath = sniffData.target_path
        }
        if (sniffData.mode === 'new_tv' && sniffData.suggest_folder_name) {
          resolvedFolderName = sniffData.suggest_folder_name
        }
      }
    } catch (e) {
      console.error('AI sniff error:', e)
    }

    set({
      currentNasPath: resolvedNasPath,
      customFolderName: resolvedFolderName,
      targetMediaType: aiRec.is_tv ? 'tv' : 'movie',
    })

    // 3. 解析网盘文件列表并智能多层深度穿透下钻
    const urlTarget = targetCandidate.link || targetCandidate.title
    const itemPwd = targetCandidate.password || ''
    const targetSeason = aiRec.season || 1
    let remoteFiles: QuarkFile[] = []
    let currentPdir = '0'
    let currentHistory = [{ fid: '0', name: '根目录' }]

    try {
      let fetchPdir = '0'
      let drillCount = 0
      const maxDrills = 8

      while (drillCount < maxDrills) {
        const parseRes = await fetch(
          `${API_BASE}/api/parse_quark?url=${encodeURIComponent(urlTarget)}&pwd=${encodeURIComponent(itemPwd)}&pdir_fid=${encodeURIComponent(fetchPdir)}`
        )
        if (!parseRes.ok) break
        const pData = await parseRes.json()
        const files: QuarkFile[] = pData.files || []
        if (files.length === 0) break

        remoteFiles = files
        currentPdir = fetchPdir
        set({ quarkFiles: remoteFiles, quarkPdirFid: currentPdir, quarkPathHistory: currentHistory })

        // 检查是否已经包含视频文件
        const hasVideos = files.some(
          (f) => f.is_video || (!f.is_dir && /\.(mkv|mp4|ts|mov|avi|flv|iso|rmvb|wmv)$/i.test(f.name))
        )
        if (hasVideos) {
          break
        }

        // 如果当前层全是文件夹
        const dirList = files.filter((f) => f.is_dir)
        if (dirList.length === 0) break

        // 策略 1: 优先下钻与目标季匹配的季文件夹
        let targetDir: QuarkFile | undefined = undefined
        if (aiRec.is_tv) {
          targetDir = dirList.find(
            (f) =>
              f.name.includes(`第${targetSeason}季`) ||
              (targetSeason === 1 && f.name.includes(`第一季`)) ||
              (targetSeason === 2 && f.name.includes(`第二季`)) ||
              (targetSeason === 3 && f.name.includes(`第三季`)) ||
              f.name.toLowerCase().includes(`season ${targetSeason}`) ||
              f.name.toLowerCase().includes(`s0${targetSeason}`) ||
              f.name.toLowerCase().includes(`s${targetSeason}`)
          )
        }

        // 策略 2: 只有 1 个子文件夹（如 "【台剧】不够善良的我们" 或 "龙之家族"），直接自动下钻
        if (!targetDir && dirList.length === 1) {
          targetDir = dirList[0]
        }

        if (targetDir) {
          fetchPdir = targetDir.id
          currentHistory = [...currentHistory, { fid: targetDir.id, name: targetDir.name }]
          drillCount++
          continue
        }

        // 无法进一步明确下钻，停止在当前目录
        break
      }
    } catch (e) {
      console.error('AI parse quark error:', e)
    }

    // 4. 智能 Diff 与标准刮削自动命名 (电影: 片名 (年份).mkv / 电视剧: 剧名 - S01E01.mkv)
    const customNamesMap: Record<string, string> = {}
    const baseCleanTitle = (aiRec.normalized_title || meta?.title || get().query).trim()
    const yearStr = (aiRec.year || meta?.year || '').trim()
    const movieDisplayName = yearStr && !baseCleanTitle.includes(yearStr) ? `${baseCleanTitle} (${yearStr})` : baseCleanTitle

    if (aiRec.is_tv && remoteFiles.length > 0) {
      let dData: AiDiffResult | null = null
      try {
        const localEps = (get().sniffResult as any)?.local_episodes || []
        const diffRes = await fetch(`${API_BASE}/api/ai/diff_episodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            remote_files: remoteFiles,
            local_episodes: localEps,
            target_season: targetSeason,
          }),
        })
        if (diffRes.ok) {
          dData = await diffRes.json()
          const validSelectedIds = dData?.selected_file_ids && dData.selected_file_ids.length > 0
            ? dData.selected_file_ids
            : remoteFiles.map((f) => f.id)
          set({
            aiDiffResult: dData,
            selectedFileIds: validSelectedIds,
          })
        } else {
          const videoIds = remoteFiles.filter((f) => f.is_video).map((f) => f.id)
          set({ selectedFileIds: videoIds.length > 0 ? videoIds : remoteFiles.map((f) => f.id) })
        }
      } catch (e) {
        console.error('AI diff error:', e)
        const videoIds = remoteFiles.filter((f) => f.is_video).map((f) => f.id)
        set({ selectedFileIds: videoIds.length > 0 ? videoIds : remoteFiles.map((f) => f.id) })
      }

      // 电视剧：自动重命名为 "剧名 - S01E01.mkv"
      const seasonPrefix = `S${String(targetSeason).padStart(2, '0')}`
      remoteFiles.forEach((file) => {
        if (!file.is_dir) {
          const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/)
          const ext = extMatch ? `.${extMatch[1]}` : '.mkv'
          const matchedSelected = dData?.selected_files.find((sf) => sf.id === file.id)
          const epNum = matchedSelected?.episode ?? null
          if (epNum !== null && epNum !== undefined) {
            const epStr = `E${String(epNum).padStart(2, '0')}`
            customNamesMap[file.id] = `${baseCleanTitle} - ${seasonPrefix}${epStr}${ext}`
          } else {
            const cleanRaw = file.name.replace(/^[\[【][^\]】]*[\]】]/g, '').trim()
            customNamesMap[file.id] = cleanRaw || file.name
          }
        }
      })
    } else if (remoteFiles.length > 0) {
      // 电影：只对真正的视频文件应用标准规范重命名 "片名 (年份).mkv"，绝不篡改 pdf / mp3
      const genuineVideoFiles = remoteFiles.filter(
        (f) => !f.is_dir && (f.is_video || /\.(mkv|mp4|ts|mov|avi|flv|iso|rmvb|wmv|m2ts)$/i.test(f.name))
      )

      let primaryMovieId = ''
      if (genuineVideoFiles.length > 0) {
        // 按体积选最大那个为主视频文件 (如 1.76GB 的 mp4)
        const sortedVideos = [...genuineVideoFiles].sort((a, b) => (b.size_bytes || 0) - (a.size_bytes || 0))
        primaryMovieId = sortedVideos[0].id
        set({ selectedFileIds: [primaryMovieId] })
      } else {
        const nonAdFiles = remoteFiles.filter(
          (f) => !f.is_dir && !/\.(zip|rar|7z|txt|url|html|jpg|png|torrent|apk|exe|pdf|docx?|epub)$/i.test(f.name)
        )
        if (nonAdFiles.length > 0) {
          primaryMovieId = nonAdFiles[0].id
          set({ selectedFileIds: [primaryMovieId] })
        } else {
          set({ selectedFileIds: [] })
        }
      }

      remoteFiles.forEach((file) => {
        if (!file.is_dir) {
          const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/)
          const ext = extMatch ? `.${extMatch[1]}` : ''
          const isVid = file.is_video || /\.(mkv|mp4|ts|mov|avi|flv|iso|rmvb|wmv|m2ts)$/i.test(file.name)
          
          if (isVid && file.id === primaryMovieId) {
            // 只有被认定的主视频文件，才重命名为标准规范名: "千与千寻 (2001).mp4"
            customNamesMap[file.id] = `${movieDisplayName}${ext || '.mkv'}`
          } else if (/\.(srt|ass|ssa|vtt|sub|idx)$/i.test(file.name)) {
            // 外挂字幕规范化
            const subLang = file.name.includes('繁') ? '.cht' : file.name.includes('双语') ? '.chs&eng' : '.chs'
            customNamesMap[file.id] = `${movieDisplayName}${subLang}${ext}`
          } else {
            // 剧本 pdf、音频 mp3、说明文档等保留原名，绝对不要重命名为 "电影名.pdf" !
            customNamesMap[file.id] = file.name
          }
        }
      })
    }

    set({
      fileCustomNames: customNamesMap,
      loadingAiAction: false,
    })
  },

  fetchFolderChildren: async (folderId: string, folderName: string) => {
    const { selectedResource, folderChildrenMap, loadingFolderIds, aiRecommendation, movieMeta, fileCustomNames, query } = get()
    if (!selectedResource) return
    if (folderChildrenMap[folderId]) return // 已缓存

    set({ loadingFolderIds: [...loadingFolderIds, folderId] })
    try {
      const urlTarget = selectedResource.link || selectedResource.title
      const itemPwd = selectedResource.password || ''
      const res = await fetch(`${API_BASE}/api/parse_quark?url=${encodeURIComponent(urlTarget)}&pwd=${encodeURIComponent(itemPwd)}&pdir_fid=${encodeURIComponent(folderId)}`)
      if (res.ok) {
        const data = await res.json()
        const subFiles: QuarkFile[] = data.files || []

        // 生成默认标准刮削名称
        const baseTitle = (aiRecommendation?.normalized_title || movieMeta?.title || query).trim()
        const folderSeasonMatch = folderName.match(/(?:SE|Season|S)\s*0?(\d{1,2})|第\s*([0-9一二三四五六七八九十]+)\s*季/i)
        let sNum = aiRecommendation?.season || 1
        if (folderSeasonMatch) {
          const rawS = folderSeasonMatch[1] || folderSeasonMatch[2]
          sNum = parseInt(rawS) || sNum
        }
        const sPrefix = `S${String(sNum).padStart(2, '0')}`

        const updatedNames = { ...fileCustomNames }
        subFiles.forEach((f) => {
          if (!f.is_dir) {
            const extMatch = f.name.match(/\.([a-zA-Z0-9]+)$/)
            const ext = extMatch ? `.${extMatch[1]}` : '.mkv'
            const epMatch = f.name.match(/[eE][pP]?(\d{1,3})|第\s*(\d{1,3})\s*[集期話话]|\b(\d{1,3})\b/)
            if (epMatch) {
              const ep = parseInt(epMatch[1] || epMatch[2] || epMatch[3])
              updatedNames[f.id] = `${baseTitle} - ${sPrefix}E${String(ep).padStart(2, '0')}${ext}`
            } else {
              updatedNames[f.id] = f.name
            }
          }
        })

        set({
          folderChildrenMap: { ...folderChildrenMap, [folderId]: subFiles },
          fileCustomNames: updatedNames,
          loadingFolderIds: get().loadingFolderIds.filter((id) => id !== folderId),
        })
      }
    } catch (e) {
      console.error('Fetch folder children error:', e)
      set({ loadingFolderIds: get().loadingFolderIds.filter((id) => id !== folderId) })
    }
  },

  executeAiDownload: async () => {
    const {
      selectedResource,
      currentNasPath,
      customFolderName,
      selectedFileIds,
      quarkFiles,
      folderChildrenMap,
      fileCustomNames,
      quarkPdirFid,
      addDownloadTask,
      fetchDownloadTasks,
    } = get()

    if (!selectedResource) return false

    // 聚合根目录文件与所有子文件夹内展开的文件
    const allKnownFiles = [...(quarkFiles || [])]
    Object.values(folderChildrenMap).forEach((subList) => {
      subList.forEach((sf) => {
        if (!allKnownFiles.some((x) => x.id === sf.id)) {
          allKnownFiles.push(sf)
        }
      })
    })

    const selectedFilesMetadata = allKnownFiles
      .filter((f) => selectedFileIds.includes(f.id))
      .map((f) => ({
        ...f,
        custom_name: fileCustomNames[f.id] || f.name,
      }))

    try {
      const res = await fetch(`${API_BASE}/api/download/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_path: currentNasPath,
          folder_name: customFolderName || '',
          file_ids: selectedFileIds,
          files_metadata: selectedFilesMetadata,
          resource_title: selectedResource?.title || '',
          share_url: selectedResource?.link || '',
          password: selectedResource?.password || '',
          pdir_fid: quarkPdirFid || '0',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.task_item && typeof addDownloadTask === 'function') {
          addDownloadTask(data.task_item)
        }
        if (typeof fetchDownloadTasks === 'function') {
          fetchDownloadTasks()
        }
        set({ aiConfirmModalVisible: false })
        return true
      }
    } catch (e) {
      console.error('Execute AI download error:', e)
    }
    return false
  },

  search: async (kw: string) => {
    if (!kw.trim()) return
    get().addSearchHistory(kw)
    set({
      loading: true,
      searched: true,
      query: kw,
      visibleSearchResults: [],
      allSearchResults: [],
      hasMoreResults: false,
      aiRecommendation: null,
      loadingAiRecommend: true,
      aiDiffResult: null,
      aiCurateResult: null,
      loadingAiCurate: false,
    })

    const isIntentQuery = /(推荐|类似|适合|高分|神作|好看|有哪些|导演|榜单|最火|喜剧|科幻|悬疑|动漫|经典|美剧|韩剧|电影|电视剧)/.test(kw) || kw.trim().length >= 7
    if (isIntentQuery) {
      get().fetchAiCurate(kw)
    }

    try {
      const [metaRes, searchRes] = await Promise.all([
        fetch(`${API_BASE}/api/search_meta?q=${encodeURIComponent(kw)}`),
        fetch(`${API_BASE}/api/search_pansou?q=${encodeURIComponent(kw)}`),
      ])

      const meta: MovieMeta = await metaRes.json()
      const searchData = await searchRes.json()
      const allItems: PanSouItem[] = searchData.data || []

      const initialVisible = allItems.slice(0, PAGE_SIZE)
      const hasMore = allItems.length > PAGE_SIZE

      set({
        allSearchResults: allItems,
        visibleSearchResults: initialVisible,
        hasMoreResults: hasMore,
        movieMeta: meta,
        loading: false,
      })

      if (allItems.length > 0) {
        get().fetchAiRecommendation(kw, allItems, meta)
      } else {
        set({ loadingAiRecommend: false })
        if (!isIntentQuery) {
          get().fetchAiCurate(kw)
        }
      }
    } catch (err) {
      console.error('Search failed:', err)
      set({ loading: false, loadingAiRecommend: false })
    }
  },

  loadMoreResults: async () => {
    const { visibleSearchResults, allSearchResults } = get()
    const currentLen = visibleSearchResults.length
    if (currentLen >= allSearchResults.length) {
      set({ hasMoreResults: false })
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 300))

    const nextBatch = allSearchResults.slice(currentLen, currentLen + PAGE_SIZE)
    const newVisible = [...visibleSearchResults, ...nextBatch]
    set({
      visibleSearchResults: newVisible,
      hasMoreResults: newVisible.length < allSearchResults.length,
    })
  },

  fetchCategories: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/library/categories`)
      if (res.ok) {
        const payload = await res.json()
        if (payload.data) {
          set({ categories: payload.data })
        }
      }
    } catch (err) {
      console.error('Fetch categories error:', err)
    }
  },

  fetchExplore: async (resetPage = true) => {
    const state = get()
    const filter = state.exploreFilter
    const targetPage = resetPage ? 1 : state.explorePage
    if (resetPage) {
      set({ loadingExplore: true })
    } else {
      set({ loadingMoreExplore: true })
    }

    try {
      const params = new URLSearchParams({
        media_type: filter.media_type,
        genre: filter.genre,
        country: filter.country,
        year_range: filter.year_range,
        sort_by: filter.sort_by,
        min_rating: filter.min_rating.toString(),
        page: targetPage.toString(),
        only_uncollected: filter.only_uncollected.toString(),
      })
      const res = await fetch(`${API_BASE}/api/library/explore?${params.toString()}`)
      if (res.ok) {
        const payload = await res.json()
        if (payload.data) {
          const newItems = payload.data.items || []
          set({
            exploreItems: resetPage ? newItems : [...state.exploreItems, ...newItems],
            explorePage: payload.data.page || 1,
            exploreTotalPages: payload.data.total_pages || 1,
            exploreTotalResults: payload.data.total_results || 0,
          })
        }
      }
    } catch (err) {
      console.error('Fetch explore error:', err)
    } finally {
      set({ loadingExplore: false, loadingMoreExplore: false })
    }
  },

  loadMoreExplore: async () => {
    const state = get()
    if (state.loadingMoreExplore || state.explorePage >= state.exploreTotalPages) return
    const nextPage = state.explorePage + 1
    set({ explorePage: nextPage })
    await get().fetchExplore(false)
  },

  fetchHotboard: async () => {
    try {
      const rawTime = localStorage.getItem('popcorn_hotboard_time')
      if (rawTime && (Date.now() - parseInt(rawTime, 10) < 43200000) && get().hotboard.length > 0) {
        return
      }
    } catch (e) {}

    try {
      const res = await fetch(`${API_BASE}/api/hotboard?type=douban-movie`)
      const data = await res.json()
      const listData = data.list || data.data
      if (listData && listData.length > 0) {
        try {
          localStorage.setItem('popcorn_hotboard', JSON.stringify(listData))
          localStorage.setItem('popcorn_hotboard_time', Date.now().toString())
        } catch (e) {}
        set({ hotboard: listData })
      }
    } catch (err) {
      console.error('Fetch hotboard error:', err)
    }
  },

  fetchTrending: async () => {
    try {
      const rawTime = localStorage.getItem('popcorn_trending_time')
      if (rawTime && (Date.now() - parseInt(rawTime, 10) < 43200000) && get().trending.length > 0) {
        return
      }
    } catch (e) {}

    try {
      const res = await fetch(`${API_BASE}/api/trending`)
      const data = await res.json()
      const listData = data.list || data.data
      if (listData && listData.length > 0) {
        try {
          localStorage.setItem('popcorn_trending', JSON.stringify(listData))
          localStorage.setItem('popcorn_trending_time', Date.now().toString())
        } catch (e) {}
        set({ trending: listData })
      }
    } catch (err) {
      console.error('Fetch trending error:', err)
    }
  },

  quarkPdirFid: '0',
  quarkPathHistory: [{ fid: '0', name: '根目录' }],
  customFolderName: '',
  setCustomFolderName: (name) => set({ customFolderName: name }),
  fileCustomNames: {},
  setFileCustomName: (id, customName) => {
    set((state) => ({
      fileCustomNames: { ...state.fileCustomNames, [id]: customName },
    }))
  },

  sniffResult: null,
  loadingSniff: false,
  useManualPath: false,
  setUseManualPath: (v) => set({ useManualPath: v }),

  sniffNasPath: async (title: string, year?: string, mediaType?: string) => {
    set({ loadingSniff: true })
    try {
      const queryParams = new URLSearchParams({
        title: title || '',
        year: year || '',
        media_type: mediaType || '',
      })
      const res = await fetch(`${API_BASE}/api/fs/sniff?${queryParams.toString()}`)
      const data: SniffResult = await res.json()

      if (data && data.status === 'success') {
        let nasTarget = data.target_path
        let folderName = ''

        if (data.mode === 'new_tv' && data.suggest_folder_name) {
          folderName = data.suggest_folder_name
        }

        set({
          sniffResult: data,
          customFolderName: folderName,
          loadingSniff: false,
        })
      } else {
        set({ loadingSniff: false })
      }
    } catch (e) {
      console.error('Sniff error:', e)
      set({ loadingSniff: false })
    }
  },

  targetMediaType: 'tv',
  setTargetMediaType: (type) => {
    const defaultPath = type === 'tv' ? '/data/movies/电视剧' : '/data/movies/电影'
    set({
      targetMediaType: type,
      currentNasPath: defaultPath,
    })
    get().fetchNasPath(defaultPath)
  },
  currentNasPath: '/data/movies',
  parentNasPath: '/data',
  nasFolders: [],
  loadingFiles: false,
  loadingNas: false,

  openDownloadPopup: async (item) => {
    const meta = get().movieMeta
    const defaultFolderName = generateDefaultFolderName(item.title, meta)
    const initialPath = get().currentNasPath || '/data/movies'

    set({
      popupVisible: true,
      popupStep: 1,
      selectedResource: item,
      loadingFiles: true,
      loadingSniff: false,
      quarkFiles: [],
      quarkParseError: '',
      selectedFileIds: [],
      fileCustomNames: {},
      quarkPdirFid: '0',
      quarkPathHistory: [{ fid: '0', name: '根目录' }],
      customFolderName: defaultFolderName,
      sniffResult: null,
      currentNasPath: initialPath,
      nasFolders: [],
    })

    await get().fetchQuarkFiles('0')
    await get().fetchNasPath(initialPath)
  },

  fetchQuarkFiles: async (pdirFid = '0', folderName?: string) => {
    const item = get().selectedResource
    if (!item) return
    const urlTarget = item.link || item.title
    const itemPwd = item.password || ''
    set({ loadingFiles: true, quarkParseError: '' })

    try {
      const res = await fetch(`${API_BASE}/api/parse_quark?url=${encodeURIComponent(urlTarget)}&pwd=${encodeURIComponent(itemPwd)}&pdir_fid=${encodeURIComponent(pdirFid)}`)
      const data = await res.json()

      if (data.status === 'error') {
        set({
          quarkFiles: [],
          selectedFileIds: [],
          quarkParseError: data.error_msg || '该夸克分享链接已失效或需要提取码',
          loadingFiles: false,
        })
        return
      }

      const files: QuarkFile[] = data.files || []
      const firstVideoFile = files.find((f) => f.is_video) || files[0]
      const fileIds = firstVideoFile ? [firstVideoFile.id] : []

      let newHistory = get().quarkPathHistory
      if (pdirFid === '0') {
        newHistory = [{ fid: '0', name: '根目录' }]
      } else if (folderName && pdirFid !== '0') {
        if (!newHistory.some((h) => h.fid === pdirFid)) {
          newHistory = [...newHistory, { fid: pdirFid, name: folderName }]
        }
      }

      set({
        quarkFiles: files,
        selectedFileIds: fileIds,
        quarkPdirFid: pdirFid,
        quarkPathHistory: newHistory,
        quarkParseError: '',
        loadingFiles: false,
      })
    } catch (err) {
      console.error('Fetch quark files error:', err)
      set({ loadingFiles: false, quarkParseError: '网络请求或解析异常，请稍后重试' })
    }
  },

  popQuarkPathHistory: async () => {
    const history = get().quarkPathHistory
    if (history.length <= 1) return
    const nextHistory = history.slice(0, history.length - 1)
    const targetFolder = nextHistory[nextHistory.length - 1]

    set({ quarkPathHistory: nextHistory })
    await get().fetchQuarkFiles(targetFolder.fid)
  },

  closeDownloadPopup: () => {
    set({ popupVisible: false, popupStep: 1, quarkPdirFid: '0', quarkPathHistory: [{ fid: '0', name: '根目录' }] })
  },

  setPopupStep: (step) => set({ popupStep: step }),

  setSelectedFileIds: (ids) => set({ selectedFileIds: ids }),

  toggleSelectAllFiles: () => {
    const { quarkFiles, selectedFileIds } = get()
    if (selectedFileIds.length === quarkFiles.length) {
      set({ selectedFileIds: [] })
    } else {
      set({ selectedFileIds: quarkFiles.map((f) => f.id) })
    }
  },

  fetchNasPath: async (path?: string) => {
    const targetPath = path || get().currentNasPath || '/data/movies'
    set({ loadingNas: true })
    try {
      const res = await fetch(`${API_BASE}/api/fs/ls?path=${encodeURIComponent(targetPath)}`)
      const data = await res.json()
      set({
        currentNasPath: data.current_path,
        parentNasPath: data.parent_path,
        nasFolders: data.folders || [],
        loadingNas: false,
      })
    } catch (err) {
      console.error('Fetch NAS path error:', err)
      set({ loadingNas: false })
    }
  },

  createNasFolder: async (folderName: string) => {
    const currentPath = get().currentNasPath || '/data/movies'
    if (!folderName || !folderName.trim()) return null
    try {
      const res = await fetch(`${API_BASE}/api/fs/mkdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, folder_name: folderName.trim() }),
      })
      const data = await res.json()
      if (data.new_path) {
        await get().fetchNasPath(data.new_path)
        return data.new_path
      }
    } catch (err) {
      console.error('Create NAS folder error:', err)
    }
    return null
  },
}))

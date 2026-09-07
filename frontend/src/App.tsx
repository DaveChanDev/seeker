import React, { useEffect, useState, useRef } from 'react'
import { TabBar, Toast, SpinLoading, Popup, Button, InfiniteScroll, TextArea } from 'antd-mobile'
import { Flame, Search, Zap, ExternalLink, HardDrive, Clock, Film, Sparkles, Star, FolderPlus, ArrowLeft, Folder, CheckCircle, Video, Play, Compass, Bell, BellRing, Settings, Key, Check, Tv, Clapperboard, Trash2, RefreshCw, Edit3, ChevronUp, ChevronDown, ChevronRight, X, User, MoreVertical, SlidersHorizontal, Filter, Layers } from 'lucide-react'
import { motion, Variants } from 'framer-motion'
import { useAppStore, generateDefaultFolderName } from './store'
import { ImageCacheManager } from './utils/imageCache'

const API_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8899'
const detailMemoryCache = new Map<string, any>()
const DEFAULT_POSTER_SVG = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22300%22%20height%3D%22450%22%20viewBox%3D%220%200%20300%20450%22%3E%3Crect%20fill%3D%22%2318181b%22%20width%3D%22300%22%20height%3D%22450%22%2F%3E%3Ccircle%20cx%3D%22150%22%20cy%3D%22200%22%20r%3D%2236%22%20fill%3D%22%2327272a%22%2F%3E%3Cpath%20d%3D%22M143%20185l20%2015-20%2015z%22%20fill%3D%22%231DB954%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%22265%22%20fill%3D%22%2371717a%22%20font-size%3D%2213%22%20font-family%3D%22system-ui%22%20text-anchor%3D%22middle%22%3E%E5%BD%B1%E8%A7%86%E5%B0%81%E9%9D%A2%3C%2Ftext%3E%3C%2Fsvg%3E"

export default function App() {
  const [activeKey, setActiveKey] = useState<string>('search')
  const [cookieInput, setCookieInput] = useState<string>('')
  const [cacheStats, setCacheStats] = useState<{ count: number; sizeMB: string }>({ count: 0, sizeMB: '0.0' })
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false)

  const {
    query,
    setQuery,
    loading,
    searched,
    movieMeta,
    allSearchResults,
    visibleSearchResults,
    hasMoreResults,
    loadMoreResults,
    search,
    hotboard,
    fetchHotboard,
    trending,
    fetchTrending,
    categories,
    fetchCategories,
    libraryMode,
    setLibraryMode,
    exploreFilter,
    setExploreFilter,
    exploreItems,
    explorePage,
    exploreTotalPages,
    exploreTotalResults,
    loadingExplore,
    loadingMoreExplore,
    fetchExplore,
    loadMoreExplore,
    jellyfinMedia,
    loadingJellyfin,
    fetchJellyfinMedia,
    jellyfinDetailModalVisible,
    jellyfinDetailType,
    openJellyfinDetail,
    setJellyfinDetailType,
    closeJellyfinDetail,
    selectedJellyfinItem,
    jellyfinItemModalVisible,
    openJellyfinItemModal,
    closeJellyfinItemModal,
    downloadTasks,
    fetchDownloadTasks,
    addDownloadTask,
    removeDownloadTask,
    popupVisible,
    popupStep,
    selectedResource,
    quarkFiles,
    quarkParseError,
    selectedFileIds,
    fileCustomNames,
    setFileCustomName,
    quarkPdirFid,
    quarkPathHistory,
    customFolderName,
    setCustomFolderName,
    targetMediaType,
    setTargetMediaType,
    fetchQuarkFiles,
    popQuarkPathHistory,
    currentNasPath,
    parentNasPath,
    nasFolders,
    loadingFiles,
    loadingNas,
    openDownloadPopup,
    closeDownloadPopup,
    setPopupStep,
    setSelectedFileIds,
    toggleSelectAllFiles,
    fetchNasPath,
    createNasFolder,

    notifPopupVisible,
    cookieModalVisible,
    notifications,
    hasUnreadNotifications,
    markNotificationsRead,
    clearNotifications,
    searchHistory,
    setNotifPopupVisible,
    setCookieModalVisible,
    fetchNotifications,
    saveQuarkCookie,

    sniffResult,
    loadingSniff,

    // ✨ Gemini AI 决策与极简两步流
    aiRecommendation,
    loadingAiRecommend,
    aiCurateResult,
    loadingAiCurate,
    aiConfirmModalVisible,
    setAiConfirmModalVisible,
    loadingAiAction,
    aiDiffResult,
    selectAiTier,
    selectAiTierItem,
    startAiOneClickFlow,
    executeAiDownload,
    folderChildrenMap,
    loadingFolderIds,
    fetchFolderChildren,
    setCurrentNasPath,

    // 🔔 追剧订阅与智能增量追更
    subscriptions,
    loadingSubscriptions,
    subscriptionModalVisible,
    setSubscriptionModalVisible,
    localTvShows,
    fetchSubscriptions,
    addSubscription,
    deleteSubscription,
    fetchLocalTvShows,
  } = useAppStore()

  const [expandedFolders, setExpandedFolders] = useState<string[]>([])
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingTempName, setEditingTempName] = useState<string>('')
  const [isEditingNasPath, setIsEditingNasPath] = useState<boolean>(false)
  const [tempCustomFolder, setTempCustomFolder] = useState<string>('')

  const [showAllCandidates, setShowAllCandidates] = useState(false)
  const [jellyfinSearchKey, setJellyfinSearchKey] = useState('')
  const [isFlyAnimating, setIsFlyAnimating] = useState(false)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderNameInput, setNewFolderNameInput] = useState('')
  const [showRenameFilesPanel, setShowRenameFilesPanel] = useState(false)
  const [showDownloadMonitorPopup, setShowDownloadMonitorPopup] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [selectedPublicMedia, setSelectedPublicMedia] = useState<{
    id: string
    title: string
    original_title?: string
    cover: string
    backdrop?: string
    tagline?: string
    certification?: string
    imdb_id?: string
    score?: string
    ratings_count?: string | number
    hot_value?: string
    type?: string
    pubdate?: string
    duration?: string
    episodes?: string
    actors?: string
    cast_with_roles?: Array<{ name: string; character?: string }>
    director?: string
    genres?: string[]
    keywords?: string[]
    overview?: string
    budget?: string
    revenue?: string
    source?: 'douban' | 'tmdb'
  } | null>(null)
  const [publicMediaModalVisible, setPublicMediaModalVisible] = useState(false)
  const [loadingPublicMediaDetail, setLoadingPublicMediaDetail] = useState(false)

  const openPublicMediaModal = (item: any, source: 'douban' | 'tmdb') => {
    const mediaId = String(item.id || item.title)
    const mediaType = item.type || 'movie'
    const cacheKey = `${mediaId}_${mediaType}`

    const initialMedia = {
      id: mediaId,
      title: item.title,
      original_title: item.original_title || '',
      cover: item.cover || item.poster_url || item.raw_cover || '',
      backdrop: item.backdrop || item.cover || item.poster_url || '',
      tagline: item.tagline || '',
      certification: item.certification || (source === 'tmdb' ? 'PG-13' : '通用分级'),
      imdb_id: item.imdb_id || '',
      score: item.score || item.rating || item.hot || item.hot_value || '9.0',
      ratings_count: item.ratings_count || 0,
      type: mediaType,
      pubdate: item.pubdate || item.year || '',
      duration: item.duration || '',
      episodes: item.episodes || '',
      actors: item.actors || '',
      cast_with_roles: item.cast_with_roles || [],
      director: item.director || '',
      genres: item.genres || [],
      keywords: item.keywords || item.genres || [],
      overview: item.overview || `《${item.title}》全网热度极高，口碑出众。点击下方一键按钮即可自动搜罗全网网盘资源！`,
      budget: item.budget || '暂无数据',
      revenue: item.revenue || '暂无数据',
      source,
    }

    // 0 毫秒即时开窗 (Optimistic Instant Open)
    setSelectedPublicMedia(initialMedia)
    setPublicMediaModalVisible(true)

    // 1. 本地内存 Cache 命中判断 (0ms 零网络延迟)
    if (detailMemoryCache.has(cacheKey)) {
      const cachedDetail = detailMemoryCache.get(cacheKey)
      setSelectedPublicMedia((prev) => (prev ? { ...prev, ...cachedDetail, source } : null))
      setLoadingPublicMediaDetail(false)
      return
    }

    // 2. 未命中内存时，后台静默补齐深度字段
    if (item.id && (!item.cast_with_roles || item.cast_with_roles.length === 0)) {
      setLoadingPublicMediaDetail(true)
      const encodedTitle = encodeURIComponent(item.title || '')
      fetch(`${API_BASE}/api/tmdb/detail?id=${item.id}&type=${mediaType}&title=${encodedTitle}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((detail) => {
          if (detail) {
            detailMemoryCache.set(cacheKey, detail)
            setSelectedPublicMedia((prev) => {
              if (!prev) return null
              if (source === 'douban') {
                return {
                  ...prev,
                  backdrop: detail.backdrop || prev.backdrop,
                  cover: prev.cover || detail.cover,
                  cast_with_roles: detail.cast_with_roles && detail.cast_with_roles.length > 0 ? detail.cast_with_roles : prev.cast_with_roles,
                  keywords: detail.keywords && detail.keywords.length > 0 ? detail.keywords : prev.keywords,
                  budget: detail.budget || prev.budget,
                  revenue: detail.revenue || prev.revenue,
                  certification: detail.certification || prev.certification,
                  director: prev.director && prev.director !== '知名导演' ? prev.director : (detail.director || prev.director),
                  actors: prev.actors && prev.actors !== '阵容未公布' ? prev.actors : (detail.actors || prev.actors),
                  overview: prev.overview && !prev.overview.includes('全网热度极高') ? prev.overview : (detail.overview || prev.overview),
                }
              }
              return { ...prev, ...detail, source: 'tmdb' }
            })

            // 🌟 核心同步：将刮削出来的封面与详情实时回写至全局媒体库 store，防止回列表后封面脱节！
            useAppStore.setState((state) => {
              const syncList = (list: any[]) =>
                list.map((it) => (it.title === item.title || it.id === item.id ? { ...it, ...detail } : it))
              const updatedObj = {
                movies: syncList(state.jellyfinMedia?.movies || []),
                series: syncList(state.jellyfinMedia?.series || []),
              }
              try {
                localStorage.setItem('popcorn_jellyfin_media', JSON.stringify(updatedObj))
              } catch (e) {}
              return { jellyfinMedia: updatedObj }
            })
          }
        })
        .catch((err) => console.warn('Fetch TMDB detail error:', err))
        .finally(() => setLoadingPublicMediaDetail(false))
    } else {
      setLoadingPublicMediaDetail(false)
    }
  }

  const closePublicMediaModal = () => {
    setPublicMediaModalVisible(false)
    setSelectedPublicMedia(null)
  }

  // -------------------------------------------------------------
  // 【👤 我的】User Center 四大卡片状态与 API Handlers
  // -------------------------------------------------------------
  const [systemDisks, setSystemDisks] = useState<{
    system: { used_str: string; total_str: string; free_str?: string; percent: number }
    storage: { used_str: string; total_str: string; free_str?: string; percent: number }
  }>({
    system: { used_str: '24.5 GB', total_str: '62.6 GB', free_str: '38.1 GB', percent: 39.2 },
    storage: { used_str: '618.5 GB', total_str: '1.82 TB', free_str: '1.21 TB', percent: 33.2 },
  })

  const [continueWatchingItems, setContinueWatchingItems] = useState<Array<{
    id: string
    title: string
    subtitle: string
    backdrop_url: string
    progress: number
    remaining_minutes?: number
  }>>([])

  const [currentDirPath, setCurrentDirPath] = useState<string>('/data/movies')
  const [parentDirPath, setParentDirPath] = useState<string | null>(null)
  const [moviesItems, setMoviesItems] = useState<Array<{
    name: string
    path: string
    is_dir: boolean
    size_str: string
  }>>([])

  // 本地影视目录弹窗与菜单 State
  const [localDirModalVisible, setLocalDirModalVisible] = useState(false)
  const [activeMenuPath, setActiveMenuPath] = useState<string | null>(null)

  // 二次安全密码验证解锁 Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string; size_str: string } | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [showPasswordText, setShowPasswordText] = useState(false)

  const [editingFolderPath, setEditingFolderPath] = useState<string | null>(null)
  const [folderRenameInput, setFolderRenameInput] = useState('')

  const fetchMoviesPath = async (targetPath: string = currentDirPath) => {
    try {
      const res = await fetch(`${API_BASE}/api/fs/movies_list?path=${encodeURIComponent(targetPath)}`)
      const data = await res.json()
      if (data.data) {
        setMoviesItems(data.data)
        setCurrentDirPath(data.current_path || targetPath)
        setParentDirPath(data.parent_path || null)
      }
    } catch (e) {
      console.error('Fetch movies path error:', e)
    }
  }

  const fetchUserCenterData = async () => {
    try {
      const [disksRes, cwRes] = await Promise.all([
        fetch(`${API_BASE}/api/system/disks`),
        fetch(`${API_BASE}/api/jellyfin/continue_watching`),
      ])
      const diskData = await disksRes.json()
      if (diskData.system) setSystemDisks(diskData)

      const cwData = await cwRes.json()
      if (cwData.data) setContinueWatchingItems(cwData.data)

      await fetchMoviesPath(currentDirPath)
    } catch (e) {
      console.error('Fetch user center data error:', e)
    }
  }

  const handleRenameMovieFolder = async (folderPath: string) => {
    if (!folderRenameInput.trim()) return
    try {
      const res = await fetch(`${API_BASE}/api/fs/movies_rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_path: folderPath, new_name: folderRenameInput.trim() }),
      })
      const data = await res.json()
      Toast.show({ content: data.msg, position: 'bottom' })
      setEditingFolderPath(null)
      setFolderRenameInput('')
      fetchMoviesPath(currentDirPath)
    } catch (e) {
      Toast.show({ content: '重命名失败', position: 'bottom' })
    }
  }

  const executeSecureDelete = async () => {
    if (!deleteTarget) return
    if (deletePassword.trim().toUpperCase() !== 'DELETE') {
      Toast.show({ content: '请输入正确的确认口令 DELETE！', position: 'bottom' })
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/fs/movies_delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: deleteTarget.path }),
      })
      const data = await res.json()
      Toast.show({ content: data.msg, position: 'bottom' })
      setDeleteTarget(null)
      setDeletePassword('')
      fetchMoviesPath(currentDirPath)
      fetchUserCenterData()
    } catch (e) {
      Toast.show({ content: '彻底删除失败', position: 'bottom' })
    }
  }

  useEffect(() => {
    fetchHotboard()
    fetchCategories()
    fetchExplore(true)
    fetchTrending()
    fetchJellyfinMedia()
    fetchDownloadTasks()
    fetchUserCenterData()
    fetchSubscriptions()
    fetchLocalTvShows()

    // 自动定期清理超过 14 天的旧缓存并获取统计
    ImageCacheManager.autoPrune(14)
    ImageCacheManager.getStats().then(setCacheStats)

    const timer = setInterval(() => {
      fetchDownloadTasks()
    }, 3000)

    // 每 30 分钟后台静默同步一次飞牛继续观看进度与系统状态
    const userCenterTimer = setInterval(() => {
      fetchUserCenterData()
    }, 1800000)

    return () => {
      clearInterval(timer)
      clearInterval(userCenterTimer)
    }
  }, [])

  useEffect(() => {
    if (activeKey === 'user') {
      fetchUserCenterData()
    }
  }, [activeKey])

  const handleOpenNotifications = () => {
    fetchNotifications()
    setNotifPopupVisible(true)
    markNotificationsRead()
  }

  const handleSaveCookie = async () => {
    if (!cookieInput.trim()) {
      Toast.show({ content: '请输入有效的 Cookie 字符串', position: 'top' })
      return
    }
    const success = await saveQuarkCookie(cookieInput)
    if (success) {
      Toast.show({ icon: 'success', content: '夸克 Cookie 已成功更新！', position: 'bottom' })
      setCookieInput('')
    } else {
      Toast.show({ content: 'Cookie 更新失败，请检查连接', position: 'bottom' })
    }
  }

  const handleSearchSubmit = (val: string) => {
    if (!val.trim()) {
      Toast.show({ content: '请输入搜索关键词', position: 'top' })
      return
    }
    search(val)
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  }

  const handleConfirmDownload = () => {
    (async () => {
      if (!selectedFileIds || selectedFileIds.length === 0) {
        try {
          Toast.show({ content: '请至少选择一个文件或文件夹', position: 'bottom' })
        } catch (e) {}
        return
      }

      const folderNameClean = ''
      let finalSavePath = currentNasPath || '/data/movies'
      let serverMessage = ''
      let taskItemFromServer: any = null

      const selectedFilesMetadata = (quarkFiles || [])
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
            folder_name: '',
            file_ids: selectedFileIds,
            files_metadata: selectedFilesMetadata,
            resource_title: selectedResource?.title || '',
            share_url: selectedResource?.link || '',
            password: selectedResource?.password || '',
            pdir_fid: quarkPdirFid || '0',
          }),
        })
        if (res && res.ok) {
          const data = await res.json()
          if (data && data.final_path) {
            finalSavePath = data.final_path
            serverMessage = data.message || ''
            taskItemFromServer = data.task_item
          }
        }
      } catch (e) {
        console.error('Download submit error:', e)
        if (folderNameClean) {
          finalSavePath = `${currentNasPath}/${folderNameClean}`
        }
      }

      if (taskItemFromServer && typeof addDownloadTask === 'function') {
        try {
          addDownloadTask(taskItemFromServer)
        } catch (e) {}
      }

      if (typeof fetchDownloadTasks === 'function') {
        try {
          fetchDownloadTasks()
        } catch (e) {}
      }

      try {
        setIsFlyAnimating(true)
        setTimeout(() => {
          try {
            setIsFlyAnimating(false)
          } catch (e) {}
        }, 1500)
      } catch (e) {}

      try {
        Toast.show({
          icon: 'success',
          content: `已发送至路径: ${finalSavePath} 开始转存`,
          duration: 3500,
        })
      } catch (e) {}

      if (typeof closeDownloadPopup === 'function') {
        try {
          closeDownloadPopup()
        } catch (e) {}
      }
    })().catch((err) => {
      console.error('Handled confirm download promise error:', err)
    })
  }

  const handleSmartCreateFolder = () => {
    const folderName = movieMeta ? `${movieMeta.title} (${movieMeta.year || '2024'})` : 'Seeker_Download'
    createNasFolder(folderName)
    Toast.show({ content: `已新建目录: ${folderName}`, position: 'bottom' })
  }

  const toggleSingleFile = (id: string) => {
    if (selectedFileIds.includes(id)) {
      setSelectedFileIds(selectedFileIds.filter((item) => item !== id))
    } else {
      setSelectedFileIds([...selectedFileIds, id])
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#07080a] flex justify-center items-center font-sans select-none antialiased overflow-hidden">
      <div className="w-full max-w-md md:max-w-6xl lg:max-w-7xl h-screen bg-[#0d0e12] text-white overflow-hidden flex flex-col md:flex-row relative shadow-[0_0_80px_rgba(0,0,0,0.9)] sm:border-x sm:border-white/[0.08] cinema-ambient-bg">
        
        {/* 💻 PC 专属侧边栏 (Desktop Sidebar: 仅在 md: 及以上断点显示，手机端绝对隐藏) */}
        <aside className="hidden md:flex flex-col w-56 lg:w-64 h-full bg-[#0d0e14]/90 backdrop-blur-2xl border-r border-white/[0.07] shrink-0 z-30 justify-between p-4 select-none">
          <div className="space-y-6">
            {/* 品牌徽标与名称 */}
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/10 shadow-[0_0_15px_rgba(29,185,84,0.3)] shrink-0 bg-[#16171d] p-0.5">
                <img
                  src="/logo.png"
                  alt="Seeker 觅影"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <div>
                <h1 className="text-base font-black text-white tracking-tight flex items-center gap-1.5">
                  <span>Seeker</span>
                  <span className="text-[10px] font-medium text-emerald-400 px-1.5 py-0.2 rounded-md bg-emerald-500/10 border border-emerald-500/20">Pro</span>
                </h1>
                <p className="text-[10px] text-gray-500 font-medium">全网聚合与离线转存</p>
              </div>
            </div>

            {/* 核心导航选项卡 (Framer Motion 弹性滑块动画 · 彻底消除边框闪烁) */}
            <nav className="space-y-1 relative">
              {[
                { key: 'search', label: '影视搜索', icon: <Search className="w-4 h-4" /> },
                { key: 'download', label: '精选片库', icon: <Clapperboard className="w-4 h-4" /> },
                { key: 'user', label: '个人中心', icon: <User className="w-4 h-4" /> },
              ].map((nav) => {
                const isActive = activeKey === nav.key
                return (
                  <button
                    key={nav.key}
                    type="button"
                    onClick={() => setActiveKey(nav.key)}
                    className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer select-none border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 active:outline-none ${
                      isActive ? 'text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* 🌟 Framer Motion 物理弹簧滑块背景 (平滑滑动，无任何边框切换突变) */}
                    {isActive && (
                      <motion.div
                        layoutId="activeSidebarPill"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/30 shadow-[0_0_20px_rgba(29,185,84,0.15)] pointer-events-none"
                      />
                    )}
                    <span className="relative z-10">{nav.icon}</span>
                    <span className="relative z-10">{nav.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* 侧边栏底部操作区 */}
          <div className="space-y-1 border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => {
                fetchSubscriptions()
                fetchLocalTvShows()
                setSubscriptionModalVisible(true)
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/10 transition-colors cursor-pointer border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 select-none"
            >
              <div className="flex items-center gap-2.5">
                <Tv className="w-4 h-4 text-amber-400" />
                <span>追剧追更中心</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold">
                {subscriptions.length || localTvShows.length}部
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenNotifications}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 select-none"
            >
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4" />
                <span>系统通知</span>
              </div>
              {hasUnreadNotifications && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#1DB954] animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setCookieModalVisible(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 select-none"
            >
              <Settings className="w-4 h-4" />
              <span>网盘 Cookie 配置</span>
            </button>
          </div>
        </aside>

        {/* 右侧主内容区域 Wrapper */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
          {/* 📱 手机端顶部 Header (仅在 md: 以下手机屏幕显示) */}
          <header className="flex md:hidden items-center justify-between px-4 py-3 shrink-0 z-20 border-b border-white/[0.06] bg-[#0f1015]/85 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10 shadow-[0_0_15px_rgba(29,185,84,0.3)] shrink-0 bg-[#16171d] p-0.5">
                <img
                  src="/logo.png"
                  alt="Seeker 觅影"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <div>
                <h1 className="text-base font-black text-white tracking-tight leading-tight flex items-center gap-1.5">
                  <span>Seeker</span>
                  <span className="text-[11px] font-medium text-gray-400 px-1.5 py-0.2 rounded-md bg-white/[0.06] border border-white/[0.06]">觅影</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  fetchSubscriptions()
                  fetchLocalTvShows()
                  setSubscriptionModalVisible(true)
                }}
                className="relative p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-amber-300 hover:text-amber-200 border border-white/[0.06] transition-all duration-200 active:scale-90 outline-none focus:outline-none"
                title="追剧追更中心"
              >
                <Tv className="w-4 h-4 text-amber-400" />
                {(subscriptions.length > 0 || localTvShows.length > 0) && (
                  <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-bold font-mono">
                    {subscriptions.length || localTvShows.length}
                  </span>
                )}
              </button>

              <button
                onClick={handleOpenNotifications}
                className="relative p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/[0.06] transition-all duration-200 active:scale-90 outline-none focus:outline-none"
              >
                <Bell className="w-4 h-4" />
                {hasUnreadNotifications && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#1DB954] shadow-[0_0_8px_#1DB954] animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setCookieModalVisible(true)}
                className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/[0.06] transition-all duration-200 active:scale-90 outline-none focus:outline-none"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* 主内容区域 */}
          <main className="flex-1 overflow-y-auto no-scrollbar px-4 md:px-6 lg:px-8 py-3 md:py-6 space-y-5 md:space-y-6">
        {activeKey === 'search' && (
          <div className="space-y-5 pb-8">
            {/* 1. 顶部手写影视搜索框 (全宽点击聚焦 · 精准 X 清除 · 纯净通透) */}
            <div className="space-y-3">
              <div
                onClick={() => searchInputRef.current?.focus()}
                className="group relative flex items-center w-full bg-[#15161f]/90 hover:bg-[#181a24] rounded-2xl border border-white/[0.08] p-1 focus-within:border-emerald-500/60 focus-within:shadow-[0_0_25px_rgba(29,185,84,0.25)] focus-within:bg-[#181a24] transition-all duration-200 cursor-text shadow-lg select-none"
              >
                {/* 搜索放大镜图标 */}
                <div className="flex items-center justify-center pl-3 pr-2 shrink-0 pointer-events-none">
                  <Search className="w-4 h-4 text-gray-400 group-focus-within:text-emerald-400 transition-colors" />
                </div>

                {/* 核心全宽输入框 */}
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="搜索电影、剧集、动漫、纪录片..."
                  value={query}
                  onChange={(e) => {
                    const val = e.target.value
                    setQuery(val)
                    if (!val.trim()) {
                      useAppStore.setState({ searched: false, movieMeta: null })
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSearchSubmit(query)
                    }
                  }}
                  className="flex-1 min-w-0 bg-transparent text-white placeholder-gray-500 text-xs md:text-sm py-2 px-1 outline-none border-none focus:outline-none focus:ring-0 select-text"
                />

                {/* 精准清空小叉叉 (输入文字时紧靠右侧显示) */}
                {query.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setQuery('')
                      useAppStore.setState({ searched: false, movieMeta: null })
                      searchInputRef.current?.focus()
                    }}
                    className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all mr-1.5 cursor-pointer shrink-0 outline-none focus:outline-none"
                    title="清空输入"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* 独立【搜索】CTA 按钮 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSearchSubmit(query)
                  }}
                  className="h-9 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-[#1ed760] text-black font-black text-xs shadow-[0_0_15px_rgba(29,185,84,0.35)] hover:brightness-105 active:scale-95 transition-all duration-200 shrink-0 cursor-pointer outline-none focus:outline-none flex items-center justify-center"
                >
                  搜索
                </button>
              </div>

              {/* 动态搜索历史词标签 */}
              {searchHistory.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {searchHistory.slice(0, 5).map((kw) => (
                    <button
                      key={kw}
                      onClick={() => {
                        setQuery(kw)
                        search(kw)
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-gray-400 hover:text-white font-medium transition-all duration-200 active:scale-95 outline-none focus:outline-none"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. 🔥 实时热门电影榜 (豆瓣热榜聚合 · 手机端单列 / PC 端双列网格排版) */}
            {!loading && !searched && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-2.5 pt-0.5"
              >
                <div className="flex items-center gap-2 px-1">
                  <Flame className="w-4 h-4 text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">实时热门电影榜</h3>
                </div>

                <div className="bg-[#13141a]/85 backdrop-blur-md rounded-2xl border border-white/[0.07] divide-y divide-white/[0.04] md:divide-y-0 md:bg-transparent md:border-none md:backdrop-blur-none md:shadow-none overflow-hidden shadow-2xl md:grid md:grid-cols-2 md:gap-2.5">
                  {(Array.isArray(hotboard) ? hotboard : ((hotboard as any)?.list || [])).slice(0, 10).map((item: any, idx: number) => {
                    const isTop1 = idx === 0
                    const isTop2 = idx === 1
                    const isTop3 = idx === 2

                    const rankBadgeClass = isTop1
                      ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)] font-black'
                      : isTop2
                      ? 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-950 font-black shadow-[0_0_8px_rgba(203,213,225,0.3)]'
                      : isTop3
                      ? 'bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 text-amber-100 font-bold shadow-[0_0_8px_rgba(180,83,9,0.3)]'
                      : 'bg-white/[0.05] text-gray-400 font-bold border border-white/[0.04]'

                    const scoreVal = item.score || item.hot_value
                    const scoreNum = parseFloat(scoreVal)
                    const hasScore = !isNaN(scoreNum) && scoreNum > 0

                    return (
                      <motion.div
                        key={item.title || idx}
                        whileTap={{ scale: 0.98, backgroundColor: 'rgba(255,255,255,0.04)' }}
                        onClick={() => {
                          openPublicMediaModal(item, 'douban')
                        }}
                        className="p-3 md:p-3.5 flex items-center gap-3 cursor-pointer hover:bg-white/[0.04] md:bg-[#13141a]/85 md:backdrop-blur-md md:rounded-2xl md:border md:border-white/[0.07] md:shadow-lg transition-all duration-200 group"
                      >
                        {/* 排名序号 */}
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] shrink-0 ${rankBadgeClass}`}>
                          {idx + 1}
                        </div>

                        {/* 片名与元数据 */}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-gray-200 group-hover:text-white transition-colors truncate">
                              {item.title}
                            </h4>
                            {item.pubdate && (
                              <span className="text-[10px] text-gray-500 shrink-0 font-mono">
                                {item.pubdate.slice(0, 4)}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate flex items-center gap-1.5">
                            {item.genres && item.genres.length > 0 && (
                              <span className="text-gray-300 font-medium">
                                {item.genres.slice(0, 2).join(' / ')}
                              </span>
                            )}
                            {item.actors && (
                              <span className="text-gray-500 truncate">
                                · {item.actors}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 右侧评分/热度与一键搜索放大镜按钮 (电影金点缀) */}
                        <div className="shrink-0 flex items-center gap-2">
                          {hasScore ? (
                            <div className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center gap-0.5 shadow-sm">
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                              <span className="text-xs font-black text-amber-400 font-mono">{scoreNum.toFixed(1)}</span>
                            </div>
                          ) : (
                            <div className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <span className="text-[10px] font-bold text-gray-300">热映</span>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setQuery(item.title)
                              search(item.title)
                            }}
                            className="p-1.5 -mr-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-[#1DB954] active:scale-90 transition-all shrink-0 cursor-pointer"
                            title="一键搜索全网资源"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* 优雅脉冲流光骨架屏 (Search Shimmer Skeleton · 手机单列 / PC 双列) */}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3 pt-1 md:space-y-0 md:grid md:grid-cols-2 md:gap-3.5"
              >
                {/* 豆瓣影视元数据骨架 (跨双列) */}
                <div className="flex gap-4 items-center bg-[#15161c]/90 p-3.5 md:p-4 rounded-2xl border border-white/[0.08] md:col-span-2">
                  <div className="w-20 h-28 rounded-xl bg-white/[0.05] shimmer-card shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-4 w-3/5 rounded bg-white/[0.06] shimmer-card" />
                    <div className="h-3 w-2/5 rounded bg-white/[0.04] shimmer-card" />
                    <div className="flex gap-1.5 pt-1">
                      <div className="h-4 w-12 rounded bg-white/[0.05] shimmer-card" />
                      <div className="h-4 w-14 rounded bg-white/[0.05] shimmer-card" />
                    </div>
                    <div className="h-3 w-4/5 rounded bg-white/[0.04] shimmer-card" />
                  </div>
                </div>

                {/* 资源列表卡片骨架 */}
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="p-3.5 rounded-2xl bg-[#14151b]/85 border border-white/[0.07] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
                        <div className="h-4 w-12 rounded-md bg-white/[0.06] shimmer-card" />
                        <div className="h-4 w-16 rounded-md bg-white/[0.06] shimmer-card" />
                      </div>
                      <div className="h-4 w-14 rounded-md bg-white/[0.06] shimmer-card" />
                    </div>
                    <div className="h-3.5 w-3/4 rounded bg-white/[0.06] shimmer-card" />
                    <div className="flex justify-between pt-1">
                      <div className="h-3 w-24 rounded bg-white/[0.04] shimmer-card" />
                      <div className="h-3 w-16 rounded bg-white/[0.04] shimmer-card" />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* 4. 真实豆瓣影片元数据 Card */}
            {!loading && searched && movieMeta && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
                className="flex gap-4 items-center bg-[#15161c]/90 backdrop-blur-md p-3.5 md:p-5 rounded-2xl border border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.6)] transition-all"
              >
                <img
                  src={movieMeta.cover}
                  alt={movieMeta.title}
                  referrerPolicy="no-referrer"
                  className="w-20 md:w-24 h-28 md:h-34 object-cover rounded-xl shrink-0 shadow-lg border border-white/10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_POSTER_SVG
                  }}
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base md:text-lg font-black text-white truncate">{movieMeta.title}</h2>
                    {movieMeta.rating && (
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-0.5 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {movieMeta.rating}
                      </span>
                    )}
                  </div>
                  {(movieMeta.original_title || movieMeta.year) && (
                    <p className="text-xs text-gray-400 font-normal truncate">
                      {movieMeta.original_title && movieMeta.original_title.trim().toLowerCase() !== movieMeta.title.trim().toLowerCase()
                        ? `${movieMeta.original_title}${movieMeta.year ? ` · ${movieMeta.year}` : ''}`
                        : movieMeta.year ? `${movieMeta.year} 年` : ''}
                    </p>
                  )}
                  {movieMeta.tags && movieMeta.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {movieMeta.tags.map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.06] text-gray-300 font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {movieMeta.summary && (
                    <p className="text-[11px] text-gray-400 line-clamp-2 pt-0.5 leading-normal font-normal">
                      {movieMeta.summary}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* 5. 搜索结果与 AI 智能选片 */}
            {!loading && searched && (
              <div className="space-y-4">
                {/* 🌟 5.0 AI 自然语言灵感策展片单 */}
                {loadingAiCurate && (
                  <div className="p-4 rounded-3xl bg-gradient-to-br from-purple-950/20 via-[#14151b]/95 to-indigo-950/20 border border-purple-500/25 animate-pulse space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
                        <span className="text-xs font-bold text-purple-300">AI 电影策展人正在为您生成专属灵感片单...</span>
                      </div>
                      <SpinLoading color="#a855f7" style={{ '--size': '16px' }} />
                    </div>
                  </div>
                )}

                {!loadingAiCurate && aiCurateResult && aiCurateResult.curated_list && aiCurateResult.curated_list.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-purple-950/30 via-[#14151b]/95 to-indigo-950/30 border border-purple-500/30 shadow-[0_10px_35px_rgba(168,85,247,0.12)] space-y-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-purple-300 flex items-center gap-1.5 tracking-wide">
                          <Sparkles className="w-3.5 h-3.5 fill-purple-400" />
                          <span>AI 灵感片单 · 策展精选</span>
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">共 {aiCurateResult.curated_list.length} 部佳作</span>
                      </div>
                      {aiCurateResult.intent_summary && (
                        <p className="text-xs text-purple-200/90 leading-relaxed font-medium">
                          {aiCurateResult.intent_summary}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {aiCurateResult.curated_list.map((film, fIdx) => (
                        <div
                          key={fIdx}
                          onClick={() => search(film.search_keyword || film.title)}
                          className="p-3 rounded-2xl bg-white/[0.03] hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/30 cursor-pointer transition-all space-y-2 group active:scale-[0.98]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                                {film.title}
                                {film.year && <span className="text-[10px] text-gray-400 font-normal ml-1">({film.year})</span>}
                              </h4>
                              {film.original_title && (
                                <p className="text-[9px] text-gray-500 truncate">{film.original_title}</p>
                              )}
                            </div>
                            {film.score && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] font-bold font-mono shrink-0">
                                ⭐ {film.score}
                              </span>
                            )}
                          </div>

                          {film.tags && film.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {film.tags.map((tag, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 text-[9px] font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {film.reason && (
                            <p className="text-[10px] text-gray-400 leading-snug line-clamp-2">
                              {film.reason}
                            </p>
                          )}

                          <div className="pt-1 flex items-center justify-end">
                            <span className="text-[10px] font-bold text-purple-400 group-hover:text-purple-300 flex items-center gap-1">
                              <span>🚀 一键搜索入库</span>
                              <Search className="w-2.5 h-2.5" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ✨ 5.1 Gemini AI 决策中加载态 */}
                {loadingAiRecommend && (
                  <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-950/25 via-[#14151b]/95 to-cyan-950/20 border border-emerald-500/25 animate-pulse space-y-2.5 shadow-[0_8px_30px_rgba(29,185,84,0.08)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#1DB954] animate-spin" />
                        <span className="text-xs font-bold text-emerald-300">AI 正在优选最佳资源...</span>
                      </div>
                      <SpinLoading color="#1DB954" style={{ '--size': '16px' }} />
                    </div>
                    <div className="h-3.5 bg-white/5 rounded-md w-3/4"></div>
                    <div className="h-3 bg-white/5 rounded-md w-1/2"></div>
                  </div>
                )}

                {/* ✨ 5.2 Gemini AI 智能甄选最优方案卡片 */}
                {!loadingAiRecommend && aiRecommendation && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-[#14151b]/95 to-cyan-950/30 border border-[#1DB954]/40 shadow-[0_10px_35px_rgba(29,185,84,0.15)] space-y-3.5 group"
                  >
                    {/* 背景流光 */}
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#1DB954]/15 rounded-full blur-3xl pointer-events-none" />

                    {/* 顶部标签组 */}
                    <div className="flex items-center justify-between gap-2 flex-wrap relative z-10">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954] text-xs font-black tracking-wide shadow-[0_0_12px_rgba(29,185,84,0.3)]">
                          <Sparkles className="w-3.5 h-3.5 fill-[#1DB954]" />
                          {aiRecommendation.engine.includes('gemini') ? '✨ AI 甄选' : '⚡ 智能精选'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                          {aiRecommendation.resolution || '4K 臻彩'}
                        </span>
                        {aiRecommendation.estimated_size && (
                          <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono font-bold">
                            {aiRecommendation.estimated_size}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-bold">
                          {aiRecommendation.is_tv ? '📺 剧集' : '🎬 电影'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] font-bold font-mono">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>画质评级 {aiRecommendation.quality_score || 95}分</span>
                      </div>
                    </div>

                    {/* 🏆 动态 2~3 档位画质矩阵切换（默认首位为清晰与体积兼顾的黄金档） */}
                    {aiRecommendation.recommended_tiers && aiRecommendation.recommended_tiers.length > 1 ? (
                      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/5 relative z-10 flex-wrap sm:flex-nowrap">
                        {aiRecommendation.recommended_tiers.map((tier, tIdx) => {
                          const isSelected = aiRecommendation.selected_tier_id
                            ? aiRecommendation.selected_tier_id === tier.id
                            : (aiRecommendation.best_resource_id === tier.id || (tIdx === 0 && !aiRecommendation.selected_tier_id))
                          return (
                            <button
                              key={tIdx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                selectAiTierItem(tier)
                              }}
                              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                isSelected
                                  ? tier.is_default || tIdx === 0
                                    ? 'bg-[#1DB954] text-black shadow-md font-extrabold'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-md font-extrabold'
                                  : 'text-gray-400 hover:text-gray-200 bg-white/[0.02] hover:bg-white/[0.06]'
                              }`}
                            >
                              <span>{tier.tag || (tIdx === 0 ? '⭐ 综合最优' : tier.label)}</span>
                              {tier.estimated_size && (
                                <span className={`text-[10px] opacity-75 font-normal ${isSelected ? 'text-black/80' : 'text-gray-400'}`}>
                                  ({tier.estimated_size.replace('约', '').trim()})
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : aiRecommendation.tiers && Object.keys(aiRecommendation.tiers).length > 1 ? (
                      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/5 relative z-10">
                        {aiRecommendation.tiers.best_4k && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              selectAiTier('best_4k')
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              aiRecommendation.selected_tier === 'best_4k'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-md font-extrabold'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            <span>🏆 {aiRecommendation.tiers.best_4k.label || '4K 旗舰'}</span>
                          </button>
                        )}
                        {aiRecommendation.tiers.best_1080p && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              selectAiTier('best_1080p')
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              aiRecommendation.selected_tier === 'best_1080p'
                                ? 'bg-[#1DB954] text-black shadow-md font-extrabold'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            <span>⚡ {aiRecommendation.tiers.best_1080p.label || '1080P 高清'}</span>
                          </button>
                        )}
                        {aiRecommendation.tiers.best_special && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              selectAiTier('best_special')
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              aiRecommendation.selected_tier === 'best_special'
                                ? 'bg-purple-500 text-white shadow-md font-extrabold'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            <span>💎 {aiRecommendation.tiers.best_special.label || (aiRecommendation.is_tv ? '特辑篇' : '多音轨/未删减')}</span>
                          </button>
                        )}
                      </div>
                    ) : null}

                    {/* 推荐标题与理由 */}
                    <div className="space-y-2 relative z-10">
                      <h3 className="text-sm sm:text-base font-extrabold text-white leading-snug line-clamp-2">
                        {aiRecommendation.raw_candidate?.title || aiRecommendation.normalized_title}
                      </h3>
                      <div className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-emerald-200/90 leading-relaxed shadow-sm flex items-start gap-2">
                        <span className="text-emerald-400 select-none font-bold shrink-0">💡 推荐亮点：</span>
                        <span className="line-clamp-2">{aiRecommendation.recommend_reason}</span>
                      </div>

                      {/* 🎬 影迷极简看点与版本导视 */}
                      {aiRecommendation.viewing_tip && (
                        <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-snug flex items-start gap-1.5">
                          <span className="text-amber-400 select-none font-bold shrink-0">🎬 影迷导视：</span>
                          <span>{aiRecommendation.viewing_tip}</span>
                        </div>
                      )}

                      {/* 🌌 影视宇宙观影时间线 (Franchise Timeline) */}
                      {aiRecommendation.franchise_timeline &&
                        aiRecommendation.franchise_timeline.timeline &&
                        aiRecommendation.franchise_timeline.timeline.length > 1 && (
                          <div className="pt-1 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-cyan-300 font-bold flex items-center gap-1.5">
                                <Film className="w-3 h-3 text-cyan-400" />
                                <span>🌌 {aiRecommendation.franchise_timeline.universe_name} · 最佳观影顺序</span>
                              </span>
                              <span className="text-[10px] text-gray-500">点击直接联动搜片</span>
                            </div>

                            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                              {aiRecommendation.franchise_timeline.timeline.map((item, itemIdx) => {
                                const isCurrent = item.is_current
                                return (
                                  <button
                                    key={itemIdx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (!isCurrent) {
                                        search(item.keyword || item.title)
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-xl border text-xs whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                                      isCurrent
                                        ? 'bg-[#1DB954]/20 border-[#1DB954] text-[#1DB954] font-extrabold shadow-[0_0_12px_rgba(29,185,84,0.25)]'
                                        : 'bg-white/[0.04] border-white/10 text-gray-300 hover:text-white hover:border-white/25 hover:bg-white/[0.08]'
                                    }`}
                                  >
                                    <span className="text-[10px] font-mono opacity-60">#{itemIdx + 1}</span>
                                    <span>{item.title}</span>
                                    {item.year && (
                                      <span className="text-[10px] opacity-60 font-mono">({item.year})</span>
                                    )}
                                    {isCurrent && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-ping ml-0.5" />
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                      {/* 🎬 同名多版本快速切换栏 */}
                      {aiRecommendation.alternative_versions && aiRecommendation.alternative_versions.length > 0 && (
                        <div className="pt-0.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <Layers className="w-3 h-3 text-amber-400" />
                            <span>发现其他同名版本，点击一键切换：</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {aiRecommendation.alternative_versions.map((alt, altIdx) => (
                              <button
                                key={altIdx}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  search(alt.keyword)
                                }}
                                className="px-2.5 py-1 rounded-xl bg-white/[0.07] hover:bg-[#1DB954]/20 border border-white/10 hover:border-[#1DB954]/40 text-gray-200 hover:text-[#1DB954] text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                <span>{alt.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 第 1 步行动按钮 */}
                    <div className="pt-1 relative z-10 flex items-center gap-2">
                      <button
                        onClick={() => startAiOneClickFlow()}
                        className="flex-1 py-3.5 px-4 rounded-2xl bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.98] text-black text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(29,185,84,0.35)] transition-all"
                      >
                        <Zap className="w-4 h-4 fill-black" />
                        <span>⚡ 选用此 AI 推荐，一键准备入库</span>
                      </button>

                      {aiRecommendation.is_tv && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation()
                            const isSubbed = subscriptions.some(s => s.title === aiRecommendation.normalized_title)
                            if (isSubbed) {
                              Toast.show({ content: '该剧集已在追更清单中', position: 'bottom' })
                              setSubscriptionModalVisible(true)
                            } else {
                              const ok = await addSubscription({
                                title: aiRecommendation.normalized_title,
                                year: aiRecommendation.year,
                                share_url: aiRecommendation.raw_candidate?.link || '',
                                password: aiRecommendation.raw_candidate?.password || '',
                                pdir_fid: '0',
                                res_preference: aiRecommendation.resolution || '4K',
                              })
                              if (ok) {
                                Toast.show({ icon: 'success', content: '已加入剧集追更清单！', position: 'bottom' })
                              }
                            }
                          }}
                          className="py-3.5 px-3.5 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] active:scale-95 border border-white/10 text-xs text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                          title="加入追更订阅"
                        >
                          <BellRing className="w-4 h-4 text-amber-400" />
                          <span className="hidden sm:inline">
                            {subscriptions.some(s => s.title === aiRecommendation.normalized_title) ? '已追更' : '追更订阅'}
                          </span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 5.3 候选资源列表 Header */}
                <div className="flex items-center justify-between px-1 pt-1">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-[#1DB954]" />
                    <span>全部网盘候选资源 ({allSearchResults.length})</span>
                  </h3>
                  <button
                    onClick={() => setShowAllCandidates(!showAllCandidates)}
                    className="text-xs text-gray-400 hover:text-white px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-colors flex items-center gap-1 font-medium"
                  >
                    <span>{showAllCandidates ? '收起候选列表' : '展开手动挑选'}</span>
                  </button>
                </div>

                {allSearchResults.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-xs font-normal">未匹配到云盘资源</div>
                ) : showAllCandidates ? (
                  <>
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3.5"
                    >
                      {visibleSearchResults.map((item) => {
                        return (
                          <motion.div
                            key={item.id}
                            variants={itemVariants}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => openDownloadPopup(item)}
                            className="p-3.5 rounded-2xl bg-[#14151b]/85 backdrop-blur-md border border-white/[0.07] hover:bg-[#1a1b24] hover:border-[#1DB954]/40 hover:shadow-[0_8px_25px_rgba(29,185,84,0.12)] transition-all duration-200 cursor-pointer space-y-2 group"
                          >
                            {/* 1. 五维规格药丸标签组与右侧画质/体积高亮 */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                {((item as any).five_tags || [item.netdisk]).map((badge: string, bIdx: number) => {
                                  const isSweet = badge.includes('甜点')
                                  const isRemux = badge.includes('原盘')
                                  const isFake = badge.includes('伪4K')
                                  const is4K = badge === '4K'
                                  return (
                                    <span
                                      key={bIdx}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide border shadow-sm ${
                                        isSweet
                                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 shadow-[0_0_8px_rgba(52,211,153,0.25)]'
                                          : isRemux
                                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/35 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                                          : isFake
                                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                          : is4K
                                          ? 'bg-emerald-950/60 text-[#1DB954] border-[#1DB954]/40'
                                          : 'bg-white/[0.06] text-gray-300 border-white/[0.08]'
                                      }`}
                                    >
                                      {badge}
                                    </span>
                                  )
                                })}
                              </div>

                              {/* 右侧突出画质/体积 */}
                              {item.size && (
                                <div className="shrink-0 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/25">
                                  <span className="text-[11px] font-black text-cyan-300 font-mono">
                                    {item.size}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* 2. 完整资源标题 */}
                            <h4 className="text-xs font-semibold text-gray-200 group-hover:text-white leading-snug line-clamp-2 break-all transition-colors">
                              {item.title}
                            </h4>

                            {/* 3. 底部明细 (网盘类型 + 来源 + 日期) */}
                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono pt-0.5 border-t border-white/[0.04]">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded bg-[#1DB954]/15 text-[#1DB954] font-bold">
                                  {item.netdisk || '夸克网盘'}
                                </span>
                                {item.source && (
                                  <span className="text-gray-500 truncate max-w-[120px]">
                                    ({item.source})
                                  </span>
                                )}
                              </div>

                              {item.datetime && (
                                <span className="text-gray-500">
                                  {item.datetime}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </motion.div>

                    <InfiniteScroll loadMore={loadMoreResults} hasMore={hasMoreResults} />
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 🎬 精选片库 (自由探索 × 精选专题 双模中心) */}
        {activeKey === 'download' && (
          <div className="space-y-5 pb-8 pt-1">
            {/* 顶栏：双模导航切换 (探索神器 / 精选专题) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#13141b]/80 backdrop-blur-xl p-2 md:p-2.5 rounded-2xl border border-white/[0.08] shadow-xl">
              <div className="flex items-center gap-1.5 bg-[#0b0c10] p-1 rounded-xl border border-white/[0.06] w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setLibraryMode('explore')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 select-none ${
                    libraryMode === 'explore'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-[0_0_15px_rgba(29,185,84,0.35)]'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>片库探索</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLibraryMode('curated')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 select-none ${
                    libraryMode === 'curated'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-[0_0_15px_rgba(29,185,84,0.35)]'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>精选专题</span>
                </button>
              </div>

              {/* 右侧快捷信息与一键刷新 */}
              <div className="flex items-center justify-between sm:justify-end gap-3 px-1">
                {libraryMode === 'explore' && (
                  <span className="text-[11px] font-medium text-gray-400">
                    已检索到 <span className="text-emerald-400 font-bold font-mono">{exploreTotalResults || exploreItems.length}</span> 部精选作品
                  </span>
                )}
                {libraryMode === 'curated' && (
                  <span className="text-[11px] font-medium text-gray-400">
                    本地媒体库共 <span className="text-emerald-400 font-bold font-mono">{(jellyfinMedia?.movies?.length || 0) + (jellyfinMedia?.series?.length || 0)}</span> 部
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (libraryMode === 'explore') fetchExplore(true)
                    else fetchCategories()
                  }}
                  className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.06] active:scale-95 transition-all"
                  title="刷新片库"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${(loadingExplore || loadingJellyfin) ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* 🎯 模式 1: 多维影视探索器 (核心选片神器) */}
            {libraryMode === 'explore' && (
              <div className="space-y-4">
                {/* 🎛️ 胶囊筛选面板 */}
                <div className="bg-[#13141b]/90 backdrop-blur-xl p-3.5 md:p-4 rounded-2xl border border-white/[0.08] shadow-xl space-y-3">
                  {/* 1. 形式切换 */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                    <span className="text-[11px] font-bold text-gray-400 shrink-0 w-10">形式</span>
                    {[
                      { key: 'movie', label: '电影' },
                      { key: 'tv', label: '剧集 / 动漫' },
                    ].map((t) => {
                      const active = exploreFilter.media_type === t.key
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setExploreFilter({ media_type: t.key as any, genre: 'all' })}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer select-none shrink-0 ${
                            active
                              ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(29,185,84,0.4)]'
                              : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08]'
                          }`}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* 2. 类型题材 */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    <span className="text-[11px] font-bold text-gray-400 shrink-0 w-10">题材</span>
                    {(exploreFilter.media_type === 'movie'
                      ? [
                          { key: 'all', label: '全部' },
                          { key: '878', label: '科幻' },
                          { key: '9648', label: '悬疑' },
                          { key: '28', label: '动作' },
                          { key: '80', label: '犯罪' },
                          { key: '35', label: '喜剧' },
                          { key: '16', label: '动画' },
                          { key: '18', label: '剧情' },
                          { key: '10749', label: '爱情' },
                          { key: '53', label: '惊悚' },
                          { key: '14', label: '奇幻' },
                          { key: '10752', label: '战争' },
                          { key: '27', label: '恐怖' },
                          { key: '99', label: '纪录' },
                        ]
                      : [
                          { key: 'all', label: '全部' },
                          { key: '10765', label: '科幻奇幻' },
                          { key: '9648', label: '悬疑' },
                          { key: '80', label: '犯罪' },
                          { key: '10759', label: '动作冒险' },
                          { key: '35', label: '喜剧' },
                          { key: '16', label: '动画' },
                          { key: '18', label: '剧情' },
                          { key: '99', label: '纪录片' },
                        ]
                    ).map((g) => {
                      const active = exploreFilter.genre === g.key
                      return (
                        <button
                          key={g.key}
                          type="button"
                          onClick={() => setExploreFilter({ genre: g.key })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer select-none shrink-0 ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(29,185,84,0.2)] font-bold'
                              : 'bg-white/[0.03] text-gray-400 hover:text-gray-200 border border-transparent'
                          }`}
                        >
                          {g.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* 3. 地区 */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    <span className="text-[11px] font-bold text-gray-400 shrink-0 w-10">地区</span>
                    {[
                      { key: 'all', label: '全部' },
                      { key: 'zh', label: '华语' },
                      { key: 'en', label: '欧美' },
                      { key: 'ja', label: '日本' },
                      { key: 'ko', label: '韩国' },
                      { key: 'HK', label: '中国香港' },
                      { key: 'GB', label: '英国' },
                      { key: 'FR', label: '法国' },
                    ].map((c) => {
                      const active = exploreFilter.country === c.key
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => setExploreFilter({ country: c.key })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer select-none shrink-0 ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(29,185,84,0.2)] font-bold'
                              : 'bg-white/[0.03] text-gray-400 hover:text-gray-200 border border-transparent'
                          }`}
                        >
                          {c.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* 4. 年代 */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    <span className="text-[11px] font-bold text-gray-400 shrink-0 w-10">年代</span>
                    {[
                      { key: 'all', label: '全部' },
                      { key: '2026', label: '2026' },
                      { key: '2025', label: '2025' },
                      { key: '2024', label: '2024' },
                      { key: '2023', label: '2023' },
                      { key: '2020s', label: '2020年代' },
                      { key: '2010s', label: '2010年代' },
                      { key: '2000s', label: '2000年代' },
                      { key: 'classic', label: '经典老片' },
                    ].map((y) => {
                      const active = exploreFilter.year_range === y.key
                      return (
                        <button
                          key={y.key}
                          type="button"
                          onClick={() => setExploreFilter({ year_range: y.key })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer select-none shrink-0 ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(29,185,84,0.2)] font-bold'
                              : 'bg-white/[0.03] text-gray-400 hover:text-gray-200 border border-transparent'
                          }`}
                        >
                          {y.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* 5. 排序与入库过滤工具条 */}
                  <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-gray-400 shrink-0 mr-1">排序</span>
                      {[
                        { key: 'popularity.desc', label: '🔥 综合热度' },
                        { key: 'vote_average.desc', label: '⭐ 影史高分' },
                        { key: 'primary_release_date.desc', label: '📅 最新上映' },
                      ].map((s) => {
                        const active = exploreFilter.sort_by === s.key
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => setExploreFilter({ sort_by: s.key })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none ${
                              active
                                ? 'bg-white/10 text-white border border-white/20'
                                : 'bg-transparent text-gray-400 hover:text-gray-300'
                            }`}
                          >
                            {s.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* 仅看未入库 Switch */}
                    <button
                      type="button"
                      onClick={() => setExploreFilter({ only_uncollected: !exploreFilter.only_uncollected })}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none border ${
                        exploreFilter.only_uncollected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(29,185,84,0.2)]'
                          : 'bg-white/[0.03] text-gray-400 hover:text-gray-200 border-white/[0.06]'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded flex items-center justify-center border ${exploreFilter.only_uncollected ? 'bg-emerald-400 border-emerald-400 text-black' : 'border-gray-500'}`}>
                        {exploreFilter.only_uncollected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span>仅看 NAS 未入库</span>
                    </button>
                  </div>
                </div>

                {/* 🎬 影视瀑布流网格展示 */}
                {loadingExplore ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 md:gap-3.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => (
                      <div key={n} className="space-y-2">
                        <div className="aspect-[2/3] w-full rounded-2xl bg-white/[0.04] shimmer-card border border-white/[0.06]" />
                        <div className="h-3 w-4/5 rounded bg-white/[0.04] shimmer-card" />
                        <div className="h-2 w-1/2 rounded bg-white/[0.03] shimmer-card" />
                      </div>
                    ))}
                  </div>
                ) : exploreItems.length === 0 ? (
                  <div className="py-16 text-center space-y-3 bg-[#13141b]/50 rounded-2xl border border-white/[0.06]">
                    <Film className="w-10 h-10 text-gray-600 mx-auto" />
                    <p className="text-sm font-bold text-gray-400">未找到符合当前筛选条件的影视资源</p>
                    <button
                      type="button"
                      onClick={() => setExploreFilter({ genre: 'all', country: 'all', year_range: 'all', only_uncollected: false })}
                      className="px-4 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
                    >
                      重置所有筛选
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 md:gap-3.5">
                      {exploreItems.map((item: any, idx: number) => {
                        const poster = item.cover || item.raw_cover
                        const rating = item.score || item.hot_value
                        return (
                          <motion.div
                            key={`${item.id}-${idx}`}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => openPublicMediaModal(item, 'tmdb')}
                            className="space-y-1.5 group cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
                          >
                            <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 via-[#16171d] to-gray-900 shadow-xl border border-white/[0.08] group-hover:border-emerald-500/50 group-hover:shadow-[0_10px_25px_rgba(29,185,84,0.2)] transition-all duration-300">
                              {poster ? (
                                <img
                                  src={poster}
                                  alt={item.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                    ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full bg-gradient-to-b from-emerald-950/40 via-gray-900 to-gray-950 border border-white/5 flex flex-col items-center justify-center p-2 text-center ${poster ? 'hidden' : ''}`}>
                                <Film className="w-6 h-6 text-emerald-500/70 mb-1 animate-pulse" />
                                <span className="text-[10px] font-bold text-gray-200 truncate w-full tracking-tight">{item.title}</span>
                              </div>

                              {/* 极简底部渐变暗角 */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                              {/* 左上角年份标签 */}
                              {item.year && (
                                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] font-bold text-gray-300 border border-white/10">
                                  {item.year}
                                </div>
                              )}

                              {/* 右上角已入库徽标 */}
                              {item.in_library && (
                                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-emerald-500/90 backdrop-blur-md text-[9px] font-black text-black shadow-[0_0_8px_rgba(29,185,84,0.6)] flex items-center gap-0.5">
                                  <span>已入库</span>
                                </div>
                              )}

                              {/* 右下角评分 */}
                              {rating && (
                                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-lg bg-black/85 backdrop-blur-md text-[10px] font-black text-amber-400 border border-amber-400/35 flex items-center gap-0.5 shadow-md">
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                  <span>{rating}</span>
                                </div>
                              )}
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-gray-200 truncate group-hover:text-emerald-300 transition-colors">
                                {item.title}
                              </h4>
                              <p className="text-[10px] text-gray-400 truncate">
                                {item.genres && item.genres.length > 0
                                  ? (Array.isArray(item.genres) ? item.genres.slice(0, 2).join(' / ') : item.genres)
                                  : (item.original_title || '精选佳作')}
                              </p>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>

                    {/* 加载更多 分页控制器 */}
                    {explorePage < exploreTotalPages && (
                      <div className="flex justify-center pt-2 pb-4">
                        <button
                          type="button"
                          disabled={loadingMoreExplore}
                          onClick={loadMoreExplore}
                          className="px-6 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/[0.08] text-xs font-bold transition-all duration-200 active:scale-95 flex items-center gap-2 disabled:opacity-50"
                        >
                          {loadingMoreExplore ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              <span>正在探索更多精彩佳作...</span>
                            </>
                          ) : (
                            <>
                              <span>加载更多影片 (第 {explorePage} / {exploreTotalPages} 页)</span>
                              <ChevronUp className="w-3.5 h-3.5 rotate-180 text-gray-400" />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 🌟 模式 2: 精选专题模式 (互不交叉的 9 条正交轨道 · 全局管道去重) */}
            {libraryMode === 'curated' && (() => {
              const localTotal = (jellyfinMedia?.movies?.length || 0) + (jellyfinMedia?.series?.length || 0)
              const localItems = [...(jellyfinMedia?.movies || []), ...(jellyfinMedia?.series || [])]
                .sort((a: any, b: any) => (b.mtime || 0) - (a.mtime || 0))
                .slice(0, 15)

              const tracks = [
                {
                  id: 'local_all',
                  title: `本地影视媒体库 (${localTotal} 部)`,
                  subtitle: '已入库本地超清媒体资源',
                  icon: <HardDrive className="w-4 h-4 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />,
                  hasAction: true,
                  data: localItems,
                },
                {
                  id: 'now_playing',
                  title: '院线热映',
                  subtitle: '影院热映与 4K 首发发碟',
                  icon: <Film className="w-4 h-4 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />,
                  data: categories?.now_playing || [],
                },
                {
                  id: 'trending_day',
                  title: '全球热搜榜',
                  subtitle: '全网热度讨论巅峰榜',
                  icon: <Flame className="w-4 h-4 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />,
                  data: categories?.trending_day || trending || [],
                },
                {
                  id: 'top_movies',
                  title: '影史 Top 电影',
                  subtitle: '人类影史至高无上殿堂作品',
                  icon: <Star className="w-4 h-4 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />,
                  data: categories?.top_movies || [],
                },
                {
                  id: 'scifi_action',
                  title: '科幻动作',
                  subtitle: '硬核科幻与爆燃高能大作',
                  icon: <Zap className="w-4 h-4 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />,
                  data: categories?.scifi_action || [],
                },
                {
                  id: 'crime_mystery',
                  title: '悬疑犯罪',
                  subtitle: '高智商案件推理与人性拷问',
                  icon: <Video className="w-4 h-4 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />,
                  data: categories?.crime_mystery || [],
                },
                {
                  id: 'top_animation',
                  title: '神级动画',
                  subtitle: '口碑爆棚与治愈系动画佳作',
                  icon: <Sparkles className="w-4 h-4 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />,
                  data: categories?.top_animation || [],
                },
                {
                  id: 'on_the_air',
                  title: '热门剧集',
                  subtitle: '全球大厂流媒体热播连续剧',
                  icon: <Tv className="w-4 h-4 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />,
                  data: categories?.on_the_air || [],
                },
                {
                  id: 'top_tv',
                  title: '经典高分剧集',
                  subtitle: '9分+ 现象级史诗连续剧',
                  icon: <Clapperboard className="w-4 h-4 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />,
                  data: categories?.top_tv || [],
                },
                {
                  id: 'top_chinese',
                  title: '高分华语电影',
                  subtitle: '高口碑华语与亚洲影坛巨献',
                  icon: <Compass className="w-4 h-4 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />,
                  data: categories?.top_chinese || [],
                },
              ]

              return (
                <div className="space-y-6">
                  {tracks.map((track) => (
                    <div key={track.id} className="space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          {track.icon}
                          <h3 className="text-xs font-black text-white uppercase tracking-wider">
                            {track.title}
                          </h3>
                        </div>
                        {track.hasAction ? (
                          <button
                            onClick={() => openJellyfinDetail('All')}
                            className="text-xs text-[#1DB954] hover:text-emerald-300 font-bold flex items-center gap-0.5 active:scale-95 transition-all cursor-pointer"
                          >
                            <span>查看全部</span>
                            <span>&gt;</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium">
                            {track.subtitle}
                          </span>
                        )}
                      </div>

                      {track.data.length === 0 ? (
                        <div className="flex overflow-x-auto gap-3.5 no-scrollbar py-1 px-0.5">
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <div key={n} className="w-28 md:w-36 shrink-0 space-y-2">
                              <div className="aspect-[2/3] w-full rounded-2xl bg-white/[0.05] shimmer-card border border-white/[0.06]" />
                              <div className="space-y-1.5 px-0.5">
                                <div className="h-3 w-4/5 rounded bg-white/[0.05] shimmer-card" />
                                <div className="h-2.5 w-1/2 rounded bg-white/[0.04] shimmer-card" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex overflow-x-auto gap-3.5 no-scrollbar py-1 px-0.5">
                          {track.data.map((item: any, idx: number) => {
                            const poster = item.cover || item.poster_url || item.raw_cover
                            const rating = item.score || item.rating || item.hot_value
                            return (
                              <motion.div
                                key={item.id || idx}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => openPublicMediaModal(item, 'tmdb')}
                                className="w-28 md:w-36 shrink-0 space-y-1.5 group cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
                              >
                                <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 via-[#16171d] to-gray-900 shadow-xl border border-white/[0.08] group-hover:border-[#1DB954]/50 group-hover:shadow-[0_10px_25px_rgba(29,185,84,0.15)] transition-all duration-300">
                                  {poster ? (
                                    <img
                                      src={poster}
                                      alt={item.title}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                        ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full bg-gradient-to-b from-emerald-950/40 via-gray-900 to-gray-950 border border-white/5 flex flex-col items-center justify-center p-2 text-center ${poster ? 'hidden' : ''}`}>
                                    <Film className="w-6 h-6 text-[#1DB954]/70 mb-1 animate-pulse" />
                                    <span className="text-[10px] font-bold text-gray-200 truncate w-full tracking-tight">{item.title}</span>
                                  </div>

                                  {/* 极简底部双层渐变暗角 */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                                  {/* 右上角已入库角标 */}
                                  {item.in_library && (
                                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-emerald-500/90 backdrop-blur-md text-[9px] font-black text-black shadow-md flex items-center gap-0.5">
                                      已入库
                                    </div>
                                  )}

                                  {rating && (
                                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-lg bg-black/85 backdrop-blur-md text-[10px] font-black text-amber-400 border border-amber-400/35 flex items-center gap-0.5 shadow-md">
                                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                      <span>{rating}</span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-xs md:text-sm font-bold text-gray-200 truncate group-hover:text-white transition-colors">
                                    {item.title}
                                  </h4>
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {item.genres && item.genres.length > 0
                                      ? (Array.isArray(item.genres) ? item.genres.slice(0, 2).join(' / ') : item.genres)
                                      : (item.original_title || '精选佳作')}
                                  </p>
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* TAB 3: 👤 我的 (个人中心 ➔ 播放进度看板 ➔ 硬盘断舍离 ➔ 运维配置) */}
        {activeKey === 'user' && (
          <div className="space-y-5 py-2 pb-8">
            {/* 1️⃣ 💾「本地磁盘」 (高质感翡翠绿与科技青蓝分色 · 突出剩余可用空间) */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <HardDrive className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">本地磁盘</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {/* 系统盘 */}
                <div className="p-3.5 md:p-4 rounded-2xl bg-[#14151c]/90 backdrop-blur-md border border-white/[0.08] shadow-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300">系统盘</span>
                    <span className="text-[10px] font-black text-emerald-400 font-mono">{systemDisks.system.percent}%</span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-white font-mono">{systemDisks.system.used_str} <span className="text-gray-500 font-normal">/ {systemDisks.system.total_str}</span></p>
                    <p className="text-[10px] text-emerald-400/90 font-medium font-mono">剩余 {systemDisks.system.free_str || '38.1 GB'} 可用</p>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${systemDisks.system.percent}%` }} />
                  </div>
                </div>

                {/* 存储盘 */}
                <div className="p-3.5 md:p-4 rounded-2xl bg-[#14151c]/90 backdrop-blur-md border border-white/[0.08] shadow-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300">存储盘</span>
                    <span className="text-[10px] font-black text-cyan-400 font-mono">{systemDisks.storage.percent}%</span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-white font-mono">{systemDisks.storage.used_str} <span className="text-gray-500 font-normal">/ {systemDisks.storage.total_str}</span></p>
                    <p className="text-[10px] text-cyan-400/90 font-medium font-mono">剩余 {systemDisks.storage.free_str || '1.21 TB'} 可用</p>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.4)]" style={{ width: `${systemDisks.storage.percent}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 2️⃣ ▶️「继续观看」(纯进度展示看板 · 手机端滑轨 / PC 端 3 列网格) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">继续观看进度</h3>
                </div>
              </div>

              <div className="flex md:grid md:grid-cols-3 md:gap-4 overflow-x-auto md:overflow-x-visible gap-3.5 no-scrollbar py-1 px-0.5">
                {continueWatchingItems.length === 0 ? (
                  <div className="col-span-3 w-full py-8 text-center text-xs text-gray-500 bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                    暂无正在观看的影视内容
                  </div>
                ) : (
                  continueWatchingItems.map((cw) => {
                    const remainingMinutes = cw.remaining_minutes ?? (cw.progress >= 80 ? 15 : cw.progress >= 50 ? 30 : 45)
                    return (
                      <div
                        key={cw.id}
                        className="w-56 md:w-auto shrink-0 md:shrink space-y-1.5"
                      >
                        <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-950/40 via-gray-900 to-gray-950 border border-white/[0.08] shadow-lg">
                          {cw.backdrop_url ? (
                            <img
                              src={cw.backdrop_url}
                              alt={cw.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          
                          {/* 防破图 16:9 留位 */}
                          <div className={`w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-emerald-950/60 via-gray-900 to-gray-950 ${cw.backdrop_url ? 'hidden' : ''}`}>
                            <Film className="w-7 h-7 text-[#1DB954]/70 mb-1" />
                            <span className="text-[10px] font-bold text-gray-200 truncate w-full">{cw.title}</span>
                          </div>

                          {/* 渐变遮罩 */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                          {/* 百分比标签 */}
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-[9px] font-bold text-emerald-400 font-mono">
                            {cw.progress}%
                          </div>

                          {/* 底部剩余时长文字 */}
                          <div className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-medium text-gray-300 font-mono">
                            剩 {remainingMinutes} 分钟
                          </div>

                          {/* 底部 2px 极细发光进度条 */}
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-[#1DB954] shadow-[0_0_8px_#1DB954]" style={{ width: `${cw.progress}%` }} />
                          </div>
                        </div>

                        <div className="px-0.5">
                          <h4 className="text-xs font-bold text-gray-200 truncate">{cw.title}</h4>
                          <p className="text-[10px] text-gray-400 truncate">{cw.subtitle}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* 3️⃣ 📂「本地文件管理」单按钮入口 */}
            <div className="space-y-2.5">
              <div
                onClick={() => {
                  fetchMoviesPath('/data/movies')
                  setLocalDirModalVisible(true)
                }}
                className="p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] backdrop-blur-md border border-white/10 hover:border-[#1DB954]/50 cursor-pointer transition-all duration-200 group flex items-center justify-between shadow-md active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Folder className="w-5 h-5 text-[#1DB954] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)] shrink-0" />
                  <span className="text-sm font-bold text-white tracking-wide truncate">
                    本地文件管理
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#1DB954] group-hover:translate-x-0.5 transition-transform shrink-0 bg-[#1DB954]/10 border border-[#1DB954]/30 px-3 py-1.5 rounded-xl">
                  <span>进入</span>
                  <span className="text-sm font-mono">&gt;</span>
                </div>
              </div>
            </div>

            {/* 4️⃣ ⚙️「运行状态与设置」 */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <Settings className="w-4 h-4 text-[#1DB954]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">运行状态与设置</h3>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/[0.08] space-y-3">
                {/* 3个状态灯 */}
                <div className="grid grid-cols-3 gap-2 py-1 text-center">
                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[10px] text-gray-400 block">AList 网盘</span>
                    <span className="text-xs font-extrabold text-[#1DB954] flex items-center justify-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse shadow-[0_0_8px_#1DB954]" /> 正常
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[10px] text-gray-400 block">夸克网盘</span>
                    <span className="text-xs font-extrabold text-[#1DB954] flex items-center justify-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse shadow-[0_0_8px_#1DB954]" /> 正常
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[10px] text-gray-400 block">TMDB</span>
                    <span className="text-xs font-extrabold text-[#1DB954] flex items-center justify-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse shadow-[0_0_8px_#1DB954]" /> 正常
                    </span>
                  </div>
                </div>

                {/* 快速更新夸克 Cookie 输入框 */}
                <div className="space-y-1.5 pt-1 border-t border-white/5">
                  <span className="text-[11px] font-bold text-gray-300">更新夸克 Cookie</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cookieInput}
                      onChange={(e) => setCookieInput(e.target.value)}
                      placeholder="粘贴最新夸克 Cookie..."
                      className="flex-1 bg-[#1a1a1a] border border-white/10 focus:border-[#1DB954] text-xs text-white px-3 py-2 rounded-xl outline-none transition-colors"
                    />
                    <button
                      onClick={async () => {
                        if (!cookieInput.trim()) {
                          Toast.show({ content: '请输入 Cookie', position: 'bottom' })
                          return
                        }
                        const ok = await saveQuarkCookie(cookieInput.trim())
                        if (ok) {
                          Toast.show({ content: '夸克 Cookie 保存重载成功！', position: 'bottom' })
                          setCookieInput('')
                        }
                      }}
                      className="px-3.5 py-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs rounded-xl shadow-[0_0_12px_rgba(29,185,84,0.3)] shrink-0 active:scale-95 transition-all"
                    >
                      更新
                    </button>
                  </div>
                </div>

                {/* 5️⃣ 💾 本地海报浏览器缓存管理 (CacheStorage + 0ms 秒开) */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#1DB954]" />
                      <span className="text-xs font-bold text-white">海报离线极速缓存</span>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      已缓存 <span className="text-[#1DB954] font-bold font-mono">{cacheStats.count}</span> 张海报 · 占用 <span className="text-gray-300 font-mono font-bold">{cacheStats.sizeMB} MB</span>
                    </p>
                  </div>
                  <button
                    disabled={isClearingCache}
                    onClick={async () => {
                      setIsClearingCache(true)
                      try {
                        await ImageCacheManager.clearAll()
                        // 同时刷新媒体库与分类
                        await fetchJellyfinMedia(true)
                        const stats = await ImageCacheManager.getStats()
                        setCacheStats(stats)
                        Toast.show({ icon: 'success', content: '本地图片缓存已清理重载！', position: 'bottom' })
                      } catch (e) {
                        Toast.show({ content: '清理失败', position: 'bottom' })
                      } finally {
                        setIsClearingCache(false)
                      }
                    }}
                    className="px-3 py-1.5 bg-[#282828] hover:bg-[#333333] active:scale-95 text-gray-300 hover:text-white border border-white/10 text-xs font-bold rounded-xl transition-all flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                    <span>{isClearingCache ? '清理中...' : '清理缓存'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ✨ Step 2: AI 智能归档确认弹窗 (两步极简入库) */}
      <Popup
        visible={aiConfirmModalVisible}
        onMaskClick={() => !loadingAiAction && setAiConfirmModalVisible(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          backgroundColor: '#14151b',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="p-5 space-y-4 text-white overflow-y-auto no-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#1DB954]/20 border border-[#1DB954]/30 flex items-center justify-center shadow-[0_0_12px_rgba(29,185,84,0.3)]">
                <Sparkles className="w-4 h-4 text-[#1DB954]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">AI 智能入库确认 (第 2 步)</h3>
                <p className="text-[10px] text-gray-400">核对 NAS 归档路径与已选集数</p>
              </div>
            </div>
            <button
              onClick={() => setAiConfirmModalVisible(false)}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingAiAction ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <SpinLoading color="#1DB954" style={{ '--size': '36px' }} />
              <p className="text-xs text-gray-300 font-medium">AI 正在准备入库...</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* 1. 影视与画质信息 */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">目标影视</span>
                  <span className="text-xs font-bold text-white truncate max-w-[65%]">
                    {aiRecommendation?.normalized_title || movieMeta?.title || query}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">影视类型</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[#1DB954]/20 text-[#1DB954] font-bold">
                    {aiRecommendation?.is_tv ? '📺 电视剧 / 剧集' : '🎬 电影'}
                  </span>
                </div>
                {(() => {
                  let totalBytes = 0
                  const allKnownFiles = [...quarkFiles]
                  Object.values(folderChildrenMap).forEach((childList) => allKnownFiles.push(...childList))
                  selectedFileIds.forEach((id) => {
                    const found = allKnownFiles.find((f) => f.id === id)
                    if (found && found.size_bytes) {
                      totalBytes += found.size_bytes
                    }
                  })

                  let realSizeStr = ''
                  if (totalBytes > 1024 * 1024 * 1024) {
                    realSizeStr = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                  } else if (totalBytes > 1024 * 1024) {
                    realSizeStr = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
                  }

                  let realResStr = aiRecommendation?.resolution || '1080P 高清'
                  if (!aiRecommendation?.is_tv) {
                    if (totalBytes >= 10 * 1024 * 1024 * 1024) {
                      realResStr = '4K 臻彩'
                    } else if (totalBytes > 0 && totalBytes < 4 * 1024 * 1024 * 1024) {
                      realResStr = '1080P 高清'
                    }
                  }

                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">画质与大小</span>
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {realResStr} {realSizeStr ? `· ${realSizeStr}` : (aiRecommendation?.estimated_size ? `· ${aiRecommendation?.estimated_size}` : '')}
                      </span>
                    </div>
                  )
                })()}
              </div>

              {/* 2. NAS 自动规划存储路径 */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>NAS 目标存储路径</span>
                  </span>
                  <button
                    onClick={() => {
                      if (!isEditingNasPath) {
                        setTempCustomFolder(customFolderName || '')
                      }
                      setIsEditingNasPath(!isEditingNasPath)
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-all"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditingNasPath ? '完成修改' : '修改路径'}</span>
                  </button>
                </div>
                {isEditingNasPath ? (
                  <div className="space-y-2 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400">NAS 根目录：</label>
                      <input
                        type="text"
                        value={currentNasPath}
                        onChange={(e) => setCurrentNasPath(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs text-gray-200 font-mono focus:border-[#1DB954] outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400">归档子文件夹名：</label>
                      <input
                        type="text"
                        value={tempCustomFolder}
                        onChange={(e) => {
                          setTempCustomFolder(e.target.value)
                          setCustomFolderName(e.target.value)
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs text-emerald-300 font-mono focus:border-[#1DB954] outline-none"
                        placeholder="选填，如：老友记 (1994)"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs text-gray-200 break-all">
                    {currentNasPath}
                    {customFolderName ? `/${customFolderName}` : ''}
                  </div>
                )}
              </div>

              {/* 3. 剧集 / 文件勾选状态与自由调整 */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-[#1DB954]" />
                    <span>下载文件清单</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      已勾选 {selectedFileIds.length} 个
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const allIds = [...quarkFiles.map((f) => f.id)]
                          Object.values(folderChildrenMap).forEach((subList) => {
                            subList.forEach((sf) => {
                              if (!allIds.includes(sf.id)) allIds.push(sf.id)
                            })
                          })
                          setSelectedFileIds(allIds)
                        }}
                        className="px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-[10px] text-gray-300 font-bold transition-all"
                      >
                        全选
                      </button>
                      <button
                        onClick={() => setSelectedFileIds([])}
                        className="px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-[10px] text-gray-300 font-bold transition-all"
                      >
                        清空
                      </button>
                    </div>
                  </div>
                </div>

                {aiDiffResult && (
                  <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/25 text-xs text-emerald-300">
                    <p className="leading-snug text-[11px] font-bold">{aiDiffResult.diff_summary}</p>
                  </div>
                )}

                {/* 文件与季文件夹树状可勾选列表 */}
                {quarkFiles.length > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded-xl bg-black/40 border border-white/[0.06] p-1.5 space-y-1 divide-y divide-white/[0.03]">
                    {quarkFiles.map((file) => {
                      const isFolder = file.is_dir
                      const isExpanded = expandedFolders.includes(file.id)
                      const children = folderChildrenMap[file.id] || []
                      const isLoadingChildren = loadingFolderIds.includes(file.id)
                      
                      // 文件夹勾选状态判定
                      const isSelected = isFolder
                        ? (selectedFileIds.includes(file.id) || (children.length > 0 && children.every((c) => selectedFileIds.includes(c.id))))
                        : selectedFileIds.includes(file.id)
                      const customName = fileCustomNames[file.id]

                      return (
                        <div key={file.id} className="pt-1 first:pt-0 space-y-1">
                          <div
                            className={`p-1.5 rounded-lg flex items-center justify-between gap-2 transition-all ${
                              isSelected ? 'bg-[#1DB954]/10 text-white' : 'hover:bg-white/[0.03] text-gray-400 opacity-75'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* 文件夹展开折叠按钮 */}
                              {isFolder ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (isExpanded) {
                                      setExpandedFolders(expandedFolders.filter((id) => id !== file.id))
                                    } else {
                                      setExpandedFolders([...expandedFolders, file.id])
                                      fetchFolderChildren(file.id, file.name)
                                    }
                                  }}
                                  className="p-1 rounded hover:bg-white/10 text-emerald-400 transition-all shrink-0"
                                >
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setSelectedFileIds(selectedFileIds.filter((id) => id !== file.id))
                                    } else {
                                      setSelectedFileIds([...selectedFileIds, file.id])
                                    }
                                  }}
                                  className="accent-[#1DB954] w-3.5 h-3.5 rounded shrink-0 cursor-pointer"
                                />
                              )}

                              {isFolder && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      const childIds = children.map((c) => c.id)
                                      setSelectedFileIds(selectedFileIds.filter((id) => id !== file.id && !childIds.includes(id)))
                                    } else {
                                      const childIds = children.map((c) => c.id)
                                      const newSet = Array.from(new Set([...selectedFileIds, file.id, ...childIds]))
                                      setSelectedFileIds(newSet)
                                      if (!children.length) {
                                        fetchFolderChildren(file.id, file.name)
                                      }
                                    }
                                  }}
                                  className="accent-[#1DB954] w-3.5 h-3.5 rounded shrink-0 cursor-pointer"
                                />
                              )}

                              <div
                                onClick={() => {
                                  if (isFolder) {
                                    if (isExpanded) {
                                      setExpandedFolders(expandedFolders.filter((id) => id !== file.id))
                                    } else {
                                      setExpandedFolders([...expandedFolders, file.id])
                                      fetchFolderChildren(file.id, file.name)
                                    }
                                  } else {
                                    if (isSelected) {
                                      setSelectedFileIds(selectedFileIds.filter((id) => id !== file.id))
                                    } else {
                                      setSelectedFileIds([...selectedFileIds, file.id])
                                    }
                                  }
                                }}
                                className="min-w-0 flex-1 cursor-pointer"
                              >
                                {editingFileId === file.id ? (
                                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={editingTempName}
                                      onChange={(e) => setEditingTempName(e.target.value)}
                                      className="px-2 py-0.5 rounded bg-black border border-[#1DB954] text-xs text-emerald-300 outline-none w-full"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => {
                                        setFileCustomName(file.id, editingTempName)
                                        setEditingFileId(null)
                                      }}
                                      className="p-1 rounded bg-[#1DB954] text-black text-[10px] font-bold shrink-0"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-[11px] font-medium truncate flex items-center gap-1">
                                      {isFolder && <Folder className="w-3 h-3 text-amber-400 shrink-0" />}
                                      <span>{customName || file.name}</span>
                                      {isFolder && children.length > 0 && (
                                        <span className="text-[9px] text-emerald-400 font-normal">({children.length}集)</span>
                                      )}
                                    </p>
                                    {customName && customName !== file.name && (
                                      <p className="text-[9px] text-gray-500 truncate">原: {file.name}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] font-mono text-gray-500">{file.size}</span>
                              {!isFolder && editingFileId !== file.id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingFileId(file.id)
                                    setEditingTempName(customName || file.name)
                                  }}
                                  className="p-1 text-gray-500 hover:text-cyan-400 rounded transition-all"
                                  title="自定义重命名"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 展开的季子集列表 */}
                          {isFolder && isExpanded && (
                            <div className="pl-6 pr-1 py-1 space-y-1 bg-black/25 rounded-lg border-l-2 border-emerald-500/30">
                              {isLoadingChildren && (
                                <div className="py-2 flex items-center gap-2 text-[10px] text-gray-400">
                                  <SpinLoading color="#1DB954" style={{ '--size': '12px' }} />
                                  <span>正在解析子集列表...</span>
                                </div>
                              )}
                              {children.map((child) => {
                                const isChildSelected = selectedFileIds.includes(child.id)
                                const childCustom = fileCustomNames[child.id]
                                return (
                                  <div
                                    key={child.id}
                                    className={`p-1 rounded flex items-center justify-between gap-2 transition-all ${
                                      isChildSelected ? 'bg-emerald-500/10 text-white' : 'hover:bg-white/[0.02] text-gray-400 opacity-60'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <input
                                        type="checkbox"
                                        checked={isChildSelected}
                                        onChange={() => {
                                          if (isChildSelected) {
                                            setSelectedFileIds(selectedFileIds.filter((id) => id !== child.id))
                                          } else {
                                            setSelectedFileIds([...selectedFileIds, child.id])
                                          }
                                        }}
                                        className="accent-[#1DB954] w-3 h-3 rounded shrink-0 cursor-pointer"
                                      />
                                      <div
                                        onClick={() => {
                                          if (isChildSelected) {
                                            setSelectedFileIds(selectedFileIds.filter((id) => id !== child.id))
                                          } else {
                                            setSelectedFileIds([...selectedFileIds, child.id])
                                          }
                                        }}
                                        className="min-w-0 flex-1 cursor-pointer"
                                      >
                                        {editingFileId === child.id ? (
                                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                            <input
                                              type="text"
                                              value={editingTempName}
                                              onChange={(e) => setEditingTempName(e.target.value)}
                                              className="px-1.5 py-0.5 rounded bg-black border border-[#1DB954] text-[11px] text-emerald-300 outline-none w-full"
                                              autoFocus
                                            />
                                            <button
                                              onClick={() => {
                                                setFileCustomName(child.id, editingTempName)
                                                setEditingFileId(null)
                                              }}
                                              className="p-0.5 rounded bg-[#1DB954] text-black text-[9px] font-bold shrink-0"
                                            >
                                              <Check className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div>
                                            <p className="text-[10px] font-medium truncate text-emerald-200">
                                              {childCustom || child.name}
                                            </p>
                                            {childCustom && childCustom !== child.name && (
                                              <p className="text-[8px] text-gray-500 truncate">原: {child.name}</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-[9px] font-mono text-gray-500">{child.size}</span>
                                      {editingFileId !== child.id && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingFileId(child.id)
                                            setEditingTempName(childCustom || child.name)
                                          }}
                                          className="p-0.5 text-gray-500 hover:text-cyan-400 rounded transition-all"
                                          title="修改文件名"
                                        >
                                          <Edit3 className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 4. 底部确认按钮 */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={async () => {
                    const success = await executeAiDownload()
                    if (success) {
                      setIsFlyAnimating(true)
                      setTimeout(() => setIsFlyAnimating(false), 1500)
                      Toast.show({ icon: 'success', content: '已成功开启后台转存与下载！', position: 'bottom' })
                    } else {
                      Toast.show({ icon: 'fail', content: '创建下载任务失败，请重试', position: 'bottom' })
                    }
                  }}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.98] text-black text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-[0_6px_25px_rgba(29,185,84,0.4)] transition-all"
                >
                  <CheckCircle className="w-4 h-4 fill-black" />
                  <span>🚀 确认并一键转存下载</span>
                </button>

                <button
                  onClick={() => {
                    setAiConfirmModalVisible(false)
                    if (selectedResource) {
                      openDownloadPopup(selectedResource)
                    }
                  }}
                  className="py-3.5 px-3.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-bold text-gray-300 flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>手动微调</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </Popup>

      {/* 消息通知中心 Popup */}
      <Popup
        visible={notifPopupVisible}
        onMaskClick={() => setNotifPopupVisible(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          backgroundColor: '#121212',
          maxHeight: '75vh',
          minHeight: '40vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="flex flex-col h-full bg-[#121212] text-white overflow-hidden rounded-t-2xl">
          <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#1DB954]" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">传输与消息通知</h3>
            </div>
            <div className="flex items-center gap-3">
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-xs text-[#B3B3B3] hover:text-red-400 transition-colors"
                >
                  清空通知
                </button>
              )}
              <button
                onClick={() => setNotifPopupVisible(false)}
                className="text-xs text-[#B3B3B3] hover:text-white px-2 py-0.5 bg-[#242424] rounded transition-colors"
              >
                关闭
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2.5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2 text-[#666666]">
                <Bell className="w-8 h-8 opacity-40 stroke-[1.5]" />
                <p className="text-xs font-medium">暂无新通知消息</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#181818] border border-white/5 flex gap-3 items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-base shrink-0 select-none">
                      {item.type === 'completed' ? '✅' : item.type === 'failed' ? '❌' : '⏳'}
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                        <span className="text-[10px] text-[#B3B3B3] font-mono shrink-0 ml-2">{item.time}</span>
                      </div>
                      <p className="text-xs text-gray-300 font-medium leading-relaxed truncate">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Popup>

      {/* 📂 本地文件管理 抽屉 (Drawer) */}
      <Popup
        visible={localDirModalVisible}
        onMaskClick={() => {
          setLocalDirModalVisible(false)
          setActiveMenuPath(null)
        }}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          backgroundColor: '#121212',
          maxHeight: '85vh',
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="flex flex-col h-full bg-[#121212] text-white overflow-hidden rounded-t-3xl relative">
          {/* 抽屉顶部拖拽条 Handle Bar */}
          <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mt-2.5 mb-1 shrink-0" />

          {/* 抽屉 Header 顶栏 */}
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#161616]">
            {/* 左侧：返回上级 (纯图标) */}
            <div className="shrink-0">
              {parentDirPath ? (
                <button
                  onClick={() => {
                    setActiveMenuPath(null)
                    fetchMoviesPath(parentDirPath)
                  }}
                  className="w-8 h-8 rounded-xl bg-[#242424] hover:bg-[#303030] text-[#1DB954] flex items-center justify-center transition-all border border-[#1DB954]/30 active:scale-95 shadow-sm"
                  title="返回上级"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-[#1c1c1c] text-gray-600 border border-white/5 flex items-center justify-center cursor-not-allowed">
                  <ArrowLeft className="w-4 h-4 opacity-30" />
                </div>
              )}
            </div>

            {/* 中间：当前路径 */}
            <div className="flex-1 min-w-0 px-3 text-center">
              <p className="text-xs font-mono font-bold text-gray-300 truncate" title={`当前: ${currentDirPath}`}>
                <span className="text-gray-500 font-normal">当前: </span>
                {currentDirPath}
              </p>
            </div>

            {/* 右侧：关闭 (纯图标) */}
            <div className="shrink-0">
              <button
                onClick={() => {
                  setLocalDirModalVisible(false)
                  setActiveMenuPath(null)
                }}
                className="w-8 h-8 rounded-xl bg-[#242424] hover:bg-[#303030] text-gray-300 hover:text-white flex items-center justify-center transition-colors border border-white/5 active:scale-95"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 抽屉 Content 列表 */}
          <div
            onClick={() => setActiveMenuPath(null)}
            className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar"
          >
            {moviesItems.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-500 font-mono flex flex-col items-center justify-center space-y-2">
                <Folder className="w-8 h-8 opacity-30 text-gray-400" />
                <p className="text-gray-400 font-medium">该目录下暂无任何剧集或电影文件</p>
              </div>
            ) : (
              moviesItems.map((item) => (
                <div
                  key={item.path}
                  className="py-2 px-3 rounded-xl bg-[#181818] hover:bg-[#222222] border border-white/5 flex items-center justify-between gap-2.5 transition-all group relative shadow-sm"
                >
                  {/* 左侧整块：点击默认进入下一级目录 */}
                  <div
                    onClick={() => {
                      if (item.is_dir) {
                        setActiveMenuPath(null)
                        fetchMoviesPath(item.path)
                      }
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#1DB954]/10 border border-[#1DB954]/20 flex items-center justify-center text-[#1DB954] shrink-0 group-hover:scale-105 transition-transform">
                      {item.is_dir ? (
                        <Folder className="w-3.5 h-3.5" />
                      ) : (
                        <Film className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                    </div>

                    {editingFolderPath === item.path ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                      >
                        <input
                          type="text"
                          value={folderRenameInput}
                          onChange={(e) => setFolderRenameInput(e.target.value)}
                          className="bg-[#242424] border border-[#1DB954] text-xs text-white px-2.5 py-1 rounded-lg w-full outline-none"
                          placeholder="输入新名称..."
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameMovieFolder(item.path)}
                          className="px-2.5 py-1 bg-[#1DB954] text-black font-extrabold text-xs rounded-lg shrink-0 active:scale-95"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingFolderPath(null)}
                          className="px-2 py-1 bg-[#333333] text-gray-300 text-xs rounded-lg shrink-0"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1 flex items-center justify-between gap-2 pr-1">
                        <p className="text-xs font-bold text-gray-100 group-hover:text-[#1DB954] transition-colors truncate" title={item.name}>
                          {item.name}
                        </p>
                        {!item.is_dir && item.size_str ? (
                          <span className="text-[10px] font-mono text-cyan-400/90 font-medium shrink-0 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                            {item.size_str}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* 右侧：唯一的 ⋮ (三个点) 图标 */}
                  {editingFolderPath !== item.path && (
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveMenuPath(activeMenuPath === item.path ? null : item.path)
                        }}
                        className="w-7 h-7 rounded-lg bg-[#242424] hover:bg-[#303030] text-gray-300 hover:text-white flex items-center justify-center transition-all active:scale-90 border border-white/5"
                        title="更多操作"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* 悬浮小菜单 Action Sheet */}
                      {activeMenuPath === item.path && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-9 z-50 w-32 bg-[#1f1f1f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1 backdrop-blur-xl animate-fadeIn"
                        >
                          <button
                            onClick={() => {
                              setActiveMenuPath(null)
                              setEditingFolderPath(item.path)
                              setFolderRenameInput(item.name)
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs text-gray-200 hover:bg-white/10 flex items-center gap-2 transition-colors font-medium"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-gray-400" /> 重命名
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuPath(null)
                              setDeleteTarget({ path: item.path, name: item.name, size_str: item.size_str || item.name })
                              setDeletePassword('')
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors font-bold border-t border-white/5"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" /> 删除
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </Popup>

      {/* 📺 追剧追更与本地剧库中心 Modal */}
      <Popup
        visible={subscriptionModalVisible}
        onMaskClick={() => setSubscriptionModalVisible(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          backgroundColor: '#12131a',
          padding: '20px',
          maxHeight: '85vh',
        }}
      >
        <div className="space-y-4 text-white overflow-y-auto max-h-[75vh] no-scrollbar">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Tv className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <span>剧集追更与本地片库中心</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                    Phase 4
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400">自动比对 NAS 本地集数与网盘更新，增量补齐入库</p>
              </div>
            </div>
            <button
              onClick={() => setSubscriptionModalVisible(false)}
              className="text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5"
            >
              关闭
            </button>
          </div>

          {/* 1. 订阅中的热播追更剧集 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-amber-400" />
                <span>正在追更的剧集 ({subscriptions.length})</span>
              </span>
              <button
                onClick={() => fetchSubscriptions()}
                className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>刷新</span>
              </button>
            </div>

            {subscriptions.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs text-gray-500">
                暂无追更剧集。在搜索剧集时点击卡片上的【追更订阅】，即可自动加入跟踪！
              </div>
            ) : (
              <div className="space-y-2">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-amber-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{sub.title}</span>
                          {sub.year && <span className="text-[10px] text-gray-400">({sub.year})</span>}
                        </h4>
                        <p className="text-[10px] text-gray-500 font-mono truncate max-w-xs mt-0.5">
                          {sub.folder_path}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold font-mono">
                        本地已存 {sub.total_local} 集
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[10px] text-gray-400 font-mono">
                        画质偏好: {sub.res_preference || '4K'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSubscriptionModalVisible(false)
                            search(sub.title)
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#1DB954]/20 hover:bg-[#1DB954]/30 text-[#1DB954] text-[11px] font-bold transition-all flex items-center gap-1"
                        >
                          <Search className="w-2.5 h-2.5" />
                          <span>一键搜新集</span>
                        </button>
                        <button
                          onClick={() => deleteSubscription(sub.id)}
                          className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] transition-all"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. NAS 本地已有电视剧列表 */}
          <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-cyan-400" />
                <span>NAS 本地已有电视剧库 ({localTvShows.length} 部)</span>
              </span>
              <span className="text-[10px] text-gray-500 font-mono">/data/movies/电视剧</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto no-scrollbar">
              {localTvShows.map((show, sIdx) => {
                const isSubbed = subscriptions.some((s) => s.title === show.title)
                return (
                  <div
                    key={sIdx}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-200 truncate">{show.folder_name}</p>
                      <p className="text-[10px] text-emerald-400 font-mono">
                        已存 {show.total_episodes} 集
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSubscriptionModalVisible(false)
                        search(show.title)
                      }}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-[#1DB954]/20 text-gray-300 hover:text-[#1DB954] text-[10px] font-bold shrink-0 transition-all"
                    >
                      {isSubbed ? '搜新集' : '追更'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Popup>

      {/* 系统设置与配置 Modal */}
      <Popup
        visible={cookieModalVisible}
        onMaskClick={() => setCookieModalVisible(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          backgroundColor: '#121212',
          padding: '18px',
        }}
      >
        <div className="space-y-4 bg-[#121212] text-white">
          <div className="flex items-center justify-between border-b border-[#282828] pb-3">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#1DB954]" />
              <h3 className="text-sm font-bold text-white">系统设置与高级运维</h3>
            </div>
            <button onClick={() => setCookieModalVisible(false)} className="text-xs text-[#B3B3B3]">
              关闭
            </button>
          </div>

          {/* 1. 本地已刮削影片库管理 */}
          <div className="bg-[#181818] p-3.5 rounded-xl border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Film className="w-4 h-4 text-[#1DB954]" />
                <span>本地刮削影片库数据管理</span>
              </span>
              <span className="text-[10px] text-[#B3B3B3] font-mono">
                {jellyfinMedia.movies.length + jellyfinMedia.series.length} 部影片已入库
              </span>
            </div>
            <p className="text-[11px] text-[#888888] leading-relaxed">
              主动连接 NAS Jellyfin 服务拉取最新的全量海报与演职人员元数据，强制更新本地 10 分钟缓存。
            </p>
            <Button
              block
              onClick={async () => {
                Toast.show({ icon: 'loading', content: '正在同步 NAS 最新影片数据...' })
                await fetchJellyfinMedia(true)
                Toast.show({ icon: 'success', content: '本地影片库数据已强制刷新！', duration: 2500 })
              }}
              style={{
                backgroundColor: '#242424',
                color: '#1DB954',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                border: '1px solid rgba(29, 185, 84, 0.3)',
                height: '38px',
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${loadingJellyfin ? 'animate-spin' : ''}`} />
              强制刷新本地已刮削影片库
            </Button>
          </div>

          {/* 2. 夸克 Cookie */}
          <div className="bg-[#181818] p-3.5 rounded-xl border border-white/5 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Key className="w-4 h-4 text-[#1DB954]" />
              <h4 className="text-xs font-bold text-white">夸克网盘凭证 (Cookie) 更新</h4>
            </div>
            <p className="text-[11px] text-[#888888] font-normal leading-relaxed">
              粘贴最新的夸克 Cookie 字符串，用以支持高清原盘极速转存与自动解密。
            </p>

            <div className="rounded-md overflow-hidden bg-[#121212] border border-white/10 p-2">
              <TextArea
                placeholder="请在此粘贴夸克网盘 Cookie..."
                value={cookieInput}
                onChange={setCookieInput}
                rows={3}
                style={{
                  '--color': '#ffffff',
                  '--font-size': '12px',
                  '--placeholder-color': '#666666',
                }}
              />
            </div>

            <Button
              block
              onClick={handleSaveCookie}
              style={{
                backgroundColor: '#1DB954',
                color: '#000000',
                borderRadius: '8px',
                fontWeight: 'bold',
                border: 'none',
                height: '38px',
                fontSize: '12px',
                boxShadow: '0 0 15px rgba(29, 185, 84, 0.3)',
              }}
            >
              保存并应用 Cookie
            </Button>
          </div>
        </div>
      </Popup>

      {/* 选集与目录选择 Popup - 【重构：选集带明显 Checkbox & line-clamp-2 换行 & 底部固定悬浮按钮】 */}
      <Popup
        visible={popupVisible}
        onMaskClick={closeDownloadPopup}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          backgroundColor: '#121212',
          maxHeight: '85vh',
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="flex flex-col h-full bg-[#121212] text-white overflow-hidden rounded-t-xl">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#282828] flex items-center justify-between shrink-0 bg-[#161616]">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954] text-[11px] font-extrabold font-mono">
                {popupStep}/2
              </span>
              <h3 className="text-xs font-bold text-white tracking-wide">
                {popupStep === 1 && '夸克网盘选集解析'}
                {popupStep === 2 && '选择保存文件夹与文件设置'}
              </h3>
            </div>
            <button
              onClick={closeDownloadPopup}
              className="w-6 h-6 rounded-full bg-[#242424] text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors"
            >
              ✕
            </button>
          </div>

          {/* STEP 1: 选集 (支持树形目录下钻与文件选择) */}
          {popupStep === 1 && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3.5 py-2.5 bg-[#181818] flex items-center justify-between gap-2 shrink-0 border-b border-white/5">
                {/* 醒目的【返回上一级】按钮 */}
                {quarkPathHistory.length > 1 ? (
                  <button
                    onClick={popQuarkPathHistory}
                    className="px-2.5 py-1 rounded-md bg-[#242424] hover:bg-[#303030] border border-white/10 text-white text-xs font-bold flex items-center gap-1 shrink-0 active:scale-95 transition-all shadow-sm"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-[#1DB954]" />
                    <span>返回上一级</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-[#888888] font-bold shrink-0">📍 根目录</span>
                )}

                {/* 当前路径面包屑 */}
                <div className="flex-1 min-w-0 px-1 text-center">
                  <p className="text-[11px] text-[#B3B3B3] font-mono truncate">
                    {quarkPathHistory.map(h => h.name).join(' / ')}
                  </p>
                </div>

                {/* 全选 / 反选 按钮 */}
                <button
                  onClick={toggleSelectAllFiles}
                  className="px-2.5 py-1 rounded-md bg-[#1DB954]/15 border border-[#1DB954]/30 text-[#1DB954] text-xs font-bold shrink-0 active:scale-95 transition-all"
                >
                  {selectedFileIds.length === quarkFiles.length ? '反选' : '全选'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {loadingFiles ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-2">
                    <SpinLoading color="primary" style={{ '--size': '28px' }} />
                    <p className="text-xs text-[#B3B3B3]">读取夸克网盘目录数据中...</p>
                  </div>
                ) : quarkParseError ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2 my-6">
                    <p className="text-xs font-bold text-amber-400">⚠️ {quarkParseError}</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      提示：请关闭当前解析弹窗，在下方列表中尝试选择其他全网夸克源。
                    </p>
                    <button
                      onClick={closeDownloadPopup}
                      className="px-3 py-1 text-xs rounded bg-amber-500/20 text-amber-300 font-bold hover:bg-amber-500/30"
                    >
                      关闭并重选其他夸克源
                    </button>
                  </div>
                ) : quarkFiles.length === 0 ? (
                  <div className="text-center py-16 text-xs text-[#666666]">
                    当前文件夹为空
                  </div>
                ) : (
                  quarkFiles.map((file) => {
                    if (file.is_dir) {
                      const isFolderChecked = selectedFileIds.includes(file.id)
                      return (
                        <div
                          key={file.id}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all border ${
                            isFolderChecked ? 'bg-[#1e2a22] border-[#1DB954]/40' : 'bg-[#181818] border-white/5 hover:bg-[#222222]'
                          }`}
                        >
                          {/* 左侧独立勾选框：勾选/反选该文件夹 */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSingleFile(file.id)
                            }}
                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                              isFolderChecked
                                ? 'bg-[#1DB954] text-black shadow-[0_0_8px_rgba(29,185,84,0.6)]'
                                : 'border border-gray-600 bg-transparent'
                            }`}
                          >
                            {isFolderChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>

                          {/* 文件夹名称与【进入 >】按钮 */}
                          <div
                            onClick={() => fetchQuarkFiles(file.id, file.name)}
                            className="flex-1 flex items-center justify-between min-w-0 cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Folder className="w-4 h-4 text-[#1DB954] shrink-0" />
                              <span className="text-xs font-bold text-white truncate group-hover:text-[#1DB954] transition-colors">
                                {file.name}
                              </span>
                            </div>
                            <span className="text-xs text-[#1DB954] font-medium shrink-0 flex items-center gap-0.5 ml-2">
                              <span>进入</span>
                              <span>&gt;</span>
                            </span>
                          </div>
                        </div>
                      )
                    }

                    const isChecked = selectedFileIds.includes(file.id)
                    return (
                      <div
                        key={file.id}
                        onClick={() => toggleSingleFile(file.id)}
                        className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all border ${
                          isChecked ? 'bg-[#1e2a22] border-[#1DB954]/40' : 'bg-[#181818] border-transparent hover:bg-[#202020]'
                        }`}
                      >
                        {/* 左侧明显视觉 Checkbox 复选框 */}
                        <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-[#1DB954] text-black shadow-[0_0_8px_rgba(29,185,84,0.6)]'
                            : 'border border-gray-600 bg-transparent'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        {/* 右侧文件名长文本 */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs font-bold text-white leading-relaxed line-clamp-2 break-all text-wrap">
                            {file.name}
                          </p>
                          <span className="text-[11px] text-[#B3B3B3] font-normal block font-mono">{file.size}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* 底部固定常驻下一步按钮 */}
              <div className="p-3 border-t border-[#282828] bg-[#121212] shrink-0">
                <Button
                  block
                  disabled={selectedFileIds.length === 0 || loadingFiles}
                  onClick={() => setPopupStep(2)}
                  style={{
                    backgroundColor: '#1DB954',
                    color: '#000000',
                    borderRadius: '20px',
                    fontWeight: 'bold',
                    border: 'none',
                    height: '38px',
                    fontSize: '12px',
                  }}
                >
                  下一步：选择路径 ({selectedFileIds.length} 项)
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: 物理文件夹选择与命名设置 (绝无套娃·直觉模式) */}
          {popupStep === 2 && (
            <div className="flex-1 flex flex-col justify-between min-h-0 bg-[#121212]">
              {/* 顶栏：智能后退按钮 + 全局大白话当前位置 + 右上角新建文件夹 */}
              <div className="px-3.5 py-3 bg-[#181818] border-b border-white/10 shrink-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  {/* 左上角单一智能后退按键 */}
                  {currentNasPath !== '/data/movies' && parentNasPath ? (
                    <button
                      onClick={() => fetchNasPath(parentNasPath)}
                      className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#303030] border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all shadow-sm"
                    >
                      <ArrowLeft className="w-4 h-4 text-[#1DB954]" />
                      <span>返回上级</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setPopupStep(1)}
                      className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#303030] border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all shadow-sm"
                    >
                      <ArrowLeft className="w-4 h-4 text-[#1DB954]" />
                      <span>返回选集</span>
                    </button>
                  )}

                  {/* 右上角新建文件夹按钮 */}
                  <button
                    onClick={() => {
                      if (!showNewFolderInput) {
                        const defaultName = (movieMeta && movieMeta.title)
                          ? `${movieMeta.title.trim()}${movieMeta.year && !movieMeta.title.includes(String(movieMeta.year)) ? ` (${String(movieMeta.year).trim()})` : ''}`
                          : (customFolderName && customFolderName !== '未命名影视'
                              ? customFolderName
                              : generateDefaultFolderName(selectedResource?.title || '', movieMeta))
                        setNewFolderNameInput(defaultName || '')
                      }
                      setShowNewFolderInput(!showNewFolderInput)
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#1DB954]/20 hover:bg-[#1DB954]/30 border border-[#1DB954]/40 text-[#1DB954] text-xs font-extrabold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>+ 新建文件夹</span>
                  </button>
                </div>

                {/* 全屏幕唯一的集中大白话路径展示 */}
                <div className="flex items-center gap-1.5 text-xs text-gray-200 font-mono font-bold pt-0.5 break-all">
                  <Folder className="w-4 h-4 text-[#1DB954] shrink-0" />
                  <span className="text-gray-400">当前位置:</span>
                  <span className="text-white font-extrabold">{currentNasPath}</span>
                </div>
              </div>

              {/* 新建文件夹内联条 */}
              {showNewFolderInput && (
                <div className="px-3.5 py-2.5 bg-[#1b271f] border-b border-[#1DB954]/30 flex items-center gap-2 animate-fadeIn shrink-0">
                  <Folder className="w-4 h-4 text-[#1DB954] shrink-0" />
                  <input
                    type="text"
                    value={newFolderNameInput}
                    onChange={(e) => setNewFolderNameInput(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        if (!newFolderNameInput.trim()) return
                        const resPath = await createNasFolder(newFolderNameInput.trim())
                        if (resPath) {
                          Toast.show({ icon: 'success', content: `已在当前位置创建: ${newFolderNameInput.trim()}` })
                          setNewFolderNameInput('')
                          setShowNewFolderInput(false)
                        }
                      }
                    }}
                    placeholder="输入新文件夹名称 (如: 小欢喜 (2019))"
                    className="flex-1 bg-black/60 text-white text-xs px-2.5 py-1.5 rounded border border-white/15 focus:outline-none focus:border-[#1DB954]"
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      if (!newFolderNameInput.trim()) return
                      const resPath = await createNasFolder(newFolderNameInput.trim())
                      if (resPath) {
                        Toast.show({ icon: 'success', content: `已在当前位置创建: ${newFolderNameInput.trim()}` })
                        setNewFolderNameInput('')
                        setShowNewFolderInput(false)
                      }
                    }}
                    className="px-3 py-1.5 bg-[#1DB954] text-black text-xs font-extrabold rounded hover:opacity-90 active:scale-95 transition-all shrink-0"
                  >
                    确定创建
                  </button>
                  <button
                    onClick={() => {
                      setShowNewFolderInput(false)
                      setNewFolderNameInput('')
                    }}
                    className="px-2 py-1 text-gray-400 hover:text-white text-xs shrink-0"
                  >
                    取消
                  </button>
                </div>
              )}

              {/* 主体滚动区：1. 文件夹列表  2. 待保存文件 */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                {/* 1. 文件夹列表 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-300 px-0.5">
                    <span>📂 文件夹列表：</span>
                    <span className="text-[11px] text-gray-500 font-mono">{nasFolders.length} 个子文件夹</span>
                  </div>

                  <div className="space-y-1.5">
                    {loadingNas ? (
                      <div className="py-6 text-center">
                        <SpinLoading color="primary" style={{ '--size': '22px' }} />
                        <p className="text-xs text-gray-500 mt-2">读取目录中...</p>
                      </div>
                    ) : nasFolders.length === 0 ? (
                      <div className="py-5 text-center text-xs text-gray-500 bg-[#161616] rounded-xl border border-dashed border-white/10 space-y-1">
                        <p className="font-bold text-gray-400">当前目录下无子文件夹</p>
                        <p className="text-[11px] text-gray-500">可直接保存至此目录，或点击上方「+ 新建文件夹」</p>
                      </div>
                    ) : (
                      nasFolders.map((folder) => (
                        <div
                          key={folder.path}
                          onClick={() => fetchNasPath(folder.path)}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#1a1a1a] hover:bg-[#242424] cursor-pointer text-xs transition-colors border border-white/5 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Folder className="w-4 h-4 text-[#1DB954] shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-gray-200 truncate group-hover:text-white">{folder.name}</span>
                          </div>
                          <span className="text-xs text-[#1DB954] font-bold shrink-0 bg-[#1DB954]/10 px-2.5 py-1 rounded-lg border border-[#1DB954]/20 group-hover:bg-[#1DB954] group-hover:text-black transition-all">
                            打开 &gt;
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. 待保存文件 */}
                {selectedFileIds.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-300 px-0.5">
                      <span>📄 待保存文件：</span>
                      <span className="text-[11px] text-gray-500 font-mono">共 {selectedFileIds.length} 项</span>
                    </div>

                    <div className="space-y-2">
                      {(quarkFiles || [])
                        .filter((f) => selectedFileIds.includes(f.id))
                        .map((f) => {
                          const currentName = fileCustomNames[f.id] !== undefined ? fileCustomNames[f.id] : f.name
                          return (
                            <div key={f.id} className="p-2.5 bg-[#161616] rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center gap-2">
                              {/* 左侧：原文件名 */}
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-sm shrink-0">📄</span>
                                <span className="text-xs font-bold text-gray-300 truncate" title={f.name}>
                                  {f.name}
                                </span>
                              </div>

                              {/* 箭头连接标志 */}
                              <span className="hidden sm:inline text-xs text-gray-500 font-mono shrink-0">──&gt;</span>

                              {/* 右侧：编辑框 */}
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={currentName}
                                  onChange={(e) => setFileCustomName(f.id, e.target.value)}
                                  placeholder="修改保存文件名"
                                  className="w-full bg-black/60 text-xs font-mono font-bold text-white px-3 py-1.5 rounded-lg border border-white/15 focus:outline-none focus:border-[#1DB954]"
                                />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* 底部行动大按钮 */}
              <div className="p-3.5 border-t border-[#282828] bg-[#121212] shrink-0">
                <Button
                  block
                  onClick={handleConfirmDownload}
                  style={{
                    backgroundColor: '#1DB954',
                    color: '#000000',
                    borderRadius: '24px',
                    fontWeight: '900',
                    border: 'none',
                    height: '44px',
                    fontSize: '14px',
                    boxShadow: '0 0 16px rgba(29, 185, 84, 0.4)',
                  }}
                >
                  🟢 保存并下载 (共 {selectedFileIds.length} 项)
                </Button>
              </div>
            </div>
          )}
        </div>
      </Popup>

      {/* 确认下载转存时的跃迁跳动特效 */}
      {isFlyAnimating && (
        <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
          <div className="bg-[#1DB954] text-black font-black px-5 py-2.5 rounded-full shadow-[0_0_30px_rgba(29,185,84,0.9)] flex items-center gap-2.5 animate-bounce border-2 border-white scale-110">
            <span className="text-2xl">🚀</span>
            <span className="text-xs font-mono font-extrabold tracking-wide">已成功触发物理归档与转存！</span>
          </div>
        </div>
      )}

      {/* Jellyfin 查看更多 Modal (超大窗口全屏展开) */}
      <Popup
        visible={jellyfinDetailModalVisible}
        onMaskClick={closeJellyfinDetail}
        bodyStyle={{
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          minHeight: '88vh',
          maxHeight: '94vh',
          backgroundColor: '#121212',
        }}
      >
        {(() => {
          const currentType = jellyfinDetailType || 'All'
          const movieItems = jellyfinMedia?.movies || []
          const seriesItems = jellyfinMedia?.series || []

          const totalCount = movieItems.length + seriesItems.length

          let rawItems: any[] = []
          if (currentType === 'Series') {
            rawItems = [...seriesItems].sort((a: any, b: any) => (b.mtime || 0) - (a.mtime || 0))
          } else if (currentType === 'Movie') {
            rawItems = [...movieItems].sort((a: any, b: any) => (b.mtime || 0) - (a.mtime || 0))
          } else {
            rawItems = [
              ...movieItems.map(m => ({ ...m, _mediaTypeLabel: '电影' })),
              ...seriesItems.map(s => ({ ...s, _mediaTypeLabel: '剧集' }))
            ].sort((a: any, b: any) => (b.mtime || 0) - (a.mtime || 0))
          }

          const filtered = rawItems.filter(item => 
            !jellyfinSearchKey || 
            item.title.toLowerCase().includes(jellyfinSearchKey.toLowerCase()) ||
            (item.overview && item.overview.toLowerCase().includes(jellyfinSearchKey.toLowerCase()))
          )

          return (
            <div className="p-4 space-y-4 text-white flex flex-col h-[88vh]">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">本地影视媒体库</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1DB954]/20 text-[#1DB954] font-mono font-bold">
                    {filtered.length} / {totalCount} 部已入库
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      Toast.show({ icon: 'loading', content: '正在强刷媒体库...', duration: 1500 })
                      await fetchJellyfinMedia(true)
                      const stats = await ImageCacheManager.getStats()
                      setCacheStats(stats)
                      Toast.show({ icon: 'success', content: '媒体库已同步最新！', position: 'bottom' })
                    }}
                    title="强制刷新并重新刮削"
                    className="p-1 rounded-lg bg-[#282828] hover:bg-[#333333] text-gray-300 hover:text-white transition-colors flex items-center gap-1 text-[11px] px-2"
                  >
                    <RefreshCw className="w-3 h-3 text-[#1DB954]" />
                    <span>刷新</span>
                  </button>
                  <button
                    onClick={closeJellyfinDetail}
                    className="text-xs text-[#B3B3B3] hover:text-white px-2.5 py-1 bg-[#282828] hover:bg-[#333333] rounded-lg transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>

              {/* Segmented Tab Switcher (全部 / 电影 / 剧集) */}
              <div className="flex items-center gap-1.5 bg-[#1f1f1f] p-1 rounded-xl shrink-0 border border-white/5">
                <button
                  onClick={() => setJellyfinDetailType('All')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentType === 'All'
                      ? 'bg-[#1DB954] text-black shadow-[0_0_12px_rgba(29,185,84,0.3)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  全部 ({totalCount})
                </button>
                <button
                  onClick={() => setJellyfinDetailType('Movie')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentType === 'Movie'
                      ? 'bg-[#1DB954] text-black shadow-[0_0_12px_rgba(29,185,84,0.3)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  电影 ({movieItems.length})
                </button>
                <button
                  onClick={() => setJellyfinDetailType('Series')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentType === 'Series'
                      ? 'bg-[#1DB954] text-black shadow-[0_0_12px_rgba(29,185,84,0.3)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  剧集 ({seriesItems.length})
                </button>
              </div>

              {/* Modal Search Bar */}
              <div className="relative shrink-0">
                <input
                  type="text"
                  placeholder={`在 ${rawItems.length} 部${currentType === 'Series' ? '剧集' : currentType === 'Movie' ? '电影' : '全部影片'}中快速过滤...`}
                  value={jellyfinSearchKey}
                  onChange={(e) => setJellyfinSearchKey(e.target.value)}
                  className="w-full bg-[#1f1f1f] text-white placeholder-gray-500 text-xs px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-[#1DB954]"
                />
              </div>

              {/* Grid List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {filtered.length === 0 ? (
                  <div className="text-center py-16 text-xs text-[#666666]">
                    未找到匹配的本地{currentType === 'Series' ? '剧集' : currentType === 'Movie' ? '电影' : '影片'}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pb-6">
                    {filtered.map((item: any) => (
                      <motion.div
                        key={item.id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => openPublicMediaModal(item, 'tmdb')}
                        className="bg-[#181818] p-2.5 rounded-xl border border-white/5 hover:border-[#1DB954]/40 transition-all cursor-pointer flex flex-col justify-between space-y-2 group"
                      >
                        <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden bg-[#282828]">
                          <img
                            src={item.cover || item.poster_url || item.raw_cover}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = DEFAULT_POSTER_SVG
                            }}
                          />
                          {item._mediaTypeLabel && (
                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[9px] font-black text-[#1DB954] shadow-sm border border-[#1DB954]/30">
                              {item._mediaTypeLabel}
                            </div>
                          )}
                          {item.rating && (
                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-bold text-[#1DB954] flex items-center gap-0.5 shadow-sm">
                              <Star className="w-2.5 h-2.5 fill-[#1DB954]" />
                              {item.rating}
                            </div>
                          )}
                          {item.year && (
                            <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-medium text-gray-300">
                              {item.year}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-[#1DB954] transition-colors">
                            {item.title}
                          </h4>
                          {item.genres && item.genres.length > 0 && (
                            <p className="text-[10px] text-[#B3B3B3] truncate pt-0.5">
                              {Array.isArray(item.genres) ? item.genres.join(' / ') : item.genres}
                            </p>
                          )}
                          {item.overview && (
                            <p className="text-[10px] text-[#777777] line-clamp-2 leading-tight pt-1">
                              {item.overview}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </Popup>

      {/* 影片全能卡片详情 Modal (紧凑顶部浮层，精简纯净展示) */}
      <Popup
        visible={jellyfinItemModalVisible}
        onMaskClick={closeJellyfinItemModal}
        bodyStyle={{
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          minHeight: '75vh',
          maxHeight: '88vh',
          backgroundColor: '#121212',
        }}
      >
        {selectedJellyfinItem && (
          <div className="flex flex-col h-[75vh] text-white overflow-hidden relative">
            {/* Ambient Backdrop Blur Layer */}
            {selectedJellyfinItem.backdrop_url && (
              <div className="absolute inset-0 h-40 overflow-hidden pointer-events-none opacity-20 z-0">
                <img
                  src={selectedJellyfinItem.backdrop_url}
                  alt={selectedJellyfinItem.title}
                  className="w-full h-full object-cover blur-xl scale-125"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#121212]/80 to-[#121212]" />
              </div>
            )}

            {/* 顶栏 Header */}
            <div className="px-5 pt-4 pb-2 flex items-center justify-between z-20 shrink-0 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#1DB954]" />
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  本地已刮削影片详情
                </span>
              </div>
              <button
                onClick={closeJellyfinItemModal}
                className="text-xs text-[#B3B3B3] hover:text-white px-2.5 py-1 bg-[#282828] rounded-md transition-colors"
              >
                关闭
              </button>
            </div>

            {/* 海报与标题元数据 (靠顶紧凑呈现) */}
            <div className="px-5 pt-3.5 pb-2 relative z-10 flex gap-4 shrink-0">
              {/* 海报 */}
              <div className="w-24 h-34 rounded-lg overflow-hidden bg-[#282828] border border-white/10 shadow-xl shrink-0">
                <img
                  src={selectedJellyfinItem.cover || selectedJellyfinItem.poster_url || selectedJellyfinItem.raw_cover}
                  alt={selectedJellyfinItem.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* 标题、评分、年份 */}
              <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
                <h3 className="text-base font-extrabold text-white leading-snug break-words">
                  {selectedJellyfinItem.title}
                </h3>
                {selectedJellyfinItem.original_title && selectedJellyfinItem.original_title !== selectedJellyfinItem.title && (
                  <p className="text-xs text-[#B3B3B3] truncate">
                    {selectedJellyfinItem.original_title}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {selectedJellyfinItem.rating && (
                    <span className="px-2 py-0.5 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954] text-xs font-bold font-mono flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3 fill-[#1DB954]" />
                      {selectedJellyfinItem.rating} 分
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 底部检索更多网盘版本按钮 */}
            <div className="px-5 pb-5 pt-1 relative z-10 shrink-0">
              <button
                onClick={() => {
                  const title = selectedJellyfinItem.title
                  closeJellyfinItemModal()
                  setActiveKey('search')
                  setQuery(title)
                  search(title)
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#202020] hover:bg-[#282828] border border-white/10 text-[#1DB954] font-extrabold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Search className="w-4 h-4 stroke-[2.5]" />
                <span>检索全网更高清/更多网盘版本</span>
              </button>
            </div>
          </div>
        )}
      </Popup>

      {/* 🎬 影院级质感 豆瓣 / TMDB 热门影片详细信息表 Modal */}
      <Popup
        visible={publicMediaModalVisible}
        onMaskClick={closePublicMediaModal}
        bodyStyle={{
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          backgroundColor: '#0d0e14',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        {selectedPublicMedia && (
          <div className="flex flex-col h-full text-white overflow-y-auto no-scrollbar relative p-5 space-y-4">
            {/* 🌟 核心动态弥散环境光层 (Apple TV / Netflix Ambient Backdrop Lighting) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
              {selectedPublicMedia.backdrop || selectedPublicMedia.cover ? (
                <img
                  src={selectedPublicMedia.backdrop || selectedPublicMedia.cover}
                  alt={selectedPublicMedia.title}
                  className="w-full h-full object-cover blur-3xl scale-150 opacity-30 brightness-110"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-b from-[#0d0e14]/40 via-[#0d0e14]/85 to-[#0d0e14]" />
            </div>

            {/* 1. 顶部剧照融合层 (Hero Section Backdrop) */}
            <div className="absolute top-0 left-0 right-0 h-60 overflow-hidden pointer-events-none z-0">
              {selectedPublicMedia.backdrop || selectedPublicMedia.cover ? (
                <img
                  src={selectedPublicMedia.backdrop || selectedPublicMedia.cover}
                  alt={selectedPublicMedia.title}
                  className="w-full h-full object-cover opacity-40 filter brightness-95 scale-105"
                />
              ) : null}
              {/* 自上而下及底部平滑渐变遮罩 */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e14] via-[#0d0e14]/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
            </div>

            {/* 顶栏 Header 导航 */}
            <div className="flex items-center justify-between z-10 shrink-0 pb-1">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/[0.1] shadow-lg">
                {selectedPublicMedia.source === 'douban' ? (
                  <Flame className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                ) : (
                  <Film className="w-3.5 h-3.5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                )}
                <span className="text-[10px] font-black text-gray-200 uppercase tracking-widest">
                  {selectedPublicMedia.source === 'douban' ? '豆瓣每周口碑榜' : 'TMDB 院线热映'}
                </span>
              </div>
              <button
                onClick={closePublicMediaModal}
                className="p-1.5 rounded-full bg-black/50 backdrop-blur-xl text-gray-300 hover:text-white border border-white/[0.12] transition-all active:scale-95 cursor-pointer z-20 shadow-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2. 核心元数据层 (Meta Data 排版) */}
            <div className="flex gap-4 md:gap-6 relative z-10 shrink-0 pt-1">
              {/* 左侧竖版海报浮动 (立体景深投影与微光渐变边框) */}
              <div className="w-28 md:w-36 aspect-[2/3] rounded-2xl overflow-hidden bg-[#16171d] border border-white/[0.15] shadow-[0_12px_32px_rgba(0,0,0,0.8)] shrink-0 group transform hover:scale-[1.03] transition-transform duration-300">
                {selectedPublicMedia.cover ? (
                  <img
                    src={selectedPublicMedia.cover}
                    alt={selectedPublicMedia.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_POSTER_SVG
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#16171d] text-center p-2">
                    <Film className="w-8 h-8 text-gray-500 mb-1" />
                    <span className="text-xs font-bold text-gray-300 truncate w-full">{selectedPublicMedia.title}</span>
                  </div>
                )}
              </div>

              {/* 右侧标题、标签、金句、导演与主演信息 */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* 标题 & 药丸标签 */}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-lg font-black text-white leading-tight tracking-tight break-words">
                      {selectedPublicMedia.title}
                    </h3>
                    {selectedPublicMedia.certification && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/35 shadow-sm shrink-0">
                        {selectedPublicMedia.certification}
                      </span>
                    )}
                    {selectedPublicMedia.imdb_id && (
                      <a
                        href={`https://www.imdb.com/title/${selectedPublicMedia.imdb_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#f3ce13]/20 text-[#f3ce13] border border-[#f3ce13]/40 flex items-center gap-0.5 hover:bg-[#f3ce13]/30 transition-all cursor-pointer shrink-0 shadow-sm"
                      >
                        <span>IMDb</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  {/* 英文原名 */}
                  {selectedPublicMedia.original_title && (
                    <p className="text-[11px] text-gray-400 font-medium line-clamp-1">
                      {selectedPublicMedia.original_title}
                    </p>
                  )}

                  {/* 金句点缀 Tagline */}
                  {selectedPublicMedia.tagline && (
                    <p className="text-xs italic font-serif text-emerald-400 font-medium tracking-wide line-clamp-2 pt-0.5">
                      “{selectedPublicMedia.tagline}”
                    </p>
                  )}
                </div>

                {/* 电影金评分与评级微雕 */}
                <div className="flex items-center gap-2">
                  {selectedPublicMedia.score && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-400 text-xs font-black font-mono flex items-center gap-1 shadow-sm">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {selectedPublicMedia.score} 分
                    </span>
                  )}
                  {Boolean(selectedPublicMedia.ratings_count) && (
                    <span className="text-[10px] text-gray-400 font-mono">
                      ({Number(selectedPublicMedia.ratings_count).toLocaleString()} 人评价)
                    </span>
                  )}
                </div>

                {/* 👨‍🎨 导演 */}
                {loadingPublicMediaDetail && !selectedPublicMedia.director ? (
                  <div className="h-4 w-32 rounded bg-white/[0.08] animate-pulse my-0.5" />
                ) : selectedPublicMedia.director ? (
                  <div className="text-xs text-gray-300 font-medium flex items-center gap-1.5 transition-all duration-300 animate-in fade-in">
                    <span className="text-[11px] text-gray-400">👨‍🎨 导演：</span>
                    <span className="text-white font-semibold">{selectedPublicMedia.director}</span>
                  </div>
                ) : null}

                {/* 🏷️ 风格关键词 tag 组 */}
                {loadingPublicMediaDetail && (!selectedPublicMedia.keywords || selectedPublicMedia.keywords.length === 0) ? (
                  <div className="flex gap-1.5 pt-0.5">
                    <div className="h-5 w-12 rounded-md bg-white/[0.08] animate-pulse" />
                    <div className="h-5 w-16 rounded-md bg-white/[0.08] animate-pulse" />
                    <div className="h-5 w-14 rounded-md bg-white/[0.08] animate-pulse" />
                  </div>
                ) : selectedPublicMedia.keywords && selectedPublicMedia.keywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-0.5 transition-all duration-300 animate-in fade-in">
                    {selectedPublicMedia.keywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-white/[0.06] text-gray-300 text-[10px] px-2 py-0.5 border border-white/[0.08] backdrop-blur-sm shadow-sm"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* 🎭 主演及角色 (Cast & Roles) */}
            {loadingPublicMediaDetail && (!selectedPublicMedia.cast_with_roles || selectedPublicMedia.cast_with_roles.length === 0) && !selectedPublicMedia.actors ? (
              <div className="relative z-10 bg-[#161720]/80 p-3.5 rounded-2xl border border-white/[0.08] space-y-2 shrink-0 backdrop-blur-xl shadow-lg">
                <div className="h-3.5 w-20 rounded bg-white/[0.08] animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-4 w-28 rounded bg-white/[0.08] animate-pulse" />
                  <div className="h-4 w-32 rounded bg-white/[0.08] animate-pulse" />
                </div>
              </div>
            ) : selectedPublicMedia.cast_with_roles && selectedPublicMedia.cast_with_roles.length > 0 ? (
              <div className="relative z-10 bg-[#161720]/80 p-3.5 rounded-2xl border border-white/[0.08] space-y-1.5 shrink-0 backdrop-blur-xl shadow-lg transition-all duration-300 animate-in fade-in">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <span>🎭 主演及角色</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-200">
                  {selectedPublicMedia.cast_with_roles.map((actor, idx) => (
                    <span key={idx} className="font-medium">
                      <span className="text-white font-semibold">{actor.name}</span>
                      {actor.character && (
                        <span className="text-emerald-400/90 text-[11px] ml-1">
                          (饰 {actor.character})
                        </span>
                      )}
                      {idx < (selectedPublicMedia.cast_with_roles?.length || 0) - 1 && (
                        <span className="text-gray-600 ml-2">·</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ) : selectedPublicMedia.actors ? (
              <div className="relative z-10 bg-[#161720]/80 p-3.5 rounded-2xl border border-white/[0.08] space-y-1 shrink-0 backdrop-blur-xl shadow-lg transition-all duration-300 animate-in fade-in">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <span>🎭 主演阵容</span>
                </div>
                <p className="text-xs text-gray-200 font-medium truncate">
                  {selectedPublicMedia.actors}
                </p>
              </div>
            ) : null}

            {/* 📖 剧情简介 */}
            <div className="relative z-10 space-y-1.5 bg-[#161720]/75 p-3.5 rounded-2xl border border-white/[0.08] backdrop-blur-xl shadow-lg">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">📖 剧情简介</h4>
              <p className="text-xs text-gray-300 leading-relaxed font-normal whitespace-pre-wrap max-h-36 overflow-y-auto no-scrollbar">
                {selectedPublicMedia.overview}
              </p>
            </div>

            {/* 3. 底部信息拓展层 (商业资料预算与票房) */}
            <div className="relative z-10 pt-1 shrink-0 space-y-3">
              <div className="border-t border-white/[0.08]" />

              <div className="flex items-center justify-between bg-[#161720]/90 px-3.5 py-2.5 rounded-2xl border border-white/[0.08] text-[11px] font-mono text-gray-300 shadow-md">
                <span className="flex items-center gap-1 text-amber-300 font-bold">
                  💰 商业资料：
                </span>
                {loadingPublicMediaDetail && (!selectedPublicMedia.budget || selectedPublicMedia.budget === '暂无数据') ? (
                  <div className="h-3.5 w-36 rounded bg-white/[0.08] animate-pulse" />
                ) : (
                  <div className="flex items-center gap-3 transition-all duration-300 animate-in fade-in">
                    <span>预算: <strong className="text-white">{selectedPublicMedia.budget || '保密'}</strong></span>
                    <span className="text-gray-600">|</span>
                    <span>全球票房: <strong className="text-emerald-400">{selectedPublicMedia.revenue || '院线上映中'}</strong></span>
                  </div>
                )}
              </div>

              {/* 🟢 一键搜索离线资源按钮 */}
              <button
                onClick={() => {
                  const queryTitle = selectedPublicMedia.title
                  closePublicMediaModal()
                  setActiveKey('search')
                  setQuery(queryTitle)
                  search(queryTitle)
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#1DB954] via-[#10b981] to-[#1ed760] text-black font-black text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_6px_28px_rgba(29,185,84,0.45)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Search className="w-4 h-4 stroke-[2.5]" />
                <span>一键搜索网盘资源</span>
              </button>
            </div>
          </div>
        )}
      </Popup>

      {/* 🛡️ 终极误删防护盾：二次密码拦截模态窗 (DeleteConfirmModal) */}
      <Popup
        visible={Boolean(deleteTarget)}
        onMaskClick={() => setDeleteTarget(null)}
        bodyStyle={{
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          backgroundColor: '#121212',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {deleteTarget && (() => {
          const isPasswordValid = deletePassword.trim().toUpperCase() === 'DELETE'
          return (
            <div className="p-5 space-y-4 bg-[#121212] text-white">
              {/* 顶栏 */}
              <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/40">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-red-400">高危磁盘粉碎安全拦截</h3>
                    <p className="text-[10px] text-gray-400 font-mono">验证操作确认码方可物理销毁文件</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="p-1 rounded-full bg-[#242424] text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 物理路径与大小警示卡 */}
              <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">即将永久物理粉碎:</span>
                  <span className="font-mono font-bold text-red-400">{deleteTarget.size_str}</span>
                </div>
                <p className="text-xs font-mono font-bold text-white break-all bg-black/60 p-2 rounded border border-white/5">
                  {deleteTarget.path}
                </p>
                <p className="text-[11px] text-yellow-400/90 leading-tight">
                  ⚠️ 警告：物理抹除后不可恢复！请确认此磁盘空间释放操作。
                </p>
              </div>

              {/* 安全确认码输入区 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-200 block">
                  请输入确认口令以解锁磁盘粉碎：
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="输入 DELETE 确认销毁..."
                    className="w-full bg-[#1c1c1c] border border-white/15 focus:border-red-500 text-xs text-white px-3 py-2.5 rounded-xl outline-none transition-colors font-mono"
                    autoFocus
                  />
                </div>
                {!isPasswordValid ? (
                  <p className="text-[10px] text-gray-400 font-mono">
                    提示：输入大写口令 <span className="text-gray-300 font-bold">DELETE</span> 后解锁粉碎按钮。
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-400 font-bold font-mono">
                    ✓ 确认口令验证通过！粉碎按钮已强效解锁。
                  </p>
                )}
              </div>

              {/* 底部确认提交按钮 */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 bg-[#242424] hover:bg-[#303030] text-gray-300 font-bold text-xs rounded-xl"
                >
                  取消释放
                </button>
                <button
                  disabled={!isPasswordValid}
                  onClick={executeSecureDelete}
                  className={`flex-1 py-2.5 font-extrabold text-xs rounded-xl transition-all ${
                    isPasswordValid
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] cursor-pointer active:scale-95'
                      : 'bg-red-950/40 text-gray-500 border border-red-900/30 cursor-not-allowed opacity-50'
                  }`}
                >
                  [ 确认永远物理删除 ]
                </button>
              </div>
            </div>
          )
        })()}
      </Popup>



      {/* 展开的【全功能下载任务监控 Popup 弹窗】 */}
      <Popup
        visible={showDownloadMonitorPopup}
        onMaskClick={() => setShowDownloadMonitorPopup(false)}
        bodyStyle={{
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          backgroundColor: '#121212',
          height: '80vh',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="p-4 flex flex-col h-full max-h-full min-h-0 space-y-3.5 bg-[#121212] text-white">
          {/* 顶栏 */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#1DB954]" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">下载任务监控</h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-gray-300">
                    {downloadTasks.length} 个任务
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-mono">存储挂载路径: /data/movies</p>
              </div>
            </div>
            <button
              onClick={() => setShowDownloadMonitorPopup(false)}
              className="p-1.5 rounded-full bg-[#242424] text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 内容列表区 (支持流畅滚动) */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 overscroll-contain">
            {downloadTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 rounded-xl bg-[#181818]/60 border border-white/5 space-y-2">
                <div className="w-11 h-11 rounded-full bg-[#1DB954]/10 text-[#1DB954] flex items-center justify-center shadow-[0_0_15px_rgba(29,185,84,0.2)]">
                  <Sparkles className="w-5 h-5 stroke-[2] animate-pulse" />
                </div>
                <p className="text-xs font-medium text-[#B3B3B3] tracking-wide">
                  当前无进行中的下载任务
                </p>
                <p className="text-[11px] text-[#666666] font-mono">
                  存储挂载路径: /data/movies
                </p>
              </div>
            ) : (
              downloadTasks.map((task) => {
                const isCompleted = task.status === 'completed' || task.progress >= 100
                const isFailed = task.status === 'failed'
                return (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl bg-[#181818] border border-white/10 space-y-2.5 relative group overflow-hidden shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {isCompleted ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954]">
                              已完成
                            </span>
                          ) : isFailed ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-500/20 border border-red-500/40 text-red-400">
                              传输中断
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954] animate-pulse">
                              下载中
                            </span>
                          )}
                          <h4 className="text-xs font-bold text-white truncate flex-1">{task.title}</h4>
                        </div>

                        <div className="flex items-center flex-wrap gap-2 text-[11px] text-[#B3B3B3] font-mono">
                          <span>{task.filesCount || 1} 个文件</span>
                          <span>·</span>
                          <span>{task.size || '大小计算中'}</span>
                          {task.speed && !isCompleted && !isFailed && (
                            <>
                              <span>·</span>
                              <span className="text-[#1DB954] font-bold flex items-center gap-0.5">
                                <Zap className="w-3 h-3" />
                                {task.speed}
                              </span>
                            </>
                          )}
                          {task.eta && !isCompleted && !isFailed && (
                            <>
                              <span>·</span>
                              <span className="text-amber-400 flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                {task.eta}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-sm font-extrabold font-mono text-[#1DB954]">
                            {task.progress}%
                          </span>
                        </div>
                        <button
                          onClick={() => removeDownloadTask(task.id)}
                          className="p-1.5 rounded-lg bg-[#242424] hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                          title="删除任务记录"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-0.5">
                      <div className="w-full bg-[#242424] h-2 rounded-full overflow-hidden p-0.5 border border-white/5">
                        <div
                          className="bg-[#1DB954] h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(29,185,84,0.6)]"
                          style={{ width: `${Math.max(task.progress, 2)}%` }}
                        />
                      </div>
                      
                      {task.message && (
                        <p className="text-[11px] text-[#A0A0A0] font-mono truncate leading-tight">
                          {task.message}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-500 font-mono truncate">
                        保存目录: {task.targetPath}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Popup>

      {/* 常驻控制栏 TabBar + 灵动岛悬浮 Mini 传输胶囊 */}
      <div className="shrink-0 bg-[#0f1015]/90 backdrop-blur-2xl border-t border-white/[0.06] z-20 pb-8 shadow-[0_-12px_36px_rgba(0,0,0,0.6)] relative">
        {/* 🟢 灵动岛式悬浮 Mini 传输胶囊 (Floating Dynamic Capsule · 手机端居中 / PC 端右下角常驻悬浮浮岛) */}
        {downloadTasks.length > 0 && !showDownloadMonitorPopup && (() => {
          const topTask = downloadTasks[0]
          const isDone = topTask.progress >= 100 || topTask.status === 'completed'
          return (
            <div className="absolute -top-11 left-0 right-0 px-3 flex justify-center md:absolute md:top-auto md:-bottom-2 md:right-6 md:left-auto md:px-0 md:justify-end z-30 pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowDownloadMonitorPopup(true)}
                className="w-full max-w-[94%] md:w-96 md:max-w-none h-[38px] md:h-[42px] bg-[#14151e]/95 backdrop-blur-2xl border border-emerald-500/35 rounded-full px-3.5 md:px-4 flex items-center justify-between gap-2.5 cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(29,185,84,0.25)] hover:border-emerald-400/70 hover:shadow-[0_12px_36px_rgba(0,0,0,0.9),0_0_25px_rgba(29,185,84,0.35)] transition-all duration-300 overflow-hidden relative group select-none"
              >
                {/* 1. 左侧小图标 + 标题与速度 */}
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/30">
                    <Zap className="w-3 h-3 animate-pulse" />
                  </div>
                  <p className="text-[11px] font-bold text-gray-100 truncate leading-none">
                    {topTask.title} {topTask.filesCount > 1 ? `· 共${topTask.filesCount}项` : ''}
                  </p>
                  {topTask.speed && !isDone && (
                    <span className="text-[10px] text-emerald-400 font-mono font-bold shrink-0">
                      ⚡ {topTask.speed}
                    </span>
                  )}
                  {topTask.eta && !isDone && (
                    <span className="text-[10px] text-amber-400 font-mono shrink-0 hidden sm:inline">
                      ⏱️ {topTask.eta}
                    </span>
                  )}
                </div>

                {/* 2. 右侧百分比 + 展开箭号 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isDone ? (
                    <span className="text-[10px] font-black text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                      已完成
                    </span>
                  ) : (
                    <span className="text-[11px] font-black font-mono text-emerald-400">
                      {topTask.progress}%
                    </span>
                  )}
                  <ChevronUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors" />
                </div>

                {/* 3. 底部 2px 极细圆弧发光进度条 */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.08]">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-400 transition-all duration-300 shadow-[0_0_10px_#1DB954]"
                    style={{ width: `${Math.max(topTask.progress, 2)}%` }}
                  />
                </div>
              </motion.div>
            </div>
          )
        })()}

        <div className="pt-2 px-2 md:hidden">
          <TabBar
            activeKey={activeKey}
            onChange={setActiveKey}
            style={{
              '--font-size': '13px',
              '--icon-size': '24px',
            } as any}
          >
            <TabBar.Item
              key="search"
              icon={<Search className="w-6 h-6 transition-transform duration-200 active:scale-90" />}
              title={<span className="font-bold tracking-wide">搜索</span>}
            />
            <TabBar.Item
              key="download"
              icon={<Clapperboard className="w-6 h-6 transition-transform duration-200 active:scale-90" />}
              title={<span className="font-bold tracking-wide">片库</span>}
            />
            <TabBar.Item
              key="user"
              icon={<User className="w-6 h-6 transition-transform duration-200 active:scale-90" />}
              title={<span className="font-bold tracking-wide">我的</span>}
            />
          </TabBar>
        </div>
      </div>
      </div>
    </div>
  </div>
  )
}

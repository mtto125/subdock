'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Post, Profile } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

const CAT: Record<string, { label: string; cls: string }> = {
  genshin:     { label: '원신',             cls: 'bg-blue-100 text-blue-600' },
  starrail:    { label: '붕괴: 스타레일',    cls: 'bg-purple-100 text-purple-600' },
  zzz:         { label: '젠레스 존 제로',    cls: 'bg-orange-100 text-orange-600' },
  wuthering:   { label: '명조',             cls: 'bg-green-100 text-green-700' },
  bluearchive: { label: '블루 아카이브',     cls: 'bg-sky-100 text-sky-600' },
  endfield:    { label: '명일방주 엔드필드',  cls: 'bg-violet-100 text-violet-600' },
  nikke:       { label: '승리의 여신: 니케', cls: 'bg-pink-100 text-pink-600' },
  browndust:   { label: '브라운더스트 2',    cls: 'bg-amber-100 text-amber-700' },
  limbus:      { label: '림버스 컴퍼니',     cls: 'bg-gray-100 text-gray-600' },
  trickle:     { label: '트릭컬 리바이브',   cls: 'bg-emerald-100 text-emerald-700' },
  jpop:        { label: 'J-pop',            cls: 'bg-fuchsia-100 text-fuchsia-600' },
  vocaloid:    { label: '보컬로이드',        cls: 'bg-indigo-100 text-indigo-600' },
  game:        { label: '일반 게임',         cls: 'bg-gray-100 text-gray-500' },
  etc:         { label: '기타',             cls: 'bg-yellow-100 text-yellow-700' },
}
const TIER: Record<string, { label: string; cls: string; icon: string }> = {
  public: { label: '전체 공개',   cls: 'bg-gray-100 text-gray-500',   icon: '🌐' },
  member: { label: '회원 공개',   cls: 'bg-blue-100 text-blue-600',   icon: '👤' },
  paid:   { label: '구독자 전용', cls: 'bg-yellow-100 text-yellow-700', icon: '⭐' },
}
const GAMES = ['genshin','starrail','zzz','wuthering','bluearchive','endfield','nikke','browndust','limbus','trickle']

function Badge({ cat }: { cat: string }) {
  const m = CAT[cat] || { label: cat, cls: 'bg-gray-100 text-gray-500' }
  return <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${m.cls}`}>{m.label}</span>
}
function TierPill({ tier }: { tier: string }) {
  const t = TIER[tier] || TIER.public
  return <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${t.cls}`}>{t.icon} {t.label}</span>
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [view, setView] = useState<'feed' | 'write' | 'edit'>('feed')
  const [activeCat, setActiveCat] = useState('all')
  const [gameDropOpen, setGameDropOpen] = useState(false)
  const [subLabel, setSubLabel] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [betaOk, setBetaOk] = useState(false)
  const [betaPw, setBetaPw] = useState('')
  const [betaErr, setBetaErr] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [authErr, setAuthErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const editEditorRef = useRef<HTMLDivElement>(null)
  // 커서 위치 저장용 (글쓰기 / 수정 각각)
  const savedRangeRef_w = useRef<Range | null>(null)
  const savedRangeRef_e = useRef<Range | null>(null)
  const [wTitle, setWTitle] = useState('')
  const [wCat, setWCat] = useState('')
  const [wTier, setWTier] = useState('public')
  const [editPost, setEditPost] = useState<Post | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCat, setEditCat] = useState('')
  const [editTier, setEditTier] = useState('public')
  const gameDropRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [searching, setSearching] = useState(false)
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})

  // 구독
  const [subscribedUsers, setSubscribedUsers] = useState<Set<string>>(new Set())
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [subTargetId, setSubTargetId] = useState('')
  const [subTargetNick, setSubTargetNick] = useState('')
  const [subEmail, setSubEmail] = useState('')
  const [unsubModalOpen, setUnsubModalOpen] = useState(false)
  const [unsubTargetId, setUnsubTargetId] = useState('')
  const [unsubTargetNick, setUnsubTargetNick] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('sd_dark')
    if (saved === 'true') { setDarkMode(true); document.documentElement.classList.add('dark') }
  }, [])

  function toggleDark() {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('sd_dark', String(next))
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  useEffect(() => { if (sessionStorage.getItem('sd_beta') === 'ok') setBetaOk(true) }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else {
        setLoading(false)
        setLikedPosts(new Set())
        setBookmarkedPosts(new Set())
        setSubscribedUsers(new Set())
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (betaOk) loadPosts(activeCat) }, [betaOk, activeCat])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (gameDropRef.current && !gameDropRef.current.contains(e.target as Node)) setGameDropOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) {
      setProfile(data)
      if (!data.nickname_set) { router.replace('/profile'); return }
    } else {
      await supabase.from('profiles').insert({ id: uid })
      router.replace('/profile')
      return
    }
    await loadUserInteractions(uid)
    setLoading(false)
  }

  async function loadUserInteractions(uid: string) {
    const [likesRes, bookmarksRes, subsRes] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', uid),
      supabase.from('bookmarks').select('post_id').eq('user_id', uid),
      supabase.from('subscriptions').select('target_id').eq('subscriber_id', uid),
    ])
    if (likesRes.data) setLikedPosts(new Set(likesRes.data.map((l: any) => l.post_id)))
    if (bookmarksRes.data) setBookmarkedPosts(new Set(bookmarksRes.data.map((b: any) => b.post_id)))
    if (subsRes.data) setSubscribedUsers(new Set(subsRes.data.map((s: any) => s.target_id)))
  }

  async function loadPosts(cat: string) {
    setLoading(true)
    let q = supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (cat !== 'all') q = q.eq('category', cat)
    const { data, error } = await q
    if (!error && data) {
      setPosts(data)
      const counts: Record<string, number> = {}
      await Promise.all(data.map(async (p: Post) => {
        const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id)
        counts[p.id] = count || 0
      }))
      setLikeCounts(counts)
    }
    setLoading(false)
  }

  function canRead(tier: string) {
    if (!tier || tier === 'public') return true
    if (tier === 'member') return !!user
    if (tier === 'paid') return false
    return true
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  function checkBeta() {
    if (betaPw === 'docking!') { sessionStorage.setItem('sd_beta', 'ok'); setBetaOk(true) }
    else { setBetaErr(true); setBetaPw(''); setTimeout(() => setBetaErr(false), 2000) }
  }

  async function googleLogin() {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }

  async function emailLogin() {
    setAuthErr('')
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPass })
    if (!e1) { showToast('반갑습니다!'); setAuthOpen(false); return }
    const { error: e2 } = await supabase.auth.signUp({ email: authEmail, password: authPass })
    if (!e2) { showToast('가입 완료! 환영해요'); setAuthOpen(false) }
    else setAuthErr(e2.message)
  }

  async function doLogout() { await supabase.auth.signOut(); showToast('로그아웃됐어요') }

  // 커서 위치 저장
  function saveSelection(rangeRef: React.MutableRefObject<Range | null>) {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      rangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  // 공통 이미지 업로드 함수
  async function uploadImageFile(
    file: File,
    editorRef: React.RefObject<HTMLDivElement | null>,
    rangeRef: React.MutableRefObject<Range | null>,
    x?: number,
    y?: number
  ) {
    if (!user) return
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeName = `${Date.now()}.${ext}`
    const path = `${user.id}/${safeName}`
    showToast('이미지 업로드 중...')
    const { error } = await supabase.storage.from('post-images').upload(path, file)
    if (error) { showToast('업로드 실패: ' + error.message); return }
    const url = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
    const editor = editorRef.current
    if (editor) {
      editor.focus()
      const sel = window.getSelection()
      if (x !== undefined && y !== undefined) {
        const range = document.caretRangeFromPoint(x, y)
        if (range && editor.contains(range.startContainer)) {
          sel?.removeAllRanges(); sel?.addRange(range)
        }
      } else if (rangeRef.current && sel) {
        sel.removeAllRanges(); sel.addRange(rangeRef.current)
      }
      document.execCommand('insertHTML', false, `<img src="${url}" alt="이미지" style="max-width:100%;border-radius:12px;margin:8px 0;display:block;"><br>`)
    }
    showToast('이미지 삽입 완료')
  }

  // 파일 선택으로 업로드
  async function uploadImg(
    e: React.ChangeEvent<HTMLInputElement>,
    ref: React.RefObject<HTMLDivElement | null>,
    rangeRef: React.MutableRefObject<Range | null>
  ) {
    if (!e.target.files?.[0] || !user) return
    await uploadImageFile(e.target.files[0], ref, rangeRef)
    e.target.value = ''
  }

  // 드래그 앤 드롭으로 업로드
  async function handleDrop(
    e: React.DragEvent<HTMLDivElement>,
    ref: React.RefObject<HTMLDivElement | null>,
    rangeRef: React.MutableRefObject<Range | null>
  ) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/') || !user) return
    await uploadImageFile(file, ref, rangeRef, e.clientX, e.clientY)
  }

  async function savePost() {
    if (!user) return
    const content = editorRef.current?.innerHTML.trim() || ''
    if (!wTitle) { showToast('제목을 입력해주세요!'); return }
    if (!wCat) { showToast('카테고리를 선택해주세요!'); return }
    if (!content || content === '<br>') { showToast('본문을 작성해주세요!'); return }
    const nick = profile?.nickname || user.email?.split('@')[0] || '익명'
    const { error } = await supabase.from('posts').insert({
      title: wTitle, content, category: wCat, tier: wTier,
      author_email: user.email, author_id: user.id, author_nickname: nick,
    })
    if (error) { showToast('저장 실패: ' + error.message); return }
    showToast('도킹 완료!')
    setWTitle(''); setWCat(''); setWTier('public')
    if (editorRef.current) editorRef.current.innerHTML = ''
    setView('feed'); loadPosts(activeCat)
  }

  function openEdit(post: Post) {
    setEditPost(post); setEditTitle(post.title); setEditCat(post.category); setEditTier(post.tier)
    setView('edit')
    setTimeout(() => { if (editEditorRef.current) editEditorRef.current.innerHTML = post.content }, 100)
  }

  async function saveEdit() {
    if (!editPost || !user) return
    const content = editEditorRef.current?.innerHTML.trim() || ''
    if (!editTitle) { showToast('제목을 입력해주세요!'); return }
    if (!content || content === '<br>') { showToast('본문을 작성해주세요!'); return }
    const { error } = await supabase.from('posts').update({
      title: editTitle, content, category: editCat, tier: editTier,
    }).eq('id', editPost.id).eq('author_id', user.id)
    if (error) { showToast('수정 실패: ' + error.message); return }
    showToast('수정 완료!')
    setView('feed'); setEditPost(null); loadPosts(activeCat)
  }

  async function toggleLike(postId: string) {
    if (!user) { showToast('로그인이 필요해요!'); return }
    const isLiked = likedPosts.has(postId)
    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
      setLikedPosts(prev => { const s = new Set(prev); s.delete(postId); return s })
      setLikeCounts(prev => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 1) - 1) }))
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
      setLikedPosts(prev => new Set([...prev, postId]))
      setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }))
    }
  }

  async function toggleBookmark(postId: string) {
    if (!user) { showToast('로그인이 필요해요!'); return }
    const isBookmarked = bookmarkedPosts.has(postId)
    if (isBookmarked) {
      await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id)
      setBookmarkedPosts(prev => { const s = new Set(prev); s.delete(postId); return s })
      showToast('북마크 해제됐어요')
    } else {
      await supabase.from('bookmarks').insert({ post_id: postId, user_id: user.id })
      setBookmarkedPosts(prev => new Set([...prev, postId]))
      showToast('북마크했어요')
    }
  }

  function openSubModal(targetId: string, targetNick: string) {
    if (!user) { showToast('로그인이 필요해요!'); setAuthOpen(true); return }
    if (targetId === user.id) { showToast('본인은 구독할 수 없어요'); return }
    if (subscribedUsers.has(targetId)) {
      setUnsubTargetId(targetId); setUnsubTargetNick(targetNick); setUnsubModalOpen(true); return
    }
    setSubTargetId(targetId); setSubTargetNick(targetNick); setSubEmail(user.email || ''); setSubModalOpen(true)
  }

  async function subscribe() {
    if (!user || !subTargetId) return
    if (!subEmail.trim()) { showToast('이메일을 입력해주세요!'); return }
    const { error } = await supabase.from('subscriptions').insert({
      subscriber_id: user.id, target_id: subTargetId, tier: 'free', email: subEmail
    })
    if (error) { showToast('구독 실패: ' + error.message); return }
    setSubscribedUsers(prev => new Set([...prev, subTargetId]))
    setSubModalOpen(false)
    showToast(`${subTargetNick}님을 구독했어요!`)
  }

  async function unsubscribe(targetId: string) {
    if (!user) return
    await supabase.from('subscriptions').delete().eq('subscriber_id', user.id).eq('target_id', targetId)
    setSubscribedUsers(prev => { const s = new Set(prev); s.delete(targetId); return s })
    setUnsubModalOpen(false)
    showToast('구독을 해지했어요')
  }

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase.from('posts').select('*')
        .or(`title.ilike.%${q}%,content.ilike.%${q}%,author_nickname.ilike.%${q}%`)
        .order('created_at', { ascending: false })
      setSearchResults(data || [])
      setSearching(false)
    }, 400)
  }

  function filterCat(cat: string, label?: string) {
    setActiveCat(cat); setSubLabel(label || ''); setGameDropOpen(false)
  }

  function SubBtn({ targetId, targetNick }: { targetId: string; targetNick: string }) {
    if (!user || targetId === user.id) return null
    const isSubbed = subscribedUsers.has(targetId)
    return (
      <button
        onClick={e => { e.stopPropagation(); e.preventDefault(); openSubModal(targetId, targetNick) }}
        className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-all ${isSubbed ? 'bg-blue-100 text-blue-500 hover:bg-red-50 hover:text-red-400' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
        {isSubbed ? '구독 중' : '+ 구독'}
      </button>
    )
  }

  if (!betaOk) return (
    <div className="fixed inset-0 bg-white flex items-center justify-center p-5">
      <div className="text-center w-full max-w-sm slide-up">
        <div className="text-5xl mb-5">🔒</div>
        <h1 className="text-3xl font-black text-blue-500 mb-1">SUBDOCK</h1>
        <p className="text-gray-400 text-sm mb-8">현재 베타 테스트 중인 서비스예요.<br />초대받은 분만 입장할 수 있어요.</p>
        <div className="space-y-3">
          <input type="password" value={betaPw} onChange={e => setBetaPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && checkBeta()} placeholder="비밀번호를 입력하세요"
            className={`w-full p-4 bg-gray-100 rounded-2xl text-center font-bold text-lg outline-none focus:ring-2 focus:ring-blue-400 ${betaErr ? 'ring-2 ring-red-400' : ''}`} />
          {betaErr && <p className="text-red-400 text-xs font-semibold">비밀번호가 틀렸어요</p>}
          <button onClick={checkBeta} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-full font-bold transition-all">입장하기</button>
        </div>
        <p className="text-xs text-gray-300 mt-8">© 2025 Subdock</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-200 px-5 py-3">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-blue-500 cursor-pointer"
              onClick={() => { setView('feed'); loadPosts('all'); setActiveCat('all') }}>
              SUBDOCK
            </h1>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${!darkMode ? 'text-blue-500' : 'text-gray-400'}`}>라이트</span>
              <button onClick={toggleDark} className={`relative w-11 h-6 rounded-full transition-all duration-300 ${darkMode ? 'bg-blue-500' : 'bg-gray-200'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${darkMode ? 'left-6' : 'left-1'}`} />
              </button>
              <span className={`text-xs font-bold ${darkMode ? 'text-blue-500' : 'text-gray-400'}`}>다크</span>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => setSearchOpen(true)} className="p-2 rounded-full hover:bg-gray-100 transition-all text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            {loading ? (
  <div className="w-7 h-7 rounded-full bg-gray-200 animate-pulse" />
) : user ? (
  <>
    <a href="/profile" className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 transition-all no-underline">
      <img src={profile?.avatar_url || `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.id}`} className="w-7 h-7 rounded-full object-cover bg-gray-100" alt="" />
      <span className="text-sm font-bold text-gray-800 max-w-[80px] truncate">{profile?.nickname || user.email?.split('@')[0]}</span>
    </a>
    <button onClick={doLogout} className="text-sm font-semibold text-gray-500 px-4 py-2 rounded-full hover:bg-gray-100 transition-all">로그아웃</button>
    <button onClick={() => setView('write')} className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold shadow transition-all">글쓰기</button>
  </>
) : (
  <button onClick={() => setAuthOpen(true)} className="text-sm font-semibold text-gray-500 px-4 py-2 rounded-full hover:bg-gray-100 transition-all">로그인</button>
)}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-5 py-10">

        {/* ── 피드 ── */}
        {view === 'feed' && (
          <div className="fade-in">
            <div className="mb-8">
              <h2 className="text-4xl font-black mb-2 tracking-tight">최신 도킹 소식</h2>
              <p className="text-gray-400 text-sm">서브컬처 덕후들이 직접 정리한 정보들</p>
            </div>
            <div className="mb-6">
              <div className="flex gap-2 flex-wrap">
                {['all','jpop','vocaloid','game','etc'].map(cat => (
                  <button key={cat} onClick={() => filterCat(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${activeCat === cat && !GAMES.includes(activeCat) ? 'bg-blue-500 text-white border-blue-500 shadow' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50'}`}>
                    {cat === 'all' ? '전체' : cat === 'jpop' ? 'J-pop' : cat === 'vocaloid' ? '보컬로이드' : cat === 'game' ? '일반 게임' : '기타'}
                  </button>
                ))}
                <div className="relative" ref={gameDropRef}>
                  <button onClick={() => setGameDropOpen(!gameDropOpen)}
                    className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${GAMES.includes(activeCat) ? 'bg-blue-500 text-white border-blue-500 shadow' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50'}`}>
                    서브컬처 게임
                    <svg className={`w-3.5 h-3.5 transition-transform ${gameDropOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {gameDropOpen && (
                    <div className="absolute left-0 top-[calc(100%+8px)] z-30 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 min-w-[210px]">
                      {GAMES.map(g => (
                        <button key={g} onClick={() => filterCat(g, CAT[g].label)}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-gray-100 hover:text-blue-500 ${activeCat === g ? 'bg-blue-50 text-blue-500' : 'text-gray-700'}`}>
                          {CAT[g].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {GAMES.includes(activeCat) && subLabel && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-semibold">세부 필터:</span>
                  <span className="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full">{subLabel}</span>
                  <button onClick={() => filterCat('all')} className="text-xs text-gray-400 hover:text-red-400 transition-colors">✕ 해제</button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center py-20 text-gray-300 gap-3">
                <svg className="w-8 h-8 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8H4z" /></svg>
                <span className="text-sm">불러오는 중...</span>
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-300 gap-2">
                <span className="text-3xl">🔭</span>
                <span className="text-sm font-semibold">아직 도킹된 소식이 없어요!</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map(post => {
                  const ok = canRead(post.tier)
                  const plain = post.content.replace(/<[^>]*>/gm, '')
                  const preview = ok ? plain : plain.slice(0, 80) + '...'
                  const date = new Date(post.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  const author = post.author_nickname || post.author_email?.split('@')[0] || '익명'
                  const isLiked = likedPosts.has(post.id)
                  const isBookmarked = bookmarkedPosts.has(post.id)
                  return (
                    <div key={post.id} className="bg-white rounded-[24px] border border-gray-200 overflow-hidden transition-all hover:-translate-y-1 hover:scale-[1.01] hover:shadow-lg hover:border-blue-200">
                      <div className="p-7 cursor-pointer" onClick={() => router.push(`/posts/${post.id}`)}>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <Badge cat={post.category} />
                          {post.tier && post.tier !== 'public' && <TierPill tier={post.tier} />}
                        </div>
                        <h3 className="text-lg font-black mb-2 leading-snug line-clamp-2">{post.title}</h3>
                        <div className="relative mb-4">
                          <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">{preview}</p>
                          {!ok && <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />}
                        </div>
                        {!ok && (
                          <div className="text-center py-3 bg-gray-50 rounded-xl mb-4">
                            <p className="text-xs text-gray-400 font-semibold">{post.tier === 'member' ? '로그인하면 볼 수 있어요' : '구독자 전용 콘텐츠예요'}</p>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-xs text-gray-300 border-t border-gray-100 pt-4">
                          <span>{date}</span>
                          <div className="flex items-center gap-2">
                            <a href={`/profile/${post.author_id}`} onClick={e => e.stopPropagation()} className="font-semibold hover:text-blue-500 transition-colors no-underline">@{author}</a>
                            <SubBtn targetId={post.author_id} targetNick={author} />
                          </div>
                        </div>
                      </div>
                      <div className="px-7 pb-5 flex items-center gap-3">
                        <button onClick={() => toggleLike(post.id)}
                          className={`flex items-center gap-1.5 text-xs font-bold transition-all ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
                          <svg className="w-4 h-4" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                          {likeCounts[post.id] || 0}
                        </button>
                        <button onClick={() => toggleBookmark(post.id)}
                          className={`flex items-center gap-1.5 text-xs font-bold transition-all ${isBookmarked ? 'text-blue-500' : 'text-gray-400 hover:text-blue-400'}`}>
                          <svg className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                          {isBookmarked ? '저장됨' : '저장'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 글쓰기 ── */}
        {view === 'write' && (
          <div className="fade-in max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <button onClick={() => setView('feed')} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 className="text-3xl font-black">새 뉴스레터 도킹</h2>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">카테고리</label>
                <select value={wCat} onChange={e => setWCat(e.target.value)} className="w-full p-4 bg-gray-100 rounded-2xl font-semibold outline-none focus:bg-blue-50 cursor-pointer">
                  <option value="">카테고리를 선택하세요</option>
                  <optgroup label="── 서브컬처 게임">{GAMES.map(g => <option key={g} value={g}>{CAT[g].label}</option>)}</optgroup>
                  <optgroup label="── 음악"><option value="jpop">J-pop</option><option value="vocaloid">보컬로이드</option></optgroup>
                  <optgroup label="── 기타"><option value="game">일반 게임</option><option value="etc">기타</option></optgroup>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">제목</label>
                <input value={wTitle} onChange={e => setWTitle(e.target.value)} placeholder="제목을 입력하세요" className="w-full text-xl font-bold bg-gray-100 rounded-2xl px-5 py-4 outline-none focus:bg-blue-50 transition-all placeholder:text-gray-300" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-3 block">열람 등급</label>
                <div className="flex gap-3">
                  {(['public','member','paid'] as const).map(t => (
                    <label key={t} className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 cursor-pointer flex-1 text-center transition-all ${wTier === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                      <input type="radio" name="tier" value={t} checked={wTier === t} onChange={() => setWTier(t)} className="hidden" />
                      <span className="text-xl">{TIER[t].icon}</span>
                      <span className="text-xs font-black text-gray-700">{t === 'public' ? '전체 공개' : t === 'member' ? '회원 공개' : '구독자 전용'}</span>
                      <span className="text-xs text-gray-400">{t === 'public' ? '비회원도 열람' : t === 'member' ? '로그인 필요' : '유료 구독 필요'}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">본문</label>
                <div className="flex gap-2 bg-white border border-gray-200 p-2 rounded-t-2xl flex-wrap">
                  {[['bold','B','font-black'],['italic','I','italic'],['underline','U','underline']].map(([cmd,label,cls]) => (
                    <button key={cmd} onClick={() => document.execCommand(cmd)} className={`px-3 py-1.5 rounded-lg text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-blue-500 transition-all ${cls}`}>{label}</button>
                  ))}
                  <div className="w-px bg-gray-200 mx-1" />
                  <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-blue-500 transition-all cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    이미지 삽입
                    <input type="file" className="hidden" accept="image/*" onChange={e => uploadImg(e, editorRef, savedRangeRef_w)} />
                  </label>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  data-placeholder="덕후들을 위한 소식을 작성하세요..."
                  className="editor-area border border-gray-200 border-t-0 text-base leading-relaxed"
                  onMouseUp={() => saveSelection(savedRangeRef_w)}
                  onKeyUp={() => saveSelection(savedRangeRef_w)}
                  onDrop={e => handleDrop(e, editorRef, savedRangeRef_w)}
                  onDragOver={e => e.preventDefault()}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={savePost} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-full font-bold shadow-lg transition-all">발행하기</button>
                <button onClick={() => setView('feed')} className="px-8 bg-gray-100 hover:bg-gray-200 text-gray-500 py-4 rounded-full font-bold transition-all">취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 게시물 수정 ── */}
        {view === 'edit' && editPost && (
          <div className="fade-in max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <button onClick={() => setView('feed')} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 className="text-3xl font-black">게시물 수정</h2>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">카테고리</label>
                <select value={editCat} onChange={e => setEditCat(e.target.value)} className="w-full p-4 bg-gray-100 rounded-2xl font-semibold outline-none focus:bg-blue-50 cursor-pointer">
                  <optgroup label="── 서브컬처 게임">{GAMES.map(g => <option key={g} value={g}>{CAT[g].label}</option>)}</optgroup>
                  <optgroup label="── 음악"><option value="jpop">J-pop</option><option value="vocaloid">보컬로이드</option></optgroup>
                  <optgroup label="── 기타"><option value="game">일반 게임</option><option value="etc">기타</option></optgroup>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">제목</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full text-xl font-bold bg-gray-100 rounded-2xl px-5 py-4 outline-none focus:bg-blue-50 transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-3 block">열람 등급</label>
                <div className="flex gap-3">
                  {(['public','member','paid'] as const).map(t => (
                    <label key={t} className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 cursor-pointer flex-1 text-center transition-all ${editTier === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                      <input type="radio" name="editTier" value={t} checked={editTier === t} onChange={() => setEditTier(t)} className="hidden" />
                      <span className="text-xl">{TIER[t].icon}</span>
                      <span className="text-xs font-black text-gray-700">{t === 'public' ? '전체 공개' : t === 'member' ? '회원 공개' : '구독자 전용'}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">본문</label>
                <div className="flex gap-2 bg-white border border-gray-200 p-2 rounded-t-2xl flex-wrap">
                  {[['bold','B','font-black'],['italic','I','italic'],['underline','U','underline']].map(([cmd,label,cls]) => (
                    <button key={cmd} onClick={() => document.execCommand(cmd)} className={`px-3 py-1.5 rounded-lg text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-blue-500 transition-all ${cls}`}>{label}</button>
                  ))}
                  <div className="w-px bg-gray-200 mx-1" />
                  <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-blue-500 transition-all cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    이미지 삽입
                    <input type="file" className="hidden" accept="image/*" onChange={e => uploadImg(e, editEditorRef, savedRangeRef_e)} />
                  </label>
                </div>
                <div
                  ref={editEditorRef}
                  contentEditable
                  className="editor-area border border-gray-200 border-t-0 text-base leading-relaxed"
                  onMouseUp={() => saveSelection(savedRangeRef_e)}
                  onKeyUp={() => saveSelection(savedRangeRef_e)}
                  onDrop={e => handleDrop(e, editEditorRef, savedRangeRef_e)}
                  onDragOver={e => e.preventDefault()}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveEdit} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-full font-bold shadow-lg transition-all">수정 완료</button>
                <button onClick={() => setView('feed')} className="px-8 bg-gray-100 hover:bg-gray-200 text-gray-500 py-4 rounded-full font-bold transition-all">취소</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 검색 모달 */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-5 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setSearchOpen(false)}>
          <div className="bg-white w-full max-w-2xl rounded-[28px] shadow-2xl slide-up overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input autoFocus value={searchQuery} onChange={e => handleSearch(e.target.value)}
                  placeholder="제목, 내용, 닉네임으로 검색..."
                  className="flex-1 text-base outline-none bg-transparent font-semibold placeholder:text-gray-300" />
                <button onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]) }} className="text-gray-400 hover:text-gray-600 transition-all">✕</button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {searching ? (
                <div className="flex items-center justify-center py-10 text-gray-300">
                  <svg className="w-6 h-6 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8H4z" /></svg>
                  <span className="text-sm">검색 중...</span>
                </div>
              ) : searchQuery && searchResults.length === 0 ? (
                <div className="text-center py-10 text-gray-300"><p className="text-sm font-semibold">검색 결과가 없어요</p></div>
              ) : (
                <div className="p-3">
                  {searchResults.map(post => (
                    <div key={post.id} onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); router.push(`/posts/${post.id}`) }}
                      className="flex items-start gap-3 p-4 rounded-2xl hover:bg-gray-50 cursor-pointer transition-all">
                      <Badge cat={post.category} />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm line-clamp-1">{post.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">@{post.author_nickname || post.author_email?.split('@')[0]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 로그인 모달 */}
      {authOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setAuthOpen(false)}>
          <div className="bg-white p-8 rounded-[32px] w-full max-w-sm shadow-2xl slide-up">
            <h3 className="text-2xl font-black mb-1">Subdock 시작하기</h3>
            <p className="text-gray-400 text-sm mb-6">로그인하거나 새 계정을 만드세요</p>
            <button onClick={googleLogin} className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-full py-3.5 text-sm font-bold hover:bg-gray-50 transition-all mb-4">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google로 계속하기
            </button>
            <div className="flex items-center gap-3 mb-4 text-gray-300 text-xs font-semibold">
              <div className="flex-1 h-px bg-gray-200" /><span>또는 이메일로</span><div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-3">
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="이메일" className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-300" />
              <input type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} placeholder="비밀번호 (6자 이상)" className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-300" onKeyDown={e => e.key === 'Enter' && emailLogin()} />
              {authErr && <p className="text-red-400 text-xs px-1">{authErr}</p>}
              <button onClick={emailLogin} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-full font-bold transition-all">로그인 / 회원가입</button>
              <button onClick={() => setAuthOpen(false)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 py-3 rounded-full font-bold text-sm transition-all">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 구독 모달 */}
      {subModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setSubModalOpen(false)}>
          <div className="bg-white p-8 rounded-[32px] w-full max-w-sm shadow-2xl slide-up">
            <h3 className="text-2xl font-black mb-1">{subTargetNick}님 구독하기</h3>
            <p className="text-gray-400 text-sm mb-6">새 뉴스레터를 받을 이메일을 입력해주세요</p>
            <div className="space-y-3">
              <input type="email" value={subEmail} onChange={e => setSubEmail(e.target.value)}
                placeholder="이메일 주소" onKeyDown={e => e.key === 'Enter' && subscribe()}
                className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-300" />
              <div className="p-4 bg-blue-50 rounded-2xl">
                <p className="text-xs font-bold text-blue-500 mb-1">무료 구독</p>
                <p className="text-xs text-gray-500">전체 공개 및 회원 공개 글을 이메일로 받아볼 수 있어요</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl opacity-60">
                <p className="text-xs font-bold text-gray-500 mb-1">유료 구독 (준비 중)</p>
                <p className="text-xs text-gray-400">구독자 전용 프리미엄 글까지 받아볼 수 있어요</p>
              </div>
              <button onClick={subscribe} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-full font-bold transition-all">구독하기</button>
              <button onClick={() => setSubModalOpen(false)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 py-3 rounded-full font-bold text-sm transition-all">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 구독 해지 확인 모달 */}
      {unsubModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setUnsubModalOpen(false)}>
          <div className="bg-white p-8 rounded-[32px] w-full max-w-sm shadow-2xl slide-up">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-xl font-black mb-2 text-center">구독을 해지하시겠어요?</h3>
            <p className="text-gray-400 text-sm text-center mb-4">{unsubTargetNick}님의 뉴스레터를 더 이상 받아볼 수 없게 돼요.</p>
            <div className="bg-yellow-50 rounded-2xl p-4 mb-6">
              <p className="text-xs text-yellow-700 font-semibold leading-relaxed">
                · 무료 구독은 즉시 해지되며 이후 뉴스레터를 받아볼 수 없어요.<br />
                · 유료 구독 중이라면 현재 결제 기간이 끝날 때까지는 프리미엄 콘텐츠를 계속 이용할 수 있어요.<br />
                · 해지 후 재구독은 언제든지 가능해요.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setUnsubModalOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3.5 rounded-full font-bold text-sm transition-all">취소</button>
              <button onClick={() => unsubscribe(unsubTargetId)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-full font-bold text-sm transition-all">해지하기</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-xl z-[9999] whitespace-nowrap fade-in">{toast}</div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Post, Profile, Comment } from '@/lib/types'
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

function Badge({ cat }: { cat: string }) {
  const m = CAT[cat] || { label: cat, cls: 'bg-gray-100 text-gray-500' }
  return <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${m.cls}`}>{m.label}</span>
}
function TierPill({ tier }: { tier: string }) {
  const t = TIER[tier] || TIER.public
  return <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${t.cls}`}>{t.icon} {t.label}</span>
}

type CommentWithLikes = Comment & { likeCount: number; isLiked: boolean; avatar_url?: string }

export default function PostPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.postId as string

  const [post, setPost] = useState<Post | null>(null)
  const [authorProfile, setAuthorProfile] = useState<Profile | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [toast, setToast] = useState('')

  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscriberCount, setSubscriberCount] = useState(0)

  const [comments, setComments] = useState<CommentWithLikes[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentSort, setCommentSort] = useState<'latest' | 'oldest' | 'likes'>('latest')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')

  const [subModalOpen, setSubModalOpen] = useState(false)
  const [subEmail, setSubEmail] = useState('')
  const [unsubModalOpen, setUnsubModalOpen] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editCat, setEditCat] = useState('')
  const [editTier, setEditTier] = useState('public')
  const editEditorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const [authOpen, setAuthOpen] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [authErr, setAuthErr] = useState('')

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user || null
      setUser(u)
      if (u) { setSubEmail(u.email || ''); loadMyProfile(u.id) }
    })
    loadPost()
  }, [postId])

  async function loadMyProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) setMyProfile(data)
  }

  async function loadPost() {
    const { data: postData } = await supabase.from('posts').select('*').eq('id', postId).single()
    if (!postData) { setNotFound(true); setLoading(false); return }
    setPost(postData)
    const { data: authorData } = await supabase.from('profiles').select('*').eq('id', postData.author_id).single()
    if (authorData) setAuthorProfile(authorData)
    const { count: lc } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId)
    setLikeCount(lc || 0)
    const { count: sc } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('target_id', postData.author_id)
    setSubscriberCount(sc || 0)
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (uid) {
      const [likeRes, bookmarkRes, subRes] = await Promise.all([
        supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', uid).maybeSingle(),
        supabase.from('bookmarks').select('id').eq('post_id', postId).eq('user_id', uid).maybeSingle(),
        supabase.from('subscriptions').select('id').eq('subscriber_id', uid).eq('target_id', postData.author_id).maybeSingle(),
      ])
      setIsLiked(!!likeRes.data)
      setIsBookmarked(!!bookmarkRes.data)
      setIsSubscribed(!!subRes.data)
      await supabase.from('read_history').upsert(
        { post_id: postId, user_id: uid, read_at: new Date().toISOString() },
        { onConflict: 'post_id,user_id' }
      )
    }
    await loadComments(postId, uid)
    setLoading(false)
  }

  async function loadComments(pid: string, uid?: string) {
  setCommentsLoading(true)

  // 1번 요청: 댓글 전체 조회
  const { data: commentsData } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', pid)

  if (!commentsData || commentsData.length === 0) {
    setComments([])
    setCommentsLoading(false)
    return
  }

  const commentIds = commentsData.map((c: any) => c.id)
  const authorIds = [...new Set(commentsData.map((c: any) => c.user_id))]

  // 2번 요청: 댓글 좋아요 전체 + 내 좋아요 + 프로필 동시 조회
  const [likesRes, myLikesRes, profilesRes] = await Promise.all([
    supabase.from('comment_likes').select('comment_id').in('comment_id', commentIds),
    uid ? supabase.from('comment_likes').select('comment_id').eq('user_id', uid).in('comment_id', commentIds) : Promise.resolve({ data: [] }),
    supabase.from('profiles').select('id, avatar_url').in('id', authorIds),
  ])

  const likeCountMap: Record<string, number> = {}
  const myLikeSet = new Set((myLikesRes.data || []).map((l: any) => l.comment_id))
  const profileMap: Record<string, string> = {}

  ;(likesRes.data || []).forEach((l: any) => {
    likeCountMap[l.comment_id] = (likeCountMap[l.comment_id] || 0) + 1
  })
  ;(profilesRes.data || []).forEach((p: any) => {
    profileMap[p.id] = p.avatar_url || ''
  })

  const withLikes: CommentWithLikes[] = commentsData.map((c: any) => ({
    ...c,
    likeCount: likeCountMap[c.id] || 0,
    isLiked: myLikeSet.has(c.id),
    avatar_url: profileMap[c.user_id] || '',
  }))

  setComments(withLikes)
  setCommentsLoading(false)
}

  function getSortedComments() {
    const pinned = comments.filter(c => c.is_pinned)
    const rest = comments.filter(c => !c.is_pinned)
    const sorted = [...rest].sort((a, b) => {
      if (commentSort === 'likes') return b.likeCount - a.likeCount
      if (commentSort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return [...pinned, ...sorted]
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function toggleLike() {
    if (!user || !post) { showToast('로그인이 필요해요!'); return }
    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
      setIsLiked(false); setLikeCount(prev => Math.max(0, prev - 1))
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
      setIsLiked(true); setLikeCount(prev => prev + 1)
    }
  }

  async function toggleBookmark() {
    if (!user) { showToast('로그인이 필요해요!'); return }
    if (isBookmarked) {
      await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id)
      setIsBookmarked(false); showToast('북마크 해제됐어요')
    } else {
      await supabase.from('bookmarks').insert({ post_id: postId, user_id: user.id })
      setIsBookmarked(true); showToast('북마크했어요')
    }
  }

  async function subscribe() {
    if (!user || !post) return
    if (!subEmail.trim()) { showToast('이메일을 입력해주세요!'); return }
    const { error } = await supabase.from('subscriptions').insert({
      subscriber_id: user.id, target_id: post.author_id, tier: 'free', email: subEmail
    })
    if (error) { showToast('구독 실패'); return }
    setIsSubscribed(true); setSubscriberCount(prev => prev + 1)
    setSubModalOpen(false)
    showToast(`${authorProfile?.nickname || ''}님을 구독했어요!`)
  }

  async function unsubscribe() {
    if (!user || !post) return
    await supabase.from('subscriptions').delete().eq('subscriber_id', user.id).eq('target_id', post.author_id)
    setIsSubscribed(false); setSubscriberCount(prev => Math.max(0, prev - 1))
    setUnsubModalOpen(false); showToast('구독을 해지했어요')
  }

  async function addComment() {
    if (!user || !post || !commentText.trim()) return
    const nick = myProfile?.nickname || user.email?.split('@')[0] || '익명'
    const { error } = await supabase.from('comments').insert({
      post_id: postId, user_id: user.id, author_nickname: nick, content: commentText.trim()
    })
    if (error) { showToast('댓글 작성 실패'); return }
    setCommentText(''); loadComments(postId, user.id); showToast('댓글을 남겼어요')
  }

  async function deleteComment(commentId: string) {
    if (!user || !confirm('댓글을 삭제할까요?')) return
    await supabase.from('comments').delete().eq('id', commentId).eq('user_id', user.id)
    loadComments(postId, user.id); showToast('댓글이 삭제됐어요')
  }

  async function saveEditComment(commentId: string) {
    if (!user || !editingCommentText.trim()) return
    await supabase.from('comments').update({ content: editingCommentText, updated_at: new Date().toISOString() }).eq('id', commentId).eq('user_id', user.id)
    setEditingCommentId(null); setEditingCommentText('')
    loadComments(postId, user.id); showToast('댓글이 수정됐어요')
  }

  async function toggleCommentLike(commentId: string) {
    if (!user) { showToast('로그인이 필요해요!'); return }
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    if (comment.isLiked) {
      await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id)
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
    }
    loadComments(postId, user.id)
  }

  async function togglePinComment(commentId: string, currentPinned: boolean) {
    if (!user || !post || post.author_id !== user.id) return
    const { error } = await supabase.from('comments').update({ is_pinned: !currentPinned }).eq('id', commentId)
    if (error) { showToast('오류가 발생했어요'); return }
    await loadComments(postId, user.id)
    showToast(currentPinned ? '고정 해제됐어요' : '댓글이 고정됐어요')
  }

async function googleLogin() {
  await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })
}

  async function emailLogin() {
  setAuthErr('')
  // 먼저 로그인 시도
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPass })
  if (!e1) { showToast('반갑습니다!'); setAuthOpen(false); return }

  // 로그인 실패 시 회원가입 (인증 메일 발송)
  const { error: e2 } = await supabase.auth.signUp({ email: authEmail, password: authPass })
  if (!e2) { showToast('인증 메일을 보냈어요! 메일함을 확인해주세요 📬') }
  else setAuthErr(e2.message)
}

  function openEditMode() {
    if (!post) return
    setEditTitle(post.title); setEditCat(post.category); setEditTier(post.tier)
    setEditMode(true)
    setTimeout(() => { if (editEditorRef.current) editEditorRef.current.innerHTML = post.content }, 100)
  }

  async function saveEdit() {
    if (!post || !user) return
    const content = editEditorRef.current?.innerHTML.trim() || ''
    if (!editTitle) { showToast('제목을 입력해주세요!'); return }
    if (!content || content === '<br>') { showToast('본문을 작성해주세요!'); return }
    const { error } = await supabase.from('posts').update({
      title: editTitle, content, category: editCat, tier: editTier,
    }).eq('id', post.id).eq('author_id', user.id)
    if (error) { showToast('수정 실패: ' + error.message); return }
    showToast('수정 완료!'); setEditMode(false); loadPost()
  }

  // 커서 위치 저장
  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  // 공통 이미지 업로드 함수
  async function uploadImageFile(file: File, x?: number, y?: number) {
    if (!user) return
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeName = `${Date.now()}.${ext}`
    const path = `${user.id}/${safeName}`
    showToast('이미지 업로드 중...')
    const { error } = await supabase.storage.from('post-images').upload(path, file)
    if (error) { showToast('업로드 실패: ' + error.message); return }
    const url = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
    const editor = editEditorRef.current
    if (editor) {
      editor.focus()
      const sel = window.getSelection()
      // 드롭인 경우 드롭 위치, 아닌 경우 저장된 커서 위치 사용
      if (x !== undefined && y !== undefined) {
        const range = document.caretRangeFromPoint(x, y)
        if (range && editor.contains(range.startContainer)) {
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      } else if (savedRangeRef.current && sel) {
        sel.removeAllRanges()
        sel.addRange(savedRangeRef.current)
      }
      document.execCommand('insertHTML', false, `<img src="${url}" alt="이미지" style="max-width:100%;border-radius:12px;margin:8px 0;display:block;"><br>`)
    }
    showToast('이미지 삽입 완료')
  }

  // 파일 선택으로 업로드
  async function uploadImg(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !user) return
    await uploadImageFile(e.target.files[0])
    e.target.value = ''
  }

  // 드래그 앤 드롭으로 업로드
  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/') || !user) return
    await uploadImageFile(file, e.clientX, e.clientY)
  }

  async function deletePost() {
    if (!user || !post || !confirm('이 글을 정말 삭제할까요?')) return
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('author_id', user.id)
    if (error) { showToast('삭제 실패'); return }
    showToast('글이 삭제됐어요')
    setTimeout(() => router.push('/'), 1200)
  }

  function canRead() {
    if (!post) return false
    if (!post.tier || post.tier === 'public') return true
    if (post.tier === 'member') return !!user
    if (post.tier === 'paid') return false
    return true
  }

  const nick = authorProfile?.nickname || post?.author_email?.split('@')[0] || '익명'
  const avatarUrl = authorProfile?.avatar_url || `https://api.dicebear.com/8.x/thumbs/svg?seed=${post?.author_id || 'guest'}`

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  )

  if (notFound || !post) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-gray-300">
      <p className="text-lg font-black mb-2">존재하지 않는 게시물이에요</p>
      <a href="/" className="text-blue-500 text-sm font-bold hover:underline">홈으로 돌아가기</a>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-200 px-5 py-3">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 transition-all text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <a href="/" className="text-xl font-black text-blue-500 no-underline">SUBDOCK</a>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${!darkMode ? 'text-blue-500' : 'text-gray-400'}`}>라이트</span>
              <button onClick={toggleDark} className={`relative w-11 h-6 rounded-full transition-all duration-300 ${darkMode ? 'bg-blue-500' : 'bg-gray-200'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${darkMode ? 'left-6' : 'left-1'}`} />
              </button>
              <span className={`text-xs font-bold ${darkMode ? 'text-blue-500' : 'text-gray-400'}`}>다크</span>
            </div>
            {user && post.author_id === user.id && (
              <div className="flex items-center gap-2">
                <button onClick={openEditMode} className="bg-blue-50 hover:bg-blue-100 text-blue-500 px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  수정
                </button>
                <button onClick={deletePost} className="bg-red-50 hover:bg-red-100 text-red-500 px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-5 py-10">

        {/* 수정 모드 */}
        {editMode && (
          <div className="fade-in space-y-5">
            <div className="flex items-center gap-3 mb-8">
              <button onClick={() => setEditMode(false)} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 className="text-3xl font-black">게시물 수정</h2>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 mb-2 block">카테고리</label>
              <select value={editCat} onChange={e => setEditCat(e.target.value)} className="w-full p-4 bg-gray-100 rounded-2xl font-semibold outline-none focus:bg-blue-50 cursor-pointer">
                <optgroup label="── 서브컬처 게임">
                  {['genshin','starrail','zzz','wuthering','bluearchive','endfield','nikke','browndust','limbus','trickle'].map(g => (
                    <option key={g} value={g}>{CAT[g]?.label || g}</option>
                  ))}
                </optgroup>
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
                  <input type="file" className="hidden" accept="image/*" onChange={uploadImg} />
                </label>
              </div>
              <div
                ref={editEditorRef}
                contentEditable
                className="editor-area border border-gray-200 border-t-0 text-base leading-relaxed"
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveEdit} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-full font-bold shadow-lg transition-all">수정 완료</button>
              <button onClick={() => setEditMode(false)} className="px-8 bg-gray-100 hover:bg-gray-200 text-gray-500 py-4 rounded-full font-bold transition-all">취소</button>
            </div>
          </div>
        )}

        {/* 본문 */}
        {!editMode && (<>
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <Badge cat={post.category} />
            {post.tier && post.tier !== 'public' && <TierPill tier={post.tier} />}
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-6 leading-tight">{post.title}</h1>
          <div className="flex items-center justify-between mb-8 pb-8 border-b border-gray-100">
            <a href={`/profile/${post.author_id}`} className="flex items-center gap-3 no-underline group">
              <img src={avatarUrl} className="w-11 h-11 rounded-full object-cover bg-gray-100" alt="" />
              <div>
                <p className="font-black text-sm group-hover:text-blue-500 transition-colors">{nick}</p>
                <p className="text-xs text-gray-400">
                  {new Date(post.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  &nbsp;·&nbsp;구독자 {subscriberCount.toLocaleString()}명
                </p>
              </div>
            </a>
            {user && post.author_id !== user.id && (
              isSubscribed ? (
                <button onClick={() => setUnsubModalOpen(true)} className="bg-blue-100 hover:bg-red-50 text-blue-500 hover:text-red-400 px-5 py-2 rounded-full text-sm font-bold transition-all">구독 중</button>
              ) : (
                <button onClick={() => setSubModalOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow">+ 구독하기</button>
              )
            )}
          </div>

          {canRead() ? (
            <div className="text-base leading-relaxed post-content mb-10" dangerouslySetInnerHTML={{ __html: post.content }} />
          ) : (
            <div className="text-center py-16 border border-gray-100 rounded-[24px] mb-10">
              <p className="font-black text-xl mb-2">{post.tier === 'member' ? '회원 전용 콘텐츠예요' : '구독자 전용 콘텐츠예요'}</p>
              <p className="text-gray-400 text-sm mb-6">{post.tier === 'member' ? '로그인하면 전체 내용을 볼 수 있어요' : '유료 구독하면 모든 프리미엄 글을 볼 수 있어요'}</p>
              {post.tier === 'member' && (
                <a href="/" className="bg-blue-500 hover:bg-blue-600 text-white px-10 py-3 rounded-full text-sm font-bold transition-all inline-block">로그인하기</a>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 py-6 border-t border-b border-gray-100 mb-10 flex-wrap">
            <button onClick={toggleLike} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all border ${isLiked ? 'bg-red-50 text-red-500 border-red-200' : 'bg-white text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-400'}`}>
              <svg className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              좋아요 {likeCount}
            </button>
            <button onClick={toggleBookmark} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all border ${isBookmarked ? 'bg-blue-50 text-blue-500 border-blue-200' : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-400'}`}>
              <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
              {isBookmarked ? '저장됨' : '저장하기'}
            </button>
            <button
              onClick={async () => {
                const url = window.location.href
                if (navigator.share) { await navigator.share({ title: post.title, url }) }
                else { await navigator.clipboard.writeText(url); showToast('링크가 복사됐어요!') }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all border bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              공유하기
            </button>
          </div>

          {canRead() && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">댓글 {comments.length}개</h2>
                <div className="flex gap-1">
                  {(['latest','oldest','likes'] as const).map(s => (
                    <button key={s} onClick={() => setCommentSort(s)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${commentSort === s ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                      {s === 'latest' ? '최신순' : s === 'oldest' ? '오래된순' : '좋아요순'}
                    </button>
                  ))}
                </div>
              </div>
              {user ? (
                <div className="flex gap-3 mb-8">
                  <img src={myProfile?.avatar_url || `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.id}`} className="w-9 h-9 rounded-full object-cover bg-gray-100 flex-shrink-0 mt-1" alt="" />
                  <div className="flex-1">
                    <input value={commentText} onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addComment()}
                      placeholder="댓글을 남겨보세요..."
                      className="w-full p-3.5 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-300" />
                  </div>
                  <button onClick={addComment} disabled={!commentText.trim()}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all flex-shrink-0 ${commentText.trim() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
                    등록
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl p-5 text-center mb-8">
                  <p className="text-sm text-gray-400 font-semibold">댓글을 달려면 <button onClick={() => setAuthOpen(true)} className="text-blue-500 underline">로그인</button>이 필요해요</p>
                </div>
              )}
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <svg className="w-6 h-6 animate-spin text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8H4z" /></svg>
                </div>
              ) : (
                <div className="space-y-6">
                  {getSortedComments().map(comment => (
                    <div key={comment.id} className={`flex gap-4 ${comment.is_pinned ? 'bg-blue-50 rounded-2xl p-4 -mx-4' : ''}`}>
                      <a href={`/profile/${comment.user_id}`} className="flex-shrink-0">
                        {comment.avatar_url ? (
                          <img src={comment.avatar_url} className="w-9 h-9 rounded-full object-cover bg-gray-100" alt="" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-black text-gray-500">
                            {(comment.author_nickname || '?')[0].toUpperCase()}
                          </div>
                        )}
                      </a>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <a href={`/profile/${comment.user_id}`} className="text-sm font-black hover:text-blue-500 transition-colors no-underline">{comment.author_nickname || '익명'}</a>
                          {comment.is_pinned && (
                            <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-500 font-bold px-2 py-0.5 rounded-full">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                              고정
                            </span>
                          )}
                          <span className="text-xs text-gray-300">{new Date(comment.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          {comment.updated_at && <span className="text-xs text-gray-300">(수정됨)</span>}
                        </div>
                        {editingCommentId === comment.id ? (
                          <div className="flex gap-2">
                            <input value={editingCommentText} onChange={e => setEditingCommentText(e.target.value)}
                              className="flex-1 p-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                            <button onClick={() => saveEditComment(comment.id)} className="px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-bold">저장</button>
                            <button onClick={() => setEditingCommentId(null)} className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">취소</button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <button onClick={() => toggleCommentLike(comment.id)}
                            className={`flex items-center gap-1 text-xs font-bold transition-all ${comment.isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
                            <svg className="w-3.5 h-3.5" fill={comment.isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                            {comment.likeCount}
                          </button>
                          {user && comment.user_id === user.id && (
                            <>
                              <button onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content) }}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 font-bold transition-all">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                수정
                              </button>
                              <button onClick={() => deleteComment(comment.id)}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 font-bold transition-all">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                삭제
                              </button>
                            </>
                          )}
                          {user && post.author_id === user.id && (
                            <button onClick={() => togglePinComment(comment.id, comment.is_pinned)}
                              className={`flex items-center gap-1 text-xs font-bold transition-all ${comment.is_pinned ? 'text-blue-500 hover:text-gray-400' : 'text-gray-400 hover:text-blue-500'}`}>
                              <svg className="w-3 h-3" fill={comment.is_pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                              {comment.is_pinned ? '고정 해제' : '고정'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>)}
      </main>

      {subModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setSubModalOpen(false)}>
          <div className="bg-white p-8 rounded-[32px] w-full max-w-sm shadow-2xl slide-up">
            <h3 className="text-2xl font-black mb-1">{nick}님 구독하기</h3>
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

      {unsubModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setUnsubModalOpen(false)}>
          <div className="bg-white p-8 rounded-[32px] w-full max-w-sm shadow-2xl slide-up">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-xl font-black mb-2 text-center">구독을 해지하시겠어요?</h3>
            <p className="text-gray-400 text-sm text-center mb-4">{nick}님의 뉴스레터를 더 이상 받아볼 수 없게 돼요.</p>
            <div className="bg-yellow-50 rounded-2xl p-4 mb-6">
              <p className="text-xs text-yellow-700 font-semibold leading-relaxed">
                · 무료 구독은 즉시 해지되며 이후 뉴스레터를 받아볼 수 없어요.<br />
                · 유료 구독 중이라면 현재 결제 기간이 끝날 때까지는 프리미엄 콘텐츠를 계속 이용할 수 있어요.<br />
                · 해지 후 재구독은 언제든지 가능해요.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setUnsubModalOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3.5 rounded-full font-bold text-sm transition-all">취소</button>
              <button onClick={unsubscribe} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-full font-bold text-sm transition-all">해지하기</button>
            </div>
          </div>
        </div>
      )}


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

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-xl z-[9999] whitespace-nowrap fade-in">{toast}</div>
      )}
    </div>
  )
}

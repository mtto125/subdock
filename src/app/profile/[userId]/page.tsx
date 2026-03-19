'use client'

import { useEffect, useState } from 'react'
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

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [detailPost, setDetailPost] = useState<Post | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [subEmail, setSubEmail] = useState('')
  const [unsubModalOpen, setUnsubModalOpen] = useState(false)
  const [toast, setToast] = useState('')

  const [comments, setComments] = useState<CommentWithLikes[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentSort, setCommentSort] = useState<'latest' | 'oldest' | 'likes'>('latest')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')

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
      setCurrentUser(u)
      if (u?.id === userId) { router.replace('/profile'); return }
      if (u) {
        loadCurrentProfile(u.id)
        checkSubscription(u.id)
        setSubEmail(u.email || '')
      }
    })
    loadData()
  }, [userId])

  async function loadCurrentProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) setCurrentProfile(data)
  }

  async function loadData() {
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (!profileData) { setNotFound(true); setLoading(false); return }
    setProfile(profileData)
    const { count } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('target_id', userId)
    setSubscriberCount(count || 0)
    const { data: postsData } = await supabase.from('posts').select('*').eq('author_id', userId).neq('tier', 'paid').order('created_at', { ascending: false })
    setPosts(postsData || [])
    setLoading(false)
  }

  async function checkSubscription(uid: string) {
    const { data } = await supabase.from('subscriptions').select('id').eq('subscriber_id', uid).eq('target_id', userId).single()
    setIsSubscribed(!!data)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function subscribe() {
    if (!currentUser) return
    if (!subEmail.trim()) { showToast('이메일을 입력해주세요!'); return }
    const { error } = await supabase.from('subscriptions').insert({
      subscriber_id: currentUser.id, target_id: userId, tier: 'free', email: subEmail
    })
    if (error) { showToast('구독 실패: ' + error.message); return }
    setIsSubscribed(true); setSubscriberCount(prev => prev + 1)
    setSubModalOpen(false)
    showToast(`${profile?.nickname || ''}님을 구독했어요!`)
  }

  async function unsubscribe() {
    if (!currentUser) return
    await supabase.from('subscriptions').delete().eq('subscriber_id', currentUser.id).eq('target_id', userId)
    setIsSubscribed(false); setSubscriberCount(prev => Math.max(0, prev - 1))
    setUnsubModalOpen(false); showToast('구독을 해지했어요')
  }

  async function loadComments(postId: string) {
    setCommentsLoading(true)
    const { data: commentsData } = await supabase.from('comments').select('*').eq('post_id', postId)
    if (!commentsData) { setCommentsLoading(false); return }
    const withLikes: CommentWithLikes[] = await Promise.all(commentsData.map(async (c: Comment) => {
      const { count } = await supabase.from('comment_likes').select('*', { count: 'exact', head: true }).eq('comment_id', c.id)
      const isLiked = currentUser ? (await supabase.from('comment_likes').select('id').eq('comment_id', c.id).eq('user_id', currentUser.id)).data?.length! > 0 : false
      const { data: profileData } = await supabase.from('profiles').select('avatar_url').eq('id', c.user_id).single()
      return { ...c, likeCount: count || 0, isLiked, avatar_url: profileData?.avatar_url || '' }
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

  async function addComment() {
    if (!currentUser || !detailPost || !commentText.trim()) return
    const nick = currentProfile?.nickname || currentUser.email?.split('@')[0] || '익명'
    const { error } = await supabase.from('comments').insert({
      post_id: detailPost.id, user_id: currentUser.id, author_nickname: nick, content: commentText.trim()
    })
    if (error) { showToast('댓글 작성 실패'); return }
    setCommentText(''); loadComments(detailPost.id); showToast('댓글을 남겼어요')
  }

  async function deleteComment(commentId: string) {
    if (!currentUser || !confirm('댓글을 삭제할까요?')) return
    await supabase.from('comments').delete().eq('id', commentId).eq('user_id', currentUser.id)
    loadComments(detailPost!.id); showToast('댓글이 삭제됐어요')
  }

  async function saveEditComment(commentId: string) {
    if (!currentUser || !editingCommentText.trim()) return
    await supabase.from('comments').update({ content: editingCommentText, updated_at: new Date().toISOString() }).eq('id', commentId).eq('user_id', currentUser.id)
    setEditingCommentId(null); setEditingCommentText('')
    loadComments(detailPost!.id); showToast('댓글이 수정됐어요')
  }

  async function toggleCommentLike(commentId: string) {
    if (!currentUser) { showToast('로그인이 필요해요!'); return }
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    if (comment.isLiked) {
      await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUser.id)
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUser.id })
    }
    loadComments(detailPost!.id)
  }

  function openDetail(post: Post) {
    setDetailPost(post)
    loadComments(post.id)
  }

  const nick = profile?.nickname || '알 수 없음'
  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/8.x/thumbs/svg?seed=${userId}`

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  )

  if (notFound) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-gray-300">
      <p className="text-lg font-black mb-2">존재하지 않는 유저예요</p>
      <a href="/" className="text-blue-500 text-sm font-bold hover:underline">홈으로 돌아가기</a>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-200 px-5 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <a href="/" className="text-2xl font-black text-blue-500 no-underline cursor-pointer">SUBDOCK</a>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${!darkMode ? 'text-blue-500' : 'text-gray-400'}`}>라이트</span>
              <button onClick={toggleDark} className={`relative w-11 h-6 rounded-full transition-all duration-300 ${darkMode ? 'bg-blue-500' : 'bg-gray-200'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${darkMode ? 'left-6' : 'left-1'}`} />
              </button>
              <span className={`text-xs font-bold ${darkMode ? 'text-blue-500' : 'text-gray-400'}`}>다크</span>
            </div>
            <button onClick={() => router.back()} className="text-sm font-semibold text-gray-400 px-4 py-2 rounded-full hover:bg-gray-100 transition-all flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              뒤로
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-5 py-10">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-10 pb-10 border-b border-gray-100">
          <img src={avatarUrl} className="w-28 h-28 rounded-full object-cover bg-gray-100 border-2 border-gray-200 flex-shrink-0" alt="" />
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-black mb-1">{nick}</h2>
            <p className="text-gray-400 text-sm mb-2">{profile?.bio || '소개글이 없어요.'}</p>
            <p className="text-sm font-bold text-blue-500 mb-5">구독자 {subscriberCount.toLocaleString()}명</p>
            {currentUser && (
              isSubscribed ? (
                <button onClick={() => setUnsubModalOpen(true)}
                  className="bg-blue-100 hover:bg-red-50 text-blue-500 hover:text-red-400 px-6 py-2.5 rounded-full text-sm font-bold transition-all">
                  구독 중
                </button>
              ) : (
                <button onClick={() => setSubModalOpen(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow">
                  + 구독하기
                </button>
              )
            )}
          </div>
        </div>

        <div className="mb-5">
          <h3 className="text-xl font-black mb-1">{nick}님의 뉴스레터</h3>
          <p className="text-gray-400 text-sm">전체 공개 및 회원 공개 글만 표시돼요</p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-sm font-semibold">아직 작성한 글이 없어요</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map(post => (
              <div key={post.id} onClick={() => openDetail(post)}
                className="aspect-square rounded-[20px] border border-gray-200 bg-gray-50 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg hover:border-blue-200 active:scale-[0.97] overflow-hidden relative">
                <div className="absolute inset-0 p-4 flex flex-col justify-between">
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge cat={post.category} />
                    {post.tier && post.tier !== 'public' && <TierPill tier={post.tier} />}
                  </div>
                  <h4 className="text-sm font-black leading-snug line-clamp-4 text-gray-800">{post.title}</h4>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 게시물 팝업 + 댓글 */}
      {detailPost && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-5 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setDetailPost(null) }}>
          <div className="bg-white w-full max-w-2xl rounded-t-[32px] md:rounded-[32px] shadow-2xl max-h-[90vh] overflow-y-auto slide-up">
            <div className="sticky top-0 bg-white/90 backdrop-blur-sm flex justify-between items-center px-8 pt-6 pb-4 border-b border-gray-100 rounded-t-[32px]">
              <div className="flex items-center gap-2">
                <Badge cat={detailPost.category} />
                {detailPost.tier && detailPost.tier !== 'public' && <TierPill tier={detailPost.tier} />}
              </div>
              <button onClick={() => setDetailPost(null)} className="bg-gray-100 hover:bg-gray-200 w-9 h-9 rounded-full flex items-center justify-center transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-8 py-6">
              <h2 className="text-2xl font-black mb-2 leading-snug">{detailPost.title}</h2>
              <p className="text-xs text-gray-400 mb-4">
                {new Date(detailPost.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                &nbsp;·&nbsp;@{nick}
              </p>

              {detailPost.tier === 'member' && !currentUser ? (
                <div className="text-center py-8 border border-gray-100 rounded-2xl mb-4">
                  <p className="font-black text-base mb-1">회원 전용 콘텐츠예요</p>
                  <p className="text-gray-400 text-sm mb-4">로그인하면 전체 내용을 볼 수 있어요</p>
                  <a href="/" className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2.5 rounded-full text-sm font-bold transition-all inline-block no-underline">로그인하기</a>
                </div>
              ) : (
                <>
                  {/* 본문 미리보기 6줄 제한 */}
                  <div className="text-base leading-relaxed post-content line-clamp-6 mb-4" dangerouslySetInnerHTML={{ __html: detailPost.content }} />
                  {/* 전체 화면으로 보기 */}
                  <a href={`/posts/${detailPost.id}`}
                    className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-bold transition-all no-underline mb-6">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    전체 화면으로 보기
                  </a>

                  {/* 댓글 섹션 */}
                  <div className="border-t border-gray-100 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-black text-base">댓글 {comments.length}개</h3>
                      <div className="flex gap-1">
                        {(['latest','oldest','likes'] as const).map(s => (
                          <button key={s} onClick={() => setCommentSort(s)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${commentSort === s ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                            {s === 'latest' ? '최신순' : s === 'oldest' ? '오래된순' : '좋아요순'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {currentUser ? (
                      <div className="flex gap-3 mb-6">
                        <img src={currentProfile?.avatar_url || `https://api.dicebear.com/8.x/thumbs/svg?seed=${currentUser.id}`} className="w-8 h-8 rounded-full object-cover bg-gray-100 flex-shrink-0 mt-1" alt="" />
                        <div className="flex-1">
                          <input value={commentText} onChange={e => setCommentText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addComment()}
                            placeholder="댓글을 남겨보세요..."
                            className="w-full p-3 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-300" />
                        </div>
                        <button onClick={addComment} disabled={!commentText.trim()}
                          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex-shrink-0 ${commentText.trim() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
                          등록
                        </button>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-2xl p-4 text-center mb-6">
                        <p className="text-sm text-gray-400 font-semibold">댓글을 달려면 <a href="/" className="text-blue-500 underline">로그인</a>이 필요해요</p>
                      </div>
                    )}
                    {commentsLoading ? (
                      <div className="flex justify-center py-6">
                        <svg className="w-5 h-5 animate-spin text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8H4z" /></svg>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {getSortedComments().map(comment => (
                          <div key={comment.id} className={`flex gap-3 ${comment.is_pinned ? 'bg-blue-50 rounded-2xl p-3 -mx-3' : ''}`}>
                            <a href={`/profile/${comment.user_id}`} className="flex-shrink-0">
                              {comment.avatar_url ? (
                                <img src={comment.avatar_url} className="w-8 h-8 rounded-full object-cover bg-gray-100" alt="" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-black text-gray-500">
                                  {(comment.author_nickname || '?')[0].toUpperCase()}
                                </div>
                              )}
                            </a>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <a href={`/profile/${comment.user_id}`} className="text-xs font-black hover:text-blue-500 transition-colors no-underline">{comment.author_nickname || '익명'}</a>
                                {comment.is_pinned && (
                                  <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-500 font-bold px-2 py-0.5 rounded-full">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                                    고정
                                  </span>
                                )}
                                <span className="text-xs text-gray-300">{new Date(comment.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                                {comment.updated_at && <span className="text-xs text-gray-300">(수정됨)</span>}
                              </div>
                              {editingCommentId === comment.id ? (
                                <div className="flex gap-2">
                                  <input value={editingCommentText} onChange={e => setEditingCommentText(e.target.value)}
                                    className="flex-1 p-2 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-300" />
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
                                {currentUser && comment.user_id === currentUser.id && (
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
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 구독 모달 */}
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

      {/* 구독 해지 확인 모달 */}
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

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-xl z-[9999] whitespace-nowrap fade-in">{toast}</div>
      )}
    </div>
  )
}

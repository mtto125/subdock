'use client'

import { useEffect, useState } from 'react'
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

function Badge({ cat }: { cat: string }) {
  const m = CAT[cat] || { label: cat, cls: 'bg-gray-100 text-gray-500' }
  return <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${m.cls}`}>{m.label}</span>
}

type PostTab = 'mine' | 'liked' | 'bookmarked' | 'history'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<'profile' | 'settings'>('profile')
  const [postTab, setPostTab] = useState<PostTab>('mine')
  const [settingsTab, setSettingsTab] = useState<'prof' | 'acct'>('prof')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [myPosts, setMyPosts] = useState<Post[]>([])
  const [likedPosts, setLikedPosts] = useState<Post[]>([])
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Post[]>([])
  const [historyPosts, setHistoryPosts] = useState<Post[]>([])
  const [detailPost, setDetailPost] = useState<Post | null>(null)
  const [nickModalOpen, setNickModalOpen] = useState(false)
  const [firstNick, setFirstNick] = useState('')
  const [nickErr, setNickErr] = useState('')
  const [sNick, setSNick] = useState('')
  const [sBio, setSBio] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [subscriberCount, setSubscriberCount] = useState(0)

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
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
      loadAll(session.user)
    })
  }, [])

  async function loadAll(u: User) {
    await loadProfile(u)
    await Promise.all([loadMyPosts(u.id), loadLikedPosts(u.id), loadBookmarkedPosts(u.id), loadHistory(u.id), loadSubscriberCount(u.id)])
    setLoading(false)
  }

  async function loadProfile(u: User) {
    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    if (data) {
      setProfile(data); setSNick(data.nickname || ''); setSBio(data.bio || '')
      if (!data.nickname_set) setNickModalOpen(true)
    } else {
      await supabase.from('profiles').insert({ id: u.id })
      setProfile({ id: u.id, nickname: '', bio: '', avatar_url: '', nickname_set: false, created_at: '' })
      setNickModalOpen(true)
    }
  }

  async function loadSubscriberCount(uid: string) {
    const { count } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('target_id', uid)
    setSubscriberCount(count || 0)
  }

  async function loadMyPosts(uid: string) {
    const { data } = await supabase.from('posts').select('*').eq('author_id', uid).order('created_at', { ascending: false })
    setMyPosts(data || [])
  }

  async function loadLikedPosts(uid: string) {
    const { data } = await supabase.from('likes').select('post_id, posts(*)').eq('user_id', uid).order('created_at', { ascending: false })
    setLikedPosts((data || []).map((d: any) => d.posts).filter(Boolean))
  }

  async function loadBookmarkedPosts(uid: string) {
    const { data } = await supabase.from('bookmarks').select('post_id, posts(*)').eq('user_id', uid).order('created_at', { ascending: false })
    setBookmarkedPosts((data || []).map((d: any) => d.posts).filter(Boolean))
  }

  async function loadHistory(uid: string) {
    const { data } = await supabase.from('read_history').select('post_id, posts(*)').eq('user_id', uid).order('read_at', { ascending: false })
    setHistoryPosts((data || []).map((d: any) => d.posts).filter(Boolean))
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function saveFirstNick() {
    setNickErr('')
    if (firstNick.length < 2) { setNickErr('닉네임은 2자 이상이에요'); return }
    if (!user) return
    const { error } = await supabase.from('profiles').upsert({ id: user.id, nickname: firstNick, nickname_set: true })
    if (error) { setNickErr(error.message.includes('unique') ? '이미 사용 중인 닉네임이에요' : error.message); return }
    setProfile(prev => prev ? { ...prev, nickname: firstNick, nickname_set: true } : prev)
    setSNick(firstNick); setNickModalOpen(false)
    showToast(`${firstNick}님, 환영해요!`)
  }

  async function saveProfile() {
    if (!user) return
    if (sNick.length < 2) { showToast('닉네임은 2자 이상이에요'); return }
    const { error } = await supabase.from('profiles').upsert({ id: user.id, nickname: sNick, bio: sBio, nickname_set: true })
    if (error) { showToast(error.message.includes('unique') ? '이미 사용 중인 닉네임이에요' : error.message); return }
    setProfile(prev => prev ? { ...prev, nickname: sNick, bio: sBio } : prev)
    showToast('프로필 저장 완료'); setTab('profile')
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !user) return
    const file = e.target.files[0]
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    showToast('사진 업로드 중...')
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { showToast('업로드 실패'); return }
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?t=' + Date.now()
    await supabase.from('profiles').upsert({ id: user.id, avatar_url: url })
    setProfile(prev => prev ? { ...prev, avatar_url: url } : prev)
    showToast('프로필 사진 변경 완료'); e.target.value = ''
  }

  async function deleteMyPost(postId: string) {
    if (!user || !confirm('이 글을 정말 삭제할까요?')) return
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('author_id', user.id)
    if (error) { showToast('삭제 실패'); return }
    setDetailPost(null); showToast('글이 삭제됐어요')
    loadMyPosts(user.id)
  }

  async function deleteAccount() {
    if (!user) return
    if (deleteConfirm !== '탈퇴합니다') { showToast("'탈퇴합니다'를 정확히 입력해주세요"); return }
    if (!confirm('정말로 탈퇴하시겠어요? 모든 데이터가 삭제되고 복구할 수 없어요.')) return
    await supabase.from('posts').delete().eq('author_id', user.id)
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    showToast('탈퇴가 완료됐어요. 그동안 감사했어요')
    setTimeout(() => router.push('/'), 1500)
  }

  async function doLogout() { await supabase.auth.signOut(); router.push('/') }

  const nick = profile?.nickname || user?.email?.split('@')[0] || ''
  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/8.x/thumbs/svg?seed=${user?.id || 'guest'}`

  function getActivePosts(): Post[] {
    if (postTab === 'mine') return myPosts
    if (postTab === 'liked') return likedPosts
    if (postTab === 'bookmarked') return bookmarkedPosts
    return historyPosts
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-200 px-5 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <a href="/" className="text-2xl font-black text-blue-500 no-underline cursor-pointer">SUBDOCK</a>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${!darkMode ? 'text-blue-500' : 'text-gray-400'}`}>라이트</span>
              <button onClick={toggleDark} className={`relative w-11 h-6 rounded-full transition-all duration-300 ${darkMode ? 'bg-blue-500' : 'bg-gray-200'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${darkMode ? 'left-6' : 'left-1'}`} />
              </button>
              <span className={`text-xs font-bold ${darkMode ? 'text-blue-500' : 'text-gray-400'}`}>다크</span>
            </div>
            <button onClick={doLogout} className="text-sm font-semibold text-gray-400 px-4 py-2 rounded-full hover:bg-gray-100 transition-all">로그아웃</button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-5 py-10">
        <div className="flex gap-1 mb-8 border-b border-gray-200 pb-2">
          <button onClick={() => setTab('profile')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'profile' ? 'bg-blue-50 text-blue-500' : 'text-gray-400 hover:bg-gray-100'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> 내 프로필</button>
          <button onClick={() => setTab('settings')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'settings' ? 'bg-blue-50 text-blue-500' : 'text-gray-400 hover:bg-gray-100'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> 환경 설정</button>
        </div>

        {tab === 'profile' && (
          <div className="fade-in">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-10 pb-10 border-b border-gray-100">
              <div className="relative flex-shrink-0">
                <img src={avatarUrl} className="w-28 h-28 rounded-full object-cover bg-gray-100 border-2 border-gray-200" alt="" />
                <label className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center cursor-pointer text-xs border-2 border-white transition-all">
                  ✏️<input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} />
                </label>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-black mb-1">{nick}</h2>
                <p className="text-gray-400 text-sm mb-2">{profile?.bio || '소개글이 없어요.'}</p>
                <p className="text-sm font-bold text-blue-500 mb-5">구독자 {subscriberCount.toLocaleString()}명</p>
                <div className="flex gap-2 justify-center md:justify-start">
                  <button onClick={() => setTab('settings')} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-5 py-2 rounded-full text-sm font-bold transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> 환경 설정</button>
                  <button onClick={doLogout} className="bg-red-50 hover:bg-red-100 text-red-500 px-5 py-2 rounded-full text-sm font-bold transition-all">로그아웃</button>
                </div>
              </div>
            </div>

            <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-2xl overflow-x-auto">
              {([
                { key: 'mine',       label: '내 글',       count: myPosts.length,         icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
                { key: 'liked',      label: '좋아요',      count: likedPosts.length,      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg> },
                { key: 'bookmarked', label: '북마크',      count: bookmarkedPosts.length, icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg> },
                { key: 'history',    label: '최근 읽은 글', count: historyPosts.length,   icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              ] as const).map(({ key, label, count, icon }) => (
                <button key={key} onClick={() => setPostTab(key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${postTab === key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
                  {icon}{label}
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${postTab === key ? 'bg-blue-100 text-blue-500' : 'bg-gray-200 text-gray-400'}`}>{count}</span>
                </button>
              ))}
            </div>

            {getActivePosts().length === 0 ? (
              <div className="text-center py-16 text-gray-300">
                <div className="flex justify-center mb-3">
                  {postTab === 'mine' ? <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  : postTab === 'liked' ? <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  : postTab === 'bookmarked' ? <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  : <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                </div>
                <p className="text-sm font-semibold">
                  {postTab === 'mine' ? '아직 작성한 글이 없어요' : postTab === 'liked' ? '좋아요한 글이 없어요' : postTab === 'bookmarked' ? '북마크한 글이 없어요' : '최근 읽은 글이 없어요'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {getActivePosts().map(post => (
                  <div key={post.id} onClick={() => setDetailPost(post)}
                    className="aspect-square rounded-[20px] border border-gray-200 bg-gray-50 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg hover:border-blue-200 active:scale-[0.97] overflow-hidden relative">
                    <div className="absolute inset-0 p-4 flex flex-col justify-between">
                      <div><Badge cat={post.category} /></div>
                      <h4 className="text-sm font-black leading-snug line-clamp-4 text-gray-800">{post.title}</h4>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="fade-in">
            <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-2xl w-fit">
              <button onClick={() => setSettingsTab('prof')} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${settingsTab === 'prof' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>프로필</button>
              <button onClick={() => setSettingsTab('acct')} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${settingsTab === 'acct' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>계정</button>
            </div>

            {settingsTab === 'prof' && (
              <div className="space-y-5 max-w-lg">
                <div className="flex items-center gap-5 p-5 bg-gray-100 rounded-2xl">
                  <div className="relative flex-shrink-0">
                    <img src={avatarUrl} className="w-20 h-20 rounded-full object-cover bg-gray-200" alt="" />
                    <label className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center cursor-pointer text-xs border-2 border-white transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg><input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} />
                    </label>
                  </div>
                  <div><p className="font-bold text-sm mb-1">프로필 사진</p><p className="text-gray-400 text-xs">JPG, PNG 파일을 업로드해주세요</p></div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block">닉네임</label>
                  <input value={sNick} onChange={e => setSNick(e.target.value)} placeholder="닉네임 (2~15자)" maxLength={15}
                    className="w-full p-4 bg-gray-100 rounded-2xl font-bold outline-none focus:bg-blue-50 transition-all placeholder:text-gray-300" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block">소개글</label>
                  <textarea value={sBio} onChange={e => setSBio(e.target.value)} placeholder="나를 소개해주세요 (최대 100자)" maxLength={100} rows={3}
                    className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:bg-blue-50 transition-all placeholder:text-gray-300 resize-none" />
                </div>
                <div className="p-5 bg-gray-100 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm mb-0.5">화면 테마</p>
                    <p className="text-gray-400 text-xs">{darkMode ? '다크 모드' : '라이트 모드'} 사용 중</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${!darkMode ? 'text-blue-500' : 'text-gray-400'}`}>라이트</span>
                    <button onClick={toggleDark} className={`relative w-11 h-6 rounded-full transition-all duration-300 ${darkMode ? 'bg-blue-500' : 'bg-gray-300'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${darkMode ? 'left-6' : 'left-1'}`} />
                    </button>
                    <span className={`text-xs font-bold ${darkMode ? 'text-blue-500' : 'text-gray-400'}`}>다크</span>
                  </div>
                </div>
                <button onClick={saveProfile} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-full font-bold transition-all">저장하기</button>
              </div>
            )}

            {settingsTab === 'acct' && (
              <div className="space-y-4 max-w-lg">
                <div className="p-5 bg-gray-100 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 mb-1">연결된 이메일</p>
                  <p className="font-bold">{user?.email}</p>
                </div>
                <div className="p-5 border border-gray-200 rounded-2xl">
                  <p className="font-bold text-sm mb-1">로그아웃</p>
                  <p className="text-gray-400 text-xs mb-3">현재 기기에서 로그아웃해요.</p>
                  <button onClick={doLogout} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-6 py-2.5 rounded-full text-sm font-bold transition-all">로그아웃</button>
                </div>
                <div className="p-5 border border-red-200 rounded-2xl">
                  <p className="font-bold text-sm mb-1 text-red-500">⚠️ 회원 탈퇴</p>
                  <p className="text-gray-400 text-xs mb-4">탈퇴하면 모든 글과 프로필 데이터가 삭제되며 복구할 수 없어요.</p>
                  <p className="text-xs font-bold text-gray-500 mb-2">확인을 위해 아래에 <span className="text-red-400">'탈퇴합니다'</span>를 입력해주세요</p>
                  <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="탈퇴합니다"
                    className="w-full p-3 bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-red-300 text-sm mb-3 placeholder:text-gray-300" />
                  <button onClick={deleteAccount} disabled={deleteConfirm !== '탈퇴합니다'}
                    className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${deleteConfirm === '탈퇴합니다' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
                    회원 탈퇴
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 닉네임 최초 설정 모달 */}
      {nickModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[32px] w-full max-w-sm shadow-2xl slide-up text-center">
            <div className="text-4xl mb-4">👋</div>
            <h3 className="text-2xl font-black mb-1">환영해요!</h3>
            <p className="text-gray-400 text-sm mb-6">Subdock에서 사용할 닉네임을 설정해주세요</p>
            <div className="space-y-3">
              <input value={firstNick} onChange={e => setFirstNick(e.target.value)} placeholder="닉네임 (2~15자)" maxLength={15}
                onKeyDown={e => e.key === 'Enter' && saveFirstNick()}
                className="w-full p-4 bg-gray-100 rounded-2xl font-bold text-center outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-300" />
              {nickErr && <p className="text-red-400 text-xs">{nickErr}</p>}
              <button onClick={saveFirstNick} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-full font-bold transition-all">시작하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 글 팝업 미리보기 모달 */}
      {detailPost && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-5 bg-black/40 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setDetailPost(null)}>
          <div className="bg-white w-full max-w-2xl rounded-t-[32px] md:rounded-[32px] shadow-2xl max-h-[85vh] overflow-y-auto slide-up">
            <div className="sticky top-0 bg-white/90 backdrop-blur-sm flex justify-between items-center px-8 pt-6 pb-4 border-b border-gray-100 rounded-t-[32px]">
              <Badge cat={detailPost.category} />
              <div className="flex items-center gap-2">
                {user && detailPost.author_id === user.id && (
                  <button onClick={() => deleteMyPost(detailPost.id)} className="bg-red-50 hover:bg-red-100 text-red-500 px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    삭제
                  </button>
                )}
                <button onClick={() => setDetailPost(null)} className="bg-gray-100 hover:bg-gray-200 w-9 h-9 rounded-full flex items-center justify-center transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="px-8 py-6">
              <h2 className="text-2xl font-black mb-2 leading-snug">{detailPost.title}</h2>
              <p className="text-xs text-gray-400 mb-5">{new Date(detailPost.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              {/* 미리보기 — 6줄 제한 */}
              <div className="text-base leading-relaxed post-content line-clamp-6 mb-6" dangerouslySetInnerHTML={{ __html: detailPost.content }} />
              {/* 전체 화면으로 보기 버튼 */}
              <a href={`/posts/${detailPost.id}`}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-bold transition-all no-underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                전체 화면으로 보기
              </a>
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

'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Post } from '@/lib/types'

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

type FilterType = 'all' | 'title' | 'content' | 'nickname' | 'title+content'

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',           label: '전체' },
  { key: 'title',         label: '제목' },
  { key: 'content',       label: '내용' },
  { key: 'nickname',      label: '닉네임' },
  { key: 'title+content', label: '제목+내용' },
]

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const [query, setQuery] = useState(initialQuery)
  const [inputValue, setInputValue] = useState(initialQuery)
  const [filter, setFilter] = useState<FilterType>('all')
  const [results, setResults] = useState<Post[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery, filter)
    }
    inputRef.current?.focus()
  }, [])

  async function doSearch(q: string, f: FilterType) {
    if (!q.trim()) return
    setSearching(true)
    setSearched(true)

    let queryBuilder = supabase.from('posts').select('*').order('created_at', { ascending: false })

    if (f === 'all') {
      queryBuilder = queryBuilder.or(`title.ilike.%${q}%,content.ilike.%${q}%,author_nickname.ilike.%${q}%`)
    } else if (f === 'title') {
      queryBuilder = queryBuilder.ilike('title', `%${q}%`)
    } else if (f === 'content') {
      queryBuilder = queryBuilder.ilike('content', `%${q}%`)
    } else if (f === 'nickname') {
      queryBuilder = queryBuilder.ilike('author_nickname', `%${q}%`)
    } else if (f === 'title+content') {
      queryBuilder = queryBuilder.or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    }

    const { data } = await queryBuilder
    setResults(data || [])
    setSearching(false)
  }

  function handleSearch() {
    if (!inputValue.trim()) return
    setQuery(inputValue)
    router.replace(`/search?q=${encodeURIComponent(inputValue)}`)
    doSearch(inputValue, filter)
  }

  function handleFilterChange(f: FilterType) {
    setFilter(f)
    if (query) doSearch(query, f)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-200 px-5 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 transition-all text-gray-500 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <a href="/" className="text-xl font-black text-blue-500 no-underline flex-shrink-0">SUBDOCK</a>
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="검색어를 입력하세요..."
              className="flex-1 bg-transparent outline-none text-sm font-semibold placeholder:text-gray-300"
            />
            {inputValue && (
              <button onClick={() => { setInputValue(''); setResults([]); setSearched(false) }} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            )}
          </div>
          <button onClick={handleSearch} className="flex-shrink-0 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold transition-all">
            검색
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {/* 필터 */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => handleFilterChange(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${filter === f.key ? 'bg-blue-500 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* 결과 */}
        {searching ? (
          <div className="flex flex-col items-center py-20 text-gray-300 gap-3">
            <svg className="w-8 h-8 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8H4z" /></svg>
            <span className="text-sm">검색 중...</span>
          </div>
        ) : !searched ? (
          <div className="flex flex-col items-center py-20 text-gray-300 gap-3">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <p className="text-sm font-semibold">검색어를 입력해주세요</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-300 gap-3">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-sm font-semibold">'{query}'에 대한 검색 결과가 없어요</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 font-semibold mb-5">
              '<span className="text-blue-500">{query}</span>' 검색 결과 {results.length}개
            </p>
            <div className="space-y-4">
              {results.map(post => {
                const plain = post.content.replace(/<[^>]*>/gm, '')
                const date = new Date(post.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                const author = post.author_nickname || post.author_email?.split('@')[0] || '익명'
                return (
                  <div key={post.id} onClick={() => router.push(`/posts/${post.id}`)}
                    className="p-6 bg-white rounded-[20px] border border-gray-200 cursor-pointer transition-all hover:shadow-lg hover:border-blue-200 hover:-translate-y-0.5">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge cat={post.category} />
                    </div>
                    <h3 className="text-base font-black mb-2 leading-snug">{post.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-3">{plain}</p>
                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <span>{date}</span>
                      <a href={`/profile/${post.author_id}`} onClick={e => e.stopPropagation()} className="font-semibold hover:text-blue-500 transition-colors no-underline">@{author}</a>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  )
}

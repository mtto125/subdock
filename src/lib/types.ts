export type Profile = {
  id: string
  nickname: string | null
  bio: string | null
  avatar_url: string | null
  nickname_set: boolean
  created_at: string
}

export type Post = {
  id: string
  title: string
  content: string
  category: string
  tier: string
  author_id: string
  author_email: string
  author_nickname: string | null
  created_at: string
}

export type Comment = {
  id: string
  post_id: string
  user_id: string
  author_nickname: string | null
  content: string
  is_pinned: boolean
  updated_at: string | null
  created_at: string
}

export type Like = {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export type Bookmark = {
  id: string
  post_id: string
  user_id: string
  created_at: string
}
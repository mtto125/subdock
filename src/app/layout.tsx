import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Subdock | 서브컬처 뉴스레터',
  description: '서브컬처 덕후들이 직접 정리한 정보들',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('sd_dark') === 'true') {
              document.documentElement.classList.add('dark');
            }
          } catch(e) {}
        `}} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
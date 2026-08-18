import type { Metadata } from 'next'
import './globals.css'
import './app-additions.css'

export const metadata: Metadata = {
  title: 'VLX — Nền tảng giao dịch Hàng hải & Tài chính Hàng hải (VMFB)',
  description:
    'Maritime trading and maritime finance exchange. Next.js + Postgres, seeded from ui-2.html.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="light">
      <body>{children}</body>
    </html>
  )
}

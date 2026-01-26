import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthProvider from '@/components/AuthProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'geniferAI | Your AI Video Production Assistant',
  description: 'Premium AI video production for professional creators. Turn your ideas into high-quality visual assets in minutes with geniferAI.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className={`${inter.className} overflow-x-hidden`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
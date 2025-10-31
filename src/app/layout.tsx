import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StoryFlow AI',
  description: 'From Idea to Frame - AI-powered storyboard to video generation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}


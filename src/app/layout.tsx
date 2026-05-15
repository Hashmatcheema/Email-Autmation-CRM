import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'EITACIES CRM Platform',
  description: 'CRM & automated email outreach platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} h-full`}>
      <body className="h-full bg-background font-sans antialiased">
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  )
}

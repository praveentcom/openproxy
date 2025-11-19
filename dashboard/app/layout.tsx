import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OpenProxy Metrics Dashboard',
  description: 'Real-time metrics and analytics for OpenProxy LLM requests',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f7fa;
            color: #2c3e50;
            line-height: 1.6;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}

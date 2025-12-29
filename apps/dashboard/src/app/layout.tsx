'use client';

import { useState } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/providers/theme-provider';
import { QueryProvider } from '@/providers/query-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>DEBT-OS | Technical Debt Dashboard</title>
        <meta
          name="description"
          content="AI-powered technical debt detection, prioritization, and remediation planning"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <div className="relative min-h-screen bg-background">
              {/* Sidebar */}
              <Sidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
              />

              {/* Main content */}
              <div className="md:pl-64">
                <Header onMenuClick={() => setSidebarOpen(true)} />
                <main className="p-4 md:p-6">{children}</main>
              </div>
            </div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

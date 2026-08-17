import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/hooks/useAuth';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'DieselControl — Gestão de Combustível',
    template: '%s | DieselControl',
  },
  description:
    'Sistema profissional de controle de abastecimentos, despesas com combustível e análise de consumo de frota.',
  keywords: ['diesel', 'combustível', 'frota', 'abastecimento', 'gestão'],
  authors: [{ name: 'DieselControl' }],
  openGraph: {
    title: 'DieselControl',
    description: 'Gestão inteligente de combustível para frotas',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              toastOptions={{
                style: {
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

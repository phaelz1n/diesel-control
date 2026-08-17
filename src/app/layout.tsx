import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/hooks/useAuth';
import { Toaster } from 'sonner';

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
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              style: {
                background: '#111827',
                border: '1px solid #1f2d4a',
                color: '#f1f5f9',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}

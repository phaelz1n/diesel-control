'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Fuel, Car, MapPin, DollarSign, FileText,
  BarChart3, Bell, Settings, Users, ScrollText, LogOut,
  ChevronLeft, ChevronRight, Upload, X, Menu, Sun, Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { toast } from 'sonner';

// ============================================================
// NAV ITEMS
// ============================================================
const NAV_MAIN = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/abastecimentos', label: 'Abastecimentos', icon: Fuel },
  { href: '/veiculos', label: 'Veículos', icon: Car },
  { href: '/postos', label: 'Postos', icon: MapPin },
  { href: '/gastos-mensais', label: 'Gastos Mensais', icon: DollarSign },
  { href: '/vibra', label: 'Vibra', icon: FileText },
];

const NAV_ANALYTICS = [
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/alertas', label: 'Alertas', icon: Bell, adminRequired: false },
];

const NAV_ADMIN = [
  { href: '/admin/usuarios', label: 'Usuários', icon: Users },
  { href: '/admin/importacao', label: 'Importação', icon: Upload },
  { href: '/admin/logs', label: 'Logs', icon: ScrollText },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];

// ============================================================
// SIDEBAR COMPONENT
// ============================================================
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void;
  mobile?: boolean;
}

function Sidebar({ collapsed, onToggle, onClose, mobile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { isAdmin } = usePermissions();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sessão encerrada');
    router.replace('/login');
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const NavItem = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: React.ElementType;
  }) => (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        'nav-item group',
        isActive(href) && 'active'
      )}
      title={collapsed && !mobile ? label : undefined}
    >
      <Icon
        size={18}
        className="shrink-0 transition-transform group-hover:scale-110"
      />
      {(!collapsed || mobile) && (
        <span className="truncate animate-fade-in">{label}</span>
      )}
    </Link>
  );

  return (
    <aside
      className={cn(
        'flex flex-col h-full transition-all duration-300 ease-in-out',
        'border-r',
        collapsed && !mobile ? 'w-16' : 'w-64',
      )}
      style={{
        background: 'var(--bg-sidebar)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b',
          collapsed && !mobile ? 'justify-center' : 'justify-between',
        )}
        style={{ borderColor: 'var(--border)' }}
      >
        {(!collapsed || mobile) && (
          <Link href="/dashboard" className="flex items-center group relative h-10 w-36 ml-2">
            <Image
              src="/logo-white.png"
              alt="Logo Trans Pinho"
              fill
              sizes="144px"
              className="object-contain object-left hidden dark:block"
              priority
            />
            <Image
              src="/logo-colored.png"
              alt="Logo Trans Pinho"
              fill
              sizes="144px"
              className="object-contain object-left block dark:hidden"
              priority
            />
          </Link>
        )}
        {collapsed && !mobile && (
          <Link href="/dashboard" className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center hover:scale-110 transition-transform">
            <Fuel size={16} className="text-white" />
          </Link>
        )}
        {mobile ? (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        ) : (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Main */}
        <div className="space-y-0.5">
          {(!collapsed || mobile) && (
            <p className="text-xs font-semibold uppercase tracking-wider px-3 py-2" style={{ color: 'var(--text-muted)' }}>
              Principal
            </p>
          )}
          {NAV_MAIN.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        {/* Analytics */}
        <div className="space-y-0.5 pt-2">
          {(!collapsed || mobile) && (
            <p className="text-xs font-semibold uppercase tracking-wider px-3 py-2" style={{ color: 'var(--text-muted)' }}>
              Análises
            </p>
          )}
          {NAV_ANALYTICS.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        {/* Admin */}
        {isAdmin && (
          <div className="space-y-0.5 pt-2">
            {(!collapsed || mobile) && (
              <p className="text-xs font-semibold uppercase tracking-wider px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                Administração
              </p>
            )}
            {NAV_ADMIN.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        )}
      </nav>

      {/* User + Sign Out */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        {(!collapsed || mobile) && profile && (
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-xl mb-2"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{profile.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{profile.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className={cn(
            'nav-item w-full hover:text-red-400',
            collapsed && !mobile && 'justify-center px-0',
          )}
          title={collapsed && !mobile ? 'Sair' : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {(!collapsed || mobile) && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}

// ============================================================
// HEADER
// ============================================================
function Header({ onMobileMenuOpen }: { onMobileMenuOpen: () => void }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header
      className="h-16 flex items-center justify-between px-4 lg:px-6 border-b shrink-0"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden p-2 rounded-xl hover:bg-white/5 transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <Menu size={20} />
      </button>
      <div className="flex-1 lg:flex-none" />
      <div className="flex items-center gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        )}
        <span
          className="text-xs px-2.5 py-1 rounded-lg"
          style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          v1.0
        </span>
      </div>
    </header>
  );
}

// ============================================================
// DASHBOARD LAYOUT
// ============================================================
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse">
            <Fuel size={20} className="text-white" />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex w-64 max-w-[80vw]">
            <Sidebar
              collapsed={false}
              onToggle={() => {}}
              onClose={() => setMobileOpen(false)}
              mobile
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

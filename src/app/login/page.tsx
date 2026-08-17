'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Fuel, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { loginSchema, LoginFormData } from '@/lib/validations';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      toast.success('Login realizado com sucesso!');
      router.replace('/dashboard');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('root', { message: 'E-mail ou senha incorretos.' });
      } else if (code === 'auth/user-disabled') {
        setError('root', { message: 'Usuário desativado. Contate o administrador.' });
      } else if (code === 'auth/too-many-requests') {
        setError('root', { message: 'Muitas tentativas. Tente novamente em alguns minutos.' });
      } else {
        setError('root', { message: 'Erro ao fazer login. Verifique sua conexão.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Left Panel — Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d1b3e 0%, #0f2660 50%, #0a1a4e 100%)' }}
      >
        {/* Background decoration */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, #3b82f6 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, #8b5cf6 0%, transparent 40%)`,
          }}
        />
        <div className="absolute inset-0" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%233b82f6\' fill-opacity=\'0.03\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'2\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Fuel size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">DieselControl</span>
          </div>

          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Gestão inteligente<br />
              <span className="gradient-text">de combustível</span>
            </h1>
            <p className="text-blue-200/70 text-lg leading-relaxed max-w-md">
              Controle abastecimentos, analise consumo da frota e tome decisões baseadas em dados reais.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { value: '432', label: 'Abastecimentos/mês' },
            { value: '27k L', label: 'Litros controlados' },
            { value: 'R$ 152k', label: 'Gastos monitorados' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-4 text-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-blue-200/60 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Fuel size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>DieselControl</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Bem-vindo de volta
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Entre com suas credenciais para acessar o sistema.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Root Error */}
            {errors.root && (
              <div
                className="flex items-center gap-3 rounded-xl p-4"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <AlertCircle size={18} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{errors.root.message}</p>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                E-mail
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all outline-none focus:ring-2"
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${errors.email ? '#ef4444' : 'var(--border)'}`,
                    color: 'var(--text-primary)',
                    '--tw-ring-color': 'var(--ring)',
                  } as React.CSSProperties}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Senha
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-3 rounded-xl text-sm transition-all outline-none focus:ring-2"
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${errors.password ? '#ef4444' : 'var(--border)'}`,
                    color: 'var(--text-primary)',
                  } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded transition-colors hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 relative overflow-hidden"
              style={{
                background: isLoading
                  ? 'rgba(37,99,235,0.5)'
                  : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                boxShadow: isLoading ? 'none' : '0 4px 20px rgba(37,99,235,0.4)',
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Sistema restrito. Solicite acesso ao administrador.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Fuel, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen w-full flex bg-[var(--bg-primary)]">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#0a1a4e] via-[#0f2660] to-[#0d1b3e]" style={{ padding: '3.5rem' }}>
        
        {/* Background ambient light decorations */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 rounded-full blur-[120px]" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0V0zm1 1h38v38H1V1z\' fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
        }} />

        {/* Top Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Fuel size={24} className="text-white" />
          </div>
          <span className="text-2xl font-extrabold text-white tracking-tight">DieselControl</span>
        </div>

        {/* Middle Value Prop */}
        <div className="relative z-10 flex flex-col gap-6 max-w-xl my-auto">
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight">
            Gestão inteligente <br className="hidden xl:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              de combustível
            </span>
          </h1>
          <p className="text-blue-100/80 text-lg xl:text-xl leading-relaxed">
            Controle abastecimentos, analise o consumo da sua frota em tempo real e tome decisões estratégicas baseadas em dados precisos.
          </p>
        </div>

        {/* Bottom Stats Grid */}
        <div className="relative z-10 grid grid-cols-3 gap-4 xl:gap-6 mt-12">
          {[
            { value: '432', label: 'Abastecimentos/mês' },
            { value: '27k L', label: 'Litros controlados' },
            { value: 'R$ 152k', label: 'Gastos monitorados' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-4 xl:p-5 flex flex-col items-center justify-center text-center bg-white/5 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10"
            >
              <div className="text-2xl xl:text-3xl font-black text-white tracking-tight">{stat.value}</div>
              <div className="text-xs xl:text-sm text-blue-200 mt-2 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[420px] flex flex-col animate-fade-in">
          
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-12 lg:hidden self-center">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
              <Fuel size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-[var(--text-primary)]">DieselControl</span>
          </div>

          <div className="flex flex-col gap-2 mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Bem-vindo de volta
            </h2>
            <p className="text-[var(--text-secondary)] text-base">
              Entre com suas credenciais para acessar o sistema.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
            {/* Root Error */}
            {errors.root && (
              <div className="flex items-start gap-3 rounded-xl p-4 bg-red-500/10 border border-red-500/20">
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-500">{errors.root.message}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--text-secondary)] ml-1">
                E-mail
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-[var(--text-muted)]">
                  <Mail size={18} />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="w-full h-14 pr-4 rounded-xl text-sm outline-none transition-all duration-200 border bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 hover:border-[var(--text-muted)]"
                  style={{ borderColor: errors.email ? '#ef4444' : 'var(--border)', paddingLeft: '3rem' }}
                />
              </div>
              {errors.email && (
                <p className="text-xs font-medium text-red-500 ml-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--text-secondary)] ml-1">
                Senha
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-[var(--text-muted)]">
                  <Lock size={18} />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-14 pr-12 rounded-xl text-sm outline-none transition-all duration-200 border bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 hover:border-[var(--text-muted)]"
                  style={{ borderColor: errors.password ? '#ef4444' : 'var(--border)', paddingLeft: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-red-500 ml-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-4 group w-full h-14 flex items-center justify-center gap-2 rounded-xl text-base font-bold text-white transition-all duration-300 relative overflow-hidden bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Acessar plataforma</span>
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-xs text-[var(--text-muted)] font-medium">
              Acesso restrito. Em caso de dúvidas, <br className="sm:hidden" /> solicite acesso ao administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

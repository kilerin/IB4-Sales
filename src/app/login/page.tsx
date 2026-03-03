'use client';

import { signIn } from 'next-auth/react';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        login,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError('Неверный логин или пароль');
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 p-8 rounded-xl border border-slate-700 w-full max-w-[320px]"
      >
        <h1 className="text-xl font-semibold text-amber-300 mb-2">IB4 Sales Dashboard</h1>
        <p className="text-slate-400 text-sm mb-6">Войдите в систему</p>
        <input
          type="text"
          placeholder="Логин"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoComplete="username"
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mb-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mb-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-medium transition-colors"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Загрузка...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

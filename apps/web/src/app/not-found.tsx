import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-950 text-white p-4">
      <h1 className="text-6xl font-black text-indigo-400 mb-2">404</h1>
      <p className="text-lg text-slate-400 mb-6">Página não encontrada</p>
      <Link
        href="/dashboard"
        className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-semibold transition-colors"
      >
        Voltar ao Painel
      </Link>
    </div>
  );
}

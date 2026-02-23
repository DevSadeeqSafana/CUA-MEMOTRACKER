'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ArrowRight, ShieldCheck, GraduationCap, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials. Please contact the ICT department if the issue persists.');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('A system error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex font-sans">
      {/* Left Side: Illustration/Text */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-16 flex-col justify-between text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a365d] via-[#2c5282] to-[#2b6cb0] opacity-90" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl">
            <Image src="/CUALogo.png" alt="CUA Logo" width={50} height={50} className="object-contain" />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Cosmopolitan University</h1>
            <p className="text-xs uppercase tracking-[0.2em] opacity-80 font-semibold">Abuja, Nigeria</p>
          </div>
        </div>

        <div className="relative z-10 space-y-8 max-w-xl">
          <div className="space-y-4">
            <span className="inline-block px-4 py-1 rounded-full bg-white/10 text-xs font-bold uppercase tracking-wider border border-white/20 backdrop-blur-md">
              Institutional Portal
            </span>
            <h2 className="text-6xl font-extrabold tracking-tight leading-[1.1] font-outfit">
              Internal Memo <br />
              <span className="text-blue-300">Tracker System</span>
            </h2>
          </div>
          <p className="text-xl opacity-80 leading-relaxed font-medium max-w-md">
            Streamlining administrative communication across Cosmopolitan University Abuja with secure, traceable, and digital workflows.
          </p>

          <div className="grid grid-cols-2 gap-6 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                <ShieldCheck size={20} />
              </div>
              <span className="text-sm font-semibold">Secure Protocols</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                <GraduationCap size={20} />
              </div>
              <span className="text-sm font-semibold">Academic Excellence</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs opacity-60 flex items-center gap-4 font-medium">
          <span>&copy; 2026 Cosmopolitan University Abuja</span>
          <span className="w-1 h-1 bg-white/40 rounded-full"></span>
          <span>ICT Infrastructure Division</span>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12 bg-slate-50">
        <div className="w-full max-w-md space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 text-slate-900">
          <div className="text-center lg:text-left space-y-6">
            <div className="flex justify-center lg:justify-start">
              <div className="bg-white p-4 rounded-[2rem] shadow-xl shadow-blue-900/10 border border-slate-100">
                <Image src="/CUALogo.png" alt="CUA Logo" width={80} height={80} />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-5xl font-black tracking-tight text-[#1a365d] font-outfit">Staff Sign In</h1>
              <p className="text-slate-500 font-medium text-lg leading-relaxed">Enter your university credentials to access the internal portal.</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3 text-sm animate-in shake-in shadow-sm font-bold">
              <AlertCircle size={20} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 ml-1" htmlFor="email">
                  University Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-[#1a365d] shadow-sm placeholder:text-slate-300 placeholder:font-normal"
                  placeholder="name@cosmopolitan.edu.ng"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 ml-1" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-[#1a365d] shadow-sm placeholder:text-slate-300 placeholder:font-normal"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
                <span className="text-slate-500 font-bold group-hover:text-slate-700">Remember session</span>
              </label>
              <button type="button" className="font-black text-blue-600 hover:text-[#1a365d] transition-colors uppercase tracking-widest text-[11px]">
                Reset Password
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full bg-[#1a365d] text-white py-5 rounded-2xl font-black text-lg shadow-2xl shadow-blue-900/20 hover:bg-[#2c5282] hover:-translate-y-1 transition-all items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0 uppercase tracking-widest"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  Enter Portal
                  <ArrowRight size={22} className="opacity-70" />
                </>
              )}
            </button>
          </form>

          <div className="pt-10 text-center border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] leading-relaxed max-w-[300px] mx-auto">
              Institutional access monitored by ICT Infrastructure Division.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

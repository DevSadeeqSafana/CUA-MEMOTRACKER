'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

export default function LoginPage() {
  const router = useRouter();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error('Failed to retrieve credentials from Google.');
      return;
    }

    try {
      const result = await signIn('credentials', {
        googleToken: credentialResponse.credential,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Google Sign-In failed. Ensure you are using your active @cosmopolitan.edu.ng staff account.');
      } else {
        toast.success('Successfully authenticated via Google SSO!');
        router.push('/dashboard');
      }
    } catch {
      toast.error('An error occurred during Google Sign-In.');
    }
  };

  const handleGoogleError = () => {
    toast.error('Google Sign-In was cancelled or failed.');
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-5 sm:p-8 lg:p-12 bg-slate-50">
        <div className="w-full max-w-md space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 text-slate-900">
          <div className="text-center lg:text-left space-y-6">
            <div className="flex justify-center lg:justify-start">
              <div className="bg-white p-4 rounded-[2rem] shadow-xl shadow-blue-900/10 border border-slate-100">
                <Image src="/CUALogo.png" alt="CUA Logo" width={80} height={80} />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#1a365d] font-outfit">Staff Sign In</h1>
              <p className="text-slate-500 font-medium text-sm md:text-lg leading-relaxed">Sign in with Google.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-full flex justify-center [&>div]:w-full font-bold">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="outline"
                  shape="pill"
                  size="large"
                  text="continue_with"
                  logo_alignment="left"
                />
              </div>
              <p className="text-[11px] text-slate-400 font-semibold tracking-wide text-center">
                Institutional login restricted to <span className="text-[#1a365d] font-bold">@cosmopolitan.edu.ng</span>
              </p>
            </div>
          </div>

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

'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CircleHelp, Lock, MessageSquareText, ShieldCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="w-9 h-9 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

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
    <div className="min-h-screen flex items-center justify-center p-0 sm:p-6 lg:p-10 font-sans bg-[radial-gradient(ellipse_at_top_left,#8fb4e0_0%,#c9dcf0_35%,#eaf1f9_70%,#f4f7fb_100%)]">
      <div className="w-full max-w-[1480px] min-h-screen sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-5rem)] flex bg-white sm:rounded-3xl overflow-hidden shadow-2xl shadow-[#0b2a5b]/20">
        {/* Left: brand panel */}
        <div className="hidden lg:flex lg:w-[54%] relative flex-col justify-between px-16 xl:px-24 py-20 text-white overflow-hidden bg-[linear-gradient(115deg,#082352_0%,#0d3470_45%,#1a5aa6_80%,#2a6fbf_100%)]">
          {/* Soft glow and arc */}
          <div className="pointer-events-none absolute -right-[10%] top-[20%] w-[60%] h-[55%] bg-[#6fa6e0]/35 blur-[120px] rounded-full" />
          <div className="pointer-events-none absolute -left-[35%] -top-[10%] w-[115%] aspect-square rounded-full border border-white/20" />

          <div className="relative z-10 flex items-center gap-5">
            <div className="w-[108px] h-[108px] rounded-full p-1 bg-[#e3ac3a] shadow-lg shadow-black/30">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#0d2a5c]">
                <Image src="/CUALogo.png" alt="Cosmopolitan University seal" width={108} height={108} className="w-full h-full object-cover" priority />
              </div>
            </div>
            <div>
              <p className="font-display text-[2rem] leading-[1.1]">
                Cosmopolitan
                <br />
                University
              </p>
              <p className="mt-3 text-sm font-medium uppercase tracking-[0.3em] text-white/85">Abuja, Nigeria</p>
            </div>
          </div>

          <div className="relative z-10 space-y-12">
            <h2 className="font-display text-6xl xl:text-7xl 2xl:text-[5.5rem] font-normal leading-[0.95] tracking-tight">
              Internal
              <br />
              Memo <span className="text-[#a9d4f5]">System</span>
            </h2>

            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full border border-white/25 bg-white/5 flex items-center justify-center">
                  <MessageSquareText size={24} strokeWidth={1.5} />
                </div>
                <span className="text-[15px] leading-snug text-white/90">
                  Efficient
                  <br />
                  communication
                </span>
              </div>
              <div className="w-px h-14 bg-white/25" />
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full border border-white/25 bg-white/5 flex items-center justify-center">
                  <Users size={24} strokeWidth={1.5} />
                </div>
                <span className="text-[15px] leading-snug text-white/90">
                  Improved
                  <br />
                  collaboration
                </span>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-sm text-white/85">&copy; 2026 Cosmopolitan University Abuja</p>
        </div>

        {/* Right: sign-in. Below lg this becomes the whole screen, in the dark branded style. */}
        <div className="w-full lg:w-[46%] relative flex flex-col overflow-hidden px-6 sm:px-12 xl:px-20 pt-6 pb-8 lg:py-8 max-lg:text-white max-lg:bg-[linear-gradient(160deg,#0a2a5e_0%,#0d3470_45%,#0a2a5e_100%)]">
          <div className="lg:hidden pointer-events-none absolute -right-[30%] top-[18%] w-[80%] h-[40%] bg-[#6fa6e0]/30 blur-[90px] rounded-full" />
          <div className="lg:hidden pointer-events-none absolute -left-[60%] -top-[8%] w-[160%] aspect-square rounded-full border border-white/15" />

          <div className="relative z-10 flex justify-end">
            <a
              href="/CUAMemoTracker_User_Manual.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 text-sm font-medium text-white lg:text-[#0b2a5b] hover:text-[#a9d4f5] lg:hover:text-[#1a5aa6] transition-colors"
            >
              <CircleHelp size={26} strokeWidth={1.5} className="max-lg:text-[#a9d4f5]" />
              Need help?
            </a>
          </div>

          <div className="relative z-10 flex-1 flex lg:items-center">
            <div className="w-full max-w-[460px] mx-auto lg:mx-0 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Brand header and headline for small screens (the left panel is hidden there) */}
              <div className="lg:hidden mt-4 flex items-center gap-4">
                <div className="w-[84px] h-[84px] shrink-0 rounded-full p-[3px] bg-[#e3ac3a] shadow-lg shadow-black/30">
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#0d2a5c]">
                    <Image src="/CUALogo.png" alt="Cosmopolitan University seal" width={84} height={84} className="w-full h-full object-cover" priority />
                  </div>
                </div>
                <div>
                  <p className="font-display text-2xl leading-[1.1]">
                    Cosmopolitan
                    <br />
                    University
                  </p>
                  <p className="mt-2.5 text-xs font-medium uppercase tracking-[0.25em] text-white/80">Abuja, Nigeria</p>
                </div>
              </div>
              <p className="font-display lg:hidden mt-12 text-[2.75rem] sm:text-6xl leading-[0.95] tracking-tight">
                Internal
                <br />
                Memo <span className="text-[#a9d4f5]">System</span>
              </p>

              <h1 className="font-display max-lg:mt-14 text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-white lg:text-[#0b2a5b]">
                Sign In
              </h1>
              <p className="mt-3 lg:mt-6 text-base lg:text-lg leading-relaxed text-white/85 lg:text-[#4f6a8f]">
                Get access to the memo system with your institutional Google account.
              </p>

              {/*
                The auth backend verifies a Google ID token, which only <GoogleLogin> issues.
                Its real button is overlaid invisibly (scaled to cover) on top of our styled one,
                so clicks and keyboard focus land on Google's iframe.
              */}
              <div className="group relative mt-6 lg:mt-10 h-16 lg:h-[72px] rounded-xl border border-slate-200 max-lg:border-white/0 bg-white shadow-sm max-lg:shadow-lg max-lg:shadow-black/20 transition-all hover:border-[#1a5aa6]/40 hover:shadow-md focus-within:ring-2 focus-within:ring-[#1a5aa6]/40 max-lg:focus-within:ring-white/60">
                <div className="flex h-full items-center gap-4 lg:gap-5 px-5 lg:px-6" aria-hidden="true">
                  <GoogleMark />
                  <span className="flex-1 text-base lg:text-[17px] font-semibold text-[#0b2a5b]">Continue with Google</span>
                  <ArrowRight size={22} className="text-[#0b2a5b] transition-transform group-hover:translate-x-1" />
                </div>
                <div className="absolute inset-0 overflow-hidden rounded-xl opacity-0">
                  <div className="flex h-full w-full items-center justify-center scale-[2.5]">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      size="large"
                      width="400"
                      text="continue_with"
                    />
                  </div>
                </div>
              </div>

              {/* Mobile: translucent tile with a divider; desktop: row under a rule */}
              <div className="mt-4 lg:mt-9 flex items-center gap-4 lg:gap-5 max-lg:rounded-xl max-lg:border max-lg:border-white/15 max-lg:bg-white/5 max-lg:px-5 max-lg:py-4 lg:border-t lg:border-slate-200 lg:pt-7">
                <div className="lg:w-16 lg:h-16 shrink-0 lg:rounded-full lg:bg-slate-100 flex items-center justify-center text-white/85 lg:text-[#0b2a5b] max-lg:px-2">
                  <Lock size={24} fill="currentColor" strokeWidth={1.5} className="[&>path]:fill-none" />
                </div>
                <div className="lg:hidden w-px self-stretch bg-white/20" />
                <p className="text-sm lg:text-base leading-relaxed text-white/85 lg:text-[#4f6a8f]">
                  Only <span className="font-semibold text-white lg:text-[#0b2a5b]">@cosmopolitan.edu.ng</span> accounts are allowed.
                </p>
              </div>

              <div className="mt-6 lg:mt-8 border-t border-white/20 lg:border-slate-200 pt-6 lg:pt-8 flex items-start max-lg:justify-center gap-4 lg:gap-5">
                <ShieldCheck size={28} strokeWidth={1.5} className="shrink-0 text-[#a9d4f5] lg:text-[#0b2a5b] lg:mx-[1.125rem]" />
                <p className="text-xs font-medium uppercase tracking-[0.2em] leading-relaxed text-[#a9d4f5]/90 lg:text-[#4f6a8f]">
                  Access monitored by
                  <br className="lg:hidden" /> ICT Infrastructure Division.
                </p>
              </div>

              <p className="lg:hidden mt-5 text-center text-xs text-white/70">&copy; 2026 Cosmopolitan University Abuja</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

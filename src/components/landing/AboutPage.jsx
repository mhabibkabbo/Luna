import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, Compass, Globe2, Users, ChevronDown, Sparkles, Rocket, Layers, Linkedin } from 'lucide-react';
import PublicPageHeader from '../common/PublicPageHeader.jsx';
import { LunaStencilWordmark } from '../common/LunaBrandLogo.jsx';

/**
 * Team photos live in /public/team/ and are served at /team/<file>.
 * Each member lists candidate filenames; the first one that loads is used.
 * Filenames are case-sensitive in production, so match them exactly.
 */
const BASE = import.meta.env.BASE_URL || '/';
const teamPhoto = (file) => `${BASE}team/${file}`;

const team = [
  {
    id: 'kabbo',
    name: 'Mishkatul Habib Kabbo',
    affiliation: 'Undergrad Student, CSE, BUET',
    role: 'UI/UX & Frontend Architecture',
    linkedin: 'https://www.linkedin.com/in/mishkatul-habib-17727839b/',
    isLinkedinPlaceholder: false,
    photos: [teamPhoto('Kabbo.jpg'), teamPhoto('kabbo.png')],
    colors: ['#0E7490', '#22D3EE'],
  },
  {
    id: 'nahid',
    name: 'Nahid Iqbal',
    affiliation: 'Undergrad Student, CSE, BUET',
    role: 'Presenter & Video Direction',
    linkedin: 'https://www.linkedin.com/in/nahidiiqbal/',
    isLinkedinPlaceholder: false,
    photos: [teamPhoto('Nahid.jpg'), teamPhoto('nahid.png')],
    colors: ['#047857', '#34D399'],
  },
  {
    id: 'rafid',
    name: 'Rafid Muammar',
    affiliation: 'Undergrad Student, CSE, BUET',
    role: 'Data Systems & Geodesy',
    linkedin: 'https://www.linkedin.com/in/rafid-m-08460b429/',
    isLinkedinPlaceholder: false,
    photos: [teamPhoto('Rafid.jpg')],
    colors: ['#4338CA', '#818CF8'],
  },
  {
    id: 'rifat',
    name: 'Yeasin Anzam Rifat',
    affiliation: 'Undergrad Student, CSE, BUET',
    role: 'Graphics & Engine Builder',
    linkedin: 'https://www.linkedin.com/in/yarifat/',
    isLinkedinPlaceholder: false,
    photos: [teamPhoto('Rifat.png'), teamPhoto('rifat.jpg')],
    colors: ['#B45309', '#FBBF24'],
  },
];

function PlaceholderPortrait({ name, colors }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('');
  const gradientId = `portrait-${initials}`;

  return (
    <svg
      role="img"
      aria-label={`${name} placeholder portrait`}
      viewBox="0 0 160 160"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <rect width="160" height="160" fill={`url(#${gradientId})`} />
      <circle cx="80" cy="61" r="29" fill="#94A3B8" fillOpacity="0.35" />
      <path d="M25 160c3-39 24-59 55-59s52 20 55 59" fill="#94A3B8" fillOpacity="0.35" />
      <text
        x="80"
        y="145"
        fill="#F8FAFC"
        fontFamily="sans-serif"
        fontSize="15"
        fontWeight="600"
        textAnchor="middle"
      >
        {initials}
      </text>
    </svg>
  );
}

function TeamMemberPortrait({ member }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const activePhotoSrc = member.photos[photoIndex] || null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {activePhotoSrc ? (
        <img
          key={activePhotoSrc}
          src={activePhotoSrc}
          alt={member.name}
          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          onError={() => setPhotoIndex((i) => i + 1)}
        />
      ) : (
        <PlaceholderPortrait name={member.name} colors={member.colors} />
      )}
    </div>
  );
}

function ScrollReveal({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const getTransformClasses = () => {
    if (isVisible) return 'opacity-100 translate-y-0 translate-x-0 scale-100';
    switch (direction) {
      case 'left':
        return 'opacity-0 -translate-x-10 scale-[0.98]';
      case 'right':
        return 'opacity-0 translate-x-10 scale-[0.98]';
      case 'up':
      default:
        return 'opacity-0 translate-y-12 scale-[0.98]';
    }
  };

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
      }}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${getTransformClasses()} ${className}`}
    >
      {children}
    </div>
  );
}

export default function AboutPage({ onLaunchExplorer, onNavigate }) {
  const scrollContainerRef = useRef(null);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#050507] text-[#F8FAFC]">
      <PublicPageHeader
        currentPage="about"
        onLaunchExplorer={onLaunchExplorer}
        onNavigate={onNavigate}
        showLogo={false}
      />

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto font-sans scroll-smooth">
        <section
          aria-label="About Luna Hero"
          className="relative isolate min-h-[76vh] flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 overflow-hidden"
        >
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              background:
                'radial-gradient(ellipse 65% 55% at 50% 42%, rgba(56, 189, 248, 0.12) 0%, rgba(14, 165, 233, 0.04) 45%, rgba(5, 5, 7, 0) 75%)',
            }}
          />

          <div className="relative z-10 inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.04] px-4 py-1.5 text-[11px] font-mono font-medium tracking-[0.16em] uppercase text-cyan-300 backdrop-blur-md mb-8 animate-in fade-in slide-in-from-top-3 duration-700">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>NASA Space Apps Challenge 2026</span>
          </div>

          <div className="relative my-4 flex items-center justify-center animate-in fade-in zoom-in-95 duration-1000">
            <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-cyan-500/20 via-white/10 to-emerald-500/20 rounded-full scale-110 pointer-events-none" />
            <LunaStencilWordmark
              className="relative w-[82vw] max-w-[620px] h-auto fill-white drop-shadow-[0_0_45px_rgba(255,255,255,0.22)] transition-transform duration-500 hover:scale-[1.02]"
            />
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-semibold tracking-[-0.03em] text-white mt-8 max-w-3xl leading-[1.08] animate-in fade-in slide-in-from-bottom-3 duration-800 delay-150">
            Lunar exploration, made navigable.
          </h1>

          <p className="text-base sm:text-lg lg:text-xl font-sans text-[#8E95A5] max-w-2xl leading-relaxed mt-5 animate-in fade-in slide-in-from-bottom-4 duration-800 delay-300">
            Luna is a team-built exploration platform that synthesizes NASA LOLA topography,
            polar terrain metrics, CLPS commercial landers, and direct-to-Earth telemetry into an
            approachable interactive browser.
          </p>

          <div className="mt-14 flex flex-col items-center gap-2 text-slate-500 animate-bounce pointer-events-none">
            <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
              Scroll to explore
            </span>
            <ChevronDown className="w-4 h-4 text-cyan-400" />
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-20 px-6 pb-24 sm:px-10">
          <section className="grid md:grid-cols-2 gap-6">
            <ScrollReveal direction="left" delay={50}>
              <article className="h-full rounded-2xl border border-white/[0.08] bg-[#0C0D12]/90 backdrop-blur-md p-6 sm:p-8 hover:border-cyan-500/30 transition-colors shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-3 text-cyan-300">
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <Compass className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h2 className="text-xs font-sans font-semibold uppercase tracking-[0.14em]">
                    The Challenge
                  </h2>
                </div>
                <h3 className="text-2xl font-display font-semibold tracking-[-0.02em] text-white mt-5">
                  NASA Space Apps Challenge
                </h3>
                <p className="text-sm font-sans text-[#8E95A5] leading-relaxed mt-3">
                  <strong className="text-[#E2E8F0] font-medium">Lunar Landing Site Navigator</strong> is our
                  direct answer to the challenge: an evidence-based tool to navigate the Moon,
                  evaluate candidate landing sites against slope and shadow hazards, and track commercial payloads.
                </p>
              </article>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={150}>
              <article className="h-full rounded-2xl border border-white/[0.08] bg-[#0C0D12]/90 backdrop-blur-md p-6 sm:p-8 hover:border-emerald-500/30 transition-colors shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-3 text-emerald-300">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <Users className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h2 className="text-xs font-sans font-semibold uppercase tracking-[0.14em]">
                    The Team
                  </h2>
                </div>
                <h3 className="text-2xl font-display font-semibold tracking-[-0.02em] text-white mt-5">
                  Multidisciplinary Synergy
                </h3>
                <p className="text-sm font-sans text-[#8E95A5] leading-relaxed mt-3">
                  We united research, orbital mechanics, web graphics, GIS engineering, and video storytelling
                  to turn complex lunar telemetry into an intuitive, high-performance experience.
                </p>
              </article>
            </ScrollReveal>
          </section>

          <section>
            <ScrollReveal delay={50}>
              <div className="mb-8">
                <span className="inline-block rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1 text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-[#CBD5E1]">
                  Creators & Engineers
                </span>
                <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-[-0.025em] text-white mt-3">
                  Meet the team
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {team.map((member, i) => (
                <ScrollReveal key={member.id} delay={i * 120 + 80} className="h-full">
                  <article className="group h-full flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0C0D12]/90 backdrop-blur-md hover:border-white/30 hover:shadow-[0_12px_35px_rgba(0,0,0,0.6)] transition-all duration-300">
                    <div className="aspect-square overflow-hidden border-b border-white/[0.06]">
                      <TeamMemberPortrait member={member} />
                    </div>
                    <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-display font-semibold text-white group-hover:text-cyan-300 transition-colors">
                          {member.name}
                        </h3>
                        <p className="mt-1 text-[11.5px] font-sans font-medium text-cyan-300/90 leading-snug">
                          {member.affiliation}
                        </p>
                        <p className="mt-1 text-xs font-sans leading-relaxed text-[#8E95A5]">
                          {member.role}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-white/[0.06]">
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${member.name} LinkedIn Profile`}
                          className="inline-flex items-center gap-1.5 rounded text-[11px] font-sans font-medium text-[#CBD5E1] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                        >
                          <Linkedin className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                          <span>{member.isLinkedinPlaceholder ? 'LinkedIn (Placeholder)' : 'LinkedIn Profile'}</span>
                          <ArrowUpRight className="w-3 h-3 text-[#8E95A5] shrink-0" />
                        </a>
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </section>

          <ScrollReveal delay={100}>
            <section className="rounded-2xl border border-white/[0.08] bg-[#0C0D12]/90 backdrop-blur-md p-6 sm:p-10 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
              <div className="flex items-center gap-3 text-white/80">
                <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.1]">
                  <Globe2 className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xs font-sans font-semibold uppercase tracking-[0.14em]">
                  Platform Capabilities
                </h2>
              </div>

              <div className="grid sm:grid-cols-3 gap-6 mt-8">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-cyan-500/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-display font-semibold text-white">Planetary GIS</h3>
                  </div>
                  <p className="text-xs font-sans text-[#8E95A5] leading-relaxed">
                    Interactive 3D Cesium lunar globe and dedicated 2D South Polar stereographic topocartography backed by NASA LOLA DEM altimetry.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-emerald-500/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Rocket className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-display font-semibold text-white">Mission Context</h3>
                  </div>
                  <p className="text-xs font-sans text-[#8E95A5] leading-relaxed">
                    Detailed catalog of Commercial Lunar Payload Services (CLPS) missions, lunar vehicles, historic landing locations, and flight manifests.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-display font-semibold text-white">Site Decision Engine</h3>
                  </div>
                  <p className="text-xs font-sans text-[#8E95A5] leading-relaxed">
                    Multi-criteria evaluation calculating real-time solar illumination, 360° terrain horizon occlusion, and Earth DSN link margins.
                  </p>
                </div>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <a
                href="#missions"
                onClick={(e) => {
                  if (onNavigate) {
                    e.preventDefault();
                    onNavigate('missions');
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-xs font-sans font-semibold text-[#050507] hover:bg-[#E2E8F0] transition-all active:scale-95 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
              >
                <span>Browse Missions</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => onLaunchExplorer?.({ viewMode: '3d' })}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.04] px-7 py-3.5 text-xs font-sans font-medium text-white hover:bg-white/[0.1] hover:border-white/30 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
              >
                <span>Launch 3D Explorer</span>
                <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}

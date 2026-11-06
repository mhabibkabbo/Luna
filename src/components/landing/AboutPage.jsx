import React from 'react';
import { ArrowUpRight, Compass, Globe2, Users } from 'lucide-react';
import PublicPageHeader from '../common/PublicPageHeader.jsx';

const team = [
  { name: 'Mishkatul Habib Kabbo', role: 'Presenter & Video Person', colors: ['#0E7490', '#22D3EE'] },
  { name: 'Nahid Iqbal', role: 'Data Person', colors: ['#047857', '#34D399'] },
  { name: 'Rafid Muammar', role: 'Certified Nigga', colors: ['#4338CA', '#818CF8'] },
  { name: 'Yeasin Anzam Rifat', role: 'Builder', colors: ['#B45309', '#FBBF24'] },
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
      <circle cx="80" cy="61" r="29" fill="#D9E5F0" />
      <path d="M25 160c3-39 24-59 55-59s52 20 55 59" fill="#D9E5F0" />
      <text
        x="80"
        y="145"
        fill="#07111D"
        fontFamily="sans-serif"
        fontSize="16"
        fontWeight="700"
        textAnchor="middle"
      >
        {initials}
      </text>
    </svg>
  );
}

export default function AboutPage({ onLaunchExplorer, onNavigate }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#060B13] text-[#F1F5F9]">
      <PublicPageHeader currentPage="about" onLaunchExplorer={onLaunchExplorer} onNavigate={onNavigate} />

      <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-12 px-6 py-10 sm:px-10 sm:py-16">
        <section className="max-w-3xl">
          <span className="text-xs font-mono uppercase tracking-[0.22em] text-[#00D2C4]">
            About the project
          </span>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl mt-4">
            Lunar exploration, made navigable.
          </h1>
          <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed mt-6">
            Luna is a team-built lunar exploration tool that brings terrain, landing locations,
            commercial missions, and planning context together in one interactive browser.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-5">
          <article className="rounded-2xl border border-white/[0.1] bg-[#0A1220] p-6 sm:p-8">
            <div className="flex items-center gap-3 text-[#00D2C4]">
              <Compass className="w-5 h-5" />
              <h2 className="text-xs font-mono uppercase tracking-widest">Challenge</h2>
            </div>
            <h3 className="text-2xl font-semibold mt-5">NASA Space Apps Challenge</h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed mt-3">
              <strong className="text-[#F1F5F9]">Lunar Landing Site Navigator</strong> is our
              response to the NASA Space Apps Challenge: a clearer way to explore the Moon,
              compare candidate landing areas, and understand the missions headed there.
            </p>
          </article>

          <article className="rounded-2xl border border-white/[0.1] bg-[#0A1220] p-6 sm:p-8">
            <div className="flex items-center gap-3 text-[#34D399]">
              <Users className="w-5 h-5" />
              <h2 className="text-xs font-mono uppercase tracking-widest">Team</h2>
            </div>
            <h3 className="text-2xl font-semibold mt-5">A small, multidisciplinary team</h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed mt-3">
              We combine research, data, design, building, storytelling, and presentation to
              turn complex lunar information into a useful, approachable experience.
            </p>
          </article>
        </section>

        <section>
          <div className="mb-5">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#00D2C4]">
              The team
            </span>
            <h2 className="text-3xl font-semibold tracking-tight mt-2">Meet the team</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {team.map((member) => (
              <article
                key={member.name}
                className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A1220]"
              >
                <div className="aspect-square overflow-hidden">
                  <PlaceholderPortrait name={member.name} colors={member.colors} />
                </div>
                <div className="p-3 sm:p-4">
                  <h3 className="text-sm font-semibold text-[#F1F5F9]">{member.name}</h3>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#94A3B8] sm:text-xs">
                    {member.role}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.1] bg-[#0A1220] p-6 sm:p-8">
          <div className="flex items-center gap-3 text-[#00D2C4]">
            <Globe2 className="w-5 h-5" />
            <h2 className="text-xs font-mono uppercase tracking-widest">What we built</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 mt-6">
            <div>
              <h3 className="text-sm font-semibold">Planetary maps</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed mt-2">
                Explore lunar terrain in 3D and inspect the south-polar region in 2D.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Mission context</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed mt-2">
                Browse CLPS missions, landing regions, vehicles, and payloads.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Site analysis</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed mt-2">
                Review terrain, illumination, and Earth-visibility information for candidate sites.
              </p>
            </div>
          </div>
        </section>

        <a
          href="#missions"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#00D2C4] hover:text-[#34D399] transition-colors"
        >
          Browse missions <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
      </main>
    </div>
  );
}

import React from 'react';
import { ArrowUpRight, Compass, Globe2, Users } from 'lucide-react';
import PublicPageHeader from '../common/PublicPageHeader.jsx';

const team = [
  { name: 'Mishkatul Habib Kabbo', role: 'Presenter & Video Person', colors: ['#181A20', '#272A34'] },
  { name: 'Nahid Iqbal', role: 'Data Person', colors: ['#14161B', '#22252E'] },
  { name: 'Rafid Muammar', role: 'Designer', colors: ['#181A20', '#272A34'] },
  { name: 'Yeasin Anzam Rifat', role: 'Builder', colors: ['#14161B', '#22252E'] },
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

export default function AboutPage({ onLaunchExplorer, onNavigate }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#050507] text-[#F8FAFC]">
      <PublicPageHeader currentPage="about" onLaunchExplorer={onLaunchExplorer} onNavigate={onNavigate} />

      <main className="min-h-0 flex-1 overflow-y-auto font-sans">
      <div className="mx-auto max-w-5xl space-y-14 px-6 py-12 sm:px-10 sm:py-20">
        <section className="max-w-3xl">
          <span className="inline-block rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1 text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-[#CBD5E1]">
            About the project
          </span>
          <h1 className="text-4xl font-display font-semibold tracking-[-0.03em] text-white sm:text-6xl mt-5">
            Lunar exploration, made navigable.
          </h1>
          <p className="text-base sm:text-lg font-sans text-[#8E95A5] leading-relaxed mt-6">
            Luna is a team-built lunar exploration tool that brings terrain, landing locations,
            commercial missions, and planning context together in one interactive browser.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-5">
          <article className="rounded-2xl border border-white/[0.08] bg-[#0C0D12] p-6 sm:p-8">
            <div className="flex items-center gap-3 text-white/80">
              <Compass className="w-5 h-5" />
              <h2 className="text-xs font-sans font-semibold uppercase tracking-[0.14em]">Challenge</h2>
            </div>
            <h3 className="text-2xl font-display font-semibold tracking-[-0.02em] text-white mt-5">NASA Space Apps Challenge</h3>
            <p className="text-sm font-sans text-[#8E95A5] leading-relaxed mt-3">
              <strong className="text-[#E2E8F0] font-medium">Lunar Landing Site Navigator</strong> is our
              response to the NASA Space Apps Challenge: a clearer way to explore the Moon,
              compare candidate landing areas, and understand the missions headed there.
            </p>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-[#0C0D12] p-6 sm:p-8">
            <div className="flex items-center gap-3 text-white/80">
              <Users className="w-5 h-5" />
              <h2 className="text-xs font-sans font-semibold uppercase tracking-[0.14em]">Team</h2>
            </div>
            <h3 className="text-2xl font-display font-semibold tracking-[-0.02em] text-white mt-5">A small, multidisciplinary team</h3>
            <p className="text-sm font-sans text-[#8E95A5] leading-relaxed mt-3">
              We combine research, data, design, building, storytelling, and presentation to
              turn complex lunar information into a useful, approachable experience.
            </p>
          </article>
        </section>

        <section>
          <div className="mb-6">
            <span className="inline-block rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1 text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-[#CBD5E1]">
              The team
            </span>
            <h2 className="text-3xl font-display font-semibold tracking-[-0.025em] text-white mt-3">Meet the team</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {team.map((member) => (
              <article
                key={member.name}
                className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0C0D12]"
              >
                <div className="aspect-square overflow-hidden border-b border-white/[0.06]">
                  <PlaceholderPortrait name={member.name} colors={member.colors} />
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-display font-semibold text-white">{member.name}</h3>
                  <p className="mt-1 text-xs font-sans leading-relaxed text-[#8E95A5]">
                    {member.role}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0C0D12] p-6 sm:p-8">
          <div className="flex items-center gap-3 text-white/80">
            <Globe2 className="w-5 h-5" />
            <h2 className="text-xs font-sans font-semibold uppercase tracking-[0.14em]">What we built</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 mt-6">
            <div>
              <h3 className="text-sm font-display font-semibold text-white">Planetary maps</h3>
              <p className="text-xs font-sans text-[#8E95A5] leading-relaxed mt-2">
                Explore lunar terrain in 3D and inspect the south-polar region in 2D.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-display font-semibold text-white">Mission context</h3>
              <p className="text-xs font-sans text-[#8E95A5] leading-relaxed mt-2">
                Browse CLPS missions, landing regions, vehicles, and payloads.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-display font-semibold text-white">Site analysis</h3>
              <p className="text-xs font-sans text-[#8E95A5] leading-relaxed mt-2">
                Review terrain, illumination, and Earth-visibility information for candidate sites.
              </p>
            </div>
          </div>
        </section>

        <a
          href="#missions"
          className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-sans font-semibold text-[#050507] hover:bg-[#E2E8F0] transition-colors"
        >
          Browse missions <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
      </main>
    </div>
  );
}

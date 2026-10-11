import React from 'react';
import { MapPin, Rocket, Microscope, Globe, ShieldCheck, Compass } from 'lucide-react';

export default function WhatIsLunaSection() {
  const pillars = [
    {
      icon: MapPin,
      tag: 'LUNAR CARTOGRAPHY',
      title: 'Geographic Context',
      description:
        'Explore true selenographic coordinates across the Moon’s craters, maria, mountain ridges, and the shadowed South Pole. Every landing site is georeferenced with verified IAU coordinates.',
    },
    {
      icon: Rocket,
      tag: 'COMMERCIAL LANDERS',
      title: 'Mission Engineering',
      description:
        'Inspect the spacecraft built under NASA CLPS contracts—from Intuitive Machines’ Nova-C and Astrobotic’s Peregrine & Griffin to Firefly Aerospace’s Blue Ghost and Draper Laboratory’s APEX.',
    },
    {
      icon: Microscope,
      tag: 'SCIENTIFIC SUITES',
      title: 'Payload Instruments',
      description:
        'Discover the specialized NASA and commercial payloads onboard: laser retroreflectors, mass spectrometers, radio astronomy antennae, regolith plume cameras, and ice-drilling systems.',
    },
  ];

  return (
    <section id="about" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#040814] border-t border-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono tracking-wider text-cyan-400 uppercase mb-4">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>PURPOSE & VISION</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-5">
            What is Luna?
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Luna brings lunar geography and NASA Commercial Lunar Payload Services (CLPS) mission
            intelligence together in a single, interactive platform. It enables astronomers,
            engineers, educators, and space enthusiasts to discover where commercial missions are
            touching down, what scientific payloads they carry, and what phenomena they aim to
            investigate.
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-16">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="group p-6 sm:p-7 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition-all duration-300 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-cyan-950/20"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mb-5 group-hover:border-cyan-500/50 group-hover:bg-cyan-950/30 transition-colors">
                  <Icon className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="text-[10px] font-mono font-semibold tracking-wider text-cyan-400/90 uppercase mb-2">
                  {pillar.tag}
                </div>
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
                  {pillar.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CLPS Context Note Callout */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-500/25 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-1">
                Authentic NASA CLPS Data Sourcing
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                Every task order identifier, target landing latitude/longitude, status classification,
                and instrument payload record in Luna reflects official NASA and mission provider
                declarations without speculative inference.
              </p>
            </div>
          </div>
          <div className="shrink-0 self-end md:self-center">
            <span className="text-[11px] font-mono text-cyan-400/90 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
              NASA CLPS INITIATIVE
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

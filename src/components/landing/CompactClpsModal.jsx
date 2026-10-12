import React from 'react';
import { X, Rocket, ExternalLink, ArrowRight, CheckCircle2, Clock, Shield } from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

export default function CompactClpsModal({ isOpen, onClose, onLaunchExplorer }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[#050813] border border-slate-800 p-6 sm:p-8 text-left shadow-2xl shadow-cyan-950/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Eyebrow & Title */}
        <div className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase mb-2">
          NASA INITIATIVE
        </div>
        <h2 className="text-[1.5rem] font-bold text-white mb-4 tracking-tight">
          What is CLPS?
        </h2>

        {/* Narrative Description */}
        <div className="space-y-3 text-sm text-slate-300 leading-relaxed mb-6 font-normal">
          <p>
            <strong className="text-white">Commercial Lunar Payload Services (CLPS)</strong> is a
            NASA initiative that contracts American commercial aerospace companies to deliver
            scientific experiments, technology demonstrators, and robotic rovers to the lunar surface.
          </p>
          <p className="text-slate-400">
            Rather than designing, owning, and operating custom spacecraft for every mission, NASA buys
            commercial delivery services as a customer. This dramatically accelerates access to the Moon
            while supporting the Artemis campaign.
          </p>
        </div>

        {/* Key Commercial Providers */}
        <div className="mb-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2.5">
            Key CLPS Commercial Partners
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <span className="p-2 rounded bg-slate-800/60 text-slate-200 font-medium">Intuitive Machines</span>
            <span className="p-2 rounded bg-slate-800/60 text-slate-200 font-medium">Firefly Aerospace</span>
            <span className="p-2 rounded bg-slate-800/60 text-slate-200 font-medium">Astrobotic Technology</span>
            <span className="p-2 rounded bg-slate-800/60 text-slate-200 font-medium">Draper Laboratory</span>
            <span className="p-2 rounded bg-slate-800/60 text-slate-200 font-medium">Blue Origin</span>
            <span className="p-2 rounded bg-slate-800/60 text-slate-200 font-medium">NASA SMD</span>
          </div>
        </div>

        {/* Active Task Orders Snapshot */}
        <div className="mb-6">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-3">
            Featured Task Orders in Luna
          </div>
          <div className="space-y-2">
            {CLPS_MISSIONS.slice(0, 4).map((m) => (
              <div
                key={m.id}
                onClick={() => {
                  onClose();
                  onLaunchExplorer({
                    selectedMission: m,
                    lon: m.longitude,
                    lat: m.latitude,
                    zoom: 5.2,
                  });
                }}
                className="p-3 rounded-xl bg-slate-900/40 hover:bg-slate-800/70 border border-slate-800/80 hover:border-cyan-500/40 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                    {m.name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {m.provider} · {m.landingSiteName}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <a
            href="https://www.nasa.gov/commercial-lunar-payload-services/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
          >
            <span>Official NASA CLPS Page</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={() => {
              onClose();
              onLaunchExplorer();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Open Explorer</span>
          </button>
        </div>
      </div>
    </div>
  );
}

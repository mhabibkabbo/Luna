import React from 'react';
import { Database, ExternalLink, ShieldCheck, FileText, Globe, Layers } from 'lucide-react';

export default function DataSourcesSection() {
  const sources = [
    {
      title: 'NASA Lunar Reconnaissance Orbiter (LRO)',
      agency: 'NASA Goddard Space Flight Center / ASU',
      description:
        'Global orthorectified photographic mosaics (LROC WAC) and Lunar Orbiter Laser Altimeter (LOLA) topographic digital elevation models served via NASA Moon Trek web map tile services.',
      tags: ['LROC WAC Basemap', 'LOLA Altimetry', 'WMTS 256px Tiles'],
      link: 'https://trek.nasa.gov/moon/',
    },
    {
      title: 'USGS Astrogeology Science Center',
      agency: 'U.S. Geological Survey / IAU Working Group',
      description:
        'Gazetteer of Planetary Nomenclature providing official International Astronomical Union (IAU) approved crater coordinates, diameters, origin names, and selenographic center points.',
      tags: ['IAU Coordinates', 'Crater Gazetteer', 'Selenographic System'],
      link: 'https://planetarynames.wr.usgs.gov/',
    },
    {
      title: 'NASA CLPS Task Orders & NSSDC Master Catalog',
      agency: 'NASA Science Mission Directorate (SMD)',
      description:
        'Official commercial task order manifests detailing commercial landers, contractual payloads, launch vehicles, verified landing coordinates, and mission milestone reports.',
      tags: ['Task Orders 2-IM, 19D, etc.', 'Instrument Manifests', 'NASA NSSDC IDs'],
      link: 'https://www.nasa.gov/commercial-lunar-payload-services/',
    },
    {
      title: 'Lunar and Planetary Institute (LPI)',
      agency: 'USRA / NASA Planetary Science Division',
      description:
        'Landing site atlas, South Pole exploration terrain profiles, illumination studies, and Apollo lunar surface journal geological coordinates.',
      tags: ['Landing Site Atlas', 'South Pole Illumination', 'Surface Science'],
      link: 'https://www.lpi.usra.edu/lunar/',
    },
  ];

  return (
    <section id="datasources" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#030611] border-t border-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono tracking-wider text-cyan-400 uppercase mb-4">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>SCIENTIFIC INTEGRITY & METHODOLOGY</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-5">
            Verified Scientific Data Sources
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Luna is built upon open data archives maintained by NASA, the USGS Astrogeology Science
            Center, and international space agencies. Coordinates and telemetry are strictly anchored
            in peer-reviewed lunar cartography.
          </p>
        </div>

        {/* Sources Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-12">
          {sources.map((src) => (
            <div
              key={src.title}
              className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {src.title}
                  </h3>
                  <a
                    href={src.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
                    title="Open official data source"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <div className="text-xs font-mono text-cyan-400/90 mb-3 font-medium">
                  {src.agency}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {src.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-800/80">
                {src.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700/50 text-[10px] font-mono text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Methodology Standards Banner */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="text-xs text-slate-300">
              <span className="font-semibold text-white">Cartographic Standard:</span> IAU
              Selenographic Coordinate System (Positive North, Mean Earth / Polar Axis Datum, Radius
              1,737.4 km).
            </div>
          </div>
          <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
            WGS84 / EPSG:4326 Planar Mapping
          </div>
        </div>
      </div>
    </section>
  );
}

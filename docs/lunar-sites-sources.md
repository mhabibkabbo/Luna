# Lunar sites: what changed, why, and where it comes from

Date of this update: 2026-11-02. Every changed or added entry in the data files also carries an inline
`// CHANGED` or `// ADDED` comment with the reason.

**Confidence labels** used below (they match the `locationType` field in the data):

- **confirmed** – a published coordinate for the actual site or feature centre.
- **approximate** – a representative point inside a region, or a general area. Fine for display, indicative only for horizon work.
- **estimate** – calculated by us from other published points (flagged in the comment).
- **placeholder** – display only, no real coordinate exists yet (`horizonEligible: false`).

URLs were taken from the search results used for this update; some pages were read only as search excerpts, so
check the original page before quoting a number in a presentation.

---

## 1. Changed entries

| id | What changed | Why | Source |
|---|---|---|---|
| `clps-im2-athena` | Moved from (-89.70, 120.00) to (-84.7906, 29.1958); status → completed; dates 2025-02-27 / 2025-03-06 | Old point was inside Shackleton crater (computed horizon was "enclosed"). Mission was re-targeted to Mons Mouton and landed on its side about 250 m from the intended site. Confirmed. | LROC IM-2 landing region https://www.lroc.asu.edu/images/1401 ; NASA CLPS press kit NP-2025-02-005 https://nasa.gov/wp-content/uploads/2025/02/np-2025-02-005-jsc-clps-intuitive-machines-press-kit-508-2-25-25.pdf ; Wikipedia IM-2 infobox (actual landing in degrees/minutes/seconds) |
| `clps-firefly-bgm1` | Status planned → completed; dates 2025-01-15 / 2025-03-02 | Blue Ghost 1 landed 2025-03-02 in Mare Crisium. Coordinates unchanged. Confirmed. | NASA CLPS press kit NP-2025-01-001 https://www.nasa.gov/wp-content/uploads/2025/01/np-2025-01-001-jsc-clps-firefly-press-kit-screen-508-1-10-25-final.pdf ; LROC |
| `clps-griffin-gm1` | Schedule now "NET November 2026"; site wording "Nobile Crater region near Mons Mouton"; coordinates kept at (-84.5, 31.7), marked approximate | "Late 2025" was stale. NASA/Astrobotic name the Nobile region near Mons Mouton but no touchdown coordinates are published. | NASA Moon Base phases https://www.nasa.gov/moonbase-phases/ ; NASA CLPS providers page |
| `clps-im3-vertex` | Schedule → NET first half of 2027 | "Target 2026" was stale. Reiner Gamma coordinates unchanged. | NASA Moon Base phases; NASA press kit NP-2025-02-005 |
| `clps-firefly-cp21` | Re-labelled as **Blue Ghost Mission 3 (Gruithuisen Domes)**, approx. (36.6, -40.5); payload list emptied | NASA's press kit lists CP-21 as Blue Ghost 3. The id previously held the far-side mission with a made-up position (-45, 160). **Approximate: NASA gives no coordinates.** | NASA press kit NP-2025-02-005 |
| `clps-blueorigin-cp22` | Now **Blue Moon Mark 1 "Endurance"**; moved from (-85, 0) to (-89.374, -96.204); task order TO CT-3 | NASA names the target "Shackleton Connecting Ridge". The old point was on Malapert massif. **Estimate:** great-circle mid-point of the Shackleton and de Gerlache crater centres; replace with the LOLA "Site01" DEM centre. Task-order numbers conflict between sources. | NASA event page https://www.nasa.gov/event/clps-flight-blue-origins-blue-moon-mark-1/ ; NASA press kit NP-2025-01-001 |
| `clps-draper-cp12` | Comment only | Coordinates match the Schrödinger basin centre. Launch/landing "Target 2026" could not be re-verified. | NASA press kit NP-2025-02-005 |
| `landing-chandrayaan-3` | (-69.37, 32.35) → (-69.3741, 32.32) | NASA's NSSDC table lists the lander at these LRO-based values. Confirmed. | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html |
| `landing-artemis3-shackleton` | Renamed "Peak Near Shackleton"; moved from (-89.70, 120.00) to (-89.0066, 132.0596) | Old point is inside Shackleton crater. New point is a documented crater inside NASA's "Peak Near Shackleton" region. Approximate. | LPI Artemis III workshop abstract 2042 https://www.hou.usra.edu/meetings/Artemis_III_2023/pdf/2042.pdf |
| `landing-artemis3-mouton` | Relabelled "Mons Mouton Region (IM-2 / Griffin-1 / VIPER)"; coordinates unchanged | Mons Mouton is not one of NASA's 13 announced Artemis III regions. | LROC IM-2 page; NASA region list |

## 2. Added: south-polar Artemis III candidate points

NASA published 13 regions (about 15 x 15 km) without single centre coordinates, so these are representative points
inside the regions, taken from published work.

| id | Lat, Lon | Confidence | Source |
|---|---|---|---|
| `landing-artemis3-faustini-rim-a` | -88.0573, 89.1596 | approximate | LPI abstract 2042 (link above) |
| `landing-artemis3-nobile-rim-2` | -84.2016, 60.6999 | approximate | Peña-Asensio, Neira-Acosta & Sánchez-Lozano (2025), Acta Astronautica 226:469-478, https://www.sciencedirect.com/science/article/pii/S0094576524006234 (top-ranked point, 84°12'5.61"S 60°41'59.61"E) |
| `landing-artemis3-amundsen-rim` | -84.1918, 67.2290 | approximate | same paper (84°11'30.63"S 67°13'44.55"E) |
| `landing-artemis3-de-gerlache-rim-2` | -88.5157, -61.1673 | approximate | same paper (88°30'56.38"S 61°10'2.35"W) |
| `landing-artemis3-site-004` | -89.9592, 135.8185 | approximate | same paper (89°57'33.08"S 135°49'6.44"E); NASA LOLA 5 m site DEMs call "Site04" the Shackleton rim https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ |
| `landing-artemis3-connecting-ridge` | -89.374, -96.204 | **estimate** | Mid-point of the Shackleton and de Gerlache centres; shares the Blue Moon MK1 pin |

**Not added (no published coordinates found, so nothing was guessed):** Connecting Ridge Extension, de Gerlache Rim 1,
de Gerlache-Kocher Massif, Leibnitz Beta Plateau, Nobile Rim 1. Haworth and Malapert Massif are represented by the existing
`crater-haworth` and `mons-malapert`. Best next source: the five LOLA 5 m site DEMs (Site01 Connecting Ridge,
Site07 Peak Near Shackleton, Site11 de Gerlache rim, Site20 Leibnitz Beta Plateau, Site23 Malapert massif) at the PGDA link above.

## 3. Added: other mission sites

| id | Lat, Lon | Confidence | Why added | Source |
|---|---|---|---|---|
| `landing-change-7` | -88.8, 123.4 | approximate (planned) | South-pole mission aimed at a peak near Shackleton's SE ridge; launch stood down 2026-08-23 | https://en.wikipedia.org/wiki/Chang%27e_7 |
| `landing-vikram-impact` | -70.8810, 22.7840 | confirmed | Chandrayaan-2 lander impact site (south-polar latitudes) | NASA NSSDC table (link above) |
| `landing-luna-25-impact` | -57.87, 61.36 | confirmed | LRO-identified crater; the NSSDC table still lists the intended point (-69.545, 43.544) | NASA LRO release https://www.nasa.gov/?p=505500 ; Jatan Mehta, Moon Monday #143 https://jatan.space/moon-monday-issue-143 |
| `landing-beresheet-impact` | 32.5956, 19.3496 | confirmed | Notable commercial landing attempt | NASA NSSDC table |
| `landing-hakuto-r-m1-impact` | 47.581, 44.094 | confirmed | Notable commercial landing attempt | NASA NSSDC table; LROC https://www.lroc.asu.edu/images/1302 |
| `clps-firefly-bgm2` | -45, 160 | **placeholder** | Blue Ghost Mission 2 (CS-3/CS-4) lands on the far side; site not published. Kept only so the mission is visible. `horizonEligible: false` | NASA press kit NP-2025-02-005 ; https://science.nasa.gov/lunar-discovery/deliveries/cs-3 |

## 4. Added: named south-polar craters

Centre coordinates are from the IAU Gazetteer of Planetary Nomenclature, as reproduced on the pages below. Descriptions were kept to
facts that were visible in those sources (name origin, approximate size, location).

| id | Lat, Lon | Diameter | Source |
|---|---|---|---|
| `crater-malapert` | -84.9, 12.9 | 69 km | https://en.wikipedia.org/wiki/Malapert_(crater) |
| `crater-scott` | -81.9, 45.3 | 108 km | https://en.wikipedia.org/wiki/Scott_(crater) |
| `crater-wiechert` | -84.5, 165.0 | 41 km | https://en.wikipedia.org/wiki/Wiechert_(crater) |
| `crater-slater` | -88.08, 111.29 | 25.12 km | https://www.swri.org/press-release/lunar-crater-named-former-swri-space-scientist-david-c-slater ; Wikipedia |
| `crater-sverdrup` | -88.5, -152.0 | 35 km | https://en.wikipedia.org/wiki/Sverdrup_(crater) |
| `crater-henson` | -88.57, -130.63 | 43 km | IAU approval record, Feature ID 16004 https://content.presspage.com/uploads/1906/henson-crater-lunar-south-pole-details.pdf?10000 |
| `crater-kocher` | -84.47, -134.02 | 24.03 km | IAU Gazetteer https://planetarynames.wr.usgs.gov/Feature/14535 |
| `crater-idelson` | -81.5, 110.9 | 60 km | https://en.wikipedia.org/wiki/Idel%CA%B9son_(crater) |
| `crater-hale` | -74.2, 90.8 | 83 km | https://en.wikipedia.org/wiki/Hale_(lunar_crater) |
| `crater-demonax` | -78.2, 59.0 | 121.93 km | https://en.wikipedia.org/wiki/Demonax_(crater) |
| `crater-boguslawsky` | -72.9, 43.2 | 94.59 km | https://en.wikipedia.org/wiki/Boguslawsky_(crater) |
| `crater-drygalski` | -79.3, -84.9 | 149 km (NASA LOLA page; Wikipedia lists 162.49 km) | https://science.nasa.gov/?p=301491 ; https://en.wikipedia.org/wiki/Drygalski_(crater) |
| `crater-zeeman` | -75.2, -134.8 | 184 km | https://en.wikipedia.org/wiki/Zeeman_(crater) |

## 5. Things to double-check before the demo

1. **Approximate and estimated points.** 15 exported sites are approximate or planned. Their horizons are indicative.
2. **Blue Ghost 3 position (36.6, -40.5)** is a general domes-area location typed in from general knowledge, not from a mission document. Verify against the IAU Gazetteer.
3. **Draper CP-12 dates** and **Blue Moon / Griffin / IM-3 dates** change often; confirm on NASA's CLPS pages the day you present.
4. **Horizons removed** from `horizons.json` for `clps-im2-athena`, `landing-artemis3-shackleton` and `clps-blueorigin-cp22`, because their coordinates changed. Recompute them.
5. Mission statuses and Artemis plans have shifted repeatedly since 2022; label candidate regions as "announced 2022" rather than as current plans.
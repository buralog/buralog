// build-world-map-svg.js
// Generate assets/world.svg with a large map (left) + slim right panel.
// Legend is vertical in the map's bottom-right; bold stat chips in the panel.

const fs = require('fs');
const nodePath = require('path');
const fetch = require('node-fetch');
const d3geo = require('d3-geo');
const { DOMImplementation, XMLSerializer } = require('xmldom');

(async () => {
    // ---- 1) Load visitors data (supports v3 & legacy numeric)
    const visitorsPath = nodePath.resolve('data/visitors.json');
    const data = JSON.parse(fs.readFileSync(visitorsPath, 'utf8'));

    let counts = {};
    if (data && data.version === 3 && data.countries) {
        for (const [iso, info] of Object.entries(data.countries)) {
            counts[iso.toUpperCase()] = Object.keys((info && info.users) || {}).length;
        }
    } else if (data && data.countries) {
        // legacy: countries[ISO] = number
        for (const [iso, n] of Object.entries(data.countries)) {
            counts[iso.toUpperCase()] = typeof n === 'number' ? n : 0;
        }
    }

    const totalCountries = Object.values(counts).filter(c => c > 0).length;
    const totalHellos = Object.values(counts).reduce((s, c) => s + c, 0);
    const updatedAt = data.updatedAt || new Date().toISOString();

    // ---- 2) Fetch GeoJSON (Admin-0 countries)
    const world = await fetch('https://geojson.xyz/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson')
        .then(r => r.json());

    // Build ISO to country name mapping
    const isoToName = {};
    for (const f of world.features) {
        const iso = (
            f.properties.ISO_A2_EH ||
            f.properties.iso_a2 ||
            f.properties.wb_a2 ||
            ''
        ).toUpperCase();
        const name = f.properties.name || f.properties.name_long || iso;
        if (iso) isoToName[iso] = name;
    }

    // ---- 3) Layout: larger map, slimmer panel, tiny margins
    const width = 1480;
    const height = 900;
    const margin = 6;

    const panelW = Math.round(width * 0.18);          // ~18% sidebar (slimmer)
    const panelX = width - panelW - margin;
    const panelY = margin;
    const panelH = height - 2 * margin;

    // Map area with padding to reduce whitespace
    const mapW = width - panelW - 3 * margin;
    const topPad = 40;    // Reduce top whitespace
    const botPad = 40;    // Reduce bottom whitespace
    const mapArea = [[margin, margin + topPad], [margin + mapW, height - margin - botPad]];

    // Projection fits the map area and scale it to fill better
    const projection = d3geo.geoNaturalEarth1();
    projection.fitExtent(mapArea, world);
    // Boost scale to make map larger and fill the space better
    projection.scale(projection.scale() * 1.);

    // Center the map horizontally in its area
    const [cx, cy] = projection.translate();
    projection.translate([cx, cy + 10]); // Slight vertical adjustment

    const geoPath = d3geo.geoPath(projection);

    // ---- 4) Choropleth coloring
    const fillFor = (c) => {
        if (c >= 50) return '#2e7d32';  // dark green
        if (c >= 10) return '#66bb6a';  // mid green
        if (c >= 1) return '#a5d6a7';  // light green
        return '#ffffff';               // zero
    };
    const opacityFor = (c) => (c >= 1 ? 0.95 : 0.05);

    const flagEmoji = (iso2 = '') =>
        iso2.toUpperCase().replace(/./g, ch =>
            String.fromCodePoint(0x1F1E6 + ch.charCodeAt(0) - 65)
        );

    // ---- 5) Build SVG
    const doc = new DOMImplementation().createDocument(null, 'svg');
    const svg = doc.documentElement;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Background (very soft blue-gray)
    const bg = doc.createElement('rect');
    bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
    bg.setAttribute('width', String(width)); bg.setAttribute('height', String(height));
    bg.setAttribute('fill', '#f3f7fb');
    svg.appendChild(bg);

    // Countries (left side)
    for (const f of world.features) {
        const iso = (
            f.properties.ISO_A2_EH ||
            f.properties.iso_a2 ||
            f.properties.wb_a2 ||
            ''
        ).toUpperCase();

        const n = counts[iso] || 0;
        const d = geoPath(f);
        if (!d) continue;

        const p = doc.createElement('path');
        p.setAttribute('d', d);
        p.setAttribute('fill', fillFor(n));
        p.setAttribute('fill-opacity', opacityFor(n));
        p.setAttribute('stroke', '#6b7280'); // slate-500-ish
        p.setAttribute('stroke-width', '0.45');
        p.setAttribute('data-iso', iso);
        svg.appendChild(p);
    }

    // ---- 6) Legend inside the map (bottom-right, vertical)
    const mapRight = margin + mapW;
    const mapBottom = height - margin;
    const lgPad = 10, rowH = 26, rows = 4, lgW = 120, lgH = lgPad * 2 + rows * rowH;

    const legend = doc.createElement('g');
    legend.setAttribute('transform', `translate(${mapRight - lgW - 12}, ${mapBottom - lgH - 12})`);
    svg.appendChild(legend);

    const legendBg = doc.createElement('rect');
    legendBg.setAttribute('x', '0'); legendBg.setAttribute('y', '0');
    legendBg.setAttribute('rx', '8'); legendBg.setAttribute('ry', '8');
    legendBg.setAttribute('width', String(lgW));
    legendBg.setAttribute('height', String(lgH));
    legendBg.setAttribute('fill', '#ffffff');
    legendBg.setAttribute('fill-opacity', '0.92');
    legendBg.setAttribute('stroke', '#e5e7eb');
    legend.appendChild(legendBg);

    const legendRow = (i, label, cVal) => {
        const y = lgPad + i * rowH + 18;
        const sw = doc.createElement('rect');
        sw.setAttribute('x', String(lgPad));
        sw.setAttribute('y', String(y - 14));
        sw.setAttribute('width', '14');
        sw.setAttribute('height', '14');
        sw.setAttribute('fill', fillFor(cVal));
        sw.setAttribute('fill-opacity', String(opacityFor(cVal)));
        sw.setAttribute('stroke', '#6b7280');
        sw.setAttribute('stroke-width', '0.5');
        legend.appendChild(sw);

        const t = doc.createElement('text');
        t.setAttribute('x', String(lgPad + 22));
        t.setAttribute('y', String(y));
        t.setAttribute('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
        t.setAttribute('font-size', '13');
        t.setAttribute('fill', '#111827');
        t.appendChild(doc.createTextNode(label));
        legend.appendChild(t);
    };
    legendRow(0, '50+', 50);
    legendRow(1, '10+', 10);
    legendRow(2, '1+', 1);
    legendRow(3, '0', 0);

    // ---- 7) Right sidebar (soft bg + bigger typography + stat chips)
    const panel = doc.createElement('g');
    panel.setAttribute('transform', `translate(${panelX}, ${panelY})`);
    svg.appendChild(panel);

    const panelBg = doc.createElement('rect');
    panelBg.setAttribute('x', '0'); panelBg.setAttribute('y', '0');
    panelBg.setAttribute('rx', '14'); panelBg.setAttribute('ry', '14');
    panelBg.setAttribute('width', String(panelW)); panelBg.setAttribute('height', String(panelH));
    panelBg.setAttribute('fill', '#eef2f7');  // softer than white
    panelBg.setAttribute('fill-opacity', '0.98');
    panelBg.setAttribute('stroke', '#e5e7eb');
    panelBg.setAttribute('stroke-width', '1');
    panel.appendChild(panelBg);

    const mkText = (x, y, txt, opts = {}) => {
        const t = doc.createElement('text');
        t.setAttribute('x', String(x));
        t.setAttribute('y', String(y));
        t.setAttribute('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
        t.setAttribute('font-size', String(opts.size || 16));
        if (opts.bold) t.setAttribute('font-weight', '700');
        t.setAttribute('fill', opts.color || '#111827');
        if (opts.anchor) t.setAttribute('text-anchor', opts.anchor);
        t.appendChild(doc.createTextNode(txt));
        panel.appendChild(t);
        return t;
    };

    let y = 40;
    mkText(18, y, 'Say Hello From 🌍', { bold: true, size: 22 }); y += 32;

    // STAT CHIPS ROW
    const chipRowY = y;
    const chipH = 56, chipR = 12, gap = 12;
    const chipW = Math.floor((panelW - 18 * 2 - gap) / 2);

    const chip = (x, title, value, accent) => {
        const g = doc.createElement('g');
        g.setAttribute('transform', `translate(${x}, ${chipRowY})`);
        panel.appendChild(g);

        const r = doc.createElement('rect');
        r.setAttribute('x', '0'); r.setAttribute('y', '0');
        r.setAttribute('rx', String(chipR)); r.setAttribute('ry', String(chipR));
        r.setAttribute('width', String(chipW)); r.setAttribute('height', String(chipH));
        r.setAttribute('fill', '#ffffff'); r.setAttribute('stroke', '#e5e7eb');
        g.appendChild(r);

        // tiny accent line at top
        const acc = doc.createElement('rect');
        acc.setAttribute('x', '0'); acc.setAttribute('y', '0');
        acc.setAttribute('width', String(chipW)); acc.setAttribute('height', '4');
        acc.setAttribute('fill', accent);
        g.appendChild(acc);

        const titleText = doc.createElement('text');
        titleText.setAttribute('x', '12'); titleText.setAttribute('y', '26');
        titleText.setAttribute('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
        titleText.setAttribute('font-size', '13');
        titleText.setAttribute('fill', '#6b7280'); // slate-500
        titleText.appendChild(doc.createTextNode(title));
        g.appendChild(titleText);

        const valueText = doc.createElement('text');
        valueText.setAttribute('x', '12'); valueText.setAttribute('y', '46');
        valueText.setAttribute('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
        valueText.setAttribute('font-size', '22');
        valueText.setAttribute('font-weight', '700');
        valueText.setAttribute('fill', '#111827');
        valueText.appendChild(doc.createTextNode(String(value)));
        g.appendChild(valueText);
    };

    chip(18, 'Hellos', totalHellos, '#2563eb');   // blue accent
    chip(18 + chipW + gap, 'Countries', totalCountries, '#059669'); // green accent
    y = chipRowY + chipH + 24;

    // Divider
    const hr1 = doc.createElement('line');
    hr1.setAttribute('x1', '14'); hr1.setAttribute('y1', String(y));
    hr1.setAttribute('x2', String(panelW - 14)); hr1.setAttribute('y2', String(y));
    hr1.setAttribute('stroke', '#d1d5db'); hr1.setAttribute('stroke-width', '1');
    panel.appendChild(hr1);
    y += 26;

    // Top countries list (flags + country names)
    mkText(18, y, 'Top countries', { bold: true, size: 18 }); y += 24;

    const top = Object.entries(counts)
        .filter(([_, c]) => c > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);

    const rowHeight = 24;
    top.forEach(([iso, c], i) => {
        const rowY = y + i * rowHeight;
        const countryName = isoToName[iso] || iso;
        mkText(18, rowY, `${flagEmoji(iso)} ${countryName}`, { size: 15, color: '#111827' });

        const countText = doc.createElement('text');
        countText.setAttribute('x', String(panelW - 18));
        countText.setAttribute('y', String(rowY));
        countText.setAttribute('text-anchor', 'end');
        countText.setAttribute('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
        countText.setAttribute('font-size', '15');
        countText.setAttribute('font-weight', '600');
        countText.setAttribute('fill', '#111827');
        countText.appendChild(doc.createTextNode(String(c)));
        panel.appendChild(countText);
    });

    // Bottom divider and updated time at the bottom
    const bottomY = panelH - 42;
    const hr2 = doc.createElement('line');
    hr2.setAttribute('x1', '14'); hr2.setAttribute('y1', String(bottomY));
    hr2.setAttribute('x2', String(panelW - 14)); hr2.setAttribute('y2', String(bottomY));
    hr2.setAttribute('stroke', '#d1d5db'); hr2.setAttribute('stroke-width', '1');
    panel.appendChild(hr2);

    const updateY = bottomY + 20;
    mkText(panelW / 2, updateY, 'Last updated', { size: 11, color: '#6b7280', anchor: 'middle' });
    mkText(panelW / 2, updateY + 14, updatedAt.replace('T', ' ').replace(/\.\d+Z$/, '').replace(/Z$/, ' UTC'),
        { size: 11, color: '#6b7280', anchor: 'middle' });

    // ---- 8) Write
    const outPath = nodePath.resolve('assets/world.svg');
    fs.mkdirSync(nodePath.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, new XMLSerializer().serializeToString(doc));
    console.log(`✅ Built SVG at ${outPath} (countries=${totalCountries}, hellos=${totalHellos})`);
})();
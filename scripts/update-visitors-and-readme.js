#!/usr/bin/env node
/**
 * Update visitors.json and rebuild README.md
 * Uses v3 schema with per-country user tracking
 */

const fs = require('fs');

// ---------- Helpers
const nowISO = () => new Date().toISOString();
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function flagEmoji(iso2) {
    const A = 0x1F1E6, Z = 0x1F1FF;
    const code = iso2.toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return '';
    return String.fromCodePoint(A + (code.charCodeAt(0) - 65)) +
        String.fromCodePoint(A + (code.charCodeAt(1) - 65));
}

function countryName(iso2) {
    try {
        return regionNames.of(iso2.toUpperCase()) || iso2.toUpperCase();
    } catch {
        return iso2.toUpperCase();
    }
}

function ensureV3(obj) {
    if (obj && obj.version === 3) return obj;

    if (obj && obj.countries && obj.byUser) {
        const v3 = {
            version: 3,
            updatedAt: obj.updatedAt || nowISO(),
            maxChangesPerUser: 3,
            countries: {},
            users: {}
        };

        // Seed users.current.iso from 'last'
        for (const [user, info] of Object.entries(obj.byUser)) {
            v3.users[user] = {
                current: { iso: info.last || null, city: null },
                changesUsed: Math.min(info.count || 0, 3)
            };
        }

        // Build per-country user sets from users' current.iso
        for (const [user, uinfo] of Object.entries(v3.users)) {
            const iso = uinfo.current?.iso;
            if (!iso) continue;
            if (!v3.countries[iso]) {
                v3.countries[iso] = {
                    users: {},
                    firstUser: obj.firstVisitor?.[iso] || null,
                    lastAt: obj.updatedAt || nowISO()
                };
            }
            v3.countries[iso].users[user] = true;
            if (!v3.countries[iso].firstUser) v3.countries[iso].firstUser = user;
        }
        return v3;
    }

    // Fresh v3 minimal
    return {
        version: 3,
        updatedAt: "",
        maxChangesPerUser: 3,
        countries: {},
        users: {}
    };
}

// ---------- Main Logic
function main() {
    const ACTOR = process.env.ACTOR;
    const TITLE = process.env.TITLE || '';
    const BODY = process.env.ISSUE_BODY || '';
    const ISO = (TITLE.split('|')[1] || '').split('-')[0].trim().toUpperCase();

    if (!/^[A-Z]{2}$/.test(ISO)) {
        console.log('Invalid ISO in title; expected hello|XX. No-op.');
        process.exit(0);
    }

    // ---------- Load & migrate to v3
    const path = 'data/visitors.json';
    const raw = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : {};
    const data = ensureV3(raw);

    // ---------- Ensure containers
    data.version = 3;
    data.maxChangesPerUser = 3;
    data.updatedAt ||= "";
    data.countries ||= {};
    data.users ||= {};

    if (!data.countries[ISO]) {
        data.countries[ISO] = { users: {}, firstUser: null, lastAt: null };
    }

    // ---------- Current user record
    const userRec = data.users[ACTOR] || { current: { iso: null, city: null }, changesUsed: 0 };

    // Optional city parse (kept null unless provided)
    const cityMatch = BODY.match(/^\s*City:\s*(.+)\s*$/mi);
    const city = cityMatch ? cityMatch[1].trim() : (userRec.current?.city ?? null);

    // ---------- No-op & limits
    if (userRec.changesUsed >= data.maxChangesPerUser) {
        console.log(`User ${ACTOR} reached max changes (${data.maxChangesPerUser}). No-op.`);
        fs.writeFileSync('/tmp/changed.flag', '');
        process.exit(0);
    }

    if ((userRec.current?.iso || null) === ISO) {
        console.log(`Same country as current (${ISO}). No-op.`);
        fs.writeFileSync('/tmp/changed.flag', '');
    } else {
        // Move user between countries (remove from previous)
        const prevIso = userRec.current?.iso || null;
        if (prevIso && data.countries[prevIso]?.users) {
            delete data.countries[prevIso].users[ACTOR];
        }

        // Add to new country
        data.countries[ISO].users[ACTOR] = true;

        // Set firstUser once; never overwrite
        if (!data.countries[ISO].firstUser) {
            data.countries[ISO].firstUser = ACTOR;
        }

        data.countries[ISO].lastAt = nowISO();

        // Increment user changes & update current
        userRec.current = { iso: ISO, city };
        userRec.changesUsed = (userRec.changesUsed || 0) + 1;

        data.users[ACTOR] = userRec;
        data.updatedAt = nowISO();

        fs.writeFileSync(path, JSON.stringify(data, null, 2));
        fs.writeFileSync('/tmp/changed.flag', '1');
        console.log(`✅ Updated ${ACTOR} → ${ISO} (change ${userRec.changesUsed}/${data.maxChangesPerUser})`);
    }

    // ---------- Build README from template
    if (!fs.existsSync('README.tpl.md')) {
        console.log('No README.tpl.md found, skipping README generation');
        return;
    }

    const tpl = fs.readFileSync('README.tpl.md', 'utf8');

    // Counts = unique users per country
    const countryEntries = Object.entries(data.countries)
        .map(([iso, obj]) => [iso, Object.keys(obj.users || {}).length])
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);

    const totalHellos = countryEntries.reduce((s, [, c]) => s + c, 0);
    const totalCountries = countryEntries.length;

    // Who Said Hello? → show up to 50 recent "current" users
    const isoLast = {};
    for (const [iso, cinfo] of Object.entries(data.countries)) {
        isoLast[iso] = cinfo.lastAt || '1970-01-01T00:00:00.000Z';
    }

    const currentUsers = Object.entries(data.users)
        .map(([u, urec]) => ({ user: u, iso: urec.current?.iso || null }))
        .filter(x => x.iso)
        .sort((a, b) => (isoLast[b.iso] || '').localeCompare(isoLast[a.iso] || '') || a.user.localeCompare(b.user))
        .slice(0, 50);

    const whoList = currentUsers.map(({ user, iso }) => {
        const flag = flagEmoji(iso);
        return `${flag} [@${user}](https://github.com/${user})`;
    }).join(' | ');

    // Country table (right column)
    function tableMD() {
        const rows = ['| Country | Count |', '|---------|------:|'];
        for (const [iso, count] of countryEntries) {
            const name = countryName(iso);
            const flag = flagEmoji(iso);
            rows.push(`| ${flag} ${name} | ${count} |`);
        }
        return rows.join('\n');
    }

    const out = tpl
        .replace('{{TOTAL_HELLOS}}', String(totalHellos))
        .replace('{{TOTAL_COUNTRIES}}', String(totalCountries))
        .replace('{{WHO_SAID_HELLO}}', whoList || '—')
        .replace('{{COUNTRY_TABLE}}', tableMD())
        .replace('{{UPDATED_AT}}', data.updatedAt || nowISO());

    fs.writeFileSync('README.md', out);
    console.log('✅ README.md generated');
}

// Run
main();
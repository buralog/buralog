#!/usr/bin/env node
/**
 * Update visitors.json and rebuild README.md
 * v3 schema w/ per-user helloAt and per-country user timestamps
 */

const fs = require('fs');

// ---------- Helpers
const nowISO = () => new Date().toISOString();
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function flagEmoji(iso2) {
    const base = 0x1F1E6; // 'A'
    const code = (iso2 || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return '';
    return String.fromCodePoint(base + (code.charCodeAt(0) - 65), base + (code.charCodeAt(1) - 65));
}

function countryName(iso2) {
    try { return regionNames.of((iso2 || '').toUpperCase()) || (iso2 || '').toUpperCase(); }
    catch { return (iso2 || '').toUpperCase(); }
}

function toMillis(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : 0;
}

/**
 * Ensure a v3-shaped object (non-destructive).
 * - If given an older shape with {countries, byUser}, migrates minimally.
 * - Preserves existing timestamps and booleans.
 */
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

        // Seed per-user current iso (best-effort) from byUser.last
        for (const [user, info] of Object.entries(obj.byUser)) {
            v3.users[user] = {
                current: { iso: info.last || null, city: null }, // helloAt unknown in legacy
                changesUsed: Math.min(info.count || 0, 3)
            };
        }

        // Build per-country user sets
        for (const [user, urec] of Object.entries(v3.users)) {
            const iso = urec.current?.iso;
            if (!iso) continue;
            if (!v3.countries[iso]) {
                v3.countries[iso] = { users: {}, firstUser: null, lastAt: v3.updatedAt };
            }
            // Keep boolean for legacy; new writes will become timestamps
            v3.countries[iso].users[user] = true;
            if (!v3.countries[iso].firstUser) v3.countries[iso].firstUser = user;
        }
        return v3;
    }

    // Fresh v3
    return { version: 3, updatedAt: "", maxChangesPerUser: 3, countries: {}, users: {} };
}

// ---------- Main Logic
function main() {
    const ACTOR = process.env.ACTOR;
    const TITLE = process.env.TITLE || '';
    const BODY = process.env.ISSUE_BODY || '';
    const ISSUE_TIME = process.env.ISSUE_TIME || nowISO(); // UTC ISO from GitHub event

    // Parse ISO from title like "hello|TR" or "hello|TR-something"
    const ISO = (TITLE.split('|')[1] || '').split('-')[0].trim().toUpperCase();

    if (!ACTOR) {
        console.log('Missing ACTOR env; no-op.');
        process.exit(0);
    }
    if (!/^[A-Z]{2}$/.test(ISO)) {
        console.log('Invalid ISO in title; expected hello|XX. No-op.');
        process.exit(0);
    }

    // ---------- Load & ensure v3
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

    // Current user record (non-destructive merge)
    const userRec = data.users[ACTOR] || { current: { iso: null, city: null, helloAt: null }, changesUsed: 0 };

    // Optional city parse from body ("City: X")
    const cityMatch = BODY.match(/^\s*City:\s*(.+)\s*$/mi);
    const city = cityMatch ? cityMatch[1].trim() : (userRec.current?.city ?? null);

    // ---------- Limits & early exits
    if ((userRec.changesUsed || 0) >= (data.maxChangesPerUser || 3)) {
        console.log(`User ${ACTOR} reached max changes (${data.maxChangesPerUser}). No-op.`);
        fs.writeFileSync('/tmp/changed.flag', ''); // empty => test -s is false
        writeReadmeOnly(data); // keep README fresh even if no data change
        return;
    }

    if ((userRec.current?.iso || null) === ISO) {
        console.log(`Same country as current (${ISO}). No-op.`);
        fs.writeFileSync('/tmp/changed.flag', '');
        writeReadmeOnly(data);
        return;
    }

    // ---------- Perform state change
    // Remove from previous country (if any)
    const prevIso = userRec.current?.iso || null;
    if (prevIso && data.countries[prevIso]?.users) {
        delete data.countries[prevIso].users[ACTOR];
    }

    // Add to new country: store timestamp (overwrite boolean if previously set)
    data.countries[ISO].users[ACTOR] = ISSUE_TIME;

    // Set firstUser once
    if (!data.countries[ISO].firstUser) data.countries[ISO].firstUser = ACTOR;

    // Update lastAt for that country
    data.countries[ISO].lastAt = ISSUE_TIME;

    // Update user record with helloAt + city + iso
    userRec.current = { iso: ISO, city, helloAt: ISSUE_TIME };
    userRec.changesUsed = (userRec.changesUsed || 0) + 1;
    data.users[ACTOR] = userRec;

    // Global updatedAt
    data.updatedAt = nowISO();

    // Persist
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    fs.writeFileSync('/tmp/changed.flag', '1'); // non-empty => changed
    console.log(`✅ Updated ${ACTOR} → ${ISO} at ${ISSUE_TIME} (change ${userRec.changesUsed}/${data.maxChangesPerUser})`);

    // Rebuild README
    buildReadme(data);
}

// ---------- README generation
function writeReadmeOnly(data) {
    if (!fs.existsSync('README.tpl.md')) {
        console.log('No README.tpl.md found, skipping README generation');
        return;
    }
    buildReadme(data);
}

function buildReadme(data) {
    if (!fs.existsSync('README.tpl.md')) {
        console.log('No README.tpl.md found, skipping README generation');
        return;
    }

    const tpl = fs.readFileSync('README.tpl.md', 'utf8');

    // Country counts = unique users per country
    const countryEntries = Object.entries(data.countries || {})
        .map(([iso, cinfo]) => [iso, Object.keys(cinfo.users || {}).length])
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]); // desc by count

    const totalHellos = countryEntries.reduce((sum, [, c]) => sum + c, 0);
    const totalCountries = countryEntries.length;

    // Who Said Hello? — ALL current users, ordered by their helloAt (oldest → newest)
    const currentUsers = Object.entries(data.users || {})
        .map(([user, urec]) => ({
            user,
            iso: urec.current?.iso || null,
            t: toMillis(urec.current?.helloAt) // may be 0 if missing
        }))
        .filter(x => x.iso);

    currentUsers.sort((a, b) => {
        if (a.t !== b.t) return a.t - b.t;           // ascending by helloAt
        return a.user.localeCompare(b.user);         // stable tie-break
    });

    const whoList = currentUsers.map(({ user, iso }) => {
        const flag = flagEmoji(iso);
        return `${flag} [@${user}](https://github.com/${user})`;
    }).join(' | ');

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

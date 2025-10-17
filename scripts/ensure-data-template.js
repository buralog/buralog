#!/usr/bin/env node
/**
 * Ensure data directories and base files exist
 * Creates default files if they don't exist
 */

const fs = require('fs');
const path = require('path');

function ensureDataAndTemplate() {
    // Create directories
    const dirs = ['data', 'assets', 'scripts'];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created directory: ${dir}`);
        }
    });

    // Create default visitors.json (v3 schema)
    const visitorsPath = 'data/visitors.json';
    if (!fs.existsSync(visitorsPath)) {
        const defaultData = {
            version: 3,
            updatedAt: "",
            maxChangesPerUser: 3,
            countries: {},
            users: {}
        };
        fs.writeFileSync(visitorsPath, JSON.stringify(defaultData, null, 2));
        console.log(`✅ Created default: ${visitorsPath}`);
    }

    console.log('✅ All data directories and base files are ready');
}

// Run
ensureDataAndTemplate();

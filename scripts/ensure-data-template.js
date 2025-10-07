#!/usr/bin/env node
/**
 * Ensure data directory and README template exist
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

    // Create README template
    const templatePath = 'README.tpl.md';
    if (!fs.existsSync(templatePath)) {
        const template = `## Say Hello From 🌍!

**Join the global hello wave!** Click your country on the interactive map and leave a hello 👋 
> [Open interactive map](https://buralog.github.io/buralog/)

![World map](assets/world.svg)

<table>
<tr>
<td width="80%" valign="top">

## 📊 Stats

👋 **{{TOTAL_HELLOS}}** hellos • 🌎 **{{TOTAL_COUNTRIES}}** countries

### 👥 Who Said Hello?
{{WHO_SAID_HELLO}}

</td>
<td width="20%" valign="top">

## 📋 Hellos by Country
{{COUNTRY_TABLE}}
</td>
</tr>
</table>

---

<details>
<summary><strong>⚙️ How It Works (GitHub Actions)</strong></summary>
  
This project uses GitHub Issues + GitHub Actions to keep the map and stats up to date — fully automatic.

1) **Pick a country on the interactive map** → click **"Say hello"**.  
2) You're sent to **GitHub Issues** with a prefilled title like \`hello|TR\` and the label \`country-claim\`.  
3) **Submit the issue.** That's it — the workflow takes over.  
4) The **GitHub Action** (runs on \`issues: opened\`) validates the issue title.
5) It updates the data store (e.g. \`data/visitors.json\`), **increments counts**, and appends your GitHub handle.  
6) It **rebuilds the SVG map** (\`assets/world.svg\`) and **regenerates the README sections** (stats, tables, "Who Said Hello").  
   - If a README template exists (e.g. \`readme.tpl.md\`), placeholders like \`{{TOTAL_HELLOS}}\`, \`{{COUNTRY_TABLE}}\` are replaced.  
7) The Action **commits & pushes** the changes, **closes your issue with a thank-you message**, and GitHub refreshes the README/Pages.
</details>


--- 
_Last updated: {{UPDATED_AT}}_
`;
        fs.writeFileSync(templatePath, template);
        console.log(`✅ Created default: ${templatePath}`);
    }

    console.log('✅ All data and templates are ready');
}

// Run
ensureDataAndTemplate();
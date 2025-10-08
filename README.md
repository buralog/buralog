## Say Hello From 🌍!

**Join the global hello wave!** Click your country on the interactive map and leave a hello 👋 
> [Open interactive map](https://buralog.github.io/buralog/)

![World map](assets/world.svg)

<table>
<tr>
<td width="80%" valign="top">

## 📊 Stats

👋 **5** hellos • 🌎 **5** countries

### 👥 Who Said Hello?
🇹🇷 [@buralog](https://github.com/buralog) | 🇯🇵 [@dai](https://github.com/dai) | 🇳🇬 [@sdotdev](https://github.com/sdotdev) | 🇦🇺 [@Xaxeric](https://github.com/Xaxeric) | 🇬🇧 [@mapsmania](https://github.com/mapsmania)

</td>
<td width="20%" valign="top">

## 📋 Hellos by Country
| Country | Count |
|---------|------:|
| 🇹🇷 Türkiye | 1 |
| 🇯🇵 Japan | 1 |
| 🇳🇬 Nigeria | 1 |
| 🇦🇺 Australia | 1 |
| 🇬🇧 United Kingdom | 1 |
</td>
</tr>
</table>

---

<details>
<summary><strong>⚙️ How It Works (GitHub Actions)</strong></summary>
  
This project uses GitHub Issues + GitHub Actions to keep the map and stats up to date — fully automatic.

1) **Pick a country on the interactive map** → click **“Say hello”**.  
2) You’re sent to **GitHub Issues** with a prefilled title like \`hello|TR\`.  
3) **Submit the issue.** That’s it — the workflow takes over.  
4) The **GitHub Action** (runs on \`issues: opened\`) validates the issue title.
5) It updates the data store (e.g. \`data/visitors.json\`), **increments counts**, and appends your GitHub handle.  
6) It **rebuilds the SVG map** (\`assets/world.svg\`) and **regenerates the README sections** (stats, tables, “Who Said Hello”).  
   - If a README template exists (e.g. \`readme.tpl.md\`), placeholders like \`{{TOTAL_HELLOS}}\`, \`{{COUNTRY_TABLE}}\` are replaced.  
7) The Action **commits & pushes** the changes, **closes your issue with a thank-you message**, and GitHub refreshes the README/Pages.
</details>


--- 
_Last updated: 2025-10-08T07:46:09.648Z_

## Say Hello From 🌍!

**Join the global hello wave!** Click your country on the interactive map and leave a hello 👋 
> [Open interactive map](https://buralog.github.io/buralog/)

[![World map](assets/world.svg "Open the interactive map")](https://buralog.github.io/buralog/)

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

### ⚙️ How It Works

This project uses **GitHub Issues + GitHub Actions** to keep the map and stats up to date — fully automatic.

1. **Pick a country on the interactive map** → click **"Say hello"**.  
2. You're sent to **GitHub Issues** with a prefilled title like `hello|TR`.  
3. **Submit the issue.** That's it — the workflow takes over.  
4. The **GitHub Action** validates the issue, updates the data store, rebuilds the SVG map, regenerates the README, commits & pushes changes, and closes your issue with a thank-you message.

--- 
_Last updated: {{UPDATED_AT}}_

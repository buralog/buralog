#!/usr/bin/env node
/**
 * Format country claim issue title
 * Reads from environment variables set by GitHub Actions
 * Updates issue title to: 🇺🇸 hello|US - @username says hello 👋
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const ISSUE_TITLE = process.env.ISSUE_TITLE || '';
const ISSUE_AUTHOR = process.env.ISSUE_AUTHOR || '';
const ISSUE_BODY = process.env.ISSUE_BODY || '';

function flagEmoji(iso2) {
  const A = 0x1F1E6;
  const code = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '🌍';
  return String.fromCodePoint(A + (code.charCodeAt(0) - 65)) + 
         String.fromCodePoint(A + (code.charCodeAt(1) - 65));
}

async function updateIssueTitle() {
  // Match pattern: hello|US
  const match = ISSUE_TITLE.match(/^hello\|([A-Z]{2})$/i);
  
  if (!match) {
    console.log('Title does not match pattern "hello|XX", skipping format');
    return;
  }

  const code = match[1].toUpperCase();
  const flag = flagEmoji(code);
  
  const newTitle = `${flag} hello|${code} - @${ISSUE_AUTHOR} says hello 👋`;
  
  console.log(`Updating title from: "${ISSUE_TITLE}"`);
  console.log(`                 to: "${newTitle}"`);

  // Use GitHub REST API to update issue
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${ISSUE_NUMBER}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'GitHub-Actions-Script'
    },
    body: JSON.stringify({ title: newTitle })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update issue: ${response.status} ${error}`);
  }

  console.log('✅ Issue title updated successfully');
}

// Run
updateIssueTitle().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
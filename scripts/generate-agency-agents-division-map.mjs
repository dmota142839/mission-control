#!/usr/bin/env node
/**
 * Regenerate src/lib/agency-agents-division-map.json from a clone of
 * https://github.com/msitarzewski/agency-agents (same layout as README divisions).
 *
 * Usage:
 *   git clone --depth 1 https://github.com/msitarzewski/agency-agents.git /tmp/agency-agents-src
 *   node scripts/generate-agency-agents-division-map.mjs /tmp/agency-agents-src
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.argv[2] || path.join('/tmp', 'agency-agents-src')
const out = path.join(process.cwd(), 'src/lib/agency-agents-division-map.json')
const skip = new Set(['.github', 'scripts', 'examples', 'integrations'])
const slugToDiv = {}

function titleCaseDiv(folder) {
  const labels = {
    'game-development': 'Game development',
    'paid-media': 'Paid media',
    'project-management': 'Project management',
    'spatial-computing': 'Spatial computing',
  }
  if (labels[folder]) return labels[folder]
  return folder.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function addAgentFile(stem, folderName, div) {
  slugToDiv[stem] = div
  if (stem.startsWith(`${folderName}-`)) {
    const rest = stem.slice(folderName.length + 1)
    if (rest.length >= 3) slugToDiv[rest] = div
  }
}

function walkDir(dir, folderName, div) {
  for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, file.name)
    if (file.isDirectory()) walkDir(p, folderName, div)
    else if (file.name.endsWith('.md')) {
      addAgentFile(file.name.replace(/\.md$/i, ''), folderName, div)
    }
  }
}

if (!fs.existsSync(root)) {
  console.error('Clone agency-agents first, e.g.:')
  console.error('  git clone --depth 1 https://github.com/msitarzewski/agency-agents.git /tmp/agency-agents-src')
  console.error(`  node scripts/generate-agency-agents-division-map.mjs /tmp/agency-agents-src`)
  process.exit(1)
}

for (const folder of fs.readdirSync(root, { withFileTypes: true })) {
  if (!folder.isDirectory() || skip.has(folder.name) || folder.name.startsWith('.')) continue
  walkDir(path.join(root, folder.name), folder.name, titleCaseDiv(folder.name))
}

const aliases = {
  'ad-creative-strategist': 'Paid media',
  'ppc-campaign-strategist': 'Paid media',
  'programmatic-display-buyer': 'Paid media',
  'tracking-measurement-specialist': 'Paid media',
  'china-e-commerce-operator': 'Marketing',
  'cross-border-e-commerce-specialist': 'Marketing',
  'wechat-official-account-manager': 'Marketing',
  'senior-project-manager': 'Project management',
  'sre-site-reliability-engineer': 'Engineering',
  'blender-add-on-engineer': 'Game development',
  'model-qa-specialist': 'Specialized',
  'agentic-identity-trust-architect': 'Specialized',
  'french-consulting-market-navigator': 'Specialized',
  'healthcare-marketing-compliance-specialist': 'Specialized',
}
Object.assign(slugToDiv, aliases)

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(slugToDiv, null, 0) + '\n')
console.log('Wrote', out, Object.keys(slugToDiv).length, 'entries')

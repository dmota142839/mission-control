#!/usr/bin/env node
/**
 * One-shot: add identity.theme (category) and unique identity.display names where
 * Mission Control would collide on agents.name. Writes openclaw.json in place.
 *
 * Usage: node scripts/label-openclaw-agents.mjs [/path/to/openclaw.json]
 */
import fs from 'node:fs'
import path from 'node:path'

const configPath =
  process.argv[2] || path.join(process.env.HOME || '', '.openclaw', 'openclaw.json')

function labelAgent(a) {
  const id = a.id
  const identity = { ...(a.identity && typeof a.identity === 'object' ? a.identity : {}) }

  if (id.startsWith('bug-fix_')) {
    const roleTitle = a.name || id.replace(/^bug-fix_/, '')
    identity.name = `BF: ${roleTitle}`
    identity.theme = 'Workflow · Bug fix'
  } else if (id.startsWith('feature-dev_')) {
    const roleTitle = a.name || id.replace(/^feature-dev_/, '')
    identity.name = `FD: ${roleTitle}`
    identity.theme = 'Workflow · Feature dev'
  } else if (id.startsWith('security-audit_')) {
    const roleTitle = a.name || id.replace(/^security-audit_/, '')
    identity.name = `SA: ${roleTitle}`
    identity.theme = 'Workflow · Security audit'
  } else if (id.startsWith('mc-gateway-')) {
    const suf = id.replace('mc-gateway-', '').slice(0, 8)
    identity.name = `Gateway · ${suf}`
    identity.theme = 'Mission Control · Gateway'
  } else if (id.startsWith('mc-')) {
    const curName = identity.name || a.name || id
    const suf = id.slice(3, 11)
    identity.name = `${curName} · MC ${suf}`
    identity.theme = 'Mission Control · Session'
  } else if (id === 'main') {
    identity.name = 'Main'
    identity.theme = 'Core · Primary'
  } else if (id === 'mca-agent') {
    identity.name = 'MCA Project Assistant'
    identity.theme = 'Core · MCA project'
  } else if ((a.workspace || '').includes('agency-agents')) {
    identity.theme = 'Catalog · Agency skill'
  } else if (id === 'antfarm-medic') {
    identity.name = 'Antfarm Medic'
    identity.theme = 'Service · Antfarm'
  }

  const next = { ...a, identity }
  if (Object.keys(identity).length === 0) delete next.identity
  return next
}

function main() {
  if (!fs.existsSync(configPath)) {
    console.error('Missing file:', configPath)
    process.exit(1)
  }
  const raw = fs.readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(raw)
  const list = parsed.agents?.list
  if (!Array.isArray(list)) {
    console.error('No agents.list array')
    process.exit(1)
  }
  const backup = configPath + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-')
  fs.writeFileSync(backup, raw)
  console.log('Wrote backup:', backup)

  parsed.agents.list = list.map(labelAgent)
  const names = parsed.agents.list.map(
    (a) => a.identity?.name || a.name || a.id
  )
  const seen = new Set()
  for (const n of names) {
    if (seen.has(n)) {
      console.error('Duplicate display name after labeling:', n)
      process.exit(1)
    }
    seen.add(n)
  }
  fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2) + '\n')
  console.log('Updated', configPath, '—', list.length, 'agents,', names.length, 'unique display names.')
}

main()

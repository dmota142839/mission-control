/**
 * Maps OpenClaw agency-agents install slugs (directory names under ~/.openclaw/agency-agents)
 * to roster divisions that mirror [agency-agents](https://github.com/msitarzewski/agency-agents) README.
 *
 * Regenerate `agency-agents-division-map.json` after upstream adds/moves agents:
 *   node scripts/generate-agency-agents-division-map.mjs /path/to/agency-agents-clone
 */
import divisionMap from './agency-agents-division-map.json'

const MAP = divisionMap as Record<string, string>

export function getAgencyAgentsWorkspaceSlug(agent: {
  name?: string
  config?: unknown
}): string {
  const c =
    agent.config && typeof agent.config === 'object'
      ? (agent.config as Record<string, unknown>)
      : {}
  const ws = String(c.workspace ?? '')
  const m = ws.match(/\/agency-agents\/([^/]+)\/?$/)
  if (m) return m[1]
  return String(agent.name ?? '')
    .trim()
    .replace(/\s*·\s*MC\s+[a-f0-9-]+$/i, '')
    .trim()
    .split('/')
    .pop()!
    .toLowerCase()
    .replace(/\s+/g, '-')
}

/** Division label (e.g. "Engineering") or null if slug is unknown. */
export function getAgencyAgentsRosterDivision(agent: {
  name?: string
  role?: string
  config?: unknown
}): string | null {
  if (!String(agent.role || '').toLowerCase().includes('catalog ·')) return null
  const slug = getAgencyAgentsWorkspaceSlug(agent)
  return MAP[slug] ?? null
}

export const AGENCY_ROSTER_CATEGORY_PREFIX = 'Agency · '

export function agencyAgentsCategoryLabel(agent: {
  name?: string
  role?: string
  config?: unknown
}): string {
  const div = getAgencyAgentsRosterDivision(agent)
  return div ? `${AGENCY_ROSTER_CATEGORY_PREFIX}${div}` : 'Agency catalog'
}

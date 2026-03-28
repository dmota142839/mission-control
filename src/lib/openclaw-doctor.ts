import path from 'node:path'

export type OpenClawDoctorLevel = 'healthy' | 'warning' | 'error'
export type OpenClawDoctorCategory = 'config' | 'state' | 'security' | 'general'

export interface OpenClawDoctorStatus {
  level: OpenClawDoctorLevel
  category: OpenClawDoctorCategory
  healthy: boolean
  summary: string
  issues: string[]
  canFix: boolean
  raw: string
}

function normalizeLine(line: string): string {
  return line
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/^[\s│┃║┆┊╎╏]+/, '')
    .trim()
}

function isSessionAgingLine(line: string): boolean {
  return /^agent:[\w:-]+ \(\d+[mh] ago\)$/i.test(line)
}

function isPositiveOrInstructionalLine(line: string): boolean {
  return /^no .* warnings? detected/i.test(line) ||
    /^no issues/i.test(line) ||
    /^run:\s/i.test(line) ||
    /^all .* (healthy|ok|valid|passed)/i.test(line)
}

function isDecorativeLine(line: string): boolean {
  return /^[▄█▀░\s]+$/.test(line) || /openclaw doctor/i.test(line) || /🦞\s*openclaw\s*🦞/i.test(line)
}

function isStateDirectoryListLine(line: string): boolean {
  return /^(?:\$OPENCLAW_HOME(?:\/\.openclaw)?|~\/\.openclaw|\/\S+)$/.test(line)
}

function normalizeFsPath(candidate: string): string {
  return path.resolve(candidate.trim())
}

function normalizeDisplayedPath(candidate: string, stateDir: string): string {
  const trimmed = candidate.trim()
  if (!trimmed) return trimmed
  if (trimmed === '~/.openclaw') return stateDir
  if (trimmed === '$OPENCLAW_HOME' || trimmed === '$OPENCLAW_HOME/.openclaw') return stateDir
  return trimmed
}

function stripForeignStateDirectoryWarning(rawOutput: string, stateDir?: string): string {
  if (!stateDir) return rawOutput

  const normalizedStateDir = normalizeFsPath(stateDir)
  const lines = rawOutput.split(/\r?\n/)
  const kept: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const normalized = normalizeLine(line)

    if (!/multiple state directories detected/i.test(normalized)) {
      kept.push(line)
      continue
    }

    const blockLines = [line]
    let cursor = index + 1
    while (cursor < lines.length) {
      const nextLine = lines[cursor] ?? ''
      const nextNormalized = normalizeLine(nextLine)
      if (!nextNormalized) {
        blockLines.push(nextLine)
        cursor += 1
        continue
      }
      if (/^(active state dir:|[-*]\s+(?:\/|~\/|\$OPENCLAW_HOME)|\|)/i.test(nextNormalized)) {
        blockLines.push(nextLine)
        cursor += 1
        continue
      }
      break
    }

    const listedDirs = blockLines
      .map(normalizeLine)
      .filter(entry => /^[-*]\s+/.test(entry))
      .map(entry => entry.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean)
      .map(entry => normalizeDisplayedPath(entry, normalizedStateDir))

    const foreignDirs = listedDirs.filter(entry => normalizeFsPath(entry) !== normalizedStateDir)
    const onlyForeignDirs = foreignDirs.length > 0

    if (!onlyForeignDirs) {
      kept.push(...blockLines)
    }

    index = cursor - 1
  }

  return kept.join('\n')
}

function detectCategory(raw: string, issues: string[]): OpenClawDoctorCategory {
  const haystack = `${raw}\n${issues.join('\n')}`.toLowerCase()

  if (/invalid config|config invalid|unrecognized key|invalid option/.test(haystack)) {
    return 'config'
  }

  if (/state integrity|orphan transcript|multiple state directories|session history/.test(haystack)) {
    return 'state'
  }

  if (/security audit|channel security|security /.test(haystack)) {
    return 'security'
  }

  return 'general'
}

/**
 * Informational bullets OpenClaw prints on a healthy, running gateway (locks, other services,
 * LAN bind notice, etc.). These are not actionable Mission Control incidents — hide them so the
 * doctor banner does not stay up forever on a normal setup.
 */
function isInformationalDoctorIssue(issue: string): boolean {
  const s = issue.toLowerCase()

  if (/^found\s+\d+\s+session lock file/i.test(issue)) return true
  if (/\bpid=\d+\s*\(alive\)|\bstale=no\b|\bstale=yes\b/.test(s)) return true
  if (/\.jsonl\.lock\b/.test(issue)) return true

  if (/\/agents\/[^/\s]+\/sessions\//i.test(issue)) {
    if (!/missing|orphan|transcript|not referenced|prune|cleanup|enforce|integrity/i.test(s)) return true
  }

  if (/\.service\b/.test(issue)) return true
  if (/\(user,\s*unit:/i.test(issue)) return true

  if (/^warning:\s*gateway bound/i.test(s)) return true
  if (/gateway bound to\s*["']?lan["']?/.test(s) && /network-accessible|0\.0\.0\.0/.test(s)) return true
  if (/ensure your auth credentials are strong/i.test(s)) return true

  if (/requireMention|botfather|\/setprivacy|telegram default:/i.test(s)) return true

  if (/systemctl.*disable.*openclaw-gateway|rm ~\/\.config\/systemd\/user\/openclaw-gateway/i.test(s)) {
    return true
  }

  return false
}

export function parseOpenClawDoctorOutput(
  rawOutput: string,
  exitCode = 0,
  options: { stateDir?: string } = {}
): OpenClawDoctorStatus {
  const raw = stripForeignStateDirectoryWarning(rawOutput.trim(), options.stateDir).trim()
  const lines = raw
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)

  const issues = lines
    .filter(line => /^[-*]\s+/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .filter(line => !isSessionAgingLine(line) && !isStateDirectoryListLine(line) && !isPositiveOrInstructionalLine(line))

  const filteredIssues = issues.filter(line => !isInformationalDoctorIssue(line))

  const fatalSignals = /invalid config|\bfailed\b|\berror\b/i.test(raw)

  let level: OpenClawDoctorLevel = 'healthy'
  if (exitCode !== 0) {
    level = fatalSignals ? 'error' : 'warning'
  } else if (filteredIssues.length > 0) {
    level = 'warning'
  } else if (/invalid config|config invalid|unrecognized key|invalid option/i.test(raw)) {
    level = 'warning'
  }

  const category = detectCategory(raw, filteredIssues)

  const summary =
    level === 'healthy'
      ? 'OpenClaw doctor reports a healthy configuration.'
      : filteredIssues[0] ||
        lines.find(line =>
          !/^run:/i.test(line) &&
          !/^file:/i.test(line) &&
          !isSessionAgingLine(line) &&
          !isDecorativeLine(line)
        ) ||
        'OpenClaw doctor reported configuration issues.'

  const canFix = level !== 'healthy' || /openclaw doctor --fix/i.test(raw)

  return {
    level,
    category,
    healthy: level === 'healthy',
    summary,
    issues: filteredIssues,
    canFix,
    raw,
  }
}

// src/cli/theme.ts
// Terminal styling con ANSI codes — sin dependencias externas

const ESC = '\x1b['
const RESET = `${ESC}0m`

// Colores
const colors = {
  reset: RESET,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  italic: `${ESC}3m`,
  underline: `${ESC}4m`,

  // Foreground
  black: `${ESC}30m`,
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  blue: `${ESC}34m`,
  magenta: `${ESC}35m`,
  cyan: `${ESC}36m`,
  white: `${ESC}37m`,
  gray: `${ESC}90m`,

  // Bright foreground
  brightRed: `${ESC}91m`,
  brightGreen: `${ESC}92m`,
  brightYellow: `${ESC}93m`,
  brightBlue: `${ESC}94m`,
  brightMagenta: `${ESC}95m`,
  brightCyan: `${ESC}96m`,
  brightWhite: `${ESC}97m`,

  // Background
  bgRed: `${ESC}41m`,
  bgGreen: `${ESC}42m`,
  bgYellow: `${ESC}43m`,
  bgBlue: `${ESC}44m`,
  bgMagenta: `${ESC}45m`,
  bgCyan: `${ESC}46m`,
  bgWhite: `${ESC}47m`,
  bgGray: `${ESC}100m`,
}

// Compose helper: c('bold', 'green', 'texto') → "\x1b[1m\x1b[32mtexto\x1b[0m"
function c(...args: string[]): string {
  const text = args[args.length - 1]
  const codes = args.slice(0, -1)
  return codes.map(code => (colors as any)[code] || '').join('') + text + RESET
}

// Status indicators
const status = {
  ok: (msg: string) => c('green', `✅ ${msg}`),
  err: (msg: string) => c('red', `❌ ${msg}`),
  warn: (msg: string) => c('yellow', `⚠️  ${msg}`),
  info: (msg: string) => c('cyan', `ℹ️  ${msg}`),
  pending: (msg: string) => c('yellow', `⏳ ${msg}`),
  success: (msg: string) => c('brightGreen', `✅ ${msg}`),
}

// Progress bar
function progressBar(current: number, max: number, width: number = 20): string {
  const pct = Math.min(1, current / max)
  const filled = Math.round(pct * width)
  const empty = width - filled
  const bar = c('brightGreen', '█'.repeat(filled)) + c('gray', '░'.repeat(empty))
  const pctStr = c('bold', `${Math.round(pct * 100)}%`)
  return `[${bar}] ${pctStr} (${current}/${max})`
}

// Table renderer
interface TableColumn {
  header: string
  key: string
  width?: number
  align?: 'left' | 'right' | 'center'
  format?: (val: any) => string
}

function table(columns: TableColumn[], rows: any[]): string {
  // Calculate widths
  const cols = columns.map(col => ({
    ...col,
    width: col.width || Math.max(
      col.header.length,
      ...rows.map(r => String(col.format ? col.format(r[col.key]) : r[col.key] ?? '').length)
    ) + 2,
  }))

  const lines: string[] = []

  // Header
  const headerLine = cols.map(col => {
    const padded = col.align === 'right'
      ? col.header.padStart(col.width!)
      : col.header.padEnd(col.width!)
    return c('bold', 'white', padded)
  }).join(c('dim', ' │ '))
  lines.push(headerLine)

  // Separator
  const sepLine = cols.map(col => '─'.repeat(col.width!)).join(c('dim', '─┼─'))
  lines.push(c('dim', sepLine))

  // Rows
  for (const row of rows) {
    const line = cols.map(col => {
      const raw = col.format ? col.format(row[col.key]) : String(row[col.key] ?? '')
      const padded = col.align === 'right'
        ? raw.padStart(col.width!)
        : raw.padEnd(col.width!)
      return padded
    }).join(c('dim', ' │ '))
    lines.push(line)
  }

  return lines.join('\n')
}

// Box drawing
function box(title: string, content: string, opts?: { width?: number; color?: string }): string {
  const w = opts?.width || 56
  const clr = opts?.color || 'cyan'
  const border = (colors as any)[clr] || ''
  const reset = RESET

  const topLine = `${border}╔${'═'.repeat(w - 2)}╗${reset}`
  const bottomLine = `${border}╚${'═'.repeat(w - 2)}╝${reset}`
  const titleLine = `${border}║${reset} ${c('bold', 'brightWhite', title.padEnd(w - 4))} ${border}║${reset}`
  const sepLine = `${border}╠${'═'.repeat(w - 2)}╣${reset}`

  const contentLines = content.split('\n').map(line => {
    const trimmed = line.substring(0, w - 4)
    return `${border}║${reset}  ${trimmed.padEnd(w - 4)}  ${border}║${reset}`
  })

  return [topLine, titleLine, sepLine, ...contentLines, bottomLine].join('\n')
}

// Spinner frames
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export { c, colors, status, progressBar, table, box, spinnerFrames, RESET }

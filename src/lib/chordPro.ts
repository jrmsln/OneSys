import { toNashvilleNumbers, transposeChords } from './songCharts'

export type ChordProLine = { chord: string; text: string }[]

export function transformChordPro(source: string, fromKey: string, toKey: string, notationMode: 'chords' | 'nashville') {
  return source.replace(/\[([^\]]+)\]/g, (_match, chord: string) => {
    const transformed = notationMode === 'nashville' ? toNashvilleNumbers(chord, fromKey) : transposeChords(chord, fromKey, toKey)
    return `[${transformed}]`
  })
}

export function parseChordProLine(line: string): ChordProLine {
  const tokens: ChordProLine = []
  let cursor = 0
  const chordPattern = /\[([^\]]+)\]/g
  let match: RegExpExecArray | null
  while ((match = chordPattern.exec(line))) {
    const textBefore = line.slice(cursor, match.index)
    if (textBefore || !tokens.length) tokens.push({ chord: '', text: textBefore })
    tokens.push({ chord: match[1], text: '' })
    cursor = match.index + match[0].length
  }
  const trailingText = line.slice(cursor)
  if (trailingText || !tokens.length) {
    const last = tokens[tokens.length - 1]
    if (last && last.text === '' && last.chord) last.text = trailingText
    else tokens.push({ chord: '', text: trailingText })
  }
  return tokens
}

export function visibleChordProLines(source: string, fromKey: string, toKey: string, notationMode: 'chords' | 'nashville') {
  return transformChordPro(source, fromKey, toKey, notationMode).split('\n').filter((line) => !/^\s*\{(?:title|artist|key|meta):/i.test(line))
}

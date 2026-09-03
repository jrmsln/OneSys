export type ChartSection = { name: string; lyrics: string; chords: string }

export const SONG_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

const KEY_PITCH: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }
const PITCH_KEY = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

function chordRoot(root: string, semitones: number) {
  return PITCH_KEY[(KEY_PITCH[root] + semitones + 12) % 12]
}

function transformChords(text: string, transform: (root: string, quality: string, bass: string | undefined) => string) {
  return text.split('\n').map((line) => line.replace(/(^|\s)([A-G](?:#|b)?)(?:(maj|min|m|dim|aug|sus|add)?\d*(?:[#b]\d+)?)?(?:\/([A-G](?:#|b)?))?(?=\s|$|[|,;:])/g, (_match, prefix: string, root: string, quality = '', bass: string | undefined) => `${prefix}${transform(root, quality, bass)}`)).join('\n')
}

export function transposeChords(text: string, fromKey: string, toKey: string) {
  const semitones = (KEY_PITCH[toKey] ?? 0) - (KEY_PITCH[fromKey] ?? 0)
  return transformChords(text, (root, quality, bass) => `${chordRoot(root, semitones)}${quality}${bass ? `/${chordRoot(bass, semitones)}` : ''}`)
}

export function toNashvilleNumbers(text: string, key: string) {
  const tonic = KEY_PITCH[key] ?? 0
  return transformChords(text, (root, quality, bass) => {
    const distance = (KEY_PITCH[root] - tonic + 12) % 12
    const numbers: Record<number, string> = { 0: '1', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4', 6: 'b5', 7: '5', 8: 'b6', 9: '6', 10: 'b7', 11: '7' }
    const bassDistance = bass ? (KEY_PITCH[bass] - tonic + 12) % 12 : null
    return `${numbers[distance]}${quality}${bassDistance === null ? '' : `/${numbers[bassDistance]}`}`
  })
}

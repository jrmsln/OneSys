import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseChordProLine, transformChordPro, visibleChordProLines } from '../lib/chordPro'
import { SONG_KEYS } from '../lib/songCharts'
import { SongImportModal } from './SongImportModal'

interface SongChart { id: string; title: string; artist: string | null; source_url: string | null; lyrics: string | null; chords: string | null; song_key: string | null; notation_mode: 'chords' | 'nashville'; chart_sections: { name: string; lyrics: string; chords: string }[] | null; chordpro_source: string | null }

function initialSource(song: SongChart) {
  if (song.chordpro_source) return song.chordpro_source
  const sections = song.chart_sections?.length ? song.chart_sections : [{ name: 'Main', lyrics: song.lyrics || '', chords: song.chords || '' }]
  return `{title: ${song.title}}\n${song.artist ? `{artist: ${song.artist}}\n` : ''}{key: ${song.song_key || 'C'}}\n\n${sections.map((section) => `{section: ${section.name}}\n${section.chords}\n${section.lyrics}`).join('\n\n')}`
}

export function ChordProChartModal({ song, canEdit, onClose, onSaved }: { song: SongChart; canEdit: boolean; onClose: () => void; onSaved: (song: SongChart) => void }) {
  const [source, setSource] = useState(initialSource(song))
  const [originalKey, setOriginalKey] = useState(song.song_key || 'C')
  const [viewKey, setViewKey] = useState(song.song_key || 'C')
  const [notationMode, setNotationMode] = useState<'chords' | 'nashville'>(song.notation_mode || 'chords')
  const [editing, setEditing] = useState(false)
  const [performanceMode, setPerformanceMode] = useState(false)
  const [songImportOpen, setSongImportOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function saveChart() {
    setSaving(true)
    setMessage('')
    const { data, error } = await supabase.from('songs').update({ chordpro_source: source, song_key: originalKey, notation_mode: notationMode }).eq('id', song.id).select('id, title, artist, source_url, lyrics, chords, song_key, notation_mode, chart_sections, chordpro_source').single()
    if (error) setMessage(error.message)
    else { onSaved(data as SongChart); setEditing(false); setMessage('Chart saved.') }
    setSaving(false)
  }

  const previewSource = transformChordPro(source, originalKey, viewKey, notationMode)
  const previewLines = visibleChordProLines(previewSource, originalKey, viewKey, notationMode)

  return <div className="modal-backdrop playlist-modal-backdrop" onClick={onClose}><section className={performanceMode ? 'song-chart-modal chordpro-modal performance-mode' : 'song-chart-modal chordpro-modal'} role="dialog" aria-modal="true" aria-labelledby="chordpro-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">SONG CHART</p><h2 id="chordpro-title">{song.title}</h2><p className="detail-date">{song.artist || 'Artist not added'}</p></div><div className="chart-heading-actions"><button className="more-button" onClick={() => setPerformanceMode((current) => !current)}>{performanceMode ? 'Exit performance' : 'Performance view'}</button><button className="modal-close" onClick={onClose} aria-label="Close song chart">x</button></div></div>{!performanceMode && <div className="chart-toolbar"><label>Original key<select value={originalKey} disabled={!editing} onChange={(event) => { setOriginalKey(event.target.value); setViewKey(event.target.value) }}>{SONG_KEYS.map((key) => <option key={key}>{key}</option>)}</select></label><label>View key<select value={viewKey} onChange={(event) => setViewKey(event.target.value)}>{SONG_KEYS.map((key) => <option key={key}>{key}</option>)}</select></label><div className="notation-toggle"><button className={notationMode === 'chords' ? 'selected' : ''} onClick={() => setNotationMode('chords')}>Chords</button><button className={notationMode === 'nashville' ? 'selected' : ''} onClick={() => setNotationMode('nashville')}>Nashville</button></div>{canEdit && <button className="more-button" onClick={() => setEditing((current) => !current)}>{editing ? 'Preview chart' : 'Edit ChordPro'}</button>}{canEdit && <button className="more-button" onClick={() => setSongImportOpen(true)}>Import Song</button>}</div>}{message && <p className="form-message">{message}</p>}<div className={editing ? 'chordpro-workspace editing' : 'chordpro-workspace'}>{!performanceMode && <div className="chordpro-source-panel"><div className="chart-panel-label"><span>CHORDPRO SOURCE</span><small>Use [G] before a lyric word and {`{section: Chorus}`} for sections.</small></div><textarea value={source} readOnly={!editing} onChange={(event) => setSource(event.target.value)} spellCheck={false} aria-label="ChordPro source" /></div>}<div className="chordpro-preview-panel"><div className="chart-panel-label"><span>{performanceMode ? 'PERFORMANCE CHART' : 'LIVE PREVIEW'}</span><small>{notationMode === 'nashville' ? 'Nashville numbers' : `Key of ${viewKey}`}</small></div><div className="chordpro-preview">{previewLines.map((line, index) => /^\s*\{section:/i.test(line) ? <h3 key={index}>{line.replace(/^\s*\{section:\s*|\}\s*$/gi, '')}</h3> : <div className="chordpro-line" key={index}>{parseChordProLine(line).map((token, tokenIndex) => <span className="chordpro-token" key={tokenIndex}><b>{token.chord}</b><span>{token.text || '\u00a0'}</span></span>)}</div>)}</div></div></div>{editing && <div className="chart-editor-actions"><button className="more-button" onClick={() => setSource(initialSource(song))}>Reset source</button><button className="primary-button" disabled={saving} onClick={() => void saveChart()}>{saving ? 'Saving...' : 'Save finalized chart'}</button></div>}{song.source_url && <a className="source-link" href={song.source_url} target="_blank" rel="noreferrer">Open source</a>}{songImportOpen && <SongImportModal onClose={() => setSongImportOpen(false)} onImported={(chordpro, importedKey) => { setSource(chordpro); if (importedKey) { setOriginalKey(importedKey); setViewKey(importedKey) }; setEditing(true) }} />}</section></div>
}

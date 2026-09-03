import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { SONG_KEYS, toNashvilleNumbers, transposeChords } from '../lib/songCharts'
import type { ChartSection } from '../lib/songCharts'

interface SongChart { id: string; title: string; artist: string | null; source_url: string | null; lyrics: string | null; chords: string | null; song_key: string | null; notation_mode: 'chords' | 'nashville'; chart_sections: ChartSection[] | null }

export function SongChartModal({ song, canEdit, onClose, onSaved }: { song: SongChart; canEdit: boolean; onClose: () => void; onSaved: (song: SongChart) => void }) {
  const initialSections = song.chart_sections?.length ? song.chart_sections : [{ name: 'Main', lyrics: song.lyrics || '', chords: song.chords || '' }]
  const [sections, setSections] = useState<ChartSection[]>(initialSections)
  const [songKey, setSongKey] = useState(song.song_key || 'C')
  const [displayKey, setDisplayKey] = useState(song.song_key || 'C')
  const [notationMode, setNotationMode] = useState<'chords' | 'nashville'>(song.notation_mode || 'chords')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function updateSection(index: number, field: keyof ChartSection, value: string) {
    setSections((current) => current.map((section, sectionIndex) => sectionIndex === index ? { ...section, [field]: value } : section))
  }

  function addSection() { setSections((current) => [...current, { name: `Section ${current.length + 1}`, lyrics: '', chords: '' }]) }
  function removeSection(index: number) { setSections((current) => current.length === 1 ? current : current.filter((_, sectionIndex) => sectionIndex !== index)) }

  async function saveChart() {
    setSaving(true)
    setMessage('')
    const firstSection = sections[0]
    const updates = { lyrics: firstSection?.lyrics || null, chords: firstSection?.chords || null, song_key: songKey, notation_mode: notationMode, chart_sections: sections }
    const { data, error } = await supabase.from('songs').update(updates).eq('id', song.id).select('id, title, artist, source_url, lyrics, chords, song_key, notation_mode, chart_sections').single()
    if (error) setMessage(error.message)
    else { onSaved(data as SongChart); setEditing(false); setDisplayKey(songKey); setMessage('Chart saved.') }
    setSaving(false)
  }

  function displayedChords(chords: string) {
    return notationMode === 'nashville' ? toNashvilleNumbers(chords, songKey) : transposeChords(chords, songKey, displayKey)
  }

  return <div className="modal-backdrop playlist-modal-backdrop" onClick={onClose}><section className="song-chart-modal" role="dialog" aria-modal="true" aria-labelledby="song-chart-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">SONG CHART</p><h2 id="song-chart-title">{song.title}</h2><p className="detail-date">{song.artist || 'Artist not added'}</p></div><button className="modal-close" onClick={onClose} aria-label="Close song chart">x</button></div><div className="chart-toolbar"><label>Original key<select value={songKey} disabled={!editing} onChange={(event) => { setSongKey(event.target.value); setDisplayKey(event.target.value) }}>{SONG_KEYS.map((key) => <option key={key}>{key}</option>)}</select></label><label>View key<select value={displayKey} disabled={!editing && notationMode === 'nashville'} onChange={(event) => setDisplayKey(event.target.value)}>{SONG_KEYS.map((key) => <option key={key}>{key}</option>)}</select></label><div className="notation-toggle"><button className={notationMode === 'chords' ? 'selected' : ''} onClick={() => setNotationMode('chords')}>Chords</button><button className={notationMode === 'nashville' ? 'selected' : ''} onClick={() => setNotationMode('nashville')}>Nashville</button></div>{canEdit && <button className="more-button" onClick={() => setEditing((current) => !current)}>{editing ? 'Cancel edit' : 'Edit chart'}</button>}</div>{message && <p className="form-message">{message}</p>}{editing ? <div className="chart-editor">{sections.map((section, index) => <div className="chart-section-editor" key={`${index}-${section.name}`}><div className="section-editor-heading"><input value={section.name} onChange={(event) => updateSection(index, 'name', event.target.value)} aria-label={`Section ${index + 1} name`} /><button className="more-button" onClick={() => removeSection(index)} disabled={sections.length === 1}>Remove</button></div><label>Lyrics<textarea value={section.lyrics} onChange={(event) => updateSection(index, 'lyrics', event.target.value)} rows={8} /></label><label>Chords<textarea value={section.chords} onChange={(event) => updateSection(index, 'chords', event.target.value)} rows={4} placeholder="C  G/B  Am  F" /></label></div>)}<div className="chart-editor-actions"><button className="more-button" onClick={addSection}>+ Add section</button><button className="primary-button" disabled={saving} onClick={() => void saveChart()}>{saving ? 'Saving...' : 'Save chart'}</button></div></div> : <div className="chart-section-list">{sections.map((section, index) => <section className="chart-section" key={`${index}-${section.name}`}><h3>{section.name}</h3><div className="chart-columns"><pre>{section.lyrics || 'No lyrics added yet.'}</pre><pre>{displayedChords(section.chords) || 'No chords added yet.'}</pre></div></section>)}</div>}{song.source_url && <a className="source-link" href={song.source_url} target="_blank" rel="noreferrer">Open source</a>}</section></div>
}

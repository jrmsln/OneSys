import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface DetectedSong { title: string; artist: string | null }

function songKey(title: string, artist: string | null) {
  return `${title.trim().replace(/\s+/g, ' ').toLowerCase()}::${(artist || '').trim().replace(/\s+/g, ' ').toLowerCase()}`
}

export function PlaylistImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [url, setUrl] = useState('')
  const [songs, setSongs] = useState<DetectedSong[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function detectSongs() {
    setLoading(true)
    setMessage('')

    const trimmedUrl = url.trim()
    if (/spotify\.com|open\.spotify|spotify:/.test(trimmedUrl)) {
      setSongs([])
      setSelected([])
      setMessage('This playlist type is temporarily unavailable while we fix the integration.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.functions.invoke('import-playlist', { body: { url: trimmedUrl } })
    if (error) setMessage(error.message)
    else {
      const detectedSongs = (data?.songs || []) as DetectedSong[]
      setSongs(detectedSongs)
      setSelected(detectedSongs.map((_, index) => index))
      if (!detectedSongs.length) setMessage('No songs were found in that playlist.')
    }
    setLoading(false)
  }

  async function addSelectedSongs() {
    setSaving(true)
    setMessage('')
    const { data: userData } = await supabase.auth.getUser()
    const records = selected.map((index) => songs[index]).filter(Boolean).map((song) => ({ title: song.title, artist: song.artist, created_by: userData.user?.id }))
    if (!records.length || !userData.user) { setMessage('Select at least one song.'); setSaving(false); return }
    const { data: existingSongs, error: lookupError } = await supabase.from('songs').select('title, artist')
    if (lookupError) { setMessage(lookupError.message); setSaving(false); return }
    const existingKeys = new Set((existingSongs || []).map((song) => songKey(song.title, song.artist)))
    const seenKeys = new Set<string>()
    const newRecords = records.filter((song) => {
      const key = songKey(song.title, song.artist)
      if (existingKeys.has(key) || seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })
    const skippedCount = records.length - newRecords.length
    if (!newRecords.length) { setMessage('All selected songs are already in your library.'); setSaving(false); return }
    const { error } = await supabase.from('songs').insert(newRecords)
    if (error) setMessage(error.message)
    else if (skippedCount) setMessage(`${skippedCount} duplicate song${skippedCount === 1 ? '' : 's'} skipped. ${newRecords.length} added.`)
    else { onImported(); onClose() }
    if (!error && skippedCount) { onImported(); setSelected([]) }
    setSaving(false)
  }

  function toggleSong(index: number) { setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]) }

  return <div className="modal-backdrop playlist-modal-backdrop" onClick={onClose}><section className="playlist-modal" role="dialog" aria-modal="true" aria-labelledby="playlist-import-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">MUSIC LIBRARY</p><h2 id="playlist-import-title">Import from playlist</h2></div><button className="modal-close" onClick={onClose} aria-label="Close">x</button></div><p className="form-help">Paste a YouTube playlist link. We will show the songs before adding anything.</p><div className="playlist-input"><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/playlist?list=..." /><button className="primary-button" disabled={!url || loading} onClick={() => void detectSongs()}>{loading ? 'Finding songs...' : 'Find songs'}</button></div>{message && <p className="form-error">{message}</p>}{songs.length > 0 && <><div className="import-summary"><strong>{selected.length} of {songs.length} selected</strong><button className="more-button" onClick={() => setSelected(selected.length === songs.length ? [] : songs.map((_, index) => index))}>{selected.length === songs.length ? 'Clear all' : 'Select all'}</button></div><div className="detected-song-list">{songs.map((song, index) => <label className="detected-song" key={`${song.title}-${index}`}><input type="checkbox" checked={selected.includes(index)} onChange={() => toggleSong(index)} /><span className="song-mark">{index + 1}</span><span className="service-info"><strong>{song.title}</strong><small>{song.artist || 'Artist not found'}</small></span></label>)}</div><button className="auth-submit" disabled={!selected.length || saving} onClick={() => void addSelectedSongs()}>{saving ? 'Adding songs...' : `Add ${selected.length} selected songs`} <span>-&gt;</span></button></>}</section></div>
}


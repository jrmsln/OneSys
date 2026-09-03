import { useState } from 'react'
import { parseChordProLine } from '../lib/chordPro'
import { supabase } from '../lib/supabase'

interface ImportedSong { title: string; artist: string; key: string; capo: string; confidence: string; chordpro: string; sourceUrl: string }

export function SongImportModal({ onClose, onImported }: { onClose: () => void; onImported: (chordpro: string, key: string) => void }) {
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<ImportedSong | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function importSong() {
    setLoading(true); setMessage(''); setPreview(null)
    const { data, error } = await supabase.functions.invoke('import-song', { body: { url: url.trim() } })
    if (error) setMessage(error.message)
    else if (data?.song) setPreview(data.song as ImportedSong)
    else setMessage('The source page did not contain an importable song.')
    setLoading(false)
  }

  function useImportedChart() {
    if (!preview) return
    onImported(preview.chordpro, preview.key)
    onClose()
  }

  function renderPreview(source: string) {
    return source.split('\n').filter((line) => !/^\s*\{(?:title|artist|key|meta):/i.test(line)).map((line, index) => {
      if (/^\s*\{section:/i.test(line)) return <h4 key={index}>{line.replace(/^\s*\{section:\s*|\}\s*$/gi, '')}</h4>
      return <div className="chordpro-line" key={index}>{parseChordProLine(line).map((token, tokenIndex) => <span className="chordpro-token" key={tokenIndex}><b>{token.chord}</b><span>{token.text || '\u00a0'}</span></span>)}</div>
    })
  }

  return <div className="modal-backdrop playlist-modal-backdrop" onClick={onClose}><section className="song-import-modal" role="dialog" aria-modal="true" aria-labelledby="song-import-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">SONG CHART</p><h2 id="song-import-title">Import chart from URL</h2></div><button className="modal-close" onClick={onClose} aria-label="Close import">x</button></div>{preview ? <><div className="import-preview-heading"><div><p className="eyebrow">IMPORT PREVIEW</p><h3>{preview.title}</h3><p>{preview.artist || 'Artist not found'}{preview.key && ` - Key ${preview.key}`}{preview.capo && ` - Capo ${preview.capo}`}</p></div><span className="import-confidence">Review before using</span></div><div className="import-preview-source"><label>ChordPro source<textarea value={preview.chordpro} onChange={(event) => setPreview({ ...preview, chordpro: event.target.value })} spellCheck={false} /></label><div><p className="eyebrow">RENDERED PREVIEW</p><div className="chordpro-preview">{renderPreview(preview.chordpro)}</div></div></div><p className="form-help">Correct the source if needed. It will be placed into the current chart, not saved yet.</p><div className="import-modal-actions"><button className="more-button" onClick={() => setPreview(null)}>Cancel</button><button className="primary-button" onClick={useImportedChart}>Use in chart</button></div></> : <><p className="form-help">Paste a supported song page URL. The result will appear in this chart for review before saving.</p><div className="song-import-input"><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /><button className="primary-button" disabled={!url.trim() || loading} onClick={() => void importSong()}>{loading ? 'Importing...' : 'Import'}</button></div></>}{message && <p className="form-error">{message}</p>}</section></div>
}

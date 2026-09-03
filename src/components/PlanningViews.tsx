import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Service { id: string; title: string; service_date: string; start_time: string; status: string; notes: string | null; playlist_url: string | null }
interface Availability { id: string; available_date: string; is_available: boolean; note: string | null }
interface LineupMember { id: string; name: string; role: string }
interface SetlistSong { id: string; title: string; artist: string | null; position: number }

export function CalendarView({ onBack }: { onBack: () => void }) {
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [lineup, setLineup] = useState<LineupMember[]>([])
  const [setlist, setSetlist] = useState<SetlistSong[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { supabase.from('services').select('id, title, service_date, start_time, status, notes, playlist_url').is('archived_at', null).order('service_date').then(({ data }) => { setServices((data as Service[]) || []); setLoading(false) }) }, [])
  useEffect(() => {
    if (!selectedService) return
    Promise.all([
      supabase.from('service_assignments').select('id, role_id, profiles(full_name), music_roles(name)').eq('service_id', selectedService.id),
      supabase.from('setlists').select('id').eq('service_id', selectedService.id).is('archived_at', null).maybeSingle(),
    ]).then(async ([lineupResult, setlistResult]) => {
      setLineup((lineupResult.data || []).map((row: any) => ({ id: row.id, name: row.profiles?.full_name || 'Team member', role: row.music_roles?.name || 'Role' })))
      if (!setlistResult.data) { setSetlist([]); return }
      const { data: songs } = await supabase.from('setlist_songs').select('id, position, songs(title, artist)').eq('setlist_id', setlistResult.data.id).order('position')
      setSetlist((songs || []).map((row: any) => ({ id: row.id, position: row.position, title: row.songs?.title || 'Song', artist: row.songs?.artist || null })))
    })
  }, [selectedService])
  return <section className="services-view"><button className="back-link" onClick={onBack}>&lt;- Dashboard</button><div className="services-heading"><div><p className="eyebrow">TEAM SCHEDULE</p><h1>Calendar</h1><p>Tap a service to view its details.</p></div><span className="database-badge">LIVE FROM SUPABASE</span></div><div className="calendar-grid">{loading ? <p className="service-empty">Loading calendar...</p> : services.length === 0 ? <p className="service-empty">No services scheduled yet.</p> : services.map((service) => <button className="calendar-event panel" key={service.id} onClick={() => setSelectedService(service)}><p className="eyebrow">{new Date(service.service_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}</p><strong>{new Date(service.service_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong><h2>{service.title}</h2><p>{service.start_time.slice(0, 5)} <span className={'status ' + service.status}>{service.status}</span></p><small className="calendar-hint">View details -&gt;</small></button>)}</div>{selectedService && <div className="modal-backdrop" onClick={() => setSelectedService(null)}><section className="service-detail-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedService(null)}>x</button><p className="eyebrow">SERVICE DETAILS</p><h2>{selectedService.title}</h2><p className="detail-date">{new Date(selectedService.service_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {selectedService.start_time.slice(0, 5)}</p><div className="detail-description"><p className="eyebrow">TOPIC</p><p>{selectedService.title}</p></div><div className="detail-description"><p className="eyebrow">DESCRIPTION</p><p>{selectedService.notes || 'No description has been added for this service yet.'}</p></div>{selectedService.playlist_url && <div className="detail-description"><p className="eyebrow">PLAYLIST</p><a href={selectedService.playlist_url} target="_blank" rel="noreferrer">Open playlist</a></div>}<div className="detail-section"><p className="eyebrow">LINEUP</p>{lineup.length ? lineup.map((member) => <div className="detail-row" key={member.id}><strong>{member.name}</strong><span>{member.role}</span></div>) : <p className="detail-muted">The lineup has not been added yet.</p>}</div><div className="detail-section"><p className="eyebrow">SETLIST</p>{setlist.length ? setlist.map((song) => <div className="detail-row" key={song.id}><strong>{song.position}. {song.title}</strong><span>{song.artist || ''}</span></div>) : <p className="detail-muted">The setlist has not been added yet.</p>}</div><button className="primary-button" onClick={() => setSelectedService(null)}>Close</button></section></div>}</section>
}

export function AvailabilityView({ session, onBack }: { session: Session; onBack: () => void }) {
  const [records, setRecords] = useState<Availability[]>([])
  const [date, setDate] = useState('')
  const [available, setAvailable] = useState(true)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  async function load() { const { data } = await supabase.from('availability').select('id, available_date, is_available, note').eq('user_id', session.user.id).order('available_date'); setRecords((data as Availability[]) || []) }
  useEffect(() => { void load() }, [])
  async function save() { setMessage(''); const { error } = await supabase.from('availability').upsert({ user_id: session.user.id, available_date: date, is_available: available, note: note || null }, { onConflict: 'user_id,available_date' }); setMessage(error ? error.message : 'Availability saved.'); if (!error) { setDate(''); setNote(''); await load() } }
  return <section className="services-view"><button className="back-link" onClick={onBack}>&lt;- Dashboard</button><div className="services-heading"><div><p className="eyebrow">YOUR RESPONSE</p><h1>Availability</h1><p>Let the team know when you can serve.</p></div></div><div className="availability-layout"><div className="panel availability-form"><p className="eyebrow">ADD AVAILABILITY</p><h2>Can you serve?</h2><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><div className="availability-toggle"><button className={available ? 'toggle-option selected' : 'toggle-option'} onClick={() => setAvailable(true)}>Available</button><button className={!available ? 'toggle-option selected unavailable' : 'toggle-option'} onClick={() => setAvailable(false)}>Unavailable</button></div><label>Note <span>(optional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note for your director" /></label>{message && <p className="form-error">{message}</p>}<button className="primary-button" disabled={!date} onClick={() => void save()}>Save response</button></div><div className="panel"><p className="eyebrow">YOUR CALENDAR</p><h2>Saved responses</h2>{records.length === 0 ? <p className="service-empty">No availability responses yet.</p> : <div className="availability-list">{records.map((record) => <div className="availability-row" key={record.id}><time>{new Date(record.available_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time><strong className={record.is_available ? 'available' : 'unavailable'}>{record.is_available ? 'Available' : 'Unavailable'}</strong><small>{record.note || ''}</small></div>)}</div>}</div></div></section>
}

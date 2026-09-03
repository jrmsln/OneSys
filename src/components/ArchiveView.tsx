import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface ArchivedService { id: string; title: string; service_date: string; archived_at: string }
interface ArchivedSetlist { id: string; service_id: string; archived_at: string; serviceTitle: string }

export function ArchiveView({ onBack }: { onBack: () => void }) {
  const [services, setServices] = useState<ArchivedService[]>([])
  const [setlists, setSetlists] = useState<ArchivedSetlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const [restoringId, setRestoringId] = useState('')

  async function loadArchives() {
    setLoading(true)
    const [{ data: serviceData, error: serviceError }, { data: setlistData, error: setlistError }] = await Promise.all([
      supabase.from('services').select('id, title, service_date, archived_at').not('archived_at', 'is', null).order('archived_at', { ascending: false }),
      supabase.from('setlists').select('id, service_id, archived_at').not('archived_at', 'is', null).order('archived_at', { ascending: false }),
    ])
    if (serviceError || setlistError) setError(serviceError?.message || setlistError?.message || 'Unable to load archives.')
    const archivedServices = (serviceData as ArchivedService[]) || []
    const serviceMap = new Map(archivedServices.map((service) => [service.id, service.title]))
    setServices(archivedServices)
    setSetlists(((setlistData as { id: string; service_id: string; archived_at: string }[]) || []).map((setlist) => ({ ...setlist, serviceTitle: serviceMap.get(setlist.service_id) || 'Archived service' })))
    setLoading(false)
  }

  useEffect(() => { void loadArchives() }, [])

  async function unarchive(table: 'services' | 'setlists', id: string) {
    const actionId = `${table}:${id}`
    if (confirmId !== actionId) { setConfirmId(actionId); return }
    setRestoringId(actionId)
    const { error: restoreError } = await supabase.from(table).update({ archived_at: null }).eq('id', id)
    setError(restoreError?.message || '')
    setConfirmId('')
    if (!restoreError) await loadArchives()
    setRestoringId('')
  }

  return <section className="services-view archive-view"><button className="back-link" onClick={onBack}>&lt;- Dashboard</button><div className="services-heading"><div><p className="eyebrow">LEADERS ONLY</p><h1>Archives</h1><p>Archived services and setlists are kept here for reference.</p></div><button className="more-button" onClick={() => void loadArchives()}>Refresh <span>-&gt;</span></button></div>{error && <p className="form-error">{error}</p>}{loading ? <p className="service-empty">Loading archives...</p> : <div className="archive-grid"><div className="panel"><p className="eyebrow">SERVICES</p><h2>Archived services</h2>{services.length === 0 ? <p className="service-empty">No archived services.</p> : <div className="archive-list">{services.map((service) => { const actionId = `services:${service.id}`; return <div className="archive-row" key={service.id}><span className="archive-symbol">S</span><span className="service-info"><strong>{service.title}</strong><small>{new Date(service.service_date + 'T00:00:00').toLocaleDateString()} · Archived {new Date(service.archived_at).toLocaleDateString()}</small></span><button className="unarchive-button" onClick={() => void unarchive('services', service.id)} disabled={restoringId === actionId}>{confirmId === actionId ? 'Confirm' : 'Unarchive'}</button></div>})}</div>}</div><div className="panel"><p className="eyebrow">SETLISTS</p><h2>Archived setlists</h2>{setlists.length === 0 ? <p className="service-empty">No archived setlists.</p> : <div className="archive-list">{setlists.map((setlist) => { const actionId = `setlists:${setlist.id}`; return <div className="archive-row" key={setlist.id}><span className="archive-symbol">L</span><span className="service-info"><strong>{setlist.serviceTitle}</strong><small>Archived {new Date(setlist.archived_at).toLocaleDateString()}</small></span><button className="unarchive-button" onClick={() => void unarchive('setlists', setlist.id)} disabled={restoringId === actionId}>{confirmId === actionId ? 'Confirm' : 'Unarchive'}</button></div>})}</div>}</div></div>}</section>
}

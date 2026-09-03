import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function ProfileView({ session, onBack, installPrompt, installed, onInstall }: { session: Session; onBack: () => void; installPrompt: BeforeInstallPromptEvent | null; installed: boolean; onInstall: () => void }) {
  const [name, setName] = useState(session.user.user_metadata.full_name || '')
  const [message, setMessage] = useState('')
  async function save() { const { error } = await supabase.auth.updateUser({ data: { full_name: name } }); setMessage(error ? error.message : 'Profile updated.') }
  function installApp() {
    if (!installPrompt) { setMessage(installed ? 'Onesys is already installed.' : 'Use your browser menu and choose Add to Home screen.'); return }
    void onInstall()
  }
  return <section className="services-view"><button className="back-link" onClick={onBack}>&lt;- Dashboard</button><div className="services-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>Profile</h1><p>Keep your workspace identity up to date.</p></div></div><div className="panel profile-form"><p className="eyebrow">ACCOUNT DETAILS</p><h2>{session.user.email}</h2><label>Full name<input value={name} onChange={(event) => setName(event.target.value)} /></label>{message && <p className="form-error">{message}</p>}<button className="primary-button" onClick={() => void save()}>Save profile</button><div className="profile-install"><p className="eyebrow">APP INSTALLATION</p><p>Open Onesys from your home screen without the browser bar.</p><button className="outline-button" onClick={installApp}>{installed ? 'App installed' : 'Install Onesys'}</button></div></div></section>
}

export function ConflictsView({ session, onBack }: { session: Session; onBack: () => void }) {
  const [items, setItems] = useState<{ id: string; status: string; response_note: string | null; service_id: string }[]>([])
  useEffect(() => { supabase.from('service_assignments').select('id, status, response_note, service_id').eq('user_id', session.user.id).in('status', ['declined']).then(({ data }) => setItems(data || [])) }, [session.user.id])
  return <section className="services-view"><button className="back-link" onClick={onBack}>&lt;- Dashboard</button><div className="services-heading"><div><p className="eyebrow">TEAM COMMUNICATION</p><h1>Assignment conflicts</h1><p>Review assignments that need a conversation.</p></div></div><div className="panel"><p className="eyebrow">YOUR OPEN ITEMS</p>{items.length === 0 ? <p className="service-empty">No assignment conflicts. Your team is clear.</p> : items.map((item) => <div className="member-row" key={item.id}><span className="stat-dot orange"></span><span className="service-info"><strong>Assignment declined</strong><small>{item.response_note || 'No note provided'}</small></span></div>)}</div></section>
}

export function AssignmentsView({ session, onBack }: { session: Session; onBack: () => void }) {
  const [assignments, setAssignments] = useState<{ id: string; service_id: string; status: string; response_note: string | null; serviceName: string }[]>([])
  const [message, setMessage] = useState('')
  async function load() {
    const [{ data: assignmentData }, { data: serviceData }] = await Promise.all([
      supabase.from('service_assignments').select('id, service_id, status, response_note').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('services').select('id, title, service_date'),
    ])
    const services = serviceData || []
    setAssignments((assignmentData || []).map((assignment) => ({ ...assignment, serviceName: services.find((service) => service.id === assignment.service_id)?.title || 'Service' })))
  }
  useEffect(() => { void load() }, [session.user.id])
  async function respond(id: string, status: 'confirmed' | 'declined') {
    const { error } = await supabase.from('service_assignments').update({ status }).eq('id', id).eq('user_id', session.user.id)
    setMessage(error ? error.message : `Assignment ${status}.`)
    if (!error) await load()
  }
  return <section className="services-view"><button className="back-link" onClick={onBack}>&lt;- Dashboard</button><div className="services-heading"><div><p className="eyebrow">YOUR TEAM COMMITMENTS</p><h1>Assignments</h1><p>Confirm the services you are scheduled to play.</p></div></div><div className="panel"><p className="eyebrow">MY ASSIGNMENTS</p>{assignments.length === 0 ? <p className="service-empty">No assignments yet.</p> : assignments.map((assignment) => <div className="member-row assignment-row" key={assignment.id}><span className="service-info"><strong>{assignment.serviceName}</strong><small>{assignment.response_note || 'Response needed'}</small></span><span className={'status ' + assignment.status}>{assignment.status}</span>{assignment.status === 'pending' && <span className="assignment-actions"><button onClick={() => void respond(assignment.id, 'confirmed')}>Confirm</button><button onClick={() => void respond(assignment.id, 'declined')}>Decline</button></span>}</div>)}{message && <p className="form-error">{message}</p>}</div></section>
}

export function AdminView({ onBack }: { onBack: () => void }) {
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([])
  const [types, setTypes] = useState<{ user_id: string; account_type: string }[]>([])
  const [draftTypes, setDraftTypes] = useState<Record<string, string>>({})
  const [confirmingId, setConfirmingId] = useState('')
  const [confirmingRemove, setConfirmingRemove] = useState('')
  const [savingId, setSavingId] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const [{ data: memberData }, { data: typeData }] = await Promise.all([supabase.from('profiles').select('id, full_name').order('full_name'), supabase.from('account_types').select('user_id, account_type')])
    setMembers(memberData || [])
    setTypes(typeData || [])
  }

  useEffect(() => { void load() }, [])

  function cancelEdit(userId: string) {
    setDraftTypes((current) => ({ ...current, [userId]: '' }))
    setConfirmingId('')
    setMessage('Change cancelled. Nothing was saved.')
  }

  async function saveType(userId: string) {
    const accountType = draftTypes[userId]
    if (!accountType) return
    setSavingId(userId)
    setMessage('')
    const { error } = await supabase.from('account_types').insert({ user_id: userId, account_type: accountType })
    setMessage(error ? error.message : 'Account type saved.')
    if (!error) setDraftTypes((current) => ({ ...current, [userId]: '' }))
    setConfirmingId('')
    await load()
    setSavingId('')
  }

  async function removeType(userId: string, accountType: string) {
    const removeKey = `${userId}:${accountType}`
    if (confirmingRemove !== removeKey) { setConfirmingRemove(removeKey); return }
    setSavingId(removeKey)
    setMessage('')
    const { error } = await supabase.from('account_types').delete().eq('user_id', userId).eq('account_type', accountType)
    setMessage(error ? error.message : 'Account type removed.')
    setConfirmingRemove('')
    await load()
    setSavingId('')
  }

  return <section className="services-view admin-view"><button className="back-link" onClick={onBack}>&lt;- Dashboard</button><div className="admin-header"><div><p className="eyebrow">SYSTEM OWNER ONLY</p><h1>Admin management</h1><p>Manage account access carefully. Changes are saved only after confirmation.</p></div><span className="admin-badge">ADMIN AREA</span></div><div className="admin-warning"><strong>Account access</strong><span>Changing or removing a member's account type affects what they can see and do.</span></div><div className="panel"><p className="eyebrow">ACCOUNT TYPES</p>{members.map((member) => { const memberTypes = types.filter((type) => type.user_id === member.id); const draft = draftTypes[member.id]; return <div className="member-row admin-member-row" key={member.id}><span className="avatar">{member.full_name.slice(0, 2).toUpperCase()}</span><span className="service-info"><strong>{member.full_name}</strong><span className="account-type-list">{memberTypes.length ? memberTypes.map((type) => { const removeKey = `${member.id}:${type.account_type}`; return <span className="account-type-chip" key={type.account_type}>{type.account_type.replaceAll('_', ' ')} <button className="remove-type-button" aria-label={`Remove ${type.account_type} from ${member.full_name}`} onClick={() => void removeType(member.id, type.account_type)}>{confirmingRemove === removeKey ? (savingId === removeKey ? '...' : 'Confirm?') : 'x'}</button></span> }) : <small>No type assigned</small>}</span></span>{draft ? <><span className="pending-change">New: {draft.replaceAll('_', ' ')}</span><button className="cancel-role-button" onClick={() => cancelEdit(member.id)}>Cancel</button>{confirmingId === member.id ? <button className="save-role-button" disabled={savingId === member.id} onClick={() => void saveType(member.id)}>{savingId === member.id ? 'Saving...' : 'Confirm save'}</button> : <button className="save-role-button" onClick={() => setConfirmingId(member.id)}>Review</button>}</> : <select className="role-select" value="" onChange={(event) => setDraftTypes((current) => ({ ...current, [member.id]: event.target.value }))}><option value="">Edit access</option><option value="music_director">Music Director</option><option value="music_leader">Music Leader</option><option value="music_team_member">Music Team Member</option><option value="admin">Admin</option></select>}</div>})}{message && <p className="form-error">{message}</p>}</div></section>
}

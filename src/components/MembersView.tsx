import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Member {
  id: string
  full_name: string
  avatar_url: string | null
  accountTypes: string[]
}

export function MembersView({ onBack }: { onBack: () => void }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadMembers() {
    setLoading(true)
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, full_name, avatar_url').order('full_name')
    if (profileError) { setError(profileError.message); setLoading(false); return }
    const { data: types, error: typeError } = await supabase.from('account_types').select('user_id, account_type')
    if (typeError) { setError(typeError.message); setLoading(false); return }
    const accountTypes = types || []
    setMembers((profiles || []).map((profile) => ({
      ...profile,
      accountTypes: accountTypes.filter((type) => type.user_id === profile.id).map((type) => type.account_type.replaceAll('_', ' ')),
    })))
    setLoading(false)
  }

  useEffect(() => { void loadMembers() }, [])

  return <section className="services-view"><button className="back-link" onClick={onBack}>&lt;- Dashboard</button><div className="services-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>Members</h1><p>See who is part of your music team and what they do.</p></div><button className="more-button" onClick={() => void loadMembers()}>Refresh <span>-&gt;</span></button></div><div className="member-panel panel">{loading ? <p className="service-empty">Loading members...</p> : error ? <p className="form-error">{error}</p> : members.length === 0 ? <p className="service-empty">No team members yet.</p> : <div className="member-list">{members.map((member) => <div className="member-row" key={member.id}><span className="avatar">{member.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="service-info"><strong>{member.full_name}</strong><small>{member.accountTypes.length ? member.accountTypes.join(' / ') : 'No account type assigned'}</small></span><span className="member-status">Active</span></div>)}</div>}</div></section>
}

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ServicesView } from './components/ServicesView'
import { MembersView } from './components/MembersView'
import { AvailabilityView, CalendarView } from './components/PlanningViews'
import { SongsView } from './components/MusicViews'
import { AdminView, ProfileView, type BeforeInstallPromptEvent } from './components/AccountViews'
import { ArchiveView } from './components/ArchiveView'
import './App.css'

const navigation = ['Dashboard', 'Calendar', 'Services', 'Songs', 'Members', 'Availability', 'Archives', 'Profile', 'Admin']
const navigationHelp: Record<string, string> = { Dashboard: 'See what needs attention', Calendar: 'View upcoming services', Services: 'Create services and assign your team', Songs: 'Manage lyrics and chords', Members: 'See your music team', Availability: 'Tell the team when you can serve', Archives: 'View archived services and setlists', Profile: 'Update your account', Admin: 'Manage account access' }

interface NotificationItem { id: string; serviceName: string; roleName: string; status: string; kind: 'assignment' | 'conflict' }
function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [accountLabel, setAccountLabel] = useState('Team member')
  const [authLoading, setAuthLoading] = useState(true)
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [activeView, setActiveView] = useState('Dashboard')
  const [showAll, setShowAll] = useState(false)
  const [dashboardServices, setDashboardServices] = useState<{ id: string; title: string; service_date: string; start_time: string; status: string }[]>([])
  const [dashboardCounts, setDashboardCounts] = useState({ members: 0, songs: 0, services: 0, confirmed: 0, assignments: 0 })
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsRead, setNotificationsRead] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [appInstalled, setAppInstalled] = useState(false)
  const displayName = session?.user.user_metadata.full_name || session?.user.email?.split('@')[0] || 'Team member'
  const initials = displayName.split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setAuthMode('reset-password')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setAppInstalled(true)
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    setAppInstalled(window.matchMedia('(display-mode: standalone)').matches)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
    await installPrompt.userChoice
  }

  useEffect(() => {
    if (!session) return
    supabase.from('account_types').select('account_type').eq('user_id', session.user.id).order('account_type').limit(1).maybeSingle().then(({ data }) => {
      if (data?.account_type) setAccountLabel(data.account_type.replaceAll('_', ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase()))
    })
  }, [session])

  useEffect(() => {
    if (!session) return
    Promise.all([
      supabase.from('services').select('id, title, service_date, start_time, status').gte('service_date', new Date().toISOString().slice(0, 10)).is('archived_at', null).order('service_date').limit(3),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('songs').select('id', { count: 'exact', head: true }),
      supabase.from('services').select('id', { count: 'exact', head: true }).is('archived_at', null),
    ]).then(async ([serviceResult, memberResult, songResult, serviceCountResult]) => {
      const services = serviceResult.data || []
      setDashboardServices(services)
      if (services[0]) {
        const { data: assignmentData } = await supabase.from('service_assignments').select('status').eq('service_id', services[0].id)
        const assignmentRows = assignmentData || []
        setDashboardCounts({ members: memberResult.count || 0, songs: songResult.count || 0, services: serviceCountResult.count || 0, assignments: assignmentRows.length, confirmed: assignmentRows.filter((assignment) => assignment.status === 'confirmed').length })
      } else setDashboardCounts({ members: memberResult.count || 0, songs: songResult.count || 0, services: serviceCountResult.count || 0, assignments: 0, confirmed: 0 })
    })
  }, [session])

  const nextService = dashboardServices[0]
  const leaderAccess = accountLabel === 'Admin' || accountLabel === 'Music Director'
  const visibleNavigation = leaderAccess ? navigation : navigation.filter((item) => item !== 'Admin' && item !== 'Archives' && item !== 'Services')

  async function loadNotifications() {
    if (!session) return
    setNotificationsLoading(true)
    const { data: assignmentData } = await supabase.from('service_assignments').select('id, service_id, role_id, status, response_note').eq('user_id', session.user.id)
    const assignments = assignmentData || []
    const [{ data: serviceData }, { data: roleData }] = await Promise.all([
      supabase.from('services').select('id, title'),
      supabase.from('music_roles').select('id, name'),
    ])
    const serviceMap = new Map((serviceData || []).map((service) => [service.id, service.title]))
    const roleMap = new Map((roleData || []).map((role) => [role.id, role.name]))
    setNotifications(assignments.map((assignment) => ({ id: assignment.id, serviceName: serviceMap.get(assignment.service_id) || 'Service', roleName: roleMap.get(assignment.role_id) || 'Role', status: assignment.status, kind: assignment.status === 'declined' ? 'conflict' : 'assignment' })))
    setNotificationsLoading(false)
  }

  useEffect(() => {
    if (!session) {
      setNotifications([])
      return
    }
    setNotificationsRead(false)
    void loadNotifications()
  }, [session])

  async function respondToNotification(id: string, status: 'confirmed' | 'declined') {
    if (!session) return
    const { error } = await supabase.from('service_assignments').update({ status }).eq('id', id).eq('user_id', session.user.id)
    if (!error) await loadNotifications()
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMessage('')
    const result = authMode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : authMode === 'sign-up'
        ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (result.error) setAuthMessage(result.error.message)
    else if (authMode === 'sign-up') setAuthMessage('Check your email to confirm your account.')
    else if (authMode === 'forgot-password') setAuthMessage('Check your email for a password reset link.')
  }

  async function handleOAuth(provider: 'google') {
    setAuthMessage('')
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
    if (error) setAuthMessage(error.message)
  }

  if (authLoading) return <div className="auth-loading">Loading Onesys...</div>
  if (authMode === 'reset-password') return <main className="auth-page"><section className="auth-card"><div className="brand-mark"><span>O</span><strong>onesys</strong></div><p className="eyebrow">SECURE YOUR ACCOUNT</p><h1>Set a new password.</h1><p className="auth-intro">Choose a new password for your Onesys account.</p><form onSubmit={async (event) => { event.preventDefault(); const { error } = await supabase.auth.updateUser({ password }); setAuthMessage(error ? error.message : 'Password updated. You can now sign in.'); if (!error) { await supabase.auth.signOut(); setAuthMode('sign-in') } }}><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>{authMessage && <p className="auth-message">{authMessage}</p>}<button className="auth-submit" type="submit">Update password <span>-&gt;</span></button></form></section><div className="auth-aside"><p className="eyebrow light">ONE PLACE FOR THE WHOLE TEAM</p><h2>Make every service feel prepared.</h2><p>Plan the setlist, confirm the team, and keep the details close.</p></div></main>
  if (!session) return <main className="auth-page"><section className="auth-card"><div className="brand-mark"><span>O</span><strong>onesys</strong></div><p className="eyebrow">MUSIC TEAM WORKSPACE</p><h1>{authMode === 'sign-in' ? 'Welcome back.' : authMode === 'forgot-password' ? 'Reset your password.' : 'Create your workspace account.'}</h1><p className="auth-intro">{authMode === 'sign-in' ? 'Sign in to keep your team moving together.' : authMode === 'forgot-password' ? 'Enter your email and we will send you a secure reset link.' : 'Start organizing services, songs, and your team in one place.'}</p><form onSubmit={handleAuth}>{authMode === 'sign-up' && <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{authMode !== 'forgot-password' && <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>}{authMessage && <p className="auth-message">{authMessage}</p>}<button className="auth-submit" type="submit">{authMode === 'sign-in' ? 'Sign in' : authMode === 'forgot-password' ? 'Send reset link' : 'Create account'} <span>-&gt;</span></button></form>{authMode === 'sign-in' && <div className="oauth-buttons"><button onClick={() => void handleOAuth('google')}>Continue with Google</button></div>}{authMode === 'sign-in' && <button className="auth-switch" onClick={() => { setAuthMode('forgot-password'); setAuthMessage('') }}>Forgot password?</button>}<button className="auth-switch" onClick={() => { setAuthMode(authMode === 'sign-in' || authMode === 'forgot-password' ? 'sign-up' : 'sign-in'); setAuthMessage('') }}>{authMode === 'sign-in' || authMode === 'forgot-password' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}</button></section><div className="auth-aside"><p className="eyebrow light">ONE PLACE FOR THE WHOLE TEAM</p><h2>Make every service feel prepared.</h2><p>Plan the setlist, confirm the team, and keep the details close.</p><div className="auth-note">“The calm before Sunday starts here.”</div></div></main>

  return (
    <div className="app-shell">
      <aside className={mobileMenuOpen ? 'sidebar mobile-menu-open' : 'sidebar'}>
        <div className="brand-mark"><span>O</span><strong>onesys</strong></div>
        <div className="workspace-label">MY WORKSPACE</div>
        <nav aria-label="Main navigation">
          {visibleNavigation.map((item) => <button title={navigationHelp[item]} className={activeView === item ? 'nav-item active' : 'nav-item'} key={item} onClick={() => { setActiveView(item); setMobileMenuOpen(false) }}><span className="nav-icon">{item === 'Dashboard' ? '+' : item === 'Calendar' ? '[]' : item === 'Services' ? '>' : item === 'Songs' ? '~' : item === 'Availability' ? 'o' : item === 'Assignments' ? '!' : item === 'Profile' ? '@' : item === 'Admin' ? '#' : item === 'Conflicts' ? 'x' : '@'}</span>{item}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => supabase.auth.signOut()}><span className="nav-icon">&lt;</span>Sign out</button>
          <div className="profile-chip"><span className="avatar">{initials}</span><span><strong>{displayName}</strong><small>{accountLabel}</small></span><span className="dots">...</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className={mobileMenuOpen ? 'hamburger-button open' : 'hamburger-button'} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><span></span><span></span><span></span></button><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activeView}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Search">/</button><button className="notification-button" aria-label="Open notifications" onClick={() => { setNotificationsOpen(true); setNotificationsRead(true); void loadNotifications() }}><span className="notification-glyph" aria-hidden="true"></span>{!notificationsRead && notifications.some((item) => item.status === 'pending' || item.kind === 'conflict') && <span className="notification-dot" />}</button>{leaderAccess && <button className="new-button" onClick={() => setActiveView('Services')}>+ <span>New service</span></button>}</div></header>
        {mobileMenuOpen && <button className="drawer-backdrop" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}
        {notificationsOpen && <div className="modal-backdrop" role="presentation" onClick={() => setNotificationsOpen(false)}><section className="notification-modal" role="dialog" aria-modal="true" aria-labelledby="notifications-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">TEAM UPDATES</p><h2 id="notifications-title">Notifications</h2></div><button className="modal-close" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}>x</button></div>{notificationsLoading ? <p className="service-empty">Loading notifications...</p> : notifications.length === 0 ? <p className="service-empty">You are all caught up.</p> : <div className="notification-list">{notifications.map((item) => <div className="notification-item" key={item.id}><span className={item.kind === 'conflict' ? 'notification-icon conflict-icon' : 'notification-icon'}>{item.kind === 'conflict' ? '!' : '>'}</span><span className="service-info"><strong>{item.kind === 'conflict' ? 'Assignment declined' : `${item.serviceName} assignment`}</strong><small>{item.roleName} · {item.status}</small></span>{item.status === 'pending' && <span className="notification-actions"><button onClick={() => void respondToNotification(item.id, 'confirmed')}>Confirm</button><button onClick={() => void respondToNotification(item.id, 'declined')}>Decline</button></span>}</div>)}</div>}</section></div>}
        <div className="content-wrap">
          {activeView === 'Services' && leaderAccess && session ? <ServicesView session={session} onBack={() => setActiveView('Dashboard')} /> : activeView === 'Members' ? <MembersView onBack={() => setActiveView('Dashboard')} /> : activeView === 'Calendar' ? <CalendarView onBack={() => setActiveView('Dashboard')} /> : activeView === 'Availability' && session ? <AvailabilityView session={session} onBack={() => setActiveView('Dashboard')} /> : activeView === 'Songs' && session ? <SongsView session={session} onBack={() => setActiveView('Dashboard')} /> : activeView === 'Archives' && leaderAccess ? <ArchiveView onBack={() => setActiveView('Dashboard')} /> : activeView === 'Profile' && session ? <ProfileView session={session} onBack={() => setActiveView('Dashboard')} installPrompt={installPrompt} installed={appInstalled} onInstall={() => void installApp()} /> : activeView === 'Admin' && leaderAccess ? <AdminView onBack={() => setActiveView('Dashboard')} /> : activeView !== 'Dashboard' ? <section className="empty-view"><p className="eyebrow">ONESYS WORKSPACE</p><h1>{activeView}</h1><p>This view is ready for the next build slice.</p><button className="primary-button" onClick={() => setActiveView('Dashboard')}>Back to dashboard</button></section> : <>
            <section className="welcome-row"><div><p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase()}</p><h1>Good morning, {displayName.split(' ')[0]}.</h1><p className="subheading">Here is what is happening with your team this week.</p></div><div className="week-pill"><span className="pulse"></span>Week {Math.ceil(new Date().getDate() / 7)} <b>{new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</b></div></section>
            {!nextService && <section className="getting-started"><div><p className="eyebrow">GETTING STARTED</p><h2>Three simple steps to prepare your first service.</h2></div><div className="start-steps"><button onClick={() => setActiveView('Services')}><b>01</b><span>Create a service</span><small>Set the date and time</small></button><button onClick={() => setActiveView('Members')}><b>02</b><span>Add your team</span><small>Invite and manage members</small></button><button onClick={() => setActiveView('Songs')}><b>03</b><span>Build the setlist</span><small>Add songs and details</small></button></div></section>}
            <section className="hero-panel"><div><p className="eyebrow light">NEXT SERVICE</p><h2>{nextService?.title || 'No upcoming service'}</h2><p className="hero-meta">{nextService ? new Date(nextService.service_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Create a service to start planning'}{nextService && <><span></span>{nextService.start_time.slice(0, 5)}</>}</p><button className="light-button" onClick={() => setActiveView('Services')}>{nextService ? 'Open service' : 'Create service'} <span>-&gt;</span></button></div><div className="service-ring"><span>{nextService ? Math.max(0, Math.ceil((new Date(nextService.service_date).getTime() - Date.now()) / 86400000)) : '-'}</span><small>{nextService ? <>days<br />away</> : <>next<br />service</>}</small></div></section>
            <div className="section-heading"><div><p className="eyebrow">YOUR OVERVIEW</p><h2>Team at a glance</h2></div><button className="text-button" onClick={() => setActiveView('Members')}>View members <span>-&gt;</span></button></div>
            <section className="stats-grid"><article className="stat-card"><div className="stat-label"><span className="stat-dot green"></span>TEAM READINESS</div><strong>{dashboardCounts.assignments ? Math.round((dashboardCounts.confirmed / dashboardCounts.assignments) * 100) : 0}%</strong><div className="stat-footer"><span className="mini-bars"><i></i><i></i><i></i><i></i><i></i></span><span>{dashboardCounts.confirmed} of {dashboardCounts.assignments} confirmed</span></div></article><article className="stat-card"><div className="stat-label"><span className="stat-dot orange"></span>UPCOMING SERVICES</div><strong>{dashboardCounts.services}</strong><div className="stat-footer warning"><span>In your workspace</span><span>-&gt;</span></div></article><article className="stat-card"><div className="stat-label"><span className="stat-dot blue"></span>SONGS IN LIBRARY</div><strong>{dashboardCounts.songs}</strong><div className="stat-footer"><span>{dashboardCounts.members} team members</span><span className="trend">^</span></div></article></section>
            <section className="lower-grid"><div className="panel schedule-panel"><div className="panel-heading"><div><p className="eyebrow">COMING UP</p><h2>Upcoming services</h2></div><button className="more-button" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : 'View calendar'} <span>-&gt;</span></button></div><div className="service-list">{dashboardServices.slice(0, showAll ? 3 : 2).map((service) => <button className="service-row" key={service.id} onClick={() => setActiveView('Services')}><time>{new Date(service.service_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase()}</time><span className="service-info"><strong>{service.title}</strong><small>{service.start_time.slice(0, 5)}</small></span><span className={'status ' + service.status}>{service.status}</span><span className="row-arrow">-&gt;</span></button>)}{dashboardServices.length === 0 && <p className="service-empty">No upcoming services yet.</p>}</div></div><div className="panel focus-panel"><p className="eyebrow">QUICK FOCUS</p><h2>{nextService ? 'Keep the team aligned.' : 'Start with a service.'}</h2><p>{nextService ? 'Open Services to assign members and build the plan for your next gathering.' : 'Create your first service to begin assigning your team and building a setlist.'}</p><button className="outline-button" onClick={() => setActiveView('Services')}>{nextService ? 'Open services' : 'Create service'}</button></div></section>
          </>}
        </div>
      </main>
    </div>
  )
}

export default App

import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAppStore } from '../store/appStore'

const links = [
  { to: '/', label: 'תזרים', end: true },
  { to: '/tasks', label: 'משימות', end: false },
  { to: '/contacts', label: 'אנשי קשר', end: false },
]

export function AppShell() {
  const refresh = useAppStore(state => state.refresh)
  const loading = useAppStore(state => state.loading)
  const error = useAppStore(state => state.error)

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <h1 className="brand-name">
            <img className="brand-logo" src="/logo.webp" width={438} height={312} alt="מטאפורה" />
          </h1>
        </div>
        <nav className="nav" aria-label="ראשי">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {error && <p className="banner" role="alert">{error}</p>}
      {loading ? <p className="loading page">טוען…</p> : <Outlet />}
    </div>
  )
}

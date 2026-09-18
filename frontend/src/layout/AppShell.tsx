import { useState } from 'react'
import type { ReactNode } from 'react'
import logoHorizontalBranca from '../assets/brand/logo-horizontal-branca.png'
import logoSimboloBranco from '../assets/brand/logo-simbolo-branco.png'
import { useAuth } from '../auth/AuthContext'
import { NAV_ITEMS, isNavItemVisible } from './navItems'
import './AppShell.css'

type AppShellProps = {
  activeKey: string
  onNavigate: (key: string) => void
  children: ReactNode
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  VIEWER: 'Visualizador',
}

export function AppShell({ activeKey, onNavigate, children }: AppShellProps) {
  const { user, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (!user) return null

  const visibleItems = NAV_ITEMS.filter((item) => isNavItemVisible(item, user.role))

  function handleNavigate(key: string) {
    onNavigate(key)
    setMobileMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <a href="#conteudo-principal" className="skip-link">
        Pular para o conteúdo
      </a>

      <header className="app-shell__topbar">
        <button
          type="button"
          className="app-shell__menu-toggle"
          aria-expanded={mobileMenuOpen}
          aria-controls="menu-principal"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span className="visually-hidden">
            {mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          </span>
          <span aria-hidden="true">☰</span>
        </button>

        <img src={logoSimboloBranco} alt="Evolução Tráfego" className="app-shell__logo-mobile" />

        <div className="app-shell__user">
          <span className="app-shell__user-name">
            {user.name} <span className="app-shell__user-role">· {ROLE_LABEL[user.role]}</span>
          </span>
          <button type="button" className="button button--secondary" onClick={() => logout()}>
            Sair
          </button>
        </div>
      </header>

      <div className="app-shell__body">
        <nav
          id="menu-principal"
          className={`app-shell__sidebar${mobileMenuOpen ? ' app-shell__sidebar--open' : ''}`}
          aria-label="Navegação principal"
        >
          <img
            src={logoHorizontalBranca}
            alt="Evolução Tráfego"
            className="app-shell__logo-desktop"
          />
          <ul className="app-shell__nav-list">
            {visibleItems.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={`app-shell__nav-link${
                    activeKey === item.key ? ' app-shell__nav-link--active' : ''
                  }`}
                  aria-current={activeKey === item.key ? 'page' : undefined}
                  onClick={() => handleNavigate(item.key)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {mobileMenuOpen && (
          <button
            type="button"
            className="app-shell__backdrop"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <main id="conteudo-principal" className="app-shell__content">
          {children}
        </main>
      </div>
    </div>
  )
}

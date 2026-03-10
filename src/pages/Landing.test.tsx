import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '@/pages/Landing'

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  analytics: null,
}))

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  )
}

describe('Landing', () => {
  it('renders the hero section', () => {
    renderLanding()

    expect(screen.getByText('USM Cubesat Team')).toBeInTheDocument()
    expect(screen.getByText(/Construyendo el futuro del/)).toBeInTheDocument()
    expect(screen.getByText('espacio')).toBeInTheDocument()
  })

  it('shows sign in and register buttons in navbar', () => {
    renderLanding()

    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unirse al equipo/i })).toBeInTheDocument()
  })

  it('shows CTA buttons', () => {
    renderLanding()

    expect(screen.getByRole('button', { name: /comenzar ahora/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ya tengo cuenta/i })).toBeInTheDocument()
  })

  it('shows the three team sections', () => {
    renderLanding()

    expect(screen.getByText('Equipo Técnico')).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
    expect(screen.getByText('Relaciones Públicas')).toBeInTheDocument()
  })

  it('shows the "Nuestros Equipos" heading', () => {
    renderLanding()

    expect(screen.getByText('Nuestros Equipos')).toBeInTheDocument()
  })

  it('shows university name', () => {
    renderLanding()

    expect(screen.getByText('Universidad Técnica Federico Santa María')).toBeInTheDocument()
  })

  it('renders footer with links', () => {
    renderLanding()

    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toBeInTheDocument()
  })

  it('contains links to login and register pages', () => {
    renderLanding()

    const links = screen.getAllByRole('link')
    const hrefs = links.map(l => l.getAttribute('href'))
    expect(hrefs).toContain('/login')
    expect(hrefs).toContain('/register')
  })
})

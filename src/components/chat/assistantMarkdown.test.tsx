import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReactMarkdown from 'react-markdown'
import { assistantMarkdownComponents } from './assistantMarkdown'

const renderAssistant = (markdown: string) =>
  render(<ReactMarkdown components={assistantMarkdownComponents}>{markdown}</ReactMarkdown>)

describe('assistantMarkdownComponents', () => {
  it('shows the real host next to link text and opens it in an isolated tab', () => {
    renderAssistant('[Verifica tu cuenta USM](https://phish.example/login)')

    const link = screen.getByRole('link', { name: 'Verifica tu cuenta USM' })
    expect(link).toHaveAttribute('href', 'https://phish.example/login')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    expect(screen.getByText('(phish.example)')).toBeInTheDocument()
  })

  it('reduces links with a disallowed scheme to plain text', () => {
    renderAssistant('[clic](javascript:alert(1))')

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('clic')).toBeInTheDocument()
  })

  it('never loads images from model output', () => {
    const { container } = renderAssistant('![grafico](https://tracker.example/pixel.png?d=secreto)')

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('[imagen: grafico]')).toBeInTheDocument()
  })
})

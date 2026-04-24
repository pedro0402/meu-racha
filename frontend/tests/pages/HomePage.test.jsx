import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../../src/pages/HomePage.jsx';

describe('<HomePage />', () => {
  test('renderiza hero com CTA principal para criar racha', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /sua lista em tempo real/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /criar meu racha/i })).toHaveAttribute('href', '/criar');
  });

  test('renderiza seção de como funciona com 3 passos', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /como funciona/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /crie sua lista/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /compartilhe o link/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /fechamento automático/i })).toBeInTheDocument();
  });
});

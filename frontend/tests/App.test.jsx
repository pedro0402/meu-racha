import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

describe('<App />', () => {
  test('renderiza skip link para pular ao conteúdo principal', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    const skip = screen.getByRole('link', { name: /pular para o conteúdo/i });
    expect(skip).toHaveAttribute('href', '#conteudo-principal');
  });
});

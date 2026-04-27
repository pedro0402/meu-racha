import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlayerList from '../../src/components/PlayerList.jsx';

describe('<PlayerList />', () => {
  test('renderiza max slots, com vagas abertas para os faltantes', () => {
    render(
      <PlayerList
        max={18}
        jogadores={[
          { id: 1, nome: 'Pedro', posicao: 'jogador' },
          { id: 2, nome: 'João', posicao: 'goleiro' },
        ]}
      />,
    );

    const itens = screen.getAllByRole('listitem');
    expect(itens).toHaveLength(18);

    expect(screen.getByText('Pedro')).toBeInTheDocument();
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getAllByText('vaga aberta')).toHaveLength(16);
    expect(screen.getByText(/2 titulares, 0 suplente/i)).toBeInTheDocument();
    expect(screen.getByText(/16 vagas restantes/i)).toBeInTheDocument();
  });

  test('exibe posição do jogador e goleiro' , () => {
    render(
      <PlayerList
        max={3}
        jogadores={[
          { id: 1, nome: 'Pedro', posicao: 'jogador' },
          { id: 2, nome: 'João', posicao: 'goleiro' },
        ]}
      />,
    );
    
    expect(screen.getByText(/Jogador/)).toBeInTheDocument();
    expect(screen.getByText(/Goleiro/)).toBeInTheDocument();
  });

  test('numera os slots começando em 01', () => {
    render(<PlayerList max={3} jogadores={[{ id: 1, nome: 'A', posicao: 'jogador' }]} />);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
  });

  test('marca slots preenchidos com a classe "filled"', () => {
    const { container } = render(
      <PlayerList max={2} jogadores={[{ id: 1, nome: 'A', posicao: 'jogador' }]} />,
    );
    expect(container.querySelectorAll('.filled')).toHaveLength(1);
    expect(container.querySelectorAll('.empty')).toHaveLength(1);
  });

  test('separa titulares e suplentes no resumo', () => {
    render(
      <PlayerList
        max={2}
        jogadores={[
          { id: 1, nome: 'A', posicao: 'jogador', suplente: false },
          { id: 2, nome: 'B', posicao: 'jogador', suplente: false },
          { id: 3, nome: 'C', posicao: 'jogador', suplente: true },
        ]}
      />,
    );

    expect(screen.getByText(/2 titulares, 1 suplente/i)).toBeInTheDocument();
    expect(screen.getByText(/0 vagas restantes/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /suplentes/i })).toBeInTheDocument();
  });
});

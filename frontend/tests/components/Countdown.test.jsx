import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import Countdown from '../../src/components/Countdown.jsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('<Countdown />', () => {
  test('mostra horas/minutos/segundos restantes', () => {
    vi.setSystemTime(new Date('2026-04-19T12:00:00'));
    const target = new Date('2026-04-19T13:30:45').toISOString();
    render(<Countdown targetLocalISO={target} />);

    expect(screen.getByText(/1h 30m 45s/)).toBeInTheDocument();
  });

  test('decrementa a cada segundo', () => {
    vi.setSystemTime(new Date('2026-04-19T12:00:00'));
    const target = new Date('2026-04-19T12:00:10').toISOString();
    render(<Countdown targetLocalISO={target} />);

    expect(screen.getByText(/0m 10s/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText(/0m 7s/)).toBeInTheDocument();
  });

  test('chama onElapsed exatamente uma vez ao zerar', () => {
    vi.setSystemTime(new Date('2026-04-19T12:00:00'));
    const target = new Date('2026-04-19T12:00:02').toISOString();
    const onElapsed = vi.fn();

    render(<Countdown targetLocalISO={target} onElapsed={onElapsed} />);

    act(() => vi.advanceTimersByTime(1000));
    expect(onElapsed).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText(/Abrindo agora/)).toBeInTheDocument();
    expect(onElapsed).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(5000));
    expect(onElapsed).toHaveBeenCalledTimes(1);
  });
});

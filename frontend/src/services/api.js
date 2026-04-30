const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Erro na requisição');
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

/**
 * Baixa o PDF da lista (rota binária; não usa `request` JSON).
 */
export async function downloadListaPdf(rachaId) {
  const res = await fetch(`${API_URL}/api/rachas/${rachaId}/pdf`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || data.error || 'Não foi possível baixar o PDF');
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `lista-racha-${rachaId}.pdf`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export { API_URL };

export const api = {
  criarRacha: (payload) =>
    request('/api/rachas', { method: 'POST', body: payload }),

  getRacha: (id) => request(`/api/rachas/${id}`),

  downloadListaPdf,

  entrarNoRacha: (id, nome, posicao = 'jogador', entradaToken, visitorHash) =>
    request(`/api/rachas/${id}/jogadores`, {
      method: 'POST',
      body: {
        nome,
        posicao,
        entrada_token: entradaToken,
        visitor_hash: visitorHash,
      },
    }),

  /** Token descartável para uma tentativa de entrada (uso único no POST). */
  getTokenEntrada: (id) => request(`/api/rachas/${id}/token-entrada`),
};

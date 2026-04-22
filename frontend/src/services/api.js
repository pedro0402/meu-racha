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

export const api = {
  criarRacha: (payload) =>
    request('/api/rachas', { method: 'POST', body: payload }),

  getRacha: (id) => request(`/api/rachas/${id}`),

  entrarNoRacha: (id, nome) =>
    request(`/api/rachas/${id}/jogadores`, {
      method: 'POST',
      body: { nome },
    }),
};

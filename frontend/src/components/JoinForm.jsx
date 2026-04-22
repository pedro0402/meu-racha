import { useState } from 'react';
import { api } from '../services/api';

export default function JoinForm({ rachaId }) {
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setErro('');
    setLoading(true);
    try {
      await api.entrarNoRacha(rachaId, nome);
      setNome('');
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="join-form">
      <label>
        Seu nome
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Digite seu nome"
          maxLength={60}
          required
        />
      </label>
      {erro && <div className="alert alert-error">{erro}</div>}
      <button className="btn btn-primary" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar no racha'}
      </button>
    </form>
  );
}

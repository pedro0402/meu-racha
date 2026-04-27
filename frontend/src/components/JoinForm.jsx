import { useState } from 'react';
import { api } from '../services/api';

function mapJoinError(err) {
  const byCode = {
    NOME_OBRIGATORIO: 'Digite seu nome para entrar na lista.',
    INVALID_NAME: 'Use pelo menos 2 caracteres no nome.',
    DUPLICATE: 'Esse nome ja esta na lista.',
    FULL: 'A lista ja atingiu o limite de jogadores.',
    LISTA_FECHADA: 'A lista ainda nao esta aberta para entradas.',
    LISTA_EXPIRADA: 'Esta lista expirou e nao aceita novas entradas.',
    RACHA_NAO_ENCONTRADO: 'Nao encontramos esse racha. Confira o link.',
    POSICAO_INVALIDA: 'Escolha uma posição válida (goleiro ou jogador).',
  };

  if (err?.code && byCode[err.code]) return byCode[err.code];
  return err?.message || 'Nao foi possivel entrar na lista agora.';
}

export default function JoinForm({ rachaId }) {
  const [nome, setNome] = useState('');
  const [posicao, setPosicao] = useState('jogador');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);
  const canSubmit = Boolean(nome.trim()) && !loading;

  async function onSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setErro('');
    setSucesso('');
    setLoading(true);
    try {
      const res = await api.entrarNoRacha(rachaId, nome, posicao);
      setNome('');
      setPosicao('jogador');
      if (res?.jogador?.suplente) {
        setSucesso('Você entrou como suplente. Caso haja desistência você poderá ser convocado.');
      } else {
        setSucesso('Entrada confirmada. Boa sorte no racha!');
      }
    } catch (err) {
      setErro(mapJoinError(err));
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
          onChange={(e) => {
            setNome(e.target.value);
            if (sucesso) setSucesso('');
          }}
          placeholder="Digite seu nome"
          maxLength={60}
          required
        />
      </label>
      <label>
        Posição
        <select
          value={posicao}
          onChange={(e) => {
            setPosicao(e.target.value);
            if (sucesso) setSucesso('');
          }}
          required
        >
          <option value="jogador">Jogador</option>
          <option value="goleiro">Goleiro</option>
        </select>
      </label>
      {erro && <div className="alert alert-error">{erro}</div>}
      {sucesso && <div className="alert alert-success" role="status">{sucesso}</div>}
      <button className="btn btn-primary" disabled={!canSubmit}>
        {loading ? 'Entrando...' : 'Entrar no racha'}
      </button>
    </form>
  );
}

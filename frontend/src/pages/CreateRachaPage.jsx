import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

/**
 * Sugere "próximo domingo" como data padrão (formato YYYY-MM-DD).
 */
function defaultProximoDomingo() {
  const agora = new Date();
  const diasAteDomingo = (7 - agora.getDay()) % 7 || 7;
  const proximo = new Date(agora);
  proximo.setDate(agora.getDate() + diasAteDomingo);

  const pad = (n) => String(n).padStart(2, '0');
  return `${proximo.getFullYear()}-${pad(proximo.getMonth() + 1)}-${pad(proximo.getDate())}`;
}

export default function CreateRachaPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome_dono: '',
    email: '',
    telefone: '',
    data: defaultProximoDomingo(),
    hora: '12:00',
  });
  const [criado, setCriado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const update = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const data = await api.criarRacha({
        nome_dono: form.nome_dono,
        email: form.email,
        telefone: form.telefone,
        data_abertura: `${form.data}T${form.hora}`,
      });
      setCriado(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (criado) {
    return (
      <div className="card">
        <h2>Racha criado!</h2>
        <p>Compartilhe o link abaixo com a galera:</p>
        <div className="share-box">
          <input readOnly value={criado.shareUrl} onFocus={(e) => e.target.select()} />
          <button
            className="btn"
            onClick={() => navigator.clipboard.writeText(criado.shareUrl)}
          >
            Copiar
          </button>
        </div>
        {criado.racha.data_abertura && (
          <p className="muted">
            A lista abre em <strong>{criado.racha.data_abertura.replace('T', ' ')}</strong>.
          </p>
        )}
        <button
          className="btn btn-primary"
          onClick={() => navigate(`/racha/${criado.racha.id}`)}
        >
          Abrir lista
        </button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>Criar racha</h2>

      <label>
        Seu nome
        <input
          type="text"
          value={form.nome_dono}
          onChange={update('nome_dono')}
          placeholder="Ex.: João da Silva"
          required
        />
      </label>

      <label>
        E-mail (receberá o PDF da lista)
        <input
          type="email"
          value={form.email}
          onChange={update('email')}
          placeholder="voce@email.com"
          required
        />
      </label>

      <label>
        Telefone
        <input
          type="tel"
          value={form.telefone}
          onChange={update('telefone')}
          placeholder="(11) 99999-9999"
          required
        />
      </label>

      <fieldset className="datetime-fieldset">
        <legend>Quando a lista abre?</legend>

        <div className="datetime-row">
          <label className="flex-1">
            Data
            <input
              type="date"
              value={form.data}
              onChange={update('data')}
              required
            />
          </label>

          <label className="flex-1">
            Hora
            <input
              type="time"
              step="300"
              value={form.hora}
              onChange={update('hora')}
              required
            />
          </label>
        </div>
        <small className="muted">
          Antes desse horário, ninguém consegue entrar na lista.
        </small>
      </fieldset>

      {erro && <div className="alert alert-error">{erro}</div>}

      <button className="btn btn-primary" disabled={loading}>
        {loading ? 'Criando...' : 'Criar racha'}
      </button>
    </form>
  );
}

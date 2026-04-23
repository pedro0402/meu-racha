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

function formatDateBr(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function maskData(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateBr(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return '';

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return `${year}-${month}-${day}`;
}

function maskTelefone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';

  const ddd = digits.slice(0, 2);
  const parte1 = digits.slice(2, digits.length > 10 ? 7 : 6);
  const parte2 = digits.slice(digits.length > 10 ? 7 : 6);

  if (digits.length <= 2) return `(${ddd}`;
  if (digits.length <= 6) return `(${ddd}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${ddd}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${ddd}) ${parte1}-${parte2}`;
}

function normalizeEmail(value) {
  return value.toLowerCase().replace(/\s+/g, '');
}

function onlyDigits(value) {
  return value.replace(/\D/g, '');
}

export default function CreateRachaPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome_dono: '',
    email: '',
    telefone: '',
    max_jogadores: 18,
    data: formatDateBr(defaultProximoDomingo()),
    hora: '12:00',
  });
  const [criado, setCriado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const update = (campo) => (e) => {
    const { value } = e.target;

    setForm((f) => {
      if (campo === 'telefone') {
        return { ...f, telefone: maskTelefone(value) };
      }

      if (campo === 'email') {
        return { ...f, email: normalizeEmail(value) };
      }

      if (campo === 'data') {
        return { ...f, data: maskData(value) };
      }

      return { ...f, [campo]: value };
    });
  };

  async function onSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const data = await api.criarRacha({
        nome_dono: form.nome_dono,
        email: normalizeEmail(form.email),
        telefone: onlyDigits(form.telefone),
        max_jogadores: Number(form.max_jogadores),
        data_abertura: `${parseDateBr(form.data)}T${form.hora}`,
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
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          placeholder="voce@email.com"
          required
        />
      </label>

      <label>
        Telefone
        <input
          type="tel"
          inputMode="tel"
          value={form.telefone}
          onChange={update('telefone')}
          placeholder="(11) 99999-9999"
          required
        />
      </label>

      <label>
        Máximo de jogadores
        <input
          type="number"
          min="2"
          max="50"
          value={form.max_jogadores}
          onChange={update('max_jogadores')}
          required
        />
      </label>

      <fieldset className="datetime-fieldset">
        <legend>Quando a lista abre?</legend>

        <div className="datetime-row">
          <label className="flex-1">
            Data
            <input
              type="text"
              inputMode="numeric"
              value={form.data}
              onChange={update('data')}
              placeholder="DD/MM/AAAA"
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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { formatDataAberturaBR } from '../utils/formatDataAberturaBR.js';

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
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function onlyDigits(value) {
  return value.replace(/\D/g, '');
}

function mapCreateError(err) {
  const byCode = {
    CAMPOS_OBRIGATORIOS: 'Preencha nome, e-mail e telefone para criar o racha.',
    EMAIL_INVALIDO: 'Revise o e-mail informado para continuar.',
    TELEFONE_INVALIDO: 'Informe um telefone valido com DDD.',
    MAX_JOGADORES_INVALIDO: 'Escolha um limite entre 2 e 50 jogadores.',
    DATA_ABERTURA_INVALIDA: 'Informe data e hora validas para abertura.',
    DATA_ABERTURA_PASSADA: 'A abertura precisa ser hoje ou em uma data futura.',
  };

  if (err?.code && byCode[err.code]) return byCode[err.code];
  return err?.message || 'Nao foi possivel criar o racha agora.';
}

function formatAberturaPreview(dataBr, hora) {
  const isoDate = parseDateBr(dataBr);
  if (!isoDate || !hora) return '';

  const date = new Date(`${isoDate}T${hora}:00`);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function CreateRachaPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome_dono: '',
    email: '',
    telefone: '',
    max_jogadores: 18,
    data: '',
    hora: '',
    suplentes_habilitados: false,
    max_suplentes: 6,
  });
  const [criado, setCriado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const aberturaPreview = formatAberturaPreview(form.data, form.hora);

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
    const dataISO = parseDateBr(form.data);
    if (!dataISO || !form.hora) {
      setErro('Preencha data e hora de abertura no formato correto.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.criarRacha({
        nome_dono: form.nome_dono.trim(),
        email: normalizeEmail(form.email),
        telefone: onlyDigits(form.telefone || ''),
        max_jogadores: Number(form.max_jogadores),
        data_abertura: `${dataISO}T${form.hora}`,
        suplentes_habilitados: form.suplentes_habilitados,
        max_suplentes: form.suplentes_habilitados ? Number(form.max_suplentes) : 0,
      });
      setCriado(data);
    } catch (err) {
      setErro(mapCreateError(err));
    } finally {
      setLoading(false);
    }
  }

  if (criado) {
    async function copiarLink() {
      await navigator.clipboard.writeText(criado.shareUrl);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    }

    return (
      <div className="card">
        <h2>Racha criado!</h2>
        <p>Compartilhe o link abaixo com a galera:</p>
        <div className="share-box">
          <input readOnly value={criado.shareUrl} onFocus={(e) => e.target.select()} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn"
              onClick={copiarLink}
              type="button"
            >
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
            {copiado && (
              <span className="muted" role="status" aria-live="polite">
                Link copiado com sucesso.
              </span>
            )}
          </div>
        </div>
        {criado.racha.data_abertura && (
          <p className="muted">
            A lista abre em <strong>{formatDataAberturaBR(criado.racha.data_abertura)}</strong>.
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
      <p className="muted form-intro">
        Preencha os dados para gerar o link da lista. Quando as vagas fecharem, o PDF fica disponível na própria página para baixar e para mandar o link no WhatsApp.
      </p>

      <div className="quick-checklist" aria-label="resumo do fluxo">
        <span>1. Defina nome, e-mail, telefone e horário</span>
        <span>2. Gere e copie o link</span>
        <span>3. Compartilhe com a galera</span>
      </div>

      <label>
        Seu nome
        <input
          type="text"
          value={form.nome_dono}
          onChange={update('nome_dono')}
          maxLength={120}
          placeholder="Ex.: João da Silva"
          required
        />
      </label>

      <label htmlFor="criar-racha-email">
        E-mail
        <input
          id="criar-racha-email"
          type="email"
          value={form.email}
          onChange={update('email')}
          maxLength={254}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          placeholder="nome@email.com"
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
          maxLength={15}
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
        <small className="muted">Mínimo de 2 jogadores para criar a lista.</small>
      </label>

      <label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.suplentes_habilitados}
            onChange={(e) => setForm((f) => ({ ...f, suplentes_habilitados: e.target.checked }))}
          />
          Habilitar suplentes
        </label>
        {form.suplentes_habilitados && (
          <select
            value={form.max_suplentes}
            onChange={(e) => setForm((f) => ({ ...f, max_suplentes: Number(e.target.value) }))}
          >
            {[1,2,3,4,5,6].map((n) => (
              <option key={n} value={n}>{n} suplente{n !== 1 ? 's' : ''}</option>
            ))}
          </select>
        )}
        <small className="muted">Se habilitado, os suplentes são aceitos até o limite selecionado.</small>
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
              maxLength={10}
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
              placeholder="HH:MM"
              required
            />
          </label>
        </div>
        <small className="muted">
          Antes desse horário, ninguém consegue entrar na lista.
        </small>
        {aberturaPreview && (
          <p className="abertura-preview">
            A lista será aberta em <strong>{aberturaPreview}</strong>.
          </p>
        )}
      </fieldset>

      {erro && <div className="alert alert-error">{erro}</div>}

      <button className="btn btn-primary" disabled={loading}>
        {loading ? 'Criando...' : 'Criar racha'}
      </button>
    </form>
  );
}

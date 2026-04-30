import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { computeVisitorHash } from '../utils/visitorHash';

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
    VISITOR_JA_INSCRITO:
      'Ja existe uma inscricao nesta lista a partir deste aparelho.',
    TOKEN_EXPIRADO: 'Sua sessao de entrada expirou. Recarregue a pagina.',
    TOKEN_INVALIDO: 'Sessao invalida. Recarregue a pagina.',
    TOKEN_JA_USADO: 'Este convite ja foi usado. Recarregue a pagina.',
    TOKEN_OBRIGATORIO: 'Recarregue a pagina e tente novamente.',
    VISITOR_HASH_INVALIDO: 'Recarregue a pagina e tente novamente.',
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
  const [entradaToken, setEntradaToken] = useState('');
  const [visitorHash, setVisitorHash] = useState('');
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [sessaoErro, setSessaoErro] = useState('');
  const [sessaoLoading, setSessaoLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setSessaoLoading(true);
    setSessaoErro('');
    (async () => {
      try {
        const [tok, vh] = await Promise.all([
          api.getTokenEntrada(rachaId),
          computeVisitorHash(),
        ]);
        if (cancelado) return;
        setEntradaToken(tok.token);
        setVisitorHash(vh);
        setSessaoPronta(true);
      } catch (e) {
        if (!cancelado) {
          setSessaoErro(mapJoinError(e) || e.message || 'Não foi possível preparar o formulário.');
          setSessaoPronta(false);
        }
      } finally {
        if (!cancelado) setSessaoLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [rachaId]);

  const canSubmit =
    Boolean(nome.trim()) &&
    !loading &&
    sessaoPronta &&
    Boolean(entradaToken) &&
    Boolean(visitorHash);

  async function onSubmit(e) {
    e.preventDefault();
    if (!nome.trim() || !sessaoPronta) return;
    setErro('');
    setSucesso('');
    setLoading(true);
    try {
      const res = await api.entrarNoRacha(rachaId, nome, posicao, entradaToken, visitorHash);
      setNome('');
      setPosicao('jogador');
      if (res?.jogador?.suplente) {
        setSucesso('Você entrou como suplente. Caso haja desistência você poderá ser convocado.');
      } else {
        setSucesso('Entrada confirmada. Boa sorte no racha!');
      }
      const tok = await api.getTokenEntrada(rachaId);
      setEntradaToken(tok.token);
    } catch (err) {
      setErro(mapJoinError(err));
      if (err?.code === 'TOKEN_EXPIRADO' || err?.code === 'TOKEN_JA_USADO' || err?.code === 'TOKEN_INVALIDO') {
        try {
          const tok = await api.getTokenEntrada(rachaId);
          setEntradaToken(tok.token);
        } catch (_e) {
          setSessaoErro('Recarregue a página para obter um novo convite de entrada.');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (sessaoLoading) {
    return (
      <div className="join-form join-form-loading muted" aria-busy="true">
        Preparando entrada segura…
      </div>
    );
  }

  if (sessaoErro && !sessaoPronta) {
    return (
      <div className="alert alert-error" role="alert">
        {sessaoErro}
      </div>
    );
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
          disabled={!sessaoPronta}
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
          disabled={!sessaoPronta}
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

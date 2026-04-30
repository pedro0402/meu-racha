import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="home-stack">
      <section className="card hero hero-split">
        <div>
          <h1>Sua lista em tempo real, sem mensagem perdida no grupo.</h1>
          <p>
            Crie o racha, compartilhe o link e acompanhe as vagas ao vivo.
            Quando a capacidade for atingida, a lista fecha automaticamente e o PDF fica na página para baixar ou mandar pelo WhatsApp.
          </p>
          <div className="hero-actions">
            <Link to="/criar" className="btn btn-primary">
              Criar meu racha
            </Link>
            <a href="#como-funciona" className="btn">
              Ver como funciona
            </a>
          </div>
        </div>

        <aside className="hero-panel" aria-label="resumo de recursos">
          <h2>Você ganha</h2>
          <ul className="bullet-list">
            <li>Ordem de chegada justa</li>
            <li>Atualização instantânea entre dispositivos</li>
            <li>Fechamento automático ao atingir limite</li>
            <li>PDF para baixar e link para o grupo</li>
          </ul>
        </aside>
      </section>

      <section className="card how-it-works" id="como-funciona">
        <h2>Como funciona</h2>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-num">01</span>
            <h3>Crie sua lista</h3>
            <p>Defina organizador, contato, limite de jogadores e horário de abertura.</p>
          </article>
          <article className="step-card">
            <span className="step-num">02</span>
            <h3>Compartilhe o link</h3>
            <p>A galera entra no próprio celular e você acompanha os nomes em tempo real.</p>
          </article>
          <article className="step-card">
            <span className="step-num">03</span>
            <h3>Fechamento automático</h3>
            <p>Ao completar as vagas, a lista trava e você baixa o PDF na própria página e pode mandar o link no WhatsApp.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

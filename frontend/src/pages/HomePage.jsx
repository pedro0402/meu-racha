import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="card hero">
      <h1>Sua lista de racha, sem confusão.</h1>
      <p>
        Crie um racha em segundos, compartilhe o link com a galera e veja a lista sendo preenchida em tempo real. Quando atingir o máximo de jogadores, o sistema fecha automaticamente e envia o PDF para o seu e-mail.
      </p>
      <Link to="/criar" className="btn btn-primary">
        Criar meu racha
      </Link>
    </div>
  );
}

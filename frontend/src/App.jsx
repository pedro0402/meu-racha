import { Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import CreateRachaPage from './pages/CreateRachaPage.jsx';
import RachaPage from './pages/RachaPage.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">⚽ MeuRacha</Link>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/criar" element={<CreateRachaPage />} />
          <Route path="/racha/:id" element={<RachaPage />} />
        </Routes>
      </main>

      <footer className="footer">
        <small>Lista justa, em ordem de chegada. Bom jogo! ⚽</small>
      </footer>
    </div>
  );
}

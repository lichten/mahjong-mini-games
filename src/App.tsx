import { Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { type GameMeta, games } from "./gameRegistry";
import { Home } from "./Home";

function GamePage({ game }: { game: GameMeta }) {
  const GameComponent = game.component;
  return (
    <div className="game-page">
      <header className="game-header">
        <Link to="/" className="back-link" aria-label="ゲーム一覧に戻る">
          ←
        </Link>
        <h1>{game.title}</h1>
      </header>
      <Suspense fallback={<p className="loading">読み込み中…</p>}>
        <GameComponent />
      </Suspense>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        {games.map((game) => (
          <Route
            key={game.path}
            path={`/${game.path}`}
            element={<GamePage game={game} />}
          />
        ))}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

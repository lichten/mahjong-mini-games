import { Link } from "react-router-dom";
import { games } from "./gameRegistry";

export function Home() {
  return (
    <main className="home">
      <header className="home-header">
        <h1>麻雀ミニゲーム集</h1>
        <p>隙間時間にサッと遊べる一人用の麻雀ゲーム</p>
      </header>
      <nav className="game-list" aria-label="ゲーム一覧">
        {games.map((game) => (
          <Link key={game.path} to={`/${game.path}`} className="game-card">
            <span className="game-card-title">{game.title}</span>
            <span className="game-card-desc">{game.description}</span>
            <span className="game-card-meta">
              <span className={`badge badge-${game.difficulty}`}>
                {game.difficulty}
              </span>
              <span className="playtime">{game.playTime}</span>
            </span>
          </Link>
        ))}
      </nav>
      <footer className="home-footer">
        牌画像:{" "}
        <a
          href="https://github.com/FluffyStuff/riichi-mahjong-tiles"
          target="_blank"
          rel="noreferrer"
        >
          FluffyStuff/riichi-mahjong-tiles
        </a>{" "}
        (CC0)
      </footer>
    </main>
  );
}

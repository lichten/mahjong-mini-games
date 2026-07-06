import { randomInt, randomTenpaiHand } from "../../core";
import { MachiQuizGame } from "../shared/MachiQuizGame";

export default function ChinitsuMachiQuiz() {
  return (
    <MachiQuizGame
      generate={() =>
        randomTenpaiHand(Math.random, { suit: randomInt(3), tries: 5 })
      }
      storageKey="chinitsu-machi-quiz:best-streak"
      prompt="清一色のテンパイ形。待ちは?"
    />
  );
}

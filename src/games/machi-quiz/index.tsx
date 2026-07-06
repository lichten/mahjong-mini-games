import { randomTenpaiHand } from "../../core";
import { MachiQuizGame } from "../shared/MachiQuizGame";

export default function MachiQuiz() {
  return (
    <MachiQuizGame
      generate={() => randomTenpaiHand()}
      storageKey="machi-quiz:best-streak"
      prompt="このテンパイ形の待ちは?"
    />
  );
}

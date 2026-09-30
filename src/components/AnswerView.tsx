import type { Answer } from '../engine';
import { RecipeCard } from './cards/RecipeCard';
import {
  ClarifyCard,
  DropCard,
  DroppedByCard,
  FarmCard,
  InfoCard,
  ListCard,
  LocationCard,
  NotUnderstoodCard,
  PotionCard,
  TradesCard,
  UsesCard,
} from './cards/OtherCards';

/** Card visual de uma resposta. */
export function AnswerCard({ a, animate }: { a: Answer; animate?: boolean }) {
  switch (a.type) {
    case 'recipe':
      return <RecipeCard item={a.item} recipes={a.recipes} quantity={a.quantity} animate={animate} />;
    case 'smelt':
      return <RecipeCard item={a.recipes[0].result.id} recipes={a.recipes} quantity={1} animate={animate} />;
    case 'location':
      return <LocationCard a={a} />;
    case 'drops':
      return <DropCard a={a} />;
    case 'dropped_by':
      return <DroppedByCard a={a} />;
    case 'farm':
      return <FarmCard farm={a.farm} />;
    case 'info':
      return <InfoCard a={a} />;
    case 'potion':
      return <PotionCard a={a} animate={animate} />;
    case 'trades':
      return <TradesCard a={a} />;
    case 'uses':
      return <UsesCard a={a} />;
    case 'list':
      return <ListCard a={a} />;
    case 'clarify':
      return <ClarifyCard a={a} />;
    case 'not_understood':
      return <NotUnderstoodCard a={a} />;
  }
}

/** Duração simulada do "processamento" por tipo de resposta (600–1200 ms). */
export function thinkingBudget(a: Answer): number {
  switch (a.type) {
    case 'recipe':
    case 'smelt':
    case 'potion':
      return 1150;
    case 'farm':
      return 1100;
    case 'location':
    case 'drops':
    case 'dropped_by':
    case 'trades':
    case 'uses':
      return 950;
    case 'clarify':
    case 'not_understood':
      return 650;
    default:
      return 800;
  }
}

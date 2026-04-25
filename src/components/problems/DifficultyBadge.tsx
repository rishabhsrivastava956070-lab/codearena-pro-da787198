import { Badge } from "@/components/ui/badge";
import { difficultyBg, difficultyLabel } from "@/lib/difficulty";

export const DifficultyBadge = ({ difficulty }: { difficulty: string }) => (
  <Badge variant="outline" className={`${difficultyBg(difficulty)} font-medium`}>
    {difficultyLabel(difficulty)}
  </Badge>
);
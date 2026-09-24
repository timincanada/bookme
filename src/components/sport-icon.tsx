import { isOtherVerticalId } from "@/lib/bookme/verticals";
import {
  Camera,
  Circle,
  CircleDot,
  Code2,
  Crown,
  Drama,
  Dumbbell,
  Feather,
  Flag,
  Flower2,
  GraduationCap,
  Guitar,
  Languages,
  Mic,
  Music,
  Music2,
  Palette,
  PenLine,
  PersonStanding,
  Piano,
  Snowflake,
  Sparkles,
  Swords,
  Trophy,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<string, LucideIcon> = {
  tennis: CircleDot,
  soccer: Trophy,
  basketball: Circle,
  golf: Flag,
  swimming: Waves,
  hockey: Snowflake,
  pickleball: CircleDot,
  badminton: Feather,
  volleyball: Circle,
  "martial-arts": Swords,
  fitness: Dumbbell,
  yoga: Flower2,
  pilates: PersonStanding,
  dance: Sparkles,
  piano: Piano,
  voice: Mic,
  guitar: Guitar,
  violin: Music2,
  music: Music,
  painting: Palette,
  photography: Camera,
  acting: Drama,
  tutor: GraduationCap,
  languages: Languages,
  coding: Code2,
  chess: Crown,
};

export function SportIcon({
  sport,
  className,
}: {
  sport: string;
  className?: string;
}) {
  const Icon = MAP[sport] ?? (isOtherVerticalId(sport) ? PenLine : CircleDot);
  return <Icon className={cn("size-4", className)} strokeWidth={1.75} />;
}

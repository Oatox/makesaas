import {
  AtSign,
  BadgeCheck,
  CalendarCheck,
  Clapperboard,
  CreditCard,
  Globe,
  Hammer,
  HeartHandshake,
  LineChart,
  MessageCircle,
  Palette,
  Plug,
  Repeat,
  Send,
  Sparkles,
  Store,
  UserPlus,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

/** Each quest's icon on Accueil (pages/Today.tsx), by the key of its mission (shared/roadmap-missions.ts). */
const BY_KEY: Record<string, LucideIcon> = {
  "brand:logo": Palette,
  "build:claude": UserPlus,
  "build:first_version": Hammer,
  "build:online": Globe,
  "payment:whop": Store,
  "payment:in_app": CreditCard,
  "payment:test": BadgeCheck,
  "payment:connect": Plug,
  "video:account": AtSign,
  "video:track": LineChart,
  "video:prepare": Clapperboard,
  "video:posted": Send,
};

/** The same for the tasks whose key carries a tier or a day ("mrr_100:format", "daily:video:2026-11-24"). */
const BY_PART: [string, LucideIcon][] = [
  ["daily:video", Video],
  ["daily:comments", MessageCircle],
  [":format", Repeat],
  [":paywall", CreditCard],
  ["_accounts", UserPlus],
  [":retention", HeartHandshake],
  [":annual", CalendarCheck],
  [":creators", Users],
];

export function taskIcon(key: string): LucideIcon {
  return BY_KEY[key] ?? BY_PART.find(([part]) => key.includes(part))?.[1] ?? Sparkles;
}

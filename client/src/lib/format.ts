import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

export const formatPercent = (probability: number) => `${Math.round(probability * 100)} %`;

const compactFormatter = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

/** "950", "12,3 k", "1,2 M" */
export const formatCompact = (value: number) => compactFormatter.format(value);

/** "12 345" */
export const formatInteger = (value: number) => value.toLocaleString("fr-FR");

/** Rate with one decimal: 0.0734 → "7,3 %" */
export const formatRate = (rate: number) =>
  `${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

export const formatDecimal = (value: number) =>
  value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "sam. 22 nov. · 21:00" */
export const formatKickoff = (iso: string) => format(new Date(iso), "EEE d MMM · HH:mm", { locale: fr });

/** "22 nov. 2026" */
export const formatShortDate = (iso: string) => format(new Date(iso), "d MMM yyyy", { locale: fr });

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "22/11/2026", or "N/A" when missing/invalid. */
export const formatDate = (value: string | null | undefined) => {
  const date = parseDate(value);
  return date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A";
};

/** "Aujourd'hui à 21:00", "Hier à 21:00", "22 novembre 2026 à 21:00", or "N/A" when missing/invalid. */
export const formatDateTime = (value: string | null | undefined) => {
  const date = parseDate(value);
  if (!date) return "N/A";

  const time = format(date, "HH:mm", { locale: fr });
  if (isToday(date)) return `Aujourd'hui à ${time}`;
  if (isYesterday(date)) return `Hier à ${time}`;
  return format(date, "d MMMM yyyy 'à' HH:mm", { locale: fr });
};

/** Up to two initials from a name ("Jean Dupont" → "JD"), "U" when empty. */
export const getInitials = (name: string | null | undefined) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

/** "22 nov." */
export const formatDayMonth = (date: Date) => format(date, "d MMM", { locale: fr });

/**
 * A short "how long ago", for tight labels: "À l'instant", "Il y a 5 min", "Il y a 3 h", "Hier",
 * "Il y a 4 j", then the date ("22 nov.", with the year when it is not this one).
 */
export const formatAgoShort = (value: string | Date) => {
  const date = new Date(value);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (minutes < 24 * 60) return `Il y a ${Math.floor(minutes / 60)} h`;
  if (isYesterday(date)) return "Hier";
  if (minutes < 7 * 24 * 60) return `Il y a ${Math.floor(minutes / (24 * 60))} j`;
  return format(date, date.getFullYear() === new Date().getFullYear() ? "d MMM" : "d MMM yyyy", { locale: fr });
};

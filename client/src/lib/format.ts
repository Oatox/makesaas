import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

export const formatPercent = (probability: number) => `${Math.round(probability * 100)} %`;

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

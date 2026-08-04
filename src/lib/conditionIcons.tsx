import { Check, AlertTriangle, X, RotateCcw, Circle, type LucideIcon } from 'lucide-react';

/** Ikony pre štandardné stavy (podľa mockupu). Ak admin pridá vlastný stav,
 *  ktorý nie je v tomto zozname, použije sa neutrálna bodka ako fallback. */
const CONDITION_ICONS: Record<string, LucideIcon> = {
  dobry: Check,
  poskodeny: AlertTriangle,
  chybajuci: X,
  na_vymenu: RotateCcw,
};

export function getConditionIcon(key: string): LucideIcon {
  return CONDITION_ICONS[key] ?? Circle;
}

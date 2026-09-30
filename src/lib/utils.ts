import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Racik's type scale uses names tailwind-merge cannot recognise as sizes:
 * `text-body`, `text-read`, `text-14`. Left to itself it files them under
 * text COLOUR, so `cn("text-primary-foreground", "text-14")` silently threw
 * the colour away — which is how the small green buttons ended up with near
 * black text on green, at 2.63:1.
 *
 * Declaring the scale here makes size and colour independent again.
 */
const SIZES = [
  "micro",
  "label",
  "caption",
  "14",
  "15",
  "body",
  "read",
  "head",
  "title",
  "28",
  "34",
  "display",
];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: SIZES }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

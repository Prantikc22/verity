import { ogCard, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "QAShift vs TestSprite";

export default function Image() {
  return ogCard("COMPARISON", "QAShift vs TestSprite", "Which AI testing tool fits?");
}

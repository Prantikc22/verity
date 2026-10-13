import { ogCard, OG_SIZE } from "@/lib/og";
import { SOLUTION_SLUGS, solutionBySlug } from "@/lib/seo-pages";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Verity";

export function generateStaticParams() {
  return SOLUTION_SLUGS.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const page = solutionBySlug((await params).slug)!;
  return ogCard(page.eyebrow, page.h1, page.h1Accent);
}

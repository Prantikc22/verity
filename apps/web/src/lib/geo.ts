import { headers } from "next/headers";

/**
 * Whether the request originates from India. Vercel sets `x-vercel-ip-country`
 * at the edge. Used to decide currency: INR/USD toggle inside India, USD-only
 * everywhere else.
 */
export async function isIndia(): Promise<boolean> {
  try {
    const h = await headers();
    const country = h.get("x-vercel-ip-country");
    return country?.toUpperCase() === "IN";
  } catch {
    return false;
  }
}

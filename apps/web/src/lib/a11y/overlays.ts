/**
 * Anti-overlay detection.
 *
 * Clearpath's stance: overlay/widget tools mask accessibility problems instead
 * of fixing root cause. We detect known overlay scripts on scanned pages and
 * surface that the site is using a discredited approach. We never build or
 * endorse an overlay "fix".
 *
 * Detection is signature-based: each vendor ships a recognizable script host
 * and/or global. Matching is intentionally conservative to avoid false flags.
 */

export interface OverlayVendor {
  id: string;
  name: string;
  /** URL substrings that appear in the vendor's injected <script src>. */
  scriptHosts: string[];
  /** DOM id/class/global markers the widget injects. */
  domMarkers?: string[];
}

export const OVERLAY_VENDORS: OverlayVendor[] = [
  {
    id: "accessibe",
    name: "accessiBe",
    scriptHosts: ["acsbapp.com", "accessibe.com"],
    domMarkers: ["acsb-trigger", "__ACCESSIBE__", "acsb-widget"],
  },
  {
    id: "userway",
    name: "UserWay",
    scriptHosts: ["userway.org", "cdn.userway.org"],
    domMarkers: ["userwayAccessibilityIcon", "uw-s10-trigger", "UserWay"],
  },
  {
    id: "audioeye",
    name: "AudioEye",
    scriptHosts: ["audioeye.com", "ws.audioeye.com"],
    domMarkers: ["aeToolbar", "__AudioEyeSiteHash"],
  },
  {
    id: "equalweb",
    name: "EqualWeb / Nagich",
    scriptHosts: ["equalweb.com", "nagich.com", "aacdn.nagich.com"],
    domMarkers: ["INDmenu", "equalweb"],
  },
  {
    id: "accessiway",
    name: "AccessiWay",
    scriptHosts: ["accessiway.com"],
  },
  {
    id: "maxaccess",
    name: "Max Access",
    scriptHosts: ["maxaccess.io"],
  },
  {
    id: "adally",
    name: "Adally",
    scriptHosts: ["adally.com"],
  },
  {
    id: "usercentrics-audioeye",
    name: "AudioEye (Web Accessibility)",
    scriptHosts: ["wa.audioeye.com"],
  },
];

/**
 * Detect overlay vendors from the set of script-src URLs and inline markers
 * collected on the page. Returns vendor display names.
 */
export function detectOverlays(input: {
  scriptUrls: string[];
  markers?: string[];
}): string[] {
  const haystackUrls = input.scriptUrls.map((u) => u.toLowerCase());
  const markerSet = new Set((input.markers ?? []).map((m) => m.toLowerCase()));
  const found = new Set<string>();

  for (const vendor of OVERLAY_VENDORS) {
    const hostHit = vendor.scriptHosts.some((host) =>
      haystackUrls.some((u) => u.includes(host)),
    );
    const markerHit = (vendor.domMarkers ?? []).some((m) =>
      markerSet.has(m.toLowerCase()),
    );
    if (hostHit || markerHit) found.add(vendor.name);
  }

  return [...found];
}

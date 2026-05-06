// Detection module — pure, no I/O, fully unit-testable.
// Used by both the webhook handler (server) and the sidebar (client).

export type Participant = {
  name: string;
  email?: string | null;
  zoomUserId?: string | null;
  isGuest?: boolean;
};

export type DetectionConfig = {
  strictness: "strict" | "balanced" | "lenient";
  customBlocklistNames: string[];
  customBlocklistDomains: string[];
  allowlistNames: string[];
  allowlistEmails: string[];
};

export type DetectionResult =
  | { match: false }
  | { match: true; reason: string; confidence: "high" | "medium" };

export const DEFAULT_CONFIG: DetectionConfig = {
  strictness: "balanced",
  customBlocklistNames: [],
  customBlocklistDomains: [],
  allowlistNames: [],
  allowlistEmails: [],
};

const DEFAULT_NAME_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\botter(\.ai|pilot)?\b/i, label: "name:otter" },
  { re: /\bfireflies(\.ai)?\b/i, label: "name:fireflies" },
  { re: /\bfred\b/i, label: "name:fireflies-fred" },
  { re: /\bread\.?ai\b/i, label: "name:read.ai" },
  { re: /\bfathom\b/i, label: "name:fathom" },
  { re: /\btl;?dv\b/i, label: "name:tldv" },
  { re: /\bgranola\b/i, label: "name:granola" },
  { re: /\bnotta\b/i, label: "name:notta" },
  { re: /\bavoma\b/i, label: "name:avoma" },
  { re: /\bgong\b/i, label: "name:gong" },
  { re: /\bchorus(\.ai)?\b/i, label: "name:chorus" },
  { re: /\bsembly\b/i, label: "name:sembly" },
  { re: /\bmeetgeek\b/i, label: "name:meetgeek" },
  { re: /\bgrain\b/i, label: "name:grain" },
  { re: /krisp.*note/i, label: "name:krisp-notes" },
  { re: /\bnote[- ]?taker\b/i, label: "name:generic-notetaker" },
  { re: /\b(ai\s+)?(notes?|meeting)\s+bot\b/i, label: "name:generic-bot" },
];

const DEFAULT_BOT_DOMAINS = [
  "otter.ai",
  "fireflies.ai",
  "read.ai",
  "fathom.video",
  "tldv.io",
  "avoma.com",
  "gong.io",
  "sembly.ai",
  "meetgeek.ai",
  "grain.com",
  "notta.ai",
];

export function detect(p: Participant, cfg: DetectionConfig): DetectionResult {
  const name = (p.name || "").trim();
  const email = (p.email || "").toLowerCase().trim();

  if (cfg.allowlistNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
    return { match: false };
  }
  if (email && cfg.allowlistEmails.includes(email)) {
    return { match: false };
  }

  const domain = email.split("@")[1];
  if (domain) {
    if (
      DEFAULT_BOT_DOMAINS.includes(domain) ||
      cfg.customBlocklistDomains.includes(domain)
    ) {
      return { match: true, reason: `domain:${domain}`, confidence: "high" };
    }
  }

  for (const { re, label } of DEFAULT_NAME_PATTERNS) {
    if (re.test(name)) {
      return { match: true, reason: label, confidence: "high" };
    }
  }

  for (const term of cfg.customBlocklistNames) {
    if (term && name.toLowerCase().includes(term.toLowerCase())) {
      return { match: true, reason: `name:custom:${term}`, confidence: "high" };
    }
  }

  if (cfg.strictness === "strict") {
    if (p.isGuest && /\b(bot|ai|assistant|recorder|transcriber)\b/i.test(name)) {
      return {
        match: true,
        reason: "heuristic:strict-keywords",
        confidence: "medium",
      };
    }
  }

  return { match: false };
}

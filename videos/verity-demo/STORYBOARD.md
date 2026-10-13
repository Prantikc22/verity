---
format: 1920x1080
duration: 48s
message: "Paste a URL. AI writes the tests. Your CI keeps the proof."
arc: Demo Loop — question → product intro → demo cycle (write → cover → run) → verdict → trust → CTA
audience: Engineering leads and developers shipping web apps fast, often with AI coding agents
mode: autonomous
music: confident minimal modern tech underscore, steady pulse, no vocals
---

## Video direction

- **palette system** (frame.md roles): canvas `cream` = #050608 near-black ground on every frame; ink `ink-black` = #F7F7F3 for display/body type; sole accent `fire-orange` = #79F2A6 green — pass / verified / the one hero word per frame; `cream-muted` = #7657FF violet — Verity brand moments (mark, CTA pill, active states); cyan #45D5FF only for code/test-file labels; amber #FFB547 = flaky, red #FF6B6B = real failure (semantic status only, never decorative). 1px hairlines in ink at ~12% for every panel border; zero radius except the CTA pill.
- **type**: display = Inter at the pack's heaviest weights, tight negative tracking; mono chrome (labels, paths, code) = Geist Mono, uppercase + tracked for labels, sentence-case for code.
- **motion grammar + reveal model**: long-tail eases (power3 out default; expo out only for the one hard push per section). There is no voiceover, so on-screen TYPE is the cue track: every frame reveals one cue at a time, in reading order, each held long enough to read (~1.2s per short line); nothing appears before the line before it has landed. During holds only a caret blink or a status-dot pulse may move — no breathing, no drift.
- **rhythm / held frames**: F1 fast swaps (energy), F2–F6 product demo builds, **F7 is the breather** (three statements, each held still), F8 lands and holds still to the last frame.
- **negative list**: no slideshow (front-load then freeze) and no screensaver (independent floating). No bokeh, no purple-blue AI gradients, no stock imagery, no rounded glassmorphism, no fake browser chrome beyond one minimal title bar on code/terminal panels. No tool names on screen except Playwright, GitHub, GitLab, Jenkins.

## Frame 1 — Did anything break?

- scene: Kinetic type — "You shipped a change." then the object word swaps in place — checkout? sign-up? billing? — landing on "Did anything break?"
- voiceover: ""
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Pain validation
- beat: tension + curiosity
- asset_candidates:

- blueprint: kinetic-type-beats (Reproduce — fixed line, in-place token swap)
- focal: (typography)
- roles: (none)
- sfx: soft-tick on each swap, low impact on the last line

Scene 1 (0.0–1.2s): "You shipped a change." — display ink, centered, ~60% width, enters as a single word-by-word rise; nothing else on the near-black ground.
Scene 2 (1.2–3.4s): the line hard-cuts to "Is checkout still working?" and the object word swaps IN PLACE by hard cut — checkout → sign-up → billing — the swapping word in the green accent, the rest of the line fixed (the signature: only the token changes). Centered, one line.
Scene 3 (3.4–5.0s): the line clears and "Did anything break?" lands centered at hero size with a spring-pop settle; holds still to the cut.

narrativeRole: open on the viewer's own unanswered question after every merge.
keyMessage: you don't actually know your critical flows still work.

On-screen cues: "You shipped a change." · "Is checkout still working?" (swap: checkout → sign-up → billing) · "Did anything break?"

## Frame 2 — Paste a URL

- scene: Verity's real hero URL field ("https://" prefix + input + "Generate my first test" button) — the URL staging.greenhouse.app types in live, the button is pressed
- voiceover: ""
- duration: 5s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/02-paste-url.html
- type: product_intro
- persuasion: Friction reduction
- beat: relief + curiosity
- asset_candidates: assets/favicon.svg — the Verity brand mark (V-as-checkmark), small lockup above the field

- blueprint: prompt-type-submit-generate (Adapt — keep live typing into the product's own input + submit press; the input is Verity's URL field, not a chat box)
- focal: assets/favicon.svg
- roles: favicon.svg = supporting (small lockup above the field)

Adapt: keep the type-then-submit spine; the composer is the landing-page URL field ("https://" mono prefix + input + white "Generate my first test →" button), ending on the press instead of a response.
Scene 1 (0.0–1.0s): headline "Paste a URL." rises in, upper third, display ink; the Verity mark + "Verity" wordmark sits small above it. Centered.
Scene 2 (1.0–3.0s): the URL field (1px hairline box, ~55% width) eases up under the headline; "staging.greenhouse.app" types character by character after the "https://" prefix with a blinking caret — the field border warms to green on focus.
Scene 3 (3.0–4.2s): the button depresses (scale-down press + flash) and its label swaps to "Writing tests…" with a small spinner.
Scene 4 (4.2–5.0s): microcopy "Free plan · no credit card" fades in under the field; hold.

narrativeRole: introduce Verity as the answer and show the whole input is one URL.
keyMessage: Verity starts from your live app — no test scripts to write.

On-screen cues: headline "Paste a URL." · URL types: staging.greenhouse.app · button "Generate my first test →" pressed · microcopy "Free plan · no credit card"

## Frame 3 — It writes the Playwright

- scene: A code editor pane titled tests/verity/ui/checkout.spec.ts streams in real AI-written Playwright line by line; role-based locators (getByRole, getByLabel) glow as they appear; a status line "Verified in a real browser ✓"
- voiceover: ""
- duration: 7s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-writes-playwright.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: clarity + confidence
- asset_candidates: assets/logo-a63c10fa.svg — Playwright logo, small badge on the editor tab

- blueprint: prompt-type-submit-generate (Adapt — the response half: a streaming generated artifact)
- focal: assets/logo-a63c10fa.svg
- roles: logo-a63c10fa.svg = supporting (badge on the editor tab)

Adapt: keep the streaming-answer signature (output appears line by line as if being written); the artifact is a code pane, not chat text.
Scene 1 (0.0–1.0s): an editor pane slides up into an asymmetric 65/35 layout (pane left ~65%): minimal title bar with tab "tests/verity/ui/checkout.spec.ts" in cyan mono + Playwright badge. Right column empty.
Scene 2 (1.0–4.6s): the real spec streams in line by line (syntax-tinted mono: keywords violet, strings green); as each getByRole / getByLabel line lands, its locator gets a brief green underline glow. Right column: "Readable Playwright." appears with line 1.
Scene 3 (4.6–6.0s): right column adds "Grounded in your live app." then "Yours to keep." as two stacked lines, each on its cue.
Scene 4 (6.0–7.0s): a status strip under the pane resolves "● Verified in a real browser ✓" in green; hold.

narrativeRole: show the deliverable is real, readable code — the "you own it" claim made visible.
keyMessage: readable Playwright, grounded in the live page, yours to keep.

Code (real, from Verity's generator):
```
test("guest can check out with a saved cart", async ({ page }) => {
  await page.goto("https://staging.greenhouse.app/cart");
  await page.getByRole("button", { name: "Checkout" }).click();
  await page.getByLabel("Email").fill("guest@example.com");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: "Order confirmed" })).toBeVisible();
});
```
On-screen cues: "Readable Playwright." · "Grounded in your live app." · "Yours to keep."

## Frame 4 — Every layer that can break

- scene: Six test-type tiles self-assemble into a 3×2 grid, each with its real file path and a one-line check: UI journeys (ui/checkout.spec.ts) · API (api/items.spec.ts) · Visual (visual/home.visual.spec.ts) · AI agent evals (agent/verity.evals.yaml) · Load (perf/verity.k6.js) · Security (code + app scans)
- voiceover: ""
- duration: 6s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/04-every-layer.html
- type: feature_showcase
- persuasion: Value stacking
- beat: power + clarity
- asset_candidates:

- blueprint: grid-card-assemble (Reproduce — labeled tile grid self-assembles)
- focal: (typography + tiles)
- roles: (none)

Scene 1 (0.0–0.9s): headline "Every layer that can break." upper third, left-aligned, display ink.
Scene 2 (0.9–4.4s): a 3×2 grid of hairline tiles (~80% width) assembles one tile at a time in reading order — UI journeys · API · Visual · AI agent evals · Load · Security — each tile: big label (display), real file path in cyan mono (ui/checkout.spec.ts, api/items.spec.ts, visual/home.visual.spec.ts, agent/verity.evals.yaml, perf/verity.k6.js, code + app scans), one-line check in muted ink. Each tile drops in with a short rise and a top-edge green rule that draws left→right.
Scene 3 (4.4–6.0s): a pill chip "All six on every plan — Free included" fades in under the grid; the grid holds still.

narrativeRole: widen from one test to the whole product — the differentiator vs UI-only tools.
keyMessage: six kinds of test from one place, on every plan.

On-screen cues: headline "Every layer that can break." · tiles assemble in order UI → API → Visual → AI agent → Load → Security · footer chip "All six on every plan — Free included"

## Frame 5 — Commit one workflow

- scene: A terminal-style YAML card types the real generated GitHub workflow step (uses: qashift/verity-action@v1, tier, engines: ui,api,visual,agent,perf,security); then a git line "git commit -m 'Add Verity' → pushed"; chip "Runs in YOUR CI · unlimited runs"
- voiceover: ""
- duration: 6s
- transition_in: crossfade
- status: animated
- src: compositions/frames/05-commit-workflow.html
- type: feature_showcase
- persuasion: Friction reduction
- beat: ease + control
- asset_candidates: assets/logo-e39d26bc.svg — GitHub logo on the workflow card; assets/logo-865f34be.svg — GitLab logo as an alternate provider chip

- blueprint: prompt-type-submit-generate (Adapt — the install/terminal end-card variant)
- focal: assets/logo-e39d26bc.svg
- roles: logo-e39d26bc.svg = supporting (card header icon) · logo-865f34be.svg = supporting (provider chip)

Adapt: keep the typed-command-in-a-terminal signature; the command is a YAML workflow step followed by a git commit line.
Scene 1 (0.0–0.9s): headline "Commit one workflow." left column (40%), display ink.
Scene 2 (0.9–3.6s): right column (60%): a terminal card with title ".github/workflows/verity.yml" + GitHub icon; the YAML types line by line — "- uses: qashift/verity-action@v1" / "with:" / "tier: fast" / "engines: ui,api,visual,agent,perf,security" — keys in violet, values in ink, caret blinking.
Scene 3 (3.6–4.8s): below the YAML a prompt line types "$ git commit -m \"Add Verity\" && git push" and resolves "✓ pushed" in green.
Scene 4 (4.8–6.0s): left column adds "Runs in your CI." then "Unlimited runs." on their cues; a provider chip row (GitHub Actions · GitLab · Jenkins) fades in beneath; hold.

narrativeRole: show how tests start running with almost no setup, on infrastructure the customer owns.
keyMessage: one file, your runners, no per-run meter.

YAML (real generator output, trimmed):
```
- uses: qashift/verity-action@v1
  with:
    tier: fast
    engines: ui,api,visual,agent,perf,security
```
On-screen cues: "Commit one workflow." · "Runs in your CI." · "Unlimited runs." · chips: GitHub Actions · GitLab · Jenkins

## Frame 6 — Every PR gets a verdict

- scene: A GitHub pull-request check panel "Verity — Quick check" resolves row by row from real run data: ✓ 38 passed; "Invalid credentials are rejected — ✗ ✗ ✓ → flaky, not blocking" (amber); "GET /api/items/{id} — Undocumented HTTP status code · Received 400 · Documented 200, 404" (red, real failure) with a "Reproduce: curl -X GET …" evidence line; a load row "p95 1 ms · 0% errors"; a security row "6 findings · CSP header not set (medium)"
- voiceover: ""
- duration: 8s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/06-pr-verdict.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: trust + control
- asset_candidates: assets/logo-e39d26bc.svg — GitHub logo on the PR check header

- blueprint: agent-progress-theater (Adapt — status theater resolving into a checklist; the checklist is a PR check panel)
- focal: assets/logo-e39d26bc.svg
- roles: logo-e39d26bc.svg = supporting (panel header)

Adapt: keep the "rows resolve from pending to a result one by one" signature; results are real run data, and two rows end in amber/red instead of all-green.
Scene 1 (0.0–1.0s): headline "Every PR gets a verdict." upper third; below it a GitHub check panel (~75% width) titled "Verity — Quick check · PR #482" with five rows all in a pending spinner state.
Scene 2 (1.0–5.2s): rows resolve top to bottom, one per ~0.8s: ✓ "UI + API · 38 passed" (green) → ◐ "Invalid credentials are rejected — ✗ ✗ ✓ flaky, not blocking" (amber, the three attempt dots fill in sequence) → ✗ "GET /api/items/{id} — Undocumented status · received 400, documented 200, 404" (red) → ✓ "Load · p95 1 ms · 0% errors" (green) → ● "Security · 6 findings · CSP header not set (medium)" (ink).
Scene 3 (5.2–6.6s): a callout tag "Flaky ≠ broken" pins to the amber row; then the red row expands to show the evidence line "Reproduce: curl -X GET …/api/items/null" in mono.
Scene 4 (6.6–8.0s): a second callout "With the evidence to fix it." pins to the red row; hold.

narrativeRole: the payoff — what the team actually gets on every pull request.
keyMessage: a verdict with evidence, and flaky is never confused with broken.

On-screen cues: headline "Every PR gets a verdict." · rows resolve top-to-bottom · callout on the flaky row "Flaky ≠ broken" · callout on the red row "With the evidence to fix it."

## Frame 7 — Built to be trusted

- scene: Three value statements relay, each held alone: "Flaky ≠ broken." · "Self-healing you review as a diff." · "Your code never leaves your CI."
- voiceover: ""
- duration: 5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/07-trust.html
- type: benefit_highlight
- persuasion: Rule of three
- beat: peace of mind
- asset_candidates:

- blueprint: kinetic-type-beats (Reproduce — slow 3-statement relay, each held)
- focal: (typography)
- roles: (none)

Scene 1 (0.0–1.6s): "Flaky ≠ broken." centered, display, the "≠" in green; held still.
Scene 2 (1.6–3.3s): hard cut to "Self-healing you review as a diff." with a tiny inline diff glyph (− red / + green) beside it; held.
Scene 3 (3.3–5.0s): hard cut to "Your code never leaves your CI."; held still to the cut (breather frame).

narrativeRole: convert the demo into the three reasons a skeptical engineer says yes.
keyMessage: it is honest about failures and safe with your code.

## Frame 8 — Start free

- scene: Verity mark + wordmark assemble into a lockup; the tagline "AI writes the tests. Your CI keeps the proof." types beneath; CTA pill "Start free →" and URL verity.qashifthq.com; microcopy "Free plan · no credit card · unlimited CI runs"
- voiceover: ""
- duration: 6s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/08-cta.html
- type: cta
- persuasion: Risk reversal
- beat: urgency-to-act
- asset_candidates: assets/favicon.svg — the Verity brand mark for the lockup

- blueprint: logo-assemble-lockup (Adapt — Brand_Outro/CTA build, static frame; no camera push)
- focal: assets/favicon.svg
- roles: favicon.svg = cutout (the mark)

Adapt: keep the mark-then-wordmark build into a lockup; skip the push-through (a calm end card suits an embedded landing video).
Scene 1 (0.0–1.4s): the Verity mark scales in centered (its V-stroke and inner check draw on), then "Verity" wordmark slides out to its right to complete the lockup; centered, upper-middle.
Scene 2 (1.4–3.4s): tagline "AI writes the tests. Your CI keeps the proof." types beneath the lockup; "Your CI keeps the proof." in green.
Scene 3 (3.4–4.6s): the violet CTA pill "Start free →" springs in below with "verity.qashifthq.com" in mono beside it.
Scene 4 (4.6–6.0s): microcopy "Free plan · no credit card · unlimited CI runs" fades in; everything holds still to the last frame.

narrativeRole: close on the brand, the promise, and a zero-risk next step.
keyMessage: try it free on your own app today.

# Design System

The portal is a public record system of the Kogi State Civil Service Commission,
not a consumer product. Its interface is designed to read as official: restrained,
legible, dense where officers work with data, and unmistakably governmental.

Everything below is implemented in two files, so a change to a token carries
across all of the portal's pages:

- `tailwind.config.ts` — the colour scales, type families, radii, shadows and
  letter-spacing tokens.
- `src/app/globals.css` — the component layer (`.btn-*`, `.card`, `.input`,
  `.table`, `.badge-*`, `.micro-label`, `.prose-content` and the rest).

Shared React components live in `src/components/ui.tsx`; the public, applicant
and administrative chrome lives in `src/components/site-chrome.tsx`,
`src/components/admin-nav.tsx` and the three layouts under `src/app`.

## Typography

| Role | Face | Used for |
| --- | --- | --- |
| Display | Source Serif 4 | Headings, page titles, card titles, figures in statistic panels |
| Text | Public Sans | Body copy, forms, tables, navigation, buttons |
| Mono | IBM Plex Mono | References, examination numbers, codes, grade levels, the test countdown |

The serif/sans pairing is deliberate: an editorial serif gives headings the
authority of a gazette, while a neutral civic sans keeps dense forms and tables
readable. Fonts are self-hosted through `next/font`, so there is no layout shift
and no third-party request at runtime.

Figures that are compared in a column are set with `font-variant-numeric:
tabular-nums` (applied automatically to `table` and to anything marked
`data-numeric`), so digits align.

Small capitalised labels (`.micro-label`) carry `0.08em` letter-spacing; the
seal wordmark (`.seal-text`) carries `0.22em`.

## Colour

Four scales, all deliberately desaturated:

- **kogi** — a deep forest green, the Commission's primary colour. `kogi-700`
  to `kogi-950` carry the chrome; `kogi-50` and `kogi-100` tint selected rows
  and panels.
- **gold** — a muted ceremonial gold for the crest, rules under the masthead,
  the active item in the administrative sidebar, and warnings. It is never used
  for large areas.
- **ink** — a warm neutral "ink on paper" scale replacing Tailwind's cool grey.
  All text, rules and chrome backgrounds come from it. `ink-100` is the page,
  white is the paper, `ink-950` is the darkest text.
- **signal** — four status tones (information, warning, danger, success), each
  with a matching tint, used for alerts, badges and validation.

Status colours are only ever applied through `.badge-*`, `Alert` and
`StatusBadge`, so a single status vocabulary runs across all 90-odd routes.

## Form and surface

- **Radii are small**: 2px for controls and badges, 4px for panels. Forms and
  tables should read as printed documents, not as cards in a feed.
- **Rules, not shadows**: surfaces are separated by 1px `ink-200` hairlines.
  The only shadows are `shadow-raised` (a hairline plus a 1px lift) and
  `shadow-panel` for the fixed chrome.
- **Accent rules**: statistic panels, alerts and advertisement cards carry a
  4px coloured rule on their leading edge rather than a tinted background.
- **Tables are dense**: 13px text, zebra striping at 40% tint, hairline row
  rules, a double rule above a totals row, and right-aligned numeric columns
  (`.num`).
- **Long-form text is measured**: `.prose-content` is capped at 68 characters
  (`max-w-measure`) with 1.75 line height.

## Structure

- The public masthead has three bands: a government bar, the crest and name
  over a woven green field with a gold rule beneath, and a white navigation bar.
- The administrative shell is a dark green sidebar grouped by function —
  Overview, Establishment, Recruitment, Examinations & Tests, Portal Content,
  Administration, Communication, System — filtered by the signed-in officer's
  permissions.
- The examination hall (`/examination/[id]`) sits outside the portal
  navigation: a candidate under a clock is given the question, the countdown,
  the navigator and nothing else.

## The seal

`CommissionCrest` is drawn as inline SVG rather than a bitmap, so it stays
crisp at every size and prints cleanly on admission slips and letters. Its
device is the confluence of the Niger and the Benue at Lokoja above the scales
of merit-based appointment.

## Accessibility

- Every page has a skip link to `#main-content`.
- Focus is always visible: a 2px `kogi-600` ring with a 2px offset, applied
  globally through `:focus-visible`.
- Status is never carried by colour alone — every badge also carries its text.
- The countdown is a `role="timer"` with `aria-live="polite"`; the question
  navigator labels each question as answered, unanswered or flagged.
- Required fields are marked with the word "required", not only an asterisk.
- Layouts are checked for horizontal overflow at 390px by the browser suite.

## Print

`@media print` removes the chrome (`.no-print`), drops the page tint to white
and gives panels a plain black border, so admission slips, score sheets and
selection lists print as records.

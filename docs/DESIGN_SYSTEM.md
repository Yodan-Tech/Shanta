# SHANTA — Design System

> The brand identity translated into concrete, build-ready tokens. Strategy/voice come from
> [Branding/brand.md](../Branding/brand.md); color values here are **sampled from the actual logo
> assets** in `/Branding`, not invented. This is the single source of truth for the Flutter
> `ThemeData` and the admin panel (Tailwind/Shadcn). Referenced by [PRD.md](PRD.md) (voice) and
> [TRD.md](TRD.md) (frontend theming).

## Brand at a glance

- **Name / category:** Shanta — peer-to-peer travel-delivery platform.
- **Promise:** *Send what matters through people you can trust.*
- **Primary tagline:** **Carry More Than Luggage.** (Secondary: *Travel. Carry. Connect.*)
- **Archetype:** The Connector (primary) + The Explorer (secondary) — building bridges between
  people, cities, and opportunities.
- **Personality:** Trustworthy · Elegant · Modern · Human · Global · Sophisticated · Reliable ·
  Forward-thinking.
- **Never:** Cheap · Playful · Cartoonish · Overly corporate · "traditional logistics."
- **Emotional territory:** Belonging, connection, movement, opportunity, trust, human relationships.
- **Logo idea:** the mark is a continuous path forming an **"S"** — two interlocking strokes
  representing people connected by journeys; the two amber dots are the endpoints (sender ↔ receiver).

## Color Tokens (sampled from `Branding/logoo.png`)

The brand is **two colors on generous white**: deep navy + golden amber. Restraint is the point —
premium, trustworthy, never cheap.

| Token | Hex | Use |
|---|---|---|
| `brand/navy` (primary) | **#11234A** | Logo, primary text, headers, primary buttons, app bars |
| `brand/amber` (accent) | **#F5BD2E** | Accent dots, highlights, CTAs that need warmth, status/active marks |
| `navy/900` | #0B1730 | Pressed/dark surfaces, deep contrast text |
| `navy/700` | #11234A | = primary navy |
| `navy/500` | #2A4475 | Secondary navy, icons, links on light |
| `navy/300` | #8A9BBE | Disabled navy, hint text |
| `amber/600` | #D99E12 | Amber pressed / on-light text needing contrast |
| `amber/500` | #F5BD2E | = accent amber |
| `amber/300` | #FBE0A0 | Amber tint backgrounds, subtle highlights |
| `neutral/0` | #FFFFFF | Primary background (the brand breathes on white) |
| `neutral/50` | #F6F8FB | App background, cards |
| `neutral/200` | #E2E8F0 | Borders, dividers |
| `neutral/500` | #64748B | Secondary text |
| `neutral/900` | #0F172A | Body text on light (near-navy) |

### Semantic colors
| Token | Hex | Use |
|---|---|---|
| `success` | #1E9E6A | Delivered / confirmed / escrow released |
| `warning` | #F5BD2E (amber) | Pending sync, awaiting action |
| `danger` | #D64545 | Disputed, rejected, prohibited item, failures |
| `info` | #2A4475 (navy/500) | Neutral status |

### Accessibility
- Body text uses `neutral/900` or `brand/navy` on `neutral/0/50` → AA+.
- **Amber on white fails contrast for text** — never use `amber/500` for body text on white. Amber is
  for fills, accents, and large UI marks; for amber-colored text use `amber/600` on white or amber
  on navy. Primary buttons = navy fill + white text; high-emphasis CTAs may use amber fill + navy text.

## Typography

Modern, clean, humanist sans — elegant and legible on low-end Android. **Amharic (Ethiopic) support
is mandatory** in the type stack from day one (i18n).

- **Latin:** **Inter** (or platform default if Inter unavailable) — excellent small-size legibility.
- **Ethiopic:** **Noto Sans Ethiopic** — pairs cleanly with Inter; ensures Amharic renders well.
- Bundle Noto Sans Ethiopic with the app (don't rely on device fonts on cheap handsets).

| Style | Size / weight | Use |
|---|---|---|
| Display | 28–32 / 700 | Onboarding, hero moments |
| H1 | 24 / 700 | Screen titles |
| H2 | 20 / 600 | Section headers |
| Body L | 16 / 400 | Primary content (min for primary actions) |
| Body M | 14 / 400 | Secondary content |
| Caption | 12 / 500 | Metadata, timestamps, status chips |
| Button | 16 / 600 | All buttons (large tap targets) |

Min body text 14px; primary actions 16px. Line-height 1.4–1.5. Avoid light weights on low-end screens.

## Logo Usage

- **Variants** (in `/Branding`): symbol-only "S" mark, horizontal lockup (mark + "Shanta"),
  app-icon (navy rounded square), monochrome.
- **Clear space:** ≥ the height of one amber dot on all sides.
- **Min size:** symbol 24px (favicon/app icon contexts); lockup 96px wide minimum for legibility.
- **Backgrounds:** prefer white/`neutral/50`. On navy, use the white/monochrome version + amber dots.
- **Don'ts:** don't recolor the mark outside brand navy/amber; don't add shadows/gradients/outlines;
  don't stretch, rotate, or place the color mark on a busy photo; don't make it "playful."

## UI Principles (from the 5 brand design principles)

1. **Simplicity** — every flow effortless; one primary action per screen; <60s to complete critical
   actions (Ethiopian load-shedding/low-battery reality).
2. **Trust** — transparency and safety visible: show the photo evidence chain, seal status, who has
   custody, and a clear price breakdown. Trust cues are UI, not fine print.
3. **Human first** — people before packages: show names/faces of the people in the journey (within
   privacy limits), warm acknowledgment copy, human language over logistics jargon.
4. **Premium** — generous white space, restrained two-color palette, crisp type, smooth motion.
   Quality of interaction signals reliability. Never cluttered, never "cheap."
5. **Global, built in Ethiopia** — i18n/Amharic-ready, RTL-safe layouts where relevant, but rooted in
   Ethiopian context (phone-first, SMS-inclusive, low-bandwidth imagery).

**Low-bandwidth aesthetic:** lean on color, type, and whitespace — not heavy imagery. Thumbnails over
full-res by default; lazy-load; show clear "pending sync" states (use `warning`/amber) rather than
ambiguous spinners.

## Token Mappings

### Flutter `ThemeData` (mobile)
```dart
const navy   = Color(0xFF11234A);  // brand/navy   (sampled)
const amber  = Color(0xFFF5BD2E);  // brand/amber  (sampled)
const navy900 = Color(0xFF0B1730);
const amber600 = Color(0xFFD99E12);

final shantaTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: navy,
    primary: navy,
    secondary: amber,
    surface: const Color(0xFFFFFFFF),
    error: const Color(0xFFD64545),
    brightness: Brightness.light,
  ),
  scaffoldBackgroundColor: const Color(0xFFF6F8FB),
  fontFamily: 'Inter',                       // + Noto Sans Ethiopic fallback for Amharic
  // fontFamilyFallback: ['NotoSansEthiopic'],
  appBarTheme: const AppBarTheme(backgroundColor: navy, foregroundColor: Colors.white),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(backgroundColor: navy, foregroundColor: Colors.white),
  ),
);
```

### Tailwind / Shadcn (admin panel)
```js
// tailwind.config — theme.extend.colors
colors: {
  navy:  { DEFAULT: '#11234A', 900:'#0B1730', 700:'#11234A', 500:'#2A4475', 300:'#8A9BBE' },
  amber: { DEFAULT: '#F5BD2E', 600:'#D99E12', 500:'#F5BD2E', 300:'#FBE0A0' },
  success:'#1E9E6A', danger:'#D64545', info:'#2A4475',
}
```
```css
/* Shadcn CSS variables (globals.css) — light theme */
:root {
  --primary: 218 62% 18%;        /* navy  #11234A */
  --primary-foreground: 0 0% 100%;
  --accent: 43 91% 57%;          /* amber #F5BD2E */
  --accent-foreground: 218 62% 18%;
  --destructive: 0 63% 55%;      /* #D64545 */
  --background: 0 0% 100%;
  --ring: 218 62% 18%;
}
```

> The admin panel doesn't need to be beautiful (per architecture), but using these tokens keeps it
> on-brand for free. The **mobile app must fully honor** this system — it is the premium, trust-first
> surface users judge Shanta by.

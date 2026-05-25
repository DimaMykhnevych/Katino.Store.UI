# KATINO Store UI — Project Rules

## Stack

- **Angular 12** with strict mode
- **Angular Material 12** — full MaterialModule is exported from `src/app/layout/material/`
- **Bootstrap 5** — available for grid utilities (`d-none`, `d-lg-flex`, `container-fluid`, etc.)
- **ngx-translate** — i18n with `en` and `ua` locales

## Rules

### 1. Styling

- Use **both Bootstrap utilities and Angular Material** components where appropriate.
- All brand colors live in `src/theme/_variables.scss` as SCSS variables **and** CSS custom properties.  
  Import them in any component SCSS with: `@import 'theme/variables';`  
  (`stylePreprocessorOptions.includePaths` is set to `["src"]` in `angular.json`.)
- The custom Angular Material theme (`src/theme/_material-theme.scss`) replaces the prebuilt `indigo-pink` theme. Do **not** re-add the prebuilt theme to `angular.json`.

#### Brand Colors

| Variable            | Hex       | Usage                                                    |
|---------------------|-----------|----------------------------------------------------------|
| `$color-dark-charcoal` | `#2F2D2E` | Navbar bg, Footer bg, Main headings, Prices             |
| `$color-white`      | `#FFFFFF` | Page bg, Cards, Modals, Text on dark blocks              |
| `$color-navy`       | `#1A3A6B` | Secondary buttons, Links, Active states, Hero accents    |
| `$color-orange`     | `#EB8125` | Primary CTA ("Add to cart"), Sale/New badges, Promo, Hover on navy |
| `$color-beige`      | `#A58F78` | Secondary text, Dividers, Section backgrounds, Placeholders |

### 2. Translations (i18n)

- **Always** add keys to **both** `src/assets/i18n/en.json` and `src/assets/i18n/ua.json` for every new user-visible string.
- Use `TranslateModule` (already imported in feature modules via `NavbarModule` etc.) and the `translate` pipe or `TranslateService`.
- Default locale is `ua`.

### 3. Mobile-first

- Design every component for mobile first, then enhance for wider breakpoints.
- Use Bootstrap breakpoint utilities (`d-none d-lg-flex`, etc.) for show/hide.
- Navigation items, dropdowns, and complex controls must be accessible via a hamburger/toggle on small screens.

### 4. Architecture

- Feature code goes in `src/app/features/`.
- Shared layout components (navbar, footer, etc.) go in `src/app/layout/`.
- Core services, models, interceptors go in `src/app/core/`.
- Every new Angular Material module needed should be added to `src/app/layout/material/material.module.ts`.

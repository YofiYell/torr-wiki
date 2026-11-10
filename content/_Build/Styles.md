---
publish: true
created: 2026-11-10T01:15:32.443Z
modified: 2026-11-10T04:55:19.130Z
published: 2026-11-10T04:55:19.130Z
unlisted: true
quartz_asset: css
---

```css
/* Auto-generated. Edit the Markdown sources instead. */

/* ===== custom-callouts.md ===== */

/* =========================================
   CUSTOM CALLOUTS — OBSIDIAN + QUARTZ
   ========================================= */

/* TREASURE */

.callout[data-callout="treasure"] {
    --callout-color: #dd9e00;
    --callout-icon: lucide-hand-coins;
}

/* CHARACTER SHEET */

.callout[data-callout="char"] {
    --callout-color: #11ad74;
    --callout-icon: lucide-file-user;
}

/* RULE */

.callout[data-callout="rule"] {
    --callout-color: #00992b;
    --callout-icon: lucide-scale;
}

/* REMINDER */

.callout[data-callout="reminder"] {
    --callout-color: #e88f00;
    --callout-icon: lucide-bell;
}


/* =========================================
   QUARTZ COMPATIBILITY
   ========================================= */

/* Translate Obsidian accent colors to Quartz */

#quartz-body .callout:is(
    [data-callout="treasure"],
    [data-callout="char"],
    [data-callout="rule"],
    [data-callout="reminder"]
) {
    --color: var(--callout-color);
    --border: color-mix(in srgb, var(--callout-color) 27%, transparent);
    --bg: color-mix(in srgb, var(--callout-color) 6%, transparent);
}

/* Quartz: Treasure — Lucide Hand Coins */

#quartz-body .callout[data-callout="treasure"] {
    --callout-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17'/%3E%3Cpath d='m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9'/%3E%3Cpath d='m2 16 6 6'/%3E%3Ccircle cx='16' cy='9' r='2.9'/%3E%3Ccircle cx='6' cy='5' r='3'/%3E%3C/svg%3E");
}

/* Quartz: Character Sheet — Lucide File User */

#quartz-body .callout[data-callout="char"] {
    --callout-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z'/%3E%3Cpath d='M14 2v5a1 1 0 0 0 1 1h5'/%3E%3Cpath d='M16 22a4 4 0 0 0-8 0'/%3E%3Ccircle cx='12' cy='15' r='3'/%3E%3C/svg%3E");
}

/* Quartz: Rule — Lucide Scale */

#quartz-body .callout[data-callout="rule"] {
    --callout-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3v18'/%3E%3Cpath d='m19 8 3 8a5 5 0 0 1-6 0zV7'/%3E%3Cpath d='M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1'/%3E%3Cpath d='m5 8 3 8a5 5 0 0 1-6 0zV7'/%3E%3Cpath d='M7 21h10'/%3E%3C/svg%3E");
}

/* Quartz: Reminder — Lucide Bell */

#quartz-body .callout[data-callout="reminder"] {
    --callout-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10.268 21a2 2 0 0 0 3.464 0'/%3E%3Cpath d='M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326'/%3E%3C/svg%3E");
}

```

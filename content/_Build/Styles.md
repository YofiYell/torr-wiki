---
publish: true
created: 2026-11-10T01:15:32.443Z
modified: 2026-11-11T22:04:38.522Z
published: 2026-11-11T22:04:38.522Z
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

/* STATBLOCK */

.callout[data-callout="stat"] {
    --callout-color: #0077bb;
    --callout-icon: lucide-table-properties;
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
    [data-callout="stat"],
    [data-callout="rule"],
    [data-callout="reminder"]
) {
    --color: var(--callout-color);
    --border: color-mix(in srgb, var(--callout-color) 27%, transparent);

    background-color: color-mix(
        in oklch,
        var(--callout-color) 10%,
        transparent
    );
}

/* Quartz: Treasure — Lucide Hand Coins */


/* =========================================
   QUARTZ — LUCIDE ICONS
   ========================================= */

/* Treasure */
#quartz-body .callout[data-callout="treasure"] {
    --callout-icon: url("https://cdn.jsdelivr.net/npm/lucide-static@1.70.0/icons/hand-coins.svg");
}

/* Character Sheet */
#quartz-body .callout[data-callout="char"] {
    --callout-icon: url("https://cdn.jsdelivr.net/npm/lucide-static@1.70.0/icons/file-user.svg");
}

/* Statblock */
#quartz-body .callout[data-callout="stat"] {
    --callout-icon: url("https://cdn.jsdelivr.net/npm/lucide-static@1.70.0/icons/file-table-properties.svg");
}

/* Rule */
#quartz-body .callout[data-callout="rule"] {
    --callout-icon: url("https://cdn.jsdelivr.net/npm/lucide-static@1.70.0/icons/scale.svg");
}

/* Reminder */
#quartz-body .callout[data-callout="reminder"] {
    --callout-icon: url("https://cdn.jsdelivr.net/npm/lucide-static@1.70.0/icons/bell.svg");
}

/* ===== dataviews.md ===== */

/* Freeze the first column ONLY in tables wrapped in the frozen-cols class */
.sticky-col table th:first-child,
.sticky-col table td:first-child {
    position: sticky;
    left: 0;
    z-index: 1;
    background-color: var(--background-primary);
    border-left: 4px solid;
    border-color: var(--note);
}

/* ===== quartz-ITS-quote-callout.md ===== */

/* QUARTZ — ITS Quote Callout Compatibility */

#quartz-body .callout[data-callout="quote"] {
    --callout-color: var(--darkgray);
    --color: var(--darkgray);

    background-color: color-mix(
        in srgb,
        var(--light) 75%,
        var(--dark) 25%
    );

    border-left: 4px solid var(--darkgray);
}

#quartz-body .callout[data-callout="quote"]
> .callout-title > .callout-icon {
    display: none;
}

#quartz-body .callout[data-callout="quote"]
> .callout-title .callout-title-inner > p {
    display: inline;
    margin: 0;
}
```

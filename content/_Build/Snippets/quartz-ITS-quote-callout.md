```css

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

```css
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

```

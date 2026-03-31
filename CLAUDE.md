# timezone-helper — Project Rules

## Time & Draggable Units

- **All time boundaries snap to 30-minute increments.** Every boundary handle, needle, or time input must resolve to a multiple of 30 minutes (0, 30, 60, 90 … 1410). Never allow arbitrary-minute positions.
- **Snap formula:** `Math.round(minutes / 30) * 30` — apply this whenever reading drag position or user input.
- **Minimum gap between adjacent boundaries:** 30 minutes. Enforce in all drag constraint logic.
- This applies to: fringeStart, coreStart, lunchStart, lunchEnd, coreEnd, fringeEnd, the needle, and any future time boundary added to the app.

## Mobile-First / Responsive

- **Every UI change must include mobile styles.** Never ship a feature that only works on desktop. Always write `sm:` (and `md:` / `lg:` if needed) variants alongside the base (mobile) styles.
- Mobile breakpoint is `sm` (640 px) in this project's Tailwind config. Base styles = mobile; `sm:` = desktop.
- Touch interactions must work. Use `touch-none` on draggable handles to prevent scroll hijacking, and ensure tap targets are at least 44 × 44 px on mobile (`w-6 h-6` minimum, `p-2` padding).
- Horizontal scroll on the timeline grid is expected on mobile — do not suppress it.
- The info panel is sticky (`sticky left-0`) — keep it that way so labels stay visible while scrolling the timeline.
- When adding new UI elements (tooltips, modals, popovers), ensure they don't overflow the viewport on narrow screens.

## Drag Implementation Pattern

- Boundary handle drags use **document-level `pointermove` / `pointerup` listeners** registered inside the `pointerdown` handler. Do **not** call `setPointerCapture` on the handle element — it intercepts events before they reach `document` and breaks the drag.
- Clean up listeners in the `pointerup` handler.
- Set `document.body.style.cursor = 'ew-resize'` on drag start and reset on drag end.
- The needle uses `setPointerCapture` (different pattern — pointer events are on the needle element itself via React synthetic events, not on `document`).

# landing-loop: review note (2026-11-10)

15 s, 1920x1080, 30 fps, silent loop for `landing/index.html` (How it works).
Rendered copy lives at `landing/video/leftovr-loop.mp4` (+ poster).

- Storyline built: tomato end card closes onto the fridge → snap shelves →
  kitchen list sorts itself → card floods tomato for the recipe → amounts are
  struck off → "Kitchen updated" pill grows into the end card. Not built: a
  phone-screen walkthrough (no real app captures were available).
- Measured: `hyperframes check` passes. Looked at: 11 stills (0.05 s to
  14.75 s). Not checked: every in-between frame of the seams; sound (none).
- Weakest shot: the recipe card (6.3 to 9.5 s) holds still for 1.7 s before
  the button press.
- Warnings kept on purpose: `line_unread` on the 0.17 s tagline at t=0 (it is
  the loop seam, a continuation of the end card); `content_overlap` at 4.9 s
  (rows cross while sorting); single-file composition instead of
  sub-compositions (one short loop).
- English only. A Serbian render needs the on-screen strings swapped.

Re-render: `npm run render`, then re-encode into `landing/video/` (crf 24,
`-an -movflags +faststart`).

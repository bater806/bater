# Sara Rutstein — Executive Coaching Landing Page

A single-page sales/landing site for Sara Rutstein, an ICF-certified executive
coach (PCC, CPCC, MBA — Kellogg School of Management), built to convert
visitors into booked discovery calls.

## Structure

- `index.html` — page markup (hero, pain points, credentials, services &
  pricing, testimonials, FAQ, final CTA, footer/contact form)
- `style.css` — warm navy/beige/olive design system, responsive layout
- `script.js` — mobile nav toggle, FAQ accordion, contact form validation

## Before launch

- Replace the `#` placeholder links (LinkedIn, podcast, Coachello profile)
  with real URLs.
- Replace the sample testimonials in the "Results" section with real client
  quotes (and add company logos if available).
- Wire the contact form (`#contactForm` in `script.js`) to a real backend,
  form service (e.g. Formspree), or booking tool (e.g. Calendly/Coachello),
  and point the "Book a Discovery Call" buttons at that booking link.
- Add a real photo of Sara in place of the monogram placeholders.

## Running locally

Any static file server works, e.g.:

```
python3 -m http.server 8000
```

Then open http://localhost:8000

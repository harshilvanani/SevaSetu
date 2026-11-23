# SevaSetu: presentation pack for Claude Design

**Please build a 14-slide 16:9 presentation deck from this folder.**

## The ask
- **Presenter:** Harshil Vanani, who built SevaSetu.
- **Audience:**
  - Art of Living leadership and volunteer coordinators
  - technical reviewers from the national team
  - mostly not engineers; one or two technical people
- **Goal:** show what SevaSetu is today, and answer the four points the stakeholders asked for:
  1. Maintain a design doc before implementing
  2. Have an architecture diagram
  3. Preferably move everything to AWS, so plan cloud resources accordingly while developing
  4. Keep it scalable
- **Length:** 14 slides, about 15–20 minutes.
- **Tone:** calm, warm, clear. Plain language, short bullets, no jargon without a one-line explanation. Honest: say what is done, what is planned and what is waiting on decisions.

## How to use the files

| File / folder | Use it for |
|---|---|
| `01-slides.md` | **The content.** One section per slide: headline, bullets, which image to place, speaker notes. Keep the order. |
| `02-key-facts.md` | Every number and name. If a number on a slide differs from this file, this file wins. |
| `03-brand.md` | Colours, fonts, logo, chart and diagram style. |
| `04-glossary.md` | Plain-language meanings (seva, Part 1, VTP, Aurora, Cognito…), for footnotes or the speaker. |
| `diagrams/` | Architecture diagrams (PNG + SVG). Use them full-width on slides 6, 7, 11 and 12. |
| `screenshots/` | Real screens from the app's demo (sample people only). Use them on slides 3–4 and as small visuals elsewhere. |
| `logo/` | SevaSetu logo (full) and mark (icon only). |
| `source-docs/` | Background detail. Not slide content; read only if a slide needs more depth. |

## Layout guidance
- **Title and section slides:** deep plum background (`#3C285F`) with white text.
- **Content slides:** cream background (`#FDFBF7`).
- **Point slides:** the four stakeholder points each get a small label in the top corner ("Point 1 · Design docs", "Point 2 · Architecture", "Point 3 · AWS", "Point 4 · Scale"), so the audience can follow the answers.
- **Diagrams:** keep them large. Don't redraw them unless you keep every box and label.
- **Screenshots:** show them in a simple device or browser frame with a soft shadow. Never crop the "Demo · viewing as …" bar out in a way that makes sample data look real; sample data is fine to show.
- **Tables:** at most 6 rows on a slide. The full tables are in the source docs.

## Must stay accurate
- SevaSetu runs on **Supabase today**, not AWS. The AWS setup is **written and checked, not deployed**. Don't say "we are on AWS".
- The people in the screenshots are **sample data** from a mock spreadsheet.
- **Numbers:** use the ones in `02-key-facts.md`.

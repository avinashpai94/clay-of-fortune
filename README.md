# Clay of Fortune

A static, browser-based spinning prize wheel. Hosted on GitHub Pages — no backend.

The wheel reads its choices from [`options.json`](./options.json), so anyone
who visits the site sees the same wheel. Removed winners and history are stored
per-browser (localStorage), so clearing options on one machine doesn't affect
anyone else.

## Editing the options

Edit `options.json` and commit.

Top-level fields:

| Field          | Required | Meaning                                                             |
| -------------- | -------- | ------------------------------------------------------------------- |
| `title`        | no       | Heading + browser tab title                                         |
| `sizeByWeight` | no       | If `true`, slice widths scale with `weight`. Default `false` (equal) |
| `options`      | yes      | Array of options (see below)                                        |

Each option supports:

| Field    | Required | Meaning                                                        |
| -------- | -------- | -------------------------------------------------------------- |
| `label`  | yes      | Text shown on the slice (emoji OK, e.g. `"🍕 Pizza"`)          |
| `weight` | no       | Landing probability (default `1`); visual size only if `sizeByWeight` |
| `color`  | no       | Slice color; auto-assigned from a palette if omitted           |

```json
{
  "title": "Clay of Fortune",
  "options": [
    { "label": "Pizza", "weight": 2, "color": "#e63946" },
    { "label": "Tacos" }
  ]
}
```

## Controls

Sound (synthesized ticking + a win fanfare) and confetti can each be toggled
with the buttons under the wheel. Both preferences are remembered per-browser.

## Running locally

Because the page fetches `options.json`, open it through a local server (not
`file://`):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying

Push to a public GitHub repo, then enable **Settings → Pages → Deploy from
branch → `main` / root**. The site will be live at
`https://<username>.github.io/clay-of-fortune/`.

# The Big Red Button

**Press it. Learn something unexpected.**

One big red button. Every press opens a different informative article from Wikipedia's featured and good article collections. No feed, no account, no recommendation engine.

**Live site:** <https://big-red-button-phi.vercel.app/>

![The Big Red Button](og-image.png)

## How it works

- Each press sends the titles you have already seen to `POST /api/random`, a small Vercel function.
- The function picks a random category (Wikipedia's featured or good articles) and a random alphabetical slice, then fetches a batch from the MediaWiki API. It filters for substantial intros, removes disambiguation and list pages, and prefers something outside your recent history.
- The frontend shows the article intro, credits the source, and links to the full article on Wikipedia. All copy is rendered as text, never injected as HTML.
- Recent discoveries are kept only in `localStorage`, so returning visitors keep getting something new. No analytics, accounts, or tracking.
- A reading-progress line and keyboard-first navigation (`Space`, `N`, `→`) keep the experience quick.

If the function or Wikipedia is unreachable, the site shows a friendly error and leaves everything ready for another press.

## Run locally

No dependencies or build step required. The tiny local server serves the static files and mounts the same `/api/random` handler used on Vercel:

```sh
npm run dev
```

Then open <http://localhost:4200>.

Plain static servers such as `python -m http.server` will serve the frontend but will not provide the article API.

## Deploy

The project is a static frontend plus a Vercel function. On Vercel, import the repository and deploy with the default settings. Or use the CLI:

```sh
vercel --prod
```

`vercel.json` adds clean URLs, a function timeout, and a few conservative security headers.

## API

`POST /api/random` accepts:

```json
{ "exclude": ["Article title", "Another title"] }
```

It returns `{ article, meta }`, where `article` contains the title, description, paragraphs, lead image metadata, Wikipedia URL, and quality label. The endpoint is same-origin and intended for this site only.

## Project structure

```text
.
├── api/random.js   # Serverless article picker and Wikipedia proxy
├── js/
│   ├── article-api.js    # Frontend API client
│   └── discovery-store.js # Local recent/discovery memory
├── index.html      # Markup and content
├── styles.css      # Visual system, button, responsive layout
├── app.js          # Reader view, keyboard controls, UI orchestration
├── dev-server.mjs  # Local static + API development server
├── package.json    # Dev scripts
├── favicon.svg     # Site icon
├── og-image.png    # Social share image
├── robots.txt      # Crawl instructions
├── sitemap.xml     # Single-page sitemap
├── vercel.json     # Vercel static + function configuration
└── .vercelignore   # Keeps local test files out of deployments
```

## AI assistance

AI was used to help code the frontend. AI-assisted changes were reviewed and tested locally before being included.

## Credits

- Article text and lead images come from [Wikipedia](https://www.wikipedia.org/) and are available under the [Creative Commons Attribution-ShareAlike 4.0 licence](https://creativecommons.org/licenses/by-sa/4.0/). Each article links back to its source for full attribution.
- Featured article selection: [Wikipedia:Featured articles](https://en.wikipedia.org/wiki/Wikipedia:Featured_articles).
- Good article selection: [Wikipedia:Good articles](https://en.wikipedia.org/wiki/Wikipedia:Good_articles).
- Typefaces: [Fraunces](https://fonts.google.com/specimen/Fraunces) and [Manrope](https://fonts.google.com/specimen/Manrope), served by Google Fonts.

## Licence

The site's source code is released under the [MIT Licence](LICENSE). Wikipedia content remains subject to its own licence.

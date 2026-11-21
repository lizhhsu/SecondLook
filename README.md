# SecondLook

A React app that helps students revisit mathematical reasoning through a guided demo and screen-sharing feedback.

## Development

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

The landing page, interactive examples, local screen sharing, and handwritten equation checks work without credentials. Screen sharing requires HTTPS (or localhost), a supported desktop browser, and permission from the browser and operating system. Show one handwritten equation on a plain background and choose **Check Step** or **End Question**. If several lines are visible, drag around the equation you want to check. The browser uses the [ink-on CoMER v0.1.0 model](https://github.com/kimseungdae/ink-on/releases/tag/v0.1.0) to read the pixels and checks arithmetic equations and polynomial rewrites. The feedback includes the transcription so you can compare it with your handwriting.

Live full-screen AI analysis and AI summaries require the relevant provider keys. Copy `.env.example` to `.env.local` for local development. Vite exposes `VITE_` variables to browsers. Use restricted development credentials and keep private keys out of public deployments. Vite does not load the ignored `.env.private` file automatically.

```sh
npm run build
npm run preview
```

Run page-render, navigation, feedback, and screen-sharing regression checks with `npm test`.

The overview is the default page; `#how-it-works` and `#learning` link to its sections, and `#session` opens session setup. All pages share one header, fonts loaded once in `index.html`, and the colors defined in `src/index.css`. The notebook example uses a handwriting font to distinguish sample student work from the interface.

## GitHub Pages

The Pages workflow builds and deploys pushes to `main`, and can also be run manually on another branch. In repository Settings → Pages, select **GitHub Actions** as the source. The public build runs selected-equation checks in the browser. Live full-screen AI analysis and AI summaries require a separate authenticated backend before public use.

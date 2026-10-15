# Opinion Rocks frontend checks

The site stays a static HTML application. These Chromium tests mock all backend writes and social/clipboard APIs. They never publish an opinion, echo, or social post to production.

From this folder, install the test-only dependency and browser locally:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node check.cjs
node mobile-tests.cjs
node sharing-tests.cjs
```

If Chromium is already installed, set `OPINION_BROWSER_PATH` to its executable. These scripts use headless Chromium with sandboxing disabled for the isolated test runtime, not for a user browsing session.

- `check.cjs`: preview, submission gating, empty state, desktop pagination, list view, loading errors/retry, responsive widths, mocked submission, dialog close.
- `mobile-tests.cjs`: phone widths, narrow/short viewports, text and long prompt fit, touch scrolling versus echo activation, tap toggle, 44px sharing controls, modal focus, daily reset and draft retention. The standalone “Share my rock” control is checked at 320/390px with normal and 200% root text size for clipped text, overlap with status/footer/navigation, reachability, and reopening the share dialog. Root text enlargement is a reflow check, not a physical-device accessibility setting simulation.
- `sharing-tests.cjs`: actual 1080×1350 PNG download; native file/link capability branches and activation; cancellation/errors; clipboard denial fallback; X/Facebook URLs; image failure/retry and cleanup.

Screenshots and the downloaded PNG are temporary QA outputs. Native share APIs are mocked: these checks do not establish that an installed iOS/Android app accepted or published a post. Before a broad launch, manually check Android Chrome and iOS Safari, download location/Photos save, and the desired installed social apps. File sharing depends on OS/browser support; links open the current valley and never a permanent opinion page.

Checkout remains disabled. Backend entitlement, atomic voting, and server-side daily expiry audits remain separate work.

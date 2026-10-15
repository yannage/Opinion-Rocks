# Opinion Rocks frontend checks

The site stays a static HTML application. These Chromium tests mock all backend writes and social/clipboard APIs. They never publish an opinion, echo, or social post to production.

From this folder, install the test-only dependency and browser locally:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node check.cjs
node mobile-tests.cjs
node sharing-tests.cjs
node motion-tests.cjs
node store-tests.cjs
```

If Chromium is already installed, set `OPINION_BROWSER_PATH` to its executable. These scripts use headless Chromium with sandboxing disabled for the isolated test runtime, not for a user browsing session.

- `check.cjs`: preview, submission gating, empty state, desktop pagination, list view, loading errors/retry, responsive widths, mocked submission, dialog close.
- `mobile-tests.cjs`: phone widths, narrow/short viewports, text and long prompt fit, touch scrolling versus echo activation, tap toggle, 44px sharing controls, modal focus, daily reset and draft retention. The standalone “Share my rock” control is checked at 320/390px with normal and 200% root text size for clipped text, overlap with status/footer/navigation, reachability, and reopening the share dialog. Root text enlargement is a reflow check, not a physical-device accessibility setting simulation.
- `sharing-tests.cjs`: actual 1080×1350 PNG download; native file/link capability branches and activation; cancellation/errors; clipboard denial fallback; X/Facebook URLs; image failure/retry and cleanup.
- `motion-tests.cjs`: full/reduced motion; all three screen motion controls, local preference persistence and live OS preference changes; feedback only after successful saves; bounded particle cleanup after repeated typing/echo/navigation; real touch scrolling without echoes; controls during animation; integrated PNG download/native-file handoff; phone and desktop screenshots. Backend writes and OS sharing remain mocked. Optional `/tmp/opinion-fredoka.ttf` loads the real display font for visual review; the tests run without it.
- `store-tests.cjs`: Write/Explore/Store navigation, direct `#store` links and browser history; preserved drafts and same-day sharing; all nine XS–5XL size/price combinations; shirt/artwork preview controls; keyboard interaction and reduced motion; 320/390/768/1440px layouts at normal and 200% root text size; backend failure and daily reset. Delayed daily-question/submission responses and Back with a share dialog open check navigation, focus, and modal cleanup. The suite also removes the purchase button's `disabled` attribute and spoofs payment return parameters to confirm those actions cannot create a checkout, entitlement, order, popup, or network request. Every external request is intercepted and blocked; all database calls are mocked. Store screenshots are written to the operating system's temporary directory; the same optional Fredoka font is used when present.

Screenshots and the downloaded PNG are temporary QA outputs. Native share APIs are mocked: these checks do not establish that an installed iOS/Android app accepted or published a post. Before a broad launch, manually check Android Chrome and iOS Safari, download location/Photos save, and the desired installed social apps. File sharing depends on OS/browser support; links open the current valley and never a permanent opinion page.

Checkout remains disabled. The store suite verifies the preview's safety and interaction, not a working payment or fulfillment integration. Payment verification, order creation, Printful fulfillment, backend entitlement, atomic voting, and server-side daily expiry audits require their own integration checks before checkout can open.

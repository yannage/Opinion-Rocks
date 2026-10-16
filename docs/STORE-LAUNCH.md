# Store launch contract

Updated October 16, 2026. The app presents the **Everyday Collection as a preview** and links to the separate [Opinion Rocks Printful store](https://opinionrocks.printful.me/). Both supplier listings remain hidden. This is not evidence of open ordering, completed owner payouts, production-quality approval, or direct API fulfillment.

## Current collection

| Design | Saved blank and treatment | Saved sizes | Approved retail prices (USD) |
| --- | --- | --- | --- |
| Everyday Classic Print Tee | Natural Gildan 64000; front DTG print; plain back | S–3XL | S–XL $25; 2XL $27; 3XL $29 |
| Everyday Embroidered Tee | Moss Comfort Colors 1717; left-chest flat embroidery; plain back | S–4XL | S–XL $35; 2XL $37; 3XL $39; 4XL $41 |

Shipping and tax are additional. These exact prices were approved and saved in the hosted store; no new price approval is needed for this website preview. Availability may change. Evergreen describes the intended ongoing assortment, not guaranteed inventory.

The recovered original art is displayed through lossless WebP copies of the transparent source PNGs. The illustrative collection mockup is a web-optimized copy. Neither the composited shirt silhouettes nor the collection image is a manufactured sample or a catalog-accurate garment/placement proof.

- Print art: 8-inch square canvas, approximately 7.5-inch visible design. Final DTG color/sample quality remains unverified.
- Embroidery: 3.25-inch square canvas, approximately 3-inch visible design. The PNG is a digitization reference, not a stitch file. The supplier's source-quality warning, solid thread-color preparation, final digitization, and sample review remain unresolved.
- Owner payout onboarding is still a separate launch requirement. No financial onboarding is performed by this app update.

## Website behavior and boundaries

- The two designs have separate size selections, exact price displays, artwork views, and a shared illustrative collection view.
- The external link opens only `https://opinionrocks.printful.me/` in a new tab with `noopener noreferrer`. There is no automatic redirect, cart, checkout handler, embedded payment page, or supplier API request.
- The purchase button remains disabled and has no action even if its disabled attribute is removed. URL parameters cannot grant paid text expansion.
- The preview explicitly states that products are hidden and no public products are available yet. It does not promise a launch date or accept reservations.
- These brand designs are separate from daily visitor opinions. The daily reset, no public opinion archive, real counts, writing drafts, sharing, and motion preferences are preserved.
- This change does not publish the hidden supplier listings, change prices, place orders, incur sample/digitization charges, or change account/security settings.

## Before merchandise ordering opens

1. Resolve source quality and embroidery digitization; review actual samples. Obtain separate approval for any paid sample or digitization order.
2. Complete owner payout readiness through the appropriate owner-controlled flow.
3. Verify current garment/size availability, customer totals, shipping/tax, terms, support contact, delivery expectations, and cancellation/refund policy.
4. Obtain the applicable launch decision, publish only the intended supplier listings, and verify the public hosted-store experience.
5. Update this app's availability copy only after those checks succeed. A working website preview does not satisfy any of these gates.

## Direct app checkout remains a separate project

The hosted Printful store is distinct from the unfinished direct Stripe/Printful API integration. The connected supplier API previously exposed no stores; browser setup does not prove API mapping or fulfillment readiness. Do not reuse historical store/product identifiers for a new integration without verification. No direct backend checkout is added here.

Any future direct checkout needs server-resolved products/prices, verified payment webhooks, account/environment checks, idempotent order creation, recoverable fulfillment failures, and an authorized sandbox test covering success, decline, cancellation, delayed payment, tampered values, invalid signatures, duplicates, and expiry. Keep payment/supplier credentials server-side. A success-page URL never establishes payment or entitlement. Paid text expansion remains disabled until independently verified. Private order records must not create a public archive of visitors' daily opinions.

## Tracking

- [Everyday Collection website integration](https://trello.com/c/gJm08Qax)
- [Hosted store payout and quality gates](https://trello.com/c/WcrkGcAr)
- [Separate direct API/payment integration](https://trello.com/c/UA6J0mJV)
- [Earlier Store preview release](https://trello.com/c/nAtjTYYe)
- [Support and store policies](https://trello.com/c/0AWESXyQ)

Deployment status and exact verification evidence belong on the website integration card and its pull request. Do not infer publication merely from local source changes or a passed catalog test.

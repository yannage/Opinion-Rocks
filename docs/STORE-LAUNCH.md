# Store launch contract

Status checked October 15, 2026. This is a launch checklist and future integration contract, not evidence of a working checkout or fulfillment service. The in-app store is a sample-product preview. Keep purchase controls disabled until the gates below have evidence.

## Publication approval and deployment status

On October 15, 2026, the owner explicitly approved publishing the storefront code
and recovered Middle Seat artwork to the public `yannage/Opinion-Rocks` GitHub
repository and `opinionrocks.com`. This resolves the earlier publication-approval
blocker. Current deployment and verification evidence is recorded on the
[storefront tracking card](https://trello.com/c/nAtjTYYe). This publication approval does not enable checkout or remove
any payment, fulfillment, policy, or purchase-approval gate below.

## Verified dependencies

| Dependency | Current evidence | Next action |
| --- | --- | --- |
| Stripe activation | Read-only live account retrieval for `acct_1RSSG7A46eCcIv5C` returned `details_submitted=false`, `charges_enabled=false`, `payouts_enabled=false`, and `requirements.disabled_reason=requirements.pending_verification`. `currently_due`, `past_due`, and `pending_verification` arrays were empty. | Yanni completes the actual Dashboard requirements directly; then recheck activation. The API response does not identify the remaining fields. |
| Stripe test environment | The connector account list exposed only the live account. No sandbox checkout was executed for this storefront. | Establish an authorized, separate sandbox and server-side credentials through a secure flow before payment tests. |
| Printful access | This implementation session again received zero stores from the connected Printful store listing. The historical target is store `18906743`, sample product `481704183`. | Verify the intended store, product, and variant mapping through the API. Browser access and historical IDs do not prove this integration works. |
| Pricing and sample quality | The handoff records a black Gildan 64000 sample and saved prices: XS–XL $29, 2XL $31, 3XL $33, 4XL $35, 5XL $37. These are planned prices, not a current supplier quote or final customer total. | Obtain destination/variant-specific production, shipping, surcharge, and tax costs; settle shipping policy and review print quality. Ask before a sample purchase. |
| Support and policies | Trello's support/policies task remains Ready. | Verify supplier terms, support contact, delivery expectations, cancellation/refund handling, and customer-facing policies before sales. |

No account settings, credentials, bank details, security policies, orders, or charges were created or changed during these checks.

## Required purchase flow

1. The server resolves an approved product and variant, current offer validity, price, currency, quantity limits, and shipping/tax treatment. Browser price text and supplied Printful identifiers are never authoritative.
2. The server creates a hosted Checkout Session. Keep payment and supplier credentials exclusively on the server. A visible purchase path must fail closed when dependencies or configuration are unavailable.
3. A signed webhook verifies the raw request body, signature, and expected environment/account. Handle `checkout.session.completed` and `checkout.session.async_payment_succeeded`; retrieve the session and reconcile its line items and payment status before fulfillment. A success-page visit alone cannot establish payment.
4. Persist payment/order state and prevent duplicate or concurrent fulfillment of the same purchase. Supplier failure after payment must remain a visible, recoverable order state; do not mark it shipped or complete before confirmation.
5. Define the offer's exact cutoff, Checkout Session lifetime, and treatment of delayed payments before launching daily drops. Enforce expiry on the server, including already-open sessions. Do not assume 04:00 UTC permanently equals local midnight.
6. Private order records may support fulfillment and customer service. They must not create a public archive of previous days' opinions. Paid text expansion remains disabled and requires its own server-enforced entitlement work.

The supplier API contract remains unresolved until the correct Printful store is accessible and its supported operations are verified. This document intentionally does not specify an unverified fulfillment endpoint or imply sandbox payments exercise production fulfillment.

## Evidence required before enabling checkout

- Sandbox payment success, decline, cancellation, delayed success/failure, and invalid webhook signatures.
- Duplicate/replayed/concurrent events, altered prices or variants, wrong account/environment, and expired offers/sessions.
- Confirmed supplier mapping and a safe, authorized fulfillment test that cannot create an unapproved paid order; failure/retry recovery without duplicate orders.
- Correct customer totals, purchase terms, support path, and truthful order status.
- Verified production deployment and an explicit record of the launch decision. Any real charge, paid sample/order, persistent access change, or material commercial policy still needs the appropriate owner approval.

These are pending acceptance checks; none is claimed to have passed merely because the preview UI works.

## Tracking and references

- [Storefront implementation](https://trello.com/c/nAtjTYYe)
- [Payment activation](https://trello.com/c/qXVC3A0d)
- [Correct Printful store access](https://trello.com/c/UA6J0mJV)
- [Safe checkout design](https://trello.com/c/5IrKkUiz)
- [Private checkout and fulfillment tests](https://trello.com/c/bqfCEzRq)
- [Sample quote and margins](https://trello.com/c/kwwzc5m8)
- [Support and store policies](https://trello.com/c/0AWESXyQ)
- [Stripe fulfillment guidance](https://docs.stripe.com/checkout/fulfillment)
- [Stripe webhook signature and duplicate-event guidance](https://docs.stripe.com/webhooks)

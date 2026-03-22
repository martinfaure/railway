# Stripe setup for local development

This project includes a minimal Stripe Checkout + webhook integration in `server/index.js`.

Follow these steps to test locally:

1. Install server dependencies and start the API

```powershell
cd server
npm install
npm run start
```

2. Create a `.env` file (do NOT commit your real keys). Use `server/.env.example` as reference.

Required environment variables:

- STRIPE_SECRET_KEY (sk_test_...)
- STRIPE_PUBLISHABLE_KEY (pk_test_...)
- STRIPE_WEBHOOK_SECRET (whsec_...)
- BASE_URL (frontend URL, e.g. http://localhost:5173)
- PRICE_ID_EXPLORATEUR, PRICE_ID_AVENTURIER, PRICE_ID_CREATEUR (the Stripe *price* IDs your Checkout uses)

Note: you can also pass a Stripe *product* id (prod_...) to `/api/create-checkout-session` — the server will attempt to resolve the first active price for that product using the Stripe API. If you prefer to bind a friendly product name, set PRICE_ID_<UPPER> environment variables instead.

Notes about product/price IDs:
- The Checkout endpoint expects a `price` id for subscriptions (e.g. price_xxx). We support passing either a `priceId` directly from the frontend or a friendly `productKey` (e.g. "Explorateur") — the server will resolve `PRICE_ID_<UPPER>` env variables.

3. Use Stripe CLI to get a webhook secret and forward events locally

```powershell
stripe login
stripe listen --forward-to http://localhost:3001/api/webhook

# Copy the signing secret printed by the CLI into STRIPE_WEBHOOK_SECRET in your .env
```

4. From the frontend, the Subscription dialog uses `POST /api/create-checkout-session` (proxied by Vite dev server under `/api`) to create a Checkout session and redirect users to Stripe.

The server verifies webhooks with `STRIPE_WEBHOOK_SECRET` and will update the user record with `stripe_customer_id` and `stripe_subscription_id`. If the Checkout session metadata contains a `plan` and `lat,lng`, the webhook will attempt to automatically unlock nearby spots for that user and persist them in the `purchases` table.
Example frontend (minimal JS) — create checkout & redirect

```js
// Example: frontend code to start subscription checkout (works with Vite proxy -> /api)
async function startCheckout({ priceIdOrProduct, userId, planName, lat, lng }) {
	// priceIdOrProduct may be 'price_xxx' or 'prod_xxx' (server will try to resolve prod->price)
	const resp = await fetch('/api/create-checkout-session', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ priceId: priceIdOrProduct, userId, plan: planName, lat, lng })
	});
	if (!resp.ok) {
		const err = await resp.json().catch(()=>({ error: 'unknown' }));
		throw new Error(err?.error || 'Failed to create checkout');
	}
	const data = await resp.json();
	// data.url is the Stripe Checkout URL — redirect the browser
	window.location.href = data.url;
}

// Example call
// startCheckout({ priceIdOrProduct: 'prod_TUjevEnzQBLnVc', userId: 1, planName: 'Explorateur', lat: 48.8583, lng: 2.2945 });
```

Testing webhooks with Stripe CLI

1. Start server (server/.env must contain STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY)
2. Run `stripe listen --forward-to http://localhost:3001/api/webhook` (the CLI prints whsec_...)
3. Create a checkout session from the frontend or call the server `create-checkout-session` endpoint; complete Checkout to send the `checkout.session.completed` webhook.
4. Or trigger a built-in fixture (may not include your metadata): `stripe trigger checkout.session.completed`.

How to confirm subscriptions in the Stripe Dashboard

- In the Stripe Dashboard (Test mode), go to Customers to find the customer created for your email. If a Checkout session created a customer, you should see one with the email used during the session.
- Click the customer to view their Subscriptions (or go to the Subscriptions page and search by customer id or email). Subscriptions created by Checkout will show up here in Test mode.
- If you used the dev simulator (`/api/_dev/simulate-webhook`) you will not create a real customer/subscription in Stripe — use Checkout with a live flow + Stripe CLI forwarding to create real test objects that appear in the dashboard.

Dev-only helper: simulated webhook

For quick local debugging (no CLI), the server exposes `POST /api/_dev/simulate-webhook` when NODE_ENV !== 'production'. Send JSON like this to simulate a Checkout session with metadata:

```json
{
	"metadata": { "userId": "1", "plan": "Explorateur", "lat": "48.8583", "lng": "2.2945" },
	"customer": "cus_test",
	"subscription": "sub_test"
}
```


Security & production

- Never commit real keys. Use environment variables in your deployment configuration or secret store.
- Use your actual Stripe price IDs (price_...) not product IDs (prod_...). If you only have product IDs, create prices in Stripe and provide their IDs in the env variables.

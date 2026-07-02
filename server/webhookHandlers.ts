import { getStripeSync } from './stripeClient';
import * as subscriptionService from './subscriptionService';
import { createOrderFromStripeSession } from './checkoutHandler';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();

    // SECURITY: Verify the Stripe signature FIRST before any event parsing or
    // side-effect-producing database writes. This prevents unauthenticated
    // attackers from manipulating subscription state by crafting fake payloads.
    // sync.processWebhook performs HMAC-SHA256 verification and throws on failure.
    await sync.processWebhook(payload, signature);

    // Signature verified — safe to parse and dispatch
    const event = JSON.parse(payload.toString());
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          await createOrderFromStripeSession(session.id, session);
          console.log('Processed checkout.session.completed webhook');
          break;
        }
        case 'customer.subscription.created':
          await subscriptionService.handleSubscriptionCreated(event.data.object);
          console.log('Processed subscription created webhook');
          break;
        case 'customer.subscription.updated':
          await subscriptionService.handleSubscriptionUpdated(event.data.object);
          console.log('Processed subscription updated webhook');
          break;
        case 'customer.subscription.deleted':
          await subscriptionService.handleSubscriptionDeleted(event.data.object);
          console.log('Processed subscription deleted webhook');
          break;
      }
    } catch (err) {
      console.error('Error processing subscription webhook event:', err);
    }
  }
}

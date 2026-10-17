import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

(async () => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'Test Chambre' },
          unit_amount: 1000,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'http://localhost:5173/success',
      cancel_url: 'http://localhost:5173/cancel',
    });
    console.log(' Session Stripe OK:', session.id);
  } catch (err) {
    console.error('❌ Erreur Stripe test:', err);
  }
})();



import { RazorpayProvider } from "./razorpay";
import type { PaymentProvider } from "./provider";

let provider: PaymentProvider | null = null;

/**
 * The active payment provider. Razorpay today; swapping to a merchant-of-record
 * later means adding one adapter and changing this one line.
 */
export function getPaymentProvider(): PaymentProvider {
  if (!provider) provider = new RazorpayProvider();
  return provider;
}

export type { PaymentProvider } from "./provider";

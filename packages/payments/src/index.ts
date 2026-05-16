// ============================================================
// Sale360 Payments — Mercado Pago Integration
// ============================================================

export interface PaymentProcessingResult {
  success: boolean;
  transactionId: string;
  status: 'approved' | 'pending' | 'rejected';
  paymentMethod: string;
  details: string;
}

export interface PixQRCode {
  qrCode: string;
  qrCodeBase64: string;
  copyPaste: string;
  expiresAt: string;
  transactionId: string;
}

export interface MercadoPagoConfig {
  accessToken: string;
  publicKey: string;
  environment: 'sandbox' | 'production';
}

const MP_API = {
  sandbox: 'https://api.mercadopago.com/sandbox',
  production: 'https://api.mercadopago.com',
};

export class MercadoPagoService {
  private config: MercadoPagoConfig;

  constructor(config: MercadoPagoConfig) {
    this.config = config;
  }

  private get baseUrl() {
    return this.config.environment === 'sandbox' ? MP_API.sandbox : MP_API.production;
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.accessToken}`,
    };
  }

  // Generate Pix QR Code for payment
  async createPixPayment(amount: number, description: string): Promise<PixQRCode> {
    const response = await fetch(`${this.baseUrl}/v1/payments`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        transaction_amount: amount,
        description,
        payment_method_id: 'pix',
        payer: { entity_type: 'individual' },
      }),
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago error: ${response.status}`);
    }

    const data = await response.json();
    const qrData = data.point_of_interaction?.transaction_data;

    return {
      qrCode: qrData?.qr_code || '',
      qrCodeBase64: qrData?.qr_code_base64 || '',
      copyPaste: qrData?.qr_code || '',
      expiresAt: data.date_of_expiration,
      transactionId: data.id.toString(),
    };
  }

  // Check payment status
  async checkPayment(paymentId: string): Promise<PaymentProcessingResult> {
    const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: data.status === 'approved',
      transactionId: data.id.toString(),
      status: data.status,
      paymentMethod: data.payment_method_id,
      details: data.status_detail,
    };
  }

  // Create checkout preference (for web payment link)
  async createCheckoutPreference(
    items: { title: string; quantity: number; unitPrice: number }[],
    externalReference: string,
  ) {
    const response = await fetch(`${this.baseUrl}/checkout/preferences`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        items: items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          currency_id: 'BRL',
          unit_price: item.unitPrice,
        })),
        external_reference: externalReference,
        payment_methods: {
          excluded_payment_types: [],
          installments: 12,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago error: ${response.status}`);
    }

    const data = await response.json();
    return {
      preferenceId: data.id,
      initPoint: data.init_point,      // Web checkout URL
      sandboxInitPoint: data.sandbox_init_point,
    };
  }
}

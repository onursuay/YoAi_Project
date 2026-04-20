/**
 * Thin promise wrapper around the iyzipay callback SDK.
 * All money/plan decisions happen in the catalog — this file only
 * translates catalog output into an Iyzico checkout form init request
 * and unwraps the callback-style API.
 */

import 'server-only'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Iyzipay = require('iyzipay')

function getClient() {
  const apiKey = process.env.IYZICO_API_KEY
  const secretKey = process.env.IYZICO_SECRET_KEY
  const uri = process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
  if (!apiKey || !secretKey) {
    throw new Error('IYZICO_NOT_CONFIGURED')
  }
  return new Iyzipay({ apiKey, secretKey, uri })
}

export interface BuyerInfo {
  id: string
  name: string
  surname: string
  email: string
  ip: string
}

export interface InitCheckoutInput {
  conversationId: string
  price: number
  paidPrice: number
  currency: 'TRY'
  callbackUrl: string
  basketId: string
  itemName: string
  itemCategory: 'subscription' | 'credit_pack'
  buyer: BuyerInfo
}

export interface InitCheckoutResult {
  token: string
  paymentPageUrl: string
  raw: unknown
}

export async function initCheckoutForm(input: InitCheckoutInput): Promise<InitCheckoutResult> {
  const client = getClient()

  const request = {
    locale: 'tr',
    conversationId: input.conversationId,
    price: input.price.toFixed(2),
    paidPrice: input.paidPrice.toFixed(2),
    currency: input.currency,
    basketId: input.basketId,
    paymentGroup: input.itemCategory === 'subscription' ? 'SUBSCRIPTION' : 'PRODUCT',
    callbackUrl: input.callbackUrl,
    enabledInstallments: [1, 2, 3, 6, 9],
    buyer: {
      id: input.buyer.id,
      name: input.buyer.name || 'Musteri',
      surname: input.buyer.surname || '-',
      email: input.buyer.email,
      identityNumber: '11111111111',
      registrationAddress: '-',
      city: 'Istanbul',
      country: 'Turkey',
      ip: input.buyer.ip,
      gsmNumber: '+905000000000',
    },
    shippingAddress: {
      contactName: input.buyer.name || 'Musteri',
      city: 'Istanbul',
      country: 'Turkey',
      address: '-',
    },
    billingAddress: {
      contactName: input.buyer.name || 'Musteri',
      city: 'Istanbul',
      country: 'Turkey',
      address: '-',
    },
    basketItems: [{
      id: input.basketId,
      name: input.itemName,
      category1: input.itemCategory,
      itemType: 'VIRTUAL',
      price: input.price.toFixed(2),
    }],
  }

  return new Promise((resolve, reject) => {
    client.checkoutFormInitialize.create(request, (err: unknown, result: any) => {
      if (err) return reject(err)
      if (result?.status !== 'success') {
        return reject(new Error(`IYZICO_INIT_FAILED:${result?.errorCode || 'unknown'}:${result?.errorMessage || ''}`))
      }
      resolve({ token: result.token, paymentPageUrl: result.paymentPageUrl, raw: result })
    })
  })
}

export interface RetrieveResult {
  status: 'success' | 'failure'
  paymentStatus?: string
  paymentId?: string
  conversationId?: string
  price?: number
  paidPrice?: number
  currency?: string
  raw: any
}

export async function retrieveCheckoutForm(token: string): Promise<RetrieveResult> {
  const client = getClient()
  return new Promise((resolve, reject) => {
    client.checkoutForm.retrieve({ locale: 'tr', token }, (err: unknown, result: any) => {
      if (err) return reject(err)
      resolve({
        status: result?.status === 'success' ? 'success' : 'failure',
        paymentStatus: result?.paymentStatus,
        paymentId: result?.paymentId,
        conversationId: result?.conversationId,
        price: result?.price ? Number(result.price) : undefined,
        paidPrice: result?.paidPrice ? Number(result.paidPrice) : undefined,
        currency: result?.currency,
        raw: result,
      })
    })
  })
}

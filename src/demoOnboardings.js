import { PARTY_FIELDS } from './formConfig.js'

const party = () => ({ ...Object.fromEntries(PARTY_FIELDS.map((field) => [field.name, ''])), accountSystem: '' })

function emptyDraft() {
  return {
    customerEmail: '',
    type: 'New',
    services: [],
    mainAccount: party(),
    logisticsProvider: party(),
    additionalLocations: '',
    paymentHouse: { companyName: '', contactName: '' },
  }
}

function demoRecord(id, createdAt, draft) {
  return {
    id,
    createdAt,
    companyName: draft.mainAccount.companyName,
    customerEmail: draft.customerEmail,
    draft,
  }
}

export const DEMO_ONBOARDINGS = [
  demoRecord('demo-amazon', Date.parse('2026-10-20T12:00:00'), {
    ...emptyDraft(),
    customerEmail: 'edi@amazon.com',
    type: 'New',
    services: ['ltl-tl'],
    mainAccount: {
      ...party(),
      accountNumber: '1002041',
      accountSystem: 'TruckMate',
      companyName: 'Amazon',
      address: '40 Bay Street',
      city: 'Toronto',
      region: 'ON',
      postal: 'M5J 2X2',
      contactName: 'Amazon EDI',
      email: 'edi@amazon.com',
    },
  }),
  demoRecord('demo-walmart', Date.parse('2026-10-21T12:00:00'), {
    ...emptyDraft(),
    customerEmail: 'edi@walmart.com',
    type: 'New',
    services: ['commerce'],
    mainAccount: {
      ...party(),
      accountNumber: '0008841',
      accountSystem: 'AS400',
      companyName: 'Walmart',
      address: '1940 Argentia Road',
      city: 'Mississauga',
      region: 'ON',
      postal: 'L5N 1P9',
      contactName: 'Walmart EDI',
      email: 'edi@walmart.com',
    },
  }),
]

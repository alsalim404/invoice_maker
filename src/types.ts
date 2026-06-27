export type Currency = "KZT" | "RUB" | "USD" | "EUR";

export type Entity = {
  id: string;
  title: string;
  legalName: string;
  taxId: string;
  registrationCode: string;
  address: string;
  bankName: string;
  bik: string;
  account: string;
  corrAccount: string;
  kbe: string;
  paymentPurposeCode: string;
  director: string;
  accountant: string;
  phone: string;
  email: string;
};

export type InvoiceItem = {
  id: string;
  code: string;
  title: string;
  unit: string;
  quantity: number;
  price: number;
  vatRate: number;
};

export type InvoiceState = {
  number: string;
  date: string;
  dueDate: string;
  issuerId: string;
  customerId: string;
  contract: string;
  currency: Currency;
  items: InvoiceItem[];
  note: string;
};

export type AppData = {
  ownEntities: Entity[];
  counterparties: Entity[];
  invoice: InvoiceState;
};

export type RegistryKind = "ownEntities" | "counterparties";

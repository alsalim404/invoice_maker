import type { AppData, Entity, InvoiceState } from "./types";

const STORAGE_KEY = "invoice-maker:data:v1";

const today = new Date().toISOString().slice(0, 10);

const createId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const emptyEntity = (): Entity => ({
  id: createId(),
  title: "",
  legalName: "",
  taxId: "",
  registrationCode: "",
  address: "",
  bankName: "",
  bik: "",
  account: "",
  corrAccount: "",
  kbe: "",
  paymentPurposeCode: "",
  director: "",
  accountant: "",
  phone: "",
  email: "",
});

export const emptyItem = () => ({
  id: createId(),
  code: "",
  title: "",
  unit: "шт",
  quantity: 1,
  price: 0,
  vatRate: 0,
});

const ownEntity: Entity = {
  id: createId(),
  title: "Моя компания",
  legalName: "ТОО \"Моя компания\"",
  taxId: "000000000000",
  registrationCode: "",
  address: "г. Алматы, проспект Абая, 1",
  bankName: "АО \"Банк\"",
  bik: "CASPKZKA",
  account: "KZ000000000000000000",
  corrAccount: "",
  kbe: "19",
  paymentPurposeCode: "851",
  director: "Иванов Иван Иванович",
  accountant: "Иванов Иван Иванович",
  phone: "+7 700 000 00 00",
  email: "hello@example.com",
};

const counterparty: Entity = {
  id: createId(),
  title: "Клиент",
  legalName: "ТОО \"Клиент\"",
  taxId: "111111111111",
  registrationCode: "",
  address: "г. Астана, ул. Кабанбай батыра, 10",
  bankName: "",
  bik: "",
  account: "",
  corrAccount: "",
  kbe: "",
  paymentPurposeCode: "",
  director: "",
  accountant: "",
  phone: "",
  email: "",
};

const invoice: InvoiceState = {
  number: "1",
  date: today,
  dueDate: "",
  issuerId: ownEntity.id,
  customerId: counterparty.id,
  contract: "",
  currency: "KZT",
  items: [
    {
      id: createId(),
      code: "",
      title: "Услуги по договору",
      unit: "шт",
      quantity: 1,
      price: 100000,
      vatRate: 0,
    },
  ],
  note: "Внимание! Оплата данного счета означает согласие с условиями поставки товара.\nУведомление об оплате обязательно, в противном случае не гарантируется наличие товара на складе. Товар отпускается по факту прихода денег на р/с Поставщика, самовывозом, при наличии доверенности и документов удостоверяющих личность.",
};

export const initialData: AppData = {
  ownEntities: [ownEntity],
  counterparties: [counterparty],
  invoice,
};

export function loadData(): AppData {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return initialData;

  try {
    const parsed = JSON.parse(stored) as AppData;
    const ownEntities = parsed.ownEntities?.length ? parsed.ownEntities : initialData.ownEntities;
    const counterparties = parsed.counterparties?.length ? parsed.counterparties : initialData.counterparties;
    const invoice = parsed.invoice ?? initialData.invoice;

    return {
      ownEntities: ownEntities.map(normalizeEntity),
      counterparties: counterparties.map(normalizeEntity),
      invoice: {
        ...initialData.invoice,
        ...invoice,
        items: (invoice.items?.length ? invoice.items : initialData.invoice.items).map((item) => ({
          ...emptyItem(),
          ...item,
        })),
      },
    };
  } catch {
    return initialData;
  }
}

function normalizeEntity(entity: Entity): Entity {
  return {
    ...emptyEntity(),
    ...entity,
  };
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function downloadBackup(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-maker-backup-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

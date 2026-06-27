import type { AppData, Entity, InvoiceState } from "./types";

const STORAGE_KEY = "invoice-maker:data:v1";

const today = new Date().toISOString().slice(0, 10);

export const emptyEntity = (): Entity => ({
  id: crypto.randomUUID(),
  title: "",
  legalName: "",
  taxId: "",
  registrationCode: "",
  address: "",
  bankName: "",
  bik: "",
  account: "",
  corrAccount: "",
  director: "",
  accountant: "",
  phone: "",
  email: "",
});

export const emptyItem = () => ({
  id: crypto.randomUUID(),
  title: "",
  unit: "усл.",
  quantity: 1,
  price: 0,
  vatRate: 0,
});

const ownEntity: Entity = {
  id: crypto.randomUUID(),
  title: "Моя компания",
  legalName: "ТОО \"Моя компания\"",
  taxId: "000000000000",
  registrationCode: "",
  address: "г. Алматы, проспект Абая, 1",
  bankName: "АО \"Банк\"",
  bik: "CASPKZKA",
  account: "KZ000000000000000000",
  corrAccount: "",
  director: "Иванов Иван Иванович",
  accountant: "Иванов Иван Иванович",
  phone: "+7 700 000 00 00",
  email: "hello@example.com",
};

const counterparty: Entity = {
  id: crypto.randomUUID(),
  title: "Клиент",
  legalName: "ТОО \"Клиент\"",
  taxId: "111111111111",
  registrationCode: "",
  address: "г. Астана, ул. Кабанбай батыра, 10",
  bankName: "",
  bik: "",
  account: "",
  corrAccount: "",
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
      id: crypto.randomUUID(),
      title: "Услуги по договору",
      unit: "усл.",
      quantity: 1,
      price: 100000,
      vatRate: 0,
    },
  ],
  note: "Оплата по счету означает согласие с условиями поставки услуг.",
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
    return {
      ownEntities: parsed.ownEntities?.length ? parsed.ownEntities : initialData.ownEntities,
      counterparties: parsed.counterparties?.length ? parsed.counterparties : initialData.counterparties,
      invoice: parsed.invoice ?? initialData.invoice,
    };
  } catch {
    return initialData;
  }
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

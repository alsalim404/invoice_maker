import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import type { Entity, InvoiceItem, InvoiceState } from "./types";

type FontBundle = { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string> };

const currencyLabels = {
  KZT: "тенге",
  RUB: "руб.",
  USD: "USD",
  EUR: "EUR",
};

const money = (value: number, currency: keyof typeof currencyLabels) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ` ${currencyLabels[currency]}`;

const dateRu = (value: string) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`));
};

export function calculateTotals(items: InvoiceItem[]) {
  return items.reduce(
    (acc, item) => {
      const subtotal = Number(item.quantity || 0) * Number(item.price || 0);
      const vat = subtotal * (Number(item.vatRate || 0) / 100);
      acc.subtotal += subtotal;
      acc.vat += vat;
      acc.total += subtotal + vat;
      return acc;
    },
    { subtotal: 0, vat: 0, total: 0 },
  );
}

const entityLines = (entity: Entity) =>
  [
    entity.legalName,
    entity.taxId && `БИН/ИИН: ${entity.taxId}`,
    entity.registrationCode && `КПП/код регистрации: ${entity.registrationCode}`,
    entity.address,
    entity.bankName && `Банк: ${entity.bankName}`,
    entity.bik && `БИК: ${entity.bik}`,
    entity.account && `ИИК/р/с: ${entity.account}`,
    entity.corrAccount && `к/с: ${entity.corrAccount}`,
    entity.phone && `Тел.: ${entity.phone}`,
    entity.email && `Email: ${entity.email}`,
  ].filter(Boolean) as string[];

const signerLine = (label: string, name: string): Content => ({
  columns: [
    { text: label, width: 100 },
    { text: "____________________", width: 150 },
    { text: name || " ", width: "*" },
  ],
  margin: [0, 18, 0, 0],
});

export async function generateInvoicePdf(invoice: InvoiceState, issuer: Entity, customer: Entity) {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);

  (pdfMake as unknown as { vfs: Record<string, string> }).vfs =
    (pdfFonts as FontBundle).pdfMake?.vfs ?? (pdfFonts as FontBundle).vfs ?? {};

  const totals = calculateTotals(invoice.items);
  const body: TableCell[][] = [
    [
      { text: "№", bold: true },
      { text: "Наименование", bold: true },
      { text: "Ед.", bold: true },
      { text: "Кол-во", bold: true, alignment: "right" },
      { text: "Цена", bold: true, alignment: "right" },
      { text: "НДС", bold: true, alignment: "right" },
      { text: "Сумма", bold: true, alignment: "right" },
    ],
    ...invoice.items.map((item, index): TableCell[] => {
      const subtotal = Number(item.quantity || 0) * Number(item.price || 0);
      const vat = subtotal * (Number(item.vatRate || 0) / 100);
      return [
        String(index + 1),
        item.title || "Позиция",
        item.unit || "шт.",
        { text: String(item.quantity || 0), alignment: "right" as const },
        { text: money(Number(item.price || 0), invoice.currency), alignment: "right" as const },
        { text: item.vatRate ? money(vat, invoice.currency) : "без НДС", alignment: "right" as const },
        { text: money(subtotal + vat, invoice.currency), alignment: "right" as const },
      ];
    }),
  ];

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [36, 32, 36, 42],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      lineHeight: 1.15,
    },
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 18, 0, 12] },
      blockTitle: { bold: true, margin: [0, 0, 0, 4] },
      muted: { color: "#64748b" },
    },
    content: [
      {
        columns: [
          {
            stack: [{ text: issuer.legalName || issuer.title, bold: true }, ...entityLines(issuer).slice(1)],
            width: "*",
          },
          {
            text: ["Счет сформирован: ", dateRu(new Date().toISOString().slice(0, 10))],
            style: "muted",
            alignment: "right",
            width: 150,
          },
        ],
      },
      { text: `Счет на оплату № ${invoice.number || "б/н"} от ${dateRu(invoice.date)}`, style: "title" },
      {
        columns: [
          { stack: [{ text: "Поставщик", style: "blockTitle" }, ...entityLines(issuer)], width: "50%" },
          { stack: [{ text: "Покупатель", style: "blockTitle" }, ...entityLines(customer)], width: "50%" },
        ],
        columnGap: 18,
      },
      invoice.contract
        ? { text: `Основание: ${invoice.contract}`, margin: [0, 12, 0, 0] }
        : { text: " ", margin: [0, 8, 0, 0] },
      invoice.dueDate
        ? { text: `Срок оплаты: до ${dateRu(invoice.dueDate)}`, margin: [0, 3, 0, 8] }
        : { text: " ", margin: [0, 3, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: [18, "*", 34, 42, 70, 70, 78],
          body,
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? "#f1f5f9" : null),
          hLineColor: () => "#cbd5e1",
          vLineColor: () => "#cbd5e1",
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },
      {
        columns: [
          { text: "" },
          {
            table: {
              widths: ["*", 95],
              body: [
                ["Итого без НДС:", { text: money(totals.subtotal, invoice.currency), alignment: "right" }],
                ["НДС:", { text: totals.vat ? money(totals.vat, invoice.currency) : "без НДС", alignment: "right" }],
                [{ text: "Всего к оплате:", bold: true }, { text: money(totals.total, invoice.currency), bold: true, alignment: "right" }],
              ],
            },
            layout: "noBorders",
            width: 240,
            margin: [0, 12, 0, 0],
          },
        ],
      },
      invoice.note ? { text: invoice.note, margin: [0, 18, 0, 0] } : { text: "" },
      signerLine("Руководитель", issuer.director),
      signerLine("Бухгалтер", issuer.accountant),
    ],
  };

  await new Promise<void>((resolve) => {
    pdfMake.createPdf(doc).getBlob((blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `schet-${invoice.number || "bez-nomera"}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    });
  });
}

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import type { Entity, InvoiceItem, InvoiceState } from "./types";

type FontVfs = Record<string, string>;
type FontBundle = FontVfs & { default?: FontVfs; pdfMake?: { vfs: FontVfs }; vfs?: FontVfs };

const currencyLabels = {
  KZT: "KZT",
  RUB: "RUB",
  USD: "USD",
  EUR: "EUR",
};

function resolveFontVfs(bundle: FontBundle): FontVfs {
  return bundle.pdfMake?.vfs ?? bundle.vfs ?? bundle.default ?? bundle;
}

(pdfMake as unknown as { vfs: FontVfs }).vfs = resolveFontVfs(pdfFonts as FontBundle);

const currencyWords = {
  KZT: ["тенге", "тиын"],
  RUB: ["рублей", "копеек"],
  USD: ["долларов", "центов"],
  EUR: ["евро", "центов"],
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const totalMoney = (value: number, currency: keyof typeof currencyLabels) => `${money(value)} ${currencyLabels[currency]}`;

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

function supplierText(entity: Entity) {
  return [entity.legalName || entity.title, entity.address].filter(Boolean).join(", ");
}

function customerText(entity: Entity) {
  return [
    entity.taxId && `ИИН/БИН: ${entity.taxId}`,
    entity.legalName || entity.title,
    entity.address,
  ]
    .filter(Boolean)
    .join(", ");
}

function amountInWords(value: number, currency: keyof typeof currencyWords) {
  const integer = Math.floor(Math.abs(value));
  const fraction = Math.round((Math.abs(value) - integer) * 100);
  const [major, minor] = currencyWords[currency];
  return `${numberToRussianWords(integer)} ${major} ${String(fraction).padStart(2, "0")} ${minor}`;
}

const onesMale = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const onesFemale = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const teens = [
  "десять",
  "одиннадцать",
  "двенадцать",
  "тринадцать",
  "четырнадцать",
  "пятнадцать",
  "шестнадцать",
  "семнадцать",
  "восемнадцать",
  "девятнадцать",
];
const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

function numberToRussianWords(value: number) {
  if (value === 0) return "ноль";

  const groups = [
    { value: 1_000_000_000, forms: ["миллиард", "миллиарда", "миллиардов"], female: false },
    { value: 1_000_000, forms: ["миллион", "миллиона", "миллионов"], female: false },
    { value: 1_000, forms: ["тысяча", "тысячи", "тысяч"], female: true },
  ];

  const words: string[] = [];
  let rest = value;

  for (const group of groups) {
    const count = Math.floor(rest / group.value);
    if (count) {
      words.push(...triadToWords(count, group.female), plural(count, group.forms));
      rest %= group.value;
    }
  }

  if (rest) words.push(...triadToWords(rest, false));
  return words.join(" ");
}

function triadToWords(value: number, female: boolean) {
  const words: string[] = [];
  const h = Math.floor(value / 100);
  const t = Math.floor((value % 100) / 10);
  const o = value % 10;

  if (h) words.push(hundreds[h]);
  if (t === 1) {
    words.push(teens[o]);
  } else {
    if (t) words.push(tens[t]);
    if (o) words.push((female ? onesFemale : onesMale)[o]);
  }

  return words;
}

function plural(value: number, forms: string[]) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function paymentOrderTable(issuer: Entity): Content {
  return {
    stack: [
      { text: "Образец платежного поручения", bold: true, fontSize: 10.5, margin: [0, 0, 0, 0] },
      {
        table: {
          widths: ["*", 94, 78],
          body: [
            [
              {
                stack: [
                  { text: "Бенефициар:", bold: true },
                  { text: issuer.legalName || issuer.title || "Поставщик", bold: true },
                  { text: `\nБИН: ${issuer.taxId || ""}` },
                ],
              },
              { stack: [{ text: "ИИК", bold: true, alignment: "center" }, { text: issuer.account || "", bold: true, alignment: "center", fontSize: 7.1, margin: [0, 14, 0, 0] }] },
              { stack: [{ text: "Кбе", bold: true, alignment: "center" }, { text: issuer.kbe || "", bold: true, alignment: "center", margin: [0, 14, 0, 0] }] },
            ],
            [
              { text: `Банк бенефициара:\n${issuer.bankName || ""}` },
              { stack: [{ text: "БИК", bold: true, alignment: "center" }, { text: issuer.bik || "", bold: true, alignment: "center", fontSize: 7.8, margin: [0, 10, 0, 0] }] },
              { stack: [{ text: "Код назначения платежа", bold: true, alignment: "center" }, { text: issuer.paymentPurposeCode || "", bold: true, alignment: "center", margin: [0, 10, 0, 0] }] },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => "#000000",
          vLineColor: () => "#000000",
          paddingLeft: () => 2,
          paddingRight: () => 2,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
      },
    ],
    margin: [0, 20, 0, 20],
  };
}

export function buildInvoiceDoc(invoice: InvoiceState, issuer: Entity, customer: Entity): TDocumentDefinitions {
  const totals = calculateTotals(invoice.items);
  const body: TableCell[][] = [
    [
      { text: "№", bold: true, alignment: "center" },
      { text: "Код", bold: true, alignment: "center" },
      { text: "Наименование", bold: true, alignment: "center" },
      { text: "Кол-во", bold: true, alignment: "center" },
      { text: "Ед.", bold: true, alignment: "center" },
      { text: "Цена", bold: true, alignment: "center" },
      { text: "Сумма", bold: true, alignment: "center" },
    ],
    ...invoice.items.map((item, index): TableCell[] => {
      const subtotal = Number(item.quantity || 0) * Number(item.price || 0);
      return [
        { text: String(index + 1), alignment: "center" },
        { text: item.code || "", alignment: "center" },
        item.title || "Позиция",
        { text: String(item.quantity || 0), alignment: "center" },
        { text: item.unit || "шт", alignment: "center" },
        { text: money(Number(item.price || 0)), alignment: "right" },
        { text: money(subtotal), alignment: "right" },
      ];
    }),
  ];

  const note = invoice.note?.trim()
    ? invoice.note
    : "Внимание! Оплата данного счета означает согласие с условиями поставки товара.";
  const contract = invoice.contract?.trim() || "Без договора";
  const amountWords = amountInWords(totals.total, invoice.currency);

  return {
    pageSize: "LETTER",
    pageMargins: [36, 40, 36, 34],
    defaultStyle: {
      font: "Roboto",
      fontSize: 8.2,
      lineHeight: 1.05,
      color: "#000000",
    },
    styles: {
      title: { fontSize: 13.5, bold: true },
      label: { fontSize: 8.8 },
      value: { fontSize: 8.5, bold: true },
      strong: { bold: true },
    },
    content: [
      { text: note, fontSize: 8.2, margin: [126, 0, 80, 0] },
      paymentOrderTable(issuer),
      { text: `Счет на оплату №${invoice.number || "б/н"} от ${dateRu(invoice.date)}`, style: "title", margin: [0, 0, 0, 10] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 540, y2: 0, lineWidth: 1.7, lineColor: "#000000" }], margin: [0, 0, 0, 7] },
      {
        columns: [
          { text: "Поставщик:", style: "label", width: 58 },
          { text: supplierText(issuer), style: "value", width: "*" },
        ],
        columnGap: 0,
        margin: [0, 0, 0, 22],
      },
      {
        columns: [
          { text: "Покупатель:", style: "label", width: 58 },
          { text: customerText(customer), style: "value", width: "*" },
        ],
        columnGap: 0,
        margin: [0, 0, 0, 16],
      },
      {
        columns: [
          { text: "Договор:", style: "label", width: 58 },
          { text: contract, style: "value", width: "*" },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          headerRows: 1,
          widths: [26, 48, "*", 40, 30, 62, 68],
          body,
        },
        layout: {
          hLineWidth: () => 0.7,
          vLineWidth: () => 0.7,
          hLineColor: () => "#000000",
          vLineColor: () => "#000000",
          paddingLeft: () => 2,
          paddingRight: () => 2,
          paddingTop: () => 1,
          paddingBottom: () => 1,
        },
        fontSize: 7.6,
      },
      {
        columns: [
          { text: "" },
          {
            table: {
              widths: [86, 72],
              body: [
                [{ text: "Итого:", bold: true, alignment: "right" }, { text: money(totals.total), bold: true, alignment: "right" }],
                [{ text: "В том числе НДС:", bold: true, alignment: "right" }, { text: money(totals.vat), bold: true, alignment: "right" }],
              ],
            },
            layout: "noBorders",
            width: 164,
            margin: [0, 8, 0, 0],
          },
        ],
      },
      {
        text: `Всего наименований ${invoice.items.length}, на сумму ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(totals.total)} ${invoice.currency}`,
        margin: [0, 6, 0, 2],
      },
      { text: `Всего к оплате: ${amountWords}`, bold: true, margin: [0, 0, 0, 10] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 540, y2: 0, lineWidth: 1.2, lineColor: "#000000" }], margin: [0, 0, 0, 16] },
      {
        columns: [
          { text: "Исполнитель", bold: true, width: 70 },
          { canvas: [{ type: "line", x1: 0, y1: 13, x2: 315, y2: 13, lineWidth: 0.6, lineColor: "#000000" }], width: 320 },
          { text: `/${issuer.director || issuer.accountant || ""}/`, width: "*" },
        ],
      },
    ],
  };
}

export function createInvoicePdfBlob(invoice: InvoiceState, issuer: Entity, customer: Entity) {
  const filename = `schet-${invoice.number || "bez-nomera"}.pdf`;

  return new Promise<{ blob: Blob; filename: string }>((resolve, reject) => {
    try {
      pdfMake.createPdf(buildInvoiceDoc(invoice, issuer, customer)).getBase64((base64: string) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }

        const blob = new Blob([bytes], { type: "application/pdf" });
        resolve({ blob, filename });
      });
    } catch (error) {
      reject(error);
    }
  });
}

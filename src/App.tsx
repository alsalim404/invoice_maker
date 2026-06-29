import {
  Building2,
  Download,
  FileDown,
  FileText,
  Plus,
  Save,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { calculateTotals, createInvoicePdfBlob } from "./pdf";
import { downloadBackup, emptyEntity, emptyItem, loadData, saveData } from "./storage";
import type { AppData, Entity, InvoiceItem, InvoiceState, RegistryKind } from "./types";

type Tab = "invoice" | "counterparties" | "ownEntities";

const entityLabels = {
  ownEntities: {
    title: "Мои ЮР лица",
    empty: "Добавьте компанию, от которой будете выставлять счета.",
  },
  counterparties: {
    title: "Контрагенты",
    empty: "Добавьте клиентов один раз и выбирайте их в счете.",
  },
};

const fieldLabels: Array<[keyof Entity, string, string]> = [
  ["title", "Короткое название", "Например: Techbooster"],
  ["legalName", "Полное юр. название", "ТОО / ИП / ООО"],
  ["taxId", "БИН/ИИН/ИНН", "000000000000"],
  ["registrationCode", "КПП / код регистрации", ""],
  ["address", "Юридический адрес", ""],
  ["bankName", "Банк", ""],
  ["bik", "БИК", ""],
  ["account", "ИИК / расчетный счет", ""],
  ["corrAccount", "Корр. счет", ""],
  ["kbe", "Кбе", "19"],
  ["paymentPurposeCode", "Код назначения платежа", "851"],
  ["director", "Руководитель", ""],
  ["accountant", "Бухгалтер", ""],
  ["phone", "Телефон", ""],
  ["email", "Email", ""],
];

const numberValue = (value: string) => Number(value.replace(",", ".")) || 0;

function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [tab, setTab] = useState<Tab>("invoice");
  const [selectedOwnId, setSelectedOwnId] = useState(data.ownEntities[0]?.id ?? "");
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState(data.counterparties[0]?.id ?? "");
  const [pdfFile, setPdfFile] = useState<{ url: string; filename: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => saveData(data), [data]);
  useEffect(
    () => () => {
      if (pdfFile) URL.revokeObjectURL(pdfFile.url);
    },
    [pdfFile],
  );

  const issuer = data.ownEntities.find((entity) => entity.id === data.invoice.issuerId) ?? data.ownEntities[0];
  const customer = data.counterparties.find((entity) => entity.id === data.invoice.customerId) ?? data.counterparties[0];
  const totals = useMemo(() => calculateTotals(data.invoice.items), [data.invoice.items]);

  const patchInvoice = (patch: Partial<InvoiceState>) => {
    setData((current) => ({ ...current, invoice: { ...current.invoice, ...patch } }));
  };

  const updateEntity = (kind: RegistryKind, id: string, patch: Partial<Entity>) => {
    setData((current) => ({
      ...current,
      [kind]: current[kind].map((entity) => (entity.id === id ? { ...entity, ...patch } : entity)),
    }));
  };

  const addEntity = (kind: RegistryKind) => {
    const entity = emptyEntity();
    entity.title = kind === "ownEntities" ? "Новая компания" : "Новый контрагент";
    entity.legalName = entity.title;
    setData((current) => ({
      ...current,
      [kind]: [...current[kind], entity],
      invoice: {
        ...current.invoice,
        issuerId: kind === "ownEntities" && !current.invoice.issuerId ? entity.id : current.invoice.issuerId,
        customerId: kind === "counterparties" && !current.invoice.customerId ? entity.id : current.invoice.customerId,
      },
    }));
    if (kind === "ownEntities") setSelectedOwnId(entity.id);
    if (kind === "counterparties") setSelectedCounterpartyId(entity.id);
  };

  const removeEntity = (kind: RegistryKind, id: string) => {
    setData((current) => {
      const nextList = current[kind].filter((entity) => entity.id !== id);
      const firstId = nextList[0]?.id ?? "";
      return {
        ...current,
        [kind]: nextList,
        invoice: {
          ...current.invoice,
          issuerId: kind === "ownEntities" && current.invoice.issuerId === id ? firstId : current.invoice.issuerId,
          customerId: kind === "counterparties" && current.invoice.customerId === id ? firstId : current.invoice.customerId,
        },
      };
    });
  };

  const updateItem = (id: string, patch: Partial<InvoiceItem>) => {
    patchInvoice({ items: data.invoice.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  };

  const removeItem = (id: string) => {
    const nextItems = data.invoice.items.filter((item) => item.id !== id);
    patchInvoice({ items: nextItems.length ? nextItems : [emptyItem()] });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      if (!Array.isArray(parsed.ownEntities) || !Array.isArray(parsed.counterparties) || !parsed.invoice) {
        throw new Error("Некорректный файл");
      }
      setData(parsed);
      setSelectedOwnId(parsed.ownEntities[0]?.id ?? "");
      setSelectedCounterpartyId(parsed.counterparties[0]?.id ?? "");
    } catch {
      alert("Не удалось импортировать файл. Проверьте, что это резервная копия Invoice Maker.");
    } finally {
      event.target.value = "";
    }
  };

  const createPdf = async () => {
    if (!issuer || !customer) {
      alert("Добавьте свое юрлицо и контрагента перед формированием PDF.");
      return;
    }
    try {
      const { blob, filename } = await createInvoicePdfBlob(data.invoice, issuer, customer);
      const url = URL.createObjectURL(blob);

      setPdfFile((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { url, filename };
      });

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      alert("Не удалось сформировать PDF. Проверьте заполнение счета и попробуйте еще раз.");
    }
  };

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <FileText size={28} />
          <div>
            <strong>Invoice Maker</strong>
            <span>Счета без повторного ввода</span>
          </div>
        </div>

        <nav className="tabs" aria-label="Разделы">
          <button className={tab === "invoice" ? "active" : ""} onClick={() => setTab("invoice")}>
            <FileText size={18} /> Счет
          </button>
          <button className={tab === "counterparties" ? "active" : ""} onClick={() => setTab("counterparties")}>
            <UsersRound size={18} /> Контрагенты
          </button>
          <button className={tab === "ownEntities" ? "active" : ""} onClick={() => setTab("ownEntities")}>
            <Building2 size={18} /> Мои ЮР лица
          </button>
        </nav>

        <div className="backup">
          <button title="Скачать резервную копию" onClick={() => downloadBackup(data)}>
            <Download size={18} /> Экспорт
          </button>
          <button title="Загрузить резервную копию" onClick={() => fileRef.current?.click()}>
            <Upload size={18} /> Импорт
          </button>
          <input ref={fileRef} type="file" accept="application/json" onChange={handleImport} hidden />
        </div>
      </aside>

      <section className="workspace">
        {tab === "invoice" && (
          <InvoiceView
            data={data}
            totals={totals}
            patchInvoice={patchInvoice}
            updateItem={updateItem}
            removeItem={removeItem}
            addItem={() => patchInvoice({ items: [...data.invoice.items, emptyItem()] })}
            createPdf={createPdf}
            pdfFile={pdfFile}
          />
        )}

        {tab === "counterparties" && (
          <RegistryView
            kind="counterparties"
            entities={data.counterparties}
            selectedId={selectedCounterpartyId}
            setSelectedId={setSelectedCounterpartyId}
            updateEntity={updateEntity}
            addEntity={addEntity}
            removeEntity={removeEntity}
          />
        )}

        {tab === "ownEntities" && (
          <RegistryView
            kind="ownEntities"
            entities={data.ownEntities}
            selectedId={selectedOwnId}
            setSelectedId={setSelectedOwnId}
            updateEntity={updateEntity}
            addEntity={addEntity}
            removeEntity={removeEntity}
          />
        )}
      </section>
    </main>
  );
}

function InvoiceView({
  data,
  totals,
  patchInvoice,
  updateItem,
  removeItem,
  addItem,
  createPdf,
  pdfFile,
}: {
  data: AppData;
  totals: ReturnType<typeof calculateTotals>;
  patchInvoice: (patch: Partial<InvoiceState>) => void;
  updateItem: (id: string, patch: Partial<InvoiceItem>) => void;
  removeItem: (id: string) => void;
  addItem: () => void;
  createPdf: () => void | Promise<void>;
  pdfFile: { url: string; filename: string } | null;
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Новый счет</p>
          <h1>Выберите юрлицо, контрагента и сформируйте PDF</h1>
        </div>
        <button className="primary" onClick={createPdf}>
          <FileDown size={19} /> PDF
        </button>
        {pdfFile && (
          <a className="download-ready" href={pdfFile.url} download={pdfFile.filename}>
            Скачать готовый PDF
          </a>
        )}
      </header>

      <div className="section-grid">
        <section className="panel">
          <h2>Реквизиты счета</h2>
          <div className="form-grid two">
            <label>
              Номер
              <input value={data.invoice.number} onChange={(event) => patchInvoice({ number: event.target.value })} />
            </label>
            <label>
              Дата
              <input type="date" value={data.invoice.date} onChange={(event) => patchInvoice({ date: event.target.value })} />
            </label>
            <label>
              Срок оплаты
              <input type="date" value={data.invoice.dueDate} onChange={(event) => patchInvoice({ dueDate: event.target.value })} />
            </label>
            <label>
              Валюта
              <select value={data.invoice.currency} onChange={(event) => patchInvoice({ currency: event.target.value as InvoiceState["currency"] })}>
                <option value="KZT">KZT</option>
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label>
              Мое ЮР лицо
              <select value={data.invoice.issuerId} onChange={(event) => patchInvoice({ issuerId: event.target.value })}>
                {data.ownEntities.map((entity) => (
                  <option value={entity.id} key={entity.id}>
                    {entity.title || entity.legalName || "Без названия"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Контрагент
              <select value={data.invoice.customerId} onChange={(event) => patchInvoice({ customerId: event.target.value })}>
                {data.counterparties.map((entity) => (
                  <option value={entity.id} key={entity.id}>
                    {entity.title || entity.legalName || "Без названия"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Основание
            <input value={data.invoice.contract} onChange={(event) => patchInvoice({ contract: event.target.value })} placeholder="Договор, заказ или комментарий" />
          </label>
        </section>

        <section className="panel totals-panel">
          <h2>Итоги</h2>
          <dl>
            <div>
              <dt>Без НДС</dt>
              <dd>{formatMoney(totals.subtotal, data.invoice.currency)}</dd>
            </div>
            <div>
              <dt>НДС</dt>
              <dd>{totals.vat ? formatMoney(totals.vat, data.invoice.currency) : "без НДС"}</dd>
            </div>
            <div className="grand">
              <dt>К оплате</dt>
              <dd>{formatMoney(totals.total, data.invoice.currency)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>Позиции счета</h2>
          <button onClick={addItem}>
            <Plus size={18} /> Позиция
          </button>
        </div>
        <div className="items-table">
          <div className="items-head">
            <span>Наименование</span>
            <span>Код</span>
            <span>Ед.</span>
            <span>Кол-во</span>
            <span>Цена</span>
            <span>НДС %</span>
            <span></span>
          </div>
          {data.invoice.items.map((item) => (
            <div className="item-row" key={item.id}>
              <input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} placeholder="Услуга или товар" />
              <input value={item.code} onChange={(event) => updateItem(item.id, { code: event.target.value })} placeholder="Код" />
              <input value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} />
              <input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: numberValue(event.target.value) })} />
              <input inputMode="decimal" value={item.price} onChange={(event) => updateItem(item.id, { price: numberValue(event.target.value) })} />
              <input inputMode="decimal" value={item.vatRate} onChange={(event) => updateItem(item.id, { vatRate: numberValue(event.target.value) })} />
              <button className="icon-button" title="Удалить позицию" onClick={() => removeItem(item.id)}>
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        <label>
          Примечание в PDF
          <textarea value={data.invoice.note} onChange={(event) => patchInvoice({ note: event.target.value })} rows={3} />
        </label>
      </section>
    </>
  );
}

function RegistryView({
  kind,
  entities,
  selectedId,
  setSelectedId,
  updateEntity,
  addEntity,
  removeEntity,
}: {
  kind: RegistryKind;
  entities: Entity[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  updateEntity: (kind: RegistryKind, id: string, patch: Partial<Entity>) => void;
  addEntity: (kind: RegistryKind) => void;
  removeEntity: (kind: RegistryKind, id: string) => void;
}) {
  const selected = entities.find((entity) => entity.id === selectedId) ?? entities[0];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Реестр</p>
          <h1>{entityLabels[kind].title}</h1>
        </div>
        <button className="primary" onClick={() => addEntity(kind)}>
          <Plus size={19} /> Добавить
        </button>
      </header>

      <div className="registry-layout">
        <section className="list-panel">
          {entities.length === 0 && <p className="empty">{entityLabels[kind].empty}</p>}
          {entities.map((entity) => (
            <button className={selected?.id === entity.id ? "entity-row active" : "entity-row"} key={entity.id} onClick={() => setSelectedId(entity.id)}>
              <strong>{entity.title || entity.legalName || "Без названия"}</strong>
              <span>{entity.taxId || "БИН/ИИН не указан"}</span>
            </button>
          ))}
        </section>

        <section className="panel">
          {!selected && <p className="empty">{entityLabels[kind].empty}</p>}
          {selected && (
            <>
              <div className="panel-heading">
                <h2>{selected.title || "Карточка"}</h2>
                <button className="danger" onClick={() => removeEntity(kind, selected.id)}>
                  <Trash2 size={18} /> Удалить
                </button>
              </div>
              <div className="form-grid two">
                {fieldLabels.map(([field, label, placeholder]) => (
                  <label key={field}>
                    {label}
                    <input
                      value={selected[field]}
                      placeholder={placeholder}
                      onChange={(event) => updateEntity(kind, selected.id, { [field]: event.target.value })}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function formatMoney(value: number, currency: string) {
  return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

export default App;

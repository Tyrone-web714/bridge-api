const { parse } = require('csv-parse/sync');
const repositories = require('../db/repositories');

const MAX_IMPORT_ROWS = Number.parseInt(process.env.MAX_BULK_IMPORT_ROWS, 10) || 100000;
const IMPORT_WRITE_CONCURRENCY = Math.min(
  20,
  Math.max(1, Number.parseInt(process.env.BULK_IMPORT_WRITE_CONCURRENCY, 10) || 8)
);
const SUPPORTED_IMPORT_TYPES = new Set(['customers', 'products', 'orders']);

const ALIASES = {
  accountNumber: ['account_number', 'account', 'account_id', 'customer_number', 'customer_id'],
  accountName: ['account_name', 'customer_name', 'business_name', 'customer', 'name'],
  address: ['address', 'street_address', 'delivery_address', 'ship_to_address'],
  city: ['city'],
  stateCode: ['state', 'state_code'],
  postalCode: ['zip', 'zipcode', 'postal_code'],
  phone: ['phone', 'phone_number', 'telephone'],
  territory: ['territory', 'sales_territory'],
  routeGroup: ['route_group', 'route_team', 'route_area'],
  distributionCenter: ['distribution_center', 'warehouse', 'depot'],
  active: ['active', 'is_active', 'status'],
  sku: ['sku', 'product_sku', 'item_code', 'product_code'],
  productName: ['product_name', 'product', 'item_name', 'description'],
  brand: ['brand'],
  packageSize: ['package_size', 'pack_size', 'package', 'size'],
  category: ['category', 'product_category'],
  unitPrice: ['unit_price', 'price', 'case_price'],
  invoiceNumber: ['invoice_number', 'invoice', 'invoice_no', 'order_number'],
  orderDate: ['order_date', 'sales_date', 'invoice_date'],
  deliveryDate: ['delivery_date', 'ship_date'],
  quantity: ['quantity', 'units', 'cases', 'ordered_quantity'],
  grossAmount: ['gross_amount', 'line_total', 'extended_price', 'sales_amount'],
  deductionQuantity: ['deduction_quantity', 'returned_quantity', 'short_quantity'],
  deductionAmount: ['deduction_amount', 'credit_amount', 'return_amount'],
  status: ['status', 'order_status'],
};

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeHeader(value) {
  return cleanText(value, 120).toLowerCase().replace(/[\s.-]+/g, '_');
}

function readCell(row, fieldName) {
  for (const alias of ALIASES[fieldName] || []) {
    const key = normalizeHeader(alias);
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  return '';
}

function parseMoney(value) {
  const parsed = Number(cleanText(value, 40).replace(/[$,]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
}

function parseQuantity(value) {
  const parsed = Number(cleanText(value, 40).replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseBoolean(value, fallback = true) {
  const cleaned = cleanText(value, 40).toLowerCase();
  if (!cleaned) return fallback;
  if (['false', 'no', 'n', '0', 'inactive'].includes(cleaned)) return false;
  if (['true', 'yes', 'y', '1', 'active'].includes(cleaned)) return true;
  return fallback;
}

function parseDate(value) {
  const cleaned = cleanText(value, 80);
  if (!cleaned) return null;
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function parseRows(csvText) {
  const records = parse(csvText, {
    columns: (headers) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });
  if (!Array.isArray(records) || !records.length) {
    const error = new Error('The CSV contains no data rows.');
    error.status = 400;
    throw error;
  }
  if (records.length > MAX_IMPORT_ROWS) {
    const error = new Error(`The CSV exceeds the ${MAX_IMPORT_ROWS.toLocaleString()} row import limit.`);
    error.status = 413;
    throw error;
  }
  return records;
}

function normalizeCustomers(rows) {
  const records = [];
  const warnings = [];
  rows.forEach((row, index) => {
    const accountNumber = cleanText(readCell(row, 'accountNumber'), 120);
    const accountName = cleanText(readCell(row, 'accountName'), 240);
    if (!accountNumber || !accountName) {
      warnings.push({ row: index + 2, reason: 'Missing account number or account name.' });
      return;
    }
    records.push({
      accountNumber,
      accountName,
      address: cleanText(readCell(row, 'address'), 500) || null,
      city: cleanText(readCell(row, 'city'), 120) || null,
      stateCode: cleanText(readCell(row, 'stateCode'), 2).toUpperCase() || null,
      postalCode: cleanText(readCell(row, 'postalCode'), 20) || null,
      phone: cleanText(readCell(row, 'phone'), 40) || null,
      territory: cleanText(readCell(row, 'territory'), 160) || null,
      routeGroup: cleanText(readCell(row, 'routeGroup'), 160) || null,
      distributionCenter: cleanText(readCell(row, 'distributionCenter'), 160) || null,
      active: parseBoolean(readCell(row, 'active')),
      raw: row,
    });
  });
  return { records, warnings };
}

function normalizeProducts(rows) {
  const records = [];
  const warnings = [];
  rows.forEach((row, index) => {
    const sku = cleanText(readCell(row, 'sku'), 120);
    const productName = cleanText(readCell(row, 'productName'), 240);
    if (!sku || !productName) {
      warnings.push({ row: index + 2, reason: 'Missing SKU or product name.' });
      return;
    }
    records.push({
      sku,
      productName,
      brand: cleanText(readCell(row, 'brand'), 120) || null,
      packageSize: cleanText(readCell(row, 'packageSize'), 120) || null,
      category: cleanText(readCell(row, 'category'), 120) || null,
      unitPrice: parseMoney(readCell(row, 'unitPrice')),
      active: parseBoolean(readCell(row, 'active')),
      raw: row,
    });
  });
  return { records, warnings };
}

function normalizeOrders(rows) {
  const orderMap = new Map();
  const warnings = [];

  rows.forEach((row, index) => {
    const accountNumber = cleanText(readCell(row, 'accountNumber'), 120);
    const invoiceNumber = cleanText(readCell(row, 'invoiceNumber'), 160);
    const sku = cleanText(readCell(row, 'sku'), 120);
    const productName = cleanText(readCell(row, 'productName'), 240);
    if (!accountNumber || !invoiceNumber || (!sku && !productName)) {
      warnings.push({
        row: index + 2,
        reason: 'Missing account number, invoice number, or product identity.',
      });
      return;
    }

    const key = `${accountNumber}:${invoiceNumber}`;
    if (!orderMap.has(key)) {
      orderMap.set(key, {
        accountNumber,
        accountName: cleanText(readCell(row, 'accountName'), 240) || null,
        invoiceNumber,
        orderDate: parseDate(readCell(row, 'orderDate')),
        deliveryDate: parseDate(readCell(row, 'deliveryDate')),
        status: cleanText(readCell(row, 'status'), 80) || 'open',
        items: [],
        raw: { source: 'bulk_order_import' },
      });
    }

    const quantity = parseQuantity(readCell(row, 'quantity'));
    const unitPrice = parseMoney(readCell(row, 'unitPrice'));
    const grossAmount = parseMoney(readCell(row, 'grossAmount')) || Math.round(quantity * unitPrice * 100) / 100;
    const deductionAmount = parseMoney(readCell(row, 'deductionAmount'));
    orderMap.get(key).items.push({
      sku: sku || null,
      productName: productName || sku,
      brand: cleanText(readCell(row, 'brand'), 120) || null,
      packageSize: cleanText(readCell(row, 'packageSize'), 120) || null,
      category: cleanText(readCell(row, 'category'), 120) || null,
      quantity,
      unitPrice,
      grossAmount,
      deductionQuantity: parseQuantity(readCell(row, 'deductionQuantity')),
      deductionAmount,
      netAmount: Math.max(0, Math.round((grossAmount - deductionAmount) * 100) / 100),
      raw: row,
    });
  });

  return { records: [...orderMap.values()], warnings };
}

function normalizeImport(importType, csvText) {
  const type = cleanText(importType, 40).toLowerCase();
  if (!SUPPORTED_IMPORT_TYPES.has(type)) {
    const error = new Error('Import type must be customers, products, or orders.');
    error.status = 400;
    throw error;
  }
  const rows = parseRows(csvText);
  const normalized = type === 'customers'
    ? normalizeCustomers(rows)
    : type === 'products'
      ? normalizeProducts(rows)
      : normalizeOrders(rows);
  return {
    importType: type,
    rowCount: rows.length,
    validCount: normalized.records.length,
    warningCount: normalized.warnings.length,
    warnings: normalized.warnings.slice(0, 250),
    records: normalized.records,
    sample: normalized.records.slice(0, 5),
  };
}

async function executeImport(preview, options = {}) {
  const imported = [];

  async function importRecord(record) {
    if (preview.importType === 'customers') {
      return repositories.upsertCustomerAccount(record);
    }
    if (preview.importType === 'products') {
      return repositories.upsertProduct(record);
    }
    return repositories.createAccountOrder(record);
  }

  try {
    for (let index = 0; index < preview.records.length; index += IMPORT_WRITE_CONCURRENCY) {
      const chunk = preview.records.slice(index, index + IMPORT_WRITE_CONCURRENCY);
      imported.push(...await Promise.all(chunk.map(importRecord)));
    }

    const summary = {
      rows: preview.rowCount,
      imported: imported.length,
      warnings: preview.warningCount,
      importType: preview.importType,
      writeConcurrency: IMPORT_WRITE_CONCURRENCY,
    };
    const batch = await repositories.saveDataImportBatch({
      importType: preview.importType,
      sourceFileName: options.fileName,
      status: 'completed',
      rowCount: preview.rowCount,
      importedCount: imported.length,
      warningCount: preview.warningCount,
      summary,
      importedBy: options.importedBy,
    });

    return { imported, batch, summary };
  } catch (error) {
    const summary = {
      rows: preview.rowCount,
      imported: imported.length,
      warnings: preview.warningCount,
      importType: preview.importType,
      writeConcurrency: IMPORT_WRITE_CONCURRENCY,
      error: error.message || 'Import write failed.',
    };
    try {
      await repositories.saveDataImportBatch({
        importType: preview.importType,
        sourceFileName: options.fileName,
        status: 'failed',
        rowCount: preview.rowCount,
        importedCount: imported.length,
        warningCount: preview.warningCount,
        summary,
        importedBy: options.importedBy,
      });
    } catch (batchError) {
      console.error('[bulk-import] unable to record failed import batch:', batchError.message);
    }
    error.importSummary = summary;
    throw error;
  }
}

module.exports = {
  executeImport,
  normalizeImport,
};

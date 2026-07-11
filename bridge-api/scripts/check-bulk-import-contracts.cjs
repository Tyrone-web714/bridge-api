const assert = require('assert');
const fs = require('fs');
const path = require('path');
const bulkImport = require('../services/bulkImport');

const customerPreview = bulkImport.normalizeImport('customers', [
  'account_number,account_name,address,city,state,zip,active',
  'ACCT-1,Test Customer,100 Main St,San Antonio,TX,78205,true',
  ',Missing Number,200 Main St,San Antonio,TX,78205,true',
].join('\n'));
assert.strictEqual(customerPreview.rowCount, 2);
assert.strictEqual(customerPreview.validCount, 1);
assert.strictEqual(customerPreview.warningCount, 1);
assert.strictEqual(customerPreview.records[0].stateCode, 'TX');

const productPreview = bulkImport.normalizeImport('products', [
  'sku,barcodes,product_name,brand,unit_price',
  'SKU-1,000000000101|000000000102,Cola 12 Pack,Demo Beverage,$9.99',
].join('\n'));
assert.strictEqual(productPreview.validCount, 1);
assert.strictEqual(productPreview.records[0].unitPrice, 9.99);
assert.deepStrictEqual(productPreview.records[0].barcodes, ['000000000101', '000000000102']);

const orderPreview = bulkImport.normalizeImport('orders', [
  'account_number,account_name,invoice_number,order_date,sku,product_name,quantity,unit_price',
  'ACCT-1,Test Customer,INV-1,2026-06-05,SKU-1,Cola 12 Pack,10,9.99',
  'ACCT-1,Test Customer,INV-1,2026-06-05,SKU-2,Bottled Water 24 Pack,5,12.50',
].join('\n'));
assert.strictEqual(orderPreview.rowCount, 2);
assert.strictEqual(orderPreview.validCount, 1);
assert.strictEqual(orderPreview.records[0].items.length, 2);
assert.strictEqual(orderPreview.records[0].items[0].grossAmount, 99.9);
assert.strictEqual(orderPreview.records[0].items[1].grossAmount, 62.5);
assert.strictEqual(
  orderPreview.records[0].items.reduce((sum, item) => sum + item.netAmount, 0),
  162.4
);

assert.throws(
  () => bulkImport.normalizeImport('unknown', 'a,b\n1,2'),
  /Import type must be/
);
assert.throws(
  () => bulkImport.normalizeImport('customers', 'account_number,account_name\n'),
  /contains no data rows/
);

const routeManifestSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'routeManifests.js'),
  'utf8'
);
const repositorySource = fs.readFileSync(
  path.join(__dirname, '..', 'db', 'repositories.js'),
  'utf8'
);
assert(
  routeManifestSource.includes('list="activeDriverOptions"'),
  'Route manifest assignment must use an editable active-driver field.'
);
assert(
  routeManifestSource.includes('const activeDriversByName = new Map();'),
  'Route manifest assignment must resolve active drivers by registered name.'
);
assert(
  routeManifestSource.includes('Enter or choose an active company driver ID...'),
  'Route manifest assignment must prompt for the company driver ID.'
);
assert(
  routeManifestSource.includes('driverSelectStatus'),
  'Route manifest assignment must display driver-registry loading status.'
);
assert(
  routeManifestSource.includes('<th>Switch</th><th>Actions</th><th>Date</th>'),
  'Route assignment actions must remain at the visible front of each route row.'
);
assert(
  routeManifestSource.includes('The selected driver is not registered as active.'),
  'Route assignment must reject unknown or inactive drivers.'
);
assert(
  repositorySource.includes(
    'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, NOW(), NOW())'
  ),
  'Driver creation must provide values for every drivers-table insert column.'
);
assert(
  repositorySource.includes('driver_id, internal_driver_id, organization_id, company_driver_number,'),
  'Driver creation must persist internal driver ID, Organization ID, and company driver number.'
);

console.log('[test:imports] validation, grouping, totals, and empty-file contracts verified.');

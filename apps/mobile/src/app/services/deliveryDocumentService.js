function safe(value) {
  return String(value ?? '').replace(/[\^~]/g, ' ').trim();
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
}

function paymentLabel(value) {
  return {
    cash: 'Cash',
    check: 'Check',
    card: 'Card',
    credit_account: 'Credit account',
    partial_payment: 'Partial payment',
    unpaid: 'Unpaid balance',
  }[value] || 'Not recorded';
}

function productId(item) {
  return item?.sku || item?.productNumber || item?.productId || item?.orderItemId || 'N/A';
}

const ORGANIZATION_NAME = String(
  process.env.EXPO_PUBLIC_ORGANIZATION_NAME || 'TruckSafe Routing'
).trim().slice(0, 80);

function line(y, left, right = '') {
  return `^FO25,${y}^A0N,25,25^FD${safe(left)}^FS^FO515,${y}^A0N,25,25^FB260,1,0,R^FD${safe(right)}^FS`;
}

function parseSignaturePayload(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return { image: trimmed, points: [] };
    }
  }
  return { image: trimmed, points: [] };
}

function collectSignaturePoints(signature) {
  const payload = parseSignaturePayload(signature);
  const groups = Array.isArray(payload?.points) ? payload.points : [];
  return groups
    .map((group) => (Array.isArray(group?.points) ? group.points : []))
    .filter((points) => points.length > 0)
    .map((points) => points
      .map((point) => ({
        x: Number(point.x),
        y: Number(point.y),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
}

function zplBox(x, y, width, height, thickness = 2) {
  return `^FO${x},${y}^GB${Math.max(1, width)},${Math.max(1, height)},${thickness},B,0^FS`;
}

function zplSegment(x1, y1, x2, y2, thickness = 3) {
  const left = Math.round(Math.min(x1, x2));
  const top = Math.round(Math.min(y1, y2));
  const width = Math.max(1, Math.round(Math.abs(x2 - x1)));
  const height = Math.max(1, Math.round(Math.abs(y2 - y1)));
  if (width <= 2 && height <= 2) return zplBox(left, top, thickness, thickness, thickness);
  if (height <= 2) return zplBox(left, Math.round(y1), width, thickness, thickness);
  if (width <= 2) return zplBox(Math.round(x1), top, thickness, height, thickness);
  const orientation = (x2 - x1) * (y2 - y1) >= 0 ? 'R' : 'L';
  return `^FO${left},${top}^GD${width},${height},${thickness},B,${orientation}^FS`;
}

function signatureGraphicZpl(y, label, signature) {
  const groups = collectSignaturePoints(signature);
  if (!groups.length) {
    return {
      commands: [line(y, `${label}: ${signature ? 'Captured' : 'Not captured'}`)],
      height: 30,
    };
  }

  const allPoints = groups.flat();
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const sourceWidth = Math.max(1, maxX - minX);
  const sourceHeight = Math.max(1, maxY - minY);
  const boxX = 150;
  const boxY = y + 30;
  const boxWidth = 500;
  const boxHeight = 115;
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = boxX + ((boxWidth - drawWidth) / 2);
  const offsetY = boxY + ((boxHeight - drawHeight) / 2);
  const commands = [
    line(y, `${label}: Captured`),
    zplBox(boxX - 10, boxY - 8, boxWidth + 20, boxHeight + 16, 2),
  ];

  groups.forEach((points) => {
    const sampled = points.filter((_, index) => index === 0 || index === points.length - 1 || index % 2 === 0);
    for (let index = 1; index < sampled.length; index += 1) {
      const previous = sampled[index - 1];
      const current = sampled[index];
      commands.push(zplSegment(
        offsetX + ((previous.x - minX) * scale),
        offsetY + ((previous.y - minY) * scale),
        offsetX + ((current.x - minX) * scale),
        offsetY + ((current.y - minY) * scale)
      ));
    }
  });

  return { commands, height: 170 };
}

export function buildLocalDeliveryDocument(delivery, identity, documentType) {
  const stop = delivery?.stop || {};
  const order = delivery?.order || {};
  const settlement = delivery?.settlement || {};
  const items = settlement.items || [];
  return {
    brand: ORGANIZATION_NAME,
    documentType,
    driver: {
      id: identity?.driverId || settlement.driverId || '',
      name: identity?.driverName || identity?.driverId || settlement.driverId || '',
    },
    customer: {
      accountNumber: stop.accountNumber || order.accountNumber || '',
      accountName: stop.accountName || order.accountName || '',
      address: [
        stop.destinationAddress,
        [stop.city, stop.stateCode, stop.postalCode].filter(Boolean).join(' '),
      ].filter(Boolean).join(', '),
    },
    invoiceNumber: order.invoiceNumber || '',
    routeNumber: stop.routeNumber || '',
    routeDate: stop.routeDate || '',
    items,
    subtotalAmount: documentType === 'receipt'
      ? settlement.finalAmount
      : settlement.plannedAmount,
    taxAmount: documentType === 'receipt' ? settlement.taxAmount : 0,
    totalAmount: documentType === 'receipt'
      ? settlement.totalAmount
      : settlement.plannedAmount,
    paymentMethod: settlement.paymentMethod || null,
    amountPaid: settlement.amountPaid || 0,
    unpaidBalance: settlement.unpaidBalance || 0,
    customerSignature: settlement.customerSignature || null,
    driverSignature: settlement.driverSignature || null,
    generatedAt: new Date().toISOString(),
  };
}

export function buildLocalRouteCloseoutDocument(route, deliveries, identity) {
  const deliveryByStopId = new Map(
    (Array.isArray(deliveries) ? deliveries : [])
      .filter((delivery) => delivery?.stop?.id)
      .map((delivery) => [delivery.stop.id, delivery])
  );
  const transactions = (route?.stops || []).map((stop) => {
    const delivery = deliveryByStopId.get(stop.id) || {};
    const settlement = delivery.settlement || stop.deliverySettlement || {};
    const order = delivery.order || (Array.isArray(stop.accountOrders) ? stop.accountOrders[0] : null) || {};
    return {
      stopId: stop.id,
      stopSequence: stop.stopSequence,
      accountNumber: stop.accountNumber || order.accountNumber || null,
      accountName: stop.accountName || order.accountName || null,
      invoiceNumber: order.invoiceNumber || null,
      completionStatus: settlement.completionStatus || stop.status,
      paymentMethod: settlement.paymentMethod || null,
      subtotalAmount: Number(settlement.finalAmount || 0),
      taxAmount: Number(settlement.taxAmount || 0),
      totalAmount: Number(settlement.totalAmount || (
        Number(settlement.finalAmount || 0) + Number(settlement.taxAmount || 0)
      )),
      amountPaid: Number(settlement.amountPaid || 0),
      unpaidBalance: Number(settlement.unpaidBalance || 0),
      plannedQuantity: Number(settlement.plannedQuantity || 0),
      deliveredQuantity: Number(settlement.deliveredQuantity || 0),
      rejectedQuantity: Number(settlement.rejectedQuantity || 0),
      damagedQuantity: Number(settlement.damagedQuantity || 0),
      missingQuantity: Number(settlement.missingQuantity || 0),
      returnedQuantity: Number(settlement.returnedQuantity || 0),
      addedQuantity: Number(settlement.addedQuantity || 0),
    };
  });
  const totals = transactions.reduce((summary, transaction) => ({
    subtotalAmount: summary.subtotalAmount + transaction.subtotalAmount,
    taxAmount: summary.taxAmount + transaction.taxAmount,
    totalAmount: summary.totalAmount + transaction.totalAmount,
    amountPaid: summary.amountPaid + transaction.amountPaid,
    unpaidBalance: summary.unpaidBalance + transaction.unpaidBalance,
    cashAmount: summary.cashAmount + (transaction.paymentMethod === 'cash' ? transaction.amountPaid : 0),
    checkAmount: summary.checkAmount + (transaction.paymentMethod === 'check' ? transaction.amountPaid : 0),
    cardAmount: summary.cardAmount + (transaction.paymentMethod === 'card' ? transaction.amountPaid : 0),
    creditAccountAmount: summary.creditAccountAmount + (
      transaction.paymentMethod === 'credit_account' ? transaction.totalAmount : 0
    ),
    partialPaymentAmount: summary.partialPaymentAmount + (
      transaction.paymentMethod === 'partial_payment' ? transaction.amountPaid : 0
    ),
  }), {
    subtotalAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    amountPaid: 0,
    unpaidBalance: 0,
    cashAmount: 0,
    checkAmount: 0,
    cardAmount: 0,
    creditAccountAmount: 0,
    partialPaymentAmount: 0,
  });
  const inventory = transactions.reduce((summary, transaction) => ({
    plannedQuantity: summary.plannedQuantity + transaction.plannedQuantity,
    deliveredQuantity: summary.deliveredQuantity + transaction.deliveredQuantity,
    rejectedQuantity: summary.rejectedQuantity + transaction.rejectedQuantity,
    damagedQuantity: summary.damagedQuantity + transaction.damagedQuantity,
    missingQuantity: summary.missingQuantity + transaction.missingQuantity,
    returnedQuantity: summary.returnedQuantity + transaction.returnedQuantity,
    addedQuantity: summary.addedQuantity + transaction.addedQuantity,
  }), {
    plannedQuantity: 0,
    deliveredQuantity: 0,
    rejectedQuantity: 0,
    damagedQuantity: 0,
    missingQuantity: 0,
    returnedQuantity: 0,
    addedQuantity: 0,
  });
  inventory.unaccountedQuantity = Math.max(
    0,
    inventory.plannedQuantity
      - inventory.deliveredQuantity
      - inventory.rejectedQuantity
      - inventory.damagedQuantity
      - inventory.missingQuantity
      - inventory.returnedQuantity
  );
  const generatedAt = new Date().toISOString();
  return {
    documentNumber: `TURNIN-OFFLINE-${route?.routeDate || generatedAt.slice(0, 10)}-${route?.routeNumber || route?.id || 'ROUTE'}`,
    payload: {
      brand: ORGANIZATION_NAME,
      documentType: 'route_closeout',
      driver: {
        id: identity?.driverId || route?.assignedDriverId || '',
        name: identity?.driverName || route?.assignedDriverName || identity?.driverId || '',
      },
      routeManifestId: route?.id || null,
      routeNumber: route?.routeNumber || null,
      routeDate: route?.routeDate || null,
      routeName: route?.routeName || null,
      routeStatus: route?.status || 'completed',
      totalStops: transactions.length,
      completedStops: transactions.length,
      transactions,
      totals,
      inventory,
      generatedAt,
    },
  };
}

export function buildZplDocument(document) {
  const payload = document?.payload || document || {};
  if (payload.documentType === 'route_closeout') {
    return buildZplRouteCloseout(document);
  }
  if (payload.documentType === 'final_inventory_closeout') {
    return buildZplFinalInventoryCloseout(document);
  }
  if (payload.documentType === 'departure_inventory') {
    return buildZplDepartureInventory(document);
  }
  const isReceipt = payload.documentType === 'receipt';
  const items = Array.isArray(payload.items) ? payload.items : [];
  const signatureExtra = isReceipt
    ? (payload.customerSignature ? 180 : 30) + (payload.driverSignature ? 180 : 30)
    : 0;
  const labelLength = Math.max(1800, 720 + (items.length * 125) + signatureExtra);
  let y = 30;
  const commands = [
    '^XA',
    '^PW800',
    `^LL${labelLength}`,
    '^CI28',
    `^FO25,20^A0N,31,31^FB750,2,0,C^FD${safe(ORGANIZATION_NAME)}^FS`,
    '^FO25,58^A0N,26,26^FB750,2,0,C^FDTRUCK-SAFE ROUTING^FS',
  ];
  y = 112;
  commands.push(line(y, `Driver: ${payload.driver?.name || ''}`, `ID: ${payload.driver?.id || ''}`));
  y += 38;
  commands.push(line(y, isReceipt ? 'FINAL RECEIPT' : 'DELIVERY ORDER', document?.documentNumber || ''));
  y += 42;
  commands.push(line(y, `Account: ${payload.customer?.accountNumber || ''}`));
  y += 34;
  commands.push(line(y, payload.customer?.accountName || 'Customer'));
  y += 34;
  commands.push(line(y, payload.customer?.address || ''));
  y += 34;
  commands.push(line(y, `Invoice: ${payload.invoiceNumber || ''}`, `Route: ${payload.routeNumber || ''}`));
  y += 42;
  commands.push('^FO25,' + y + '^GB750,2,2^FS');
  y += 18;
  commands.push(line(y, 'Product / disposition', 'Amount'));
  y += 38;

  items.forEach((item) => {
    const quantity = isReceipt
      ? Number(item.deliveredQuantity || 0) + Number(item.addedQuantity || 0)
      : Number(item.plannedQuantity || 0);
    const amount = quantity * Number(item.unitPrice || 0);
    commands.push(line(y, `ID: ${productId(item)}`, `$${money(amount)}`));
    y += 32;
    commands.push(`^FO45,${y}^A0N,21,21^FB680,2,0,L^FD${safe(`${quantity} x ${item.productName || productId(item) || 'Product'}`)}^FS`);
    y += 34;
    if (isReceipt) {
      const disposition = [
        `Delivered ${Number(item.deliveredQuantity || 0)}`,
        item.addedQuantity ? `Added ${item.addedQuantity}` : '',
        item.rejectedQuantity ? `Rejected ${item.rejectedQuantity}` : '',
        item.damagedQuantity ? `Damaged ${item.damagedQuantity}` : '',
        item.returnedQuantity ? `Returned ${item.returnedQuantity}` : '',
        item.missingQuantity ? `Missing ${item.missingQuantity}` : '',
      ].filter(Boolean).join(' | ');
      if (disposition) {
        commands.push(`^FO45,${y}^A0N,21,21^FD${safe(disposition)}^FS`);
        y += 28;
      }
    }
  });

  commands.push('^FO25,' + y + '^GB750,2,2^FS');
  y += 18;
  commands.push(line(y, 'Subtotal', `$${money(payload.subtotalAmount)}`));
  y += 32;
  commands.push(line(y, 'Tax', `$${money(payload.taxAmount)}`));
  y += 32;
  commands.push(line(y, 'Total', `$${money(payload.totalAmount)}`));
  y += 36;
  if (isReceipt) {
    commands.push(line(y, `Payment: ${paymentLabel(payload.paymentMethod)}`));
    y += 32;
    commands.push(line(y, 'Amount paid', `$${money(payload.amountPaid)}`));
    y += 32;
    commands.push(line(y, 'Unpaid balance', `$${money(payload.unpaidBalance)}`));
    y += 42;
    const customerSignature = signatureGraphicZpl(y, 'Customer signature', payload.customerSignature);
    commands.push(...customerSignature.commands);
    y += customerSignature.height;
    const driverSignature = signatureGraphicZpl(y, 'Driver signature', payload.driverSignature);
    commands.push(...driverSignature.commands);
    y += driverSignature.height + 8;
  }
  commands.push(line(y, `Printed: ${new Date(payload.generatedAt || Date.now()).toLocaleString()}`));
  y += 48;
  commands.push(`^FO25,${y}^A0N,21,21^FB750,2,0,C^FDCustomer copy - retain for your records^FS`);
  commands.push('^XZ');
  return commands.join('');
}

export function buildZplRouteCloseout(document) {
  const payload = document?.payload || document || {};
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  const totals = payload.totals || {};
  const inventory = payload.inventory || {};
  const labelLength = Math.max(2100, 1120 + (transactions.length * 95));
  let y = 30;
  const commands = [
    '^XA',
    '^PW800',
    `^LL${labelLength}`,
    '^CI28',
    `^FO25,20^A0N,31,31^FB750,2,0,C^FD${safe(ORGANIZATION_NAME)}^FS`,
    '^FO25,58^A0N,26,26^FB750,2,0,C^FDTRUCK-SAFE ROUTING^FS',
  ];
  y = 112;
  commands.push(line(y, 'ROUTE TURN-IN RECEIPT', document?.documentNumber || ''));
  y += 38;
  commands.push(line(y, `Driver: ${payload.driver?.name || ''}`, `ID: ${payload.driver?.id || ''}`));
  y += 34;
  commands.push(line(y, `Route: ${payload.routeNumber || ''}`, `Date: ${payload.routeDate || ''}`));
  y += 38;
  commands.push('^FO25,' + y + '^GB750,2,2^FS');
  y += 18;
  commands.push(line(y, 'ACCOUNT TRANSACTIONS', 'TOTAL'));
  y += 36;
  transactions.forEach((transaction) => {
    commands.push(line(
      y,
      `${transaction.stopSequence}. ${transaction.accountName || transaction.accountNumber || 'Account'}`,
      `$${money(transaction.totalAmount)}`
    ));
    y += 30;
    commands.push(`^FO45,${y}^A0N,20,20^FD${safe(
      `${paymentLabel(transaction.paymentMethod)} | Paid $${money(transaction.amountPaid)} | Due $${money(transaction.unpaidBalance)}`
    )}^FS`);
    y += 28;
  });
  commands.push('^FO25,' + y + '^GB750,2,2^FS');
  y += 18;
  commands.push(line(y, 'Sales subtotal', `$${money(totals.subtotalAmount)}`));
  y += 30;
  commands.push(line(y, 'Tax', `$${money(totals.taxAmount)}`));
  y += 30;
  commands.push(line(y, 'Route sales total', `$${money(totals.totalAmount)}`));
  y += 30;
  commands.push(line(y, 'Cash turn-in', `$${money(totals.cashAmount)}`));
  y += 30;
  commands.push(line(y, 'Checks turn-in', `$${money(totals.checkAmount)}`));
  y += 30;
  commands.push(line(y, 'Card payments', `$${money(totals.cardAmount)}`));
  y += 30;
  commands.push(line(y, 'Partial payments', `$${money(totals.partialPaymentAmount)}`));
  y += 30;
  commands.push(line(y, 'Credit account sales', `$${money(totals.creditAccountAmount)}`));
  y += 30;
  commands.push(line(y, 'Total collected', `$${money(totals.amountPaid)}`));
  y += 30;
  commands.push(line(y, 'Unpaid balance', `$${money(totals.unpaidBalance)}`));
  y += 40;
  commands.push('^FO25,' + y + '^GB750,2,2^FS');
  y += 18;
  commands.push(line(y, 'INVENTORY RECONCILIATION'));
  y += 32;
  commands.push(line(y, 'Loaded', inventory.plannedQuantity || 0));
  y += 28;
  commands.push(line(y, 'Sold / delivered', inventory.deliveredQuantity || 0));
  y += 28;
  commands.push(line(y, 'Rejected', inventory.rejectedQuantity || 0));
  y += 28;
  commands.push(line(y, 'Returned', inventory.returnedQuantity || 0));
  y += 28;
  commands.push(line(y, 'Damaged', inventory.damagedQuantity || 0));
  y += 28;
  commands.push(line(y, 'Missing', inventory.missingQuantity || 0));
  y += 28;
  commands.push(line(y, 'Added', inventory.addedQuantity || 0));
  y += 28;
  commands.push(line(y, 'Unaccounted', inventory.unaccountedQuantity || 0));
  y += 40;
  commands.push(line(y, `Closed: ${new Date(payload.generatedAt || Date.now()).toLocaleString()}`));
  y += 42;
  commands.push(`^FO25,${y}^A0N,22,22^FB750,2,0,C^FDWarehouse turn-in copy - retain for 14 days^FS`);
  commands.push('^XZ');
  return commands.join('');
}

export function buildZplFinalInventoryCloseout(document) {
  const payload = document?.payload || document || {};
  const inventory = payload.inventory || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const labelLength = Math.max(1400, 900 + (items.length * 118));
  const commands = [
    '^XA',
    '^PW800',
    `^LL${labelLength}`,
    '^CI28',
    `^FO25,20^A0N,31,31^FB750,2,0,C^FD${safe(ORGANIZATION_NAME)}^FS`,
    '^FO25,58^A0N,25,25^FB750,2,0,C^FDFINAL INVENTORY INSPECTION CLOSEOUT^FS',
  ];
  let y = 112;
  commands.push(line(y, `Driver: ${payload.driver?.name || ''}`, `ID: ${payload.driver?.id || ''}`));
  y += 34;
  commands.push(line(y, `Warehouse: ${payload.warehouseEmployee?.name || ''}`, `ID: ${payload.warehouseEmployee?.id || ''}`));
  y += 34;
  commands.push(line(y, `Route: ${payload.routeNumber || ''}`, `Date: ${payload.routeDate || ''}`));
  y += 34;
  commands.push(line(y, 'Document', document?.documentNumber || ''));
  y += 40;
  commands.push('^FO25,' + y + '^GB750,2,2^FS');
  y += 18;
  commands.push(line(y, 'FINAL INSPECTED INVENTORY'));
  y += 34;
  commands.push(line(y, 'Loaded', inventory.loadedQuantity || 0));
  y += 30;
  commands.push(line(y, 'Delivered', inventory.deliveredQuantity || 0));
  y += 30;
  commands.push(line(y, 'Remaining sellable', inventory.sellableQuantity || 0));
  y += 30;
  commands.push(line(y, 'Customer returns', inventory.returnedQuantity || 0));
  y += 30;
  commands.push(line(y, 'Damaged', inventory.damagedQuantity || 0));
  y += 30;
  commands.push(line(y, 'Missing / unaccounted', inventory.missingQuantity || inventory.unaccountedQuantity || 0));
  y += 30;
  commands.push(line(y, 'Added', inventory.addedQuantity || 0));
  y += 30;
  commands.push(line(y, 'Rejected', inventory.rejectedQuantity || 0));
  y += 42;
  commands.push('^FO25,' + y + '^GB750,2,2^FS');
  y += 18;
  commands.push(line(y, 'ITEMIZED RETURN INSPECTION'));
  y += 34;
  items.forEach((item) => {
    commands.push(`^FO25,${y}^A0N,22,22^FB520,1,0,L^FD${safe(item.productName || item.sku || 'Product')}^FS`);
    commands.push(`^FO550,${y}^A0N,20,20^FB225,1,0,R^FDSKU ${safe(item.sku || '-')}^FS`);
    y += 28;
    commands.push(line(
      y,
      `Expected ${item.expectedReturnQuantity || 0}`,
      `Whole ${item.sellableQuantity || 0}`
    ));
    y += 26;
    commands.push(line(
      y,
      `Returns ${item.returnedQuantity || 0}`,
      `Damaged ${item.damagedQuantity || 0}`
    ));
    y += 26;
    commands.push(line(
      y,
      `Rejected ${item.rejectedQuantity || 0}`,
      `Difference ${item.discrepancyQuantity || 0}`
    ));
    y += 34;
  });
  commands.push('^FO25,' + y + '^GB750,2,2^FS');
  y += 18;
  const discrepancyQuantity = Number(inventory.discrepancyQuantity || 0);
  const discrepancyItemCount = Number(inventory.discrepancyItemCount || 0);
  if (discrepancyItemCount > 0 || Math.abs(discrepancyQuantity) >= 0.001) {
    const discrepancyType = inventory.discrepancyStatus === 'mixed'
      ? 'MIXED'
      : (discrepancyQuantity > 0 ? 'SHORTAGE' : 'OVERAGE');
    commands.push(`^FO25,${y}^GB750,64,64^FS`);
    commands.push(`^FO35,${y + 17}^A0N,27,27^FB730,1,0,C^FR^FDDISCREPANCY: ${safe(discrepancyItemCount)} SKU | ${discrepancyType} ${safe(discrepancyQuantity)}^FS`);
    y += 82;
  } else {
    commands.push(`^FO25,${y}^A0N,27,27^FB750,1,0,C^FDINVENTORY BALANCED^FS`);
    y += 48;
  }
  commands.push(line(y, `Planned start: ${payload.plannedStartAt || ''}`));
  y += 34;
  commands.push(line(y, `Print requested: ${payload.printRequestedAt || ''}`));
  y += 42;
  commands.push(`^FO25,${y}^A0N,21,21^FB750,3,0,L^FD${safe(`Notes: ${payload.notes || 'None'}`)}^FS`);
  y += 82;
  commands.push(`^FO25,${y}^A0N,22,22^FB750,2,0,C^FDZebra-confirmed driver closeout - supervisor review pending^FS`);
  commands.push('^XZ');
  return commands.join('');
}

export function buildZplDepartureInventory(document) {
  const payload = document?.payload || document || {};
  const items = Array.isArray(payload.inventory) ? payload.inventory : [];
  const labelLength = Math.max(1200, 470 + (items.length * 92));
  const commands = [
    '^XA',
    '^PW800',
    `^LL${labelLength}`,
    '^CI28',
    `^FO25,20^A0N,31,31^FB750,2,0,C^FD${safe(ORGANIZATION_NAME)}^FS`,
    '^FO25,58^A0N,25,25^FB750,2,0,C^FDROUTE DEPARTURE INVENTORY^FS',
  ];
  let y = 112;
  commands.push(line(y, `Route: ${payload.routeNumber || ''}`, `Date: ${payload.routeDate || ''}`));
  y += 34;
  commands.push(line(y, `Driver: ${payload.driverName || ''}`, `ID: ${payload.driverId || ''}`));
  y += 34;
  commands.push(line(y, `Warehouse: ${payload.warehouseEmployeeName || ''}`, `ID: ${payload.warehouseEmployeeId || ''}`));
  y += 40;
  commands.push('^FO25,' + y + '^GB750,2,2^FS');
  y += 18;
  commands.push(line(y, 'PRODUCT INVENTORY'));
  y += 34;
  items.forEach((item) => {
    commands.push(`^FO25,${y}^A0N,23,23^FB500,2,0,L^FD${safe(item.productName || item.sku || 'Product')}^FS`);
    commands.push(`^FO540,${y}^A0N,23,23^FB235,1,0,R^FDLoaded ${safe(Number(item.plannedQuantity || 0) + Number(item.addedQuantity || 0))}^FS`);
    y += 30;
    commands.push(`^FO25,${y}^A0N,19,19^FB750,2,0,L^FDSKU ${safe(item.sku || '-')} | Barcode ${safe((item.barcodes || []).join(', ') || '-')}^FS`);
    y += 55;
  });
  commands.push('^FO25,' + y + '^GB750,2,2^FS');
  y += 20;
  commands.push(line(y, `Confirmed: ${payload.confirmedAt || payload.generatedAt || ''}`));
  y += 42;
  commands.push(`^FO25,${y}^A0N,22,22^FB750,2,0,C^FDWarehouse departure copy - turn in before leaving^FS`);
  commands.push('^XZ');
  return commands.join('');
}

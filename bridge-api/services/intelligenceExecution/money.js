function parseUsdToMicros(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(text)) return null;
  const [whole, fractional = ''] = text.split('.');
  return (BigInt(whole) * 1000000n) + BigInt(fractional.padEnd(6, '0'));
}

function microsToUsdString(value) {
  if (value === null || value === undefined) return null;
  const micros = typeof value === 'bigint' ? value : BigInt(value);
  const whole = micros / 1000000n;
  const fractional = String(micros % 1000000n).padStart(6, '0');
  return `${whole}.${fractional}`;
}

function compareMicros(left, right) {
  if (left === null || left === undefined || right === null || right === undefined) return null;
  const a = typeof left === 'bigint' ? left : BigInt(left);
  const b = typeof right === 'bigint' ? right : BigInt(right);
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

module.exports = {
  compareMicros,
  microsToUsdString,
  parseUsdToMicros
};

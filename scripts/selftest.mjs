// Uji cepat logika subtitle (tanpa browser): node --experimental-strip-types scripts/selftest.mjs
import assert from 'node:assert/strict';
const { parseClock, fmtClock, stampSrt, stampAss } = await import('../app/lib/time.ts');
assert.equal(parseClock('1:05.4'), 65.4);
assert.equal(parseClock('0:00:03,25'), 3.25);
assert.equal(parseClock('abc'), null);
assert.equal(fmtClock(65.432), '01:05.432');
assert.equal(stampSrt(3725.5), '01:02:05,500');
assert.equal(stampAss(3.256), '0:00:03.25');
console.log('✓ time');

/**
 * CPython random.Random, so a fight can use the same seed as sim/eng4.py.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PyRandom = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const N = 624;
  const M = 397;
  const MATRIX_A = 0x9908b0df;
  const UPPER = 0x80000000;
  const LOWER = 0x7fffffff;

  function u32(n) {
    return n >>> 0;
  }

  function Random(seed) {
    this.mt = new Uint32Array(N);
    this.mti = N + 1;
    this.seed(seed == null ? 0 : seed);
  }

  Random.prototype.initGenrand = function (seed) {
    this.mt[0] = u32(seed);
    for (let i = 1; i < N; i++) {
      const prev = this.mt[i - 1];
      this.mt[i] = u32(Math.imul(1812433253, prev ^ (prev >>> 30)) + i);
    }
    this.mti = N;
  };

  Random.prototype.initByArray = function (key) {
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    let k = Math.max(N, key.length);
    for (; k; k--) {
      const prev = this.mt[i - 1];
      this.mt[i] = u32((this.mt[i] ^ Math.imul(prev ^ (prev >>> 30), 1664525)) + key[j] + j);
      i += 1;
      j += 1;
      if (i >= N) { this.mt[0] = this.mt[N - 1]; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (k = N - 1; k; k--) {
      const prev = this.mt[i - 1];
      this.mt[i] = u32((this.mt[i] ^ Math.imul(prev ^ (prev >>> 30), 1566083941)) - i);
      i += 1;
      if (i >= N) { this.mt[0] = this.mt[N - 1]; i = 1; }
    }
    this.mt[0] = UPPER;
  };

  Random.prototype.seed = function (a) {
    let n = typeof a === 'bigint' ? a : BigInt(a);
    if (n < 0n) n = -n;
    const key = [];
    if (n === 0n) key.push(0);
    while (n > 0n) {
      key.push(Number(n & 0xffffffffn));
      n >>= 32n;
    }
    this.initByArray(key);
  };

  Random.prototype.genrandInt32 = function () {
    let y;
    if (this.mti >= N) {
      for (let kk = 0; kk < N - M; kk++) {
        y = (this.mt[kk] & UPPER) | (this.mt[kk + 1] & LOWER);
        this.mt[kk] = this.mt[kk + M] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0);
      }
      for (let kk = N - M; kk < N - 1; kk++) {
        y = (this.mt[kk] & UPPER) | (this.mt[kk + 1] & LOWER);
        this.mt[kk] = this.mt[kk + (M - N)] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0);
      }
      y = (this.mt[N - 1] & UPPER) | (this.mt[0] & LOWER);
      this.mt[N - 1] = this.mt[M - 1] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0);
      this.mti = 0;
    }
    y = this.mt[this.mti++];
    y ^= (y >>> 11);
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= (y >>> 18);
    return u32(y);
  };

  Random.prototype.getrandbits = function (k) {
    if (k <= 32) return this.genrandInt32() >>> (32 - k);
    let out = 0n;
    let left = k;
    while (left > 0) {
      const take = left > 32 ? 32 : left;
      out = (out << BigInt(take)) | BigInt(this.genrandInt32() >>> (32 - take));
      left -= take;
    }
    return out;
  };

  Random.prototype.random = function () {
    const a = this.getrandbits(32) >>> 5;
    const b = this.getrandbits(32) >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  };

  Random.prototype.randbelow = function (n) {
    if (n <= 1) return 0;
    const bits = 32 - Math.clz32(n);
    let v = this.getrandbits(bits);
    while (v >= n) v = this.getrandbits(bits);
    return v;
  };

  Random.prototype.choice = function (seq) {
    return seq[this.randbelow(seq.length)];
  };

  Random.prototype.uniform = function (a, b) {
    return a + (b - a) * this.random();
  };

  return { Random };
});

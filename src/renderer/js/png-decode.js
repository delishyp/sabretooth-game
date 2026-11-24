/**
 * Minimal PNG decode for the appearance preview and its tests.
 * Accepts 8-bit non-interlaced grayscale (color type 0) and RGBA (color type 6) only.
 * Grayscale stays one luminance channel here; toRgbaImage() expands it the way a canvas
 * would: R=G=B=L and A=255. That opaque alpha is not coverage. Callers must use L.
 * UMD so node tests and the Electron preview share one decoder.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PngDecode = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  function readU32(u8, o) {
    return ((u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3]) >>> 0;
  }

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  function unfilter(inflated, width, height, bpp) {
    const stride = width * bpp;
    const rowBytes = stride + 1;
    if (inflated.length !== height * rowBytes) throw new Error('png inflated size does not match the header');
    const out = new Uint8Array(height * stride);
    for (let y = 0; y < height; y++) {
      const filter = inflated[y * rowBytes];
      const src = y * rowBytes + 1;
      const dst = y * stride;
      const prev = y > 0 ? dst - stride : -1;
      for (let x = 0; x < stride; x++) {
        const raw = inflated[src + x];
        const left = x >= bpp ? out[dst + x - bpp] : 0;
        const up = prev >= 0 ? out[prev + x] : 0;
        const ul = prev >= 0 && x >= bpp ? out[prev + x - bpp] : 0;
        let v = raw;
        if (filter === 1) v = raw + left;
        else if (filter === 2) v = raw + up;
        else if (filter === 3) v = raw + Math.floor((left + up) / 2);
        else if (filter === 4) v = raw + paeth(left, up, ul);
        else if (filter !== 0) throw new Error('unsupported png filter ' + filter);
        out[dst + x] = v & 255;
      }
    }
    return out;
  }

  async function inflate(bytes) {
    if (typeof DecompressionStream === 'function') {
      const copy = new Uint8Array(bytes);
      const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return new Uint8Array(require('zlib').inflateSync(Buffer.from(bytes)));
  }

  /** @returns {Promise<{width,height,bitDepth,colorType,mode,channels,data:Uint8Array}>} */
  async function decode(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8.length < 8 || !SIG.every((b, i) => u8[i] === b)) throw new Error('not a png');
    let width = 0, height = 0, bitDepth = 0, colorType = -1, seen = false;
    const idats = [];
    let o = 8;
    while (o + 8 <= u8.length) {
      const len = readU32(u8, o);
      const type = String.fromCharCode(u8[o + 4], u8[o + 5], u8[o + 6], u8[o + 7]);
      const start = o + 8;
      const end = start + len;
      if (end + 4 > u8.length) throw new Error('truncated png chunk ' + type);
      const chunk = u8.subarray(start, end);
      if (type === 'IHDR') {
        width = readU32(chunk, 0); height = readU32(chunk, 4);
        bitDepth = chunk[8]; colorType = chunk[9];
        if (chunk[10] !== 0 || chunk[11] !== 0) throw new Error('unsupported png compression');
        if (chunk[12] !== 0) throw new Error('interlaced png rejected');
        if (bitDepth !== 8) throw new Error('only 8-bit png is accepted');
        if (colorType !== 0 && colorType !== 6) throw new Error('only grayscale or RGBA png is accepted');
        seen = true;
      } else if (type === 'IDAT') idats.push(chunk);
      else if (type === 'IEND') break;
      o = end + 4;
    }
    if (!seen || !idats.length) throw new Error('png missing IHDR or IDAT');
    let total = 0;
    for (const c of idats) total += c.length;
    const z = new Uint8Array(total);
    let p = 0;
    for (const c of idats) { z.set(c, p); p += c.length; }
    const channels = colorType === 6 ? 4 : 1;
    const data = unfilter(await inflate(z), width, height, channels);
    return { width, height, bitDepth, colorType, mode: colorType === 6 ? 'RGBA' : 'L', channels, data };
  }

  /** Canvas-style expansion. Grayscale alpha is 255 for every pixel; coverage is still R (the luminance). */
  function toRgbaImage(decoded) {
    const { width, height, colorType, data } = decoded;
    if (colorType === 6) return { width, height, data: new Uint8ClampedArray(data) };
    if (colorType !== 0) throw new Error('unsupported color type ' + colorType);
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, p = 0; i < data.length; i++, p += 4) {
      const L = data[i];
      rgba[p] = L; rgba[p + 1] = L; rgba[p + 2] = L; rgba[p + 3] = 255;
    }
    return { width, height, data: rgba };
  }

  return { decode, toRgbaImage };
});

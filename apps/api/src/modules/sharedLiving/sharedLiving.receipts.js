const zlib = require("zlib");
const v = require("./sharedLiving.validator");

// A small, bounded PNG subset: RGB/RGBA, 8-bit, non-interlaced. Metadata is rejected.
// No client filenames, SVG, HTML, remote URLs, or executable payloads are stored.
const png = (buffer) => {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 45 ||
    buffer.length > 524288 ||
    buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  )
    return v.invalid();
  let offset = 8,
    width,
    height,
    channels,
    ended = false;
  const chunks = [];
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) return v.invalid();
    const length = buffer.readUInt32BE(offset),
      type = buffer.toString("ascii", offset + 4, offset + 8);
    if (length > 524288 || offset + 12 + length > buffer.length)
      return v.invalid();
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      if (offset !== 8 || length !== 13) return v.invalid();
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
      if (
        !width ||
        !height ||
        width > 2048 ||
        height > 2048 ||
        !channels ||
        body[8] !== 8 ||
        body[10] ||
        body[11] ||
        body[12]
      )
        return v.invalid();
    } else if (type === "IDAT") chunks.push(body);
    else if (type === "IEND") {
      if (length || offset + 12 !== buffer.length) return v.invalid();
      ended = true;
    } else return v.invalid();
    // CRC over chunk type and payload, checking corruption before decompression.
    let crc = 0xffffffff;
    for (const byte of buffer.subarray(offset + 4, offset + 8 + length)) {
      crc ^= byte;
      for (let i = 0; i < 8; i++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if ((crc ^ 0xffffffff) >>> 0 !== buffer.readUInt32BE(offset + 8 + length))
      return v.invalid();
    offset += 12 + length;
  }
  if (!ended || !width || !chunks.length) return v.invalid();
  const expected = height * (1 + width * channels);
  let inflated;
  try {
    inflated = zlib.inflateSync(Buffer.concat(chunks), {
      maxOutputLength: expected,
    });
  } catch {
    return v.invalid();
  }
  if (inflated.length !== expected) return v.invalid();
  for (let i = 0; i < height; i++)
    if (inflated[i * (1 + width * channels)] > 4) return v.invalid();
  return buffer;
};
module.exports = { png };

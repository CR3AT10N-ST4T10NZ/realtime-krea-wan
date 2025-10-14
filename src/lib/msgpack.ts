// Built-in msgpack encoder for WebSocket communication
const textEncoder = new TextEncoder();

const ensureUint8Array = (value: any): Uint8Array =>
  value instanceof Uint8Array ? value : new Uint8Array(value);

const writeUInt8 = (buffer: number[], value: number) =>
  buffer.push(value & 0xff);

const writeUInt16 = (buffer: number[], value: number) => {
  buffer.push((value >>> 8) & 0xff, value & 0xff);
};

const writeUInt32 = (buffer: number[], value: number) => {
  buffer.push(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  );
};

const writeFloat64 = (buffer: number[], value: number) => {
  const array = new ArrayBuffer(8);
  new DataView(array).setFloat64(0, value);
  buffer.push(...new Uint8Array(array));
};

const encodeString = (buffer: number[], value: string) => {
  const utf8 = ensureUint8Array(textEncoder.encode(value));
  const length = utf8.length;
  if (length <= 31) {
    writeUInt8(buffer, 0xa0 | length);
  } else if (length <= 0xff) {
    writeUInt8(buffer, 0xd9);
    writeUInt8(buffer, length);
  } else if (length <= 0xffff) {
    writeUInt8(buffer, 0xda);
    writeUInt16(buffer, length);
  } else {
    writeUInt8(buffer, 0xdb);
    writeUInt32(buffer, length);
  }
  buffer.push(...utf8);
};

const encodeNumber = (buffer: number[], value: number) => {
  if (Number.isInteger(value)) {
    if (value >= 0 && value <= 0x7f) {
      writeUInt8(buffer, value);
    } else if (value < 0 && value >= -32) {
      buffer.push(value & 0xff);
    } else if (value >= 0 && value <= 0xff) {
      writeUInt8(buffer, 0xcc);
      writeUInt8(buffer, value);
    } else if (value >= 0 && value <= 0xffff) {
      writeUInt8(buffer, 0xcd);
      writeUInt16(buffer, value);
    } else if (value >= 0 && value <= 0xffffffff) {
      writeUInt8(buffer, 0xce);
      writeUInt32(buffer, value);
    } else {
      writeUInt8(buffer, 0xcb);
      writeFloat64(buffer, value);
    }
  } else {
    writeUInt8(buffer, 0xcb);
    writeFloat64(buffer, value);
  }
};

const encodeArray = (buffer: number[], value: any[]) => {
  const length = value.length;
  if (length < 16) {
    writeUInt8(buffer, 0x90 | length);
  } else if (length <= 0xffff) {
    writeUInt8(buffer, 0xdc);
    writeUInt16(buffer, length);
  } else {
    writeUInt8(buffer, 0xdd);
    writeUInt32(buffer, length);
  }
  value.forEach((item) => encodeValue(buffer, item));
};

const encodeObject = (buffer: number[], value: Record<string, any>) => {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  const length = entries.length;
  if (length < 16) {
    writeUInt8(buffer, 0x80 | length);
  } else if (length <= 0xffff) {
    writeUInt8(buffer, 0xde);
    writeUInt16(buffer, length);
  } else {
    writeUInt8(buffer, 0xdf);
    writeUInt32(buffer, length);
  }
  for (const [key, entryValue] of entries) {
    encodeString(buffer, key);
    encodeValue(buffer, entryValue);
  }
};

function encodeValue(buffer: number[], value: any): void {
  if (value === null) {
    writeUInt8(buffer, 0xc0);
  } else if (value === false) {
    writeUInt8(buffer, 0xc2);
  } else if (value === true) {
    writeUInt8(buffer, 0xc3);
  } else if (typeof value === "number") {
    encodeNumber(buffer, value);
  } else if (typeof value === "string") {
    encodeString(buffer, value);
  } else if (Array.isArray(value)) {
    encodeArray(buffer, value);
  } else if (value instanceof Uint8Array) {
    const length = value.length;
    if (length <= 0xff) {
      writeUInt8(buffer, 0xc4);
      writeUInt8(buffer, length);
    } else if (length <= 0xffff) {
      writeUInt8(buffer, 0xc5);
      writeUInt16(buffer, length);
    } else {
      writeUInt8(buffer, 0xc6);
      writeUInt32(buffer, length);
    }
    buffer.push(...value);
  } else if (value && typeof value === "object") {
    encodeObject(buffer, value);
  } else {
    throw new Error("Unsupported type for MsgPack encoding");
  }
}

export const msgpackEncode = (input: any): Uint8Array => {
  const buffer: number[] = [];
  encodeValue(buffer, input);
  return new Uint8Array(buffer);
};

/**
 * A minimal Borsh reader/writer covering exactly what AgentNS uses.
 *
 * Anchor serialises accounts and instruction arguments with Borsh, which differs
 * from Solana's bincode in two ways that matter here:
 *   - strings and vectors carry an explicit `u32` little-endian length prefix;
 *   - enums are a single `u8` discriminant, not a tagged union.
 *
 * Rather than reach for the generic codec combinators, these two small helpers
 * make the on-the-wire layout obvious and keep the account definitions below
 * readable against the Rust structs they mirror.
 */

import type { ReadonlyUint8Array } from "@solana/kit";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: false });

/** Sequential byte writer. Little-endian, matching Borsh on Solana. */
export class BorshWriter {
  private chunks: ReadonlyUint8Array[] = [];
  private length = 0;

  u8(value: number): this {
    return this.raw(Uint8Array.of(value & 0xff));
  }

  bool(value: boolean): this {
    return this.u8(value ? 1 : 0);
  }

  u16(value: number): this {
    const out = new Uint8Array(2);
    new DataView(out.buffer).setUint16(0, value, true);
    return this.raw(out);
  }

  u32(value: number): this {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value, true);
    return this.raw(out);
  }

  /** Borsh encodes integers as little-endian fixed-width, so u64 and i64 are 8 bytes. */
  u64(value: bigint): this {
    const out = new Uint8Array(8);
    new DataView(out.buffer).setBigUint64(0, value, true);
    return this.raw(out);
  }

  i64(value: bigint): this {
    const out = new Uint8Array(8);
    new DataView(out.buffer).setBigInt64(0, value, true);
    return this.raw(out);
  }

  /** A `u64`-prefixed Borsh string. */
  string(value: string): this {
    const bytes = textEncoder.encode(value);
    return this.u32(bytes.length).raw(bytes);
  }

  /** A fixed-length byte array such as `[u8; 32]`. */
  bytes(value: ReadonlyUint8Array): this {
    return this.raw(value);
  }

  /** Appends already-encoded bytes with no length prefix. */
  raw(value: ReadonlyUint8Array): this {
    this.chunks.push(value);
    this.length += value.length;
    return this;
  }

  toBytes(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

/** Sequential byte reader that throws rather than returning garbage. */
export class BorshReader {
  private view: DataView;
  private offset = 0;
  /** Named `buffer` rather than `bytes` so it does not shadow the `bytes()` reader. */
  private readonly buffer: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.buffer = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number {
    return this.buffer.length - this.offset;
  }

  private take(length: number): Uint8Array {
    if (this.offset + length > this.buffer.length) {
      throw new Error(
        `Unexpected end of account data: wanted ${length} bytes at offset ${this.offset}, have ${this.remaining}.`,
      );
    }
    const slice = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  u8(): number {
    return this.view.getUint8(this.take(1).byteOffset);
  }

  bool(): boolean {
    return this.u8() !== 0;
  }

  u16(): number {
    return this.view.getUint16(this.take(2).byteOffset, true);
  }

  u32(): number {
    return this.view.getUint32(this.take(4).byteOffset, true);
  }

  u64(): bigint {
    return this.view.getBigUint64(this.take(8).byteOffset, true);
  }

  i64(): bigint {
    return this.view.getBigInt64(this.take(8).byteOffset, true);
  }

  string(): string {
    const length = this.u32();
    return textDecoder.decode(this.take(length));
  }

  bytes(length: number): Uint8Array {
    return this.take(length);
  }

  /** Reads a `u32`-prefixed vector, calling `readItem` once per element. */
  vec<T>(readItem: (reader: BorshReader) => T): T[] {
    const length = this.u32();
    const items: T[] = [];
    for (let index = 0; index < length; index += 1) {
      items.push(readItem(this));
    }
    return items;
  }
}

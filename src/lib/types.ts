/* eslint-disable @typescript-eslint/ban-types */
import type { Readable } from "svelte/store";

/** Primitive to object utility converter. */
type ToObject<T> = T extends string
  ? String
  : T extends number
  ? Number
  : T extends bigint
  ? BigInt
  : T extends boolean
  ? Boolean
  : T;

/** An empty object. */
export type Empty = Record<never, never>;

/** A controlled promise wrapper. */
export type ExtendedPromise<T> = {
  state: "pending" | "adopted" | "resolved" | "rejected";
  resolve: (value: T | PromiseLike<T>) => void;
  adopt: (replacement: Promise<T>) => void;
  reject: (reason?: any) => void;
  signal: AbortSignal;
  value: Promise<T>;
};

/** A promise combined with your data type. */
export type RichPromise<T, U> = Promise<T> &
  (U extends null | undefined ? Empty : ToObject<U>);

/** A configurable dependency store. */
export type Store = Readable<any> | [Readable<any>, boolean];
/** A collection of dependency stores. */
export type Stores = Store | [...Array<Store>];
/** Values of dependency stores. */
export type StoresValues<Stores> = Stores extends Readable<infer U>
  ? [U]
  : Stores extends [Readable<infer U>, boolean]
  ? [U]
  : {
      [I in keyof Stores]: Stores[I] extends Readable<infer U>
        ? U
        : Stores[I] extends [Readable<infer U>, boolean]
        ? U
        : never;
    };
/** Awaiter values of dependency stores. */
export type AwaitedValues<S> = Awaited<{
  -readonly [P in keyof StoresValues<S>]: Awaited<StoresValues<S>[P]>;
}>;

/** Asynchronous getter function. */
export type Getter<T, S extends Stores> = (
  signal: AbortSignal,
  parents: AwaitedValues<S>
) => Promise<T> | T;
/** Asynchronous setter function. */
export type Setter<T, S extends Stores> = (
  signal: AbortSignal,
  [newValue, oldValue]: [T, T | undefined],
  parents: AwaitedValues<S>
) => Promise<T | void> | T | void;
/** Asynchronous updater function. */
export type Updater<T> = (value: T | undefined) => Promise<T | void> | T | void;

/** Asynchronous readable interface for subscribing. */
export interface AsyncReadable<T> extends Readable<RichPromise<T, T | Empty>> {
  /** Performs a full refresh. */
  update(this: void): Promise<void>;
}

/** Asynchronous writable interface for both updating and subscribing. */
export interface AsyncWritable<T> extends AsyncReadable<T> {
  /**
   * Set value and inform subscribers.
   * @param value to set
   */
  set(this: void, value: T): Promise<void>;
  /**
   * Update value using callback and inform subscribers.
   * Or perform a full refresh if no updater is specified.
   * @param updater callback
   */
  update(this: void, updater?: Updater<T | undefined>): Promise<void>;
}

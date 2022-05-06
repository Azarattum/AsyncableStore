import type { Readable } from "svelte/store";
import type {
  ExtendedPromise,
  RichPromise,
  Stores,
  Store,
  Empty,
} from "./types";

export function protoclone(source: any, overrides: Record<any, any>) {
  const proto = Object.getPrototypeOf(Object(source));
  const target = Object.create(proto);
  Object.setPrototypeOf(target, proto);

  for (const prop of Object.getOwnPropertyNames(proto)) {
    if (typeof source != "object") {
      const { value, get, set } =
        Object.getOwnPropertyDescriptor(proto, prop) || {};
      if (typeof value == "function") {
        Object.defineProperty(target, prop, { value: value.bind(source) });
      }
      if (get || set) {
        Object.defineProperty(target, prop, {
          get: get?.bind(source),
          set: set?.bind(source),
        });
      }
    }
  }

  const cloned = { ...overrides };
  Object.setPrototypeOf(cloned, target);
  return cloned;
}

export function enrich<T, U = Empty>(promise: Promise<T>, data?: U) {
  const enriched = Object.create(null);
  if (typeof data === "object") Object.assign(enriched, data);

  const warn = () => {
    console.warn(
      `Trying to access an empty object!` +
        ` Maybe you forgot a 'ready($data)' check?`
    );
    return "[object Empty]";
  };

  const overrides = {
    [Symbol.toPrimitive]: () => data,
    valueOf: () => (data as any)?.valueOf?.() || data,
    toString: () => (data == null ? warn() : String(data)),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };

  const proto = protoclone(data, overrides);
  Object.setPrototypeOf(enriched, proto);
  return enriched as RichPromise<T, U>;
}

export function parse(dependencies: Stores) {
  if (!Array.isArray(dependencies)) {
    dependencies = [dependencies];
  }
  if (typeof dependencies[1] == "boolean") {
    dependencies = [dependencies] as Stores;
  }

  const stores: Readable<any>[] = [];
  const reflections: { update: () => Promise<void> | void }[] = [];
  for (const dependency of dependencies as Store[]) {
    let store = dependency as Readable<any>;
    let reflect = false;
    if (Array.isArray(dependency)) [store, reflect] = dependency;

    stores.push(store);
    if (reflect && typeof (store as any).update === "function") {
      reflections.push(store as any);
    }
  }

  return { stores, reflections };
}

export function promise<T>(pending = true) {
  const controller = new AbortController();
  const promise = {
    state: pending ? "pending" : "resolved",
    signal: controller.signal,
  } as ExtendedPromise<T>;

  promise.value = new Promise<T>((resolve, reject) => {
    promise.resolve = resolve;
    promise.reject = reject;
  });

  promise.adopt = (replacement) => {
    controller.abort();
    replacement.then(promise.resolve, promise.reject);
    promise.reject = () => {};
    promise.resolve = () => {};
    if (promise.state === "pending") promise.state = "adopted";
  };

  promise.value.then(
    () => (promise.state = "resolved"),
    () => (promise.state = "rejected")
  );

  return promise;
}

export function ready<T, U>(
  data: RichPromise<T, U | Empty>
): data is RichPromise<T, U> {
  return data.valueOf() != null;
}

// Make a diff function to compare changes (created, modified, deleted, rearranged)
// export function diff(new, old, key) {
//
// }

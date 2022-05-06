import { enrich, parse, promise, ready } from "./utils";
import { get, derived, writable } from "svelte/store";
import type {
  AsyncReadable,
  AsyncWritable,
  AwaitedValues,
  RichPromise,
  Updater,
  Stores,
  Getter,
  Setter,
  Empty,
} from "./types";

function asyncable<T, S extends Stores>(
  stores: S,
  getter: Getter<T, S>,
  setter: Setter<T, S>
): AsyncWritable<T>;
function asyncable<T, S extends Stores>(
  stores: S,
  getter: Getter<T, S>
): AsyncReadable<T>;
function asyncable<T>(
  getter: Getter<T, []>,
  setter: Setter<T, []>
): AsyncWritable<T>;
function asyncable<T>(getter: Getter<T, []>): AsyncReadable<T>;
function asyncable<T, S extends Stores>(a: any, b?: any, c?: any) {
  const getter = (typeof a == "function" ? a : b) as Getter<T, S>;
  const setter = (typeof a == "function" ? b : c) as Setter<T, S> | undefined;
  const dependencies = typeof a == "function" ? [] : a;
  const { stores, reflections } = parse(dependencies);

  //Internal state
  let parents: AwaitedValues<S> | undefined;
  let setting = promise<T>(false);
  let getting = promise<T>();
  let value: T | undefined;

  const initial = enrich(getting.value);
  const listener = derived(stores, (x) => x);

  const refresh = async (values?: any[]) => {
    if (setting.state === "pending") return setting.value;

    if (!values) {
      values = parents || get(listener);
      parents = undefined;
    }

    const loader = promise<T>();
    try {
      if (getting.state === "pending") getting.adopt(loader.value);
      else store.set(enrich(loader.value, value));
      getting = loader;

      const awaited = (await Promise.all(values)) as AwaitedValues<S>;
      if (loader.state === "adopted") return loader.value;

      if (JSON.stringify(awaited) !== JSON.stringify(parents)) {
        const updated = await getter(loader.signal, awaited);
        if ((loader.state as any) === "adopted") return loader.value;
        parents = awaited;
        if (updated !== value) {
          value = updated;
          store.set(enrich(loader.value, value));
        }
      }
      loader.resolve(value as T);
    } catch (error) {
      loader.reject(error);
    }
  };

  const store = writable<RichPromise<T, T | Empty>>(initial, () =>
    listener.subscribe(refresh)
  );

  const set = async (updated: T) => {
    if (updated === value) return;
    const loader = promise<T>();
    if (getting.state === "pending") getting.adopt(loader.value);
    if (setting.state === "pending") setting.adopt(loader.value);
    setting = loader;

    //Optimistic update
    const previous = value;
    value = updated;
    store.set(enrich(Promise.resolve(value), value));

    try {
      if (!parents) {
        parents = (await Promise.all(get(listener))) as AwaitedValues<S>;
        if (loader.state === "adopted") return loader.value;
      }
      const data = await setter?.(loader.signal, [value, previous], parents);
      if (loader.state === "adopted") return loader.value;
      //Canonical update
      if (data != null && value !== data) {
        value = data;
        store.set(enrich(Promise.resolve(value), value));
      }
      //Reflect changes
      if (JSON.stringify(value) != JSON.stringify(previous)) {
        reflections.map((x) => x.update());
      }
    } catch (error) {
      //Revert optimistic update
      value = previous;
      store.set(enrich(getting.value, value));
      throw error;
    } finally {
      loader.resolve(value as T);
    }
  };

  const update = async (updater?: Updater<T>) => {
    if (!updater) return refresh();
    if (!setter) return;
    const updated = await updater(value);
    if (updated != null) await set(updated);
  };

  if (!setter) return { subscribe: store.subscribe, update };
  else return { subscribe: store.subscribe, set, update };
}

export { asyncable, ready }; //+export diff (from utils)
export type {
  AsyncReadable,
  AsyncWritable,
  RichPromise,
  Updater,
  Getter,
  Setter,
  Stores,
};

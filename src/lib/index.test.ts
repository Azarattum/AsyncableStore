import { get, writable } from "svelte/store";
import { asyncable, ready } from "./index";

function mock<T>(data: T, time = 0) {
  let calls = 0;
  return jest.fn<Promise<T extends Array<infer U> ? U : T>, []>(async () => {
    if (time) await new Promise((r) => setTimeout(r, time));
    if (Array.isArray(data)) return data[calls++];
    return data;
  });
}

describe("asyncable", () => {
  it("simple read", async () => {
    const getter = mock("test");
    const store = asyncable(getter);

    expect(getter).not.toBeCalled();
    const promise = get(store);

    //Loading
    expect(!ready(promise));
    expect(promise).not.toBeInstanceOf(String);

    //Ready
    const data = await promise;
    expect(getter).toBeCalled();
    expect(typeof data).toBe("string");
    expect(data).toBe("test");

    //Cached
    const updated = get(store) as any;
    expect(updated).toBeInstanceOf(String);
    expect(ready(updated));
    expect(updated.slice()).toBe("test");
    expect(updated.toString()).toBe("test");

    //Refresh
    expect(getter).toBeCalledTimes(1);
    await store.update();
    expect(getter).toBeCalledTimes(2);
    //Value updates should have no effect
    await (store.update as any)(() => "1");
    expect(getter).toBeCalledTimes(2);
    expect(get(store).toString()).toBe("test");
  });

  it("readable dependencies", async () => {
    const getter = jest.fn((_: any, [a, b]: number[]) => a + b);
    const store1 = writable(1);
    const store2 = writable(2);

    const calc = asyncable([store1, store2], getter);
    //Testing a simple race condition
    expect(!ready(get(calc)));
    expect(await get(calc)).toBe(3);
    expect(getter).toBeCalledTimes(1);

    store1.set(3);
    expect(await get(calc)).toBe(5);
    store2.set(8);
    expect(await get(calc)).toBe(11);

    expect(getter).toBeCalledTimes(3);

    let times = 0;
    const subscriber = jest.fn(async (value) => {
      switch (times++) {
        case 0:
          expect(+value).toBe(11);
          expect(await value).toBe(8);
          break;
        case 1:
          expect(+value).toBe(8);
          expect(await value).toBe(8);
          break;
        case 2:
          expect(+value).toBe(8);
          expect(await value).toBe(7);
          break;
        case 3:
          expect(+value).toBe(7);
          expect(await value).toBe(7);
          break;
      }
    });
    const unsubscribe = calc.subscribe(subscriber); // Promise(8), 11
    expect(+get(calc)).toBe(11);
    store1.set(0); // Promise(8), 11
    expect(await get(calc)).toBe(8);
    store2.set(1); // Promise(7), 8
    store1.set(1);
    store2.set(2);
    store1.set(3);
    store2.set(4); // Promise(7), 7
    await new Promise((r) => setTimeout(r, 1));

    expect(subscriber).toBeCalledTimes(4);
    expect(getter).toBeCalledTimes(5);
    unsubscribe();
  });

  it("premature set", async () => {
    const loader = jest.fn();
    const dependency = writable(0, loader);
    const getter = mock("test");
    const setter = mock("test3");
    const store = asyncable(dependency, getter, setter);

    expect(loader).not.toBeCalled();
    await store.set("test2");
    expect(loader).toBeCalled();
    expect(setter).toBeCalled();
    expect(getter).not.toBeCalled();

    expect(await get(store)).toBe("test3");
    expect(getter).not.toBeCalled();

    dependency.set(1);
    expect(get(store).toString()).toBe("test3");
    expect(await get(store)).toBe("test");
    expect(get(store).toString()).toBe("test");
    expect(getter).toBeCalledTimes(1);
  });

  it("asynchronous dependencies", async () => {
    const syncDep = writable(1);
    const asyncDep = asyncable(
      () => 2,
      () => {}
    );

    const store = asyncable([syncDep, asyncDep], (_, [a, b]) => a + b);
    expect(await get(store)).toBe(3);
    syncDep.set(3);
    expect(await get(store)).toBe(5);
    await asyncDep.set(5);
    expect(await get(store)).toBe(8);

    asyncDep.set(6);
    const counter = jest.fn();
    //Should be called initially and after asyncDep=6 update
    const unsubscribe = store.subscribe((value) => {
      counter();
      expect([8, 9]).toContain(+value);
    });

    await new Promise((r) => setTimeout(r, 1));
    unsubscribe();
    expect(counter).toBeCalledTimes(2);
  });

  it("early refresh", async () => {
    const getter = mock(2);
    const store = asyncable(getter);

    await store.update();
    expect(getter).toBeCalledTimes(1);
    expect(+get(store)).toBe(2);
    await new Promise((r) => setTimeout(r, 1));
    expect(getter).toBeCalledTimes(1);
  });

  it("minimal get updates", async () => {
    const getter = mock([1, 2], 100);
    const store = asyncable(getter);
    const counter = jest.fn();

    store.subscribe(counter);
    const promise = get(store);

    store.update();
    expect(counter).toBeCalledTimes(1);
    await new Promise((r) => setTimeout(r, 10));

    store.update();
    expect(counter).toBeCalledTimes(1);

    expect(await promise).toBe(2);
    expect(counter).toBeCalledTimes(2);
  });

  it("minimal set updates", async () => {
    const getter = mock(1);
    const setter = mock(4, 100);
    const store = asyncable(getter, setter);

    get(store);
    const counter = jest.fn();
    store.subscribe(counter);

    store.set(1);
    store.set(2);
    await new Promise((r) => setTimeout(r, 10));
    await store.set(3);
    expect(counter).toBeCalledTimes(5);
    expect(await get(store)).toBe(4);
  });

  it("duplicate set", async () => {
    const getter = mock(1);
    const setter = mock(2);
    const store = asyncable(getter, setter);

    await get(store);
    const counter = jest.fn();
    store.subscribe(counter);

    await store.set(1);
    expect(counter).toBeCalledTimes(1);
    await store.update(async () => 1);
    expect(counter).toBeCalledTimes(1);
    await store.set(2);
    expect(counter).toBeCalledTimes(2);
  });

  it("error handling", async () => {
    const store = asyncable(
      async () => {
        throw "get failed";
      },
      async () => {
        throw "set failed";
      }
    );

    const reject = jest.fn();
    const resolve = jest.fn();

    const getPromise = get(store);
    await getPromise.then(resolve, reject);
    expect(reject).toBeCalledWith("get failed");
    expect(resolve).not.toBeCalled();

    const setPromise = store.set("value" as never);
    expect(get(store).toString()).toBe("value");
    await setPromise.then(resolve, reject);
    expect(reject).toBeCalledWith("set failed");
    expect(resolve).not.toBeCalled();
    expect(!ready(get(store)));
  });

  it("abort signals", async () => {
    const abort = jest.fn();
    const handler = async (signal: AbortSignal) => {
      signal.onabort = () => abort();
      await new Promise((r) => setTimeout(r, 50));
    };

    const store = asyncable(handler, handler);
    get(store);
    await new Promise((r) => setTimeout(r, 10));
    await get(store);
    expect(abort).toBeCalledTimes(1);

    store.set(1 as any);
    await new Promise((r) => setTimeout(r, 10));
    await store.set(2 as any);
    expect(abort).toBeCalledTimes(2);
    expect(await get(store)).toBe(2);
  });

  it("callback values", async () => {
    const getter = jest.fn((signal, parents) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(parents).toBeInstanceOf(Array);
      expect(parents[0]).toBe(0);
      return 0;
    });
    const setter = jest.fn((signal, [newValue, oldValue], parents) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(parents).toBeInstanceOf(Array);
      expect(parents[0]).toBe(0);
      expect(newValue).toBe(1);
      expect(oldValue).toBe(0);
    });
    const dependency = writable(0);
    const store = asyncable(dependency, getter, setter);

    expect(await get(store)).toBe(0);
    await store.set(1);

    expect(getter).toBeCalledTimes(1);
    expect(setter).toBeCalledTimes(1);
  });

  it("reflections", async () => {
    let counter = 0;
    const getter = mock([2, 3, 3]);
    const store1 = asyncable(getter);
    const store2 = asyncable(
      [store1, true],
      (_, [number]) => {
        counter++;
        return number * number;
      },
      () => {}
    );

    expect(await get(store1)).toBe(2);
    expect(await get(store2)).toBe(4);
    expect(getter).toBeCalledTimes(1);
    expect(counter).toBe(1);
    await store2.set(9);
    expect(getter).toBeCalledTimes(2);
    expect(await get(store1)).toBe(3);
    expect(getter).toBeCalledTimes(3);
    expect(await get(store2)).toBe(9);
    expect(counter).toBe(2);
  });

  it("complex scenario", async () => {
    // === Helpers ===
    let calls = 0;
    const order = [
      //Initial load
      "personalization",
      "suggest",
      "favorites",
      "suggested",
      "blogs",
      "previews",
      //Set the value of favorites
      "set favorites",
      //Updates caused by reflection
      "personalization",
      "favorites",
      "suggested",
      "blogs",
      "previews",
      //Disable suggestions
      "blogs",
      "previews",
    ];
    const check = (name: string) => {
      expect(order[calls++]).toBe(name);
    };
    const api = <T>(data: T, name: string) => {
      const getter = mock(data);
      return (signal: any, [token]: any) => {
        check(name);
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(token).toBe("token");
        return getter();
      };
    };

    // === Stores ===
    const token = asyncable(mock("token"));
    const suggest = asyncable(token, api(true, "suggest"), () => {});

    const personalization = asyncable(
      token,
      api(
        [
          {
            favorites: ["1f", "2f"],
            suggested: ["1s"],
          },
          {
            favorites: ["1u"],
            suggested: ["1s", "2s"],
          },
        ],
        "personalization"
      )
    );

    const favorites = asyncable(
      [personalization, true],
      (_, [personalization]) => {
        check("favorites");
        return personalization.favorites;
      },
      (_, [value, old]) => {
        check("set favorites");
        expect(value).toEqual(["1f"]);
        expect(old).toEqual(["1f", "2f"]);
        return ["1c"];
      }
    );

    const suggested = asyncable(personalization, (_, [personalization]) => {
      check("suggested");
      return personalization.suggested;
    });

    const blogs = asyncable(
      [favorites, suggest, suggested],
      (_, [favorites, suggest, suggested]) => {
        check("blogs");
        let blogs = favorites;
        if (suggest) blogs = blogs.concat(suggested);
        return blogs;
      }
    );

    const previews = asyncable(blogs, async (_, [blogs]) => {
      check("previews");
      const previews = {} as Record<string, string>;
      await Promise.all(
        blogs.map(async (x) => {
          previews[x] = await mock(`preview-${x}`)();
        })
      );

      return previews;
    });

    // === Usage ===
    // Just render
    const $blogs = get(blogs);
    expect(!ready($blogs));
    expect(await $blogs).toEqual(["1f", "2f", "1s"]);

    for (const blog of await $blogs) {
      expect((await get(previews))[blog]).toBe(`preview-${blog}`);
    }

    // Watch previews
    const counter = jest.fn();
    previews.subscribe(counter);
    await new Promise((r) => setTimeout(r, 10));

    // Update favorites
    await favorites.update((x) => x?.filter((y) => y != "2f"));
    expect(get(favorites).valueOf()).toEqual(["1c"]);

    await new Promise((r) => setTimeout(r, 10));
    expect(get(favorites).valueOf()).toEqual(["1u"]);
    expect(get(previews)).toEqual({
      "1u": "preview-1u",
      "1s": "preview-1s",
      "2s": "preview-2s",
    });
    expect(counter).toBeCalledTimes(3);

    // Disable suggestions
    await suggest.set(false);
    expect(counter).toBeCalledTimes(4);
    expect(await get(previews)).toEqual({ "1u": "preview-1u" });
    expect(get(previews)).toEqual({ "1u": "preview-1u" });
    expect(counter).toBeCalledTimes(5);

    expect(calls).toBe(order.length);
  });
});

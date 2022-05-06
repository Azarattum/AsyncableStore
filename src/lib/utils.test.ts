import { enrich, ready, parse } from "./utils";

describe("rich promise", () => {
  it("loading value", async () => {
    console.warn = jest.fn();
    const promise = enrich(Promise.resolve(1));

    expect(!ready(promise));
    expect(typeof promise).toBe("object");
    expect(promise.valueOf()).toBe(undefined);
    expect(promise.toString()).toBe("[object Empty]");
    expect(console.warn).toBeCalled();
    expect(await promise).toBe(1);
  });

  it("primitive value", async () => {
    const promise = enrich(Promise.resolve(2), 1);

    expect(typeof promise).toBe("object");
    expect(promise.valueOf()).toBe(1);
    expect(promise.toString()).toBe("1");
    expect(+promise + 1).toBe(2);
    expect(promise.toFixed()).toBe("1");
    expect(await promise).toBe(2);
  });

  it("zero value", async () => {
    const promise = enrich(Promise.resolve(0), 0);

    expect(+promise).toBe(0);
    expect(typeof promise).toBe("object");
    expect(promise.valueOf()).toBe(0);
    expect(promise.toString()).toBe("0");
    expect(await promise).toBe(0);
    expect(await promise).toBeFalsy();
  });

  it("object value", async () => {
    const promise = enrich(Promise.resolve({ value: 2 }), { value: 1 });

    expect(promise.value).toBe(1);
    expect(promise.toString()).toBe("[object Object]");
    expect(promise.valueOf()).toEqual({ value: 1 });
    expect(await promise).toEqual({ value: 2 });
  });

  it("prototype value", async () => {
    class Test {
      private data: number;
      constructor(data: number) {
        this.data = data;
      }
      test() {
        return this.data;
      }
    }

    const a = new Test(0);
    const b = new Test(1);

    const promise = enrich(Promise.resolve(b), a);
    expect(promise).toBeInstanceOf(Test);
    expect(promise.test()).toBe(0);
    expect(promise.valueOf()).toEqual(a);

    const awaited = await promise;
    expect(awaited).toBeInstanceOf(Test);
    expect(awaited.test()).toBe(1);
  });
});

describe("dependencies parse", () => {
  it("single value", async () => {
    const a = {} as any;
    const { stores, reflections } = parse(a);
    expect(stores.length).toBe(1);
    expect(stores[0]).toBe(a);
    expect(reflections.length).toBe(0);
  });

  it("single reflection", async () => {
    const a = { update: () => "" } as any;
    const { stores, reflections } = parse([a, true]);
    expect(stores.length).toBe(1);
    expect(stores[0]).toBe(a);
    expect(reflections.length).toBe(1);
    expect(reflections[0]).toBe(a);
  });

  it("combined array", async () => {
    const a = {} as any;
    const b = {} as any;
    const c = { update: () => "" } as any;
    const d = {} as any;

    const { stores, reflections } = parse([
      a,
      [b, false],
      [c, true],
      [d, true],
    ]);
    expect(stores.length).toBe(4);
    expect(stores[0]).toBe(a);
    expect(stores[1]).toBe(b);
    expect(stores[2]).toBe(c);
    expect(stores[3]).toBe(d);
    expect(reflections.length).toBe(1);
    expect(reflections[0]).toBe(c);
  });
});

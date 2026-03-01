export type ActionSpy<TArgs = any, TReturn = any> = {
  (args: TArgs): Promise<TReturn>;
  calls: TArgs[];
  returns: (value: TReturn | ((args: TArgs) => TReturn)) => void;
  returnsOnce: (value: TReturn | ((args: TArgs) => TReturn)) => void;
  reset: () => void;
};

export function createActionSpy<TArgs = any, TReturn = any>(): ActionSpy<TArgs, TReturn> {
  let defaultReturn: TReturn | ((args: TArgs) => TReturn) | undefined;
  let onceReturns: (TReturn | ((args: TArgs) => TReturn))[] = [];

  const spy = async function (args: TArgs): Promise<TReturn> {
    spy.calls.push(args);

    if (onceReturns.length > 0) {
      const onceReturn = onceReturns.shift()!;
      if (typeof onceReturn === "function") {
        return (onceReturn as (args: TArgs) => TReturn)(args);
      }
      return onceReturn;
    }

    if (defaultReturn !== undefined) {
      if (typeof defaultReturn === "function") {
        return (defaultReturn as (args: TArgs) => TReturn)(args);
      }
      return defaultReturn;
    }

    return undefined as TReturn;
  } as ActionSpy<TArgs, TReturn>;

  spy.calls = [];
  spy.returns = (value) => {
    defaultReturn = value;
  };
  spy.returnsOnce = (value) => {
    onceReturns.push(value);
  };
  spy.reset = () => {
    spy.calls = [];
    defaultReturn = undefined;
    onceReturns = [];
  };

  return spy;
}

export function wrapActionsWithSpies<T extends Record<string, any>>(actions: T): T {
  const spied = {} as any;

  const proto = Object.getPrototypeOf(actions);
  const methodNames: string[] = [];

  if (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== "constructor" && typeof actions[name] === "function") {
        methodNames.push(name);
      }
    }
  }

  for (const key of Object.keys(actions)) {
    if (typeof actions[key] === "function" && !methodNames.includes(key)) {
      methodNames.push(key);
    }
  }

  for (const name of methodNames) {
    spied[name] = createActionSpy();
  }

  return spied as T;
}

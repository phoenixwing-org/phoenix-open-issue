type Decorator = (...args: any[]) => void;

function decorator(): Decorator {
  return () => undefined;
}

export function Inject(): Decorator {
  return decorator();
}

export function Provide(): Decorator {
  return decorator();
}

export function Scope(): Decorator {
  return decorator();
}

export const ScopeEnum = { Singleton: 'Singleton' } as const;

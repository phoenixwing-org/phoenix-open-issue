type Decorator = (...args: any[]) => void;

export function InjectDataSource(): Decorator {
  return () => undefined;
}

export function InjectEntityModel(_entity: unknown): Decorator {
  return () => undefined;
}

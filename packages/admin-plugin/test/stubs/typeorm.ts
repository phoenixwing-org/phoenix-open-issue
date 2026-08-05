type Decorator = (...args: any[]) => void;

function decorator(): Decorator {
  return () => undefined;
}

export const Column = decorator;
export const Entity = decorator;
export const Index = decorator;
export const PrimaryColumn = decorator;
export const PrimaryGeneratedColumn = decorator;

export function In<T>(value: T[]) {
  return { operator: 'in', value };
}

export function IsNull() {
  return { operator: 'is-null' };
}

export class DataSource {}
export class EntityManager {}
export class Repository<T> {}

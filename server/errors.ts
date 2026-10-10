export class InputError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); this.name = 'InputError'; }
}
export function requireText(value: unknown, name: string, max = 8000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new InputError(`${name} must be nonempty text of at most ${max} characters.`);
}
export function requireEnum(value: unknown, values: readonly string[], name: string): void {
  if (value != null && (typeof value !== 'string' || !values.includes(value))) throw new InputError(`${name} is invalid.`);
}

/** Publishing and the settings panel both use this. Whitespace does not count. */
export function exactTrue(value: string | undefined) {
  return value === "true";
}

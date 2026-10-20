/** The account's setting wins, then this browser's, then the default. */
export function resolveSetting(account: boolean | undefined, local: boolean | undefined, defaultValue: boolean): boolean {
  return account ?? local ?? defaultValue;
}

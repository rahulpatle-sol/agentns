/**
 * Typed view of the program's `#[error_code]` enum, in declaration order.
 * Anchor numbers these from 6000 upward — see `state/transactions/errors.ts`
 * for the numeric mapping used at runtime.
 */

export type AgentNsError = {
  /** The Rust variant name, shown as the toast title. */
  name: string;
  /** The `#[msg(...)]` string from the program. */
  message: string;
};

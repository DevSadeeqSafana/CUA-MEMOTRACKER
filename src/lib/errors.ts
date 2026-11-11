// Turning errors into messages people can understand.
//
// Rule: users only ever see messages we wrote for them. Database, network and
// programming errors are logged in full on the server (by the caller) and the
// user gets a plain-English explanation instead.

/** An error whose message was written for the user and is safe to show as-is. */
export class UserFacingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UserFacingError';
    }
}

export const NOT_AUTHORIZED_MESSAGE =
    "You don't have permission to do this. If you think this is a mistake, sign out and sign in again, or contact the system administrator.";

// Known technical error codes (MySQL and network) mapped to plain explanations.
const CODE_MESSAGES: Record<string, string> = {
    ER_NO_REFERENCED_ROW: 'Something this action depends on no longer exists. Refresh the page and try again.',
    ER_NO_REFERENCED_ROW_2: 'Something this action depends on no longer exists. Refresh the page and try again.',
    ER_ROW_IS_REFERENCED: 'This item is still being used elsewhere, so it cannot be removed.',
    ER_ROW_IS_REFERENCED_2: 'This item is still being used elsewhere, so it cannot be removed.',
    ER_DUP_ENTRY: 'This record already exists, so it was not saved again.',
    ER_DATA_TOO_LONG: 'Some of the text you entered is too long. Please shorten it and try again.',
    ER_TRUNCATED_WRONG_VALUE: 'Some of the information entered is not in the right format. Please check it and try again.',
    ER_BAD_NULL_ERROR: 'Some required information is missing. Please fill in all required fields and try again.',
    ER_LOCK_WAIT_TIMEOUT: 'Someone else is updating this at the same moment. Please wait a few seconds and try again.',
    ER_LOCK_DEADLOCK: 'Someone else is updating this at the same moment. Please wait a few seconds and try again.',
    ER_BAD_FIELD_ERROR: 'This feature is not fully set up yet. Please contact the system administrator.',
    ER_NO_SUCH_TABLE: 'This feature is not fully set up yet. Please contact the system administrator.',
    ER_PARSE_ERROR: 'Something went wrong on our side. Please try again, or contact the system administrator if it keeps happening.',
    ECONNREFUSED: "We couldn't reach the database right now. Please try again in a moment.",
    ETIMEDOUT: 'The system took too long to respond. Please check your connection and try again.',
    ENOTFOUND: "We couldn't reach the database right now. Please try again in a moment.",
    PROTOCOL_CONNECTION_LOST: 'The connection to the database was interrupted. Please try again.',
    ER_CON_COUNT_ERROR: 'The system is very busy right now. Please try again in a moment.',
};

/**
 * Message to show the user for any caught error.
 * - UserFacingError: its own message.
 * - "Unauthorized": a plain permission message.
 * - Known database / network codes: a plain explanation.
 * - Anything else: `fallback`, which should say what failed in plain English,
 *   e.g. "We couldn't update the routing. Please try again."
 */
export function friendlyError(error: unknown, fallback: string): string {
    if (error instanceof UserFacingError) return error.message;
    const err = error as { code?: string; message?: string } | null;
    if (err?.message === 'Unauthorized') return NOT_AUTHORIZED_MESSAGE;
    if (err?.code && CODE_MESSAGES[err.code]) return CODE_MESSAGES[err.code];
    return fallback;
}

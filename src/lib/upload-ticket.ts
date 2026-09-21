import crypto from 'crypto';

// Short-lived, HMAC-signed permission for a signed-in user to upload files
// directly to the backend upload endpoint. Verified by
// backend/server/routes/memo-tracker/uploads.js with the same secret.
const TICKET_TTL_MS = 15 * 60 * 1000;

export function createUploadTicket(userId: string | number): string {
    const secret = process.env.MEMO_UPLOAD_SECRET;
    if (!secret) throw new Error('MEMO_UPLOAD_SECRET is not configured');

    const payload = Buffer.from(JSON.stringify({ uid: String(userId), exp: Date.now() + TICKET_TTL_MS }))
        .toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
}

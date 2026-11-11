'use client';

import { getUploadTicket } from '@/lib/actions';

export interface UploadedFile {
    url: string;
    name: string;
    size: number;
    type: string;
}

export const UPLOAD_API_URL = process.env.NEXT_PUBLIC_UPLOAD_API_URL || '';
export const directUploadEnabled = () => Boolean(UPLOAD_API_URL);

// Largest single file we let a user pick. The backend enforces its own limit too.
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export const formatBytes = (bytes: number) =>
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

/** Upload problem with a message written for the user (safe to show in a toast). */
export class UploadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UploadError';
    }
}

// Plain-English reason for a failed upload (never raw server text or status codes).
function uploadFailureMessage(fileName: string, status: number) {
    if (status === 413) return `"${fileName}" is too large to upload. Attachments must be under ${formatBytes(MAX_ATTACHMENT_BYTES)}.`;
    if (status === 401 || status === 403) return 'Your upload permission has expired. Refresh the page and try again.';
    if (status >= 500) return `The file server had a problem saving "${fileName}". Please try again in a moment.`;
    return `We couldn't upload "${fileName}". Please try again.`;
}

async function uploadOne(file: File, token: string): Promise<UploadedFile> {
    const body = new FormData();
    body.append('file', file);

    let res: Response;
    try {
        res = await fetch(UPLOAD_API_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body,
        });
    } catch {
        throw new UploadError(`We couldn't upload "${file.name}" because the file server could not be reached. Check your internet connection and try again.`);
    }

    let json: any = null;
    try { json = await res.json(); } catch { /* non-JSON error body */ }

    if (!res.ok || !json?.success || !json.file?.url) {
        throw new UploadError(uploadFailureMessage(file.name, res.status));
    }
    return json.file as UploadedFile;
}

/**
 * Uploads files from the browser directly to the backend, bypassing the
 * Next.js server action (and Vercel's 4.5 MB request limit). Returns the
 * stored files' metadata in the same order as `files`.
 */
export async function uploadFilesDirect(
    files: File[],
    onProgress?: (done: number, total: number) => void,
): Promise<UploadedFile[]> {
    if (files.length === 0) return [];

    const ticket = await getUploadTicket();
    if (!ticket.success || !ticket.token) throw new UploadError(ticket.error || 'We couldn\'t get permission to upload your files. Refresh the page and try again.');

    const results: UploadedFile[] = [];
    for (const file of files) {
        results.push(await uploadOne(file, ticket.token));
        onProgress?.(results.length, files.length);
    }
    return results;
}

/**
 * Adds general attachments to a memo FormData: uploaded straight to the
 * backend when direct upload is configured (sent as `uploaded_attachments`
 * metadata), otherwise appended as raw `attachments` files. Throws with a
 * user-facing message on oversized files or a failed upload.
 */
export async function appendGeneralAttachments(
    formData: FormData,
    files: File[],
    onProgress?: (done: number, total: number) => void,
) {
    const oversized = files.find(f => f.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
        throw new UploadError(`"${oversized.name}" is ${formatBytes(oversized.size)}; attachments must be under ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
    }
    if (files.length === 0) return;

    if (directUploadEnabled()) {
        const uploaded = await uploadFilesDirect(files, onProgress);
        formData.append('uploaded_attachments', JSON.stringify(uploaded));
    } else {
        files.forEach(file => formData.append('attachments', file));
    }
}

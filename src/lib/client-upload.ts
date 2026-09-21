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

async function uploadOne(file: File, token: string): Promise<UploadedFile> {
    const body = new FormData();
    body.append('file', file);

    const res = await fetch(UPLOAD_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
    });

    let json: any = null;
    try { json = await res.json(); } catch { /* non-JSON error body */ }

    if (!res.ok || !json?.success || !json.file?.url) {
        const reason = json?.message || (res.status === 413 ? 'file is too large' : `HTTP ${res.status}`);
        throw new Error(`Could not upload "${file.name}": ${reason}`);
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
    if (!ticket.success || !ticket.token) throw new Error(ticket.error || 'Could not authorise upload.');

    const results: UploadedFile[] = [];
    for (const file of files) {
        results.push(await uploadOne(file, ticket.token));
        onProgress?.(results.length, files.length);
    }
    return results;
}

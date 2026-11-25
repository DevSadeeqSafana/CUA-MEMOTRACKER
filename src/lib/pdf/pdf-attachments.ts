// Appends a memo's attachments to its generated PDF and stamps "Page X of Y" on
// every page.
// - PDF attachments: all their pages are copied in.
// - Images (JPEG, PNG, and anything sharp can read such as WebP/GIF/TIFF): one page each.
// - Anything else (Word, Excel, video, ...) and files that cannot be fetched or read:
//   a page with the file's details and its link, so nothing is silently left out.
// Attachment URLs are supplied by the browser at upload time, so they are only
// fetched from known upload hosts (or read from public/uploads), never from anywhere else.
import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

export interface PdfAttachment {
    name: string;
    url: string;
    type?: string | null;
    size?: number | null;
    uploadedBy?: string | null;
    uploadedAt?: Date | string | null;
    note?: string | null;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 54;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const MAX_PAGES_PER_PDF = 300;
const FETCH_TIMEOUT_MS = 20_000;

const NAVY = rgb(11 / 255, 42 / 255, 91 / 255);
const MUTED = rgb(79 / 255, 106 / 255, 143 / 255);
const LIGHT = rgb(148 / 255, 163 / 255, 184 / 255);

function allowedHosts(): Set<string> {
    const hosts = new Set<string>(['uploads.cosmopolitan.edu.ng']);
    for (const v of [process.env.UPLOAD_API_URL, process.env.NEXT_PUBLIC_UPLOAD_API_URL]) {
        try { if (v) hosts.add(new URL(v).host); } catch { /* ignore */ }
    }
    for (const h of (process.env.ATTACHMENT_ALLOWED_HOSTS || '').split(',')) if (h.trim()) hosts.add(h.trim().toLowerCase());
    return hosts;
}

type Loaded = { ok: true; bytes: Uint8Array } | { ok: false; reason: string };

async function loadAttachment(url: string, budget: { left: number }): Promise<Loaded> {
    let bytes: Uint8Array;
    if (url.startsWith('/uploads/')) {
        const root = path.join(process.cwd(), 'public', 'uploads');
        const file = path.resolve(root, '.' + decodeURIComponent(url.slice('/uploads'.length)));
        if (!file.startsWith(root + path.sep)) return { ok: false, reason: 'The file location is not valid.' };
        try { bytes = new Uint8Array(await readFile(file)); } catch { return { ok: false, reason: 'The file could not be found on the server.' }; }
    } else {
        let parsed: URL;
        try { parsed = new URL(url); } catch { return { ok: false, reason: 'The file link is not valid.' }; }
        if (!['https:', 'http:'].includes(parsed.protocol) || !allowedHosts().has(parsed.host.toLowerCase())) {
            return { ok: false, reason: 'The file is stored outside the university upload server, so it was not downloaded.' };
        }
        try {
            const res = await fetch(parsed, { redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' });
            if (!res.ok) return { ok: false, reason: `The upload server returned an error (HTTP ${res.status}).` };
            const declared = Number(res.headers.get('content-length') || 0);
            if (declared > MAX_FILE_BYTES || declared > budget.left) return { ok: false, reason: 'The file is too large to include in the PDF.' };
            bytes = new Uint8Array(await res.arrayBuffer());
        } catch {
            return { ok: false, reason: 'The file could not be downloaded from the upload server.' };
        }
    }
    if (bytes.length > MAX_FILE_BYTES || bytes.length > budget.left) return { ok: false, reason: 'The file is too large to include in the PDF.' };
    budget.left -= bytes.length;
    return { ok: true, bytes };
}

const isPdf = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b: Uint8Array) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

// sharp ships with Next.js; when it is missing, JPEG/PNG are embedded as they are
async function loadSharp() {
    try { return (await import('sharp')).default; } catch { return null; }
}

/** JPEG/PNG bytes ready for embedding, shrunk so the PDF stays a reasonable size. */
async function prepareImage(bytes: Uint8Array): Promise<{ kind: 'jpg' | 'png'; bytes: Uint8Array } | null> {
    const sharp = await loadSharp();
    if (sharp) {
        try {
            const out = await sharp(bytes, { failOn: 'none' })
                .rotate() // respect camera orientation
                .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 78, mozjpeg: true })
                .toBuffer();
            return { kind: 'jpg', bytes: new Uint8Array(out) };
        } catch { /* not an image sharp can read */ }
    }
    if (isJpeg(bytes)) return { kind: 'jpg', bytes };
    if (isPng(bytes)) return { kind: 'png', bytes };
    return null;
}

/** pdf-lib's standard fonts only cover WinAnsi; replace anything else. */
const safe = (text: string) => text.replace(/[^\x20-\x7E -ÿ]/g, '?');

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const para of safe(text).split('\n')) {
        let line = '';
        for (const word of para.split(/\s+/)) {
            const next = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
            if (line) lines.push(line);
            // break very long words (URLs)
            let rest = word;
            while (font.widthOfTextAtSize(rest, size) > width) {
                let cut = rest.length;
                while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
                lines.push(rest.slice(0, cut));
                rest = rest.slice(cut);
            }
            line = rest;
        }
        lines.push(line);
    }
    return lines;
}

const describeType = (a: PdfAttachment) => {
    const t = (a.type || '').toLowerCase();
    if (t.includes('word')) return 'Word document';
    if (t.includes('sheet') || t.includes('excel')) return 'Excel spreadsheet';
    if (t.includes('presentation') || t.includes('powerpoint')) return 'PowerPoint presentation';
    if (t.startsWith('video/')) return 'Video';
    if (t.startsWith('audio/')) return 'Audio recording';
    return a.type || 'File';
};

// Files that can never be drawn into a PDF are not downloaded at all (videos can be huge)
const NOT_EMBEDDABLE_TYPE = /^(video|audio)\/|word|excel|sheet|presentation|powerpoint|msword|zip|compressed|octet-stream/i;
const NOT_EMBEDDABLE_EXT = /\.(mp4|mov|avi|mkv|webm|mp3|wav|m4a|aac|ogg|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z)$/i;
const isEmbeddable = (a: PdfAttachment) =>
    !(NOT_EMBEDDABLE_TYPE.test(a.type || '') || NOT_EMBEDDABLE_EXT.test(a.url.split('?')[0]) || NOT_EMBEDDABLE_EXT.test(a.name));

const formatSize = (n?: number | null) => (!n ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function drawCaption(page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont }, label: string, name: string) {
    const { height } = page.getSize();
    page.drawText(safe(label.toUpperCase()), { x: MARGIN, y: height - 40, size: 7.5, font: fonts.bold, color: MUTED });
    const nameLines = wrap(name, fonts.bold, 11, page.getSize().width - MARGIN * 2).slice(0, 2);
    nameLines.forEach((l, i) => page.drawText(l, { x: MARGIN, y: height - 56 - i * 14, size: 11, font: fonts.bold, color: NAVY }));
    return height - 56 - nameLines.length * 14 - 8; // top of the content area
}

function addInfoPage(doc: PDFDocument, fonts: { regular: PDFFont; bold: PDFFont }, label: string, a: PdfAttachment, reason: string, link: string) {
    const page = doc.addPage(A4);
    let y = drawCaption(page, fonts, label, a.name) - 10;
    const width = A4[0] - MARGIN * 2;
    const line = (text: string, size = 10, font = fonts.regular, color = rgb(0.12, 0.16, 0.23)) => {
        for (const l of wrap(text, font, size, width)) { page.drawText(l, { x: MARGIN, y, size, font, color }); y -= size * 1.5; }
    };
    line(reason, 10.5, fonts.bold, NAVY);
    y -= 6;
    const details = [
        `Type: ${describeType(a)}`,
        a.size ? `Size: ${formatSize(a.size)}` : '',
        a.uploadedBy ? `Uploaded by: ${a.uploadedBy}` : '',
        a.uploadedAt ? `Uploaded on: ${new Date(a.uploadedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : '',
        a.note ? `Note: ${a.note}` : '',
    ].filter(Boolean);
    details.forEach(d => line(d, 9.5, fonts.regular, MUTED));
    y -= 8;
    line('Open the original file at:', 9.5, fonts.bold, MUTED);
    line(link, 9, fonts.regular, rgb(26 / 255, 90 / 255, 166 / 255));
}

/**
 * Appends every attachment to `memoPdf` and numbers all pages.
 * `origin` turns local /uploads/ paths into full links on the info pages.
 */
export async function buildMemoPdfWithAttachments(memoPdf: Uint8Array, attachments: PdfAttachment[], origin: string): Promise<Uint8Array> {
    const doc = await PDFDocument.load(memoPdf);
    const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
    const memoPageCount = doc.getPageCount();
    const labels = new Map<number, string>(); // page index -> attachment label (for the footer)
    const budget = { left: MAX_TOTAL_BYTES };

    // Download up to 4 files at a time; pages are still added in attachment order
    const downloads: Promise<Loaded | null>[] = [];
    const slots: Promise<unknown>[] = [];
    for (const a of attachments) {
        const start = slots.length >= 4 ? slots.shift()! : Promise.resolve();
        const task = start.then(() => (isEmbeddable(a) ? loadAttachment(a.url, budget) : null));
        downloads.push(task);
        slots.push(task.catch(() => null));
    }

    for (const [i, a] of attachments.entries()) {
        const label = `Attachment ${i + 1} of ${attachments.length}`;
        const link = a.url.startsWith('/') ? `${origin}${a.url}` : a.url;
        const firstPage = doc.getPageCount();
        const loaded = await downloads[i];

        if (loaded === null) {
            addInfoPage(doc, fonts, label, a, `A ${describeType(a).toLowerCase()} cannot be shown inside a PDF, so it is listed here instead.`, link);
        } else if (!loaded.ok) {
            addInfoPage(doc, fonts, label, a, `This attachment could not be included. ${loaded.reason}`, link);
        } else if (isPdf(loaded.bytes)) {
            try {
                const src = await PDFDocument.load(loaded.bytes, { ignoreEncryption: true });
                const count = Math.min(src.getPageCount(), MAX_PAGES_PER_PDF);
                const pages = await doc.copyPages(src, Array.from({ length: count }, (_, n) => n));
                pages.forEach(p => doc.addPage(p));
                if (src.getPageCount() > count) {
                    addInfoPage(doc, fonts, label, a, `Only the first ${count} of ${src.getPageCount()} pages are included.`, link);
                }
            } catch {
                addInfoPage(doc, fonts, label, a, 'This PDF could not be read (it may be damaged or password-protected), so it was not included.', link);
            }
        } else {
            const image = await prepareImage(loaded.bytes);
            if (!image) {
                addInfoPage(doc, fonts, label, a, `A ${describeType(a).toLowerCase()} cannot be shown inside a PDF, so it is listed here instead.`, link);
            } else {
                try {
                    const embedded = image.kind === 'jpg' ? await doc.embedJpg(image.bytes) : await doc.embedPng(image.bytes);
                    const landscape = embedded.width > embedded.height * 1.15;
                    const page = doc.addPage(landscape ? [A4[1], A4[0]] : A4);
                    const top = drawCaption(page, fonts, label, a.name);
                    const { width } = page.getSize();
                    const boxW = width - MARGIN * 2;
                    const boxH = top - 64; // leave room for the footer
                    const scale = Math.min(boxW / embedded.width, boxH / embedded.height, 1.5);
                    const w = embedded.width * scale, h = embedded.height * scale;
                    page.drawImage(embedded, { x: MARGIN + (boxW - w) / 2, y: top - h, width: w, height: h });
                } catch {
                    addInfoPage(doc, fonts, label, a, 'This image could not be read, so it was not included.', link);
                }
            }
        }
        for (let p = firstPage; p < doc.getPageCount(); p++) labels.set(p, `${label}: ${a.name}`);
    }

    // "Page X of Y" on every page, plus which attachment a page belongs to
    const total = doc.getPageCount();
    doc.getPages().forEach((page, idx) => {
        const { width } = page.getSize();
        const text = `Page ${idx + 1} of ${total}`;
        const size = 7.5;
        const tw = fonts.regular.widthOfTextAtSize(text, size);
        if (idx < memoPageCount) {
            // Same spot the memo layout reserves in its footer
            page.drawText(text, { x: width - MARGIN - tw, y: 33, size, font: fonts.regular, color: LIGHT });
            return;
        }
        // Attachment pages: small strip at the very bottom, clear of most content
        const label = wrap(labels.get(idx) || '', fonts.regular, size, width - MARGIN * 2 - tw - 20)[0] || '';
        page.drawRectangle({ x: 0, y: 0, width, height: 22, color: rgb(1, 1, 1), opacity: 0.85 });
        page.drawText(label, { x: MARGIN, y: 8, size, font: fonts.regular, color: LIGHT });
        page.drawText(text, { x: width - MARGIN - tw, y: 8, size, font: fonts.regular, color: LIGHT });
    });

    return doc.save();
}

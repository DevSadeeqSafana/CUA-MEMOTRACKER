// Plain-text preview of a memo body for the memo list: no HTML, no entity codes
// (e.g. "&nbsp;"), and no opening salutation ("Sir,", "Dear Sir/Ma,", "Greetings,")
// so the preview starts with the actual message.

const ENTITIES: Record<string, string> = {
    nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'",
    ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', naira: '₦',
};

function decodeEntities(text: string) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code: string) => {
        const c = code.toLowerCase();
        if (c.startsWith('#x')) return String.fromCodePoint(parseInt(c.slice(2), 16) || 32);
        if (c.startsWith('#') && c !== '#39') return String.fromCodePoint(parseInt(c.slice(1), 10) || 32);
        return ENTITIES[c] ?? m;
    });
}

// One salutation at the start, ending in , : . ! or - (so real sentences are never cut).
// "Dear …" allows a short name: "Dear Vice-Chancellor,", "Dear All,".
const SALUTATION = new RegExp(
    '^(?:' + [
        'dear\\s+[^,:.!\\n]{1,40}',
        '(?:my\\s+)?(?:sir|ma|madam)(?:\\s*(?:\\/|or|and)\\s*(?:sir|ma|madam))?',
        'greetings?(?:\\s+(?:sir|ma|madam|all|everyone))?',
        'good\\s+(?:morning|afternoon|evening|day)(?:\\s+(?:sir|ma|madam|all|everyone))?',
        'compliments\\s+of\\s+the\\s+season',
        'hello(?:\\s+(?:sir|ma|all|everyone))?',
        'hi(?:\\s+(?:sir|ma|all|everyone))?',
    ].join('|') + ')\\s*[,:.!\\-–—]+\\s*',
    'i'
);

export function memoPlainText(html: string | null | undefined) {
    if (!html) return '';
    return decodeEntities(html.replace(/<(br|\/p|\/div|\/li|\/h\d)\b[^>]*>/gi, ' ').replace(/<[^>]*>/g, ' '))
        .replace(/[\s ]+/g, ' ')
        .trim();
}

export function stripSalutation(text: string) {
    let out = text;
    // Up to two in a row, e.g. "Dear Sir, Greetings, ..."
    for (let i = 0; i < 2; i++) {
        const next = out.replace(SALUTATION, '');
        if (next === out) break;
        out = next;
    }
    if (!out) return text; // the whole body was just a greeting: keep it
    return out.charAt(0).toUpperCase() + out.slice(1);
}

export function memoPreview(html: string | null | undefined, maxLength = 140) {
    const text = stripSalutation(memoPlainText(html));
    return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

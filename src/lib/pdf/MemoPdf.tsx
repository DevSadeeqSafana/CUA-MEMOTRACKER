import path from 'path';
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import Html from 'react-pdf-html';
import { format } from 'date-fns';

// Same typefaces as the web app: Source Serif 4 for display text, Inter for body.
// Full static TTFs live in public/fonts/pdf (the web woff2 subsets lack glyphs such as ₦).
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts', 'pdf');
const font = (file: string) => path.join(FONT_DIR, file);

Font.register({
    family: 'Inter',
    fonts: [
        { src: font('Inter-Regular.ttf'), fontWeight: 400 },
        { src: font('Inter-SemiBold.ttf'), fontWeight: 600 },
        { src: font('Inter-Bold.ttf'), fontWeight: 700 },
        // Only one italic cut is bundled; bold-italic text falls back to it
        { src: font('Inter-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
        { src: font('Inter-Italic.ttf'), fontWeight: 600, fontStyle: 'italic' },
        { src: font('Inter-Italic.ttf'), fontWeight: 700, fontStyle: 'italic' },
    ],
});
Font.register({
    family: 'Source Serif 4',
    fonts: [
        { src: font('SourceSerif4-Regular.ttf'), fontWeight: 400 },
        { src: font('SourceSerif4-SemiBold.ttf'), fontWeight: 600 },
        { src: font('SourceSerif4-SemiBold.ttf'), fontWeight: 700 },
    ],
});
// Keep long words (URLs, reference numbers) intact instead of hyphenating them
Font.registerHyphenationCallback(word => [word]);

const LOGO_PATH = path.join(process.cwd(), 'public', 'CUALogo.png');

// Login-screen palette
const NAVY = '#0b2a5b';
const BLUE = '#1a5aa6';
const GOLD = '#e3ac3a';
const MUTED = '#4f6a8f';
const RULE = '#dbe3ee';

export interface MemoPerson {
    name: string;
    designation?: string | null;
    department?: string | null;
}

export interface MemoPdfData {
    title: string;
    referenceNumber?: string | null;
    createdAt: Date | string;
    status?: string | null;
    priority?: string | null;
    memoType?: string | null;
    category?: string | null;
    contentHtml: string;
    from: MemoPerson;
    to: MemoPerson[];
    cc: MemoPerson[];
    through: (MemoPerson & { status?: string | null; decidedAt?: Date | string | null })[];
    budget?: {
        year?: string | null;
        category?: string | null;
        items: { category?: string | null; description: string; quantity: number | string; amount: number; total: number }[];
    } | null;
    attachments: string[];
    generatedBy: string;
    generatedAt: Date;
}

const s = StyleSheet.create({
    // No page-level lineHeight: react-pdf then fails to draw render-prop text (page numbers)
    page: { paddingTop: 36, paddingBottom: 64, paddingHorizontal: 54, fontFamily: 'Inter', fontSize: 10.5, color: '#1e293b' },

    header: { alignItems: 'center', marginBottom: 14 },
    logoRing: { width: 74, height: 74, borderRadius: 37, backgroundColor: GOLD, padding: 3, marginBottom: 10 },
    logo: { width: 68, height: 68, borderRadius: 34 },
    uni: { fontFamily: 'Source Serif 4', fontSize: 17, color: NAVY, letterSpacing: 0.2, lineHeight: 1.25 },
    city: { fontSize: 7.5, color: MUTED, letterSpacing: 2.4, marginTop: 4, lineHeight: 1.2 },
    docType: { marginTop: 12, fontFamily: 'Source Serif 4', fontSize: 12, color: BLUE, letterSpacing: 3 },
    goldRule: { marginTop: 10, width: 64, height: 2, backgroundColor: GOLD },

    metaBox: { borderWidth: 1, borderColor: RULE, borderRadius: 8, marginBottom: 16 },
    metaRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: RULE },
    metaRowLast: { borderBottomWidth: 0 },
    metaLabel: { width: 74, fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 1.5, paddingTop: 2.5 },
    metaValue: { flex: 1 },
    personLine: { fontSize: 10, color: '#0f172a', lineHeight: 1.35 },
    personName: { fontWeight: 600 },
    personRole: { color: MUTED },
    throughStatus: { fontSize: 8, color: BLUE },
    subject: { fontFamily: 'Source Serif 4', fontWeight: 600, fontSize: 13, color: NAVY, lineHeight: 1.25 },
    metaStrip: { flexDirection: 'row', backgroundColor: '#f4f7fb', borderTopWidth: 1, borderTopColor: RULE, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
    stripCell: { flex: 1, paddingVertical: 5, paddingHorizontal: 12 },
    stripLabel: { fontSize: 6.5, fontWeight: 700, color: MUTED, letterSpacing: 1.3 },
    stripValue: { fontSize: 9, fontWeight: 600, color: NAVY, marginTop: 1 },

    sectionTitle: { fontFamily: 'Source Serif 4', fontWeight: 600, fontSize: 12, color: NAVY, marginTop: 18, marginBottom: 8 },

    table: { borderWidth: 1, borderColor: RULE, borderRadius: 6 },
    tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: RULE },
    th: { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 1, paddingVertical: 6, paddingHorizontal: 8 },
    td: { fontSize: 9, paddingVertical: 6, paddingHorizontal: 8, lineHeight: 1.4 },
    totalRow: { flexDirection: 'row', backgroundColor: '#f4f7fb' },

    signoff: { marginTop: 32, width: 220 },
    signLine: { borderBottomWidth: 1, borderBottomColor: '#94a3b8', height: 28, marginBottom: 6 },
    signName: { fontFamily: 'Source Serif 4', fontWeight: 600, fontSize: 12, color: NAVY },
    signRole: { fontSize: 9, color: MUTED },

    footer: { position: 'absolute', bottom: 28, left: 54, right: 54, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8, paddingRight: 70 },
    footerText: { fontSize: 7.5, color: '#94a3b8' },
    pageNumber: { position: 'absolute', bottom: 28, right: 54, paddingTop: 9, fontSize: 7.5, color: '#94a3b8' },
});

// Styles for the rich-text memo body (TipTap HTML)
const htmlStyles = {
    p: { marginTop: 0, marginBottom: 8 },
    h1: { fontFamily: 'Source Serif 4', fontWeight: 600, fontSize: 16, color: NAVY, marginTop: 6, marginBottom: 6 },
    h2: { fontFamily: 'Source Serif 4', fontWeight: 600, fontSize: 14, color: NAVY, marginTop: 6, marginBottom: 6 },
    h3: { fontFamily: 'Source Serif 4', fontWeight: 600, fontSize: 12, color: NAVY, marginTop: 6, marginBottom: 4 },
    strong: { fontWeight: 700 },
    b: { fontWeight: 700 },
    em: { fontStyle: 'italic' as const },
    i: { fontStyle: 'italic' as const },
    a: { color: BLUE, textDecoration: 'underline' as const },
    ul: { marginBottom: 8 },
    ol: { marginBottom: 8 },
    li: { marginBottom: 2 },
    blockquote: { borderLeftWidth: 2, borderLeftColor: GOLD, paddingLeft: 10, color: MUTED, fontStyle: 'italic' as const, marginBottom: 8 },
    hr: { borderBottomWidth: 1, borderBottomColor: RULE, marginVertical: 10 },
    u: { textDecoration: 'underline' as const },
    s: { textDecoration: 'line-through' as const },
    mark: { backgroundColor: '#fef08a' },
    code: { fontFamily: 'Courier', fontSize: 9.5, backgroundColor: '#f1f5f9' },
    pre: { fontFamily: 'Courier', fontSize: 9, backgroundColor: '#f1f5f9', padding: 8, marginBottom: 8 },
    sub: { fontSize: 7 },
    sup: { fontSize: 7 },
    table: { borderWidth: 1, borderColor: RULE, marginBottom: 8 },
    th: { backgroundColor: '#f4f7fb', fontWeight: 700, color: NAVY, padding: 5, borderWidth: 0.5, borderColor: RULE },
    td: { padding: 5, borderWidth: 0.5, borderColor: RULE },
    // "@" references to other memos
    '.memo-ref': { color: BLUE, fontWeight: 600 },
};

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const longDate = (d: Date | string) => format(new Date(d), 'd MMMM yyyy');

function Person({ p, extra }: { p: MemoPerson, extra?: string }) {
    const role = [p.designation, p.department].filter(Boolean).join(', ');
    return (
        <Text style={s.personLine}>
            <Text style={s.personName}>{p.name}</Text>
            {role ? <Text style={s.personRole}>{`  ·  ${role}`}</Text> : null}
            {extra ? <Text style={s.throughStatus}>{`  ${extra}`}</Text> : null}
        </Text>
    );
}

function MetaRow({ label, last, children }: { label: string, last?: boolean, children: React.ReactNode }) {
    return (
        <View style={[s.metaRow, last ? s.metaRowLast : {}]} wrap={false}>
            <Text style={s.metaLabel}>{label}</Text>
            <View style={s.metaValue}>{children}</View>
        </View>
    );
}

export default function MemoPdf({ memo }: { memo: MemoPdfData }) {
    const budgetTotal = memo.budget?.items.reduce((sum, i) => sum + i.total, 0) ?? 0;

    return (
        <Document title={memo.title} author="Cosmopolitan University Abuja" subject={memo.referenceNumber ?? undefined} creator="CUA Internal Memo System">
            <Page size="A4" style={s.page}>
                {/* Footer on every page. The page number is positioned on its own: react-pdf
                    drops a fixed row container that holds a render-prop Text. */}
                <View style={s.footer} fixed>
                    <Text style={s.footerText}>{`${memo.referenceNumber ? memo.referenceNumber + '  ·  ' : ''}Generated by ${memo.generatedBy} on ${format(memo.generatedAt, "d MMM yyyy, HH:mm")}`}</Text>
                </View>
                <Text style={s.pageNumber} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />

                {/* Letterhead: logo centred at the very top */}
                <View style={s.header}>
                    <View style={s.logoRing}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                        <Image src={LOGO_PATH} style={s.logo} />
                    </View>
                    <Text style={s.uni}>Cosmopolitan University</Text>
                    <Text style={s.city}>ABUJA, NIGERIA</Text>
                    <Text style={s.docType}>INTERNAL MEMORANDUM</Text>
                    <View style={s.goldRule} />
                </View>

                {/* Metadata: receiver, through, sender and subject */}
                <View style={s.metaBox}>
                    <MetaRow label="TO">
                        {memo.to.length ? memo.to.map((p, i) => <Person key={i} p={p} />) : <Text style={s.personRole}>—</Text>}
                    </MetaRow>
                    {memo.cc.length > 0 && (
                        <MetaRow label="CC">
                            {memo.cc.map((p, i) => <Person key={i} p={p} />)}
                        </MetaRow>
                    )}
                    {memo.through.length > 0 && (
                        <MetaRow label="THROUGH">
                            {memo.through.map((p, i) => (
                                <Person
                                    key={i}
                                    p={p}
                                    extra={p.status === 'Approved' && p.decidedAt ? `✓ Approved ${format(new Date(p.decidedAt), 'd MMM yyyy')}` : p.status && p.status !== 'Approved' ? `(${p.status})` : undefined}
                                />
                            ))}
                        </MetaRow>
                    )}
                    <MetaRow label="FROM">
                        <Person p={memo.from} />
                    </MetaRow>
                    <MetaRow label="SUBJECT" last>
                        <Text style={s.subject}>{memo.title}</Text>
                    </MetaRow>
                    <View style={s.metaStrip}>
                        {[
                            ['REFERENCE', memo.referenceNumber || '—'],
                            ['DATE', longDate(memo.createdAt)],
                            ['PRIORITY', memo.priority || '—'],
                            ['STATUS', memo.status || '—'],
                        ].map(([label, value]) => (
                            <View key={label} style={s.stripCell}>
                                <Text style={s.stripLabel}>{label}</Text>
                                <Text style={s.stripValue}>{value}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Memo body */}
                <Html stylesheet={htmlStyles} style={{ fontFamily: 'Inter', fontSize: 10.5, lineHeight: 1.5 }}>
                    {memo.contentHtml || '<p></p>'}
                </Html>

                {/* Budget requisition, when present */}
                {memo.budget && memo.budget.items.length > 0 && (
                    <View>
                        <Text style={s.sectionTitle}>
                            Budget Requisition{memo.budget.year ? ` · ${memo.budget.year}` : ''}{memo.budget.category ? ` · ${memo.budget.category}` : ''}
                        </Text>
                        <View style={s.table}>
                            <View style={[s.tr, { backgroundColor: '#f4f7fb' }]} fixed>
                                <Text style={[s.th, { flex: 3 }]}>ITEM</Text>
                                <Text style={[s.th, { width: 40, textAlign: 'center' }]}>QTY</Text>
                                <Text style={[s.th, { width: 90, textAlign: 'right' }]}>UNIT</Text>
                                <Text style={[s.th, { width: 100, textAlign: 'right' }]}>SUBTOTAL</Text>
                            </View>
                            {memo.budget.items.map((item, i) => (
                                <View key={i} style={s.tr} wrap={false}>
                                    <View style={[s.td, { flex: 3 }]}>
                                        {item.category ? <Text style={{ fontSize: 7, color: MUTED, fontWeight: 600 }}>{item.category.toUpperCase()}</Text> : null}
                                        <Text>{item.description}</Text>
                                    </View>
                                    <Text style={[s.td, { width: 40, textAlign: 'center' }]}>{String(item.quantity)}</Text>
                                    <Text style={[s.td, { width: 90, textAlign: 'right' }]}>{naira(item.amount)}</Text>
                                    <Text style={[s.td, { width: 100, textAlign: 'right', fontWeight: 600, color: NAVY }]}>{naira(item.total)}</Text>
                                </View>
                            ))}
                            <View style={s.totalRow} wrap={false}>
                                <Text style={[s.td, { flex: 1, textAlign: 'right', fontWeight: 700, color: MUTED, fontSize: 8, letterSpacing: 1 }]}>GRAND TOTAL</Text>
                                <Text style={[s.td, { width: 100, textAlign: 'right', fontWeight: 700, color: NAVY }]}>{naira(budgetTotal)}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Attachments (names only) */}
                {memo.attachments.length > 0 && (
                    <View wrap={false}>
                        <Text style={s.sectionTitle}>Attachments</Text>
                        {memo.attachments.map((name, i) => (
                            <Text key={i} style={{ fontSize: 9.5, color: MUTED, lineHeight: 1.5 }}>{`${i + 1}.  ${name}`}</Text>
                        ))}
                    </View>
                )}

                {/* Sender sign-off */}
                <View style={s.signoff} wrap={false}>
                    <View style={s.signLine} />
                    <Text style={s.signName}>{memo.from.name}</Text>
                    {memo.from.designation ? <Text style={s.signRole}>{memo.from.designation}</Text> : null}
                    {memo.from.department ? <Text style={s.signRole}>{memo.from.department}</Text> : null}
                </View>

            </Page>
        </Document>
    );
}

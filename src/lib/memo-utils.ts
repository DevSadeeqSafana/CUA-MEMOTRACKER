import { query } from './db';

/**
 * Generates a unique reference number for a new memo.
 * Format: IMTS/YYYY/DEPT/SEQUENCE
 * Example: IMTS/2026/HR/001
 */
export async function generateReferenceNumber(department: string): Promise<string> {
    const year = new Date().getFullYear();
    const deptCode = department.toUpperCase().substring(0, 4); // Use first 4 letters or standard code

    // Find the highest sequence for the current year and department in the database
    const pattern = `IMTS/${year}/${deptCode}/%`;
    const result = await query(
        'SELECT reference_number FROM memos WHERE reference_number LIKE ? ORDER BY id DESC LIMIT 1',
        [pattern]
    ) as any[];

    let nextSequence = 1;

    if (result.length > 0) {
        const lastRef = result[0].reference_number;
        const parts = lastRef.split('/');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) {
            nextSequence = lastSeq + 1;
        }
    }

    const sequenceStr = nextSequence.toString().padStart(3, '0');
    return `IMTS/${year}/${deptCode}/${sequenceStr}`;
}

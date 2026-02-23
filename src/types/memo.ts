export type MemoStatus = 'Draft' | 'Line Manager Review' | 'Reviewer Approval' | 'Distributed' | 'Archived';
export type MemoPriority = 'Low' | 'Medium' | 'High';
export type MemoType = 'Informational' | 'Approval' | 'Action';

export interface Memo {
    id: number;
    reference_number: string;
    title: string;
    content: string;
    department: string;
    category: string;
    priority: MemoPriority;
    memo_type: MemoType;
    status: MemoStatus;
    expiry_date?: string;
    created_by: number;
    created_at: string;
    updated_at: string;
}

export interface MemoRecipient {
    memo_id: number;
    recipient_id: number;
    read_at?: string;
    acknowledged_at?: string;
    action_completed_at?: string;
}

export interface MemoApproval {
    id: number;
    memo_id: number;
    approver_id: number;
    step_order: number;
    status: 'Pending' | 'Approved' | 'Rejected';
    comments?: string;
    processed_at?: string;
}

export interface Attachment {
    id: number;
    memo_id: number;
    file_name: string;
    file_path: string;
    file_type: string;
    file_size: number;
    uploaded_at: string;
}

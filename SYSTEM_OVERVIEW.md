# CUA MemoTracker: System Architecture & Workflow Overview

## 1. System Overview
The **CUA MemoTracker** is an institutional communication and financial requisition management system designed for **Cosmopolitan University Abuja (CUA)**. It digitizes the internal memo process, ensuring that every piece of official communication follows a strict accountability hierarchy while providing specialized support for budget-related requests.

The system replaces traditional paper-based memos with a secure, real-time platform that tracks the lifecycle of an "Internal Memo" from drafting to departmental validation and finally to distribution.

---

## 2. Core Components & Functionalities

### 🚀 Task Center (The Cockpit)
*   **Decision Queue**: A prioritized list for managers and reviewers to approve or reject pending memos.
*   **Institutional Inbox**: A chronological feed of all distributed memos intended for the current user.
*   **Real-time Notifications**: Alerts users when a memo requires their attention or when their own memo has been distributed.

### 📝 Memo Engine
*   **Dynamic Drafting**: Supports multiple memo types including "Internal Memo", "Approval Request", and "Circular".
*   **Budget Requisition Manager**: A specialized module for financial requests allowing multi-item breakdowns (Quantity, Unit Price, Description) with automatic sub-total and grand-total calculations.
*   **Attachment Support**: Secure upload and storage of supporting documents for each memo.

### 🛡️ Approval & Routing Logic
*   **Mandatory Hierarchy**: Every memo must pass through a "Validator" (Line Manager) before reaching the recipient.
*   **Status Tracking**: Memos progress through states: `Draft` → `Line Manager Review` → `Distributed`.
*   **Decision Audit**: Every approval or rejection is logged with a timestamp and the identity of the decision-maker.

### 👥 User & Accountability Management
*   **Line Manager Mapping**: Every user in the system is linked to a Line Manager, creating a clear chain of command.
*   **Role-Based Access Control (RBAC)**: Interface elements and actions are restricted based on assigned roles (e.g., only Admins can manage users).

---

## 3. Role Players

| Role | Responsibility |
| :--- | :--- |
| **Memo Creator** | Initiates communications, drafts budget requests, and selects recipients. |
| **Line Manager (Validator)** | Acts as the primary gatekeeper. Validates the accuracy and necessity of memos before they are distributed. |
| **Recipient** | The target of the communication. Can view and acknowledge distributed memos. |
| **Administrator** | Manages the institutional directory, assigns Line Managers, and oversees system health. |

---

## 4. Current Access Credentials (Database Snapshot)

The following accounts are currently established for development and testing. Passwords are secured using **Bcrypt** hashing.

| Username | Email | Primary Role |
| :--- | :--- | :--- |
| **System Administrator** | `admin@cosmopolitan.edu.ng` | Administrator |
| **Hayat Suleiman** | `hayat.suleiman@cosmopolitan.edu.ng` | Line Manager / Creator |

*Note: For testing purposes, standard accounts typically use `password123` unless otherwise configured.*

---

## 5. System Workflow: The Lifecycle of a Memo

### Phase 1: Initiation
1.  **Drafting**: The user selects a memo type and enters the content.
2.  **Financials**: If it's a budget memo, the user adds line items. The system calculates the total requisition amount.
3.  **Submission**: The user selects recipients and clicks "Send."

### Phase 2: Validation (Line Manager)
1.  **Notification**: The sender's Line Manager receives an alert in their **Task Center**.
2.  **Review**: The Line Manager reviews the content, attachments, and budget breakdown.
3.  **Routing Adjustment**: Line Managers have the authority to modify the final recipients or add additional required approvers (e.g., adding the Registrar or Vice Chancellor) to the workflow.
4.  **Validation**: The Manager clicks "Approve." If additional approvers were added, the memo moves to "Reviewer Approval" status; otherwise, it is "Distributed."

### Phase 3: Distribution
1.  **Routing**: The system automatically delivers the memo to all selected recipients' inboxes.
2.  **Read Receipt**: The system tracks when recipients view the memo.
3.  **Archival**: Distributed memos are formally archived in the institutional records for audit purposes.

---

## 6. Technical Stack
*   **Frontend**: Next.js 14+ (App Router), Tailwind CSS, Lucide Icons.
*   **Backend**: Node.js, Next-Auth (Security).
*   **Database**: MySQL (Relational storage for memos, line items, and audit logs).
*   **Utilities**: Zod (Validation), Bcrypt (Encryption), Crypto (UUID Generation).

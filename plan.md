# Internal Memo Tracker System – Design Plan

## 1. Overview
The Internal Memo Tracker System (IMTS) is a web-based, mobile-responsive application designed to digitalize the organization’s manual internal memo process. The system supports informational, approval-based, and action-tracking memos while ensuring confidentiality, accountability, and compliance with HR policies.

---

## 2. Objectives
- Fully digitalize the internal memo process
- Track memo lifecycle end-to-end
- Enforce approval workflows
- Ensure acknowledgment and action tracking
- Provide audit-ready reporting
- Improve transparency and accountability

---

## 3. Scope
- Internal memos only
- Organization-wide usage (50+ users)
- Cloud-hosted
- No third-party integrations

---

## 4. User Roles & Permissions

### Roles
- **Memo Creator**
- **Line Manager**
- **Reviewer / Approver**
- **Recipient**
- **Administrator**

### Permissions
- Role-based access control
- Confidential access limited to:
  - Memo Creator
  - Line Manager
  - Reviewer / Approver
  - Assigned Recipients
- Administrator has full system access

---

## 5. Memo Lifecycle

Draft → Line Manager Review → Reviewer Approval → Distribution → Acknowledgment → Archive

### Lifecycle Details
1. **Draft**
   - Created and edited by Memo Creator
   - Reference number auto-generated

2. **Line Manager Review**
   - Approve or reject with comments

3. **Reviewer Approval**
   - Multiple approvers supported
   - Sequential approval flow
   - Rejections return memo to creator

4. **Distribution**
   - Memo sent to selected recipients
   - In-system notifications triggered

5. **Acknowledgment**
   - Recipients must acknowledge receipt
   - Action completion tracked where applicable

6. **Archive**
   - Memo archived after completion or expiry date

---

## 6. Memo Features & Fields

### Core Fields
- Reference Number (Auto-generated)
- Title
- Content (Rich Text)
- Department
- Category / Tags
- Priority (Low / Medium / High)
- Memo Type (Informational / Approval / Action)
- Status
- Expiry Date
- Created By
- Created Date

### Attachments
- Multiple attachments supported
- Secure cloud storage

---

## 7. Tracking & Audit

### Tracked Items
- Submission timestamps
- Review and approval actions
- Read and acknowledgment status
- Action completion status
- Revisions and rejection reasons

### Audit Log
- User
- Action
- Timestamp
- Before / After values
- Immutable and HR-compliant

---

## 8. Dashboards

### All Users
- Pending actions
- Unread memos
- Pending acknowledgments
- Recent department memos

### Line Managers / Reviewers
- Pending reviews
- Overdue approvals
- Rejected memos

### Administrators
- System-wide statistics
- Department-level activity
- Compliance and audit reports

---

## 9. Search & Filters
- Filter memos by:
  - Date
  - Department
- Reference number lookup
- Role-based visibility enforced

---

## 10. Notifications

### Notification Type
- In-system notifications only

### Trigger Events
- Memo submission
- Approval request
- Memo distribution
- Acknowledgment reminders
- Overdue action reminders

### Configuration
- User-configurable preferences
- Administrator override

---

## 11. Reports (Administrator Only)
- Memo cycle time
- Approval delays
- Unacknowledged memos
- Department compliance reports
- Exportable formats (PDF / Excel)

---

## 12. Deletion & Retention
- Permanent deletion only
- Administrator restricted
- All deletions logged
- HR policy compliant

---

## 13. Technical Architecture

### Frontend
- Next.js
- Modern, responsive UI
- Role-based routing

### Backend
- Next.js API routes
- RESTful architecture
- Authentication and authorization layer

### Database
- MySQL

#### Core Tables
- users
- roles
- memos
- memo_approvals
- memo_recipients
- attachments
- audit_logs
- notifications

---

## 14. Hosting
- Cloud-hosted deployment
- Scalable and secure
- No external integrations

---

## 15. Success Criteria
- All memos processed digitally
- Complete visibility of memo lifecycle
- Zero untracked memos
- Instant availability of audit and compliance reports

---

## 16. Timeline
- Design finalization: Immediate
- Development start: Next phase
- Target review: As per organizational rollout plan

---

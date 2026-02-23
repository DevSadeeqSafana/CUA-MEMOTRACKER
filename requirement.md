# Internal Memo Tracker System – Requirements

## 1. Overview
The Internal Memo Tracker System (IMTS) is a web-based application designed to digitalize the organization’s manual internal memo process. It supports informational, approval-based, and action-tracking memos while ensuring confidentiality, accountability, and HR policy compliance.

---

## 2. Objectives
- Digitalize the end-to-end internal memo process
- Enforce structured approval workflows
- Track memo status, acknowledgment, and actions
- Provide audit-ready logs and reports
- Improve visibility and accountability across departments

---

## 3. Scope
- Internal memos only
- Organization-wide access (50+ users)
- Cloud-hosted system
- No third-party system integrations

---

## 4. User Roles

### 4.1 Roles
- Memo Creator
- Line Manager
- Reviewer / Approver
- Recipient
- Administrator

### 4.2 Role-Based Access
- Access restricted by role and memo assignment
- Memos visible only to:
  - Creator
  - Line Manager
  - Reviewer / Approver
  - Assigned Recipients
- Administrator has full system access

---

## 5. Memo Lifecycle Requirements

### 5.1 Workflow
Draft → Line Manager Review → Reviewer Approval → Distribution → Acknowledgment → Archive

### 5.2 Workflow Rules
- Memo creators can save drafts
- Line Managers and Reviewers can approve or reject
- Multiple approvers supported (sequential)
- Rejected memos return to creator with comments
- Approved memos are distributed to recipients
- Acknowledgment is mandatory
- Memos can expire and be archived automatically

---

## 6. Functional Requirements

### 6.1 Memo Management
- Create, edit, submit, and view memos
- Auto-generate unique memo reference numbers
- Attach multiple files to memos
- Categorize memos by department, priority, and tags

### 6.2 Approval Management
- Assign Line Manager and Reviewer(s)
- Track approval status and timestamps
- Support approval comments and revision history

### 6.3 Acknowledgment & Action Tracking
- Require recipient acknowledgment
- Track read status
- Track action completion status (if applicable)
- Send reminders for pending actions

---

## 7. Tracking & Audit Requirements
- Log all actions (create, update, approve, reject, acknowledge)
- Store user, action, timestamp, and value changes
- Audit logs must be immutable
- Fully compliant with HR policies

---

## 8. Dashboards & Reporting

### 8.1 Dashboards
- All users: pending actions, unread memos, recent memos
- Line Managers / Reviewers: pending approvals, overdue items
- Administrators: system-wide metrics and compliance views

### 8.2 Reports (Administrator Only)
- Memo lifecycle duration
- Approval delays
- Unacknowledged memos
- Department-level compliance
- Exportable reports (PDF / Excel)

---

## 9. Search & Filtering
- Search memos by:
  - Date
  - Department
- Reference number lookup
- Results filtered based on user permissions

---

## 10. Notifications
- In-system notifications only
- Triggered on:
  - Memo submission
  - Approval requests
  - Memo distribution
  - Acknowledgment reminders
  - Overdue actions
- User-configurable notification preferences

---

## 11. Deletion & Retention
- Permanent deletion only
- Restricted to Administrators
- All deletions logged
- Aligned with HR policies

---

## 12. Non-Functional Requirements
- Web-based and mobile-responsive
- Secure authentication and authorization
- Role-based access control
- Feature-rich, modern UI
- Scalable to support organizational growth

---

## 13. Success Criteria
- All memos processed digitally
- Complete visibility of memo lifecycle
- No untracked or lost memos
- Instant access to audit and compliance reports

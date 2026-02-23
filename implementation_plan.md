# Internal Memo Tracker System (IMTS) – Implementation Plan

This implementation plan outlines the phases and milestones for developing the Internal Memo Tracker System, a web-based platform designed to digitalize organization-wide memo workflows using Next.js and MySQL.

## Phase 1: Project Initialization & Core Infrastructure
*Goal: Establish the technical foundation and security layer.*

- [x] **Infrastructure Setup**
    - Initialize Next.js project with TypeScript and Tailwind CSS.
    - Set up directory structure (components, hooks, lib, services, api).
- [x] **Database Foundation**
    - Design and initialize MySQL schema.
    - Implement tables for `users`, `roles`, `memos`, `memo_approvals`, `memo_recipients`, `attachments`, `notifications`, and `audit_logs`.
- [x] **Authentication & Authorization**
    - Implement secure authentication (NextAuth.js or equivalent).
    - Develop Role-Based Access Control (RBAC) middleware for API and Page routing.
- [x] **Design System**
    - Create a modern, premium corporate UI theme.
    - Build core layout components (Sidebar, Navbar, User Profile).

## Phase 2: Memo Creation & Draft Management
*Goal: Enable users to capture and save memo data.*

- [x] **Rich Text Editor**
    - Implement a rich-text editing interface for memo content.
    - Add fields for Title, Department, Category, Priority, and Expiry Date.
- [x] **Reference Number Engine**
    - Develop an automated utility to generate unique reference numbers for every memo.
- [x] **Attachment Handling**
    - Integrate cloud storage for file uploads.
    - Implement file validation and secure metadata storage.
- [x] **Drafting System**
    - Enable "Save as Draft" functionality for Memo Creators.
    - Implement "Edit Draft" and "Delete Draft" operations.

## Phase 3: Sequential Approval Workflow
*Goal: Implement the core business logic for multi-stage approvals.*

- [x] **Line Manager Review**
    - Create the submission flow from Creator to Line Manager.
    - Build the approval/rejection interface with commenting.
- [x] **Multi-Stage Reviewer Logic**
    - Support sequential review by multiple stakeholders.
    - Implement logic for rejections returning memos to the "Draft/Revision" state.
- [x] **Lifecycle State Machine**
    - Implement the status transition logic (Draft → Under Review → Approved → Distributed).
- [x] **Event-Driven Notifications**
    - Trigger in-system alerts for "Approval Requested" and "Memo Rejected".

## Phase 4: Distribution & Recipient Engagement
*Goal: Manage the dissemination and tracking of approved memos.*

- [x] **Automated Distribution**
    - Logic to move memos to "Distributed" status upon final approval.
- [x] **Recipient Acknowledgement**
    - Build the interface for recipients to view and acknowledge memos.
    - Implement mandatory acknowledgement tracking.
- [x] **Read Tracking**
    - Record "First Read" timestamps for audit purposes.
- [ ] **Reminders & Alerts**
    - Automated notifications for pending acknowledgements and overdue actions.

## Phase 5: Dashboards & Discovery
*Goal: Provide visibility and high-performance search across the organization.*

- [x] **User Dashboards**
    - Create "My Tasks" view (Pending approvals/acknowledgements).
    - Implement "Recent Memos" feed based on user department and role.
- [ ] **Administrative Overview**
    - Build a dashboard for system-wide performance metrics (volume, delays).
- [x] **Advanced Search & Filtering**
    - Implement global search by Reference No, Title, and Date.
    - Add filters for Department, Status, and Priority.
    - Ensure strict data isolation (users only see what they are authorized to see).

## Phase 6: Auditing, Reporting & Final Polish
*Goal: Ensure compliance, accountability, and project wrap-up.*

- [x] **Immutable Audit Logs**
    - Implement backend logging for every state change (User, Time, Old Value, New Value).
- [x] **Administrative Reporting**
    - Create exportable reports (CSV) for HR compliance.
    - Implement analytics on lifecycle completion.
- [x] **Security Hardening**
    - Perform final security audit of RBAC and API endpoints.
    - Optimize database queries for scaling to 50+ concurrent users.
- [x] **Deployment & Documentation**
    - Premium landing and login pages implemented.
    - Finalize technical infrastructure.

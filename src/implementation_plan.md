# Implementation Plan - Accountant Finance & Budget Memo Auto-Routing & Processing Queue

Implement automatic routing of approved finance/budget memos to University Accountant **Chidi Teddy Ojiako**, and add a dedicated **Finance Queue** tab and processing interface to his account.

## User Review Required

> [!IMPORTANT]
> - **Accountant Role**: Chidi Teddy Ojiako (`chidi.ojiako@cosmopolitan.edu.ng`, ID `116`) has been granted the **Accountant** role in the memo system.
> - **Auto-Routing Trigger**: Any memo categorized under Finance/Budget, or containing budget items (`memo_budget_info`/`memo_budget_items`), will automatically be routed to the Accountant upon reaching final approval (`Distributed` status).
> - **Financial Processing Fields**: The Accountant will be able to update status (`Pending Processing`, `In Progress`, `Processed`, `Rejected`), attach Payment Voucher Numbers (e.g. `PV-2026-089`), and input financial processing notes.

## Proposed Changes

---

### Database Layer

#### [MODIFY] [scripts/migrate_accountant_routing.mjs](file:///c:/Users/Cosmopolitan/Desktop/CUAPROJECTS/CUA-MEMOTRACKER/scripts/migrate_accountant_routing.mjs)
- Ensure Accountant role exists (Role ID: 7).
- Assign Accountant role to Chidi Teddy Ojiako (User ID 116).
- Create `memo_finance_processing` table with fields: `id`, `memo_id`, `accountant_id`, `status`, `processing_notes`, `voucher_number`, `processed_at`, `created_at`, `updated_at`.
- Backfill existing distributed finance memos into `memo_finance_processing`.

---

### Backend & Business Logic Layer

#### [MODIFY] [actions.ts](file:///c:/Users/Cosmopolitan/Desktop/CUAPROJECTS/CUA-MEMOTRACKER/src/lib/actions.ts)
- Add `getAccountantUserId()` helper function.
- Add `routeApprovedFinanceMemoToAccountant(memoId: number)` helper function to detect finance/budget memos upon distribution, insert recipient record, create `memo_finance_processing` record, and send notification.
- Integrate `routeApprovedFinanceMemoToAccountant` inside `createMemo`, `approveMemo`, `updateDraftMemo`, and `updateRejectedMemo` when memo status changes to `'Distributed'`.
- Add `getAccountantFinanceMemos(statusFilter?: string)` server action to query finance memos with budget totals, voucher numbers, and creator information.
- Add `updateFinanceMemoProcessingStatus(processingId: number, status: string, notes?: string, voucherNumber?: string)` server action to handle accountant status updates and notify memo creators.
- Update `getSidebarCounts()` to include `accountant_queue` count for Accountant users.

---

### Frontend & UI Layer

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/Cosmopolitan/Desktop/CUAPROJECTS/CUA-MEMOTRACKER/src/components/layout/Sidebar.tsx)
- Add "Finance Queue" navigation link visible to users with role `'Accountant'` with live badge counter.

#### [NEW] [page.tsx](file:///c:/Users/Cosmopolitan/Desktop/CUAPROJECTS/CUA-MEMOTRACKER/src/app/dashboard/accountant/page.tsx)
- Create a dedicated Accountant Finance Queue dashboard page.
- Display statistics cards: Total Finance Memos, Pending Processing, In Progress, Processed Amount.
- Provide filter tabs (`All`, `Pending Processing`, `In Progress`, `Processed`, `Rejected`).
- Include "Process Finance Memo" interactive modal for entering Voucher Numbers and processing notes.

#### [MODIFY] [MemoInboxContainer.tsx](file:///c:/Users/Cosmopolitan/Desktop/CUAPROJECTS/CUA-MEMOTRACKER/src/components/memos/MemoInboxContainer.tsx)
- Add "Accountant Queue" tab in the classification bar for Accountant role users.

#### [MODIFY] [page.tsx](file:///c:/Users/Cosmopolitan/Desktop/CUAPROJECTS/CUA-MEMOTRACKER/src/app/dashboard/memos/[uuid]/page.tsx)
- Display financial processing status card (Voucher #, status badge, processing notes) on the memo detail page for transparency.

---

## Verification Plan

### Automated Verification
- Run database migration script `node scripts/migrate_accountant_routing.mjs` and verify zero errors.
- Run `npm run build` or typecheck to confirm no TypeScript compilation issues.

### Manual Verification
- Log in as an approver or create a budget memo, approve it through the workflow until status is `Distributed`.
- Verify auto-routing entry in `memo_finance_processing` and `memo_recipients` for Chidi Teddy Ojiako.
- Log in as Chidi Teddy Ojiako (`chidi.ojiako@cosmopolitan.edu.ng`) and check:
  - Sidebar counter and "Finance Queue" link.
  - "Accountant Queue" tab in Inbox.
  - Finance Queue dashboard page.
  - Open a budget memo, enter Voucher Number (e.g. `PV-2026-0101`), update status to `Processed`, and save.
- Verify status and voucher number reflect on the Memo Detail page and creator's notifications.

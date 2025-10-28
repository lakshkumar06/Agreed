# Phase 3: Collaborative Review & Weighted Approval System

## Overview

Contracts now behave like GitHub approval requests — commits must be approved (weighted) before merging into the main version.

## Features Implemented

### Database Schema
- ✅ `contract_approvals` table - tracks user votes (approve/reject) per version
- ✅ `contract_comments` table - threaded comments on commits
- ✅ Added `approval_status` and `approval_score` columns to `contract_versions`

### Backend API Endpoints
- ✅ `POST /contracts/:id/versions/:versionId/approve` - Submit approval/rejection
- ✅ `GET /contracts/:id/versions/:versionId/approvals` - Get all approvals
- ✅ `POST /contracts/:id/versions/:versionId/merge` - Merge approved version
- ✅ `POST /contracts/:id/versions/:versionId/comments` - Add comment
- ✅ `GET /contracts/:id/versions/:versionId/comments` - Get comments

### Frontend Components
- ✅ `CommitView` - Full commit review interface with approvals
- ✅ `ApprovalProgressBar` - Visual progress indicator
- ✅ `CommentThread` - Nested threaded comments
- ✅ `MergeBanner` - Merge button for approved versions

## How It Works

### Simple Approval System
- Each user gets one vote (approve or reject)
- Approval threshold: At least 1 approval
- When approval count > 0, version auto-flags as `approved`
- When rejection count > 0 and no approvals, version auto-flags as `rejected`
- Note: Weight system is stored in DB but not currently used in logic

### Example Flow
1. User creates a commit (version) → Status: `pending`
2. Team members review and vote Approve/Reject
3. Approval count calculated: `count(approve_votes)`
4. If count > 0 → Status: `approved`
5. Anyone can merge approved version → Status: `merged`

## Setup Instructions

### 1. Run Database Migration

```bash
cd backend
node database/migrate_approval_system.js
```

### 2. Restart Backend Server

Stop your current backend server (Ctrl+C) and restart:

```bash
cd backend
npm start
```

### 3. Frontend Changes

The frontend is already updated. If running, restart it:

```bash
cd frontend
npm run dev
```

## Usage

### For Contract Members

1. **Select a Version**: Click on any version in the sidebar
2. **Review Commit**: Click "Review vX" button
3. **Vote**: Click Approve or Reject button
4. **Add Comment**: Scroll down to comment section
5. **Merge**: If approved, click "Merge to Main" button

### For Contract Creators

- All versions start as `pending`
- Monitor approval progress via progress bar
- Merge approved versions to make them the main contract

## Testing

### Test Scenario

1. Create a contract with multiple members
2. Create a version/commit
3. Have members vote:
   - Member 1 approves → approval_count = 1
   - Status changes to `approved`
4. Merge the version
5. Status changes to `merged`

## Notes

- New versions created automatically start with `approval_status = 'pending'`
- Existing versions in database will have `approval_status = 'pending'` by default
- Approval threshold is currently set to 1 approval (any approval approves the version)
- Users can change their vote by voting again
- Comments support threaded replies via `parent_comment_id`
- Weight system is stored in database but not used in current logic (for future use)


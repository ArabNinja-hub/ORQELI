# Academic Results & Report-Card Workflow Design

This document describes how ORQELI Education structures the end-of-term examination marks and report-card workflow for Zambian schools across the eight core capability areas under investigation.

---

## 1. Schools and School-Specific Records

Schools in Zambia operate across government, private, and community sectors with distinct administrative structures, class sizes, and connectivity realities.

- Every school is represented by a `School` record (`code`, `name`, `sector`, `province`, `district`, `timezone`, `status`).
- Every academic entity (`AcademicYear`, `AcademicTerm`, `SchoolClass`, `Subject`, `ClassSubjectAllocation`, `Learner`, `LearnerGuardianLink`, `TermResultPack`, `SubjectMark`, and school `AuditEvent`) belongs to exactly one `School` via `schoolId`.
- Staff and guardians can belong to one or more schools via `SchoolMembership`, but every API operation executes within a single explicit `:schoolId` boundary.

---

## 2. Academic Years, Terms, Classes, Subjects, Learners, and Staff

The Zambian school calendar typically follows a three-term academic year (`TERM_1`, `TERM_2`, `TERM_3`):

- **`AcademicYear`**: Scoped per school (e.g., `2026 Academic Year`, `isCurrent`).
- **`AcademicTerm`**: Child of `AcademicYear` (`TERM_1`, `TERM_2`, `TERM_3`).
- **`SchoolClass`**: Cohort within an academic year (e.g., `Grade 8B`, `Grade 9A`) with `gradeLevel` and optional homeroom/class teacher (`classTeacherMembershipId`).
- **`Subject`**: School-defined subject (`code`, `name`, `isCore`, `maxMark`) so primary, junior secondary, and senior secondary subject lists are not rigidly hardcoded.
- **`ClassSubjectAllocation`**: Explicit mapping of `(schoolClassId, subjectId)` → `teacherMembershipId`.
- **`Learner`**: School-scoped admission number (`@@unique([schoolId, admissionNumber])`), name, active class, guardian contact fields, and `preferredChannel`.

---

## 3. Marks Entered by Authorised Teachers

- Marks are recorded per `(termResultPackId, learnerId, subjectId)` in `SubjectMark`.
- Supported statuses:
  - `PENDING` — Not yet recorded (treated as a missing mark).
  - `PRESENT` — Numeric whole-number score (`0 <= score <= subject.maxMark`), plus optional concise `teacherComment`.
  - `ABSENT` — Verified examination absence (`score = null`), explicitly accounted for rather than silently treated as zero or left blank.
  - `EXEMPT` — Authorised subject exemption (`score = null`).
- **API Enforcement**: `PUT /api/schools/:schoolId/result-packs/:packId/marks` checks `ClassSubjectAllocation` on the server. A teacher allocated to English Language cannot enter or alter Mathematics marks (`403 SUBJECT_ALLOCATION_REQUIRED`).

---

## 4. Validation and Detection of Missing Entries

Missing or misplaced paper mark sheets are a primary cause of delayed end-of-term report cards.

- Completeness is computed deterministically across the Cartesian product of **active learners in `SchoolClass`** × **active `ClassSubjectAllocation` subjects**:
  - `expectedEntries = learners.length * allocatedSubjects.length`
  - Any cell with no `SubjectMark` row or `status === 'PENDING'` is surfaced in `completeness.missingItems` with the exact learner admission number, name, and subject.
- Attempting to submit, approve, or publish an incomplete pack fails at the API with `409 INCOMPLETE_MARKS`.

---

## 5. Review and Correction of Results

```text
  ┌─────────┐    submit (0 missing)    ┌───────────┐
  │  DRAFT  │ ───────────────────────▶ │ SUBMITTED │
  └─────────┘                          └─────┬─────┘
                                             │
                 ┌───────────────────────────┴───────────────────────────┐
                 │ request-revision (notes)                              │ approve (Head/Admin)
                 ▼                                                       ▼
        ┌────────────────┐   submit (0 missing)                 ┌──────────┐
        │ NEEDS_REVISION │ ───────────────────────────────────▶ │ APPROVED │
        └────────────────┘                                      └────┬─────┘
                 ▲                                                   │
                 │ request-revision (before publish)                 │ publish (Head/Admin)
                 └───────────────────────────────────────────────────┼──────┐
                                                                            ▼
                                                                     ┌───────────┐
                                                                     │ PUBLISHED │
                                                                     └───────────┘
```

- Once a pack leaves `DRAFT` for `SUBMITTED`, teacher mark editing is **locked** (`409 RESULT_PACK_LOCKED`) so numbers cannot shift underneath a reviewer.
- A Deputy Head, Head Teacher, or School Admin can return a `SUBMITTED` (or not-yet-published `APPROVED`) pack to `NEEDS_REVISION` with mandatory written `reviewNotes`.
- Teachers see the exact `reviewNotes`, correct their allocated subject marks (generating `MARK_UPDATED` audit records with `beforeState` and `afterState`), and resubmit.

---

## 6. Explicit Approval Before Publication

- Approval and publication are two distinct steps restricted to `HEAD_TEACHER` and `SCHOOL_ADMIN` roles:
  1. **`POST .../approve`**: Confirms academic accuracy (`SUBMITTED` → `APPROVED`). Unlocks internal staff printable previews so physical copies can be checked or stamped before release, while keeping parent endpoints dark.
  2. **`POST .../publish`**: Releases results (`APPROVED` → `PUBLISHED`). Calling `publish` on a `DRAFT`, `NEEDS_REVISION`, or `SUBMITTED` pack is rejected with `409 APPROVAL_REQUIRED_BEFORE_PUBLICATION`.

---

## 7. Printable Report Cards

In many Zambian schools, the physical end-of-term paper report card remains the authoritative record carried home by the learner:

- Report cards are rendered in a dedicated `@media print` A4 portrait layout (`apps/web/src/ReportCardPage.tsx` and `apps/web/src/styles.css`).
- Designed for **monochrome laser/inkjet duplication and low toner usage**: high-contrast black borders, zero dark background fills on print, tabular numeric columns, teacher remarks, Head Teacher approval attribution, school stamp block, and a **tear-off paper guardian acknowledgment slip**.

---

## 8. Verified Student Academic Portal & Low-Bandwidth Access

1. **CBU OPUS-Inspired Student Academic Portal (Implemented)**:
   - Secondary students who verify their account via a school-issued single-use enrolment code (`ENROLMENT_CODE`) or school leadership approval (`STAFF_APPROVAL`) can sign in at `/student` to inspect their verified school/class identity, **published** term results (subject marks, percentages, grade bands, and teacher remarks), term-by-term academic history, school notices, and printable A4 report cards.
   - Unpublished result packs (`DRAFT`, `SUBMITTED`, `NEEDS_REVISION`, and `APPROVED` prior to publication) show a clear status notice only — marks and remarks are never returned until `TermResultPack.status === 'PUBLISHED'`.
2. **Paper-First Baseline (Implemented)**: Every learner defaults to `preferredChannel = PRINT_REPORT`, and every printable A4 report card includes a physical tear-off acknowledgment slip so access never depends on continuous home internet.
3. **Feature-Phone SMS & USSD Channels (Candidate Extension — Not Yet Implemented)**:
   - Future phase will introduce an outbox table (`ResultNotificationDispatch`) triggered only when `TermResultPack` transitions to `PUBLISHED`, sending concise plain-text subject summaries via Zambian SMS aggregators alongside optional USSD lookup.

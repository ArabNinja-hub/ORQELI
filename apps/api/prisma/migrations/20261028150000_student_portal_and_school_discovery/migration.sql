-- AlterEnum
ALTER TYPE "SchoolRole" ADD VALUE 'STUDENT';

-- CreateEnum
CREATE TYPE "StudentVerificationMethod" AS ENUM ('ENROLMENT_CODE', 'STAFF_APPROVAL');

-- CreateEnum
CREATE TYPE "StudentRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('STUDENTS_AND_STAFF', 'STAFF_ONLY');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "levelSummary" TEXT NOT NULL DEFAULT 'Secondary (Grades 8-12)',
ADD COLUMN     "publicDescription" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "studentPortalEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LearnerStudentLink" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "verifiedByMembershipId" TEXT,
    "verificationMethod" "StudentVerificationMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnerStudentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrolmentCode" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeHint" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedByMembershipId" TEXT,
    "createdByMembershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentEnrolmentCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRegistrationRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAdmissionNumber" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "classHint" TEXT,
    "status" "StudentRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "linkedLearnerId" TEXT,
    "reviewedByMembershipId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentRegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolAnnouncement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'STUDENTS_AND_STAFF',
    "publishedByMembershipId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearnerStudentLink_membershipId_key" ON "LearnerStudentLink"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerStudentLink_learnerId_key" ON "LearnerStudentLink"("learnerId");

-- CreateIndex
CREATE INDEX "LearnerStudentLink_schoolId_idx" ON "LearnerStudentLink"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrolmentCode_codeHash_key" ON "StudentEnrolmentCode"("codeHash");

-- CreateIndex
CREATE INDEX "StudentEnrolmentCode_schoolId_learnerId_idx" ON "StudentEnrolmentCode"("schoolId", "learnerId");

-- CreateIndex
CREATE INDEX "StudentEnrolmentCode_schoolId_expiresAt_idx" ON "StudentEnrolmentCode"("schoolId", "expiresAt");

-- CreateIndex
CREATE INDEX "StudentRegistrationRequest_schoolId_status_createdAt_idx" ON "StudentRegistrationRequest"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StudentRegistrationRequest_userId_status_idx" ON "StudentRegistrationRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "SchoolAnnouncement_schoolId_publishedAt_idx" ON "SchoolAnnouncement"("schoolId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "School_registrationNumber_key" ON "School"("registrationNumber");

-- CreateIndex
CREATE INDEX "School_status_studentPortalEnabled_idx" ON "School"("status", "studentPortalEnabled");

-- AddForeignKey
ALTER TABLE "LearnerStudentLink" ADD CONSTRAINT "LearnerStudentLink_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerStudentLink" ADD CONSTRAINT "LearnerStudentLink_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "SchoolMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerStudentLink" ADD CONSTRAINT "LearnerStudentLink_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerStudentLink" ADD CONSTRAINT "LearnerStudentLink_verifiedByMembershipId_fkey" FOREIGN KEY ("verifiedByMembershipId") REFERENCES "SchoolMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrolmentCode" ADD CONSTRAINT "StudentEnrolmentCode_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrolmentCode" ADD CONSTRAINT "StudentEnrolmentCode_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrolmentCode" ADD CONSTRAINT "StudentEnrolmentCode_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrolmentCode" ADD CONSTRAINT "StudentEnrolmentCode_revokedByMembershipId_fkey" FOREIGN KEY ("revokedByMembershipId") REFERENCES "SchoolMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrolmentCode" ADD CONSTRAINT "StudentEnrolmentCode_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "SchoolMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRegistrationRequest" ADD CONSTRAINT "StudentRegistrationRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRegistrationRequest" ADD CONSTRAINT "StudentRegistrationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRegistrationRequest" ADD CONSTRAINT "StudentRegistrationRequest_linkedLearnerId_fkey" FOREIGN KEY ("linkedLearnerId") REFERENCES "Learner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRegistrationRequest" ADD CONSTRAINT "StudentRegistrationRequest_reviewedByMembershipId_fkey" FOREIGN KEY ("reviewedByMembershipId") REFERENCES "SchoolMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolAnnouncement" ADD CONSTRAINT "SchoolAnnouncement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolAnnouncement" ADD CONSTRAINT "SchoolAnnouncement_publishedByMembershipId_fkey" FOREIGN KEY ("publishedByMembershipId") REFERENCES "SchoolMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

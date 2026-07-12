const crypto = require('crypto');
const postgres = require('../db/postgres');
const { BOOTSTRAP_ORGANIZATION } = require('./tenantContext');

const ALLOWED_HAZARD_TYPES = new Set([
  'low_bridge',
  'truck_restriction',
  'weight_restriction',
  'height_restriction',
  'no_truck',
  'dangerous_turn',
  'hazardous_intersection',
  'road_closure',
  'construction',
  'unsafe_loading_entrance',
  'unsafe_parking',
  'residential'
]);

const PRIVATE_REFERENCE_PATTERNS = [
  /\bdriver\b/i,
  /\broute\b/i,
  /\bmanifest\b/i,
  /\bcustomer\b/i,
  /\baccount\b/i,
  /\binvoice\b/i,
  /\breceipt\b/i,
  /\bdelivery\b/i,
  /\bkpi\b/i,
  /\bemployee\b/i
];

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanNullableText(value, maxLength = 500) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function numeric(value, fallback = null) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function normalizeHazardType(value) {
  const normalized = cleanText(value || 'hazard', 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (ALLOWED_HAZARD_TYPES.has(normalized)) return normalized;
  return 'truck_restriction';
}

function assertDatabaseReady() {
  if (!postgres.isDatabaseConfigured()) {
    const error = new Error('Shared Safety requires DATABASE_URL.');
    error.status = 503;
    error.code = 'DATABASE_REQUIRED';
    throw error;
  }
}

function assertOrganizationContext(context) {
  const organizationId = cleanText(context?.organizationId, 120);
  if (!organizationId) {
    const error = new Error('Organization context is required.');
    error.status = 403;
    error.code = 'ORGANIZATION_CONTEXT_REQUIRED';
    throw error;
  }
  return organizationId;
}

function assertPlatformAdmin(context) {
  if (context?.approvedRole !== 'PLATFORM_ADMIN') {
    const error = new Error('Platform Admin permission is required.');
    error.status = 403;
    error.code = 'PLATFORM_ADMIN_REQUIRED';
    throw error;
  }
}

function assertSanitizedDescription(description) {
  const cleaned = cleanText(description, 700);
  if (!cleaned) {
    const error = new Error('Sanitized description is required before approval.');
    error.status = 400;
    error.code = 'SANITIZED_DESCRIPTION_REQUIRED';
    throw error;
  }
  const blocked = PRIVATE_REFERENCE_PATTERNS.find((pattern) => pattern.test(cleaned));
  if (blocked) {
    const error = new Error('Sanitized description still appears to contain private operational references.');
    error.status = 400;
    error.code = 'UNSANITIZED_PRIVATE_REFERENCE';
    throw error;
  }
  return cleaned;
}

function compactMetadata(value, fallback = {}) {
  if (!value || typeof value !== 'object') return fallback;
  return value;
}

function submissionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    submittedByUserId: row.submitted_by_user_id,
    internalDriverId: row.internal_driver_id,
    companyDriverNumber: row.company_driver_number,
    hazardType: row.hazard_type,
    latitude: row.latitude,
    longitude: row.longitude,
    heading: row.heading,
    direction: row.direction,
    description: row.description,
    source: row.source,
    severity: row.severity,
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    photoMetadata: row.photo_metadata || [],
    privateContext: row.private_context || {},
    moderationCandidateId: row.moderation_candidate_id,
    legacyManualHazardId: row.legacy_manual_hazard_id
  };
}

function candidateFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceSubmissionId: row.source_submission_id,
    sourceOrganizationId: row.source_organization_id,
    proposedSharedType: row.proposed_shared_type,
    sanitizedDescription: row.sanitized_description,
    sanitizedLatitude: row.sanitized_latitude,
    sanitizedLongitude: row.sanitized_longitude,
    sanitizedGeometry: row.sanitized_geometry || {},
    sanitizationStatus: row.sanitization_status,
    reviewStatus: row.review_status,
    reviewerUserId: row.reviewer_user_id,
    reviewNotes: row.review_notes,
    submittedForReviewAt: row.submitted_for_review_at,
    reviewedAt: row.reviewed_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    duplicateOfSharedRecordId: row.duplicate_of_shared_record_id,
    mergedIntoSharedRecordId: row.merged_into_shared_record_id,
    publishedSharedRecordId: row.published_shared_record_id,
    version: row.version
  };
}

function sharedRecordFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    hazardType: row.hazard_type,
    latitude: row.latitude,
    longitude: row.longitude,
    geometry: row.geometry || {},
    severity: row.severity,
    verificationStatus: row.verification_status,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    status: row.status,
    sourceClassification: row.source_classification,
    confidence: row.confidence,
    evidenceLevel: row.evidence_level,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    supersededBy: row.superseded_by,
    sanitizedMedia: row.sanitized_media || [],
    metadata: row.metadata || {}
  };
}

function buildPrivateSubmission(input, context) {
  const organizationId = assertOrganizationContext(context);
  const latitude = numeric(input.latitude ?? input.lat);
  const longitude = numeric(input.longitude ?? input.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error('Valid latitude and longitude are required.');
    error.status = 400;
    error.code = 'INVALID_COORDINATES';
    throw error;
  }
  return {
    id: cleanText(input.id, 120) || crypto.randomUUID(),
    organizationId,
    submittedByUserId: context.actorType === 'admin_user' ? cleanText(context.actorId, 120) : null,
    internalDriverId: context.actorType === 'driver' ? cleanText(context.actorId, 120) : cleanNullableText(input.internalDriverId, 120),
    companyDriverNumber: cleanNullableText(input.companyDriverNumber || input.driverId || input.driver_id, 120),
    hazardType: normalizeHazardType(input.hazardType || input.hazard_type || input.category),
    latitude,
    longitude,
    heading: numeric(input.heading ?? input.reported_heading),
    direction: cleanNullableText(input.direction, 80),
    description: cleanNullableText(input.description || input.notes, 700),
    source: cleanText(input.source || 'driver_report', 80) || 'driver_report',
    severity: cleanText(input.severity || 'medium', 40) || 'medium',
    status: 'submitted',
    photoMetadata: Array.isArray(input.photoMetadata || input.photos)
      ? (input.photoMetadata || input.photos).map((photo) => compactMetadata(photo, {})).slice(0, 8)
      : [],
    privateContext: compactMetadata(input.privateContext || input.private_context, {}),
    legacyManualHazardId: cleanNullableText(input.legacyManualHazardId || input.legacy_manual_hazard_id, 120),
    raw: compactMetadata(input.raw, {})
  };
}

async function createPrivateHazardSubmission(input, context) {
  assertDatabaseReady();
  const submission = buildPrivateSubmission(input, context);
  const result = await postgres.query(
    `INSERT INTO private_hazard_submissions (
      id, organization_id, submitted_by_user_id, internal_driver_id, company_driver_number,
      hazard_type, latitude, longitude, heading, direction, description, source, severity,
      status, photo_metadata, private_context, legacy_manual_hazard_id, raw, submitted_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15::jsonb, $16::jsonb, $17, $18::jsonb, NOW(), NOW()
    )
    RETURNING *`,
    [
      submission.id,
      submission.organizationId,
      submission.submittedByUserId,
      submission.internalDriverId,
      submission.companyDriverNumber,
      submission.hazardType,
      submission.latitude,
      submission.longitude,
      submission.heading,
      submission.direction,
      submission.description,
      submission.source,
      submission.severity,
      submission.status,
      JSON.stringify(submission.photoMetadata),
      JSON.stringify(submission.privateContext),
      submission.legacyManualHazardId,
      JSON.stringify(submission.raw)
    ]
  );
  const created = submissionFromRow(result.rows[0]);
  if (bool(input.mayBenefitOthers || input.sharedSafetyCandidate || input.shareWithPlatform)) {
    const candidate = await nominateSubmission(created.id, context, {
      proposedSharedType: created.hazardType,
      reviewNotes: 'Driver marked this hazard as potentially useful for shared safety review.'
    });
    return { submission: { ...created, moderationCandidateId: candidate.id }, candidate };
  }
  return { submission: created, candidate: null };
}

async function createPrivateSubmissionFromDriverReport(hazard, context, photos = [], requestBody = {}) {
  if (!postgres.isDatabaseConfigured()) return null;
  return createPrivateHazardSubmission({
    id: `shared-${hazard.id}`,
    category: hazard.category,
    latitude: hazard.latitude,
    longitude: hazard.longitude,
    heading: hazard.reported_heading,
    description: hazard.notes,
    source: 'legacy_mobile_manual_hazard_report',
    severity: hazard.confidence === 'high' ? 'high' : 'medium',
    photoMetadata: photos,
    legacyManualHazardId: hazard.id,
    companyDriverNumber: context.companyDriverNumber || context.driverId,
    privateContext: {
      routeDestination: hazard.route_destination || null,
      nearbyAddress: hazard.nearby_address || null
    },
    raw: { legacyManualHazardId: hazard.id },
    mayBenefitOthers: requestBody.mayBenefitOthers || requestBody.sharedSafetyCandidate || requestBody.shareWithPlatform
  }, {
    actorType: 'driver',
    actorId: context.internalDriverId || context.driverId,
    organizationId: context.organizationId || BOOTSTRAP_ORGANIZATION.id
  });
}

async function listPrivateSubmissions(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = assertOrganizationContext(context);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 100, 1), 250);
  const status = cleanNullableText(filters.status, 60);
  const params = [organizationId, limit];
  let where = 'organization_id = $1 AND deleted_at IS NULL';
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  const result = await postgres.query(
    `SELECT * FROM private_hazard_submissions
     WHERE ${where}
     ORDER BY submitted_at DESC
     LIMIT $2`,
    params
  );
  return result.rows.map(submissionFromRow);
}

async function getPrivateSubmissionForOrganization(id, context) {
  assertDatabaseReady();
  const organizationId = assertOrganizationContext(context);
  const result = await postgres.query(
    `SELECT * FROM private_hazard_submissions
     WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [cleanText(id, 120), organizationId]
  );
  return submissionFromRow(result.rows[0]);
}

async function nominateSubmission(id, context, input = {}) {
  assertDatabaseReady();
  const submission = await getPrivateSubmissionForOrganization(id, context);
  if (!submission) {
    const error = new Error('Private hazard submission not found.');
    error.status = 404;
    error.code = 'PRIVATE_SUBMISSION_NOT_FOUND';
    throw error;
  }
  if (submission.moderationCandidateId) {
    const existing = await postgres.query(
      'SELECT * FROM shared_safety_moderation_candidates WHERE id = $1',
      [submission.moderationCandidateId]
    );
    return candidateFromRow(existing.rows[0]);
  }
  const candidateId = crypto.randomUUID();
  const result = await postgres.query(
    `WITH candidate AS (
      INSERT INTO shared_safety_moderation_candidates (
        id, source_submission_id, source_organization_id, proposed_shared_type,
        sanitization_status, review_status, review_notes, submitted_for_review_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'pending_sanitization', 'pending_review', $5, NOW(), NOW(), NOW())
      RETURNING *
    )
    UPDATE private_hazard_submissions
    SET moderation_candidate_id = $1, status = 'submitted_for_platform_review', updated_at = NOW()
    WHERE id = $2 AND organization_id = $3
    RETURNING (SELECT row_to_json(candidate.*) FROM candidate) AS candidate`,
    [
      candidateId,
      submission.id,
      submission.organizationId,
      normalizeHazardType(input.proposedSharedType || submission.hazardType),
      cleanNullableText(input.reviewNotes, 700)
    ]
  );
  return candidateFromRow(result.rows[0]?.candidate);
}

async function listModerationCandidates(context, filters = {}) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const status = cleanNullableText(filters.status, 80);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 100, 1), 250);
  const params = [limit];
  let where = '1 = 1';
  if (status) {
    params.push(status);
    where += ` AND review_status = $${params.length}`;
  }
  const result = await postgres.query(
    `SELECT * FROM shared_safety_moderation_candidates
     WHERE ${where}
     ORDER BY submitted_for_review_at DESC
     LIMIT $1`,
    params
  );
  return result.rows.map(candidateFromRow);
}

async function sanitizeCandidate(id, context, input = {}) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const sanitizedDescription = assertSanitizedDescription(input.sanitizedDescription || input.sanitized_description);
  const latitude = numeric(input.sanitizedLatitude ?? input.latitude);
  const longitude = numeric(input.sanitizedLongitude ?? input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error('Sanitized coordinates are required.');
    error.status = 400;
    error.code = 'SANITIZED_COORDINATES_REQUIRED';
    throw error;
  }
  const result = await postgres.query(
    `UPDATE shared_safety_moderation_candidates
     SET sanitized_description = $2,
         sanitized_latitude = $3,
         sanitized_longitude = $4,
         sanitized_geometry = $5::jsonb,
         sanitization_status = 'sanitized',
         reviewer_user_id = $6,
         review_notes = COALESCE($7, review_notes),
         updated_at = NOW(),
         version = version + 1
     WHERE id = $1 AND review_status IN ('pending_review', 'correction_requested')
     RETURNING *`,
    [
      cleanText(id, 120),
      sanitizedDescription,
      latitude,
      longitude,
      JSON.stringify(compactMetadata(input.sanitizedGeometry || input.geometry, { type: 'Point', coordinates: [longitude, latitude] })),
      cleanNullableText(context.actorId, 120),
      cleanNullableText(input.reviewNotes, 700)
    ]
  );
  if (!result.rows[0]) {
    const error = new Error('Moderation candidate not found or not sanitizable.');
    error.status = 404;
    error.code = 'CANDIDATE_NOT_SANITIZABLE';
    throw error;
  }
  return candidateFromRow(result.rows[0]);
}

async function approveCandidate(id, context, input = {}) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  return postgres.withTransaction(async (client) => {
    const candidateResult = await client.query(
      `SELECT * FROM shared_safety_moderation_candidates
       WHERE id = $1
       FOR UPDATE`,
      [cleanText(id, 120)]
    );
    const candidate = candidateResult.rows[0];
    if (!candidate || candidate.review_status !== 'pending_review' || candidate.sanitization_status !== 'sanitized') {
      const error = new Error('Candidate must be pending review with sanitized content before approval.');
      error.status = 400;
      error.code = 'SANITIZATION_REQUIRED_BEFORE_APPROVAL';
      throw error;
    }
    assertSanitizedDescription(candidate.sanitized_description);
    const sharedRecordId = crypto.randomUUID();
    const sharedResult = await client.query(
      `INSERT INTO shared_safety_records (
        id, hazard_type, latitude, longitude, geometry, severity, verification_status,
        effective_from, effective_to, status, source_classification, confidence, evidence_level,
        approved_by, approved_at, sanitized_media, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, 'approved', COALESCE($7::timestamptz, NOW()),
        $8::timestamptz, 'active', 'approved_shared_safety', $9, $10, $11, NOW(),
        $12::jsonb, $13::jsonb, NOW(), NOW()
      )
      RETURNING *`,
      [
        sharedRecordId,
        candidate.proposed_shared_type,
        candidate.sanitized_latitude,
        candidate.sanitized_longitude,
        JSON.stringify(candidate.sanitized_geometry || {}),
        cleanText(input.severity || 'medium', 40),
        input.effectiveFrom || null,
        input.effectiveTo || null,
        cleanText(input.confidence || 'medium', 40),
        cleanText(input.evidenceLevel || 'reviewed_submission', 80),
        cleanText(context.actorId, 120),
        JSON.stringify(Array.isArray(input.sanitizedMedia) ? input.sanitizedMedia : []),
        JSON.stringify(compactMetadata(input.metadata, {}))
      ]
    );
    await client.query(
      `UPDATE shared_safety_moderation_candidates
       SET review_status = 'approved',
           reviewer_user_id = $2,
           reviewed_at = NOW(),
           approved_at = NOW(),
           published_shared_record_id = $3,
           review_notes = COALESCE($4, review_notes),
           updated_at = NOW(),
           version = version + 1
       WHERE id = $1`,
      [
        candidate.id,
        cleanText(context.actorId, 120),
        sharedRecordId,
        cleanNullableText(input.reviewNotes, 700)
      ]
    );
    await client.query(
      `UPDATE private_hazard_submissions
       SET status = 'shared_approved', updated_at = NOW()
       WHERE id = $1`,
      [candidate.source_submission_id]
    );
    await client.query(
      `INSERT INTO shared_safety_publication_sources (
        shared_record_id, moderation_candidate_id, source_submission_id, source_organization_id, created_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [sharedRecordId, candidate.id, candidate.source_submission_id, candidate.source_organization_id]
    );
    return sharedRecordFromRow(sharedResult.rows[0]);
  });
}

async function rejectCandidate(id, context, input = {}) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const result = await postgres.query(
    `UPDATE shared_safety_moderation_candidates
     SET review_status = 'rejected',
         reviewer_user_id = $2,
         reviewed_at = NOW(),
         rejected_at = NOW(),
         rejection_reason = $3,
         review_notes = COALESCE($4, review_notes),
         updated_at = NOW(),
         version = version + 1
     WHERE id = $1 AND review_status IN ('pending_review', 'correction_requested')
     RETURNING *`,
    [
      cleanText(id, 120),
      cleanText(context.actorId, 120),
      cleanNullableText(input.rejectionReason || input.reason, 700),
      cleanNullableText(input.reviewNotes, 700)
    ]
  );
  if (!result.rows[0]) {
    const error = new Error('Moderation candidate not found or not rejectable.');
    error.status = 404;
    error.code = 'CANDIDATE_NOT_REJECTABLE';
    throw error;
  }
  await postgres.query(
    `UPDATE private_hazard_submissions
     SET status = 'shared_rejected', updated_at = NOW()
     WHERE id = $1`,
    [result.rows[0].source_submission_id]
  );
  return candidateFromRow(result.rows[0]);
}

async function markDuplicate(id, context, input = {}) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const duplicateOf = cleanText(input.duplicateOfSharedRecordId || input.sharedRecordId, 120);
  if (!duplicateOf) {
    const error = new Error('Existing shared record ID is required.');
    error.status = 400;
    error.code = 'DUPLICATE_RECORD_REQUIRED';
    throw error;
  }
  const result = await postgres.query(
    `UPDATE shared_safety_moderation_candidates
     SET review_status = 'duplicate',
         reviewer_user_id = $2,
         duplicate_of_shared_record_id = $3,
         reviewed_at = NOW(),
         review_notes = COALESCE($4, review_notes),
         updated_at = NOW(),
         version = version + 1
     WHERE id = $1 AND review_status IN ('pending_review', 'correction_requested')
     RETURNING *`,
    [cleanText(id, 120), cleanText(context.actorId, 120), duplicateOf, cleanNullableText(input.reviewNotes, 700)]
  );
  if (!result.rows[0]) {
    const error = new Error('Moderation candidate not found or not markable as duplicate.');
    error.status = 404;
    error.code = 'CANDIDATE_NOT_DUPLICATE_MARKABLE';
    throw error;
  }
  return candidateFromRow(result.rows[0]);
}

async function retireSharedRecord(id, context, input = {}) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const result = await postgres.query(
    `UPDATE shared_safety_records
     SET status = 'retired',
         effective_to = COALESCE($2::timestamptz, NOW()),
         metadata = metadata || $3::jsonb,
         updated_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [
      cleanText(id, 120),
      input.effectiveTo || null,
      JSON.stringify({ retiredBy: cleanText(context.actorId, 120), retireReason: cleanNullableText(input.reason, 700) })
    ]
  );
  if (!result.rows[0]) {
    const error = new Error('Active shared safety record not found.');
    error.status = 404;
    error.code = 'SHARED_RECORD_NOT_FOUND';
    throw error;
  }
  return sharedRecordFromRow(result.rows[0]);
}

async function listSharedRecords(filters = {}) {
  assertDatabaseReady();
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 100, 1), 250);
  const params = [limit];
  const where = ['status = $2', 'verification_status = $3'];
  params.push(cleanText(filters.status || 'active', 40));
  params.push('approved');
  if (filters.hazardType || filters.hazard_type || filters.type) {
    params.push(normalizeHazardType(filters.hazardType || filters.hazard_type || filters.type));
    where.push(`hazard_type = $${params.length}`);
  }
  const north = numeric(filters.north);
  const south = numeric(filters.south);
  const east = numeric(filters.east);
  const west = numeric(filters.west);
  if ([north, south, east, west].every(Number.isFinite)) {
    params.push(south, north, west, east);
    where.push(`latitude BETWEEN $${params.length - 3} AND $${params.length - 2}`);
    where.push(`longitude BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  const result = await postgres.query(
    `SELECT id, hazard_type, latitude, longitude, geometry, severity, verification_status,
            effective_from, effective_to, status, source_classification, confidence,
            evidence_level, approved_by, approved_at, created_at, updated_at, superseded_by,
            sanitized_media, metadata
     FROM shared_safety_records
     WHERE ${where.join(' AND ')}
       AND effective_from <= NOW()
       AND (effective_to IS NULL OR effective_to > NOW())
     ORDER BY updated_at DESC
     LIMIT $1`,
    params
  );
  return result.rows.map(sharedRecordFromRow);
}

module.exports = {
  ALLOWED_HAZARD_TYPES,
  approveCandidate,
  createPrivateHazardSubmission,
  createPrivateSubmissionFromDriverReport,
  listModerationCandidates,
  listPrivateSubmissions,
  listSharedRecords,
  markDuplicate,
  nominateSubmission,
  rejectCandidate,
  retireSharedRecord,
  sanitizeCandidate
};

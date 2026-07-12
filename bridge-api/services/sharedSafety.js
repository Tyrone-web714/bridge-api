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

function assertNoPrivateReferenceInJson(value, code = 'UNSANITIZED_SHARED_DATA') {
  const serialized = JSON.stringify(value || {});
  const blocked = PRIVATE_REFERENCE_PATTERNS.find((pattern) => pattern.test(serialized));
  const privateUrl = /private|manual-hazards|hazard-reports|delivery-notes|receipt|manifest|route/i.test(serialized)
    || /https?:\/\/(localhost|127\.0\.0\.1)/i.test(serialized);
  if (blocked || privateUrl) {
    const error = new Error('Shared Safety publication data still appears to contain private operational references.');
    error.status = 400;
    error.code = code;
    throw error;
  }
}

function sanitizeSharedMedia(value) {
  const media = Array.isArray(value) ? value : [];
  return media.slice(0, 8).map((item) => {
    const safe = {
      id: cleanNullableText(item?.id, 120),
      type: cleanNullableText(item?.type || item?.mediaType, 80),
      url: cleanNullableText(item?.url || item?.publicUrl, 1000),
      caption: cleanNullableText(item?.caption, 240),
      approvedAt: cleanNullableText(item?.approvedAt || new Date().toISOString(), 80)
    };
    assertNoPrivateReferenceInJson(safe, 'UNSANITIZED_SHARED_MEDIA');
    if (!safe.url) {
      const error = new Error('Approved shared media requires a sanitized public URL.');
      error.status = 400;
      error.code = 'SANITIZED_MEDIA_URL_REQUIRED';
      throw error;
    }
    return safe;
  });
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
    sanitizedMedia: row.sanitized_media || []
  };
}

function auditEventFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestId: row.request_id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    eventType: row.event_type,
    outcome: row.outcome,
    statusCode: row.status_code,
    occurredAt: row.occurred_at,
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
  const hazardType = filters.hazardType || filters.hazard_type || filters.type;
  const sourceOrganizationId = cleanNullableText(filters.sourceOrganizationId || filters.source_organization_id, 120);
  const sort = cleanText(filters.sort || 'newest', 40);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 100, 1), 250);
  const offset = Math.max(Number.parseInt(filters.offset, 10) || 0, 0);
  const params = [limit];
  let where = '1 = 1';
  if (status) {
    params.push(status);
    where += ` AND review_status = $${params.length}`;
  }
  if (hazardType) {
    params.push(normalizeHazardType(hazardType));
    where += ` AND proposed_shared_type = $${params.length}`;
  }
  if (sourceOrganizationId) {
    params.push(sourceOrganizationId);
    where += ` AND source_organization_id = $${params.length}`;
  }
  if (filters.submittedFrom || filters.submitted_from) {
    params.push(filters.submittedFrom || filters.submitted_from);
    where += ` AND submitted_for_review_at >= $${params.length}::timestamptz`;
  }
  if (filters.submittedTo || filters.submitted_to) {
    params.push(filters.submittedTo || filters.submitted_to);
    where += ` AND submitted_for_review_at <= $${params.length}::timestamptz`;
  }
  if (filters.severity) {
    params.push(cleanText(filters.severity, 40));
    where += ` AND EXISTS (
      SELECT 1 FROM private_hazard_submissions s
      WHERE s.id = source_submission_id AND s.severity = $${params.length}
    )`;
  }
  params.push(offset);
  const orderBy = sort === 'oldest'
    ? 'submitted_for_review_at ASC'
    : sort === 'status'
      ? 'review_status ASC, submitted_for_review_at DESC'
      : sort === 'type'
        ? 'proposed_shared_type ASC, submitted_for_review_at DESC'
        : 'submitted_for_review_at DESC';
  const result = await postgres.query(
    `SELECT * FROM shared_safety_moderation_candidates
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $1 OFFSET $${params.length}`,
    params
  );
  return result.rows.map(candidateFromRow);
}

async function getModerationCandidateDetail(id, context) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const candidateResult = await postgres.query(
    `SELECT c.*, s.hazard_type AS source_hazard_type, s.latitude AS source_latitude,
            s.longitude AS source_longitude, s.heading AS source_heading,
            s.direction AS source_direction, s.description AS source_description,
            s.source AS source_submission_source, s.severity AS source_severity,
            s.status AS source_submission_status, s.submitted_at AS source_submitted_at,
            s.updated_at AS source_updated_at, s.photo_metadata AS source_photo_metadata,
            s.private_context AS source_private_context, s.internal_driver_id AS source_internal_driver_id,
            s.company_driver_number AS source_company_driver_number, s.submitted_by_user_id AS source_submitted_by_user_id,
            o.name AS source_organization_name
     FROM shared_safety_moderation_candidates c
     JOIN private_hazard_submissions s ON s.id = c.source_submission_id
     LEFT JOIN organizations o ON o.id = c.source_organization_id
     WHERE c.id = $1`,
    [cleanText(id, 120)]
  );
  const row = candidateResult.rows[0];
  if (!row) {
    const error = new Error('Moderation candidate not found.');
    error.status = 404;
    error.code = 'CANDIDATE_NOT_FOUND';
    throw error;
  }
  const candidate = candidateFromRow(row);
  const sourceSubmission = {
    id: row.source_submission_id,
    organizationId: row.source_organization_id,
    organizationName: row.source_organization_name || row.source_organization_id,
    hazardType: row.source_hazard_type,
    latitude: row.source_latitude,
    longitude: row.source_longitude,
    heading: row.source_heading,
    direction: row.source_direction,
    description: row.source_description,
    source: row.source_submission_source,
    severity: row.source_severity,
    status: row.source_submission_status,
    submittedAt: row.source_submitted_at,
    updatedAt: row.source_updated_at,
    photoMetadata: row.source_photo_metadata || [],
    privateContext: row.source_private_context || {},
    internalDriverId: row.source_internal_driver_id,
    companyDriverNumber: row.source_company_driver_number,
    submittedByUserId: row.source_submitted_by_user_id
  };
  const auditEvents = await listModerationAuditEvents(id, context);
  return { candidate, sourceSubmission, auditEvents };
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
         proposed_shared_type = COALESCE($8, proposed_shared_type),
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
      cleanNullableText(input.reviewNotes, 700),
      (input.proposedSharedType || input.hazardType || input.hazard_type)
        ? normalizeHazardType(input.proposedSharedType || input.hazardType || input.hazard_type)
        : null
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

async function requestCandidateCorrection(id, context, input = {}) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const note = cleanNullableText(input.reviewNotes || input.note || input.reason, 700);
  if (!note) {
    const error = new Error('Reviewer note is required to request correction.');
    error.status = 400;
    error.code = 'CORRECTION_NOTE_REQUIRED';
    throw error;
  }
  const result = await postgres.query(
    `UPDATE shared_safety_moderation_candidates
     SET review_status = 'correction_requested',
         sanitization_status = CASE WHEN sanitization_status = 'sanitized' THEN 'pending_sanitization' ELSE sanitization_status END,
         reviewer_user_id = $2,
         review_notes = $3,
         reviewed_at = NOW(),
         updated_at = NOW(),
         version = version + 1
     WHERE id = $1 AND review_status IN ('pending_review', 'correction_requested')
     RETURNING *`,
    [cleanText(id, 120), cleanText(context.actorId, 120), note]
  );
  if (!result.rows[0]) {
    const error = new Error('Moderation candidate not found or not correctable.');
    error.status = 404;
    error.code = 'CANDIDATE_NOT_CORRECTABLE';
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
    const sanitizedMedia = sanitizeSharedMedia(input.sanitizedMedia);
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
        JSON.stringify(sanitizedMedia),
        JSON.stringify({})
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

async function mergeCandidateIntoSharedRecord(id, context, input = {}) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const sharedRecordId = cleanText(input.sharedRecordId || input.mergedIntoSharedRecordId, 120);
  if (!sharedRecordId) {
    const error = new Error('Existing shared record ID is required for merge/link.');
    error.status = 400;
    error.code = 'MERGE_RECORD_REQUIRED';
    throw error;
  }
  return postgres.withTransaction(async (client) => {
    const existing = await client.query(
      'SELECT id FROM shared_safety_records WHERE id = $1 AND status IN ($2, $3)',
      [sharedRecordId, 'active', 'retired']
    );
    if (!existing.rows[0]) {
      const error = new Error('Target shared safety record was not found.');
      error.status = 404;
      error.code = 'MERGE_RECORD_NOT_FOUND';
      throw error;
    }
    const result = await client.query(
      `UPDATE shared_safety_moderation_candidates
       SET review_status = 'merged',
           reviewer_user_id = $2,
           merged_into_shared_record_id = $3,
           reviewed_at = NOW(),
           review_notes = COALESCE($4, review_notes),
           updated_at = NOW(),
           version = version + 1
       WHERE id = $1 AND review_status IN ('pending_review', 'correction_requested')
       RETURNING *`,
      [cleanText(id, 120), cleanText(context.actorId, 120), sharedRecordId, cleanNullableText(input.reviewNotes, 700)]
    );
    if (!result.rows[0]) {
      const error = new Error('Moderation candidate not found or not mergeable.');
      error.status = 404;
      error.code = 'CANDIDATE_NOT_MERGEABLE';
      throw error;
    }
    await client.query(
      `INSERT INTO shared_safety_publication_sources (
        shared_record_id, moderation_candidate_id, source_submission_id, source_organization_id, created_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [sharedRecordId, result.rows[0].id, result.rows[0].source_submission_id, result.rows[0].source_organization_id]
    );
    return candidateFromRow(result.rows[0]);
  });
}

async function rejectCandidate(id, context, input = {}) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const rejectionReason = cleanNullableText(input.rejectionReason || input.reason, 700);
  if (!rejectionReason) {
    const error = new Error('Rejection reason is required.');
    error.status = 400;
    error.code = 'REJECTION_REASON_REQUIRED';
    throw error;
  }
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
      rejectionReason,
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
  const reason = cleanNullableText(input.reason, 700);
  if (!reason) {
    const error = new Error('Retirement reason is required.');
    error.status = 400;
    error.code = 'RETIRE_REASON_REQUIRED';
    throw error;
  }
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
      JSON.stringify({ retiredBy: cleanText(context.actorId, 120), retireReason: reason })
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

async function supersedeSharedRecord(id, context, input = {}) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const replacementId = cleanText(input.replacementSharedRecordId || input.supersededBy, 120);
  const reason = cleanNullableText(input.reason, 700);
  if (!replacementId || replacementId === cleanText(id, 120)) {
    const error = new Error('Replacement shared record ID is required.');
    error.status = 400;
    error.code = 'REPLACEMENT_RECORD_REQUIRED';
    throw error;
  }
  if (!reason) {
    const error = new Error('Supersession reason is required.');
    error.status = 400;
    error.code = 'SUPERSEDE_REASON_REQUIRED';
    throw error;
  }
  const result = await postgres.query(
    `UPDATE shared_safety_records
     SET status = 'superseded',
         superseded_by = $2,
         effective_to = COALESCE($3::timestamptz, NOW()),
         metadata = metadata || $4::jsonb,
         updated_at = NOW()
     WHERE id = $1 AND status = 'active'
       AND EXISTS (SELECT 1 FROM shared_safety_records WHERE id = $2)
     RETURNING *`,
    [
      cleanText(id, 120),
      replacementId,
      input.effectiveTo || null,
      JSON.stringify({ supersededByActor: cleanText(context.actorId, 120), supersedeReason: reason })
    ]
  );
  if (!result.rows[0]) {
    const error = new Error('Active shared safety record or replacement record not found.');
    error.status = 404;
    error.code = 'SHARED_RECORD_NOT_SUPERSEDABLE';
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
            sanitized_media
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

async function listModerationAuditEvents(candidateId, context) {
  assertDatabaseReady();
  assertPlatformAdmin(context);
  const result = await postgres.query(
    `SELECT id, request_id, actor_type, actor_id, event_type, outcome, status_code,
            occurred_at, metadata
     FROM audit_events
     WHERE metadata ->> 'candidateId' = $1
        OR path LIKE $2
     ORDER BY occurred_at DESC
     LIMIT 100`,
    [cleanText(candidateId, 120), `%${cleanText(candidateId, 120)}%`]
  );
  return result.rows.map(auditEventFromRow);
}

module.exports = {
  ALLOWED_HAZARD_TYPES,
  approveCandidate,
  createPrivateHazardSubmission,
  createPrivateSubmissionFromDriverReport,
  getModerationCandidateDetail,
  listModerationAuditEvents,
  listModerationCandidates,
  listPrivateSubmissions,
  listSharedRecords,
  markDuplicate,
  mergeCandidateIntoSharedRecord,
  nominateSubmission,
  requestCandidateCorrection,
  rejectCandidate,
  retireSharedRecord,
  supersedeSharedRecord,
  sanitizeCandidate
};

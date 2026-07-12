CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO role_permissions (role, permission)
VALUES
  ('PLATFORM_ADMIN', 'hazard.submit'),
  ('PLATFORM_ADMIN', 'hazard.view.organization'),
  ('PLATFORM_ADMIN', 'hazard.review.organization'),
  ('PLATFORM_ADMIN', 'shared_safety.review'),
  ('PLATFORM_ADMIN', 'shared_safety.approve'),
  ('PLATFORM_ADMIN', 'shared_safety.reject'),
  ('PLATFORM_ADMIN', 'shared_safety.publish'),
  ('PLATFORM_ADMIN', 'shared_safety.retire'),
  ('ORGANIZATION_ADMIN', 'hazard.submit'),
  ('ORGANIZATION_ADMIN', 'hazard.view.organization'),
  ('ORGANIZATION_ADMIN', 'hazard.review.organization'),
  ('SUPERVISOR', 'hazard.view.organization'),
  ('SUPERVISOR', 'hazard.review.organization'),
  ('DRIVER', 'hazard.submit')
ON CONFLICT (role, permission) DO NOTHING;

CREATE TABLE IF NOT EXISTS private_hazard_submissions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  submitted_by_user_id TEXT,
  internal_driver_id TEXT,
  company_driver_number TEXT,
  hazard_type TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  direction TEXT,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'driver_report',
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  photo_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  private_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  moderation_candidate_id TEXT,
  legacy_manual_hazard_id TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT private_hazard_submissions_status_check CHECK (
    status IN (
      'submitted',
      'submitted_for_platform_review',
      'correction_requested',
      'shared_approved',
      'shared_rejected',
      'archived'
    )
  ),
  CONSTRAINT private_hazard_submissions_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT private_hazard_submissions_longitude_check CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS private_hazard_submissions_org_status_idx
  ON private_hazard_submissions(organization_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS private_hazard_submissions_hazard_type_idx
  ON private_hazard_submissions(hazard_type);
CREATE INDEX IF NOT EXISTS private_hazard_submissions_lat_lng_idx
  ON private_hazard_submissions(latitude, longitude);
CREATE INDEX IF NOT EXISTS private_hazard_submissions_private_context_idx
  ON private_hazard_submissions USING GIN(private_context);

CREATE TABLE IF NOT EXISTS shared_safety_moderation_candidates (
  id TEXT PRIMARY KEY,
  source_submission_id TEXT NOT NULL REFERENCES private_hazard_submissions(id),
  source_organization_id TEXT NOT NULL REFERENCES organizations(id),
  proposed_shared_type TEXT NOT NULL,
  sanitized_description TEXT,
  sanitized_latitude DOUBLE PRECISION,
  sanitized_longitude DOUBLE PRECISION,
  sanitized_geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
  sanitization_status TEXT NOT NULL DEFAULT 'pending_sanitization',
  review_status TEXT NOT NULL DEFAULT 'pending_review',
  reviewer_user_id TEXT,
  review_notes TEXT,
  submitted_for_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  duplicate_of_shared_record_id TEXT,
  merged_into_shared_record_id TEXT,
  published_shared_record_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shared_safety_moderation_sanitization_status_check CHECK (
    sanitization_status IN ('pending_sanitization', 'sanitized', 'unsanitizable')
  ),
  CONSTRAINT shared_safety_moderation_review_status_check CHECK (
    review_status IN ('pending_review', 'correction_requested', 'approved', 'rejected', 'duplicate', 'merged')
  ),
  CONSTRAINT shared_safety_moderation_sanitized_latitude_check CHECK (
    sanitized_latitude IS NULL OR sanitized_latitude BETWEEN -90 AND 90
  ),
  CONSTRAINT shared_safety_moderation_sanitized_longitude_check CHECK (
    sanitized_longitude IS NULL OR sanitized_longitude BETWEEN -180 AND 180
  )
);

ALTER TABLE private_hazard_submissions
  ADD CONSTRAINT private_hazard_submissions_moderation_candidate_fk
  FOREIGN KEY (moderation_candidate_id) REFERENCES shared_safety_moderation_candidates(id);

CREATE INDEX IF NOT EXISTS shared_safety_moderation_status_idx
  ON shared_safety_moderation_candidates(review_status, sanitization_status, submitted_for_review_at DESC);
CREATE INDEX IF NOT EXISTS shared_safety_moderation_source_org_idx
  ON shared_safety_moderation_candidates(source_organization_id, review_status);
CREATE INDEX IF NOT EXISTS shared_safety_moderation_source_submission_idx
  ON shared_safety_moderation_candidates(source_submission_id);

CREATE TABLE IF NOT EXISTS shared_safety_records (
  id TEXT PRIMARY KEY,
  hazard_type TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'medium',
  verification_status TEXT NOT NULL DEFAULT 'approved',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  source_classification TEXT NOT NULL DEFAULT 'approved_shared_safety',
  confidence TEXT NOT NULL DEFAULT 'medium',
  evidence_level TEXT NOT NULL DEFAULT 'reviewed_submission',
  approved_by TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_by TEXT REFERENCES shared_safety_records(id),
  sanitized_media JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT shared_safety_records_status_check CHECK (status IN ('active', 'retired', 'superseded')),
  CONSTRAINT shared_safety_records_verification_status_check CHECK (verification_status IN ('approved', 'retired')),
  CONSTRAINT shared_safety_records_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT shared_safety_records_longitude_check CHECK (longitude BETWEEN -180 AND 180)
);

ALTER TABLE shared_safety_moderation_candidates
  ADD CONSTRAINT shared_safety_moderation_duplicate_record_fk
  FOREIGN KEY (duplicate_of_shared_record_id) REFERENCES shared_safety_records(id),
  ADD CONSTRAINT shared_safety_moderation_merged_record_fk
  FOREIGN KEY (merged_into_shared_record_id) REFERENCES shared_safety_records(id),
  ADD CONSTRAINT shared_safety_moderation_published_record_fk
  FOREIGN KEY (published_shared_record_id) REFERENCES shared_safety_records(id);

CREATE INDEX IF NOT EXISTS shared_safety_records_status_type_idx
  ON shared_safety_records(status, hazard_type, effective_from DESC);
CREATE INDEX IF NOT EXISTS shared_safety_records_lat_lng_idx
  ON shared_safety_records(latitude, longitude);
CREATE INDEX IF NOT EXISTS shared_safety_records_geometry_idx
  ON shared_safety_records USING GIN(geometry);
CREATE INDEX IF NOT EXISTS shared_safety_records_sanitized_media_idx
  ON shared_safety_records USING GIN(sanitized_media);

CREATE TABLE IF NOT EXISTS shared_safety_publication_sources (
  id BIGSERIAL PRIMARY KEY,
  shared_record_id TEXT NOT NULL REFERENCES shared_safety_records(id),
  moderation_candidate_id TEXT NOT NULL REFERENCES shared_safety_moderation_candidates(id),
  source_submission_id TEXT NOT NULL REFERENCES private_hazard_submissions(id),
  source_organization_id TEXT NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shared_safety_publication_sources_record_idx
  ON shared_safety_publication_sources(shared_record_id);
CREATE INDEX IF NOT EXISTS shared_safety_publication_sources_candidate_idx
  ON shared_safety_publication_sources(moderation_candidate_id);

require('dotenv').config();

const postgres = require('../db/postgres');
const sharedSafety = require('../services/sharedSafety');
const { BOOTSTRAP_ORGANIZATION } = require('../services/tenantContext');

function assert(condition, message) {
  if (!condition) throw new Error(`[shared-safety-runtime] ${message}`);
}

function context(overrides = {}) {
  return {
    actorType: 'driver',
    actorId: 'runtime-driver-1',
    organizationId: BOOTSTRAP_ORGANIZATION.id,
    approvedRole: 'DRIVER',
    ...overrides
  };
}

async function seedOrganization(id, name) {
  await postgres.query(
    `INSERT INTO organizations (id, name, slug, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active', updated_at = NOW()`,
    [id, name, id]
  );
}

async function main() {
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required');
  assert(/127\.0\.0\.1:5544\d/.test(process.env.DATABASE_URL), 'runtime validation must use isolated local PostgreSQL on a 5544x validation port');

  await seedOrganization(BOOTSTRAP_ORGANIZATION.id, BOOTSTRAP_ORGANIZATION.name);
  await seedOrganization('validation-org-b', 'Validation Organization B');

  const driverContext = context();
  const orgReviewer = context({
    actorType: 'admin_user',
    actorId: 'org-reviewer',
    approvedRole: 'SUPERVISOR'
  });
  const platformAdmin = context({
    actorType: 'admin_user',
    actorId: 'platform-admin',
    organizationId: null,
    approvedRole: 'PLATFORM_ADMIN'
  });

  const first = await sharedSafety.createPrivateHazardSubmission({
    hazardType: 'low_bridge',
    latitude: 29.421,
    longitude: -98.45,
    description: 'Driver reported private route context that must not publish.',
    privateContext: {
      routeNumber: 'PRIVATE-ROUTE',
      customerName: 'PRIVATE CUSTOMER'
    },
    mayBenefitOthers: false
  }, driverContext);
  assert(first.submission.organizationId === BOOTSTRAP_ORGANIZATION.id, 'submission must use trusted organization context');
  assert(!first.candidate, 'submission must not auto-publish or auto-nominate without explicit flag');

  const otherOrg = await sharedSafety.createPrivateHazardSubmission({
    hazardType: 'no_truck',
    latitude: 29.5,
    longitude: -98.4,
    description: 'Other org private evidence'
  }, context({
    actorId: 'other-driver',
    organizationId: 'validation-org-b'
  }));
  assert(otherOrg.submission.organizationId === 'validation-org-b', 'other org fixture must be created');

  const visibleToA = await sharedSafety.listPrivateSubmissions(driverContext, { limit: 50 });
  assert(visibleToA.some((submission) => submission.id === first.submission.id), 'organization A should see its own private submission');
  assert(!visibleToA.some((submission) => submission.id === otherOrg.submission.id), 'organization A must not see organization B private submission');

  const candidate = await sharedSafety.nominateSubmission(first.submission.id, orgReviewer, {
    proposedSharedType: 'low_bridge',
    reviewNotes: 'Nominate sanitized bridge hazard for platform review.'
  });
  assert(candidate.sourceOrganizationId === BOOTSTRAP_ORGANIZATION.id, 'candidate keeps restricted source organization');

  let unsanitizedRejected = false;
  try {
    await sharedSafety.sanitizeCandidate(candidate.id, platformAdmin, {
      sanitizedDescription: 'Driver route customer manifest content',
      latitude: 29.421,
      longitude: -98.45
    });
  } catch (error) {
    unsanitizedRejected = error.code === 'UNSANITIZED_PRIVATE_REFERENCE';
  }
  assert(unsanitizedRejected, 'unsanitizable content must not pass sanitization');

  await sharedSafety.sanitizeCandidate(candidate.id, platformAdmin, {
    sanitizedDescription: 'Low-clearance bridge affects commercial vehicles near the marked coordinates.',
    latitude: 29.421,
    longitude: -98.45
  });
  let privateMediaRejected = false;
  try {
    await sharedSafety.approveCandidate(candidate.id, platformAdmin, {
      severity: 'high',
      sanitizedMedia: [{ url: 'https://storage.example.invalid/hazard-reports/private-route-photo.jpg' }]
    });
  } catch (error) {
    privateMediaRejected = error.code === 'UNSANITIZED_SHARED_MEDIA';
  }
  assert(privateMediaRejected, 'private media references must not be published');
  const record = await sharedSafety.approveCandidate(candidate.id, platformAdmin, {
    severity: 'high',
    confidence: 'medium'
  });
  assert(record.status === 'active', 'approved record must be active');

  const shared = await sharedSafety.listSharedRecords({ north: 29.6, south: 29.3, east: -98.3, west: -98.6, limit: 20 });
  const published = shared.find((entry) => entry.id === record.id);
  assert(published, 'approved record must appear in shared read path');
  assert(!Object.prototype.hasOwnProperty.call(published, 'sourceOrganizationId'), 'shared record must not expose source organization');
  assert(!Object.prototype.hasOwnProperty.call(published, 'metadata'), 'shared record must not expose publication metadata');

  const rejection = await sharedSafety.createPrivateHazardSubmission({
    hazardType: 'truck_restriction',
    latitude: 29.43,
    longitude: -98.47,
    description: 'Private evidence for rejection test'
  }, driverContext);
  const rejectedCandidate = await sharedSafety.nominateSubmission(rejection.submission.id, orgReviewer, {
    proposedSharedType: 'truck_restriction'
  });
  await sharedSafety.rejectCandidate(rejectedCandidate.id, platformAdmin, { reason: 'Insufficient public safety evidence.' });
  const sharedAfterReject = await sharedSafety.listSharedRecords({ limit: 250 });
  assert(!sharedAfterReject.some((entry) => entry.id === rejectedCandidate.id), 'rejected candidate must not appear in shared reads');

  await sharedSafety.retireSharedRecord(record.id, platformAdmin, { reason: 'Runtime validation cleanup.' });
  const afterRetire = await sharedSafety.listSharedRecords({ limit: 250 });
  assert(!afterRetire.some((entry) => entry.id === record.id), 'retired record must not appear as active shared safety');

  console.log('[shared-safety-runtime] isolated database smoke checks passed');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => postgres.closePool());

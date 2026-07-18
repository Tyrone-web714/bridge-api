const express = require('express');
const repositories = require('../db/repositories');
const photoStorage = require('../services/photoStorage');
const authorization = require('../middleware/authorization');
const rbac = require('../services/rbac');

const router = express.Router();

function cleanText(value, maxLength = 220) {
  return String(value || '').trim().slice(0, maxLength);
}

function canViewMedia(context) {
  return rbac.hasPermission(context, rbac.PERMISSIONS.REPORTS_VIEW)
    || rbac.hasPermission(context, rbac.PERMISSIONS.DELIVERY_OPERATE)
    || rbac.hasPermission(context, rbac.PERMISSIONS.HAZARD_VIEW_ORGANIZATION)
    || rbac.hasPermission(context, rbac.PERMISSIONS.HAZARD_REVIEW_ORGANIZATION);
}

async function findDeliveryNoteMedia(mediaId, context) {
  const notes = repositories.isDatabaseEnabled()
    ? await repositories.listDeliveryNotes({ tenantContext: context })
    : [];

  for (const note of notes) {
    for (const photo of Array.isArray(note.photos) ? note.photos : []) {
      if (cleanText(photo?.id) === mediaId) {
        return {
          ownerType: 'delivery_note',
          ownerId: note.id,
          organizationId: note.organizationId,
          media: photo
        };
      }
    }
  }
  return null;
}

router.get('/:mediaId', authorization.requireAuthentication, async (req, res) => {
  try {
    req.authContext = authorization.buildAuthContext(req);
    if (!req.authContext.organizationId) {
      return res.status(403).json({ error: 'Organization context is required for media access.' });
    }
    if (!canViewMedia(req.authContext)) {
      return res.status(403).json({ error: 'Insufficient permission for media access.' });
    }

    const mediaId = cleanText(req.params.mediaId);
    if (!mediaId || mediaId.includes('/') || mediaId.includes('..')) {
      return res.status(400).json({ error: 'Invalid media id.' });
    }

    const match = await findDeliveryNoteMedia(mediaId, req.authContext);
    if (!match) {
      return res.status(404).json({ error: 'Media not found.' });
    }

    const media = match.media;
    if (cleanText(media.storageProvider, 40).toLowerCase() !== 's3') {
      return res.status(404).json({ error: 'Media object is not available through private object storage.' });
    }
    if (!cleanText(media.storageKey, 500) || media.storageKey.includes('..')) {
      return res.status(400).json({ error: 'Invalid media object reference.' });
    }

    const object = await photoStorage.readS3Object(media);
    const contentType = cleanText(media.mimeType || object.ContentType || 'application/octet-stream', 120);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, max-age=60');
    res.set('X-Content-Type-Options', 'nosniff');
    if (object.ContentLength) {
      res.set('Content-Length', String(object.ContentLength));
    }
    return object.Body.pipe(res);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : 'Unable to retrieve media.'
    });
  }
});

module.exports = router;

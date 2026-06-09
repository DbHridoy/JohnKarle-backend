/**
 * @swagger
 * tags:
 *   - name: Legacy Access
 *     description: Legacy-access settings, requests, and trusted-contact data access
 */

/**
 * @swagger
 * /api/v1/legacy-access/settings:
 *   patch:
 *     tags: [Legacy Access]
 *     summary: Enable or disable legacy access
 *     description: Requires authentication and current-password reauthentication.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [legacyAccessEnabled, currentPassword]
 *             properties:
 *               legacyAccessEnabled: { type: boolean, example: true }
 *               currentPassword: { type: string, example: SecurePass1 }
 *     responses:
 *       200:
 *         description: Settings updated
 */

/**
 * @swagger
 * /api/v1/legacy-access/requests:
 *   get:
 *     tags: [Legacy Access]
 *     summary: List legacy access requests for the authenticated trusted contact account
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Requests retrieved
 */

/**
 * @swagger
 * /api/v1/legacy-access/{requestId}/claim:
 *   post:
 *     tags: [Legacy Access]
 *     summary: Claim a waiting legacy access request after the unlock date
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request approved
 *       403:
 *         description: Waiting period not over or unauthorized
 *       400:
 *         description: Request expired or invalid state
 */

/**
 * @swagger
 * /api/v1/legacy-access/{requestId}/data:
 *   get:
 *     tags: [Legacy Access]
 *     summary: Get scoped, view-only legacy access data
 *     description: Returns only data explicitly allowed by the trusted contact access scope. Passwords, tokens, payment secrets, credentials, and admin-only data are never returned.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scoped legacy data returned
 *       403:
 *         description: Request not approved or unauthorized
 */

/**
 * @swagger
 * /api/v1/legacy-access/{requestId}/cancel:
 *   post:
 *     tags: [Legacy Access]
 *     summary: Cancel a legacy access request as the original user
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request cancelled
 */

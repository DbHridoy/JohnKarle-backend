/**
 * @swagger
 * tags:
 *   - name: Trusted Contacts
 *     description: Trusted contact management and invitation flows
 */

/**
 * @swagger
 * /api/v1/trusted-contacts:
 *   post:
 *     tags: [Trusted Contacts]
 *     summary: Add a trusted contact
 *     description: Requires authentication and current-password reauthentication. Creates a pending trusted contact, stores only a hashed invitation token, sends an invitation email, and records an audit log.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, inactivityDays, accessScope, currentPassword]
 *             properties:
 *               name: { type: string, example: Jane Trusted }
 *               email: { type: string, format: email, example: jane@example.com }
 *               phone: { type: string, example: "+15551234567" }
 *               inactivityDays: { type: integer, minimum: 30, maximum: 365, example: 90 }
 *               currentPassword: { type: string, example: SecurePass1 }
 *               accessScope:
 *                 $ref: "#/components/schemas/TrustedContactAccessScope"
 *     responses:
 *       201:
 *         description: Trusted contact created
 *       400:
 *         description: Validation or self-reference error
 *       401:
 *         description: Authentication or reauthentication failed
 *       409:
 *         description: Duplicate active trusted contact
 *   get:
 *     tags: [Trusted Contacts]
 *     summary: List trusted contacts
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Trusted contacts retrieved
 */

/**
 * @swagger
 * /api/v1/trusted-contacts/invitations:
 *   get:
 *     tags: [Trusted Contacts]
 *     summary: List pending trusted-contact invitations for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Trusted contact invitations retrieved
 *       401:
 *         description: Authentication required
 */

/**
 * @swagger
 * /api/v1/trusted-contacts/invitations/{id}/accept:
 *   post:
 *     tags: [Trusted Contacts]
 *     summary: Accept a pending trusted-contact invitation in-app
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation accepted
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Invitation not found
 */

/**
 * @swagger
 * /api/v1/trusted-contacts/invitations/{id}/decline:
 *   post:
 *     tags: [Trusted Contacts]
 *     summary: Decline a pending trusted-contact invitation in-app
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation declined
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Invitation not found
 */

/**
 * @swagger
 * /api/v1/trusted-contacts/{id}:
 *   patch:
 *     tags: [Trusted Contacts]
 *     summary: Update a trusted contact
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword]
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               inactivityDays: { type: integer, minimum: 30, maximum: 365 }
 *               accessScope:
 *                 $ref: "#/components/schemas/TrustedContactAccessScope"
 *               currentPassword: { type: string }
 *     responses:
 *       200:
 *         description: Trusted contact updated
 *   delete:
 *     tags: [Trusted Contacts]
 *     summary: Remove a trusted contact
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword]
 *             properties:
 *               currentPassword: { type: string }
 *     responses:
 *       200:
 *         description: Trusted contact removed
 */

/**
 * @swagger
 * /api/v1/trusted-contacts/invite/{token}:
 *   get:
 *     tags: [Trusted Contacts]
 *     summary: Validate a trusted contact invitation
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Safe invitation details returned
 *       400:
 *         description: Invalid or expired invitation
 */

/**
 * @swagger
 * /api/v1/trusted-contacts/invite/{token}/accept:
 *   post:
 *     tags: [Trusted Contacts]
 *     summary: Accept a trusted contact invitation
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation accepted
 *       400:
 *         description: Invalid or expired invitation
 */

/**
 * @swagger
 * /api/v1/trusted-contacts/invite/{token}/decline:
 *   post:
 *     tags: [Trusted Contacts]
 *     summary: Decline a trusted contact invitation
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation declined
 *       400:
 *         description: Invalid or expired invitation
 */

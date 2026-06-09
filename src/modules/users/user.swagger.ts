/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User profile & invitation management
 */

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get authenticated user's profile
 *     description: Returns the full public profile of the currently authenticated user.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: "#/components/schemas/PublicUser"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */

/**
 * @swagger
 * /api/v1/users/profile:
 *   patch:
 *     tags: [Users]
 *     summary: Update user profile
 *     description: Updates the authenticated user's profile. Supports multipart/form-data for profile picture upload.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 80
 *                 example: John Updated
 *               phoneNumber:
 *                 type: string
 *                 maxLength: 30
 *                 example: "+1234567890"
 *               address:
 *                 type: string
 *                 maxLength: 300
 *                 example: "123 Main St, Springfield"
 *               familyMembers:
 *                 type: string
 *                 description: 'JSON array of family member objects, e.g. [{"name":"Jane","email":"jane@example.com","role":"viewer"}]'
 *               notifications:
 *                 type: boolean
 *                 description: Enable/disable notifications
 *               aiInsight:
 *                 type: boolean
 *                 description: Enable/disable AI insights
 *               darkMode:
 *                 type: boolean
 *                 description: Enable/disable dark mode
 *               anonymousAnalytics:
 *                 type: boolean
 *                 description: Enable/disable anonymous analytics
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture image file (JPEG, PNG, WebP — max 5 MB)
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: "#/components/schemas/PublicUser"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */

/**
 * @swagger
 * /api/v1/users/invitations:
 *   post:
 *     tags: [Users]
 *     summary: Create a family invitation
 *     description: Invites a new family member by email. Creates a user account with an invitation token and sends an email with a temporary password and invitation link.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, role]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 80
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 254
 *                 example: jane@example.com
 *               role:
 *                 type: string
 *                 enum: [viewer, editor, owner]
 *                 example: viewer
 *     responses:
 *       201:
 *         description: Invitation sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitation:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: string
 *                           format: email
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                         role:
 *                           type: string
 *                           enum: [viewer, editor, owner]
 *                     message:
 *                       type: string
 *                       example: "Invitation sent successfully."
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       409:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */

/**
 * @swagger
 * /api/v1/users/invitations/accept:
 *   post:
 *     tags: [Users]
 *     summary: Accept a family invitation
 *     description: Accepts a pending invitation using the invitation token received via email. No authentication required.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 minLength: 1
 *                 description: The invitation token from the invitation email link.
 *     responses:
 *       200:
 *         description: Invitation accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       format: email
 *                     message:
 *                       type: string
 *                       example: "Invitation accepted successfully."
 *       400:
 *         description: Invalid or expired invitation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */

/**
 * @swagger
 * tags:
 *   - name: Memory Vault
 *     description: CRUD operations & timeline view for memories
 */

/**
 * @swagger
 * /api/v1/memory-vault:
 *   get:
 *     tags: [Memory Vault]
 *     summary: List all memories
 *     description: Retrieves a list of memories for the authenticated user, or for an accepted family member when `familyMemberUserId` is provided, sorted by memory date and creation time descending.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: familyMemberUserId
 *         required: false
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *         description: Accepted family member user id to filter memories by.
 *     responses:
 *       200:
 *         description: Memories list retrieved
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
 *                     memories:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/PublicMemoryVaultItem"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */

/**
 * @swagger
 * /api/v1/memory-vault/timeline:
 *   get:
 *     tags: [Memory Vault]
 *     summary: Get memories grouped by date
 *     description: Retrieves the timeline view for the authenticated user, or for an accepted family member when `familyMemberUserId` is provided, grouping memories by date (YYYY-MM-DD).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: familyMemberUserId
 *         required: false
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *         description: Accepted family member user id to filter the timeline by.
 *     responses:
 *       200:
 *         description: Timeline data retrieved
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
 *                     timeline:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/MemoryTimelineGroup"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */

/**
 * @swagger
 * /api/v1/memory-vault/{memoryId}:
 *   get:
 *     tags: [Memory Vault]
 *     summary: Get a specific memory item
 *     description: Retrieves detail of a single memory by ID.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memoryId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *         description: 24-character hexadecimal MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Memory retrieved
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
 *                     memory:
 *                       $ref: "#/components/schemas/PublicMemoryVaultItem"
 *       400:
 *         description: Invalid memory ID format
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
 *       404:
 *         description: Memory not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */

/**
 * @swagger
 * /api/v1/memory-vault:
 *   post:
 *     tags: [Memory Vault]
 *     summary: Create a new memory
 *     description: Creates a new memory item. Supports multipart/form-data for uploading files (images, videos, voice recordings).
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [type, whoseMemoryIsThis, title, narrative, date]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [photo, video, journal, voice]
 *                 example: photo
 *               whoseMemoryIsThis:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 120
 *                 example: "My son's first step"
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 160
 *                 example: "First Steps"
 *               narrative:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 example: "He walked from the sofa to the kitchen table."
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: ISO date-time string
 *                 example: "2025-01-15T10:30:00.000Z"
 *               tags:
 *                 type: string
 *                 description: Comma-separated list or JSON array of tags
 *                 example: "milestone, family"
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Files to upload. Types other than 'journal' require at least 1 file. Max 10 files.
 *     responses:
 *       201:
 *         description: Memory created successfully
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
 *                     memory:
 *                       $ref: "#/components/schemas/PublicMemoryVaultItem"
 *       400:
 *         description: Validation error or missing files
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
 * /api/v1/memory-vault/{memoryId}:
 *   patch:
 *     tags: [Memory Vault]
 *     summary: Update an existing memory
 *     description: Updates an existing memory item. Supports multipart/form-data for updating files.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memoryId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *         description: 24-character hexadecimal MongoDB ObjectId
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [photo, video, journal, voice]
 *               whoseMemoryIsThis:
 *                 type: string
 *                 maxLength: 120
 *               title:
 *                 type: string
 *                 maxLength: 160
 *               narrative:
 *                 type: string
 *                 maxLength: 5000
 *               date:
 *                 type: string
 *                 format: date-time
 *               tags:
 *                 type: string
 *                 description: Comma-separated list or JSON array of tags
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Files to replace previous files.
 *     responses:
 *       200:
 *         description: Memory updated successfully
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
 *                     memory:
 *                       $ref: "#/components/schemas/PublicMemoryVaultItem"
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
 *       404:
 *         description: Memory not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */

/**
 * @swagger
 * /api/v1/memory-vault/{memoryId}:
 *   delete:
 *     tags: [Memory Vault]
 *     summary: Delete a memory
 *     description: Deletes a memory item and removes associated files from storage.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memoryId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *         description: 24-character hexadecimal MongoDB ObjectId
 *     responses:
 *       204:
 *         description: Memory deleted successfully (no content)
 *       400:
 *         description: Invalid memory ID format
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
 *       404:
 *         description: Memory not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */

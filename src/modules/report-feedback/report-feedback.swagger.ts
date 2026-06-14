/**
 * @swagger
 * tags:
 *   - name: ReportFeedback
 *     description: User problem reports and feedback submissions
 */

/**
 * @swagger
 * /api/v1/report-feedback:
 *   post:
 *     tags: [ReportFeedback]
 *     summary: Create a report or feedback item
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [type, category, subject, message]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [problem, feedback]
 *               category:
 *                 type: string
 *                 enum: [general, account, technical, feature_request, billing, other]
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Report created successfully
 *       401:
 *         description: Authentication required
 *
 * /api/v1/report-feedback/my:
 *   get:
 *     tags: [ReportFeedback]
 *     summary: List my reports and feedback
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [problem, feedback]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, resolved, closed]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *     responses:
 *       200:
 *         description: Reports fetched successfully
 *
 * /api/v1/report-feedback/{reportId}:
 *   get:
 *     tags: [ReportFeedback]
 *     summary: Get a report by id
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report fetched successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *
 * /api/v1/report-feedback/{reportId}/replies:
 *   post:
 *     tags: [ReportFeedback]
 *     summary: Add a user reply to a report
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Reply added successfully
 *
 * /api/v1/admin/report-feedback:
 *   get:
 *     tags: [ReportFeedback]
 *     summary: List all reports for admins
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, resolved, closed]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [problem, feedback]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reports fetched successfully
 *       403:
 *         description: Admin access required
 *
 * /api/v1/admin/report-feedback/{reportId}:
 *   get:
 *     tags: [ReportFeedback]
 *     summary: Get a report in admin context
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report fetched successfully
 *
 * /api/v1/admin/report-feedback/{reportId}/replies:
 *   post:
 *     tags: [ReportFeedback]
 *     summary: Add an admin reply to a report
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Reply added successfully
 *
 * /api/v1/admin/report-feedback/{reportId}/status:
 *   patch:
 *     tags: [ReportFeedback]
 *     summary: Update report status
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved, closed]
 *     responses:
 *       200:
 *         description: Status updated successfully
 */

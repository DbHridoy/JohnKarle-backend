/**
 * @swagger
 * tags:
 *   - name: Health
 *     description: Service health checking
 */

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     tags: [Health]
 *     summary: Get service health status
 *     description: Returns the health status, uptime, and current server timestamp.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Server is healthy
 *                 data:
 *                   type: object
 *                   properties:
 *                     uptime:
 *                       type: number
 *                       example: 456.78
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-01-15T12:00:00.000Z"
 */

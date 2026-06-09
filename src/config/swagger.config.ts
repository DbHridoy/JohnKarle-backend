import swaggerJsdoc from "swagger-jsdoc";

import { env } from "./env.config.js";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "John Karle API",
      version: "1.0.0",
      description:
        "RESTful API for the John Karle platform — authentication, user management, and memory vault.",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token obtained from /api/auth/login or /api/auth/register",
        },
      },
      schemas: {
        // ── Shared ──────────────────────────────────────────────
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { type: "object" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "VALIDATION_ERROR" },
                message: { type: "string", example: "Request validation failed." },
                details: {
                  type: "object",
                  nullable: true,
                  description: "Additional error context (Zod issues, key values, etc.)",
                },
              },
            },
          },
        },

        // ── Auth ────────────────────────────────────────────────
        AuthTokens: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            tokenType: { type: "string", example: "Bearer" },
            expiresIn: { type: "string", example: "15m" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/PublicUser" },
            tokens: { $ref: "#/components/schemas/AuthTokens" },
          },
        },

        // ── User ────────────────────────────────────────────────
        UserProfilePicture: {
          type: "object",
          properties: {
            key: { type: "string" },
            url: { type: "string", format: "uri" },
            originalName: { type: "string" },
            mimeType: { type: "string" },
            size: { type: "number" },
          },
        },
        FamilyMember: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["viewer", "editor", "owner"] },
          },
        },
        UserPreferences: {
          type: "object",
          properties: {
            notifications: { type: "boolean" },
            aiInsight: { type: "boolean" },
            darkMode: { type: "boolean" },
            anonymousAnalytics: { type: "boolean" },
          },
        },
        PublicUser: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            phoneNumber: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["user", "admin", "super_admin"] },
            isEmailVerified: { type: "boolean" },
            address: { type: "string" },
            profilePicture: { $ref: "#/components/schemas/UserProfilePicture" },
            familyMembers: {
              type: "array",
              items: { $ref: "#/components/schemas/FamilyMember" },
            },
            preferences: { $ref: "#/components/schemas/UserPreferences" },
            legacyAccessEnabled: { type: "boolean" },
            lastActiveAt: { type: "string", format: "date-time" },
            lastLoginAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        TrustedContactAccessScope: {
          type: "object",
          properties: {
            profile: { type: "boolean" },
            documents: { type: "boolean" },
            notes: { type: "boolean" },
            messages: { type: "boolean" },
            paymentInfo: { type: "boolean" },
            accountTransfer: { type: "boolean" },
          },
        },
        TrustedContact: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            status: { type: "string", enum: ["pending", "accepted", "declined", "removed"] },
            inactivityDays: { type: "integer" },
            accessScope: { $ref: "#/components/schemas/TrustedContactAccessScope" },
            acceptedAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        LegacyAccessRequest: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            trustedContactId: { type: "string" },
            trustedContact: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string", format: "email" },
                status: { type: "string", enum: ["pending", "accepted", "declined", "removed"] },
                accessScope: { $ref: "#/components/schemas/TrustedContactAccessScope" },
              },
            },
            status: {
              type: "string",
              enum: ["waiting_period", "approved", "cancelled", "expired"],
            },
            triggeredAt: { type: "string", format: "date-time" },
            unlockAt: { type: "string", format: "date-time" },
            expiresAt: { type: "string", format: "date-time" },
            cancelledAt: { type: "string", format: "date-time" },
            approvedAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        // ── Memory Vault ────────────────────────────────────────
        MemoryVaultFile: {
          type: "object",
          properties: {
            key: { type: "string" },
            url: { type: "string", format: "uri" },
            originalName: { type: "string" },
            mimeType: { type: "string" },
            size: { type: "number" },
          },
        },
        PublicMemoryVaultItem: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["photo", "video", "journal", "voice"] },
            whoseMemoryIsThis: { type: "string" },
            files: {
              type: "array",
              items: { $ref: "#/components/schemas/MemoryVaultFile" },
            },
            title: { type: "string" },
            narrative: { type: "string" },
            date: { type: "string", format: "date-time" },
            tags: { type: "array", items: { type: "string" } },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        MemoryTimelineGroup: {
          type: "object",
          properties: {
            date: { type: "string", example: "2025-01-15" },
            memories: {
              type: "array",
              items: { $ref: "#/components/schemas/PublicMemoryVaultItem" },
            },
          },
        },
      },
    },
  },
  apis: [
    "./src/modules/auth/auth.swagger.ts",
    "./src/modules/users/user.swagger.ts",
    "./src/modules/memory-vault/memory-vault.swagger.ts",
    "./src/modules/health/health.swagger.ts",
    "./src/modules/trusted-contacts/trusted-contact.swagger.ts",
    "./src/modules/legacy-access/legacy-access.swagger.ts",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

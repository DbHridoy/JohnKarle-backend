import { Types } from "mongoose";

import { ApiError } from "../../utils/api-error.util.js";
import { UserModel } from "./user.model.js";
import {
  UserFamilyMembershipModel,
  type UserFamilyMembershipDocument,
} from "./user-family-membership.model.js";
import type { FamilyMember, FamilyMemberRole } from "./user.types.js";

const normalizeUserId = (userId: string | Types.ObjectId): string => userId.toString();

export const buildFamilyPairKey = (
  userAId: string | Types.ObjectId,
  userBId: string | Types.ObjectId,
): string => [normalizeUserId(userAId), normalizeUserId(userBId)].sort().join(":");

export const areAcceptedFamilyMembers = async (
  userAId: string | Types.ObjectId,
  userBId: string | Types.ObjectId,
): Promise<boolean> => {
  if (normalizeUserId(userAId) === normalizeUserId(userBId)) {
    return false;
  }

  const membership = await UserFamilyMembershipModel.exists({
    pairKey: buildFamilyPairKey(userAId, userBId),
    status: "accepted",
  }).exec();

  return Boolean(membership);
};

export const createAcceptedFamilyMembership = async (input: {
  requesterId: string | Types.ObjectId;
  recipientId: string | Types.ObjectId;
  requesterRelationship?: string;
  recipientRelationship?: string;
  requesterRole: FamilyMemberRole;
  recipientRole: FamilyMemberRole;
  sourceInvitationId?: string | Types.ObjectId;
  acceptedAt?: Date;
}): Promise<UserFamilyMembershipDocument> => {
  const requesterId = normalizeUserId(input.requesterId);
  const recipientId = normalizeUserId(input.recipientId);

  if (requesterId === recipientId) {
    throw new ApiError(
      400,
      "A user cannot become family members with themselves.",
      "SELF_FAMILY_INVITE",
    );
  }

  const acceptedAt = input.acceptedAt ?? new Date();
  const pairKey = buildFamilyPairKey(requesterId, recipientId);
  const existingMembership = await UserFamilyMembershipModel.findOne({ pairKey }).exec();

  if (existingMembership) {
    existingMembership.requesterId = new Types.ObjectId(requesterId);
    existingMembership.recipientId = new Types.ObjectId(recipientId);
    existingMembership.pairKey = pairKey;
    existingMembership.status = "accepted";
    existingMembership.requesterRelationship = input.requesterRelationship;
    existingMembership.recipientRelationship = input.recipientRelationship;
    existingMembership.requesterRole = input.requesterRole;
    existingMembership.recipientRole = input.recipientRole;
    existingMembership.sourceInvitationId = input.sourceInvitationId
      ? new Types.ObjectId(normalizeUserId(input.sourceInvitationId))
      : undefined;
    existingMembership.acceptedAt = acceptedAt;
    existingMembership.removedAt = undefined;

    await existingMembership.save();
    return existingMembership;
  }

  return UserFamilyMembershipModel.create({
    requesterId,
    recipientId,
    pairKey,
    status: "accepted",
    requesterRelationship: input.requesterRelationship,
    recipientRelationship: input.recipientRelationship,
    requesterRole: input.requesterRole,
    recipientRole: input.recipientRole,
    ...(input.sourceInvitationId
      ? { sourceInvitationId: normalizeUserId(input.sourceInvitationId) }
      : {}),
    acceptedAt,
  });
};

export const listFamilyMembersForUser = async (userId: string): Promise<FamilyMember[]> => {
  const memberships = await UserFamilyMembershipModel.find({
    status: "accepted",
    $or: [{ requesterId: userId }, { recipientId: userId }],
  })
    .sort({ acceptedAt: -1, createdAt: -1 })
    .exec();

  if (memberships.length === 0) {
    return [];
  }

  const counterpartIds = memberships.map((membership) =>
    membership.requesterId.toString() === userId
      ? membership.recipientId.toString()
      : membership.requesterId.toString(),
  );

  const users = await UserModel.find({ _id: { $in: counterpartIds } }).exec();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  return memberships.flatMap((membership) => {
    const isRequester = membership.requesterId.toString() === userId;
    const counterpartId = isRequester
      ? membership.recipientId.toString()
      : membership.requesterId.toString();
    const counterpart = usersById.get(counterpartId);

    if (!counterpart) {
      return [];
    }

    return [
      {
        userId: counterpartId,
        name: counterpart.name,
        email: counterpart.email,
        ...(counterpart.profilePicture ? { profilePicture: counterpart.profilePicture } : {}),
        relation: isRequester
          ? (membership.requesterRelationship ?? "family")
          : (membership.recipientRelationship ?? "family"),
        role: isRequester ? membership.requesterRole : membership.recipientRole,
        status: "accepted",
      },
    ];
  });
};

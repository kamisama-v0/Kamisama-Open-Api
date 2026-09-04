import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../libs/db'
import type { UpdateProfileModelType } from './model'

/**
 * Retrieves a user's profile. If it doesn't exist, it creates one.
 * This acts as a robust fallback for the signup process.
 * @param userId - The ID of the user.
 * @returns The user's profile.
 */
export const getProfile = async (userId: string) => {
	return await prisma.profile.upsert({
		where: { userId },
		update: {},
		create: { userId, bio: '', avatar: '', socials: [] },
		include: {
			user: {
				select: {
					id: true,
					name: true,
					username: true,
					email: true,
					image: true,
					role: true
				}
			}
		}
	})
}

/**
 * Updates a user's profile.
 * @param userId - The ID of the user.
 * @param data - The data to update.
 * @returns The updated profile.
 */
export const updateProfile = async (
	userId: string,
	data: UpdateProfileModelType
) => {
	const updateData: Prisma.ProfileUpdateInput = {}

	// Iterate over the keys in the incoming data
	for (const key in data) {
		// Ensure the key is a direct property of data and not from prototype chain
		if (Object.prototype.hasOwnProperty.call(data, key)) {
			const value = (data as any)[key] // Cast to any to access properties dynamically
			// Only add to updateData if the value is not undefined
			if (value !== undefined) {
				// Special handling for 'socials' if it's an array of objects
				if (key === 'socials' && Array.isArray(value)) {
					// Assuming socials can be set or updated. If it's a full replacement, 'set' is fine.
					// If it's a merge, more complex logic is needed. For now, assume full replacement.
					;(updateData as any)[key] = { set: value }
				} else {
					;(updateData as any)[key] = value
				}
			}
		}
	}

	// If no fields are provided for update, return the existing profile
	if (Object.keys(updateData).length === 0) {
		return await prisma.profile.findUnique({
			where: { userId },
			include: {
				user: {
					select: {
						id: true,
						name: true,
						username: true,
						email: true,
						image: true,
						role: true
					}
				}
			}
		})
	}

	return await prisma.profile.update({
		where: { userId },
		data: updateData, // Pass the constructed updateData
		include: {
			user: {
				select: {
					id: true,
					name: true,
					username: true,
					email: true,
					image: true,
					role: true
				}
			}
		}
	})
}

import { t } from 'elysia'

/**
 * Namespace untuk semua model yang berhubungan dengan fitur WatchTracker.
 * Data disimpan di Firestore (khusus), auth tetap Better-Auth (repo ini).
 */
export namespace WatchModel {
	// --- SKEMA DASAR YANG DAPAT DIGUNAKAN KEMBALI ---

	const Provider = t.Object({
		id: t.String(),
		name: t.String(),
		icon: t.String()
	})

	const Group = t.Object({
		id: t.String(),
		name: t.String(),
		provider: t.String(),
		avatarUrl: t.Nullable(t.String()),
		description: t.Nullable(t.String()),
		createdAt: t.String(),
		updatedAt: t.String()
	})

	const PreviousLog = t.Object({
		episode: t.String(),
		timestamp: t.String(),
		watchedAt: t.String()
	})

	const History = t.Object({
		id: t.String(),
		title: t.String(),
		episode: t.String(),
		timestamp: t.String(),
		provider: t.String(),
		url: t.String(),
		notes: t.Nullable(t.String()),
		duration: t.Number(),
		watchedAt: t.String(),
		previousLog: t.Nullable(PreviousLog)
	})

	/**
	 * Skema data inti untuk satu grup + response.
	 */
	export const groupData = Group
	export const historyData = History
	export const providerData = Provider

	// --- SKEMA UNTUK INPUT (DTO) ---

	export const createGroup = t.Object({
		name: t.String({ minLength: 1, maxLength: 100 }),
		provider: t.String({ minLength: 1, maxLength: 50 }),
		avatarUrl: t.Optional(t.Nullable(t.String())),
		description: t.Optional(t.Nullable(t.String()))
	})

	export const updateGroup = t.Object({
		name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
		provider: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
		avatarUrl: t.Optional(t.Nullable(t.String())),
		description: t.Optional(t.Nullable(t.String()))
	})

	export const createHistory = t.Object({
		groupId: t.String(),
		title: t.String({ minLength: 1, maxLength: 200 }),
		episode: t.String({ minLength: 1, maxLength: 100 }),
		timestamp: t.String({
			pattern: '^[0-9]{1,3}:[0-5][0-9]:[0-5][0-9]$',
			error: 'watch.timestamp.format (HH:MM:SS)'
		}),
		url: t.String({ minLength: 1, maxLength: 2000 }),
		notes: t.Optional(t.String({ maxLength: 1000 })),
		duration: t.Optional(t.Number({ minimum: 0 }))
	})

	export const updateHistory = t.Object({
		title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
		episode: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
		timestamp: t.Optional(
			t.String({
				pattern: '^[0-9]{1,3}:[0-5][0-9]:[0-5][0-9]$',
				error: 'watch.timestamp.format (HH:MM:SS)'
			})
		),
		url: t.Optional(t.String({ minLength: 1, maxLength: 2000 })),
		notes: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
		duration: t.Optional(t.Number({ minimum: 0 }))
	})

	export const historyQuery = t.Object({
		groupId: t.Optional(t.String()),
		limit: t.Optional(t.Numeric({ default: 20, minimum: 1, maximum: 50 })),
		pageToken: t.Optional(t.String())
	})

	// --- SKEMA UNTUK RESPONSE ---

	export const singleGroupResponse = t.Object({
		status: t.Literal('success'),
		message: t.String(),
		data: Group
	})

	export const multipleGroupResponse = t.Object({
		status: t.Literal('success'),
		message: t.String(),
		data: t.Array(Group)
	})

	export const singleHistoryResponse = t.Object({
		status: t.Literal('success'),
		message: t.String(),
		data: History
	})

	export const multipleHistoryResponse = t.Object({
		status: t.Literal('success'),
		message: t.String(),
		data: t.Array(History),
		pagination: t.Object({
			nextPageToken: t.Nullable(t.String()),
			perPage: t.Number()
		})
	})

	export const providersResponse = t.Object({
		status: t.Literal('success'),
		message: t.String(),
		data: t.Array(Provider)
	})

	// --- EKSPOR TIPE TypeScript ---
	export type Group = typeof Group.static
	export type History = typeof History.static
	export type Provider = typeof Provider.static
	export type CreateGroup = typeof createGroup.static
	export type UpdateGroup = typeof updateGroup.static
	export type CreateHistory = typeof createHistory.static
	export type UpdateHistory = typeof updateHistory.static
	export type HistoryQuery = typeof historyQuery.static
}

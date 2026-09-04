import { Elysia } from 'elysia'
import { WatchModel } from './model'
import { WatchService, listProviders } from './service'

function toStatus(error: unknown): { code: 404 | 500; message: string } {
	const message = error instanceof Error ? error.message : 'Internal error'
	if (message.includes('not found') || message.includes('Invalid pageToken')) {
		return { code: 404, message }
	}
	return { code: 500, message }
}

export const WatchRoutes = new Elysia({ prefix: '/watch' })
	// --- PROVIDERS (butuh login, read-only) ---
	.get(
		'/providers',
		({ status }) => {
			return status(200, {
				status: 'success' as const,
				message: 'Providers retrieved successfully',
				data: listProviders()
			})
		},
		{
			auth: true,
			detail: {
				tags: ['WatchTracker'],
				summary: 'List Providers',
				description:
					'Daftar provider streaming yang dikenali (auto-detect dari URL).'
			}
		}
	)
	// --- GROUPS ---
	.get(
		'/groups',
		async ({ user, status }) => {
			try {
				const groups = await WatchService.getGroups(user.id)
				return status(200, {
					status: 'success' as const,
					message: 'Watch groups retrieved successfully',
					data: groups
				})
			} catch (error) {
				const { code, message } = toStatus(error)
				return status(code, { status: 'error' as const, message, statusCode: String(code) })
			}
		},
		{
			auth: true,
			detail: {
				tags: ['WatchTracker'],
				summary: 'Get Watch Groups',
				description: 'Ambil semua grup (profil) milik user yang login.'
			}
		}
	)
	.post(
		'/groups',
		async ({ user, body, status }) => {
			try {
				const group = await WatchService.createGroup(user.id, body)
				return status(201, {
					status: 'success' as const,
					message: 'Watch group created successfully',
					data: group
				})
			} catch (error) {
				const { code, message } = toStatus(error)
				return status(code, { status: 'error' as const, message, statusCode: String(code) })
			}
		},
		{
			auth: true,
			body: WatchModel.createGroup,
			detail: {
				tags: ['WatchTracker'],
				summary: 'Create Watch Group',
				description: 'Buat grup baru (mis. Netflix - Personal).'
			}
		}
	)
	.patch(
		'/groups/:id',
		async ({ user, params: { id }, body, status }) => {
			try {
				const group = await WatchService.updateGroup(user.id, id, body)
				return status(200, {
					status: 'success' as const,
					message: 'Watch group updated successfully',
					data: group
				})
			} catch (error) {
				const { code, message } = toStatus(error)
				return status(code, { status: 'error' as const, message, statusCode: String(code) })
			}
		},
		{
			auth: true,
			body: WatchModel.updateGroup,
			detail: {
				tags: ['WatchTracker'],
				summary: 'Update Watch Group',
				description: 'Ubah grup milik sendiri. Riwayat dalam grup ikut terhapus saat grup dihapus.'
			}
		}
	)
	.delete(
		'/groups/:id',
		async ({ user, params: { id }, status }) => {
			try {
				await WatchService.deleteGroup(user.id, id)
				return status(200, {
					status: 'success' as const,
					message: 'Watch group deleted successfully'
				})
			} catch (error) {
				const { code, message } = toStatus(error)
				return status(code, { status: 'error' as const, message, statusCode: String(code) })
			}
		},
		{
			auth: true,
			detail: {
				tags: ['WatchTracker'],
				summary: 'Delete Watch Group',
				description: 'Hapus grup beserta seluruh riwayat di dalamnya.'
			}
		}
	)
	// --- HISTORY ---
	.get(
		'/history',
		async ({ user, query, status }) => {
			try {
				const { items, nextPageToken } = await WatchService.getHistory(
					user.id,
					query
				)
				return status(200, {
					status: 'success' as const,
					message: 'Watch history retrieved successfully',
					data: items,
					pagination: { nextPageToken, perPage: query.limit ?? 20 }
				})
			} catch (error) {
				const { code, message } = toStatus(error)
				return status(code, { status: 'error' as const, message, statusCode: String(code) })
			}
		},
		{
			auth: true,
			query: WatchModel.historyQuery,
			detail: {
				tags: ['WatchTracker'],
				summary: 'Get Watch History',
				description:
					'Riwayat tontonan user, terbaru dulu. Filter opsional groupId. Paginasi cursor via pageToken.'
			}
		}
	)
	.post(
		'/history',
		async ({ user, body, status }) => {
			try {
				const entry = await WatchService.createHistory(user.id, body)
				return status(201, {
					status: 'success' as const,
					message: 'Watch progress saved successfully',
					data: entry
				})
			} catch (error) {
				const { code, message } = toStatus(error)
				return status(code, { status: 'error' as const, message, statusCode: String(code) })
			}
		},
		{
			auth: true,
			body: WatchModel.createHistory,
			detail: {
				tags: ['WatchTracker'],
				summary: 'Save Watch Progress',
				description:
					'Simpan progres tontonan. Provider terdeteksi otomatis dari URL, previousLog terisi otomatis dari log terakhir judul yang sama.'
			}
		}
	)
	.patch(
		'/history/:id',
		async ({ user, params: { id }, body, status }) => {
			try {
				const entry = await WatchService.updateHistory(user.id, id, body)
				return status(200, {
					status: 'success' as const,
					message: 'Watch history updated successfully',
					data: entry
				})
			} catch (error) {
				const { code, message } = toStatus(error)
				return status(code, { status: 'error' as const, message, statusCode: String(code) })
			}
		},
		{
			auth: true,
			body: WatchModel.updateHistory,
			detail: {
				tags: ['WatchTracker'],
				summary: 'Update Watch History',
				description: 'Ubah entry riwayat milik sendiri. Provider dihitung ulang bila URL berubah.'
			}
		}
	)
	.delete(
		'/history/:id',
		async ({ user, params: { id }, status }) => {
			try {
				await WatchService.deleteHistory(user.id, id)
				return status(200, {
					status: 'success' as const,
					message: 'Watch history deleted successfully'
				})
			} catch (error) {
				const { code, message } = toStatus(error)
				return status(code, { status: 'error' as const, message, statusCode: String(code) })
			}
		},
		{
			auth: true,
			detail: {
				tags: ['WatchTracker'],
				summary: 'Delete Watch History',
				description: 'Hapus satu entry riwayat milik sendiri.'
			}
		}
	)

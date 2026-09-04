import { prisma } from './db'

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000

type Ping = () => Promise<unknown>

const defaultPing: Ping = () =>
	prisma.articleStatus.findFirst({ select: { id: true } })

function resolveIntervalMs(override?: number): number {
	if (override && Number.isFinite(override) && override > 0) return override
	const fromEnv = Number(process.env.KEEPALIVE_INTERVAL_MS)
	if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
	return DEFAULT_INTERVAL_MS
}

/**
 * Heartbeat DB berkala agar Supabase Free tidak ke-pause.
 * SELECT murah ke tabel kecil (article_statuses) tiap interval.
 *
 * Catatan: ini TIDAK mencegah Render Free sleep — container yang tidur
 * ikut mem-pause timer. Render dibangunkan oleh traffic masuk (health check
 * Render / request user), lalu scheduler ini yang menjaga DB tetap aktif
 * selama container hidup.
 *
 * Aktif bila KEEPALIVE_ENABLED=true, atau otomatis saat NODE_ENV=production
 * (kecuali KEEPALIVE_ENABLED=false).
 */
export function startKeepalive(options?: {
	ping?: Ping
	intervalMs?: number
}): ReturnType<typeof setInterval> | undefined {
	const flag = process.env.KEEPALIVE_ENABLED
	const enabled = flag ? flag === 'true' : process.env.NODE_ENV === 'production'
	if (!enabled) return undefined

	const intervalMs = resolveIntervalMs(options?.intervalMs)
	const ping = options?.ping ?? defaultPing

	const run = async () => {
		try {
			await ping()
			console.log('[keepalive] db heartbeat ok')
		} catch (error) {
			console.error('[keepalive] db heartbeat failed', error)
		}
	}

	void run()
	return setInterval(run, intervalMs)
}

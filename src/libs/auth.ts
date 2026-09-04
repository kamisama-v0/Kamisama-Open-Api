import { BetterAuthError, User, betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './db'
import transporter from './mail'
import {
	openAPI,
	username,
	admin,
	organization,
	bearer
} from 'better-auth/plugins'
import { z } from 'zod'

import {
	ac,
	user,
	admin as adminAc,
	superAdmin,
	kamisama
} from '../modules/auth/permissions'

const CustomSignupBodySchema = z.object({
	email: z.string().email({ message: 'Invalid email address' }),
	password: z
		.string()
		.min(8, { message: 'Password must be at least 8 characters long' }),
	jobs: z
		.array(z.string())
		.min(1, { message: 'Jobs field is required and cannot be empty' })
})

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: 'postgresql'
	}),
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 1 week
		updateAge: 60 * 60 * 24 // 1 day
	},
	emailAndPassword: {
		enabled: true
	},
	emailVerification: {
		sendOnSignUp: true,
		sendVerificationEmail: async ({ user, url, token }) => {
			const emailTemplate = await import('fs/promises').then((fs) =>
				fs.readFile('src/templates/email/verify.html', 'utf-8')
			)

			const emailHtml = emailTemplate.replace('{{verification_link}}', url)

			await transporter.sendMail({
				from: '"Kamisama" <no-reply@kamisama.com>',
				to: user.email,
				subject: 'Verify your email address',
				html: emailHtml
			})
		}
	},
	plugins: [
		openAPI(),
		username(),
		admin({
			ac,
			roles: {
				user,
				admin: adminAc,
				superAdmin,
				kamisama
			},
			defaultRole: 'user',
			adminRoles: ['admin', 'superAdmin', 'kamisama']
		}),
		organization(),
		bearer()
	],
	basePath: '/api/auth',
	baseURL: 'http://localhost:3000',
	trustedOrigins: ['http://localhost:5173', process.env.FRONTEND_URL || '*'],
	advanced: {
		crossSubDomainCookies: {
			enabled: true,
			domain: 'cb1e5916d2f6.ngrok-free.app'
		},
		cookie: {
			sameSite: 'None',
			secure: true,
			// domain: process.env.COOKIE_DOMAIN || undefined,
			path: '/'
		},
		defaultCookieAttributes: {
			sameSite: 'None',
			secure: true,
			partitioned: true
		}
	},
	credentials: 'include'
})

// ... sisa kode Anda tetap sama
let _schema: ReturnType<typeof auth.api.generateOpenAPISchema>
const getSchema = async () => (_schema ??= auth.api.generateOpenAPISchema())

export const OpenAPI = {
	getPaths: (prefix = '/api/auth') =>
		getSchema().then(({ paths }) => {
			const reference: typeof paths = Object.create(null)

			for (const path of Object.keys(paths)) {
				const key = prefix + path
				reference[key] = paths[path]

				for (const method of Object.keys(paths[path])) {
					const operation = (reference[key] as any)[method]
					if (key.includes('/api/auth/admin')) {
						operation.tags = ['Better Auth Admin']
					} else if (key.includes('/api/auth/organization')) {
						operation.tags = ['Better Auth Organization']
					} else {
						operation.tags = ['Better Auth']
					}
				}
			}

			return reference
		}) as Promise<any>,
	components: getSchema().then(({ components }) => components) as Promise<any>
} as const

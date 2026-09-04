import { Elysia, t } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { ipaymuVendor } from './modules/vendor/ipaymu'
import { cors } from '@elysiajs/cors'
import { auth, OpenAPI } from './libs/auth'
import { ArticleRoutes } from './modules/articles/index'
import { TagRoutes } from './modules/tags'
import { CategoryRoutes } from './modules/categories'
import { LanguageRoutes } from './modules/languages'
import { ArticleStatusRoutes } from './modules/article-statuses'
import { UploadRoutes } from './modules/uploads'
import { betterAuth } from './modules/auth/macros'
import { ProfileRoutes } from './modules/profile'
import { WatchRoutes } from './modules/watch'
import { staticPlugin } from '@elysiajs/static'

export const app = new Elysia()

app
	.use(
		cors({
			origin: [
				'http://localhost:3000',
				'http://localhost:5173',
				'https://kamisama-v0.netlify.app',
				process.env.FRONTEND_URL || '*'
			],
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			allowedHeaders: ['Content-Type', 'Authorization'],
			credentials: true
		})
	)
	.use(betterAuth)
	.use(
		staticPlugin({
			assets: 'uploads',
			prefix: '/uploads'
		})
	)
	.use(
		swagger({
			documentation: {
				info: {
					title: 'Kamisama Open API',
					description:
						'Official OpenAPI documentation for the Kamisama platform.',
					version: '1.0.0'
				},
				tags: [
					{ name: 'App', description: 'General endpoints' },
					{ name: 'Authentication', description: 'Authentication endpoints' },
					{ name: 'Payment', description: 'Payment endpoints' },
					{
						name: 'Languages',
						description: 'Endpoints for managing languages'
					},
				{
					name: 'Article Statuses',
					description: 'Endpoints for managing article statuses'
				},
				{
					name: 'WatchTracker',
					description: 'Watch progress tracking (Firestore-backed)'
				}
				],
				components: {
					...(await OpenAPI.components),
					securitySchemes: {
						bearerAuth: {
							type: 'http',
							scheme: 'bearer',
							bearerFormat: 'JWT'
						}
					}
				},
				paths: await OpenAPI.getPaths(),
				security: [
					{
						bearerAuth: []
					}
				]
			}
		})
	)
	.get(
		'/',
		({ status }) => {
			return status(200, {
				status: 200,
				message: 'Welcome to Kamisama Open API',
				test: 'webhooks'
			})
		},
		{
			detail: {
				tags: ['App'],
				description: 'Welcome to Kamisama Open API',
				summary: 'Welcome to Kamisama Open API'
			}
		}
	)
	.group('/api/v1', (app) => app.use(ipaymuVendor))
	.use(ArticleRoutes)
	.use(TagRoutes)
	.use(CategoryRoutes)
	.use(ProfileRoutes)
	.use(LanguageRoutes)
	.use(ArticleStatusRoutes)
	.use(UploadRoutes)
	.use(WatchRoutes)
	.listen(process.env.PORT ?? 3000)

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)

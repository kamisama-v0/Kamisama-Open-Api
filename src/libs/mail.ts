import nodemailer from 'nodemailer'

// Default = Mailpit lokal untuk dev (127.0.0.1:1025, tanpa auth).
// Prod (Brevo): SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587,
// SMTP_SECURE=false (STARTTLS), SMTP_USER/SMTP_PASS dari dashboard Brevo.
const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST || '127.0.0.1',
	port: Number(process.env.SMTP_PORT) || 1025,
	secure: process.env.SMTP_SECURE === 'true',
	...(process.env.SMTP_USER
		? {
				auth: {
					user: process.env.SMTP_USER,
					pass: process.env.SMTP_PASS || ''
				}
			}
		: {})
})

export default transporter

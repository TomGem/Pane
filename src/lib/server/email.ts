import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

let transporter: nodemailer.Transporter | null = null;

function isSmtpConfigured(): boolean {
	return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function getTransporter(): nodemailer.Transporter {
	if (!transporter) {
		if (!isSmtpConfigured()) {
			throw new Error('SMTP not configured');
		}
		transporter = nodemailer.createTransport({
			host: env.SMTP_HOST,
			port: Number(env.SMTP_PORT || 587),
			secure: env.SMTP_SECURE === 'true',
			auth: {
				user: env.SMTP_USER,
				pass: env.SMTP_PASS
			}
		});
	}
	return transporter;
}

function getFromAddress(): string {
	return env.SMTP_FROM || `Pane <${env.SMTP_USER}>`;
}

export async function sendVerificationEmail(to: string, code: string, displayName: string): Promise<void> {
	if (!isSmtpConfigured()) {
		console.log(`[EMAIL] Verification code for ${to}: ${code}`);
		return;
	}

	await getTransporter().sendMail({
		from: getFromAddress(),
		to,
		subject: 'Verify your Pane account',
		html: `
			<p>Hi ${escapeHtml(displayName)},</p>
			<p>Your verification code is:</p>
			<p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; font-family: monospace;">${escapeHtml(code)}</p>
			<p>This code expires in 15 minutes.</p>
			<p>If you didn't create a Pane account, you can safely ignore this email.</p>
		`
	});
}

export async function sendSpaceInvitationEmail(
	to: string,
	inviterName: string,
	spaceName: string,
	permission: 'read' | 'write',
	appUrl?: string
): Promise<void> {
	if (!isSmtpConfigured()) {
		console.log(`[EMAIL] Space invitation for ${to}: "${spaceName}" (${permission}) from ${inviterName}`);
		return;
	}

	const permissionLabel = permission === 'write' ? 'edit' : 'view';

	await getTransporter().sendMail({
		from: getFromAddress(),
		to,
		subject: `${inviterName} shared a Pane space with you`,
		html: `
			<p>${escapeHtml(inviterName)} has shared the space <strong>${escapeHtml(spaceName)}</strong> with you.</p>
			<p>You have <strong>${permissionLabel}</strong> access.</p>
			${appUrl ? `<p><a href="${escapeHtml(appUrl)}">Open Pane</a></p>` : '<p>Log in to Pane to access it.</p>'}
		`
	});
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

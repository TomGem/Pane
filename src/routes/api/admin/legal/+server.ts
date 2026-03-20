import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';
import { getAuthMeta, setAuthMeta } from '$lib/server/auth-schema';

const LEGAL_KEYS = ['legal_enabled', 'privacy_policy', 'legal_notice'] as const;

const DEFAULT_PRIVACY_POLICY = `# Privacy Policy

**Last updated:** [Date]

## 1. Controller

[Your Name / Company Name]
[Address]
[Email]

## 2. Overview

This privacy policy explains how we collect, use, and protect your personal data when you use this application, in accordance with the Swiss Federal Act on Data Protection (FADP/DSG) and, where applicable, the EU General Data Protection Regulation (GDPR).

## 3. Data We Collect

We collect and process the following personal data:

- **Account data:** Email address, display name, and password (stored as a cryptographic hash)
- **Usage data:** Spaces, categories, items, tags, and documents you create
- **Technical data:** IP address (for rate limiting only, not stored persistently), session identifiers
- **Communication data:** Chat messages in shared spaces
- **Files:** Documents, images, and other files you upload

## 4. Purpose of Processing

Your data is processed for the following purposes:

- Providing and maintaining the application
- User authentication and session management
- Enabling collaboration through shared spaces and chat
- Enforcing storage quotas and rate limits

## 5. Legal Basis

Processing is based on:

- **Performance of a contract** (Art. 31 para. 2 let. a FADP): Providing the service you registered for
- **Consent** (Art. 31 para. 1 FADP): Where you actively provide data (e.g. sharing spaces)
- **Legitimate interests** (Art. 31 para. 1 FADP): Security, rate limiting, abuse prevention

## 6. Data Storage and Retention

- All data is stored on the server where this application is hosted
- Your data is retained as long as your account exists
- Upon account deletion, your personal data and files are removed
- Session data expires automatically after 30 days

## 7. Data Sharing

We do not sell or share your personal data with third parties. Data is only visible to:

- Other users you explicitly share a space with
- Administrators of this instance (for account management purposes)

## 8. Your Rights

Under the FADP and, where applicable, the GDPR, you have the right to:

- **Access** your personal data (Art. 25 FADP)
- **Rectify** inaccurate data (Art. 32 FADP)
- **Delete** your data (Art. 32 FADP)
- **Export** your data (available via the Export function)
- **Object** to data processing
- **Lodge a complaint** with the Federal Data Protection and Information Commissioner (FDPIC)

## 9. Data Security

We employ appropriate technical and organisational measures to protect your data, including:

- Encrypted password storage (scrypt hashing)
- HTTP-only session cookies with secure flags
- Rate limiting on API endpoints
- Per-user data isolation (separate databases)

## 10. Changes to This Policy

We may update this privacy policy from time to time. Changes will be communicated through this page.

## 11. Contact

For questions about this privacy policy or to exercise your rights, please contact:

[Your Name / Company Name]
[Email Address]
`;

const DEFAULT_LEGAL_NOTICE = `# Legal Notice (Impressum)

## Operator

[Your Name / Company Name]
[Street and Number]
[Postal Code and City]
[Country]

## Contact

Email: [Email Address]
Phone: [Phone Number]

## Authorised Representative

[Name of authorised representative, if applicable]

## Disclaimer

### Liability for Content

The content of this application has been prepared with the greatest possible care. However, we cannot guarantee the accuracy, completeness, or timeliness of the content. As a service provider, we are responsible for our own content in accordance with Art. 41 et seq. of the Swiss Code of Obligations (OR). We are not obligated to monitor transmitted or stored third-party information or to investigate circumstances that indicate unlawful activity.

### Liability for Links

Our application may contain links to external third-party websites over whose content we have no influence. We therefore cannot accept any liability for this third-party content. The respective provider or operator of linked pages is always responsible for their content.

## Applicable Law

Swiss law applies. The place of jurisdiction is [City], Switzerland.

## Copyright

The content and works created by the operator of this application are subject to Swiss copyright law. Reproduction, editing, distribution, and any kind of use beyond the limits of copyright law require the written consent of the respective author or creator.
`;

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const db = getAuthDb();
	return json({
		legal_enabled: getAuthMeta(db, 'legal_enabled') === 'true',
		privacy_policy: getAuthMeta(db, 'privacy_policy') ?? DEFAULT_PRIVACY_POLICY,
		legal_notice: getAuthMeta(db, 'legal_notice') ?? DEFAULT_LEGAL_NOTICE
	});
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await request.json();
	const db = getAuthDb();

	if (typeof body.legal_enabled === 'boolean') {
		setAuthMeta(db, 'legal_enabled', body.legal_enabled ? 'true' : 'false');
	}
	if (typeof body.privacy_policy === 'string') {
		setAuthMeta(db, 'privacy_policy', body.privacy_policy);
	}
	if (typeof body.legal_notice === 'string') {
		setAuthMeta(db, 'legal_notice', body.legal_notice);
	}

	return json({ success: true });
};

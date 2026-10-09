import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const env = (name: string) =>
	process.env[name] ??
	readFileSync('.env', 'utf8')
		.split(/\r?\n/)
		.find((line) => line.startsWith(`${name}=`))
		?.slice(name.length + 1) ?? '';

test('T06 non-admin sees Access denied on settings', async ({ page, context }) => {
	const token = env('CLICKUP_NON_ADMIN_TOKEN');
	test.skip(!token, 'CLICKUP_NON_ADMIN_TOKEN is required for the non-admin check');

	await context.addCookies([
		{
			name: 'clickup_access_token',
			value: token,
			url: 'http://localhost:3000',
		},
	]);
	await page.goto('/admin/settings');

	await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
	await expect(page).toHaveURL(/\/unauthorized$/);
});

test('configured active member reaches only its assigned panel', async ({
	page,
	context,
}) => {
	const token = env('CLICKUP_MEMBER_TOKEN');
	test.skip(!token, 'CLICKUP_MEMBER_TOKEN is required for the active-member check');
	await context.addCookies([
		{ name: 'clickup_access_token', value: token, url: 'http://localhost:3000' },
	]);

	await page.goto('/');
	await expect(page).toHaveURL(/\/barang-diterima$/);
	await page.goto('/sedang-dipacking');
	await expect(page).toHaveURL(/\/unauthorized$/);

	const allowed = await page.request.post('/api/panel/scan', {
		data: { serial_number: '__playwright_missing_serial__', status: 'BARANG_DITERIMA' },
		maxRedirects: 0,
	});
	expect(allowed.status()).toBe(404);

	const denied = await page.request.post('/api/panel/scan', {
		data: { serial_number: '__playwright_missing_serial__', status: 'SEDANG_DIPACKING' },
		maxRedirects: 0,
	});
	expect(denied.status()).toBe(307);
	expect(denied.headers().location).toContain('/unauthorized');
});

test('no ClickUp token goes to login', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/login$/);
});

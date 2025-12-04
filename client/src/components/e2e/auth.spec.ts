/**
 * E2E test for login flow
 * Fase 7: Testes e Qualidade
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('should display login page', async ({ page }) => {
        await page.goto('/login');

        await expect(page).toHaveTitle(/EcoBrasil/);
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/login');

        await page.fill('input[type="email"]', 'invalid@test.com');
        await page.fill('input[type="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        await expect(page.locator('text=inválidos')).toBeVisible();
    });

    test('should login successfully with valid credentials', async ({ page }) => {
        await page.goto('/login');

        // Use admin credentials from seed
        await page.fill('input[type="email"]', 'maurivan@ecobrasil.bio.br');
        await page.fill('input[type="password"]', 'bor192023');
        await page.click('button[type="submit"]');

        // Should redirect to dashboard or unit selection
        await expect(page).toHaveURL(/\/(dashboard|selecionar-unidade)/);
    });

    test('should logout successfully', async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.fill('input[type="email"]', 'maurivan@ecobrasil.bio.br');
        await page.fill('input[type="password"]', 'bor192023');
        await page.click('button[type="submit"]');

        // Wait for redirect
        await page.waitForURL(/\/(dashboard|selecionar-unidade)/);

        // Click logout (adjust selector based on your UI)
        await page.click('button:has-text("Sair"), [aria-label="Logout"]');

        // Should redirect to login
        await expect(page).toHaveURL('/login');
    });
});

test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/login');
        await page.fill('input[type="email"]', 'maurivan@ecobrasil.bio.br');
        await page.fill('input[type="password"]', 'bor192023');
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard/);
    });

    test('should display dashboard stats', async ({ page }) => {
        await page.goto('/dashboard');

        // Wait for skeleton to disappear and real data to load
        await page.waitForSelector('.rounded-lg.border.bg-card', { state: 'visible' });

        // Should have stats cards
        const cards = page.locator('.rounded-lg.border.bg-card');
        await expect(cards).not.toHaveCount(0);
    });

    test('should navigate to empreendimentos page', async ({ page }) => {
        await page.goto('/dashboard');

        // Click on empreendimentos link
        await page.click('a:has-text("Empreendimentos")');

        await expect(page).toHaveURL(/empreendimentos/);
    });
});

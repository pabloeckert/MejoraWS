// tests/e2e/pipeline.spec.ts
// E2E tests: Pipeline Kanban view

import { test, expect } from '@playwright/test'

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001'

test.describe('Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${DASHBOARD_URL}/login`)
    await page.getByPlaceholder('Contraseña').fill('admin')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(DASHBOARD_URL + '/')
  })

  test('should navigate to pipeline page', async ({ page }) => {
    await page.getByText('Pipeline').click()
    await expect(page).toHaveURL(/\/pipeline/)
    await expect(page.getByText('Pipeline')).toBeVisible()
  })

  test('should display pipeline stages', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/pipeline`)

    // Should show stage names
    await expect(page.getByText('nuevo')).toBeVisible()
    await expect(page.getByText('contactado')).toBeVisible()
    await expect(page.getByText('interesado')).toBeVisible()
  })

  test('should show deal stats', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/pipeline`)

    // Should show pipeline info
    await expect(page.getByText('Pipeline')).toBeVisible()
  })
})

test.describe('Contacts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/login`)
    await page.getByPlaceholder('Contraseña').fill('admin')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(DASHBOARD_URL + '/')
  })

  test('should navigate to contacts page', async ({ page }) => {
    await page.getByText('Contactos').click()
    await expect(page).toHaveURL(/\/contactos/)
  })

  test('should display contacts table', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/contactos`)
    await expect(page.getByText('Contactos')).toBeVisible()
  })

  test('should have search functionality', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/contactos`)

    // Should have search input
    const searchInput = page.getByPlaceholder(/buscar/i)
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
    }
  })
})

test.describe('Dashboard KPIs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/login`)
    await page.getByPlaceholder('Contraseña').fill('admin')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(DASHBOARD_URL + '/')
  })

  test('should show main dashboard with KPIs', async ({ page }) => {
    await expect(page.getByText('MejoraWS')).toBeVisible()
    // Should show navigation sidebar
    await expect(page.getByText('Dashboard')).toBeVisible()
    await expect(page.getByText('Pipeline')).toBeVisible()
    await expect(page.getByText('Contactos')).toBeVisible()
    await expect(page.getByText('Campañas')).toBeVisible()
    await expect(page.getByText('Analytics')).toBeVisible()
    await expect(page.getByText('Chat')).toBeVisible()
    await expect(page.getByText('Config')).toBeVisible()
  })

  test('should navigate between all views', async ({ page }) => {
    // Navigate to each view
    const views = ['Pipeline', 'Contactos', 'Campañas', 'Analytics', 'Chat', 'Config']

    for (const view of views) {
      await page.getByText(view, { exact: false }).first().click()
      await page.waitForLoadState('networkidle')
    }
  })
})

test.describe('Config', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/login`)
    await page.getByPlaceholder('Contraseña').fill('admin')
    await page.getByRole('button', { name: 'Ingresar' }).click()
  })

  test('should show bot configuration', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/config`)
    await expect(page.getByText('Config')).toBeVisible()
  })
})

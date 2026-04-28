// tests/e2e/auth.spec.ts
// E2E tests: Login flow + auth protection

import { test, expect } from '@playwright/test'

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001'
const API_URL = process.env.API_URL || 'http://localhost:3000'

test.describe('Authentication', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto(DASHBOARD_URL)
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show login form', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/login`)
    await expect(page.getByPlaceholder('Contraseña')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
  })

  test('should show error with wrong password', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/login`)
    await page.getByPlaceholder('Contraseña').fill('wrong-password')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByText('Contraseña incorrecta')).toBeVisible()
  })

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/login`)
    await page.getByPlaceholder('Contraseña').fill('admin')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    // Should redirect to dashboard
    await expect(page).toHaveURL(DASHBOARD_URL + '/')
    await expect(page.getByText('MejoraWS')).toBeVisible()
  })

  test('should persist auth across page reload', async ({ page }) => {
    // Login
    await page.goto(`${DASHBOARD_URL}/login`)
    await page.getByPlaceholder('Contraseña').fill('admin')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(DASHBOARD_URL + '/')

    // Reload
    await page.reload()
    await expect(page).toHaveURL(DASHBOARD_URL + '/')
    await expect(page.getByText('MejoraWS')).toBeVisible()
  })

  test('should logout and redirect to login', async ({ page }) => {
    // Login
    await page.goto(`${DASHBOARD_URL}/login`)
    await page.getByPlaceholder('Contraseña').fill('admin')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(DASHBOARD_URL + '/')

    // Logout
    await page.getByText('Salir').click()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('API Auth', () => {
  test('should reject requests without token', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/contacts`)
    expect(res.status()).toBe(401)
  })

  test('should accept requests with valid token', async ({ request }) => {
    // Get token
    const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { password: 'admin' },
    })
    expect(loginRes.ok()).toBeTruthy()
    const { token } = await loginRes.json()

    // Use token
    const res = await request.get(`${API_URL}/api/v1/contacts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
  })

  test('should reject expired/invalid tokens', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/contacts`, {
      headers: { Authorization: 'Bearer invalid-token-here' },
    })
    expect(res.status()).toBe(401)
  })
})

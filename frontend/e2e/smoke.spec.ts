import { expect, test, type Page } from '@playwright/test'

const email = process.env.E2E_EMAIL ?? 'admin@test.com'
const password = process.env.E2E_PASSWORD ?? 'demo12345'

const signIn = async (page: Page, userEmail: string, userPassword: string) => {
  await page.goto('/login')
  await page.getByLabel('Электронная почта').fill(userEmail)
  await page.getByLabel('Пароль').fill(userPassword)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('admin can sign in and open core pages', async ({ page }) => {
  await signIn(page, email, password)
  await expect(page.getByRole('heading', { name: 'Дашборд' })).toBeVisible()

  for (const name of ['Клиенты', 'Сделки', 'Задачи', 'Активности', 'Отчеты']) {
    await page.getByRole('link', { name }).first().click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }

  await page.getByRole('link', { name: 'Пользователи' }).first().click()
  await expect(page.getByRole('heading', { name: 'Пользователи' })).toBeVisible()

  await page.getByRole('link', { name: 'Стадии' }).first().click()
  await expect(page.getByRole('heading', { name: 'Стадии' })).toBeVisible()
})

test('manager can toggle task status and sees no duplicated role in header', async ({ page }) => {
  await signIn(page, 'manager@test.com', 'demo12345')
  await page.goto('/tasks')

  const header = page.locator('header')
  await expect(header.getByText('Менеджер', { exact: true })).toHaveCount(1)
  await expect(header.getByText('МЕНЕДЖЕР', { exact: true })).toHaveCount(0)

  const completeButtons = page.getByRole('button', { name: 'Отметить выполненной' })
  expect(await completeButtons.count()).toBeGreaterThan(0)
  await completeButtons.first().click()

  const returnButtons = page.getByRole('button', { name: 'Вернуть в активные' })
  await expect(returnButtons.first()).toBeVisible()
  await returnButtons.first().click()

  await expect(page.getByRole('button', { name: 'Отметить выполненной' }).first()).toBeVisible()
})

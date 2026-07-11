import { test, expect } from '@playwright/test';

test.describe('SafeMesh AI - Platform E2E Validation Flow', () => {

  test('Industrial Incident Simulation & Intervention Demo', async ({ page }) => {
    // 1. Visit Login screen
    await page.goto('http://localhost:3000');
    await expect(page.locator('text=Industrial Safety Intelligence Platform')).toBeVisible();

    // 2. Perform Login with demo credentials
    await page.fill('input[type="email"]', 'officer@safemesh.ai');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 3. Command Center verification
    await expect(page.locator('text=Command Center')).toBeVisible();
    await expect(page.locator('text=Plant Safety Index')).toBeVisible();

    // 4. Start Coke Oven Battery simulation
    await page.click('text=Start Demo');
    
    // 5. Switch to geospatial industrial map
    await page.click('text=Live Plant Map');
    await expect(page.locator('text=Coke Oven Battery')).toBeVisible();
    
    // 6. Select Coke Oven Battery to view live gauges
    await page.click('text=Coke Oven Battery');
    
    // 7. Navigate to Risk Registry
    await page.click('text=Risk Intelligence');
    
    // 8. Open Risk Investigation panel
    await page.click('text=Investigate');
    await expect(page.locator('text=Active Incident Investigation')).toBeVisible();
    await expect(page.locator('text=Model Contributing Factors')).toBeVisible();

    // 9. Execute safety dispatch & verify mitigation progress
    await page.click('text=Execute Intervention');
    await expect(page.locator('text=Executing steps...')).toBeVisible();

    // 10. Switch to Evaluation Lab to verify lead-time metrics comparison
    await page.click('text=Evaluation Lab');
    await expect(page.locator('text=Classification Performance Comparison')).toBeVisible();
  });

});

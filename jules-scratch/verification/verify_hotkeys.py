import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        page = context.pages[0]

        # Click the button to open the model library
        await page.get_by_role("button", name="Model Library").click()

        # Add a delay to ensure the modal is visible
        await asyncio.sleep(2)

        # Verify the modal is visible
        modal = page.locator('.bg-bg-primary-light.z-50')
        await expect(modal).to_be_visible()

        # Press the Escape key
        await page.keyboard.press('Escape')

        # Add a delay to allow the modal to close
        await asyncio.sleep(2)

        # Verify the modal is no longer visible
        await expect(modal).to_be_hidden()

        # Re-open the modal
        await page.get_by_role("button", name="Model Library").click()
        await asyncio.sleep(2)
        await expect(modal).to_be_visible()

        # Press Ctrl+W
        await page.keyboard.press('Control+w')
        await asyncio.sleep(2)

        # Verify the modal is no longer visible and take a screenshot
        await expect(modal).to_be_hidden()
        await page.screenshot(path="jules-scratch/verification/verification.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
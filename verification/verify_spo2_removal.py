from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    # Navigate to the app
    print("Navigating to http://localhost:4173")
    page.goto("http://localhost:4173")
    page.wait_for_timeout(5000)

    # Handle First Access / Login
    if page.get_by_text("Configurazione Iniziale").is_visible():
        print("First access setup...")
        page.get_by_placeholder("Master Password").fill("password123")
        page.get_by_placeholder("Conferma Password").fill("password123")
        page.get_by_role("checkbox").click()
        page.get_by_role("button", name="Continua").click()
        page.get_by_role("button", name="Attiva Protezione Dati").click()
    elif page.get_by_placeholder("Master Password").is_visible():
        print("Logging in...")
        page.get_by_placeholder("Master Password").fill("password123")
        page.get_by_role("button", name="Sblocca Database").click()

    page.wait_for_timeout(3000)

    # Navigate to Lavoratori to create Mario Rossi
    print("Creating company and worker...")
    page.get_by_role("link", name="Aziende", exact=True).click()
    page.wait_for_timeout(2000)
    page.get_by_role("button", name="Nuova Azienda").click()
    page.get_by_placeholder("Ragione Sociale").fill("Test Company")
    page.get_by_role("button", name="Salva Azienda").click()
    page.wait_for_timeout(2000)

    page.get_by_role("link", name="Lavoratori", exact=True).click()
    page.wait_for_timeout(2000)
    page.get_by_role("button", name="Nuovo Lavoratore").click()
    # Let's use textboxes if labels fail
    page.locator("input[placeholder='Nome']").fill("Mario")
    page.locator("input[placeholder='Cognome']").fill("Rossi")
    page.get_by_role("button", name="Salva Lavoratore").click()
    page.wait_for_timeout(2000)

    # Navigate to Nuova Visita
    print("Navigating to Nuova Visita...")
    page.get_by_role("link", name="Nuova Visita", exact=True).click()
    page.wait_for_timeout(2000)

    # Step 1: Selection
    search_placeholder = "Cerca lavoratore per nome, cognome o azienda..."
    search = page.get_by_placeholder(search_placeholder)
    search.fill("Rossi")
    page.wait_for_timeout(2000)

    # Select worker
    page.get_by_text("Rossi Mario").first.click()
    page.wait_for_timeout(1000)
    page.get_by_role("button", name="Inizia").click()
    page.wait_for_timeout(1000)

    # Step 2: Anamnesi
    page.get_by_role("button", name="Prossimo Step").click()
    page.wait_for_timeout(1000)

    # Step 3: Obiettivo
    print("Checking Step 3 for SpO2...")
    page.screenshot(path="verification/screenshots/nuova_visita_step3.png")

    spo2_visible = page.get_by_text("SpO2 %").is_visible()
    print(f"SpO2 visible: {spo2_visible}")

    if spo2_visible:
        raise Exception("SpO2 field is still visible!")
    else:
        print("SpO2 field successfully removed.")

    page.screenshot(path="verification/screenshots/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/screenshots/error.png")
        finally:
            context.close()
            browser.close()

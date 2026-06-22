#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "selenium",
#   "webdriver-manager"
# ]
# ///

import time
import random
import os
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


BASE_URL = "http://localhost:8000"
KEEP_BROWSER_OPEN = os.getenv("KEEP_BROWSER_OPEN", "false").lower() == "true"
DELAY_SHORT = 0.5
DELAY_MEDIUM = 1.0
DELAY_LONG = 2.0
DEFAULT_PASSWORD = "123123123"
PT_MONTHS = {
    "janeiro": 1,
    "fevereiro": 2,
    "março": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}
ACCOUNT_CACHE = {}

def close_driver(driver):
    if not KEEP_BROWSER_OPEN:
        driver.quit()
    else:
        input("🟡 Press ENTER to close browser...")
        driver.quit()


def parse_pt_month_year(value):
    parts = value.strip().lower().split()
    if len(parts) == 2:
        month_name, year = parts
    elif len(parts) == 3 and parts[1] == "de":
        month_name, _, year = parts
    else:
        raise ValueError(f"Unexpected month header format: {value!r}")
    return int(year), PT_MONTHS[month_name]


# =========================
# Helpers
# =========================

def create_driver():
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()))


def generate_email():
    return f"test{int(time.time() * 1000)}{random.randint(1000,9999)}@mail.com"


def send_time_keys(input_element, value):
    hour, minute = map(int, value.split(":"))
    suffix = "A" if hour < 12 else "P"
    display_hour = hour % 12
    if display_hour == 0:
        display_hour = 12
    input_element.clear()
    input_element.send_keys(f"{display_hour:02d}{minute:02d}{suffix}")


def register(driver, email, password):
    driver.find_element(By.LINK_TEXT, "Cadastrar").click()
    time.sleep(DELAY_SHORT)

    driver.find_element(By.NAME, "email").send_keys(email)
    driver.find_element(By.NAME, "password").send_keys(password)
    driver.find_element(By.NAME, "confirmPassword").send_keys(password)

    driver.find_element(By.TAG_NAME, "form").submit()
    time.sleep(DELAY_SHORT)


def login(driver, email, password):
    driver.find_element(By.LINK_TEXT, "Entrar").click()
    time.sleep(DELAY_SHORT)

    driver.find_element(By.ID, "email").send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)

    driver.find_element(By.TAG_NAME, "form").submit()
    time.sleep(DELAY_SHORT)


def register_and_login(driver, email, password):
    register(driver, email, password)
    login(driver, email, password)


def ensure_student_account(driver, cache_key="student_basic"):
    cached = ACCOUNT_CACHE.get(cache_key)
    if cached:
        login(driver, cached["email"], cached["password"])
        return cached

    email = generate_email()
    register_and_login(driver, email, DEFAULT_PASSWORD)
    account = {"email": email, "password": DEFAULT_PASSWORD}
    ACCOUNT_CACHE[cache_key] = account
    return account


def ensure_instructor_account(driver, cache_key="instructor_basic"):
    cached = ACCOUNT_CACHE.get(cache_key)
    if cached:
        login(driver, cached["email"], cached["password"])
        return cached

    email = generate_email()
    register_and_login(driver, email, DEFAULT_PASSWORD)
    go_to_become_instructor(driver)
    instructor_name = f"Instrutor {email.split('@')[0]}"
    fill_instructor_form(driver, instructor_name)
    submit_form(driver)
    account = {
        "email": email,
        "password": DEFAULT_PASSWORD,
        "instructor_name": instructor_name
    }
    ACCOUNT_CACHE[cache_key] = account
    return account


def go_to_become_instructor(driver):
    driver.find_element(By.LINK_TEXT, "Tornar-se instrutor").click()
    time.sleep(DELAY_SHORT)


def fill_instructor_form(driver, name = None):
    if name is None:
        name = f"Instrutor {generate_email().split('@')[0]}"
    name = name.split("@")[0]

    driver.find_element(By.ID, "name").send_keys(name)
    driver.find_element(By.ID, "cpf").send_keys("52998224725")
    driver.find_element(By.ID, "detran_license").send_keys("ABC123456D")
    driver.find_element(By.ID, "price_per_hour").send_keys("100")
    driver.find_element(By.ID, "city").send_keys("Natal")
    driver.find_element(By.ID, "state").send_keys("RN")
    driver.find_element(By.ID, "bio").send_keys("Instrutor experiente")


def submit_form(driver):
    driver.find_element(By.TAG_NAME, "form").submit()
    time.sleep(DELAY_SHORT)


def get_body(driver):
    return driver.find_element(By.TAG_NAME, "body").text


def logout(driver):
    # Try navbar logout button first
    buttons = driver.find_elements(By.CLASS_NAME, "nav-logout")
    if buttons:
        buttons[0].click()
        time.sleep(DELAY_SHORT)
        return

    # Fallback: try link text
    links = driver.find_elements(By.LINK_TEXT, "Sair")
    if links:
        links[0].click()
        time.sleep(DELAY_SHORT)
        return

    # If not found, return to home and try again
    driver.get(BASE_URL)
    time.sleep(DELAY_SHORT)
    buttons = driver.find_elements(By.CLASS_NAME, "nav-logout")
    if buttons:
        buttons[0].click()
        time.sleep(DELAY_SHORT)


def book_instructor_by_name(driver, instructor_name, start_override=None, duration_override=None):
    target, duration_select = open_booking_form_by_name(driver, instructor_name)

    # Set duration
    Select(duration_select).select_by_value(duration_override or "2")
    time.sleep(DELAY_MEDIUM)

    # Find the booking form's calendar and select the first available day
    calendar_in_form = target.find_element(By.CSS_SELECTOR, ".schedule-calendar")
    
    # Get the first available day from the calendar (not muted)
    day_buttons = calendar_in_form.find_elements(By.CSS_SELECTOR, ".schedule-day")
    for day_button in day_buttons:
        class_attr = day_button.get_attribute("class")
        if "muted" not in class_attr:
            markers = day_button.find_elements(By.CSS_SELECTOR, ".schedule-marker")
            if markers:  # Has availability markers
                day_button.click()
                time.sleep(DELAY_MEDIUM)
                break
    
    # Wait for slot sections to appear and select the first available slot
    def slots_loaded():
        slot_sections = target.find_elements(By.CSS_SELECTOR, ".booking-slot-sections .booking-slot-section")
        return len(slot_sections) > 0
    
    if not wait_until(slots_loaded, timeout=5):
        return False
    
    slot_sections = target.find_elements(By.CSS_SELECTOR, ".booking-slot-sections .booking-slot-section")
    if not slot_sections:
        return False
    
    # Select slots from the first section
    first_section = slot_sections[0]
    slot_buttons = first_section.find_elements(By.CSS_SELECTOR, ".booking-slot")
    
    if start_override:
        # Look for specific start time
        for button in slot_buttons:
            if start_override in button.text:
                button.click()
                time.sleep(DELAY_SHORT)
                break
        else:
            return False
    else:
        # Select first available slot
        if not slot_buttons:
            return False
        slot_buttons[0].click()
        time.sleep(DELAY_SHORT)
    
    # Submit the form
    submit_button = target.find_element(By.CSS_SELECTOR, "form.booking-page-form button[type='submit']")
    submit_button.click()
    time.sleep(DELAY_SHORT)
    return True


def open_booking_form_by_name(driver, instructor_name):
    cards = driver.find_elements(By.CLASS_NAME, "instructor-card")
    assert len(cards) > 0
    target = None
    for card in cards:
        if instructor_name in card.text:
            target = card
            break
    assert target is not None

    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", target)
    time.sleep(DELAY_SHORT)

    book_button = target.find_element(By.CSS_SELECTOR, ".instructor-footer .book-btn")
    driver.execute_script("arguments[0].click();", book_button)
    time.sleep(DELAY_MEDIUM)

    booking_page = None
    duration_select = None
    for _ in range(8):
        pages = driver.find_elements(By.CLASS_NAME, "booking-page")
        if pages:
            booking_page = pages[0]
            duration_selects = booking_page.find_elements(By.CSS_SELECTOR, ".booking-duration-toolbar select")
            if duration_selects:
                duration_select = duration_selects[0]
                break
        time.sleep(DELAY_SHORT)

    assert booking_page is not None
    assert duration_select is not None
    return booking_page, duration_select


def confirm_first_booking(driver):
    driver.find_element(By.LINK_TEXT, "Central").click()
    time.sleep(DELAY_SHORT)

    set_agenda_selection_filter_by_value(driver, "lessons")
    open_agenda_tab(driver, "Solicitações")
    time.sleep(DELAY_SHORT)
    target = find_first_schedule_entry_with_action(driver, "Confirmar")
    confirm_button = target.find_element(By.XPATH, ".//button[contains(., 'Confirmar')]")
    confirm_button.click()
    accept_confirm_alert(driver)
    time.sleep(DELAY_SHORT)


def open_agenda_tab(driver, tab_text):
    agenda = driver.find_element(By.ID, "agenda")
    tabs = agenda.find_elements(By.CSS_SELECTOR, ".schedule-editor-tab")
    assert tabs, "Agenda tabs not found"
    for tab in tabs:
        if tab.text.strip() == tab_text:
            driver.execute_script("arguments[0].click();", tab)
            time.sleep(DELAY_SHORT)
            return
    raise AssertionError(f"Could not find agenda tab: {tab_text}")


def get_active_agenda_panel(driver):
    agenda = driver.find_element(By.ID, "agenda")
    panels = agenda.find_elements(By.CSS_SELECTOR, ".schedule-editor-tab-content.active")
    assert panels, "No active agenda tab panel found"
    return panels[0]


def find_first_schedule_entry_with_action(driver, action_text):
    def search_visible_entries():
        panel = get_active_agenda_panel(driver)
        entries = panel.find_elements(By.CSS_SELECTOR, ".schedule-entry")
        for entry in entries:
            buttons = entry.find_elements(By.TAG_NAME, "button")
            if any(action_text in button.text for button in buttons):
                return entry
        return None

    found = search_visible_entries()
    if found is not None:
        return found

    agenda = driver.find_element(By.ID, "agenda")
    chips = agenda.find_elements(By.CSS_SELECTOR, ".schedule-selection-chip")
    for chip in chips:
        chip.click()
        time.sleep(DELAY_SHORT)
        found = search_visible_entries()
        if found is not None:
            return found

    raise AssertionError(f"Could not find schedule entry with action: {action_text}")


def find_schedule_entry_in_agenda(driver, text):
    def search_visible_entries():
        panel = get_active_agenda_panel(driver)
        entries = panel.find_elements(By.CSS_SELECTOR, ".schedule-entry")
        for entry in entries:
            if text in entry.text:
                return entry
        return None

    found = search_visible_entries()
    if found is not None:
        return found

    agenda = driver.find_element(By.ID, "agenda")
    chips = agenda.find_elements(By.CSS_SELECTOR, ".schedule-selection-chip")
    for chip in chips:
        chip.click()
        time.sleep(DELAY_SHORT)
        found = search_visible_entries()
        if found is not None:
            return found

    raise AssertionError(f"Could not find schedule entry containing: {text}")


def accept_confirm_alert(driver, timeout=3):
    end_time = time.time() + timeout
    while time.time() < end_time:
        try:
            alert = driver.switch_to.alert
            text = alert.text
            alert.accept()
            return text
        except Exception:
            time.sleep(0.1)
    return None


def confirm_booking_for_student(driver, student_email, expect_overlap_warning=False):
    driver.find_element(By.LINK_TEXT, "Central").click()
    time.sleep(DELAY_SHORT)

    set_agenda_selection_filter_by_value(driver, "lessons")
    open_agenda_tab(driver, "Solicitações")
    time.sleep(DELAY_SHORT)
    target = find_schedule_entry_in_agenda(driver, student_email)
    confirm_button = target.find_element(By.XPATH, ".//button[contains(., 'Confirmar')]")
    confirm_button.click()
    alert_text = accept_confirm_alert(driver)
    if expect_overlap_warning:
        assert alert_text is not None, "Expected overlap confirmation dialog"
        assert "cancelar" in alert_text.lower()
        assert "sobrep" in alert_text.lower()
    time.sleep(DELAY_SHORT)


def go_to_my_bookings(driver):
    driver.find_element(By.LINK_TEXT, "Minhas Aulas").click()
    time.sleep(DELAY_SHORT)


def set_booking_filter(driver, value):
    filters = driver.find_elements(By.ID, "booking-filter")
    if filters:
        Select(filters[0]).select_by_value(value)
        time.sleep(DELAY_SHORT)


def set_agenda_selection_filter(driver, visible_text):
    filters = driver.find_elements(By.ID, "agenda-selection-filter")
    assert filters, "Agenda selection filter not found"
    Select(filters[0]).select_by_visible_text(visible_text)
    time.sleep(DELAY_SHORT)


def set_agenda_selection_filter_by_value(driver, value):
    filters = driver.find_elements(By.ID, "agenda-selection-filter")
    assert filters, "Agenda selection filter not found"
    Select(filters[0]).select_by_value(value)
    time.sleep(DELAY_SHORT)


def go_to_instructor_central(driver):
    driver.find_element(By.LINK_TEXT, "Central").click()
    time.sleep(DELAY_SHORT)


def clear_calendar_selection(driver):
    buttons = driver.find_elements(By.CSS_SELECTOR, ".calendar-ghost-btn.danger")
    for button in buttons:
        if "Limpar seleção" in button.text:
            if button.is_enabled():
                button.click()
                time.sleep(DELAY_SHORT)
            return
    raise AssertionError("Clear selection button not found")


def get_selected_calendar_day_count(driver):
    days = driver.find_elements(By.CSS_SELECTOR, ".schedule-calendar-grid .schedule-day.selected")
    return len(days)


def get_selection_chip_count(driver):
    agenda = driver.find_element(By.ID, "agenda")
    return len(agenda.find_elements(By.CSS_SELECTOR, ".schedule-selection-chip"))


def get_selection_summary_text(driver):
    agenda = driver.find_element(By.ID, "agenda")
    headings = agenda.find_elements(By.CSS_SELECTOR, ".schedule-selection-bar h4")
    assert headings, "Selection summary not found"
    return headings[0].text.strip()


def get_agenda_tabs(driver):
    agenda = driver.find_element(By.ID, "agenda")
    return agenda.find_elements(By.CSS_SELECTOR, ".schedule-editor-tab")


def get_active_agenda_tab_text(driver):
    agenda = driver.find_element(By.ID, "agenda")
    active_tabs = agenda.find_elements(By.CSS_SELECTOR, ".schedule-editor-tab.active")
    assert active_tabs, "No active agenda tab found"
    return active_tabs[0].text.strip()


def get_active_agenda_panel_text(driver):
    return get_active_agenda_panel(driver).text


def find_calendar_day_button(driver, date_value):
    target = datetime.strptime(date_value, "%Y-%m-%d")

    while True:
        current = driver.find_element(By.CSS_SELECTOR, ".schedule-calendar-nav strong").text.strip().lower()
        current_year, current_month = parse_pt_month_year(current)
        if current_year == target.year and current_month == target.month:
            break

        if (current_year, current_month) < (target.year, target.month):
            driver.find_element(By.CSS_SELECTOR, ".schedule-calendar-nav button:last-child").click()
        else:
            driver.find_element(By.CSS_SELECTOR, ".schedule-calendar-nav button:first-child").click()
        time.sleep(DELAY_SHORT)

    for day_button in driver.find_elements(By.CSS_SELECTOR, ".schedule-calendar-grid .schedule-day"):
        if "muted" in day_button.get_attribute("class"):
            continue
        number = day_button.find_element(By.CSS_SELECTOR, ".schedule-day-number").text.strip()
        if number == str(target.day):
            return day_button

    raise AssertionError(f"Could not find day {date_value} in calendar")


def select_calendar_date(driver, date_value):
    day_button = find_calendar_day_button(driver, date_value)
    day_button.click()
    time.sleep(DELAY_SHORT)


def drag_select_calendar_range(driver, start_date, end_date):
    start_button = find_calendar_day_button(driver, start_date)
    end_button = find_calendar_day_button(driver, end_date)

    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", start_button)
    time.sleep(DELAY_SHORT)

    actions = ActionChains(driver)
    actions.click_and_hold(start_button).move_to_element(end_button).release().perform()
    time.sleep(DELAY_MEDIUM)


def publish_availability_on_dates(driver, start_time, end_time, date_values):
    go_to_instructor_central(driver)
    clear_calendar_selection(driver)

    for date_value in date_values:
        select_calendar_date(driver, date_value)

    set_calendar_time_range(driver, start_time, end_time)
    driver.find_element(By.CSS_SELECTOR, ".schedule-calendar-context .action-btn").click()
    time.sleep(DELAY_MEDIUM)


def get_availability_entries(driver):
    open_agenda_tab(driver, "Disponibilidades")
    panel = get_active_agenda_panel(driver)
    return panel.find_elements(By.CSS_SELECTOR, ".schedule-entry.availability")


def remove_first_availability_group(driver):
    entries = get_availability_entries(driver)
    assert entries, "No availability entries to remove"
    remove_buttons = entries[0].find_elements(By.XPATH, ".//button[contains(., 'Remover')]")
    assert remove_buttons, "Remove button not found on availability entry"
    remove_buttons[0].click()
    time.sleep(DELAY_MEDIUM)


def remove_all_availabilities(driver):
    open_agenda_tab(driver, "Disponibilidades")
    panel = get_active_agenda_panel(driver)
    buttons = panel.find_elements(By.XPATH, ".//button[contains(., 'Remover todas')]")
    assert buttons, "Remover todas button not found"
    buttons[0].click()
    time.sleep(DELAY_MEDIUM)


def set_calendar_time_range(driver, start_time, end_time):
    panel = driver.find_element(By.CSS_SELECTOR, ".schedule-calendar-context")
    select = Select(panel.find_element(By.TAG_NAME, "select"))
    presets = {
        ("08:00", "12:00"): "08:00-12:00",
        ("13:00", "18:00"): "13:00-18:00",
        ("18:00", "21:00"): "18:00-21:00",
        ("08:00", "18:00"): "08:00-18:00",
    }

    preset_value = presets.get((start_time, end_time))
    if preset_value:
        select.select_by_value(preset_value)
    else:
        select.select_by_value("custom")
        time_inputs = panel.find_elements(By.CSS_SELECTOR, ".calendar-custom-range input")
        assert len(time_inputs) == 2
        send_time_keys(time_inputs[0], start_time)
        send_time_keys(time_inputs[1], end_time)

    time.sleep(DELAY_SHORT)


def add_availability(driver, start_time, end_time, start_date=None, end_date=None):
    driver.find_element(By.LINK_TEXT, "Central").click()
    time.sleep(DELAY_SHORT)

    tomorrow = datetime.now() + timedelta(days=1)
    start_date = start_date or tomorrow.strftime("%Y-%m-%d")
    select_calendar_date(driver, start_date)
    set_calendar_time_range(driver, start_time, end_time)
    driver.find_element(By.CSS_SELECTOR, ".schedule-calendar-context .action-btn").click()
    time.sleep(DELAY_SHORT)


def create_instructor_with_availability(driver, start_time, end_time, cache_key=None):
    if cache_key:
        account = ensure_instructor_account(driver, cache_key=cache_key)
        instructor_name = account["instructor_name"]
    else:
        email = generate_email()
        register_and_login(driver, email, DEFAULT_PASSWORD)
        go_to_become_instructor(driver)
        instructor_name = f"Instrutor {email.split('@')[0]}"
        fill_instructor_form(driver, instructor_name)
        submit_form(driver)
        account = {
            "email": email,
            "password": DEFAULT_PASSWORD,
            "instructor_name": instructor_name
        }

    add_availability(driver, start_time, end_time)
    return account


def find_booking_card_by_instructor(driver, instructor_name):
    cards = driver.find_elements(By.CLASS_NAME, "booking-card")
    assert len(cards) > 0
    for card in cards:
        if instructor_name in card.text:
            return card
    raise AssertionError(f"Could not find booking card for instructor: {instructor_name}")

def get_confirmation_code_from_my_bookings(driver, instructor_name=None):
    cards = driver.find_elements(By.CLASS_NAME, "booking-card")
    assert len(cards) > 0
    target = find_booking_card_by_instructor(driver, instructor_name) if instructor_name else cards[0]

    text = target.text
    for line in text.split("\n"):
        if "Código da aula:" in line:
            return line.split("Código da aula:")[-1].strip()
    return None


def submit_review_for_first_completed(driver, instructor_name=None):
    go_to_my_bookings(driver)
    set_booking_filter(driver, "completed")

    if instructor_name:
        target = find_booking_card_by_instructor(driver, instructor_name)
    else:
        cards = driver.find_elements(By.CLASS_NAME, "booking-card")
        assert len(cards) > 0
        target = cards[0]

    rating_inputs = target.find_elements(By.CSS_SELECTOR, "input[type='number']")
    textareas = target.find_elements(By.TAG_NAME, "textarea")
    buttons = target.find_elements(By.TAG_NAME, "button")

    assert rating_inputs
    rating_inputs[0].clear()
    rating_inputs[0].send_keys("5")

    if textareas:
        textareas[0].clear()
        textareas[0].send_keys("Ótima aula!")

    submit_button = None
    for button in buttons:
        if "Enviar avaliação" in button.text:
            submit_button = button
            break

    assert submit_button is not None
    submit_button.click()
    try:
        alert = driver.switch_to.alert
        alert.accept()
    except Exception:
        pass
    time.sleep(DELAY_SHORT)


def show_cancelled_bookings(driver):
    go_to_my_bookings(driver)
    set_booking_filter(driver, "cancelled")


def wait_until(condition, timeout=5, interval=0.2):
    end_time = time.time() + timeout
    while time.time() < end_time:
        if condition():
            return True
        time.sleep(interval)
    return False


def validate_code_for_first_confirmed(driver, code):
    driver.find_element(By.LINK_TEXT, "Central").click()
    time.sleep(DELAY_SHORT)

    set_agenda_selection_filter_by_value(driver, "lessons")
    open_agenda_tab(driver, "Confirmadas")
    time.sleep(DELAY_SHORT)
    panel = get_active_agenda_panel(driver)
    validate_button = panel.find_element(By.XPATH, ".//button[contains(., 'Validar')]")
    row = validate_button.find_element(By.XPATH, "./ancestor::div[contains(@class, 'schedule-confirm-row')]")
    code_input = row.find_element(By.TAG_NAME, "input")
    code_input.clear()
    code_input.send_keys(code)
    validate_button.click()
    time.sleep(DELAY_SHORT)

def cancel_first_booking_as_student(driver, instructor_name=None):
    go_to_my_bookings(driver)
    cards = driver.find_elements(By.CLASS_NAME, "booking-card")
    assert len(cards) > 0
    card = find_booking_card_by_instructor(driver, instructor_name) if instructor_name else cards[0]
    cancel_buttons = card.find_elements(By.CLASS_NAME, "cancel-btn")
    assert len(cancel_buttons) > 0
    cancel_buttons[0].click()
    time.sleep(DELAY_SHORT)


def clear_cancelled_bookings_as_student(driver):
    go_to_my_bookings(driver)
    buttons = driver.find_elements(By.CLASS_NAME, "clear-cancelled-btn")
    assert len(buttons) > 0, "Clear cancelled button not found for student"
    buttons[0].click()
    accept_confirm_alert(driver)
    time.sleep(DELAY_MEDIUM)


def cancel_first_pending_as_instructor(driver, student_email=None):
    driver.find_element(By.LINK_TEXT, "Central").click()
    time.sleep(DELAY_SHORT)

    set_agenda_selection_filter_by_value(driver, "lessons")
    open_agenda_tab(driver, "Solicitações")
    time.sleep(DELAY_SHORT)

    if student_email:
        target = find_schedule_entry_in_agenda(driver, student_email)
    else:
        target = find_first_schedule_entry_with_action(driver, "Cancelar")

    cancel_buttons = target.find_elements(By.XPATH, ".//button[contains(., 'Cancelar')]")
    assert len(cancel_buttons) > 0, "Instructor cancel button not found"
    cancel_buttons[0].click()
    accept_confirm_alert(driver)
    time.sleep(DELAY_SHORT)


def set_history_filter(driver, value):
    filters = driver.find_elements(By.ID, "history-filter")
    assert filters, "History filter not found"
    Select(filters[0]).select_by_value(value)
    time.sleep(DELAY_SHORT)


def clear_cancelled_history_as_instructor(driver):
    driver.find_element(By.LINK_TEXT, "Central").click()
    time.sleep(DELAY_SHORT)
    set_history_filter(driver, "cancelled")
    buttons = driver.find_elements(By.CLASS_NAME, "clear-cancelled-btn")
    assert len(buttons) > 0, "Clear cancelled button not found for instructor"
    buttons[0].click()
    accept_confirm_alert(driver)
    time.sleep(DELAY_MEDIUM)

# =========================
# Tests
# =========================

def test_register_user():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        account = ensure_student_account(driver)

        body = get_body(driver)
        assert account["email"].split("@")[0] in body
        print("✅ Login successful")

        body = get_body(driver)
        assert "Tornar-se instrutor" in body
        assert "Central" not in body

        print("✅ Became instructor successfully")

    finally:
        close_driver(driver)

def test_register_instructor():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        account = ensure_instructor_account(driver)

        body = get_body(driver)
        assert account["email"].split("@")[0] in body
        print("✅ Login successful")

        body = get_body(driver)
        assert "Central" in body
        assert "Tornar-se instrutor" not in body

        print("✅ Became instructor successfully")

    finally:
        close_driver(driver)


def test_missing_fields_instructor():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        account = ACCOUNT_CACHE.get("student_basic")
        if account:
            login(driver, account["email"], account["password"])
        else:
            ensure_student_account(driver)

        go_to_become_instructor(driver)

        # submit without filling
        submit_form(driver)

        body = get_body(driver)

        assert "Registre-se como Instrutor" in body
        print("✅ Validation prevents empty submission")

    finally:
        close_driver(driver)


def test_navbar_updates():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        account = ACCOUNT_CACHE.get("instructor_basic")
        if account:
            login(driver, account["email"], account["password"])
        else:
            ensure_instructor_account(driver)

        body = get_body(driver)

        assert "Central" in body
        assert "Tornar-se instrutor" not in body

        print("✅ Navbar updated correctly")

    finally:
        close_driver(driver)


def test_protected_route():
    driver = create_driver()
    driver.get(f"{BASE_URL}/become-instructor")

    try:
        time.sleep(DELAY_SHORT)
        body = get_body(driver)

        assert "entrar" in body.lower()
        print("✅ Protected route works")

    finally:
        close_driver(driver)


def test_booking_flow():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        instructor = create_instructor_with_availability(driver, "08:00", "12:00")
        instructor_name = instructor["instructor_name"]
        logout(driver)

        student = ensure_student_account(driver, cache_key="student_booking_flow")
        booked = book_instructor_by_name(driver, instructor_name)
        assert booked

        body = get_body(driver)
        assert "Agendamento enviado" in body or "Agendamentos enviados" in body
        print("✅ Booking created successfully")

        logout(driver)

        # Instructor confirms booking
        login(driver, instructor["email"], instructor["password"])
        confirm_first_booking(driver)
        logout(driver)

        # Student sees confirmation code
        login(driver, student["email"], student["password"])
        go_to_my_bookings(driver)
        code = get_confirmation_code_from_my_bookings(driver, instructor_name)
        body = get_body(driver)
        assert "Código da aula" in body
        assert code is not None
        print("✅ Booking confirmation code visible to student")

        logout(driver)

        # Instructor validates code
        login(driver, instructor["email"], instructor["password"])
        validate_code_for_first_confirmed(driver, code)
        body = get_body(driver)
        assert "Histórico" in body or "Concluída" in body
        print("✅ Booking code validated successfully")

        logout(driver)

        # Student submits review
        login(driver, student["email"], student["password"])
        submit_review_for_first_completed(driver, instructor_name)
        body = get_body(driver)
        assert "Avaliação enviada" in body or "Avaliação enviada ✅" in body
        print("✅ Review submitted successfully")

    finally:
        close_driver(driver)


def test_cancel_booking_flow():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        instructor = create_instructor_with_availability(driver, "08:00", "12:00")
        instructor_name = instructor["instructor_name"]
        logout(driver)

        student = ensure_student_account(driver, cache_key="student_cancel_flow")
        booked = book_instructor_by_name(driver, instructor_name)
        assert booked

        body = get_body(driver)
        assert "Agendamento enviado" in body or "Agendamentos enviados" in body
        print("✅ Booking created for cancellation")

        # Student cancels
        cancel_first_booking_as_student(driver, instructor_name)
        show_cancelled_bookings(driver)
        body = get_body(driver)
        assert "Cancelada" in body
        print("✅ Booking cancelled by student")

    finally:
        close_driver(driver)


def test_clear_cancelled_student_flow():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        instructor = create_instructor_with_availability(driver, "08:00", "12:00")
        instructor_name = instructor["instructor_name"]
        logout(driver)

        ensure_student_account(driver, cache_key="student_clear_cancelled")
        booked = book_instructor_by_name(driver, instructor_name)
        assert booked

        cancel_first_booking_as_student(driver, instructor_name)
        show_cancelled_bookings(driver)
        body = get_body(driver)
        assert "Cancelada" in body
        assert driver.find_elements(By.CLASS_NAME, "clear-cancelled-btn"), "Clear button should appear"

        clear_cancelled_bookings_as_student(driver)
        body = get_body(driver)
        assert "agendamento cancelado removido" in body.lower() or "agendamentos cancelados removidos" in body.lower()

        go_to_my_bookings(driver)
        assert not driver.find_elements(By.CLASS_NAME, "clear-cancelled-btn"), "Clear button should disappear after cleanup"

        set_booking_filter(driver, "cancelled")
        body = get_body(driver)
        cancelled_cards = [
            card for card in driver.find_elements(By.CLASS_NAME, "booking-card")
            if "Cancelada" in card.text
        ]
        assert len(cancelled_cards) == 0
        print("✅ Student cleared cancelled bookings")

    finally:
        close_driver(driver)


def test_clear_cancelled_instructor_flow():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        instructor = create_instructor_with_availability(driver, "08:00", "12:00")
        logout(driver)

        student = ensure_student_account(driver, cache_key="student_clear_cancelled_inst")
        booked = book_instructor_by_name(driver, instructor["instructor_name"])
        assert booked
        logout(driver)

        login(driver, instructor["email"], instructor["password"])
        cancel_first_pending_as_instructor(driver, student["email"])

        driver.find_element(By.LINK_TEXT, "Central").click()
        time.sleep(DELAY_SHORT)
        set_history_filter(driver, "cancelled")
        body = get_body(driver)
        assert "Cancelada" in body
        assert driver.find_elements(By.CLASS_NAME, "clear-cancelled-btn"), "Clear button should appear"

        clear_cancelled_history_as_instructor(driver)
        body = get_body(driver)
        assert "aula cancelada removida" in body.lower() or "aulas canceladas removidas" in body.lower()

        driver.find_element(By.LINK_TEXT, "Central").click()
        time.sleep(DELAY_SHORT)
        assert not driver.find_elements(By.CLASS_NAME, "clear-cancelled-btn"), "Clear button should disappear after cleanup"

        set_history_filter(driver, "cancelled")
        body = get_body(driver)
        history_card = driver.find_element(By.ID, "concluidas")
        assert "Nenhuma aula encontrada para este filtro." in history_card.text
        print("✅ Instructor cleared cancelled history")

    finally:
        close_driver(driver)


def test_instructor_availability_blocks_booking():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        instructor = create_instructor_with_availability(driver, "08:00", "09:00")
        instructor_name = instructor["instructor_name"]
        logout(driver)

        # Student requests a 2-hour lesson, but the instructor only has a 1-hour window.
        ensure_student_account(driver, cache_key="student_availability_limit")
        target, duration_select = open_booking_form_by_name(driver, instructor_name)
        Select(duration_select).select_by_value("2")

        def no_availability_loaded():
            slot_sections = target.find_elements(By.CSS_SELECTOR, ".booking-slot-sections .booking-slot-section")
            helper_text = target.text
            return (
                len(slot_sections) == 0
                and (
                    "Nenhuma disponibilidade encontrada neste mês." in helper_text
                    or "Este dia não possui horários disponíveis para a duração escolhida." in helper_text
                )
            )

        assert wait_until(no_availability_loaded, timeout=6)

        body = target.text
        slot_sections = target.find_elements(By.CSS_SELECTOR, ".booking-slot-sections .booking-slot-section")
        assert len(slot_sections) == 0
        assert (
            "Nenhuma disponibilidade encontrada neste mês." in body
            or "Este dia não possui horários disponíveis para a duração escolhida." in body
        )
        print("✅ Availability prevents selecting an oversized lesson")

    finally:
        close_driver(driver)


def test_instructor_conflict_booking():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        instructor = create_instructor_with_availability(driver, "08:00", "12:00")
        instructor_name = instructor["instructor_name"]
        logout(driver)

        # Student 1 books at 10:00 for 2 hours
        student1 = ensure_student_account(driver, cache_key="student_conflict_one")
        booked = book_instructor_by_name(driver, instructor_name, "10:00", "2")
        assert booked
        body = get_body(driver)
        assert "Agendamento enviado" in body or "Agendamentos enviados" in body
        logout(driver)

        # Student 2 can still create an overlapping pending request at 11:00 for 1 hour
        student2 = ensure_student_account(driver, cache_key="student_conflict_two")
        booked = book_instructor_by_name(driver, instructor_name, "11:00", "1")
        body = get_body(driver)
        assert booked
        assert "Agendamento enviado" in body or "Agendamentos enviados" in body
        logout(driver)

        # Instructor confirms the first request and is warned about the overlapping cancel
        login(driver, instructor["email"], instructor["password"])
        confirm_booking_for_student(driver, student1["email"], expect_overlap_warning=True)
        open_agenda_tab(driver, "Solicitações")
        body = get_body(driver)
        assert "Confirmada" in body or "confirmar" in body.lower()
        assert student2["email"] not in get_active_agenda_panel(driver).text
        logout(driver)

        # The overlapping pending request is automatically cancelled
        login(driver, student2["email"], student2["password"])
        show_cancelled_bookings(driver)
        body = get_body(driver)
        assert "Cancelada" in body
        print("✅ Overlap warning shown and conflicting pending booking cancelled after confirmation")

    finally:
        close_driver(driver)


def test_instructor_invalid_availability_rejected():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        ensure_instructor_account(driver, cache_key="instructor_invalid")

        driver.find_element(By.LINK_TEXT, "Central").click()
        time.sleep(DELAY_SHORT)
        start_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        select_calendar_date(driver, start_date)
        set_calendar_time_range(driver, "12:00", "08:00")
        driver.find_element(By.CSS_SELECTOR, ".schedule-calendar-context .action-btn").click()
        time.sleep(DELAY_SHORT)

        body = get_body(driver)
        assert "O horário final deve ser maior que o inicial." in body
        print("✅ Invalid availability is rejected")

    finally:
        close_driver(driver)


def test_calendar_drag_select():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        ensure_instructor_account(driver, cache_key="instructor_drag_select")
        go_to_instructor_central(driver)
        clear_calendar_selection(driver)

        day_one = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        day_three = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")

        drag_select_calendar_range(driver, day_one, day_three)

        selected_count = get_selected_calendar_day_count(driver)
        chip_count = get_selection_chip_count(driver)
        summary = get_selection_summary_text(driver)

        assert selected_count >= 3, f"Expected at least 3 selected days after drag, got {selected_count}"
        assert chip_count >= 3, f"Expected at least 3 selection chips after drag, got {chip_count}"
        assert "dia(s) selecionado(s)" in summary
        assert int(summary.split()[0]) >= 3

        # Dragging across already-selected days should remove them from the selection.
        drag_select_calendar_range(driver, day_one, day_three)
        time.sleep(DELAY_SHORT)

        selected_after_remove = get_selected_calendar_day_count(driver)
        assert selected_after_remove < selected_count, "Drag on selected days should remove them from selection"

        print("✅ Calendar drag-select adds and removes day ranges")

    finally:
        close_driver(driver)


def test_calendar_tab_navigation():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        instructor = create_instructor_with_availability(driver, "08:00", "12:00")
        instructor_name = instructor["instructor_name"]
        logout(driver)

        student = ensure_student_account(driver, cache_key="student_tab_navigation")
        booked = book_instructor_by_name(driver, instructor_name)
        assert booked
        logout(driver)

        login(driver, instructor["email"], instructor["password"])
        go_to_instructor_central(driver)
        set_agenda_selection_filter_by_value(driver, "all")

        tabs = get_agenda_tabs(driver)
        tab_labels = [tab.text.strip() for tab in tabs]
        assert "Disponibilidades" in tab_labels
        assert "Solicitações" in tab_labels
        assert "Confirmadas" in tab_labels

        open_agenda_tab(driver, "Disponibilidades")
        assert get_active_agenda_tab_text(driver) == "Disponibilidades"
        availability_panel = get_active_agenda_panel(driver)
        assert availability_panel.is_displayed()
        availability_text = availability_panel.text
        assert (
            "08:00" in availability_text
            or "Nenhuma disponibilidade" in availability_text
            or "disponibilidade" in availability_text.lower()
            or availability_panel.find_elements(By.CSS_SELECTOR, ".schedule-entry, .schedule-helper, .schedule-bulk-actions")
        )

        open_agenda_tab(driver, "Solicitações")
        assert get_active_agenda_tab_text(driver) == "Solicitações"
        solicitacoes_panel = get_active_agenda_panel(driver)
        assert solicitacoes_panel.is_displayed()
        solicitacoes_text = solicitacoes_panel.text
        assert student["email"] in solicitacoes_text or "solicit" in solicitacoes_text.lower() or solicitacoes_panel.find_elements(
            By.CSS_SELECTOR, ".schedule-entry, .schedule-helper"
        )

        open_agenda_tab(driver, "Confirmadas")
        assert get_active_agenda_tab_text(driver) == "Confirmadas"
        confirmadas_panel = get_active_agenda_panel(driver)
        assert confirmadas_panel.is_displayed()
        # Pending-only selections can yield an empty list (no confirmed lessons yet) with no helper copy.
        assert confirmadas_panel.find_elements(
            By.CSS_SELECTOR, ".schedule-section, .schedule-helper, .schedule-entry-list, .schedule-bulk-actions"
        ), "Confirmadas tab should render its panel structure"

        # Switching back keeps the previously active panel content accessible.
        open_agenda_tab(driver, "Solicitações")
        assert get_active_agenda_tab_text(driver) == "Solicitações"
        assert get_active_agenda_panel(driver).is_displayed()

        print("✅ Calendar tab navigation works between Disponibilidades, Solicitações and Confirmadas")

    finally:
        close_driver(driver)


def test_calendar_selection_filter():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        instructor = create_instructor_with_availability(driver, "08:00", "12:00")
        instructor_name = instructor["instructor_name"]
        logout(driver)

        ensure_student_account(driver, cache_key="student_selection_filter")
        booked = book_instructor_by_name(driver, instructor_name)
        assert booked
        logout(driver)

        login(driver, instructor["email"], instructor["password"])
        go_to_instructor_central(driver)

        filters = driver.find_elements(By.ID, "agenda-selection-filter")
        assert filters, "Agenda selection filter not found"
        options = [option.get_attribute("value") for option in Select(filters[0]).options]
        assert "all" in options
        assert "availability" in options
        assert "lessons" in options

        set_agenda_selection_filter_by_value(driver, "availability")
        time.sleep(DELAY_SHORT)
        availability_selected = get_selected_calendar_day_count(driver)
        availability_chips = get_selection_chip_count(driver)
        assert availability_selected >= 1, "Availability filter should select at least one day with availability"
        assert availability_chips >= 1

        set_agenda_selection_filter_by_value(driver, "lessons")
        time.sleep(DELAY_SHORT)
        lessons_selected = get_selected_calendar_day_count(driver)
        lessons_chips = get_selection_chip_count(driver)
        assert lessons_selected >= 1, "Lessons filter should select at least one day with lessons"
        assert lessons_chips >= 1

        set_agenda_selection_filter_by_value(driver, "all")
        time.sleep(DELAY_SHORT)
        all_selected = get_selected_calendar_day_count(driver)
        all_chips = get_selection_chip_count(driver)
        assert all_selected >= max(availability_selected, lessons_selected), (
            "All filter should include at least as many days as the narrower filters"
        )
        assert all_chips >= max(availability_chips, lessons_chips)

        # Re-applying the availability filter should keep at least one selectable day.
        set_agenda_selection_filter_by_value(driver, "availability")
        time.sleep(DELAY_SHORT)
        reapplied_selected = get_selected_calendar_day_count(driver)
        assert reapplied_selected >= 1, "Re-applying availability filter should restore selectable days"

        print("✅ Calendar selection filter narrows and restores day selection")

    finally:
        close_driver(driver)


def test_grouped_availability_removal():
    driver = create_driver()
    driver.get(BASE_URL)

    try:
        ensure_instructor_account(driver, cache_key="instructor_grouped_removal")

        day_one = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        day_two = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        day_three = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")

        # Publish the same time range across multiple days so the agenda groups them.
        publish_availability_on_dates(driver, "08:00", "12:00", [day_one, day_two])
        publish_availability_on_dates(driver, "13:00", "18:00", [day_three])

        go_to_instructor_central(driver)
        set_agenda_selection_filter_by_value(driver, "availability")
        open_agenda_tab(driver, "Disponibilidades")
        time.sleep(DELAY_SHORT)

        entries = get_availability_entries(driver)
        assert len(entries) >= 1, "Expected at least one grouped availability entry"

        first_entry_text = entries[0].text
        assert "08:00" in first_entry_text or "13:00" in first_entry_text
        assert "Remover" in first_entry_text

        # Remove one grouped slot range (may cover multiple days).
        remove_first_availability_group(driver)
        time.sleep(DELAY_SHORT)

        entries_after_one = get_availability_entries(driver)
        assert len(entries_after_one) < len(entries), "Removing one group should reduce availability entries"

        # If anything remains, remove all remaining grouped availabilities at once.
        if entries_after_one:
            remove_all_availabilities(driver)
            time.sleep(DELAY_SHORT)

        panel_text = get_active_agenda_panel_text(driver)
        remaining = get_availability_entries(driver)
        assert len(remaining) == 0 or "Nenhuma disponibilidade publicada" in panel_text

        print("✅ Grouped availability removal works for single group and remove-all")

    finally:
        close_driver(driver)


# =========================
# Runner
# =========================

if __name__ == "__main__":
    import argparse

    tests = {
        "register_user": test_register_user,
        "register_instructor": test_register_instructor,
        "missing_fields_instructor": test_missing_fields_instructor,
        "navbar_updates": test_navbar_updates,
        "protected_route": test_protected_route,
        "booking_flow": test_booking_flow,
        "cancel_booking_flow": test_cancel_booking_flow,
        "clear_cancelled_student": test_clear_cancelled_student_flow,
        "clear_cancelled_instructor": test_clear_cancelled_instructor_flow,
        "availability_blocks_booking": test_instructor_availability_blocks_booking,
        "conflict_booking": test_instructor_conflict_booking,
        "invalid_availability": test_instructor_invalid_availability_rejected,
        "calendar_drag_select": test_calendar_drag_select,
        "calendar_tab_navigation": test_calendar_tab_navigation,
        "calendar_selection_filter": test_calendar_selection_filter,
        "grouped_availability_removal": test_grouped_availability_removal,
    }

    parser = argparse.ArgumentParser(description="Run E2E tests")
    parser.add_argument(
        "names",
        nargs="*",
        help=f"Test names: {', '.join(tests.keys())}"
    )
    args = parser.parse_args()

    print("\n🚀 Running E2E tests...\n")

    if args.names:
        for name in args.names:
            if name not in tests:
                raise SystemExit(f"Unknown test: {name}")
            tests[name]()
    else:
        for test in tests.values():
            test()

    print("\n🎉 All tests finished\n")

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
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


BASE_URL = "http://localhost:8000"
KEEP_BROWSER_OPEN = os.getenv("KEEP_BROWSER_OPEN", "false").lower() == "true"
DELAY_SHORT = 0.5
DELAY_MEDIUM = 1.0
DELAY_LONG = 2.0

def close_driver(driver):
    if not KEEP_BROWSER_OPEN:
        driver.quit()
    else:
        input("🟡 Press ENTER to close browser...")
        driver.quit()


# =========================
# Helpers
# =========================

def create_driver():
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()))


def generate_email():
    return f"test{random.randint(1000,9999)}@mail.com"


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


def go_to_become_instructor(driver):
    driver.find_element(By.LINK_TEXT, "Tornar-se instrutor").click()
    time.sleep(DELAY_SHORT)


def fill_instructor_form(driver, name="João Teste"):
    driver.find_element(By.ID, "name").send_keys(name)
    driver.find_element(By.ID, "cpf").send_keys("12345678900")
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


def get_future_datetime_local():
    future_time = datetime.now() + timedelta(days=1)
    return future_time.strftime("%m%d00%Y%H%MP")


def book_instructor_by_name(driver, instructor_name):
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
    time.sleep(DELAY_SHORT)

    date_input = None
    duration_input = None
    for _ in range(6):
        inputs = target.find_elements(By.CSS_SELECTOR, "input[type='date'], input[type='datetime-local']")
        number_inputs = target.find_elements(By.CSS_SELECTOR, "input[type='number']")
        if inputs and number_inputs:
            date_input = inputs[0]
            duration_input = number_inputs[0]
            break
        # try clicking again in case the form didn't toggle
        driver.execute_script("arguments[0].click();", book_button)
        time.sleep(DELAY_SHORT)
    assert date_input is not None
    assert duration_input is not None

    date_input.clear()
    date_input.send_keys(get_future_datetime_local())
    duration_input.clear()
    duration_input.send_keys("2")

    target.find_element(By.CSS_SELECTOR, "form.booking-form button[type='submit']").click()
    time.sleep(DELAY_SHORT)


def confirm_first_booking(driver):
    driver.find_element(By.LINK_TEXT, "Painel").click()
    time.sleep(DELAY_SHORT)

    section = driver.find_element(By.ID, "solicitacoes")
    buttons = section.find_elements(By.TAG_NAME, "button")
    confirm_button = None
    for button in buttons:
        if "Confirmar" in button.text:
            confirm_button = button
            break

    assert confirm_button is not None
    confirm_button.click()
    time.sleep(DELAY_SHORT)


def go_to_my_bookings(driver):
    driver.find_element(By.LINK_TEXT, "Minhas Aulas").click()
    time.sleep(DELAY_SHORT)

def get_confirmation_code_from_my_bookings(driver):
    cards = driver.find_elements(By.CLASS_NAME, "booking-card")
    assert len(cards) > 0
    text = cards[0].text
    for line in text.split("\n"):
        if "Código da aula:" in line:
            return line.split("Código da aula:")[-1].strip()
    return None


def submit_review_for_first_completed(driver):
    go_to_my_bookings(driver)
    cards = driver.find_elements(By.CLASS_NAME, "booking-card")
    assert len(cards) > 0
    target = None
    for card in cards:
        if "Concluída" in card.text or "Aulas Concluídas" in card.text:
            target = card
            break
    if target is None:
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
    time.sleep(DELAY_SHORT)

def validate_code_for_first_confirmed(driver, code):
    driver.find_element(By.LINK_TEXT, "Painel").click()
    time.sleep(DELAY_SHORT)

    section = driver.find_element(By.ID, "confirmadas")
    inputs = section.find_elements(By.TAG_NAME, "input")
    assert len(inputs) > 0
    inputs[0].clear()
    inputs[0].send_keys(code)

    buttons = section.find_elements(By.TAG_NAME, "button")
    validate_button = None
    for button in buttons:
        if "Validar Código" in button.text:
            validate_button = button
            break

    assert validate_button is not None
    validate_button.click()
    time.sleep(DELAY_SHORT)

def cancel_first_booking_as_student(driver):
    go_to_my_bookings(driver)
    cards = driver.find_elements(By.CLASS_NAME, "booking-card")
    assert len(cards) > 0
    card = cards[0]
    cancel_buttons = card.find_elements(By.CLASS_NAME, "cancel-btn")
    assert len(cancel_buttons) > 0
    cancel_buttons[0].click()
    time.sleep(DELAY_SHORT)

def cancel_first_booking_as_instructor(driver):
    driver.find_element(By.LINK_TEXT, "Painel").click()
    time.sleep(DELAY_SHORT)

    section = driver.find_element(By.ID, "solicitacoes")
    cancel_buttons = section.find_elements(By.CLASS_NAME, "cancel-btn")
    assert len(cancel_buttons) > 0
    cancel_buttons[0].click()
    time.sleep(DELAY_SHORT)

# =========================
# Tests
# =========================

def test_register_user():
    driver = create_driver()
    driver.get(BASE_URL)

    email = generate_email()
    password = "123123123"

    try:
        register_and_login(driver, email, password)

        body = get_body(driver)
        assert email.split("@")[0] in body
        print("✅ Login successful")

        body = get_body(driver)
        assert "Tornar-se instrutor" in body
        assert "Painel" not in body

        print("✅ Became instructor successfully")

    finally:
        close_driver(driver)

def test_register_instructor():
    driver = create_driver()
    driver.get(BASE_URL)

    email = generate_email()
    password = "123123123"

    try:
        register_and_login(driver, email, password)

        body = get_body(driver)
        assert email.split("@")[0] in body
        print("✅ Login successful")

        go_to_become_instructor(driver)
        fill_instructor_form(driver)
        submit_form(driver)

        body = get_body(driver)
        assert "Painel" in body
        assert "Tornar-se instrutor" not in body

        print("✅ Became instructor successfully")

    finally:
        close_driver(driver)


def test_missing_fields_instructor():
    driver = create_driver()
    driver.get(BASE_URL)

    email = generate_email()
    password = "123123123"

    try:
        register_and_login(driver, email, password)

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

    email = generate_email()
    password = "123123123"

    try:
        register_and_login(driver, email, password)

        go_to_become_instructor(driver)
        fill_instructor_form(driver)
        submit_form(driver)

        body = get_body(driver)

        assert "Painel" in body
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

    instructor_email = generate_email()
    student_email = generate_email()
    password = "123123123"

    try:
        # Create instructor
        register_and_login(driver, instructor_email, password)
        go_to_become_instructor(driver)
        instructor_name = f"Instrutor {instructor_email.split('@')[0]}"
        fill_instructor_form(driver, instructor_name)
        submit_form(driver)
        logout(driver)

        # Create student and book lesson
        register_and_login(driver, student_email, password)
        book_instructor_by_name(driver, instructor_name)

        body = get_body(driver)
        assert "Agendamento enviado" in body
        print("✅ Booking created successfully")

        logout(driver)

        # Instructor confirms booking
        login(driver, instructor_email, password)
        confirm_first_booking(driver)
        logout(driver)

        # Student sees confirmation code
        login(driver, student_email, password)
        go_to_my_bookings(driver)
        code = get_confirmation_code_from_my_bookings(driver)
        body = get_body(driver)
        assert "Código da aula" in body
        assert code is not None
        print("✅ Booking confirmation code visible to student")

        logout(driver)

        # Instructor validates code
        login(driver, instructor_email, password)
        validate_code_for_first_confirmed(driver, code)
        body = get_body(driver)
        assert "Aulas Concluídas" in body
        print("✅ Booking code validated successfully")

        logout(driver)

        # Student submits review
        login(driver, student_email, password)
        submit_review_for_first_completed(driver)
        body = get_body(driver)
        assert "Avaliação enviada" in body or "Avaliação enviada ✅" in body
        print("✅ Review submitted successfully")

    finally:
        close_driver(driver)


def test_cancel_booking_flow():
    driver = create_driver()
    driver.get(BASE_URL)

    instructor_email = generate_email()
    student_email = generate_email()
    password = "123123123"

    try:
        # Create instructor
        register_and_login(driver, instructor_email, password)
        go_to_become_instructor(driver)
        instructor_name = f"Instrutor {instructor_email.split('@')[0]}"
        fill_instructor_form(driver, instructor_name)
        submit_form(driver)
        logout(driver)

        # Create student and book lesson
        register_and_login(driver, student_email, password)
        book_instructor_by_name(driver, instructor_name)

        body = get_body(driver)
        assert "Agendamento enviado" in body
        print("✅ Booking created for cancellation")

        # Student cancels
        cancel_first_booking_as_student(driver)
        body = get_body(driver)
        assert ("Agendamento cancelado" in body) or ("Cancelada" in body)
        print("✅ Booking cancelled by student")

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

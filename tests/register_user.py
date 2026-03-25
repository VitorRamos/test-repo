#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "selenium",
#   "webdriver-manager"
# ]
# ///

import time
import random
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


BASE_URL = "http://localhost:8000"
KEEP_BROWSER_OPEN = False

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
    time.sleep(1)

    driver.find_element(By.NAME, "email").send_keys(email)
    driver.find_element(By.NAME, "password").send_keys(password)
    driver.find_element(By.NAME, "confirmPassword").send_keys(password)

    driver.find_element(By.TAG_NAME, "form").submit()
    time.sleep(1)


def login(driver, email, password):
    driver.find_element(By.LINK_TEXT, "Entrar").click()
    time.sleep(1)

    driver.find_element(By.ID, "email").send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)

    driver.find_element(By.TAG_NAME, "form").submit()
    time.sleep(2)


def register_and_login(driver, email, password):
    register(driver, email, password)
    login(driver, email, password)


def go_to_become_instructor(driver):
    driver.find_element(By.LINK_TEXT, "Tornar-se instrutor").click()
    time.sleep(1)


def fill_instructor_form(driver):
    driver.find_element(By.ID, "name").send_keys("João Teste")
    driver.find_element(By.ID, "cpf").send_keys("12345678900")
    driver.find_element(By.ID, "detran_license").send_keys("ABC123456D")
    driver.find_element(By.ID, "price_per_hour").send_keys("100")
    driver.find_element(By.ID, "city").send_keys("Natal")
    driver.find_element(By.ID, "state").send_keys("RN")
    driver.find_element(By.ID, "bio").send_keys("Instrutor experiente")


def submit_form(driver):
    driver.find_element(By.TAG_NAME, "form").submit()
    time.sleep(2)


def get_body(driver):
    return driver.find_element(By.TAG_NAME, "body").text


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
        time.sleep(1)
        body = get_body(driver)

        assert "entrar" in body.lower()
        print("✅ Protected route works")

    finally:
        close_driver(driver)


# =========================
# Runner
# =========================

if __name__ == "__main__":
    print("\n🚀 Running E2E tests...\n")

    test_register_user()
    test_register_instructor()
    test_missing_fields_instructor()
    test_navbar_updates()
    test_protected_route()

    print("\n🎉 All tests finished\n")
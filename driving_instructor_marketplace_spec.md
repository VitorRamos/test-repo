# Driving Instructor Marketplace Platform (Practical Lessons Only)

## Overview

This platform is a **marketplace for practical driving lessons** where
independent driving instructors register and students can hire them
directly.

It focuses only on the **practical driving portion** of the learning
process.

The platform acts as an intermediary that: - connects students and
instructors - handles booking - holds payment in escrow - releases
payment after lesson confirmation

------------------------------------------------------------------------

# Core Platform Flow

1.  Instructor registers and creates a profile
2.  Instructor sets **price per hour**
3.  Student searches instructors
4.  Student books a lesson
5.  Student pays in advance
6.  Platform generates a **lesson confirmation code**
7.  Student gives the code to the instructor during the lesson
8.  Instructor confirms the code
9.  Payment is released to instructor

------------------------------------------------------------------------

# User Roles

## Student

-   Search instructors
-   View instructor profile
-   Book lessons
-   Pay for lessons
-   Receive confirmation code
-   Review instructors

## Instructor

-   Create profile
-   Upload DETRAN license
-   Set hourly price
-   Configure availability
-   Confirm lesson codes
-   Receive payments

## Admin

-   Manage platform
-   Review instructors
-   Handle disputes
-   Monitor payments

------------------------------------------------------------------------

# Core Entities

The system revolves around the following entities:

-   users
-   instructors
-   students
-   lessons
-   lesson_codes
-   payments
-   reviews
-   withdrawals

------------------------------------------------------------------------

# Database Structure

## users

Authentication table.

Fields:

-   id (uuid pk)
-   email
-   password_hash
-   role (student \| instructor \| admin)
-   created_at
-   active

------------------------------------------------------------------------

## instructors

Instructor marketplace profile.

Fields:

-   id (uuid pk)
-   user_id (fk users)
-   name
-   cpf
-   detran_license
-   license_expiration
-   price_per_hour
-   bio
-   rating
-   total_lessons
-   city
-   state
-   created_at
-   active

------------------------------------------------------------------------

## students

Fields:

-   id (uuid pk)
-   user_id (fk users)
-   name
-   cpf
-   birth_date
-   license_category
-   created_at

------------------------------------------------------------------------

## availability

Instructor availability schedule.

Fields:

-   id (uuid pk)
-   instructor_id
-   weekday
-   start_time
-   end_time

Example:

Monday\
08:00 - 12:00

------------------------------------------------------------------------

## lessons

Represents a booked lesson.

Fields:

-   id (uuid pk)
-   student_id
-   instructor_id
-   scheduled_start
-   scheduled_end
-   hour_price
-   total_price
-   status
-   created_at

Status values:

-   pending_payment
-   confirmed
-   completed
-   cancelled

------------------------------------------------------------------------

## lesson_codes

Lesson verification system.

Fields:

-   id (uuid pk)
-   lesson_id
-   code
-   generated_at
-   confirmed_at
-   confirmed_by_instructor

Example code:

AB12-CD34

Flow:

1.  Student books lesson
2.  Code generated
3.  Student gives code to instructor
4.  Instructor confirms
5.  Lesson marked completed
6.  Payment released

------------------------------------------------------------------------

## payments

Tracks payments and escrow.

Fields:

-   id (uuid pk)
-   lesson_id
-   student_id
-   instructor_id
-   amount
-   platform_fee
-   instructor_amount
-   status
-   created_at
-   released_at

Status values:

-   pending
-   escrow
-   released
-   refunded

------------------------------------------------------------------------

## reviews

Instructor reputation system.

Fields:

-   id (uuid pk)
-   lesson_id
-   student_id
-   instructor_id
-   rating
-   comment
-   created_at

------------------------------------------------------------------------

## withdrawals

Instructor withdrawals from platform balance.

Fields:

-   id (uuid pk)
-   instructor_id
-   amount
-   status
-   created_at
-   processed_at

Status values:

-   pending
-   paid
-   rejected

------------------------------------------------------------------------

# Payment Flow

Step 1: Student books lesson

lesson.status = pending_payment

Step 2: Student pays

payment.status = escrow\
lesson.status = confirmed

Step 3: Code generated

lesson_codes.code = random

Step 4: Instructor confirms code

lesson_codes.confirmed = true\
lesson.status = completed

Step 5: Payment released

payment.status = released

------------------------------------------------------------------------

# Platform Revenue

Example:

Lesson price = R\$100\
Platform fee = 20%

Student pays: 100\
Platform keeps: 20\
Instructor receives: 80

Store these values:

-   platform_fee
-   instructor_amount

------------------------------------------------------------------------

# Code Generation Example (Python)

``` python
import secrets
import string

def generate_code():
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(8))
```

Example output:

KD82LP91

------------------------------------------------------------------------

# Instructor Search Filters

Students should be able to filter instructors by:

-   city
-   price
-   rating
-   license_category

Indexes should be added to support these queries.

------------------------------------------------------------------------

# API Structure (FastAPI)

Recommended API routes:

/api/auth\
/api/instructors\
/api/students\
/api/lessons\
/api/payments\
/api/reviews\
/api/withdrawals

Examples:

POST /api/lessons/book\
POST /api/lessons/{id}/confirm-code\
GET /api/instructors/search

------------------------------------------------------------------------

# Recommended Tech Stack

Backend: - FastAPI

Frontend: - React - Vite

Database: - PostgreSQL

ORM: - SQLAlchemy

Migrations: - Alembic

Containerization: - Docker

------------------------------------------------------------------------

# Future Features

Possible platform improvements:

-   QR code lesson confirmation
-   Mobile support for instructors
-   In-app messaging
-   GPS lesson tracking
-   Automated scheduling
-   Push notifications
-   Fraud detection

------------------------------------------------------------------------

# Key Architecture Notes

1.  Keep business logic in the backend.
2.  Use escrow payments to prevent fraud.
3.  Maintain audit logs for all payment operations.
4.  Secure lesson confirmation with random codes or QR codes.

------------------------------------------------------------------------

# Summary

This platform functions as a **two-sided marketplace** for practical
driving lessons.

The key components are:

-   Instructor marketplace profiles
-   Lesson booking
-   Escrow payments
-   Confirmation codes
-   Payment release
-   Reviews and reputation

This architecture allows scalable growth while maintaining security and
regulatory compliance.

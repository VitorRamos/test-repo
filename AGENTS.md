# AI Instructions

This project is a full-stack marketplace for practical driving lessons.
Use this file as a quick map of the codebase and conventions.

## Project Structure

- `backend/`
- `backend/app/main.py` FastAPI app entry point and router registration
- `backend/app/api/routes/` API routes for auth, instructors, lessons
- `backend/app/api/deps.py` Auth dependencies and DB session
- `backend/app/models/` SQLAlchemy models (`user`, `student`, `instructor`, `lesson`, `payment`)
- `backend/app/schemas/` Pydantic schemas for request/response payloads
- `backend/app/db/` Database engine/session setup

- `frontend/`
- `frontend/src/App.tsx` React router and page wiring
- `frontend/src/pages/` Route pages (Home, Login, Register, Dashboard, BecomeInstructor, MyBookings)
- `frontend/src/components/` Shared UI components (Navigation, InstructorCard, ProtectedRoute)
- `frontend/src/services/api.ts` API client wrapper
- `frontend/src/context/AuthContext.tsx` Authentication state
- `frontend/src/types/` Shared TypeScript types

- `tests/` End-to-end test script (Selenium)
- `driving_instructor_marketplace_spec.md` Product and data model specification

## Current Booking Flow

- Student can request one or multiple lesson slots in one action
- Student booking request creates lessons with status `pending_instructor`
- Instructor confirms booking: lesson status `confirmed`
- Instructor validates the lesson code: lesson status `completed`
- Student can cancel pending or confirmed bookings from "Meus Agendamentos"
- Instructor can cancel pending or confirmed bookings from "Central do Instrutor"
- Student can view and filter bookings in the "Meus Agendamentos" page

## Current Availability Flow

- Instructor availability is configured by:
- `start_date` and `end_date`
- selected weekdays
- one or more time ranges
- Overlapping or adjacent availability for the same period and weekdays is merged on save
- Public student slots are generated from instructor availability and existing confirmed/completed bookings

## API Overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/instructors`
- `POST /api/instructors`
- `GET /api/instructors/my-lessons`
- `GET /api/instructors/stats`
- `GET /api/instructors/earnings`
- `GET /api/instructors/availability`
- `POST /api/instructors/availability`
- `DELETE /api/instructors/availability/{availability_id}`
- `GET /api/instructors/{instructor_id}/available-slots`
- `POST /api/lessons/book`
- `POST /api/lessons/book-batch`
- `POST /api/lessons/{lesson_id}/confirm`
- `POST /api/lessons/{lesson_id}/confirm-code`
- `POST /api/lessons/{lesson_id}/cancel`
- `GET /api/lessons/my-bookings`

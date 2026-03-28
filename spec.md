# Restaurant Billing System

## Current State
BanquetBilling.tsx has two tabs: "New Bill" and "Bill History". The new bill form captures clientName, clientPhone, clientEmail, guestCount, hall, menu, DJ/decor, extras, payment mode. The BanquetBill interface stores all these fields. There is no company name, company GST number, or banquet reservation management.

## Requested Changes (Diff)

### Add
- `companyName` and `companyGst` fields to the BanquetBill interface and new bill form (under clientName/phone/email)
- New "Banquet Reservations" page (separate route/sidebar entry) OR a new tab in BanquetBilling for managing reservations
- BanquetReservation interface with full guest details: reservationId, reservationDate, eventDate, customerName, companyName, companyGst, phone, email, guestCount, hall, eventName, eventType, advance, notes, status (Pending/Confirmed/Cancelled/Completed)
- Reservation history table with search/filter by date, status, guest name
- Edit/Cancel/Convert-to-Bill actions on each reservation

### Modify
- BanquetBilling new bill form: add Company Name and Company GST Number fields below clientEmail
- BanquetBill interface: add companyName and companyGst fields
- Bill History and print receipt: show companyName and companyGst when present
- App.tsx sidebar: add "Banquet Reservations" entry under BUSINESS section near Banquet Billing

### Remove
- Nothing removed

## Implementation Plan
1. Update BanquetBill interface to add companyName and companyGst
2. Add Company Name and GST fields to the new bill form in BanquetBilling.tsx
3. Update bill history table and print receipt to show these fields
4. Create BanquetReservations.tsx page with full CRUD: add/edit/cancel reservations, history table, status badges, date/name filter
5. Add sidebar entry and route for Banquet Reservations in App.tsx
6. All reservation data stored in localStorage per restaurantId key `${restaurantId}_banquet_reservations`

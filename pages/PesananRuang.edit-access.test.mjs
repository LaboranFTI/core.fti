import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync(new URL('./PesananRuang.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../components/BookingDetailModal.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const backendSource = readFileSync(new URL('../backend/routes/booking.routes.js', import.meta.url), 'utf8');

test('Admin, Laboran, and Supervisor can open the full booking edit form', () => {
  assert.match(pageSource, /interface ManageBookingsProps \{[\s\S]*role: Role;/);
  assert.match(
    pageSource,
    /const canEditBooking = \[Role\.ADMIN, Role\.LABORAN, Role\.SUPERVISOR\]\.includes\(role\);/,
  );
  assert.match(pageSource, /const \[editingBooking, setEditingBooking\]/);
  assert.match(pageSource, /const handleEditBooking = \(booking: BookingWithTech\) =>/);
  assert.match(pageSource, /proposalFile: \(booking as any\)\.hasFile \? booking\.id : undefined/);
  assert.match(pageSource, /canEditBooking=\{canEditBooking\}/);
  assert.match(pageSource, /handleEditBooking=\{handleEditBooking\}/);
  assert.match(pageSource, /initialData=\{editingBooking\}/);
  assert.match(pageSource, /editingBooking \? "Edit Pesanan Ruangan" : "Buat Pesanan Ruangan"/);
});

test('booking detail exposes the full edit action only when permitted', () => {
  assert.match(detailSource, /canEditBooking/);
  assert.match(detailSource, /handleEditBooking/);
  assert.match(detailSource, /\{canEditBooking && \(/);
  assert.match(detailSource, /Edit Pesanan/);
});

test('manager role reaches the page and remains authorized by the backend', () => {
  assert.match(appSource, /<PesananRuang\s+role=\{currentRole\}/);
  assert.match(
    backendSource,
    /const isManager = \['Admin', 'Laboran', 'Supervisor'\]\.includes\(loggedInUserRole\);/,
  );
});

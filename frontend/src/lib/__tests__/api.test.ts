import { ApiError, authHeaders, responseError } from '../api';

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status });

it('sends a bearer header only when there is a token', () => {
  expect(authHeaders('tok')).toEqual({ Authorization: 'Bearer tok' });
  expect(authHeaders(null)).toEqual({});
});

it('uses the server error message when the body carries one', async () => {
  const err = await responseError(json({ error: 'Song not found' }, 404), 'Export failed (404)');
  expect(err).toBeInstanceOf(ApiError);
  expect(err.message).toBe('Song not found');
  expect(err.status).toBe(404);
});

it('falls back when the body is not JSON or has no message', async () => {
  expect((await responseError(new Response('<html>', { status: 502 }), 'Server error (502)')).message).toBe('Server error (502)');
  expect((await responseError(json({}, 500), 'Server error (500)')).message).toBe('Server error (500)');
});

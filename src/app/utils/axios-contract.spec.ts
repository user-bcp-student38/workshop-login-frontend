import axios from 'axios';
import type { AxiosAdapter } from 'axios';
import { describe, expect, it } from 'vitest';

type AdapterConfig = Parameters<AxiosAdapter>[0];

function header(config: AdapterConfig, name: string): string | undefined {
  const entry = Object.entries(config.headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  const value: unknown = entry?.[1];
  return value === undefined || value === null || value === false ? undefined : String(value);
}

function responseAdapter(body: string, inspect: (config: AdapterConfig) => void, status = 200): AxiosAdapter {
  return async config => {
    inspect(config);
    return { data: body, status, statusText: 'Test response', headers: {}, config };
  };
}

describe('axios transport contract', () => {
  it('serializes the login body and preserves its headers and timeout', async () => {
    const credentials = { username: ' test-user ', password: ' test-password ', client: 'angular-workshop' };
    const body = { token: 'test-token', user: { username: 'test-user' } };
    const response = await axios.post('http://localhost:8080/auth/login', credentials, {
      timeout: 5000,
      adapter: responseAdapter(JSON.stringify(body), config => {
        expect(config.url).toBe('http://localhost:8080/auth/login');
        expect(config.method).toBe('post');
        expect(config.data).toBe(JSON.stringify(credentials));
        expect(header(config, 'Content-Type')).toBe('application/json');
        expect(header(config, 'Accept')).toBe('application/json, text/plain, */*');
        expect(header(config, 'Authorization')).toBeUndefined();
        expect(config.timeout).toBe(5000);
      })
    });
    expect(response.data).toEqual(body);
  });

  it('preserves task query, bearer header, empty body and default timeout', async () => {
    const tasks = [{ title: 'Test task', owner: 'test-user', status: 'TODO', priority: 'high' }];
    const response = await axios.get('http://localhost:8000/api/tasks?owner=test-user', {
      headers: { Authorization: 'Bearer test-token' },
      adapter: responseAdapter(JSON.stringify(tasks), config => {
        expect(config.url).toBe('http://localhost:8000/api/tasks?owner=test-user');
        expect(config.method).toBe('get');
        expect(config.data).toBeUndefined();
        expect(config.timeout).toBe(0);
        expect(header(config, 'Authorization')).toBe('Bearer test-token');
        expect(header(config, 'Accept')).toBe('application/json, text/plain, */*');
        expect(header(config, 'Content-Type')).toBeUndefined();
      })
    });
    expect(response.data).toEqual(tasks);
  });

  it.each([200, 201, 204, 299])('accepts HTTP %i by default', status => {
    expect(axios.defaults.validateStatus?.(status)).toBe(true);
  });

  it.each([400, 401, 403, 429, 500])('rejects HTTP %i by default', status => {
    expect(axios.defaults.validateStatus?.(status)).toBe(false);
  });

  it('preserves an empty 204 body', async () => {
    const response = await axios.get('http://localhost:8000/api/tasks?owner=test-user', {
      adapter: responseAdapter('', () => {}, 204)
    });
    expect(response.status).toBe(204);
    expect(response.data).toBe('');
  });
});

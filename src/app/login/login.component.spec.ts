import '@angular/compiler';
import { Injector } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const user = { username: 'test-user', displayName: 'Test User' };
  const sessionResponse = { data: { token: 'test-token', user } };
  let component: LoginComponent;
  let storage: Storage;
  let navigate: ReturnType<typeof vi.fn>;
  let post: MockInstance<typeof axios.post>;

  beforeEach(() => {
    const values = new Map<string, string>();
    storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => { values.delete(key); },
      setItem: (key, value) => { values.set(key, String(value)); }
    };
    vi.stubGlobal('localStorage', storage);
    navigate = vi.fn().mockResolvedValue(true);
    const injector = Injector.create({
      providers: [{ provide: Router, useValue: { navigate } }]
    });
    post = vi.spyOn(axios, 'post').mockResolvedValue(sessionResponse);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    component = new LoginComponent(injector.get(Router));
    component.username = 'test-user';
    component.password = 'test-password';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function expectNoSession(): void {
    expect(storage.getItem('workshop_token')).toBeNull();
    expect(storage.getItem('workshop_user')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
  }

  it('starts without a message and loads saved preferences', () => {
    expect(component.message).toBe('');
    expect(component.busy).toBe(false);
    storage.setItem('workshop_preferences', '{"theme":"dark"}');
    const injector = Injector.create({
      providers: [{ provide: Router, useValue: { navigate } }]
    });
    const restored = new LoginComponent(injector.get(Router));
    expect(restored.preferences).toEqual({ theme: 'dark', showTips: true, compact: false });
  });

  it('reports malformed saved preferences and retains defaults', () => {
    storage.setItem('workshop_preferences', '{invalid');
    const injector = Injector.create({
      providers: [{ provide: Router, useValue: { navigate } }]
    });
    const restored = new LoginComponent(injector.get(Router));
    expect(restored.preferences).toEqual({ theme: 'light', showTips: true, compact: false });
    expect(console.log).toHaveBeenCalledWith('Preferences could not be loaded', expect.any(SyntaxError));
  });

  it.each([null, undefined, '', '   '])('rejects empty username %s before HTTP', async (username) => {
    component.username = username;
    await component.login();
    expect(component.message).toBe('Ingrese un usuario.');
    expect(post).not.toHaveBeenCalled();
    expectNoSession();
  });

  it.each([null, undefined, '', '   '])('rejects empty password %s before HTTP', async (password) => {
    component.password = password;
    await component.login();
    expect(component.message).toBe('Ingrese una contraseña.');
    expect(post).not.toHaveBeenCalled();
    expectNoSession();
  });

  it('preserves the request and stores the session before navigation', async () => {
    component.username = ' test-user ';
    component.password = ' test-password ';
    navigate.mockImplementation(async () => {
      expect(storage.getItem('workshop_token')).toBe('test-token');
      expect(storage.getItem('workshop_user')).toBe(JSON.stringify(user));
      expect(storage.getItem('workshop_preferences')).toBe(JSON.stringify(component.preferences));
      return true;
    });
    await component.login();
    expect(post).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8080/auth/login',
      { username: ' test-user ', password: ' test-password ', client: 'angular-workshop' },
      { timeout: 5000 }
    );
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/dashboard']);
    expect(component.message).toBe('');
    expect(component.busy).toBe(false);
  });

  it('clears old messages and stays busy until the request resolves', async () => {
    let resolveRequest!: (value: typeof sessionResponse) => void;
    post.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));
    component.message = 'Previous error';
    const pending = component.login();
    expect(component.message).toBe('');
    expect(component.busy).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    resolveRequest(sessionResponse);
    await pending;
    expect(component.busy).toBe(false);
  });

  it.each([undefined, {}, { data: null }, { data: {} }, { data: { token: '' } }])(
    'does not create a session for a response without a token: %j',
    async (response) => {
      post.mockResolvedValueOnce(response);
      await component.login();
      expect(component.message).toBe('El backend respondió sin token.');
      expectNoSession();
    }
  );

  it.each([
    { error: { response: { data: { message: 'Backend detail' } }, message: 'Network detail' }, detail: 'Backend detail' },
    { error: new Error('Network detail'), detail: 'Network detail' },
    { error: {}, detail: 'Error desconocido' }
  ])('keeps external error details out of the UI: $detail', async ({ error }) => {
    post.mockRejectedValueOnce(error);
    await component.login();
    expect(component.message).toBe('No se pudo iniciar sesión. Verifica tus credenciales o inténtalo nuevamente.');
    expect(console.error).toHaveBeenCalledWith(error);
    expectNoSession();
  });

  it('does not include markup or special characters from external values', async () => {
    component.username = '<b>test</b> & "quoted"';
    const remoteDetail = '<em>Remote detail</em> & "quoted"';
    post.mockRejectedValueOnce({ response: { data: { message: remoteDetail } } });
    await component.login();
    expect(component.message).toBe('No se pudo iniciar sesión. Verifica tus credenciales o inténtalo nuevamente.');
    expect(component.message).not.toContain(component.username);
    expect(component.message).not.toContain(remoteDetail);
    expectNoSession();
  });

  it('allows a successful retry after a rejected request', async () => {
    post.mockRejectedValueOnce(new Error('Unavailable'));
    await component.login();
    expect(component.message).not.toBe('');
    await component.login();
    expect(component.message).toBe('');
    expect(component.busy).toBe(false);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/dashboard']);
    expect(storage.getItem('workshop_token')).toBe('test-token');
  });

  it.each([401, 403, 429, 500, 503])('handles HTTP %i without exposing the remote message', async (status) => {
    post.mockRejectedValueOnce({ response: { status, data: { message: 'Internal detail' } } });
    await component.login();
    expect(component.message).toBe('No se pudo iniciar sesión. Verifica tus credenciales o inténtalo nuevamente.');
    expect(post).toHaveBeenCalledTimes(1);
    expectNoSession();
  });

  it.each([
    { name: 'backend unavailable', code: 'ERR_NETWORK', message: 'Network Error' },
    { name: 'CORS or transport failure', code: 'ERR_NETWORK', message: 'Blocked request' },
    { name: '5000 ms timeout', code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' }
  ])('recovers from $name', async ({ code, message }) => {
    post.mockRejectedValueOnce(Object.assign(new Error(message), { code }));
    await component.login();
    expect(component.message).toBe('No se pudo iniciar sesión. Verifica tus credenciales o inténtalo nuevamente.');
    expect(post.mock.calls[0][2]).toEqual({ timeout: 5000 });
    expectNoSession();
  });

  it('handles a 204 response as missing token', async () => {
    post.mockResolvedValueOnce({ status: 204, data: '' });
    await component.login();
    expect(component.message).toBe('El backend respondió sin token.');
    expectNoSession();
  });

  it('keeps an existing session when a new login is rejected', async () => {
    storage.setItem('workshop_token', 'previous-test-token');
    storage.setItem('workshop_user', JSON.stringify(user));
    post.mockRejectedValueOnce(new Error('Unavailable'));
    await component.login();
    expect(storage.getItem('workshop_token')).toBe('previous-test-token');
    expect(storage.getItem('workshop_user')).toBe(JSON.stringify(user));
    expect(component.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a storage write exception without navigating', async () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'QuotaExceededError');
    });
    await component.login();
    expect(component.message).toBe('No se pudo iniciar sesión. Verifica tus credenciales o inténtalo nuevamente.');
    expectNoSession();
  });

  it('reports a navigation rejection and releases busy', async () => {
    navigate.mockRejectedValueOnce(new Error('Navigation failed'));
    await component.login();
    expect(component.message).toBe('No se pudo iniciar sesión. Verifica tus credenciales o inténtalo nuevamente.');
    expect(component.busy).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});

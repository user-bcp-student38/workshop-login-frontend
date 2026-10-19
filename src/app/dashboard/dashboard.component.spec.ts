import '@angular/compiler';
import { ChangeDetectorRef, Injector, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { LoginComponent } from '../login/login.component';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent and authentication flow', () => {
  let component: DashboardComponent;
  let storage: Storage;
  let injector: Injector;
  let navigate: ReturnType<typeof vi.fn>;
  let detectChanges: ReturnType<typeof vi.fn>;
  let runInZone: ReturnType<typeof vi.fn>;
  let get: MockInstance<typeof axios.get>;

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
    storage.setItem('workshop_token', 'test-token');
    storage.setItem('workshop_user', JSON.stringify({ username: 'test-user' }));
    storage.setItem('workshop_preferences', '{"theme":"dark"}');
    navigate = vi.fn().mockResolvedValue(true);
    detectChanges = vi.fn();
    runInZone = vi.fn((action: () => void) => action());
    injector = Injector.create({
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: ChangeDetectorRef, useValue: { detectChanges } },
        { provide: NgZone, useValue: { run: runInZone } }
      ]
    });
    component = new DashboardComponent(
      injector.get(Router), injector.get(ChangeDetectorRef), injector.get(NgZone)
    );
    get = vi.spyOn(axios, 'get').mockResolvedValue({ data: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function expectTaskError(message: string): void {
    expect(component.error).toBe(message);
    expect(component.loading).toBe(false);
    expect(component.visibleTasks).toEqual([]);
    expect(runInZone).toHaveBeenCalledTimes(1);
    expect(detectChanges).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
  }

  it('loads tasks after a valid login and logs out without HTTP revocation', async () => {
    storage.clear();
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      status: 200,
      data: { token: 'flow-test-token', user: { username: 'flow-user', displayName: 'Flow User' } }
    });
    const tasks = [
      { title: 'Visible task', description: 'Test fixture', status: 'TODO', priority: 'high', owner: 'flow-user' },
      { title: 'Archived task', status: 'ARCHIVED', priority: 'low', owner: 'flow-user' }
    ];
    get.mockResolvedValueOnce({ status: 200, data: tasks });
    const login = new LoginComponent(injector.get(Router));
    login.username = 'flow-user';
    login.password = 'test-password';
    await login.login();
    expect(navigate).toHaveBeenNthCalledWith(1, ['/dashboard']);
    await component.ngOnInit();
    expect(post).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8080/auth/login',
      { username: 'flow-user', password: 'test-password', client: 'angular-workshop' },
      { timeout: 5000 }
    );
    expect(get).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8000/api/tasks?owner=flow-user',
      { headers: { Authorization: 'Bearer flow-test-token' } }
    );
    expect(component.visibleTasks).toEqual([{ ...tasks[0], label: 'HIGH · FLOW-USER' }]);
    expect(component.tasks).toBe(tasks);
    expect(component.user.displayName).toBe('Flow User');
    expect(component.loading).toBe(false);
    expect(component.error).toBe('');
    expect(runInZone).toHaveBeenCalledTimes(1);
    expect(detectChanges).toHaveBeenCalledTimes(1);
    const preferences = storage.getItem('workshop_preferences');
    await component.logout();
    expect(storage.getItem('workshop_token')).toBeNull();
    expect(storage.getItem('workshop_user')).toBeNull();
    expect(storage.getItem('workshop_preferences')).toBe(preferences);
    expect(navigate).toHaveBeenNthCalledWith(2, ['/login']);
    expect(post).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('redirects to login without querying when the token is missing', async () => {
    storage.removeItem('workshop_token');
    await component.ngOnInit();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/login']);
    expect(get).not.toHaveBeenCalled();
  });

  it('uses an empty owner when the saved user is absent', async () => {
    storage.removeItem('workshop_user');
    await component.ngOnInit();
    expect(get).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8000/api/tasks?owner=',
      { headers: { Authorization: 'Bearer test-token' } }
    );
  });

  it.each([{ tasks: [] }, { tasks: [{ status: 'ARCHIVED' }] }])('completes an empty visible list: $tasks', async ({ tasks }) => {
    get.mockResolvedValueOnce({ data: tasks });
    await component.ngOnInit();
    expect(component.visibleTasks).toEqual([]);
    expect(component.loading).toBe(false);
    expect(component.error).toBe('');
  });

  it('orders priorities using the documented comparison and excludes only exact ARCHIVED', async () => {
    get.mockResolvedValueOnce({ data: [
      { title: 'A', status: 'TODO', priority: 'a' },
      { title: 'C', status: 'archived', priority: 'c' },
      { title: 'B', status: 'TODO', priority: 'b' },
      { title: 'Excluded', status: 'ARCHIVED', priority: 'z' }
    ] });
    await component.ngOnInit();
    expect(component.visibleTasks.map(task => task.title)).toEqual(['C', 'B', 'A']);
    expect(component.visibleTasks[0].label).toBe('C · SIN-ASIGNAR');
  });

  it('supports documented missing display fields and default labels', async () => {
    get.mockResolvedValueOnce({ data: [{}] });
    await component.ngOnInit();
    expect(component.visibleTasks).toEqual([{ label: 'NORMAL · SIN-ASIGNAR' }]);
    expect(component.statusLabel('')).toBe('');
  });

  it.each([
    ['TODO', 'Por hacer'], ['in_progress', 'En progreso'], ['DONE', 'Completado'],
    ['RESUELTO', 'Resuelto'], ['COMPLETED', 'Completado'], ['CUSTOM', 'CUSTOM']
  ])('translates status %s to %s', (status, label) => {
    expect(component.statusLabel(status)).toBe(label);
  });

  it.each([401, 403, 429, 500, 503])('handles HTTP %i without automatic logout or retry', async (status) => {
    get.mockRejectedValueOnce({ response: { status, data: { detail: 'Request rejected' } }, message: 'HTTP error' });
    await component.ngOnInit();
    expectTaskError('Request rejected');
    expect(storage.getItem('workshop_token')).toBe('test-token');
  });

  it('uses the newly saved token and surfaces an invalid-token 401 from tasks', async () => {
    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { token: 'expired-test-token', user: { username: 'test-user' } }
    });
    const login = new LoginComponent(injector.get(Router));
    login.username = 'test-user';
    login.password = 'test-password';
    await login.login();
    navigate.mockClear();
    get.mockRejectedValueOnce({ response: { status: 401, data: { detail: 'Token invalid or expired' } } });
    await component.ngOnInit();
    expectTaskError('Token invalid or expired');
    expect(get.mock.calls[0][1]).toEqual({ headers: { Authorization: 'Bearer expired-test-token' } });
  });

  it.each([
    { name: 'backend unavailable', code: 'ERR_NETWORK', message: 'Network Error' },
    { name: 'CORS or transport rejection', code: 'ERR_NETWORK', message: 'Blocked request' },
    { name: 'transport timeout', code: 'ECONNABORTED', message: 'Transport timed out' }
  ])('stops loading after $name', async ({ code, message }) => {
    get.mockRejectedValueOnce(Object.assign(new Error(message), { code }));
    await component.ngOnInit();
    expectTaskError(message);
  });

  it('uses the fallback when the rejection has no detail or message', async () => {
    get.mockRejectedValueOnce({});
    await component.ngOnInit();
    expectTaskError('No se pudo cargar el dashboard');
  });

  it('does not impose a 5000 ms timeout on a pending task request', async () => {
    vi.useFakeTimers();
    let resolveRequest!: (value: { data: never[] }) => void;
    get.mockReturnValueOnce(new Promise(resolve => { resolveRequest = resolve; }));
    const pending = component.ngOnInit();
    await vi.advanceTimersByTimeAsync(10000);
    expect(component.loading).toBe(true);
    expect(detectChanges).not.toHaveBeenCalled();
    expect(get.mock.calls[0][1]).not.toHaveProperty('timeout');
    resolveRequest({ data: [] });
    await pending;
    expect(component.loading).toBe(false);
  });

  it.each([null, [null]])('surfaces processing exceptions for invalid data %j', async (data) => {
    get.mockResolvedValueOnce({ data });
    await component.ngOnInit();
    expect(component.error).toEqual(expect.any(String));
    expect(component.error.length).toBeGreaterThan(0);
    expect(component.loading).toBe(false);
    expect(component.visibleTasks).toEqual([]);
    expect(detectChanges).toHaveBeenCalledTimes(1);
  });

  describe('BUG regressions — correct expectations, not accepted legacy behavior', () => {
    it('BUG: malformed saved JSON must not escape initialization', async () => {
      storage.setItem('workshop_user', '{invalid');
      await expect(component.ngOnInit()).resolves.toBeUndefined();
      expect(component.loading).toBe(false);
      expect(component.error).not.toBe('');
    });

    it('BUG: unavailable storage must produce a controlled error', async () => {
      vi.spyOn(storage, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
      await expect(component.ngOnInit()).resolves.toBeUndefined();
      expect(component.loading).toBe(false);
      expect(component.error).not.toBe('');
    });

    it.each(['', {}, { tasks: [] }])('BUG: unexpected non-array body %j must not look like an empty successful list', async (data) => {
      get.mockResolvedValueOnce({ status: data === '' ? 204 : 200, data });
      await component.ngOnInit();
      expect(component.error).toBeTruthy();
      expect(component.loading).toBe(false);
    });

    it('BUG: a null saved user must not leave an unsafe greeting model', async () => {
      storage.setItem('workshop_user', 'null');
      await component.ngOnInit();
      expect(component.user).not.toBeNull();
      expect(component.loading).toBe(false);
      expect(component.error).not.toBe('');
    });

    it('BUG: a non-string task status must be rejected before template rendering', async () => {
      get.mockResolvedValueOnce({ data: [{ status: 42 }] });
      await component.ngOnInit();
      expect(component.error).toBeTruthy();
      expect(component.visibleTasks).toEqual([]);
    });

    it('BUG: a login response with token but no user must not create a broken session', async () => {
      storage.clear();
      vi.spyOn(axios, 'post').mockResolvedValueOnce({ data: { token: 'test-token' } });
      const login = new LoginComponent(injector.get(Router));
      login.username = 'test-user';
      login.password = 'test-password';
      await login.login();
      expect(navigate).not.toHaveBeenCalled();
      expect(login.message).not.toBe('');
    });

    it('BUG: navigation returning false must be reported instead of looking successful', async () => {
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: { token: 'test-token', user: { username: 'test-user' } }
      });
      navigate.mockResolvedValueOnce(false);
      const login = new LoginComponent(injector.get(Router));
      login.username = 'test-user';
      login.password = 'test-password';
      await login.login();
      expect(login.message).not.toBe('');
    });
  });
});

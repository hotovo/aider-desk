import { Store, SettingsData } from './store'; // Actual imports for type info if needed
// Mock PostHog - Placed at the top
const mockCapture = jest.fn();
const mockShutdownAsync = jest.fn();
const mockPostHogInstance = {
  capture: mockCapture,
  shutdownAsync: mockShutdownAsync,
};
jest.mock('posthog-node', () => ({
  PostHog: jest.fn(() => mockPostHogInstance),
}));

// Mock Store - Placed at the top
const mockGetSettings = jest.fn();
const mockSaveSettings = jest.fn();
const mockStoreInstance = {
  getSettings: mockGetSettings,
  saveSettings: mockSaveSettings,
  init: jest.fn().mockResolvedValue(undefined),
  getWindowState: jest.fn().mockReturnValue({ width: 0, height: 0, x: 0, y: 0, isMaximized: false }),
  setWindowState: jest.fn(),
  getOpenProjects: jest.fn().mockReturnValue([]),
  getRecentProjects: jest.fn().mockReturnValue([]),
  addRecentProject: jest.fn(),
  removeRecentProject: jest.fn(),
  getProjectSettings: jest.fn().mockReturnValue({}),
  saveProjectSettings: jest.fn(),
  getReleaseNotes: jest.fn().mockReturnValue(null),
  clearReleaseNotes: jest.fn(),
  setReleaseNotes: jest.fn(),
};
jest.mock('./store', () => ({
  Store: jest.fn(() => mockStoreInstance),
  // Exporting SettingsData for type usage if necessary, but it's a type, not a runtime value.
}));

// Mock other dependencies - Placed at the top
jest.mock('electron', () => {
  const actualElectron = jest.requireActual('electron');
  return {
    ...actualElectron, // Preserve other parts of electron if not mocked
    app: {
      whenReady: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      getPath: jest.fn().mockReturnValue('/fake/path'),
      getName: jest.fn().mockReturnValue('AppName'),
      getVersion: jest.fn().mockReturnValue('1.0.0'),
      setAppUserModelId: jest.fn(),
      isPackaged: false,
      quit: jest.fn(),
      // Mock any other app properties or methods used in index.ts
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      webContents: {
        setWindowOpenHandler: jest.fn(),
        setZoomFactor: jest.fn(),
        session: {
          clearCache: jest.fn().mockResolvedValue(undefined),
        },
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn().mockResolvedValue(undefined),
      },
      getSize: jest.fn().mockReturnValue([0,0]),
      getPosition: jest.fn().mockReturnValue([0,0]),
      isMaximized: jest.fn().mockReturnValue(false),
      show: jest.fn(),
      close: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
      // Add other methods if they are called
    })),
    dialog: {
      showErrorBox: jest.fn(),
    },
    shell: {
      openExternal: jest.fn(),
    },
  };
});
jest.mock('@electron-toolkit/utils', () => ({
  optimizer: {
    watchWindowShortcuts: jest.fn(),
  },
  electronApp: {
    setAppUserModelId: jest.fn(),
  },
  is: {
    dev: true,
  }
}));
jest.mock('fix-path', () => jest.fn().mockReturnValue(() => {}));
jest.mock('electron-progressbar', () => jest.fn().mockImplementation(() => ({
  on: jest.fn((event, cb) => { if (event === 'ready') cb(); }),
  setCompleted: jest.fn(),
  close: jest.fn(),
  text: '',
  detail: '',
})));
jest.mock('./logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

// Import uuid for spying, actual v4 will be used by src/main/index.ts
const uuid = require('uuid');

// Main module and its exported posthog instance
let mainIndexModule: typeof import('./index');

// Helper function to simulate app ready and run the main logic
// This assumes that src/main/index.ts attaches its core logic to app.whenReady().then()
// We need to find the callback passed to whenReady().then() and invoke it.
async function triggerAppReady() {
  const { app } = require('electron');
  // Find the callback passed to app.whenReady().then(callback)
  // This requires app.whenReady().then() to have been called by importing main/index.ts
  const whenReadyCall = app.whenReady.mock;
  if (whenReadyCall.calls.length > 0) {
    // Assuming the actual .then() is attached by the module import
    // We can't directly get the .then() callback easily without modifying source or complex mock.
    // A workaround: src/main/index.ts could export its main async function.
    // For now, we rely on jest.resetModules() and re-import.
  }
  // As a fallback if we can't directly invoke the then callback,
  // the re-import after resetModules in beforeEach should trigger it.
}


describe('Main Index PostHog Integration', () => {
  let PostHogMockConstructor: jest.Mock;
  let originalV4: typeof uuid.v4;

  beforeEach(async () => {
    jest.resetModules(); // Reset modules to ensure fresh import and re-run of module-level code

    // Restore/setup default mock implementations
    mockGetSettings.mockReturnValue({
      posthog: { enabled: false, apiKey: undefined, host: undefined },
      distinctId: undefined,
    } as Partial<SettingsData>); // Cast to avoid type errors on partial mock
    mockSaveSettings.mockClear();
    mockCapture.mockClear();
    mockShutdownAsync.mockClear();

    // Dynamically import PostHog from the mocked module AFTER resetting modules
    PostHogMockConstructor = (require('posthog-node') as any).PostHog;
    PostHogMockConstructor.mockClear();

    // Spy on uuid.v4 before mainIndexModule is imported
    originalV4 = uuid.v4; // Store original

    mainIndexModule = await import('./index');
    await triggerAppReady(); // Attempt to ensure the whenReady logic runs
  });

  afterEach(() => {
    uuid.v4 = originalV4; // Restore original uuid.v4
  });

  it('should not initialize PostHog if disabled in settings', async () => {
    mockGetSettings.mockReturnValue({
      posthog: { enabled: false, apiKey: 'test-key' },
      distinctId: 'test-id',
    });
    // Re-import to apply new mocks for this specific test context if needed,
    // though beforeEach already does this.
    mainIndexModule = await import('./index');
    await triggerAppReady();

    expect(PostHogMockConstructor).not.toHaveBeenCalled();
    expect(mainIndexModule.posthog).toBeNull();
  });

  it('should not initialize PostHog if API key is missing', async () => {
    mockGetSettings.mockReturnValue({
      posthog: { enabled: true, apiKey: undefined },
      distinctId: 'test-id',
    });
    mainIndexModule = await import('./index');
    await triggerAppReady();

    expect(PostHogMockConstructor).not.toHaveBeenCalled();
    expect(mainIndexModule.posthog).toBeNull();
  });

  it('should initialize PostHog and capture startup event if enabled and API key is present', async () => {
    const testApiKey = 'test-api-key';
    const testHost = 'https://test.host.com';
    const testDistinctId = 'existing-distinct-id';

    mockGetSettings.mockReturnValue({
      posthog: { enabled: true, apiKey: testApiKey, host: testHost },
      distinctId: testDistinctId,
    });

    mainIndexModule = await import('./index'); // Re-import for this test's mock context
    await triggerAppReady(); // Ensure logic runs

    expect(PostHogMockConstructor).toHaveBeenCalledWith(testApiKey, { host: testHost });
    expect(mainIndexModule.posthog).toBe(mockPostHogInstance); // Check if the exported instance is our mock
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: testDistinctId,
      event: 'application_startup',
    });
  });

  it('should generate, save, and use distinctId if not present', async () => {
    const generatedId = 'generated-uuid-123';
    // Spy on uuid.v4 and mock its return value for this test
    uuid.v4 = jest.fn().mockReturnValue(generatedId);

    mockGetSettings.mockReturnValue({ // Initial call to getSettings
      posthog: { enabled: true, apiKey: 'test-key' },
      distinctId: undefined,
    });

    mainIndexModule = await import('./index');
    await triggerAppReady();

    expect(uuid.v4).toHaveBeenCalledTimes(1); // Ensure it was called to generate ID
    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    expect(mockSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: generatedId,
        posthog: { enabled: true, apiKey: 'test-key' }, // ensure other settings are preserved
      })
    );

    expect(PostHogMockConstructor).toHaveBeenCalledWith('test-key', expect.any(Object));
    expect(mainIndexModule.posthog).toBe(mockPostHogInstance);
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: generatedId,
      event: 'application_startup',
    });
  });

  it('should register a will-quit handler to shutdown PostHog if initialized', async () => {
    mockGetSettings.mockReturnValue({
      posthog: { enabled: true, apiKey: 'test-key', host: 'test-host' },
      distinctId: 'test-id',
    });

    mainIndexModule = await import('./index');
    await triggerAppReady();

    expect(mainIndexModule.posthog).not.toBeNull(); // PostHog should be initialized

    const { app } = require('electron');
    const willQuitCallback = app.on.mock.calls.find(call => call[0] === 'will-quit')?.[1];
    expect(willQuitCallback).toBeDefined();

    if (willQuitCallback) {
      await willQuitCallback(); // Call the shutdown handler
      expect(mockShutdownAsync).toHaveBeenCalledTimes(1);
    }
  });

   it('should not register a will-quit handler if PostHog is not initialized', async () => {
    mockGetSettings.mockReturnValue({
      posthog: { enabled: false, apiKey: 'test-key' }, // PostHog disabled
      distinctId: 'test-id',
    });

    mainIndexModule = await import('./index');
    await triggerAppReady();

    expect(mainIndexModule.posthog).toBeNull(); // PostHog should not be initialized

    const { app } = require('electron');
    const willQuitCallback = app.on.mock.calls.find(call => call[0] === 'will-quit')?.[1];

    // Check if the specific PostHog shutdown was added.
    // This is a bit indirect. If PostHog is null, the `app.on('will-quit', ...)` for PostHog
    // in `src/main/index.ts` should not have been set up.
    // We can't easily check "a specific callback wasn't registered" among others.
    // But if it was, calling it shouldn't call shutdownAsync.
    let foundPosthogWillQuit = false;
    app.on.mock.calls.forEach(call => {
        if (call[0] === 'will-quit') {
            // Try to identify if this is the PostHog specific shutdown
            // This is fragile. Better if the callback was named and exported for test.
            // For now, we assume if posthog is null, its specific handler isn't there.
            // The test for `shutdownAsync` not being called is more robust here.
        }
    });
    // Manually invoke all will-quit handlers if any were registered
    for (const call of app.on.mock.calls) {
        if (call[0] === 'will-quit' && typeof call[1] === 'function') {
            await call[1]();
        }
    }
    expect(mockShutdownAsync).not.toHaveBeenCalled();
  });
});

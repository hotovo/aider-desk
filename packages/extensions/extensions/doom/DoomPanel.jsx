(props) => {
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;

  var canvasRef = useRef(null);
  var containerRef = useRef(null);
  var imageDataRef = useRef(null);
  var moduleRef = useRef(null);
  var frameBufferPtrRef = useRef(0);
  var intervalRef = useRef(null);
  var doomWidthRef = useRef(640);
  var doomHeightRef = useRef(400);
  var dbPromiseRef = useRef(null);

  var stateRef = useState('loading');
  var status = stateRef[0];
  var setStatus = stateRef[1];

  var errRef = useState('');
  var errorMsg = errRef[0];
  var setErrorMsg = errRef[1];

  var focusRef = useState(false);
  var isFocused = focusRef[0];
  var setIsFocused = focusRef[1];

  var progressRef = useState('');
  var progress = progressRef[0];
  var setProgress = progressRef[1];

  var DoomKeys = {
    KEY_RIGHTARROW: 0xae,
    KEY_LEFTARROW: 0xac,
    KEY_UPARROW: 0xad,
    KEY_DOWNARROW: 0xaf,
    KEY_STRAFE_L: 0xa0,
    KEY_STRAFE_R: 0xa1,
    KEY_USE: 0xa2,
    KEY_FIRE: 0xa3,
    KEY_ESCAPE: 27,
    KEY_ENTER: 13,
    KEY_TAB: 9,
    KEY_BACKSPACE: 127,
    KEY_PAUSE: 0xff,
    KEY_EQUALS: 0x3d,
    KEY_MINUS: 0x2d,
    KEY_RSHIFT: 0xb6,
    KEY_RCTRL: 0x9d,
    KEY_RALT: 0xb8,
  };

  var CDN_BASE = 'https://cdn.jsdelivr.net/gh/badlogic/pi-doom@main';
  var DOOM_JS_URL = CDN_BASE + '/doom/build/doom.js';
  var DOOM_WASM_URL = CDN_BASE + '/doom/build/doom.wasm';
  var WAD_URL = CDN_BASE + '/doom1.wad';

  function openDB() {
    if (dbPromiseRef.current) return dbPromiseRef.current;
    dbPromiseRef.current = new Promise(function (resolve, reject) {
      try {
        var req = indexedDB.open('doom-extension-cache', 1);
        req.onupgradeneeded = function () {
          req.result.createObjectStore('assets');
        };
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          reject(req.error);
        };
      } catch (e) {
        reject(e);
      }
    });
    return dbPromiseRef.current;
  }

  function idbGet(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction('assets', 'readonly');
          var req = tx.objectStore('assets').get(key);
          req.onsuccess = function () {
            resolve(req.result);
          };
          req.onerror = function () {
            resolve(undefined);
          };
        } catch (e) {
          resolve(undefined);
        }
      });
    }).catch(function () {
      return undefined;
    });
  }

  function idbSet(key, value) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction('assets', 'readwrite');
          tx.objectStore('assets').put(value, key);
          tx.oncomplete = function () {
            resolve();
          };
          tx.onerror = function () {
            resolve();
          };
        } catch (e) {
          resolve();
        }
      });
    }).catch(function () {});
  }

  async function fetchAndCache(url, cacheKey, asText) {
    var cached = await idbGet(cacheKey);
    if (cached) return cached;

    var response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);

    var result = asText ? await response.text() : await response.arrayBuffer();

    await idbSet(cacheKey, result);

    return result;
  }

  async function loadDoom() {
    setProgress('Downloading DOOM engine...');
    var doomJsText = await fetchAndCache(DOOM_JS_URL, 'doom.js', true);

    setProgress('Downloading WASM binary...');
    var wasmBinary = await fetchAndCache(DOOM_WASM_URL, 'doom.wasm', false);

    setProgress('Downloading WAD file...');
    var wadBuffer = await fetchAndCache(WAD_URL, 'doom1.wad', false);

    setProgress('Initializing DOOM...');
    var wadArray = Array.from(new Uint8Array(wadBuffer));

    var moduleExports = { exports: {} };
    var safeRequire = function (name) {
      if (name === 'fs') {
        return {
          readFileSync: function () {
            return null;
          },
          existsSync: function () {
            return false;
          },
        };
      }
      if (name === 'path') {
        return {
          join: function () {
            return Array.prototype.slice.call(arguments).join('/');
          },
          dirname: function (p) {
            return p;
          },
          resolve: function (p) {
            return p;
          },
          normalize: function (p) {
            return p;
          },
        };
      }
      return {};
    };
    var fakeProcess = {
      env: {},
      argv: ['node', 'doom'],
      versions: { node: '20.0.0' },
      platform: 'linux',
      on: function () {},
      exit: function () {},
    };
    var fakeBuffer = {
      from: function (arr) {
        return new Uint8Array(arr);
      },
      alloc: function (size) {
        return new Uint8Array(size);
      },
      isBuffer: function () {
        return false;
      },
    };

    var moduleFunc = new Function(
      'module',
      'exports',
      '__dirname',
      '__filename',
      'require',
      'process',
      'Buffer',
      doomJsText
    );
    moduleFunc(
      moduleExports,
      moduleExports.exports,
      '/',
      '/doom.js',
      safeRequire,
      fakeProcess,
      fakeBuffer
    );

    var createDoomModule = moduleExports.exports;
    if (typeof createDoomModule !== 'function') {
      throw new Error('Failed to extract createDoomModule from doom.js');
    }

    var config = {
      wasmBinary: wasmBinary,
      print: function () {},
      printErr: function () {},
      preRun: [
        function (mod) {
          var FS = mod.FS || {};
          var createPath = mod.FS_createPath || FS.createPath;
          var createDataFile = mod.FS_createDataFile || FS.createDataFile;

          if (createPath) createPath('/', 'doom', true, true);
          if (createDataFile) createDataFile('/doom', 'doom1.wad', wadArray, true, false);
        },
      ],
    };

    var module = await createDoomModule(config);
    if (!module) throw new Error('Failed to initialize DOOM module');

    var args = ['doom', '-iwad', '/doom/doom1.wad'];
    var argPtrs = [];
    for (var i = 0; i < args.length; i++) {
      var ptr = module._malloc(args[i].length + 1);
      for (var j = 0; j < args[i].length; j++) {
        module.setValue(ptr + j, args[i].charCodeAt(j), 'i8');
      }
      module.setValue(ptr + args[i].length, 0, 'i8');
      argPtrs.push(ptr);
    }
    var argvPtr = module._malloc(argPtrs.length * 4);
    for (var k = 0; k < argPtrs.length; k++) {
      module.setValue(argvPtr + k * 4, argPtrs[k], 'i32');
    }
    module._doomgeneric_Create(args.length, argvPtr);
    for (var m = 0; m < argPtrs.length; m++) {
      module._free(argPtrs[m]);
    }
    module._free(argvPtr);

    var frameBufferPtr = module._DG_GetFrameBuffer();
    var width = module._DG_GetScreenWidth();
    var height = module._DG_GetScreenHeight();

    moduleRef.current = module;
    frameBufferPtrRef.current = frameBufferPtr;
    doomWidthRef.current = width;
    doomHeightRef.current = height;
  }

  function renderFrame() {
    var module = moduleRef.current;
    var canvas = canvasRef.current;
    if (!module || !canvas) return;

    var ctx = canvas.getContext('2d');
    var width = doomWidthRef.current;
    var height = doomHeightRef.current;
    var fbPtr = frameBufferPtrRef.current;

    if (
      !imageDataRef.current ||
      imageDataRef.current.width !== width ||
      imageDataRef.current.height !== height
    ) {
      imageDataRef.current = ctx.createImageData(width, height);
    }

    var data = imageDataRef.current.data;
    var heap = module.HEAPU8;
    var totalPixels = width * height;

    for (var i = 0; i < totalPixels; i++) {
      var srcIdx = fbPtr + i * 4;
      var dstIdx = i * 4;
      data[dstIdx] = heap[srcIdx + 2];
      data[dstIdx + 1] = heap[srcIdx + 1];
      data[dstIdx + 2] = heap[srcIdx];
      data[dstIdx + 3] = 255;
    }

    ctx.putImageData(imageDataRef.current, 0, 0);
  }

  function startGameLoop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(function () {
      try {
        moduleRef.current._doomgeneric_Tick();
        renderFrame();
      } catch (e) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 1000 / 35);
  }

  function mapCodeToDoom(code) {
    switch (code) {
      case 'KeyW':
        return [DoomKeys.KEY_UPARROW];
      case 'KeyA':
        return [DoomKeys.KEY_STRAFE_L];
      case 'KeyS':
        return [DoomKeys.KEY_DOWNARROW];
      case 'KeyD':
        return [DoomKeys.KEY_STRAFE_R];
      case 'KeyF':
        return [DoomKeys.KEY_FIRE];
      case 'KeyY':
        return [121];
      case 'KeyN':
        return [110];
      case 'Space':
        return [DoomKeys.KEY_USE];
      case 'Enter':
        return [DoomKeys.KEY_ENTER];
      case 'Escape':
        return [DoomKeys.KEY_ESCAPE];
      case 'Tab':
        return [DoomKeys.KEY_TAB];
      case 'Backspace':
        return [DoomKeys.KEY_BACKSPACE];
      case 'ShiftLeft':
      case 'ShiftRight':
        return [DoomKeys.KEY_RSHIFT];
      case 'ControlLeft':
      case 'ControlRight':
        return [DoomKeys.KEY_RCTRL];
      case 'ArrowUp':
        return [DoomKeys.KEY_UPARROW];
      case 'ArrowDown':
        return [DoomKeys.KEY_DOWNARROW];
      case 'ArrowLeft':
        return [DoomKeys.KEY_LEFTARROW];
      case 'ArrowRight':
        return [DoomKeys.KEY_RIGHTARROW];
      case 'Equal':
        return [DoomKeys.KEY_EQUALS];
      case 'Minus':
        return [DoomKeys.KEY_MINUS];
      case 'Digit1':
        return [0x31];
      case 'Digit2':
        return [0x32];
      case 'Digit3':
        return [0x33];
      case 'Digit4':
        return [0x34];
      case 'Digit5':
        return [0x35];
      case 'Digit6':
        return [0x36];
      case 'Digit7':
        return [0x37];
      default:
        if (code.length === 4 && code.startsWith('Key')) {
          return [code.charCodeAt(3) + 32];
        }
        return [];
    }
  }

  function releaseAllKeys() {
    if (!moduleRef.current) return;
    var keys = [
      DoomKeys.KEY_UPARROW,
      DoomKeys.KEY_DOWNARROW,
      DoomKeys.KEY_LEFTARROW,
      DoomKeys.KEY_RIGHTARROW,
      DoomKeys.KEY_STRAFE_L,
      DoomKeys.KEY_STRAFE_R,
      DoomKeys.KEY_USE,
      DoomKeys.KEY_FIRE,
      DoomKeys.KEY_RSHIFT,
      DoomKeys.KEY_RCTRL,
      DoomKeys.KEY_RALT,
      DoomKeys.KEY_ENTER,
      DoomKeys.KEY_ESCAPE,
      DoomKeys.KEY_TAB,
      DoomKeys.KEY_BACKSPACE,
    ];
    for (var i = 0; i < keys.length; i++) {
      moduleRef.current._DG_PushKeyEvent(0, keys[i]);
    }
  }

  function handleKeyDown(e) {
    if (!moduleRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    var doomKeys = mapCodeToDoom(e.code);
    for (var i = 0; i < doomKeys.length; i++) {
      moduleRef.current._DG_PushKeyEvent(1, doomKeys[i]);
    }
  }

  function handleKeyUp(e) {
    if (!moduleRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    var doomKeys = mapCodeToDoom(e.code);
    for (var i = 0; i < doomKeys.length; i++) {
      moduleRef.current._DG_PushKeyEvent(0, doomKeys[i]);
    }
  }

  function handleClick() {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }

  useEffect(function () {
    var cancelled = false;

    loadDoom()
      .then(function () {
        if (cancelled) return;
        setStatus('playing');
        setTimeout(function () {
          if (!cancelled) {
            renderFrame();
            startGameLoop();
          }
        }, 50);
      })
      .catch(function (err) {
        if (cancelled) return;
        setErrorMsg(String((err && err.message) || err));
        setStatus('error');
      });

    return function cleanup() {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center bg-black rounded-lg" style={{ height: '320px' }}>
        <div className="text-center">
          <div
            className="text-red-600 font-bold tracking-[0.3em] mb-3"
            style={{ fontSize: '28px', fontFamily: 'monospace' }}
          >
            DOOM
          </div>
          <div className="text-gray-500 text-xs animate-pulse">{progress || 'Loading...'}</div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center bg-black rounded-lg p-4" style={{ height: '320px' }}>
        <div className="text-red-600 font-bold mb-2 tracking-wider" style={{ fontSize: '18px', fontFamily: 'monospace' }}>
          R.I.P.
        </div>
        <div className="text-gray-400 text-xs text-center max-w-xs mb-3">{errorMsg}</div>
        <button
          onClick={function () {
            setStatus('loading');
            setErrorMsg('');
            setProgress('Retrying...');
            loadDoom()
              .then(function () {
                setStatus('playing');
                setTimeout(function () {
                  renderFrame();
                  startGameLoop();
                }, 50);
              })
              .catch(function (err) {
                setErrorMsg(String((err && err.message) || err));
                setStatus('error');
              });
          }}
          className="px-3 py-1 text-xs text-gray-300 border border-gray-700 rounded hover:bg-gray-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  var width = doomWidthRef.current;
  var height = doomHeightRef.current;

  return (
    <div className="flex flex-col bg-black rounded-lg overflow-hidden select-none">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onFocus={function () {
          setIsFocused(true);
        }}
        onBlur={function () {
          setIsFocused(false);
          releaseAllKeys();
        }}
        onClick={handleClick}
        className={
          'relative outline-none cursor-pointer transition-shadow ' +
          (isFocused ? 'ring-2 ring-red-600' : 'ring-1 ring-gray-800')
        }
        style={{ lineHeight: 0 }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block w-full"
          style={{ imageRendering: 'pixelated', aspectRatio: width + ' / ' + height }}
        />
        {!isFocused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="text-gray-300 text-sm tracking-wide">Click to play</span>
          </div>
        )}
      </div>
      <div className="px-2 py-1 bg-gray-950 text-gray-500 text-2xs flex flex-wrap gap-x-3 gap-y-0.5">
        <span>WASD/Arrows: Move</span>
        <span>Shift: Run</span>
        <span>Space: Use</span>
        <span>F: Fire</span>
        <span>1-7: Weapons</span>
        <span>Esc: Menu</span>
      </div>
    </div>
  );
}

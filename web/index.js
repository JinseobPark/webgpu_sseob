// include: shell.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != "undefined" ? Module : {};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).
// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window == "object";

var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";

// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process == "object" && process.versions?.node && process.type != "renderer";

var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
var arguments_ = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
  throw toThrow;
};

// In MODULARIZE mode _scriptName needs to be captured already at the very top of the page immediately when the page is parsed, so it is generated there
// before the page load. In non-MODULARIZE modes generate it here.
var _scriptName = typeof document != "undefined" ? document.currentScript?.src : undefined;

if (typeof __filename != "undefined") {
  // Node
  _scriptName = __filename;
} else if (ENVIRONMENT_IS_WORKER) {
  _scriptName = self.location.href;
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

if (ENVIRONMENT_IS_NODE) {
  const isNode = typeof process == "object" && process.versions?.node && process.type != "renderer";
  if (!isNode) throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
  var nodeVersion = process.versions.node;
  var numericVersion = nodeVersion.split(".").slice(0, 3);
  numericVersion = (numericVersion[0] * 1e4) + (numericVersion[1] * 100) + (numericVersion[2].split("-")[0] * 1);
  if (numericVersion < 16e4) {
    throw new Error("This emscripten-generated code requires node v16.0.0 (detected v" + nodeVersion + ")");
  }
  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require("fs");
  scriptDirectory = __dirname + "/";
  // include: node_shell_read.js
  readBinary = filename => {
    // We need to re-wrap `file://` strings to URLs.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename);
    assert(Buffer.isBuffer(ret));
    return ret;
  };
  readAsync = async (filename, binary = true) => {
    // See the comment in the `readBinary` function.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename, binary ? undefined : "utf8");
    assert(binary ? Buffer.isBuffer(ret) : typeof ret == "string");
    return ret;
  };
  // end include: node_shell_read.js
  if (process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, "/");
  }
  arguments_ = process.argv.slice(2);
  // MODULARIZE will export the module in the proper place outside, we don't need to export here
  if (typeof module != "undefined") {
    module["exports"] = Module;
  }
  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };
} else if (ENVIRONMENT_IS_SHELL) {
  const isNode = typeof process == "object" && process.versions?.node && process.type != "renderer";
  if (isNode || typeof window == "object" || typeof WorkerGlobalScope != "undefined") throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
} else // Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  try {
    scriptDirectory = new URL(".", _scriptName).href;
  } catch {}
  if (!(typeof window == "object" || typeof WorkerGlobalScope != "undefined")) throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
  {
    // include: web_or_worker_shell_read.js
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = url => {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response));
      };
    }
    readAsync = async url => {
      // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
      // See https://github.com/github/fetch/pull/92#issuecomment-140665932
      // Cordova or Electron apps are typically loaded from a file:// url.
      // So use XHR on webview if URL is a file URL.
      if (isFileURI(url)) {
        return new Promise((resolve, reject) => {
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = () => {
            if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
              // file URLs can return 0
              resolve(xhr.response);
              return;
            }
            reject(xhr.status);
          };
          xhr.onerror = reject;
          xhr.send(null);
        });
      }
      var response = await fetch(url, {
        credentials: "same-origin"
      });
      if (response.ok) {
        return response.arrayBuffer();
      }
      throw new Error(response.status + " : " + response.url);
    };
  }
} else {
  throw new Error("environment detection error");
}

var out = console.log.bind(console);

var err = console.error.bind(console);

var IDBFS = "IDBFS is no longer included by default; build with -lidbfs.js";

var PROXYFS = "PROXYFS is no longer included by default; build with -lproxyfs.js";

var WORKERFS = "WORKERFS is no longer included by default; build with -lworkerfs.js";

var FETCHFS = "FETCHFS is no longer included by default; build with -lfetchfs.js";

var ICASEFS = "ICASEFS is no longer included by default; build with -licasefs.js";

var JSFILEFS = "JSFILEFS is no longer included by default; build with -ljsfilefs.js";

var OPFS = "OPFS is no longer included by default; build with -lopfs.js";

var NODEFS = "NODEFS is no longer included by default; build with -lnodefs.js";

// perform assertions in shell.js after we set up out() and err(), as otherwise
// if an assertion fails it cannot print the message
assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add `shell` to `-sENVIRONMENT` to enable.");

// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===
// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html
var wasmBinary;

if (typeof WebAssembly != "object") {
  err("no native wasm support detected");
}

// Wasm globals
//========================================
// Runtime essentials
//========================================
// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */ function assert(condition, text) {
  if (!condition) {
    abort("Assertion failed" + (text ? ": " + text : ""));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.
function _free() {
  // Show a helpful error since we used to include free by default in the past.
  abort("free() called but not included in the build - add `_free` to EXPORTED_FUNCTIONS");
}

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */ var isFileURI = filename => filename.startsWith("file://");

// include: runtime_common.js
// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4;
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  SAFE_HEAP_STORE(HEAPU32, ((max) >> 2), 34821223);
  checkInt32(34821223);
  SAFE_HEAP_STORE(HEAPU32, (((max) + (4)) >> 2), 2310721022);
  checkInt32(2310721022);
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  // See writeStackCookie().
  if (max == 0) {
    max += 4;
  }
  var cookie1 = SAFE_HEAP_LOAD(HEAPU32, ((max) >> 2));
  var cookie2 = SAFE_HEAP_LOAD(HEAPU32, (((max) + (4)) >> 2));
  if (cookie1 != 34821223 || cookie2 != 2310721022) {
    abort(`Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`);
  }
}

// end include: runtime_stack_check.js
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
// include: runtime_debug.js
var runtimeDebug = true;

// Switch to false at runtime to disable logging at the right times
// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(...args) {
  if (!runtimeDebug && typeof runtimeDebug != "undefined") return;
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn(...args);
}

// Endianness check
(() => {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 25459;
  if (h8[0] !== 115 || h8[1] !== 99) throw "Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)";
})();

function consumedModuleProp(prop) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      set() {
        abort(`Attempt to set \`Module.${prop}\` after it has already been processed.  This can happen, for example, when code is injected via '--post-js' rather than '--pre-js'`);
      }
    });
  }
}

function makeInvalidEarlyAccess(name) {
  return () => assert(false, `call to '${name}' via reference taken before Wasm module initialization`);
}

function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(`\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`);
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
  return name === "FS_createPath" || name === "FS_createDataFile" || name === "FS_createPreloadedFile" || name === "FS_unlink" || name === "addRunDependency" || // The old FS has some functionality that WasmFS lacks.
  name === "FS_createLazyFile" || name === "FS_createDevice" || name === "removeRunDependency";
}

/**
 * Intercept access to a global symbol.  This enables us to give informative
 * warnings/errors when folks attempt to use symbols they did not include in
 * their build, or no symbols that no longer exist.
 */ function hookGlobalSymbolAccess(sym, func) {
  if (typeof globalThis != "undefined" && !Object.getOwnPropertyDescriptor(globalThis, sym)) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        func();
        return undefined;
      }
    });
  }
}

function missingGlobal(sym, msg) {
  hookGlobalSymbolAccess(sym, () => {
    warnOnce(`\`${sym}\` is not longer defined by emscripten. ${msg}`);
  });
}

missingGlobal("buffer", "Please use HEAP8.buffer or wasmMemory.buffer");

missingGlobal("asm", "Please use wasmExports instead");

function missingLibrarySymbol(sym) {
  hookGlobalSymbolAccess(sym, () => {
    // Can't `abort()` here because it would break code that does runtime
    // checks.  e.g. `if (typeof SDL === 'undefined')`.
    var msg = `\`${sym}\` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line`;
    // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
    // library.js, which means $name for a JS name with no prefix, or name
    // for a JS name like _name.
    var librarySymbol = sym;
    if (!librarySymbol.startsWith("_")) {
      librarySymbol = "$" + sym;
    }
    msg += ` (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='${librarySymbol}')`;
    if (isExportedByForceFilesystem(sym)) {
      msg += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you";
    }
    warnOnce(msg);
  });
  // Any symbol that is not included from the JS library is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`;
        if (isExportedByForceFilesystem(sym)) {
          msg += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you";
        }
        abort(msg);
      }
    });
  }
}

var MAX_UINT8 = (2 ** 8) - 1;

var MAX_UINT16 = (2 ** 16) - 1;

var MAX_UINT32 = (2 ** 32) - 1;

var MAX_UINT53 = (2 ** 53) - 1;

var MAX_UINT64 = (2 ** 64) - 1;

var MIN_INT8 = -(2 ** (8 - 1));

var MIN_INT16 = -(2 ** (16 - 1));

var MIN_INT32 = -(2 ** (32 - 1));

var MIN_INT53 = -(2 ** (53 - 1));

var MIN_INT64 = -(2 ** (64 - 1));

function checkInt(value, bits, min, max) {
  assert(Number.isInteger(Number(value)), `attempt to write non-integer (${value}) into integer heap`);
  assert(value <= max, `value (${value}) too large to write as ${bits}-bit value`);
  assert(value >= min, `value (${value}) too small to write as ${bits}-bit value`);
}

var checkInt1 = value => checkInt(value, 1, 1);

var checkInt8 = value => checkInt(value, 8, MIN_INT8, MAX_UINT8);

var checkInt16 = value => checkInt(value, 16, MIN_INT16, MAX_UINT16);

var checkInt32 = value => checkInt(value, 32, MIN_INT32, MAX_UINT32);

var checkInt53 = value => checkInt(value, 53, MIN_INT53, MAX_UINT53);

var checkInt64 = value => checkInt(value, 64, MIN_INT64, MAX_UINT64);

// end include: runtime_debug.js
// include: runtime_safe_heap.js
function SAFE_HEAP_INDEX(arr, idx, action) {
  const bytes = arr.BYTES_PER_ELEMENT;
  const dest = idx * bytes;
  if (idx <= 0) abort(`segmentation fault ${action} ${bytes} bytes at address ${dest}`);
  if (runtimeInitialized) {
    var brk = _sbrk(0);
    if (dest + bytes > brk) abort(`segmentation fault, exceeded the top of the available dynamic heap when ${action} ${bytes} bytes at address ${dest}. DYNAMICTOP=${brk}`);
    if (brk < _emscripten_stack_get_base()) abort(`brk >= _emscripten_stack_get_base() (brk=${brk}, _emscripten_stack_get_base()=${_emscripten_stack_get_base()})`);
    // sbrk-managed memory must be above the stack
    if (brk > wasmMemory.buffer.byteLength) abort(`brk <= wasmMemory.buffer.byteLength (brk=${brk}, wasmMemory.buffer.byteLength=${wasmMemory.buffer.byteLength})`);
  }
  return idx;
}

function SAFE_HEAP_LOAD(arr, idx) {
  return arr[SAFE_HEAP_INDEX(arr, idx, "loading")];
}

function SAFE_HEAP_STORE(arr, idx, value) {
  return arr[SAFE_HEAP_INDEX(arr, idx, "storing")] = value;
}

function segfault() {
  abort("segmentation fault");
}

function alignfault() {
  abort("alignment fault");
}

// end include: runtime_safe_heap.js
// Memory management
var wasmMemory;

var /** @type {!Int8Array} */ HEAP8, /** @type {!Uint8Array} */ HEAPU8, /** @type {!Int16Array} */ HEAP16, /** @type {!Uint16Array} */ HEAPU16, /** @type {!Int32Array} */ HEAP32, /** @type {!Uint32Array} */ HEAPU32, /** @type {!Float32Array} */ HEAPF32, /** @type {!Float64Array} */ HEAPF64;

// BigInt64Array type is not correctly defined in closure
var /** not-@type {!BigInt64Array} */ HEAP64, /* BigUint64Array type is not correctly defined in closure
/** not-@type {!BigUint64Array} */ HEAPU64;

var runtimeInitialized = false;

function updateMemoryViews() {
  var b = wasmMemory.buffer;
  HEAP8 = new Int8Array(b);
  HEAP16 = new Int16Array(b);
  HEAPU8 = new Uint8Array(b);
  HEAPU16 = new Uint16Array(b);
  HEAP32 = new Int32Array(b);
  HEAPU32 = new Uint32Array(b);
  HEAPF32 = new Float32Array(b);
  HEAPF64 = new Float64Array(b);
  HEAP64 = new BigInt64Array(b);
  HEAPU64 = new BigUint64Array(b);
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// end include: runtime_common.js
assert(typeof Int32Array != "undefined" && typeof Float64Array !== "undefined" && Int32Array.prototype.subarray != undefined && Int32Array.prototype.set != undefined, "JS engine does not provide full typed array support");

function preRun() {
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift());
    }
  }
  consumedModuleProp("preRun");
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns);
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;
  setStackLimits();
  checkStackCookie();
  // No ATINITS hooks
  wasmExports["__wasm_call_ctors"]();
}

function preMain() {
  checkStackCookie();
}

function postRun() {
  checkStackCookie();
  // PThreads reuse the runtime from the main thread.
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift());
    }
  }
  consumedModuleProp("postRun");
  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns);
}

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;

var dependenciesFulfilled = null;

// overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

var runDependencyWatcher = null;

function addRunDependency(id) {
  runDependencies++;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval != "undefined") {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(() => {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err("still waiting on run dependencies:");
          }
          err(`dependency: ${dep}`);
        }
        if (shown) {
          err("(end of list)");
        }
      }, 1e4);
    }
  } else {
    err("warning: run dependency added without ID");
  }
}

function removeRunDependency(id) {
  runDependencies--;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err("warning: run dependency removed without ID");
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
}

/** @param {string|number=} what */ function abort(what) {
  Module["onAbort"]?.(what);
  what = "Aborted(" + what + ")";
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);
  ABORT = true;
  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.
  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what);
  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// show errors on likely calls to FS when it was not included
var FS = {
  error() {
    abort("Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM");
  },
  init() {
    FS.error();
  },
  createDataFile() {
    FS.error();
  },
  createPreloadedFile() {
    FS.error();
  },
  createLazyFile() {
    FS.error();
  },
  open() {
    FS.error();
  },
  mkdev() {
    FS.error();
  },
  registerDevice() {
    FS.error();
  },
  analyzePath() {
    FS.error();
  },
  ErrnoError() {
    FS.error();
  }
};

function createExportWrapper(name, nargs) {
  return (...args) => {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    var f = wasmExports[name];
    assert(f, `exported native function \`${name}\` not found`);
    // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
    assert(args.length <= nargs, `native function \`${name}\` called with ${args.length} args but expects ${nargs}`);
    return f(...args);
  };
}

var wasmBinaryFile;

function findWasmBinary() {
  return locateFile("index.wasm");
}

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  throw "both async and sync fetching of the wasm failed";
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {}
  }
  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);
    // Warn on some common problems.
    if (isFileURI(wasmBinaryFile)) {
      err(`warning: Loading from a file URI (${wasmBinaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE) {
    try {
      var response = fetch(binaryFile, {
        credentials: "same-origin"
      });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err("falling back to ArrayBuffer instantiation");
    }
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // prepare imports
  return {
    "env": wasmImports,
    "wasi_snapshot_preview1": wasmImports
  };
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/ function receiveInstance(instance, module) {
    wasmExports = instance.exports;
    wasmMemory = wasmExports["memory"];
    assert(wasmMemory, "memory not found in wasm exports");
    updateMemoryViews();
    wasmTable = wasmExports["__indirect_function_table"];
    assert(wasmTable, "table not found in wasm exports");
    assignWasmExports(wasmExports);
    removeRunDependency("wasm-instantiate");
    return wasmExports;
  }
  // wait for the pthread pool (if any)
  addRunDependency("wasm-instantiate");
  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, "the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?");
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    return receiveInstance(result["instance"]);
  }
  var info = getWasmImports();
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module["instantiateWasm"]) {
    return new Promise((resolve, reject) => {
      try {
        Module["instantiateWasm"](info, (mod, inst) => {
          resolve(receiveInstance(mod, inst));
        });
      } catch (e) {
        err(`Module.instantiateWasm callback failed with error: ${e}`);
        reject(e);
      }
    });
  }
  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

// end include: preamble.js
// Begin JS library code
class ExitStatus {
  name="ExitStatus";
  constructor(status) {
    this.message = `Program terminated with exit(${status})`;
    this.status = status;
  }
}

var callRuntimeCallbacks = callbacks => {
  while (callbacks.length > 0) {
    // Pass the module as the first argument.
    callbacks.shift()(Module);
  }
};

var onPostRuns = [];

var addOnPostRun = cb => onPostRuns.push(cb);

var onPreRuns = [];

var addOnPreRun = cb => onPreRuns.push(cb);

/**
     * @param {number} ptr
     * @param {string} type
     */ function getValue(ptr, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    return SAFE_HEAP_LOAD(HEAP8, ptr);

   case "i8":
    return SAFE_HEAP_LOAD(HEAP8, ptr);

   case "i16":
    return SAFE_HEAP_LOAD(HEAP16, ((ptr) >> 1));

   case "i32":
    return SAFE_HEAP_LOAD(HEAP32, ((ptr) >> 2));

   case "i64":
    return SAFE_HEAP_LOAD(HEAP64, ((ptr) >> 3));

   case "float":
    return SAFE_HEAP_LOAD(HEAPF32, ((ptr) >> 2));

   case "double":
    return SAFE_HEAP_LOAD(HEAPF64, ((ptr) >> 3));

   case "*":
    return SAFE_HEAP_LOAD(HEAPU32, ((ptr) >> 2));

   default:
    abort(`invalid type for getValue: ${type}`);
  }
}

var noExitRuntime = true;

var ptrToString = ptr => {
  assert(typeof ptr === "number");
  // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
  ptr >>>= 0;
  return "0x" + ptr.toString(16).padStart(8, "0");
};

var setStackLimits = () => {
  var stackLow = _emscripten_stack_get_base();
  var stackHigh = _emscripten_stack_get_end();
  ___set_stack_limits(stackLow, stackHigh);
};

/**
     * @param {number} ptr
     * @param {number} value
     * @param {string} type
     */ function setValue(ptr, value, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    SAFE_HEAP_STORE(HEAP8, ptr, value);
    checkInt8(value);
    break;

   case "i8":
    SAFE_HEAP_STORE(HEAP8, ptr, value);
    checkInt8(value);
    break;

   case "i16":
    SAFE_HEAP_STORE(HEAP16, ((ptr) >> 1), value);
    checkInt16(value);
    break;

   case "i32":
    SAFE_HEAP_STORE(HEAP32, ((ptr) >> 2), value);
    checkInt32(value);
    break;

   case "i64":
    SAFE_HEAP_STORE(HEAP64, ((ptr) >> 3), BigInt(value));
    checkInt64(value);
    break;

   case "float":
    SAFE_HEAP_STORE(HEAPF32, ((ptr) >> 2), value);
    break;

   case "double":
    SAFE_HEAP_STORE(HEAPF64, ((ptr) >> 3), value);
    break;

   case "*":
    SAFE_HEAP_STORE(HEAPU32, ((ptr) >> 2), value);
    break;

   default:
    abort(`invalid type for setValue: ${type}`);
  }
}

var stackRestore = val => __emscripten_stack_restore(val);

var stackSave = () => _emscripten_stack_get_current();

var warnOnce = text => {
  warnOnce.shown ||= {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    if (ENVIRONMENT_IS_NODE) text = "warning: " + text;
    err(text);
  }
};

var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder : undefined;

var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
  var maxIdx = idx + maxBytesToRead;
  if (ignoreNul) return maxIdx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on
  // null terminator by itself.
  // As a tiny code save trick, compare idx against maxIdx using a negation,
  // so that maxBytesToRead=undefined/NaN means Infinity.
  while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
  return idx;
};

/**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number=} idx
     * @param {number=} maxBytesToRead
     * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
     * @return {string}
     */ var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
  }
  var str = "";
  while (idx < endPtr) {
    // For UTF8 byte structure, see:
    // http://en.wikipedia.org/wiki/UTF-8#Description
    // https://www.ietf.org/rfc/rfc2279.txt
    // https://tools.ietf.org/html/rfc3629
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      if ((u0 & 248) != 240) warnOnce("Invalid UTF-8 leading byte " + ptrToString(u0) + " encountered when deserializing a UTF-8 string in wasm memory to a JS string!");
      u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
};

/**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index.
     * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
     * @return {string}
     */ var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
  assert(typeof ptr == "number", `UTF8ToString expects a number (got ${typeof ptr})`);
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : "";
};

var ___assert_fail = (condition, filename, line, func) => abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [ filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function" ]);

var ___handle_stack_overflow = requested => {
  var base = _emscripten_stack_get_base();
  var end = _emscripten_stack_get_end();
  abort(`stack overflow (Attempt to set SP to ${ptrToString(requested)}` + `, with stack limits [${ptrToString(end)} - ${ptrToString(base)}` + "]). If you require more stack space build with -sSTACK_SIZE=<bytes>");
};

var __abort_js = () => abort("native code called abort()");

var wasmTableMirror = [];

/** @type {WebAssembly.Table} */ var wasmTable;

var getWasmTableEntry = funcPtr => {
  var func = wasmTableMirror[funcPtr];
  if (!func) {
    /** @suppress {checkTypes} */ wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
  }
  /** @suppress {checkTypes} */ assert(wasmTable.get(funcPtr) == func, "JavaScript-side Wasm function table mirror is out of date!");
  return func;
};

var _emscripten_request_animation_frame_loop = (cb, userData) => {
  function tick(timeStamp) {
    if (getWasmTableEntry(cb)(timeStamp, userData)) {
      requestAnimationFrame(tick);
    }
  }
  return requestAnimationFrame(tick);
};

var abortOnCannotGrowMemory = requestedSize => {
  abort(`Cannot enlarge memory arrays to size ${requestedSize} bytes (OOM). Either (1) compile with -sINITIAL_MEMORY=X with X higher than the current value ${HEAP8.length}, (2) compile with -sALLOW_MEMORY_GROWTH which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with -sABORTING_MALLOC=0`);
};

var _emscripten_resize_heap = requestedSize => {
  var oldSize = HEAPU8.length;
  // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
  requestedSize >>>= 0;
  abortOnCannotGrowMemory(requestedSize);
};

var SYSCALLS = {
  varargs: undefined,
  getStr(ptr) {
    var ret = UTF8ToString(ptr);
    return ret;
  }
};

var _fd_close = fd => {
  abort("fd_close called without SYSCALLS_REQUIRE_FILESYSTEM");
};

var INT53_MAX = 9007199254740992;

var INT53_MIN = -9007199254740992;

var bigintToI53Checked = num => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);

function _fd_seek(fd, offset, whence, newOffset) {
  offset = bigintToI53Checked(offset);
  return 70;
}

var printCharBuffers = [ null, [], [] ];

var printChar = (stream, curr) => {
  var buffer = printCharBuffers[stream];
  assert(buffer);
  if (curr === 0 || curr === 10) {
    (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
    buffer.length = 0;
  } else {
    buffer.push(curr);
  }
};

var flush_NO_FILESYSTEM = () => {
  // flush anything remaining in the buffers during shutdown
  _fflush(0);
  if (printCharBuffers[1].length) printChar(1, 10);
  if (printCharBuffers[2].length) printChar(2, 10);
};

var _fd_write = (fd, iov, iovcnt, pnum) => {
  // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
  var num = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = SAFE_HEAP_LOAD(HEAPU32, ((iov) >> 2));
    var len = SAFE_HEAP_LOAD(HEAPU32, (((iov) + (4)) >> 2));
    iov += 8;
    for (var j = 0; j < len; j++) {
      printChar(fd, SAFE_HEAP_LOAD(HEAPU8, ptr + j));
    }
    num += len;
  }
  SAFE_HEAP_STORE(HEAPU32, ((pnum) >> 2), num);
  checkInt32(num);
  return 0;
};

var handleException = e => {
  // Certain exception types we do not treat as errors since they are used for
  // internal control flow.
  // 1. ExitStatus, which is thrown by exit()
  // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
  //    that wish to return to JS event loop.
  if (e instanceof ExitStatus || e == "unwind") {
    return EXITSTATUS;
  }
  checkStackCookie();
  if (e instanceof WebAssembly.RuntimeError) {
    if (_emscripten_stack_get_current() <= 0) {
      err("Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 65536)");
    }
  }
  quit_(1, e);
};

var runtimeKeepaliveCounter = 0;

var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

var _proc_exit = code => {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    Module["onExit"]?.(code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
};

/** @suppress {duplicate } */ /** @param {boolean|number=} implicit */ var exitJS = (status, implicit) => {
  EXITSTATUS = status;
  checkUnflushedContent();
  // if exit() was called explicitly, warn the user if the runtime isn't actually being shut down
  if (keepRuntimeAlive() && !implicit) {
    var msg = `program exited (with status: ${status}), but keepRuntimeAlive() is set (counter=${runtimeKeepaliveCounter}) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)`;
    err(msg);
  }
  _proc_exit(status);
};

var _exit = exitJS;

var maybeExit = () => {
  if (!keepRuntimeAlive()) {
    try {
      _exit(EXITSTATUS);
    } catch (e) {
      handleException(e);
    }
  }
};

var callUserCallback = func => {
  if (ABORT) {
    err("user callback triggered after runtime exited or application aborted.  Ignoring.");
    return;
  }
  try {
    func();
    maybeExit();
  } catch (e) {
    handleException(e);
  }
};

var lengthBytesUTF8 = str => {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var c = str.charCodeAt(i);
    // possibly a lead surrogate
    if (c <= 127) {
      len++;
    } else if (c <= 2047) {
      len += 2;
    } else if (c >= 55296 && c <= 57343) {
      len += 4;
      ++i;
    } else {
      len += 3;
    }
  }
  return len;
};

var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
  assert(typeof str === "string", `stringToUTF8Array expects a string (got ${typeof str})`);
  // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
  // undefined and false each don't write out any bytes.
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
    // and https://www.ietf.org/rfc/rfc2279.txt
    // and https://tools.ietf.org/html/rfc3629
    var u = str.codePointAt(i);
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 192 | (u >> 6);
      heap[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 224 | (u >> 12);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u > 1114111) warnOnce("Invalid Unicode code point " + ptrToString(u) + " encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).");
      heap[outIdx++] = 240 | (u >> 18);
      heap[outIdx++] = 128 | ((u >> 12) & 63);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
      // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
      // We need to manually skip over the second code unit for correct iteration.
      i++;
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
};

var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
  assert(typeof maxBytesToWrite == "number", "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!");
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
};

var stackAlloc = sz => __emscripten_stack_alloc(sz);

var stringToUTF8OnStack = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8(str, ret, size);
  return ret;
};

var WebGPU = {
  errorCallback: (callback, type, message, userdata) => {
    var sp = stackSave();
    var messagePtr = stringToUTF8OnStack(message);
    getWasmTableEntry(callback)(type, messagePtr, userdata);
    stackRestore(sp);
  },
  initManagers: () => {
    assert(!WebGPU.mgrDevice, "initManagers already called");
    /** @constructor */ function Manager() {
      this.objects = {};
      this.nextId = 1;
      this.create = function(object, wrapper = {}) {
        var id = this.nextId++;
        assert(typeof this.objects[id] == "undefined");
        wrapper.refcount = 1;
        wrapper.object = object;
        this.objects[id] = wrapper;
        return id;
      };
      this.get = function(id) {
        if (!id) return undefined;
        var o = this.objects[id];
        assert(typeof o != "undefined");
        return o.object;
      };
      this.reference = function(id) {
        var o = this.objects[id];
        assert(typeof o != "undefined");
        o.refcount++;
      };
      this.release = function(id) {
        var o = this.objects[id];
        assert(typeof o != "undefined");
        assert(o.refcount > 0);
        o.refcount--;
        if (o.refcount <= 0) {
          delete this.objects[id];
        }
      };
    }
    WebGPU.mgrSurface = new Manager;
    WebGPU.mgrSwapChain = new Manager;
    WebGPU.mgrAdapter = new Manager;
    // TODO: Release() the device's default queue when the device is freed.
    WebGPU.mgrDevice = new Manager;
    WebGPU.mgrQueue = new Manager;
    WebGPU.mgrCommandBuffer = new Manager;
    WebGPU.mgrCommandEncoder = new Manager;
    WebGPU.mgrRenderPassEncoder = new Manager;
    WebGPU.mgrComputePassEncoder = new Manager;
    WebGPU.mgrBindGroup = new Manager;
    WebGPU.mgrBuffer = new Manager;
    WebGPU.mgrSampler = new Manager;
    WebGPU.mgrTexture = new Manager;
    WebGPU.mgrTextureView = new Manager;
    WebGPU.mgrQuerySet = new Manager;
    WebGPU.mgrBindGroupLayout = new Manager;
    WebGPU.mgrPipelineLayout = new Manager;
    WebGPU.mgrRenderPipeline = new Manager;
    WebGPU.mgrComputePipeline = new Manager;
    WebGPU.mgrShaderModule = new Manager;
    WebGPU.mgrRenderBundleEncoder = new Manager;
    WebGPU.mgrRenderBundle = new Manager;
  },
  makeColor: ptr => ({
    "r": SAFE_HEAP_LOAD(HEAPF64, ((ptr) >> 3)),
    "g": SAFE_HEAP_LOAD(HEAPF64, (((ptr) + (8)) >> 3)),
    "b": SAFE_HEAP_LOAD(HEAPF64, (((ptr) + (16)) >> 3)),
    "a": SAFE_HEAP_LOAD(HEAPF64, (((ptr) + (24)) >> 3))
  }),
  makeExtent3D: ptr => ({
    "width": SAFE_HEAP_LOAD(HEAPU32, ((ptr) >> 2)),
    "height": SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (4)) >> 2)),
    "depthOrArrayLayers": SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (8)) >> 2))
  }),
  makeOrigin3D: ptr => ({
    "x": SAFE_HEAP_LOAD(HEAPU32, ((ptr) >> 2)),
    "y": SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (4)) >> 2)),
    "z": SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (8)) >> 2))
  }),
  makeImageCopyTexture: ptr => {
    assert(ptr);
    assert(SAFE_HEAP_LOAD(HEAPU32, ((ptr) >> 2)) === 0);
    return {
      "texture": WebGPU.mgrTexture.get(SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (4)) >> 2))),
      "mipLevel": SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (8)) >> 2)),
      "origin": WebGPU.makeOrigin3D(ptr + 12),
      "aspect": WebGPU.TextureAspect[SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (24)) >> 2))]
    };
  },
  makeTextureDataLayout: ptr => {
    assert(ptr);
    assert(SAFE_HEAP_LOAD(HEAPU32, ((ptr) >> 2)) === 0);
    var bytesPerRow = SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (16)) >> 2));
    var rowsPerImage = SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (20)) >> 2));
    return {
      "offset": SAFE_HEAP_LOAD(HEAPU32, ((((ptr + 4)) + (8)) >> 2)) * 4294967296 + SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (8)) >> 2)),
      "bytesPerRow": bytesPerRow === 4294967295 ? undefined : bytesPerRow,
      "rowsPerImage": rowsPerImage === 4294967295 ? undefined : rowsPerImage
    };
  },
  makeImageCopyBuffer: ptr => {
    assert(ptr);
    assert(SAFE_HEAP_LOAD(HEAPU32, ((ptr) >> 2)) === 0);
    var layoutPtr = ptr + 8;
    var bufferCopyView = WebGPU.makeTextureDataLayout(layoutPtr);
    bufferCopyView["buffer"] = WebGPU.mgrBuffer.get(SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (32)) >> 2)));
    return bufferCopyView;
  },
  makePipelineConstants: (constantCount, constantsPtr) => {
    if (!constantCount) return;
    var constants = {};
    for (var i = 0; i < constantCount; ++i) {
      var entryPtr = constantsPtr + 16 * i;
      var key = UTF8ToString(SAFE_HEAP_LOAD(HEAPU32, (((entryPtr) + (4)) >> 2)));
      constants[key] = SAFE_HEAP_LOAD(HEAPF64, (((entryPtr) + (8)) >> 3));
    }
    return constants;
  },
  makePipelineLayout: layoutPtr => {
    if (!layoutPtr) return "auto";
    return WebGPU.mgrPipelineLayout.get(layoutPtr);
  },
  makeProgrammableStageDescriptor: ptr => {
    if (!ptr) return undefined;
    assert(ptr);
    assert(SAFE_HEAP_LOAD(HEAPU32, ((ptr) >> 2)) === 0);
    var desc = {
      "module": WebGPU.mgrShaderModule.get(SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (4)) >> 2))),
      "constants": WebGPU.makePipelineConstants(SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (12)) >> 2)), SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (16)) >> 2)))
    };
    var entryPointPtr = SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (8)) >> 2));
    if (entryPointPtr) desc["entryPoint"] = UTF8ToString(entryPointPtr);
    return desc;
  },
  fillLimitStruct: (limits, supportedLimitsOutPtr) => {
    var limitsOutPtr = supportedLimitsOutPtr + 8;
    function setLimitValueU32(name, limitOffset) {
      var limitValue = limits[name];
      SAFE_HEAP_STORE(HEAP32, (((limitsOutPtr) + (limitOffset)) >> 2), limitValue);
      checkInt32(limitValue);
    }
    function setLimitValueU64(name, limitOffset) {
      var limitValue = limits[name];
      SAFE_HEAP_STORE(HEAP64, (((limitsOutPtr) + (limitOffset)) >> 3), BigInt(limitValue));
      checkInt64(limitValue);
    }
    setLimitValueU32("maxTextureDimension1D", 0);
    setLimitValueU32("maxTextureDimension2D", 4);
    setLimitValueU32("maxTextureDimension3D", 8);
    setLimitValueU32("maxTextureArrayLayers", 12);
    setLimitValueU32("maxBindGroups", 16);
    setLimitValueU32("maxBindGroupsPlusVertexBuffers", 20);
    setLimitValueU32("maxBindingsPerBindGroup", 24);
    setLimitValueU32("maxDynamicUniformBuffersPerPipelineLayout", 28);
    setLimitValueU32("maxDynamicStorageBuffersPerPipelineLayout", 32);
    setLimitValueU32("maxSampledTexturesPerShaderStage", 36);
    setLimitValueU32("maxSamplersPerShaderStage", 40);
    setLimitValueU32("maxStorageBuffersPerShaderStage", 44);
    setLimitValueU32("maxStorageTexturesPerShaderStage", 48);
    setLimitValueU32("maxUniformBuffersPerShaderStage", 52);
    setLimitValueU32("minUniformBufferOffsetAlignment", 72);
    setLimitValueU32("minStorageBufferOffsetAlignment", 76);
    setLimitValueU64("maxUniformBufferBindingSize", 56);
    setLimitValueU64("maxStorageBufferBindingSize", 64);
    setLimitValueU32("maxVertexBuffers", 80);
    setLimitValueU64("maxBufferSize", 88);
    setLimitValueU32("maxVertexAttributes", 96);
    setLimitValueU32("maxVertexBufferArrayStride", 100);
    setLimitValueU32("maxInterStageShaderComponents", 104);
    setLimitValueU32("maxInterStageShaderVariables", 108);
    setLimitValueU32("maxColorAttachments", 112);
    setLimitValueU32("maxColorAttachmentBytesPerSample", 116);
    setLimitValueU32("maxComputeWorkgroupStorageSize", 120);
    setLimitValueU32("maxComputeInvocationsPerWorkgroup", 124);
    setLimitValueU32("maxComputeWorkgroupSizeX", 128);
    setLimitValueU32("maxComputeWorkgroupSizeY", 132);
    setLimitValueU32("maxComputeWorkgroupSizeZ", 136);
    setLimitValueU32("maxComputeWorkgroupsPerDimension", 140);
  },
  Int_BufferMapState: {
    unmapped: 1,
    pending: 2,
    mapped: 3
  },
  Int_CompilationMessageType: {
    error: 1,
    warning: 2,
    info: 3
  },
  Int_DeviceLostReason: {
    undefined: 1,
    unknown: 1,
    destroyed: 2
  },
  Int_PreferredFormat: {
    rgba8unorm: 18,
    bgra8unorm: 23
  },
  WGSLFeatureName: [ , "readonly_and_readwrite_storage_textures", "packed_4x8_integer_dot_product", "unrestricted_pointer_parameters", "pointer_composite_access" ],
  AddressMode: [ , "clamp-to-edge", "repeat", "mirror-repeat" ],
  AlphaMode: [ , "opaque", "premultiplied" ],
  BlendFactor: [ , "zero", "one", "src", "one-minus-src", "src-alpha", "one-minus-src-alpha", "dst", "one-minus-dst", "dst-alpha", "one-minus-dst-alpha", "src-alpha-saturated", "constant", "one-minus-constant" ],
  BlendOperation: [ , "add", "subtract", "reverse-subtract", "min", "max" ],
  BufferBindingType: [ , "uniform", "storage", "read-only-storage" ],
  BufferMapState: {
    1: "unmapped",
    2: "pending",
    3: "mapped"
  },
  CompareFunction: [ , "never", "less", "equal", "less-equal", "greater", "not-equal", "greater-equal", "always" ],
  CompilationInfoRequestStatus: [ "success", "error", "device-lost", "unknown" ],
  CullMode: [ , "none", "front", "back" ],
  ErrorFilter: {
    1: "validation",
    2: "out-of-memory",
    3: "internal"
  },
  FeatureName: [ , "depth-clip-control", "depth32float-stencil8", "timestamp-query", "texture-compression-bc", "texture-compression-etc2", "texture-compression-astc", "indirect-first-instance", "shader-f16", "rg11b10ufloat-renderable", "bgra8unorm-storage", "float32-filterable" ],
  FilterMode: [ , "nearest", "linear" ],
  FrontFace: [ , "ccw", "cw" ],
  IndexFormat: [ , "uint16", "uint32" ],
  LoadOp: [ , "clear", "load" ],
  MipmapFilterMode: [ , "nearest", "linear" ],
  PowerPreference: [ , "low-power", "high-performance" ],
  PrimitiveTopology: [ , "point-list", "line-list", "line-strip", "triangle-list", "triangle-strip" ],
  QueryType: {
    1: "occlusion",
    2: "timestamp"
  },
  SamplerBindingType: [ , "filtering", "non-filtering", "comparison" ],
  StencilOperation: [ , "keep", "zero", "replace", "invert", "increment-clamp", "decrement-clamp", "increment-wrap", "decrement-wrap" ],
  StorageTextureAccess: [ , "write-only", "read-only", "read-write" ],
  StoreOp: [ , "store", "discard" ],
  TextureAspect: [ , "all", "stencil-only", "depth-only" ],
  TextureDimension: [ , "1d", "2d", "3d" ],
  TextureFormat: [ , "r8unorm", "r8snorm", "r8uint", "r8sint", "r16uint", "r16sint", "r16float", "rg8unorm", "rg8snorm", "rg8uint", "rg8sint", "r32float", "r32uint", "r32sint", "rg16uint", "rg16sint", "rg16float", "rgba8unorm", "rgba8unorm-srgb", "rgba8snorm", "rgba8uint", "rgba8sint", "bgra8unorm", "bgra8unorm-srgb", "rgb10a2uint", "rgb10a2unorm", "rg11b10ufloat", "rgb9e5ufloat", "rg32float", "rg32uint", "rg32sint", "rgba16uint", "rgba16sint", "rgba16float", "rgba32float", "rgba32uint", "rgba32sint", "stencil8", "depth16unorm", "depth24plus", "depth24plus-stencil8", "depth32float", "depth32float-stencil8", "bc1-rgba-unorm", "bc1-rgba-unorm-srgb", "bc2-rgba-unorm", "bc2-rgba-unorm-srgb", "bc3-rgba-unorm", "bc3-rgba-unorm-srgb", "bc4-r-unorm", "bc4-r-snorm", "bc5-rg-unorm", "bc5-rg-snorm", "bc6h-rgb-ufloat", "bc6h-rgb-float", "bc7-rgba-unorm", "bc7-rgba-unorm-srgb", "etc2-rgb8unorm", "etc2-rgb8unorm-srgb", "etc2-rgb8a1unorm", "etc2-rgb8a1unorm-srgb", "etc2-rgba8unorm", "etc2-rgba8unorm-srgb", "eac-r11unorm", "eac-r11snorm", "eac-rg11unorm", "eac-rg11snorm", "astc-4x4-unorm", "astc-4x4-unorm-srgb", "astc-5x4-unorm", "astc-5x4-unorm-srgb", "astc-5x5-unorm", "astc-5x5-unorm-srgb", "astc-6x5-unorm", "astc-6x5-unorm-srgb", "astc-6x6-unorm", "astc-6x6-unorm-srgb", "astc-8x5-unorm", "astc-8x5-unorm-srgb", "astc-8x6-unorm", "astc-8x6-unorm-srgb", "astc-8x8-unorm", "astc-8x8-unorm-srgb", "astc-10x5-unorm", "astc-10x5-unorm-srgb", "astc-10x6-unorm", "astc-10x6-unorm-srgb", "astc-10x8-unorm", "astc-10x8-unorm-srgb", "astc-10x10-unorm", "astc-10x10-unorm-srgb", "astc-12x10-unorm", "astc-12x10-unorm-srgb", "astc-12x12-unorm", "astc-12x12-unorm-srgb" ],
  TextureSampleType: [ , "float", "unfilterable-float", "depth", "sint", "uint" ],
  TextureViewDimension: [ , "1d", "2d", "2d-array", "cube", "cube-array", "3d" ],
  VertexFormat: [ , "uint8x2", "uint8x4", "sint8x2", "sint8x4", "unorm8x2", "unorm8x4", "snorm8x2", "snorm8x4", "uint16x2", "uint16x4", "sint16x2", "sint16x4", "unorm16x2", "unorm16x4", "snorm16x2", "snorm16x4", "float16x2", "float16x4", "float32", "float32x2", "float32x3", "float32x4", "uint32", "uint32x2", "uint32x3", "uint32x4", "sint32", "sint32x2", "sint32x3", "sint32x4", "unorm10-10-10-2" ],
  VertexStepMode: [ , "vertex-buffer-not-used", "vertex", "instance" ],
  FeatureNameString2Enum: {
    undefined: "0",
    "depth-clip-control": "1",
    "depth32float-stencil8": "2",
    "timestamp-query": "3",
    "texture-compression-bc": "4",
    "texture-compression-etc2": "5",
    "texture-compression-astc": "6",
    "indirect-first-instance": "7",
    "shader-f16": "8",
    "rg11b10ufloat-renderable": "9",
    "bgra8unorm-storage": "10",
    "float32-filterable": "11"
  }
};

var _wgpuAdapterRequestDevice = (adapterId, descriptor, callback, userdata) => {
  var adapter = WebGPU.mgrAdapter.get(adapterId);
  var desc = {};
  if (descriptor) {
    assert(descriptor);
    assert(SAFE_HEAP_LOAD(HEAPU32, ((descriptor) >> 2)) === 0);
    var requiredFeatureCount = SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (8)) >> 2));
    if (requiredFeatureCount) {
      var requiredFeaturesPtr = SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (12)) >> 2));
      // requiredFeaturesPtr is a pointer to an array of FeatureName which is an enum of size uint32_t
      desc["requiredFeatures"] = Array.from(HEAPU32.subarray((((requiredFeaturesPtr) >> 2)), ((requiredFeaturesPtr + requiredFeatureCount * 4) >> 2)), feature => WebGPU.FeatureName[feature]);
    }
    var requiredLimitsPtr = SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (16)) >> 2));
    if (requiredLimitsPtr) {
      assert(requiredLimitsPtr);
      assert(SAFE_HEAP_LOAD(HEAPU32, ((requiredLimitsPtr) >> 2)) === 0);
      var limitsPtr = requiredLimitsPtr + 8;
      var requiredLimits = {};
      function setLimitU32IfDefined(name, limitOffset) {
        var ptr = limitsPtr + limitOffset;
        var value = SAFE_HEAP_LOAD(HEAPU32, ((ptr) >> 2));
        if (value != 4294967295) {
          requiredLimits[name] = value;
        }
      }
      function setLimitU64IfDefined(name, limitOffset) {
        var ptr = limitsPtr + limitOffset;
        // Handle WGPU_LIMIT_U64_UNDEFINED.
        var limitPart1 = SAFE_HEAP_LOAD(HEAPU32, ((ptr) >> 2));
        var limitPart2 = SAFE_HEAP_LOAD(HEAPU32, (((ptr) + (4)) >> 2));
        if (limitPart1 != 4294967295 || limitPart2 != 4294967295) {
          requiredLimits[name] = SAFE_HEAP_LOAD(HEAPU32, (((ptr + 4)) >> 2)) * 4294967296 + SAFE_HEAP_LOAD(HEAPU32, ((ptr) >> 2));
        }
      }
      setLimitU32IfDefined("maxTextureDimension1D", 0);
      setLimitU32IfDefined("maxTextureDimension2D", 4);
      setLimitU32IfDefined("maxTextureDimension3D", 8);
      setLimitU32IfDefined("maxTextureArrayLayers", 12);
      setLimitU32IfDefined("maxBindGroups", 16);
      setLimitU32IfDefined("maxBindGroupsPlusVertexBuffers", 20);
      setLimitU32IfDefined("maxDynamicUniformBuffersPerPipelineLayout", 28);
      setLimitU32IfDefined("maxDynamicStorageBuffersPerPipelineLayout", 32);
      setLimitU32IfDefined("maxSampledTexturesPerShaderStage", 36);
      setLimitU32IfDefined("maxSamplersPerShaderStage", 40);
      setLimitU32IfDefined("maxStorageBuffersPerShaderStage", 44);
      setLimitU32IfDefined("maxStorageTexturesPerShaderStage", 48);
      setLimitU32IfDefined("maxUniformBuffersPerShaderStage", 52);
      setLimitU32IfDefined("minUniformBufferOffsetAlignment", 72);
      setLimitU32IfDefined("minStorageBufferOffsetAlignment", 76);
      setLimitU64IfDefined("maxUniformBufferBindingSize", 56);
      setLimitU64IfDefined("maxStorageBufferBindingSize", 64);
      setLimitU32IfDefined("maxVertexBuffers", 80);
      setLimitU64IfDefined("maxBufferSize", 88);
      setLimitU32IfDefined("maxVertexAttributes", 96);
      setLimitU32IfDefined("maxVertexBufferArrayStride", 100);
      setLimitU32IfDefined("maxInterStageShaderComponents", 104);
      setLimitU32IfDefined("maxInterStageShaderVariables", 108);
      setLimitU32IfDefined("maxColorAttachments", 112);
      setLimitU32IfDefined("maxColorAttachmentBytesPerSample", 116);
      setLimitU32IfDefined("maxComputeWorkgroupStorageSize", 120);
      setLimitU32IfDefined("maxComputeInvocationsPerWorkgroup", 124);
      setLimitU32IfDefined("maxComputeWorkgroupSizeX", 128);
      setLimitU32IfDefined("maxComputeWorkgroupSizeY", 132);
      setLimitU32IfDefined("maxComputeWorkgroupSizeZ", 136);
      setLimitU32IfDefined("maxComputeWorkgroupsPerDimension", 140);
      desc["requiredLimits"] = requiredLimits;
    }
    var defaultQueuePtr = SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (20)) >> 2));
    if (defaultQueuePtr) {
      var defaultQueueDesc = {};
      var labelPtr = SAFE_HEAP_LOAD(HEAPU32, (((defaultQueuePtr) + (4)) >> 2));
      if (labelPtr) defaultQueueDesc["label"] = UTF8ToString(labelPtr);
      desc["defaultQueue"] = defaultQueueDesc;
    }
    var deviceLostCallbackPtr = SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (28)) >> 2));
    var deviceLostUserdataPtr = SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (32)) >> 2));
    var labelPtr = SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (4)) >> 2));
    if (labelPtr) desc["label"] = UTF8ToString(labelPtr);
  }
  adapter.requestDevice(desc).then(device => {
    callUserCallback(() => {
      var deviceWrapper = {
        queueId: WebGPU.mgrQueue.create(device.queue)
      };
      var deviceId = WebGPU.mgrDevice.create(device, deviceWrapper);
      if (deviceLostCallbackPtr) {
        device.lost.then(info => {
          callUserCallback(() => WebGPU.errorCallback(deviceLostCallbackPtr, WebGPU.Int_DeviceLostReason[info.reason], info.message, deviceLostUserdataPtr));
        });
      }
      getWasmTableEntry(callback)(0, deviceId, 0, userdata);
    });
  }, function(ex) {
    callUserCallback(() => {
      var sp = stackSave();
      var messagePtr = stringToUTF8OnStack(ex.message);
      getWasmTableEntry(callback)(1, 0, messagePtr, userdata);
      stackRestore(sp);
    });
  });
};

var _wgpuCommandEncoderBeginRenderPass = (encoderId, descriptor) => {
  assert(descriptor);
  function makeColorAttachment(caPtr) {
    var viewPtr = SAFE_HEAP_LOAD(HEAPU32, (((caPtr) + (4)) >> 2));
    if (viewPtr === 0) {
      // view could be undefined.
      return undefined;
    }
    var depthSlice = SAFE_HEAP_LOAD(HEAP32, (((caPtr) + (8)) >> 2));
    if (depthSlice == -1) depthSlice = undefined;
    var loadOpInt = SAFE_HEAP_LOAD(HEAPU32, (((caPtr) + (16)) >> 2));
    assert(loadOpInt !== 0);
    var storeOpInt = SAFE_HEAP_LOAD(HEAPU32, (((caPtr) + (20)) >> 2));
    assert(storeOpInt !== 0);
    var clearValue = WebGPU.makeColor(caPtr + 24);
    return {
      "view": WebGPU.mgrTextureView.get(viewPtr),
      "depthSlice": depthSlice,
      "resolveTarget": WebGPU.mgrTextureView.get(SAFE_HEAP_LOAD(HEAPU32, (((caPtr) + (12)) >> 2))),
      "clearValue": clearValue,
      "loadOp": WebGPU.LoadOp[loadOpInt],
      "storeOp": WebGPU.StoreOp[storeOpInt]
    };
  }
  function makeColorAttachments(count, caPtr) {
    var attachments = [];
    for (var i = 0; i < count; ++i) {
      attachments.push(makeColorAttachment(caPtr + 56 * i));
    }
    return attachments;
  }
  function makeDepthStencilAttachment(dsaPtr) {
    if (dsaPtr === 0) return undefined;
    return {
      "view": WebGPU.mgrTextureView.get(SAFE_HEAP_LOAD(HEAPU32, ((dsaPtr) >> 2))),
      "depthClearValue": SAFE_HEAP_LOAD(HEAPF32, (((dsaPtr) + (12)) >> 2)),
      "depthLoadOp": WebGPU.LoadOp[SAFE_HEAP_LOAD(HEAPU32, (((dsaPtr) + (4)) >> 2))],
      "depthStoreOp": WebGPU.StoreOp[SAFE_HEAP_LOAD(HEAPU32, (((dsaPtr) + (8)) >> 2))],
      "depthReadOnly": !!(SAFE_HEAP_LOAD(HEAPU32, (((dsaPtr) + (16)) >> 2))),
      "stencilClearValue": SAFE_HEAP_LOAD(HEAPU32, (((dsaPtr) + (28)) >> 2)),
      "stencilLoadOp": WebGPU.LoadOp[SAFE_HEAP_LOAD(HEAPU32, (((dsaPtr) + (20)) >> 2))],
      "stencilStoreOp": WebGPU.StoreOp[SAFE_HEAP_LOAD(HEAPU32, (((dsaPtr) + (24)) >> 2))],
      "stencilReadOnly": !!(SAFE_HEAP_LOAD(HEAPU32, (((dsaPtr) + (32)) >> 2)))
    };
  }
  function makeRenderPassTimestampWrites(twPtr) {
    if (twPtr === 0) return undefined;
    return {
      "querySet": WebGPU.mgrQuerySet.get(SAFE_HEAP_LOAD(HEAPU32, ((twPtr) >> 2))),
      "beginningOfPassWriteIndex": SAFE_HEAP_LOAD(HEAPU32, (((twPtr) + (4)) >> 2)),
      "endOfPassWriteIndex": SAFE_HEAP_LOAD(HEAPU32, (((twPtr) + (8)) >> 2))
    };
  }
  function makeRenderPassDescriptor(descriptor) {
    assert(descriptor);
    var nextInChainPtr = SAFE_HEAP_LOAD(HEAPU32, ((descriptor) >> 2));
    var maxDrawCount = undefined;
    if (nextInChainPtr !== 0) {
      var sType = SAFE_HEAP_LOAD(HEAPU32, (((nextInChainPtr) + (4)) >> 2));
      assert(sType === 15);
      assert(0 === SAFE_HEAP_LOAD(HEAPU32, ((nextInChainPtr) >> 2)));
      var renderPassDescriptorMaxDrawCount = nextInChainPtr;
      assert(renderPassDescriptorMaxDrawCount);
      assert(SAFE_HEAP_LOAD(HEAPU32, ((renderPassDescriptorMaxDrawCount) >> 2)) === 0);
      maxDrawCount = SAFE_HEAP_LOAD(HEAPU32, ((((renderPassDescriptorMaxDrawCount + 4)) + (8)) >> 2)) * 4294967296 + SAFE_HEAP_LOAD(HEAPU32, (((renderPassDescriptorMaxDrawCount) + (8)) >> 2));
    }
    var desc = {
      "label": undefined,
      "colorAttachments": makeColorAttachments(SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (8)) >> 2)), SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (12)) >> 2))),
      "depthStencilAttachment": makeDepthStencilAttachment(SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (16)) >> 2))),
      "occlusionQuerySet": WebGPU.mgrQuerySet.get(SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (20)) >> 2))),
      "timestampWrites": makeRenderPassTimestampWrites(SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (24)) >> 2))),
      "maxDrawCount": maxDrawCount
    };
    var labelPtr = SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (4)) >> 2));
    if (labelPtr) desc["label"] = UTF8ToString(labelPtr);
    return desc;
  }
  var desc = makeRenderPassDescriptor(descriptor);
  var commandEncoder = WebGPU.mgrCommandEncoder.get(encoderId);
  return WebGPU.mgrRenderPassEncoder.create(commandEncoder.beginRenderPass(desc));
};

var _wgpuCommandEncoderFinish = (encoderId, descriptor) => {
  // TODO: Use the descriptor.
  var commandEncoder = WebGPU.mgrCommandEncoder.get(encoderId);
  return WebGPU.mgrCommandBuffer.create(commandEncoder.finish());
};

var _wgpuDeviceCreateCommandEncoder = (deviceId, descriptor) => {
  var desc;
  if (descriptor) {
    assert(descriptor);
    assert(SAFE_HEAP_LOAD(HEAPU32, ((descriptor) >> 2)) === 0);
    desc = {
      "label": undefined
    };
    var labelPtr = SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (4)) >> 2));
    if (labelPtr) desc["label"] = UTF8ToString(labelPtr);
  }
  var device = WebGPU.mgrDevice.get(deviceId);
  return WebGPU.mgrCommandEncoder.create(device.createCommandEncoder(desc));
};

var _wgpuDeviceCreateSwapChain = (deviceId, surfaceId, descriptor) => {
  assert(descriptor);
  assert(SAFE_HEAP_LOAD(HEAPU32, ((descriptor) >> 2)) === 0);
  var device = WebGPU.mgrDevice.get(deviceId);
  var context = WebGPU.mgrSurface.get(surfaceId);
  assert(1 === SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (24)) >> 2)));
  var canvasSize = [ SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (16)) >> 2)), SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (20)) >> 2)) ];
  if (canvasSize[0] !== 0) {
    context["canvas"]["width"] = canvasSize[0];
  }
  if (canvasSize[1] !== 0) {
    context["canvas"]["height"] = canvasSize[1];
  }
  var configuration = {
    "device": device,
    "format": WebGPU.TextureFormat[SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (12)) >> 2))],
    "usage": SAFE_HEAP_LOAD(HEAPU32, (((descriptor) + (8)) >> 2)),
    "alphaMode": "opaque"
  };
  context.configure(configuration);
  return WebGPU.mgrSwapChain.create(context);
};

var _wgpuDeviceGetQueue = deviceId => {
  var queueId = WebGPU.mgrDevice.objects[deviceId].queueId;
  assert(queueId, "wgpuDeviceGetQueue: queue was missing or null");
  // Returns a new reference to the existing queue.
  WebGPU.mgrQueue.reference(queueId);
  return queueId;
};

var _wgpuInstanceRequestAdapter = (instanceId, options, callback, userdata) => {
  assert(instanceId === 1, "WGPUInstance must be created by wgpuCreateInstance");
  var opts;
  if (options) {
    assert(options);
    assert(SAFE_HEAP_LOAD(HEAPU32, ((options) >> 2)) === 0);
    opts = {
      "powerPreference": WebGPU.PowerPreference[SAFE_HEAP_LOAD(HEAPU32, (((options) + (8)) >> 2))],
      "forceFallbackAdapter": !!(SAFE_HEAP_LOAD(HEAPU32, (((options) + (16)) >> 2)))
    };
  }
  if (!("gpu" in navigator)) {
    var sp = stackSave();
    var messagePtr = stringToUTF8OnStack("WebGPU not available on this browser (navigator.gpu is not available)");
    getWasmTableEntry(callback)(1, 0, messagePtr, userdata);
    stackRestore(sp);
    return;
  }
  navigator["gpu"]["requestAdapter"](opts).then(adapter => {
    callUserCallback(() => {
      if (adapter) {
        var adapterId = WebGPU.mgrAdapter.create(adapter);
        getWasmTableEntry(callback)(0, adapterId, 0, userdata);
      } else {
        var sp = stackSave();
        var messagePtr = stringToUTF8OnStack("WebGPU not available on this system (requestAdapter returned null)");
        getWasmTableEntry(callback)(1, 0, messagePtr, userdata);
        stackRestore(sp);
      }
    });
  }, ex => {
    callUserCallback(() => {
      var sp = stackSave();
      var messagePtr = stringToUTF8OnStack(ex.message);
      getWasmTableEntry(callback)(2, 0, messagePtr, userdata);
      stackRestore(sp);
    });
  });
};

var _wgpuQueueSubmit = (queueId, commandCount, commands) => {
  assert(commands % 4 === 0);
  var queue = WebGPU.mgrQueue.get(queueId);
  var cmds = Array.from(HEAP32.subarray((((commands) >> 2)), ((commands + commandCount * 4) >> 2)), id => WebGPU.mgrCommandBuffer.get(id));
  queue.submit(cmds);
};

var _wgpuRenderPassEncoderEnd = encoderId => {
  var encoder = WebGPU.mgrRenderPassEncoder.get(encoderId);
  encoder.end();
};

var _wgpuSwapChainGetCurrentTextureView = swapChainId => {
  var context = WebGPU.mgrSwapChain.get(swapChainId);
  return WebGPU.mgrTextureView.create(context.getCurrentTexture().createView());
};

var _wgpuTextureViewRelease = id => WebGPU.mgrTextureView.release(id);

WebGPU.initManagers();

// End JS library code
// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.
{
  // Begin ATMODULES hooks
  if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
  if (Module["print"]) out = Module["print"];
  if (Module["printErr"]) err = Module["printErr"];
  if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
  Module["FS_createDataFile"] = FS.createDataFile;
  Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
  // End ATMODULES hooks
  checkIncomingModuleAPI();
  if (Module["arguments"]) arguments_ = Module["arguments"];
  if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
  // Assertions on removed incoming Module JS APIs.
  assert(typeof Module["memoryInitializerPrefixURL"] == "undefined", "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead");
  assert(typeof Module["pthreadMainPrefixURL"] == "undefined", "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead");
  assert(typeof Module["cdInitializerPrefixURL"] == "undefined", "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead");
  assert(typeof Module["filePackagePrefixURL"] == "undefined", "Module.filePackagePrefixURL option was removed, use Module.locateFile instead");
  assert(typeof Module["read"] == "undefined", "Module.read option was removed");
  assert(typeof Module["readAsync"] == "undefined", "Module.readAsync option was removed (modify readAsync in JS)");
  assert(typeof Module["readBinary"] == "undefined", "Module.readBinary option was removed (modify readBinary in JS)");
  assert(typeof Module["setWindowTitle"] == "undefined", "Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)");
  assert(typeof Module["TOTAL_MEMORY"] == "undefined", "Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY");
  assert(typeof Module["ENVIRONMENT"] == "undefined", "Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)");
  assert(typeof Module["STACK_SIZE"] == "undefined", "STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time");
  // If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
  assert(typeof Module["wasmMemory"] == "undefined", "Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally");
  assert(typeof Module["INITIAL_MEMORY"] == "undefined", "Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically");
}

// Begin runtime exports
var missingLibrarySymbols = [ "writeI53ToI64", "writeI53ToI64Clamped", "writeI53ToI64Signaling", "writeI53ToU64Clamped", "writeI53ToU64Signaling", "readI53FromI64", "readI53FromU64", "convertI32PairToI53", "convertI32PairToI53Checked", "convertU32PairToI53", "getTempRet0", "setTempRet0", "zeroMemory", "getHeapMax", "growMemory", "withStackSave", "strError", "inetPton4", "inetNtop4", "inetPton6", "inetNtop6", "readSockaddr", "writeSockaddr", "readEmAsmArgs", "jstoi_q", "getExecutableName", "autoResumeAudioContext", "getDynCaller", "dynCall", "runtimeKeepalivePush", "runtimeKeepalivePop", "asmjsMangle", "asyncLoad", "alignMemory", "mmapAlloc", "HandleAllocator", "getNativeTypeSize", "getUniqueRunDependency", "addOnInit", "addOnPostCtor", "addOnPreMain", "addOnExit", "STACK_SIZE", "STACK_ALIGN", "POINTER_SIZE", "ASSERTIONS", "ccall", "cwrap", "convertJsFunctionToWasm", "getEmptyTableSlot", "updateTableMap", "getFunctionAddress", "addFunction", "removeFunction", "intArrayFromString", "intArrayToString", "AsciiToString", "stringToAscii", "UTF16ToString", "stringToUTF16", "lengthBytesUTF16", "UTF32ToString", "stringToUTF32", "lengthBytesUTF32", "stringToNewUTF8", "writeArrayToMemory", "registerKeyEventCallback", "maybeCStringToJsString", "findEventTarget", "getBoundingClientRect", "fillMouseEventData", "registerMouseEventCallback", "registerWheelEventCallback", "registerUiEventCallback", "registerFocusEventCallback", "fillDeviceOrientationEventData", "registerDeviceOrientationEventCallback", "fillDeviceMotionEventData", "registerDeviceMotionEventCallback", "screenOrientation", "fillOrientationChangeEventData", "registerOrientationChangeEventCallback", "fillFullscreenChangeEventData", "registerFullscreenChangeEventCallback", "JSEvents_requestFullscreen", "JSEvents_resizeCanvasForFullscreen", "registerRestoreOldStyle", "hideEverythingExceptGivenElement", "restoreHiddenElements", "setLetterbox", "softFullscreenResizeWebGLRenderTarget", "doRequestFullscreen", "fillPointerlockChangeEventData", "registerPointerlockChangeEventCallback", "registerPointerlockErrorEventCallback", "requestPointerLock", "fillVisibilityChangeEventData", "registerVisibilityChangeEventCallback", "registerTouchEventCallback", "fillGamepadEventData", "registerGamepadEventCallback", "registerBeforeUnloadEventCallback", "fillBatteryEventData", "registerBatteryEventCallback", "setCanvasElementSize", "getCanvasElementSize", "jsStackTrace", "getCallstack", "convertPCtoSourceLocation", "getEnvStrings", "checkWasiClock", "wasiRightsToMuslOFlags", "wasiOFlagsToMuslOFlags", "initRandomFill", "randomFill", "safeSetTimeout", "setImmediateWrapped", "safeRequestAnimationFrame", "clearImmediateWrapped", "registerPostMainLoop", "registerPreMainLoop", "getPromise", "makePromise", "idsToPromises", "makePromiseCallback", "ExceptionInfo", "findMatchingCatch", "Browser_asyncPrepareDataCounter", "isLeapYear", "ydayFromDate", "arraySum", "addDays", "getSocketFromFD", "getSocketAddress", "FS_createPreloadedFile", "FS_modeStringToFlags", "FS_getMode", "FS_stdin_getChar", "FS_mkdirTree", "_setNetworkCallback", "heapObjectForWebGLType", "toTypedArrayIndex", "webgl_enable_ANGLE_instanced_arrays", "webgl_enable_OES_vertex_array_object", "webgl_enable_WEBGL_draw_buffers", "webgl_enable_WEBGL_multi_draw", "webgl_enable_EXT_polygon_offset_clamp", "webgl_enable_EXT_clip_control", "webgl_enable_WEBGL_polygon_mode", "emscriptenWebGLGet", "computeUnpackAlignedImageSize", "colorChannelsInGlTextureFormat", "emscriptenWebGLGetTexPixelData", "emscriptenWebGLGetUniform", "webglGetUniformLocation", "webglPrepareUniformLocationsBeforeFirstUse", "webglGetLeftBracePos", "emscriptenWebGLGetVertexAttrib", "__glGetActiveAttribOrUniform", "writeGLArray", "registerWebGlEventCallback", "runAndAbortIfError", "ALLOC_NORMAL", "ALLOC_STACK", "allocate", "writeStringToMemory", "writeAsciiToMemory", "demangle", "stackTrace" ];

missingLibrarySymbols.forEach(missingLibrarySymbol);

var unexportedSymbols = [ "run", "addRunDependency", "removeRunDependency", "out", "err", "callMain", "abort", "wasmMemory", "wasmExports", "HEAPF32", "HEAPF64", "HEAP8", "HEAPU8", "HEAP16", "HEAPU16", "HEAP32", "HEAPU32", "HEAP64", "HEAPU64", "writeStackCookie", "checkStackCookie", "INT53_MAX", "INT53_MIN", "bigintToI53Checked", "stackSave", "stackRestore", "stackAlloc", "ptrToString", "exitJS", "abortOnCannotGrowMemory", "ENV", "setStackLimits", "ERRNO_CODES", "DNS", "Protocols", "Sockets", "timers", "warnOnce", "readEmAsmArgsArray", "handleException", "keepRuntimeAlive", "callUserCallback", "maybeExit", "wasmTable", "noExitRuntime", "addOnPreRun", "addOnPostRun", "freeTableIndexes", "functionsInTableMap", "setValue", "getValue", "PATH", "PATH_FS", "UTF8Decoder", "UTF8ArrayToString", "UTF8ToString", "stringToUTF8Array", "stringToUTF8", "lengthBytesUTF8", "UTF16Decoder", "stringToUTF8OnStack", "JSEvents", "specialHTMLTargets", "findCanvasEventTarget", "currentFullscreenStrategy", "restoreOldWindowedStyle", "UNWIND_CACHE", "ExitStatus", "flush_NO_FILESYSTEM", "emSetImmediate", "emClearImmediate_deps", "emClearImmediate", "promiseMap", "uncaughtExceptionCount", "exceptionLast", "exceptionCaught", "Browser", "requestFullscreen", "requestFullScreen", "setCanvasSize", "getUserMedia", "createContext", "getPreloadedImageData__data", "wget", "MONTH_DAYS_REGULAR", "MONTH_DAYS_LEAP", "MONTH_DAYS_REGULAR_CUMULATIVE", "MONTH_DAYS_LEAP_CUMULATIVE", "SYSCALLS", "preloadPlugins", "FS_stdin_getChar_buffer", "FS_unlink", "FS_createPath", "FS_createDevice", "FS_readFile", "FS", "FS_root", "FS_mounts", "FS_devices", "FS_streams", "FS_nextInode", "FS_nameTable", "FS_currentPath", "FS_initialized", "FS_ignorePermissions", "FS_filesystems", "FS_syncFSRequests", "FS_readFiles", "FS_lookupPath", "FS_getPath", "FS_hashName", "FS_hashAddNode", "FS_hashRemoveNode", "FS_lookupNode", "FS_createNode", "FS_destroyNode", "FS_isRoot", "FS_isMountpoint", "FS_isFile", "FS_isDir", "FS_isLink", "FS_isChrdev", "FS_isBlkdev", "FS_isFIFO", "FS_isSocket", "FS_flagsToPermissionString", "FS_nodePermissions", "FS_mayLookup", "FS_mayCreate", "FS_mayDelete", "FS_mayOpen", "FS_checkOpExists", "FS_nextfd", "FS_getStreamChecked", "FS_getStream", "FS_createStream", "FS_closeStream", "FS_dupStream", "FS_doSetAttr", "FS_chrdev_stream_ops", "FS_major", "FS_minor", "FS_makedev", "FS_registerDevice", "FS_getDevice", "FS_getMounts", "FS_syncfs", "FS_mount", "FS_unmount", "FS_lookup", "FS_mknod", "FS_statfs", "FS_statfsStream", "FS_statfsNode", "FS_create", "FS_mkdir", "FS_mkdev", "FS_symlink", "FS_rename", "FS_rmdir", "FS_readdir", "FS_readlink", "FS_stat", "FS_fstat", "FS_lstat", "FS_doChmod", "FS_chmod", "FS_lchmod", "FS_fchmod", "FS_doChown", "FS_chown", "FS_lchown", "FS_fchown", "FS_doTruncate", "FS_truncate", "FS_ftruncate", "FS_utime", "FS_open", "FS_close", "FS_isClosed", "FS_llseek", "FS_read", "FS_write", "FS_mmap", "FS_msync", "FS_ioctl", "FS_writeFile", "FS_cwd", "FS_chdir", "FS_createDefaultDirectories", "FS_createDefaultDevices", "FS_createSpecialDirectories", "FS_createStandardStreams", "FS_staticInit", "FS_init", "FS_quit", "FS_findObject", "FS_analyzePath", "FS_createFile", "FS_createDataFile", "FS_forceLoadFile", "FS_createLazyFile", "FS_absolutePath", "FS_createFolder", "FS_createLink", "FS_joinPath", "FS_mmapAlloc", "FS_standardizePath", "MEMFS", "TTY", "PIPEFS", "SOCKFS", "tempFixedLengthArray", "miniTempWebGLFloatBuffers", "miniTempWebGLIntBuffers", "GL", "AL", "GLUT", "EGL", "GLEW", "IDBStore", "SDL", "SDL_gfx", "WebGPU", "JsValStore", "allocateUTF8", "allocateUTF8OnStack", "print", "printErr", "jstoi_s" ];

unexportedSymbols.forEach(unexportedRuntimeSymbol);

// End runtime exports
// Begin JS library exports
// End JS library exports
// end include: postlibrary.js
function checkIncomingModuleAPI() {
  ignoredModuleProp("fetchSettings");
}

// Imports from the Wasm binary.
var _main = Module["_main"] = makeInvalidEarlyAccess("_main");

var _fflush = makeInvalidEarlyAccess("_fflush");

var _strerror = makeInvalidEarlyAccess("_strerror");

var _malloc = makeInvalidEarlyAccess("_malloc");

var _emscripten_get_sbrk_ptr = makeInvalidEarlyAccess("_emscripten_get_sbrk_ptr");

var _sbrk = makeInvalidEarlyAccess("_sbrk");

var _emscripten_stack_init = makeInvalidEarlyAccess("_emscripten_stack_init");

var _emscripten_stack_get_free = makeInvalidEarlyAccess("_emscripten_stack_get_free");

var _emscripten_stack_get_base = makeInvalidEarlyAccess("_emscripten_stack_get_base");

var _emscripten_stack_get_end = makeInvalidEarlyAccess("_emscripten_stack_get_end");

var __emscripten_stack_restore = makeInvalidEarlyAccess("__emscripten_stack_restore");

var __emscripten_stack_alloc = makeInvalidEarlyAccess("__emscripten_stack_alloc");

var _emscripten_stack_get_current = makeInvalidEarlyAccess("_emscripten_stack_get_current");

var ___set_stack_limits = Module["___set_stack_limits"] = makeInvalidEarlyAccess("___set_stack_limits");

function assignWasmExports(wasmExports) {
  Module["_main"] = _main = createExportWrapper("main", 2);
  _fflush = createExportWrapper("fflush", 1);
  _strerror = createExportWrapper("strerror", 1);
  _malloc = createExportWrapper("malloc", 1);
  _emscripten_get_sbrk_ptr = createExportWrapper("emscripten_get_sbrk_ptr", 0);
  _sbrk = createExportWrapper("sbrk", 1);
  _emscripten_stack_init = wasmExports["emscripten_stack_init"];
  _emscripten_stack_get_free = wasmExports["emscripten_stack_get_free"];
  _emscripten_stack_get_base = wasmExports["emscripten_stack_get_base"];
  _emscripten_stack_get_end = wasmExports["emscripten_stack_get_end"];
  __emscripten_stack_restore = wasmExports["_emscripten_stack_restore"];
  __emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"];
  _emscripten_stack_get_current = wasmExports["emscripten_stack_get_current"];
  Module["___set_stack_limits"] = ___set_stack_limits = createExportWrapper("__set_stack_limits", 2);
}

var wasmImports = {
  /** @export */ __assert_fail: ___assert_fail,
  /** @export */ __handle_stack_overflow: ___handle_stack_overflow,
  /** @export */ _abort_js: __abort_js,
  /** @export */ alignfault,
  /** @export */ emscripten_request_animation_frame_loop: _emscripten_request_animation_frame_loop,
  /** @export */ emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */ fd_close: _fd_close,
  /** @export */ fd_seek: _fd_seek,
  /** @export */ fd_write: _fd_write,
  /** @export */ segfault,
  /** @export */ wgpuAdapterRequestDevice: _wgpuAdapterRequestDevice,
  /** @export */ wgpuCommandEncoderBeginRenderPass: _wgpuCommandEncoderBeginRenderPass,
  /** @export */ wgpuCommandEncoderFinish: _wgpuCommandEncoderFinish,
  /** @export */ wgpuDeviceCreateCommandEncoder: _wgpuDeviceCreateCommandEncoder,
  /** @export */ wgpuDeviceCreateSwapChain: _wgpuDeviceCreateSwapChain,
  /** @export */ wgpuDeviceGetQueue: _wgpuDeviceGetQueue,
  /** @export */ wgpuInstanceRequestAdapter: _wgpuInstanceRequestAdapter,
  /** @export */ wgpuQueueSubmit: _wgpuQueueSubmit,
  /** @export */ wgpuRenderPassEncoderEnd: _wgpuRenderPassEncoderEnd,
  /** @export */ wgpuSwapChainGetCurrentTextureView: _wgpuSwapChainGetCurrentTextureView,
  /** @export */ wgpuTextureViewRelease: _wgpuTextureViewRelease
};

var wasmExports;

createWasm();

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===
var calledRun;

function callMain() {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])');
  assert(typeof onPreRuns === "undefined" || onPreRuns.length == 0, "cannot call main when preRun functions remain to be called");
  var entryFunction = _main;
  var argc = 0;
  var argv = 0;
  try {
    var ret = entryFunction(argc, argv);
    // if we're not running an evented main loop, it's time to exit
    exitJS(ret, /* implicit = */ true);
    return ret;
  } catch (e) {
    return handleException(e);
  }
}

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  _emscripten_stack_init();
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie();
}

function run() {
  if (runDependencies > 0) {
    dependenciesFulfilled = run;
    return;
  }
  stackCheckInit();
  preRun();
  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    dependenciesFulfilled = run;
    return;
  }
  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    assert(!calledRun);
    calledRun = true;
    Module["calledRun"] = true;
    if (ABORT) return;
    initRuntime();
    preMain();
    Module["onRuntimeInitialized"]?.();
    consumedModuleProp("onRuntimeInitialized");
    var noInitialRun = Module["noInitialRun"] || false;
    if (!noInitialRun) callMain();
    postRun();
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(() => {
      setTimeout(() => Module["setStatus"](""), 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = x => {
    has = true;
  };
  try {
    // it doesn't matter if it fails
    flush_NO_FILESYSTEM();
  } catch (e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce("stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.");
    warnOnce("(this may also be due to not including full filesystem support - try building with -sFORCE_FILESYSTEM)");
  }
}

function preInit() {
  if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
    while (Module["preInit"].length > 0) {
      Module["preInit"].shift()();
    }
  }
  consumedModuleProp("preInit");
}

preInit();

run();

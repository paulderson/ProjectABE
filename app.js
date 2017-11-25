(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (value instanceof ArrayBuffer) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (isArrayBufferView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (isArrayBufferView(string) || string instanceof ArrayBuffer) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// Node 0.10 supports `ArrayBuffer` but lacks `ArrayBuffer.isView`
function isArrayBufferView (obj) {
  return (typeof ArrayBuffer.isView === 'function') && ArrayBuffer.isView(obj)
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":4}],3:[function(require,module,exports){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

module.exports = { bind: bind, inject: inject, getInstanceOf: getInstanceOf, getPolicy: getPolicy };

/*

Welcome to DRY-DI.

*/

var knownInterfaces = [];
var interfaces = {};
var concretions = {};

var context = [{}];

var Ref = function () {
    function Ref(provider, ifid, scope) {
        _classCallCheck(this, Ref);

        this.ifid = ifid;
        this.count = provider.dependencyCount;
        this.dependencyCount = provider.dependencyCount;
        this.scope = scope;

        this.binds = {};
        this.injections = null;
        this.provider = provider;

        var pslot = scope[ifid] || (scope[ifid] = new Slot());

        if (provider.injections) {
            this.injections = {};
            Object.assign(this.injections, provider.injections);

            for (var key in this.injections) {
                var _ifid = this.injections[key];
                var slot = scope[_ifid] || (scope[_ifid] = new Slot());
                slot.addInjector(this);
            }
        }

        pslot.addProvider(this);
    }

    _createClass(Ref, [{
        key: "bindInjections",
        value: function bindInjections(injections) {
            var _this = this;

            injections.forEach(function (_ref) {
                var _ref2 = _slicedToArray(_ref, 2),
                    clazz = _ref2[0],
                    _interface = _ref2[1];

                var key = knownInterfaces.indexOf(_interface);
                var injection = injections[key];

                if (!(key in _this.binds)) {
                    var ifid = _this.injections[key];
                    _this.scope[_this.ifid].removeInjector(_this);
                    _this.satisfy();
                    _this.dependencyCount--;
                }

                _this.binds[key] = clazz;
            });
        }
    }, {
        key: "satisfy",
        value: function satisfy() {

            this.count--;

            if (this.count == 0) this.scope[this.ifid].addViable();
        }
    }]);

    return Ref;
}();

var Slot = function () {
    function Slot() {
        _classCallCheck(this, Slot);

        this.viableProviders = 0;
        this.providers = [];
        this.injectors = [];
    }

    _createClass(Slot, [{
        key: "addInjector",
        value: function addInjector(ref) {

            this.injectors.push(ref);
            if (this.viableProviders > 0) ref.satisfy();
        }
    }, {
        key: "removeInjector",
        value: function removeInjector(ref) {

            var index = this.injectors.indexOf(ref);
            if (index > -1) this.injectors.splice(index, 1);
        }
    }, {
        key: "addProvider",
        value: function addProvider(ref) {

            this.providers.push(ref);
            if (ref.count == 0) this.addViable();
        }
    }, {
        key: "addViable",
        value: function addViable() {

            this.viableProviders++;
            if (this.viableProviders == 1) {

                var injectors = this.injectors;
                for (var i = 0, l = injectors.length; i < l; ++i) {
                    injectors[i].satisfy();
                }
            }
        }
    }, {
        key: "getViable",
        value: function getViable(clazz, tags, multiple) {

            if (this.viableProviders == 0) {
                if (!multiple) throw new Error("No viable providers for " + clazz + ". #126");
                return [];
            }

            var ret = multiple ? [] : null;

            var mostViable = null;
            var maxPoints = -1;
            notViable: for (var i = 0, c; c = this.providers[i]; ++i) {
                if (c.count) continue;
                var points = c.dependencyCount;
                if (tags && c.tags) {
                    for (var tag in tags) {
                        if (c.tags[tag] !== tags[tag]) continue notViable;
                        points++;
                    }
                }
                if (multiple) ret[ret.length] = c.provider.policy.bind(c.provider, c.binds);else {
                    if (points > maxPoints) {
                        maxPoints = points;
                        mostViable = c;
                    }
                }
            }

            if (!multiple) {
                if (!mostViable) throw new Error("No viable providers for " + clazz + ". Tag mismatch.");

                return mostViable.provider.policy.bind(mostViable.provider, mostViable.binds);
            } else return ret;
        }
    }]);

    return Slot;
}();

function registerInterface(ifc) {

    var props = {},
        currifc = void 0;

    if (typeof ifc == "function") currifc = ifc.prototype;else if ((typeof ifc === "undefined" ? "undefined" : _typeof(ifc)) == "object") currifc = ifc;

    while (currifc && currifc !== Object.prototype) {

        var names = Object.getOwnPropertyNames(ifc.prototype);

        for (var i = 0, l = names.length; i < l; ++i) {
            var name = names[i];

            if (!props[name]) props[name] = _typeof(ifc.prototype[name]);
        }

        currifc = currifc.prototype;
    }

    var len = knownInterfaces.length;
    interfaces[len] = props;
    knownInterfaces[len] = ifc;

    return len;
}

var Provide = function () {
    function Provide() {
        _classCallCheck(this, Provide);

        this.injections = null;
        this.dependencyCount = 0;
        this.clazz = null;
        this.ctor = null;
        this.binds = null;

        // default policy is to create a new instance for each injection
        this.policy = function (binds, args) {
            return new this.ctor(binds, args);
        };
    }

    _createClass(Provide, [{
        key: "clone",
        value: function clone() {

            var ret = new Provide();

            ret.injections = this.injections;
            ret.dependencyCount = this.dependencyCount;
            ret.clazz = this.clazz;
            ret.policy = this.policy;
            ret.ctor = this.ctor;
            ret.binds = this.binds;

            return ret;
        }
    }, {
        key: "bindInjections",
        value: function bindInjections(injections) {

            var binds = this.binds = this.binds || [];
            var bindCount = this.binds.length;

            injections.forEach(function (_ref3) {
                var _ref4 = _slicedToArray(_ref3, 2),
                    clazz = _ref4[0],
                    _interface = _ref4[1];

                for (var i = 0; i < bindCount; ++i) {
                    if (binds[i][0] == clazz) return;
                }
                binds[binds.length] = [clazz, _interface];
            });

            return this;
        }
    }, {
        key: "getRef",
        value: function getRef(ifid, _interface) {

            var map = interfaces[ifid],
                clazz = this.clazz;

            for (var key in map) {
                if (_typeof(clazz.prototype[key]) == map[key]) continue;
                throw new Error("Class " + clazz.name + " can't provide to interface " + _interface.name + " because " + key + " is " + _typeof(clazz[key]) + " instead of " + map[key] + ".");
            }

            return new Ref(this, ifid, context[context.length - 1]);
        }
    }, {
        key: "setConcretion",
        value: function setConcretion(clazz) {

            this.clazz = clazz;
            if (typeof clazz == "function") {
                this.ctor = function (_clazz) {
                    _inherits(_class, _clazz);

                    function _class(binds, args) {
                        var _ref5;

                        _classCallCheck(this, _class);

                        return _possibleConstructorReturn(this, (_ref5 = _class.__proto__ || Object.getPrototypeOf(_class)).call.apply(_ref5, [this].concat(_toConsumableArray(args))));
                    }

                    return _class;
                }(clazz);
                // this.ctor.prototype = Object.create(clazz.prototype);
            } else {
                this.policy = function () {
                    return clazz;
                };
            }

            var cid = knownInterfaces.indexOf(clazz);
            if (cid == -1) cid = registerInterface(clazz);

            if (!concretions[cid]) concretions[cid] = [this];else concretions[cid].push(this);

            return this;
        }
    }, {
        key: "factory",
        value: function factory() {

            this.policy = function (binds, args) {
                var THIS = this;

                return function () {
                    for (var _len = arguments.length, args2 = Array(_len), _key = 0; _key < _len; _key++) {
                        args2[_key] = arguments[_key];
                    }

                    return new THIS.ctor(binds, args.concat(args2));
                };
            };

            return this;
        }
    }, {
        key: "singleton",
        value: function singleton() {

            var instance = null;
            this.policy = function (binds, args) {

                if (instance) return instance;

                instance = Object.create(this.ctor.prototype);
                instance.constructor = this.ctor;
                this.ctor.call(instance, binds, args);

                // new (class extends this.ctor{
                //     constructor( args ){
                //         instance = this; // cant do this :(
                //         super(args);
                //     }
                // }

                return instance;
            };

            return this;
        }
    }]);

    return Provide;
}();

function bind(clazz) {

    var cid = knownInterfaces.indexOf(clazz);
    if (cid == -1) {
        cid = registerInterface(clazz);
    }

    var providers = concretions[cid];
    var localProviders = [];

    if (!providers) {

        if (clazz && clazz["@inject"]) inject(clazz["@inject"]).into(clazz);else new Provide().setConcretion(clazz);

        providers = concretions[cid];
    }

    localProviders = providers.map(function (partial) {
        return partial.clone();
    });

    var refs = [];
    var tags = null;
    var ifid = void 0;

    var partialBind = {
        to: function to(_interface) {

            var ifid = knownInterfaces.indexOf(_interface);
            if (ifid == -1) ifid = registerInterface(_interface);

            localProviders.forEach(function (provider) {

                var ref = provider.getRef(ifid, _interface);
                ref.tags = tags;
                refs.push(ref);
            });

            return this;
        },

        withTags: function withTags(tags) {
            refs.forEach(function (ref) {
                return ref.tags = tags;
            });
            return this;
        },

        singleton: function singleton() {
            localProviders.forEach(function (provider) {
                return provider.singleton();
            });
            return this;
        },
        factory: function factory() {
            localProviders.forEach(function (provider) {
                return provider.factory();
            });
            return this;
        },
        inject: function inject(map) {
            return this.injecting(map);
        },
        injecting: function injecting() {
            for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                args[_key2] = arguments[_key2];
            }

            refs.forEach(function (ref) {
                return ref.bindInjections(args);
            });
            localProviders.forEach(function (provider) {
                return provider.bindInjections(args);
            });
            return this;
        }

    };

    return partialBind;
}

var Inject = function () {
    function Inject(dependencies) {
        _classCallCheck(this, Inject);

        this.dependencies = dependencies;
        var tags = this.tags = {};
        for (var key in dependencies) {
            tags[key] = {};
        }
    }

    _createClass(Inject, [{
        key: "into",
        value: function into(clazz) {

            var cid = knownInterfaces.indexOf(clazz);
            if (cid == -1) cid = registerInterface(clazz);

            var injections = {},
                map = this.dependencies,
                dependencyCount = 0,
                tags = this.tags,
                multiple = {};

            for (var key in map) {

                var _interface = map[key];
                var dependency = _interface;
                if (Array.isArray(dependency)) {

                    _interface = _interface[0];
                    for (var i = 1; i < dependency.length; ++i) {

                        if (typeof dependency[i] == "string") tags[key][dependency[i]] = true;else if (Array.isArray(dependency[i])) multiple[key] = true;else if (dependency[i]) Object.assign(tags[key], dependency[i]);
                    }
                }

                var ifid = knownInterfaces.indexOf(_interface);

                if (ifid == -1) ifid = registerInterface(_interface);

                injections[key] = ifid;

                dependencyCount++;
            }

            var provider = new Provide().setConcretion(clazz),
                proto = clazz.prototype;
            var providers = concretions[cid];

            provider.injections = injections;
            provider.dependencyCount = dependencyCount;

            provider.ctor = function (binds, args) {
                resolveDependencies(binds, this);
                clazz.apply(this, args);
            };
            provider.ctor.prototype = Object.create(clazz.prototype);
            provider.ctor.prototype.constructor = clazz;

            // provider.ctor = class extends clazz {
            //     constructor( args ){
            //         resolveDependencies( this ); // *sigh*
            //         super(...args);
            //     }
            // };

            function resolveDependencies(binds, obj) {
                var slotset = context[context.length - 1];
                for (var _key3 in injections) {
                    if (binds && injections[_key3] in binds) {
                        obj[_key3] = binds[injections[_key3]];
                        continue;
                    }

                    var slot = slotset[injections[_key3]];
                    var policy = slot.getViable(_key3, tags[_key3], multiple[_key3]);
                    if (!multiple[_key3]) obj[_key3] = policy([]);else {
                        var out = obj[_key3] = [];
                        for (var _i2 = 0; _i2 < policy.length; ++_i2) {
                            out[_i2] = policy[_i2]([]);
                        }
                    }
                }
            }
        }
    }]);

    return Inject;
}();

function inject(dependencies) {

    return new Inject(dependencies);
}

function getInstanceOf(_interface) {
    for (var _len3 = arguments.length, args = Array(_len3 > 1 ? _len3 - 1 : 0), _key4 = 1; _key4 < _len3; _key4++) {
        args[_key4 - 1] = arguments[_key4];
    }

    // let ifid = knownInterfaces.indexOf( _interface );
    // let slot = context[ context.length-1 ][ ifid ];

    // if( !slot )
    //     throw new Error("No providers for " + (_interface.name || _interface) + ". #467");

    // let policy = slot.getViable( _interface.name || _interface );

    // return policy.call( null, args );
    return getPolicy({ _interface: _interface, args: args });
}

function getPolicy(desc) {
    desc = desc || {};
    if (!desc._interface) throw new Error("Policy descriptor has no interface.");
    var name = desc._interface.name || desc._interface;
    var tags = desc.tags;
    var multiple = desc.multiple;
    var args = desc.args;

    var ifid = knownInterfaces.indexOf(desc._interface);
    var slot = context[context.length - 1][ifid];

    if (!slot) throw new Error("No providers for " + name + ". #467");

    var policy = slot.getViable(name, tags, multiple);
    if (args) {
        if (multiple) policy = policy.map(function (p) {
            return p.call(null, args);
        });else policy = policy.call(null, args);
    }
    return policy;
}

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
(function (global,Buffer){
/*!

JSZip v3.1.5 - A JavaScript class for generating and reading zip files
<http://stuartk.com/jszip>

(c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/master/LICENSE.markdown.

JSZip uses the library pako released under the MIT license :
https://github.com/nodeca/pako/blob/master/LICENSE
*/
!function(a){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=a();else if("function"==typeof define&&define.amd)define([],a);else{var b;b="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,b.JSZip=a()}}(function(){return function a(b,c,d){function e(g,h){if(!c[g]){if(!b[g]){var i="function"==typeof require&&require;if(!h&&i)return i(g,!0);if(f)return f(g,!0);var j=new Error("Cannot find module '"+g+"'");throw j.code="MODULE_NOT_FOUND",j}var k=c[g]={exports:{}};b[g][0].call(k.exports,function(a){var c=b[g][1][a];return e(c?c:a)},k,k.exports,a,b,c,d)}return c[g].exports}for(var f="function"==typeof require&&require,g=0;g<d.length;g++)e(d[g]);return e}({1:[function(a,b,c){"use strict";var d=a("./utils"),e=a("./support"),f="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";c.encode=function(a){for(var b,c,e,g,h,i,j,k=[],l=0,m=a.length,n=m,o="string"!==d.getTypeOf(a);l<a.length;)n=m-l,o?(b=a[l++],c=l<m?a[l++]:0,e=l<m?a[l++]:0):(b=a.charCodeAt(l++),c=l<m?a.charCodeAt(l++):0,e=l<m?a.charCodeAt(l++):0),g=b>>2,h=(3&b)<<4|c>>4,i=n>1?(15&c)<<2|e>>6:64,j=n>2?63&e:64,k.push(f.charAt(g)+f.charAt(h)+f.charAt(i)+f.charAt(j));return k.join("")},c.decode=function(a){var b,c,d,g,h,i,j,k=0,l=0,m="data:";if(a.substr(0,m.length)===m)throw new Error("Invalid base64 input, it looks like a data url.");a=a.replace(/[^A-Za-z0-9\+\/\=]/g,"");var n=3*a.length/4;if(a.charAt(a.length-1)===f.charAt(64)&&n--,a.charAt(a.length-2)===f.charAt(64)&&n--,n%1!==0)throw new Error("Invalid base64 input, bad content length.");var o;for(o=e.uint8array?new Uint8Array(0|n):new Array(0|n);k<a.length;)g=f.indexOf(a.charAt(k++)),h=f.indexOf(a.charAt(k++)),i=f.indexOf(a.charAt(k++)),j=f.indexOf(a.charAt(k++)),b=g<<2|h>>4,c=(15&h)<<4|i>>2,d=(3&i)<<6|j,o[l++]=b,64!==i&&(o[l++]=c),64!==j&&(o[l++]=d);return o}},{"./support":30,"./utils":32}],2:[function(a,b,c){"use strict";function d(a,b,c,d,e){this.compressedSize=a,this.uncompressedSize=b,this.crc32=c,this.compression=d,this.compressedContent=e}var e=a("./external"),f=a("./stream/DataWorker"),g=a("./stream/DataLengthProbe"),h=a("./stream/Crc32Probe"),g=a("./stream/DataLengthProbe");d.prototype={getContentWorker:function(){var a=new f(e.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new g("data_length")),b=this;return a.on("end",function(){if(this.streamInfo.data_length!==b.uncompressedSize)throw new Error("Bug : uncompressed data size mismatch")}),a},getCompressedWorker:function(){return new f(e.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize",this.compressedSize).withStreamInfo("uncompressedSize",this.uncompressedSize).withStreamInfo("crc32",this.crc32).withStreamInfo("compression",this.compression)}},d.createWorkerFrom=function(a,b,c){return a.pipe(new h).pipe(new g("uncompressedSize")).pipe(b.compressWorker(c)).pipe(new g("compressedSize")).withStreamInfo("compression",b)},b.exports=d},{"./external":6,"./stream/Crc32Probe":25,"./stream/DataLengthProbe":26,"./stream/DataWorker":27}],3:[function(a,b,c){"use strict";var d=a("./stream/GenericWorker");c.STORE={magic:"\0\0",compressWorker:function(a){return new d("STORE compression")},uncompressWorker:function(){return new d("STORE decompression")}},c.DEFLATE=a("./flate")},{"./flate":7,"./stream/GenericWorker":28}],4:[function(a,b,c){"use strict";function d(){for(var a,b=[],c=0;c<256;c++){a=c;for(var d=0;d<8;d++)a=1&a?3988292384^a>>>1:a>>>1;b[c]=a}return b}function e(a,b,c,d){var e=h,f=d+c;a^=-1;for(var g=d;g<f;g++)a=a>>>8^e[255&(a^b[g])];return a^-1}function f(a,b,c,d){var e=h,f=d+c;a^=-1;for(var g=d;g<f;g++)a=a>>>8^e[255&(a^b.charCodeAt(g))];return a^-1}var g=a("./utils"),h=d();b.exports=function(a,b){if("undefined"==typeof a||!a.length)return 0;var c="string"!==g.getTypeOf(a);return c?e(0|b,a,a.length,0):f(0|b,a,a.length,0)}},{"./utils":32}],5:[function(a,b,c){"use strict";c.base64=!1,c.binary=!1,c.dir=!1,c.createFolders=!0,c.date=null,c.compression=null,c.compressionOptions=null,c.comment=null,c.unixPermissions=null,c.dosPermissions=null},{}],6:[function(a,b,c){"use strict";var d=null;d="undefined"!=typeof Promise?Promise:a("lie"),b.exports={Promise:d}},{lie:58}],7:[function(a,b,c){"use strict";function d(a,b){h.call(this,"FlateWorker/"+a),this._pako=null,this._pakoAction=a,this._pakoOptions=b,this.meta={}}var e="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Uint32Array,f=a("pako"),g=a("./utils"),h=a("./stream/GenericWorker"),i=e?"uint8array":"array";c.magic="\b\0",g.inherits(d,h),d.prototype.processChunk=function(a){this.meta=a.meta,null===this._pako&&this._createPako(),this._pako.push(g.transformTo(i,a.data),!1)},d.prototype.flush=function(){h.prototype.flush.call(this),null===this._pako&&this._createPako(),this._pako.push([],!0)},d.prototype.cleanUp=function(){h.prototype.cleanUp.call(this),this._pako=null},d.prototype._createPako=function(){this._pako=new f[this._pakoAction]({raw:!0,level:this._pakoOptions.level||-1});var a=this;this._pako.onData=function(b){a.push({data:b,meta:a.meta})}},c.compressWorker=function(a){return new d("Deflate",a)},c.uncompressWorker=function(){return new d("Inflate",{})}},{"./stream/GenericWorker":28,"./utils":32,pako:59}],8:[function(a,b,c){"use strict";function d(a,b,c,d){f.call(this,"ZipFileWorker"),this.bytesWritten=0,this.zipComment=b,this.zipPlatform=c,this.encodeFileName=d,this.streamFiles=a,this.accumulate=!1,this.contentBuffer=[],this.dirRecords=[],this.currentSourceOffset=0,this.entriesCount=0,this.currentFile=null,this._sources=[]}var e=a("../utils"),f=a("../stream/GenericWorker"),g=a("../utf8"),h=a("../crc32"),i=a("../signature"),j=function(a,b){var c,d="";for(c=0;c<b;c++)d+=String.fromCharCode(255&a),a>>>=8;return d},k=function(a,b){var c=a;return a||(c=b?16893:33204),(65535&c)<<16},l=function(a,b){return 63&(a||0)},m=function(a,b,c,d,f,m){var n,o,p=a.file,q=a.compression,r=m!==g.utf8encode,s=e.transformTo("string",m(p.name)),t=e.transformTo("string",g.utf8encode(p.name)),u=p.comment,v=e.transformTo("string",m(u)),w=e.transformTo("string",g.utf8encode(u)),x=t.length!==p.name.length,y=w.length!==u.length,z="",A="",B="",C=p.dir,D=p.date,E={crc32:0,compressedSize:0,uncompressedSize:0};b&&!c||(E.crc32=a.crc32,E.compressedSize=a.compressedSize,E.uncompressedSize=a.uncompressedSize);var F=0;b&&(F|=8),r||!x&&!y||(F|=2048);var G=0,H=0;C&&(G|=16),"UNIX"===f?(H=798,G|=k(p.unixPermissions,C)):(H=20,G|=l(p.dosPermissions,C)),n=D.getUTCHours(),n<<=6,n|=D.getUTCMinutes(),n<<=5,n|=D.getUTCSeconds()/2,o=D.getUTCFullYear()-1980,o<<=4,o|=D.getUTCMonth()+1,o<<=5,o|=D.getUTCDate(),x&&(A=j(1,1)+j(h(s),4)+t,z+="up"+j(A.length,2)+A),y&&(B=j(1,1)+j(h(v),4)+w,z+="uc"+j(B.length,2)+B);var I="";I+="\n\0",I+=j(F,2),I+=q.magic,I+=j(n,2),I+=j(o,2),I+=j(E.crc32,4),I+=j(E.compressedSize,4),I+=j(E.uncompressedSize,4),I+=j(s.length,2),I+=j(z.length,2);var J=i.LOCAL_FILE_HEADER+I+s+z,K=i.CENTRAL_FILE_HEADER+j(H,2)+I+j(v.length,2)+"\0\0\0\0"+j(G,4)+j(d,4)+s+z+v;return{fileRecord:J,dirRecord:K}},n=function(a,b,c,d,f){var g="",h=e.transformTo("string",f(d));return g=i.CENTRAL_DIRECTORY_END+"\0\0\0\0"+j(a,2)+j(a,2)+j(b,4)+j(c,4)+j(h.length,2)+h},o=function(a){var b="";return b=i.DATA_DESCRIPTOR+j(a.crc32,4)+j(a.compressedSize,4)+j(a.uncompressedSize,4)};e.inherits(d,f),d.prototype.push=function(a){var b=a.meta.percent||0,c=this.entriesCount,d=this._sources.length;this.accumulate?this.contentBuffer.push(a):(this.bytesWritten+=a.data.length,f.prototype.push.call(this,{data:a.data,meta:{currentFile:this.currentFile,percent:c?(b+100*(c-d-1))/c:100}}))},d.prototype.openedSource=function(a){this.currentSourceOffset=this.bytesWritten,this.currentFile=a.file.name;var b=this.streamFiles&&!a.file.dir;if(b){var c=m(a,b,!1,this.currentSourceOffset,this.zipPlatform,this.encodeFileName);this.push({data:c.fileRecord,meta:{percent:0}})}else this.accumulate=!0},d.prototype.closedSource=function(a){this.accumulate=!1;var b=this.streamFiles&&!a.file.dir,c=m(a,b,!0,this.currentSourceOffset,this.zipPlatform,this.encodeFileName);if(this.dirRecords.push(c.dirRecord),b)this.push({data:o(a),meta:{percent:100}});else for(this.push({data:c.fileRecord,meta:{percent:0}});this.contentBuffer.length;)this.push(this.contentBuffer.shift());this.currentFile=null},d.prototype.flush=function(){for(var a=this.bytesWritten,b=0;b<this.dirRecords.length;b++)this.push({data:this.dirRecords[b],meta:{percent:100}});var c=this.bytesWritten-a,d=n(this.dirRecords.length,c,a,this.zipComment,this.encodeFileName);this.push({data:d,meta:{percent:100}})},d.prototype.prepareNextSource=function(){this.previous=this._sources.shift(),this.openedSource(this.previous.streamInfo),this.isPaused?this.previous.pause():this.previous.resume()},d.prototype.registerPrevious=function(a){this._sources.push(a);var b=this;return a.on("data",function(a){b.processChunk(a)}),a.on("end",function(){b.closedSource(b.previous.streamInfo),b._sources.length?b.prepareNextSource():b.end()}),a.on("error",function(a){b.error(a)}),this},d.prototype.resume=function(){return!!f.prototype.resume.call(this)&&(!this.previous&&this._sources.length?(this.prepareNextSource(),!0):this.previous||this._sources.length||this.generatedError?void 0:(this.end(),!0))},d.prototype.error=function(a){var b=this._sources;if(!f.prototype.error.call(this,a))return!1;for(var c=0;c<b.length;c++)try{b[c].error(a)}catch(a){}return!0},d.prototype.lock=function(){f.prototype.lock.call(this);for(var a=this._sources,b=0;b<a.length;b++)a[b].lock()},b.exports=d},{"../crc32":4,"../signature":23,"../stream/GenericWorker":28,"../utf8":31,"../utils":32}],9:[function(a,b,c){"use strict";var d=a("../compressions"),e=a("./ZipFileWorker"),f=function(a,b){var c=a||b,e=d[c];if(!e)throw new Error(c+" is not a valid compression method !");return e};c.generateWorker=function(a,b,c){var d=new e(b.streamFiles,c,b.platform,b.encodeFileName),g=0;try{a.forEach(function(a,c){g++;var e=f(c.options.compression,b.compression),h=c.options.compressionOptions||b.compressionOptions||{},i=c.dir,j=c.date;c._compressWorker(e,h).withStreamInfo("file",{name:a,dir:i,date:j,comment:c.comment||"",unixPermissions:c.unixPermissions,dosPermissions:c.dosPermissions}).pipe(d)}),d.entriesCount=g}catch(h){d.error(h)}return d}},{"../compressions":3,"./ZipFileWorker":8}],10:[function(a,b,c){"use strict";function d(){if(!(this instanceof d))return new d;if(arguments.length)throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");this.files={},this.comment=null,this.root="",this.clone=function(){var a=new d;for(var b in this)"function"!=typeof this[b]&&(a[b]=this[b]);return a}}d.prototype=a("./object"),d.prototype.loadAsync=a("./load"),d.support=a("./support"),d.defaults=a("./defaults"),d.version="3.1.5",d.loadAsync=function(a,b){return(new d).loadAsync(a,b)},d.external=a("./external"),b.exports=d},{"./defaults":5,"./external":6,"./load":11,"./object":15,"./support":30}],11:[function(a,b,c){"use strict";function d(a){return new f.Promise(function(b,c){var d=a.decompressed.getContentWorker().pipe(new i);d.on("error",function(a){c(a)}).on("end",function(){d.streamInfo.crc32!==a.decompressed.crc32?c(new Error("Corrupted zip : CRC32 mismatch")):b()}).resume()})}var e=a("./utils"),f=a("./external"),g=a("./utf8"),e=a("./utils"),h=a("./zipEntries"),i=a("./stream/Crc32Probe"),j=a("./nodejsUtils");b.exports=function(a,b){var c=this;return b=e.extend(b||{},{base64:!1,checkCRC32:!1,optimizedBinaryString:!1,createFolders:!1,decodeFileName:g.utf8decode}),j.isNode&&j.isStream(a)?f.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")):e.prepareContent("the loaded zip file",a,!0,b.optimizedBinaryString,b.base64).then(function(a){var c=new h(b);return c.load(a),c}).then(function(a){var c=[f.Promise.resolve(a)],e=a.files;if(b.checkCRC32)for(var g=0;g<e.length;g++)c.push(d(e[g]));return f.Promise.all(c)}).then(function(a){for(var d=a.shift(),e=d.files,f=0;f<e.length;f++){var g=e[f];c.file(g.fileNameStr,g.decompressed,{binary:!0,optimizedBinaryString:!0,date:g.date,dir:g.dir,comment:g.fileCommentStr.length?g.fileCommentStr:null,unixPermissions:g.unixPermissions,dosPermissions:g.dosPermissions,createFolders:b.createFolders})}return d.zipComment.length&&(c.comment=d.zipComment),c})}},{"./external":6,"./nodejsUtils":14,"./stream/Crc32Probe":25,"./utf8":31,"./utils":32,"./zipEntries":33}],12:[function(a,b,c){"use strict";function d(a,b){f.call(this,"Nodejs stream input adapter for "+a),this._upstreamEnded=!1,this._bindStream(b)}var e=a("../utils"),f=a("../stream/GenericWorker");e.inherits(d,f),d.prototype._bindStream=function(a){var b=this;this._stream=a,a.pause(),a.on("data",function(a){b.push({data:a,meta:{percent:0}})}).on("error",function(a){b.isPaused?this.generatedError=a:b.error(a)}).on("end",function(){b.isPaused?b._upstreamEnded=!0:b.end()})},d.prototype.pause=function(){return!!f.prototype.pause.call(this)&&(this._stream.pause(),!0)},d.prototype.resume=function(){return!!f.prototype.resume.call(this)&&(this._upstreamEnded?this.end():this._stream.resume(),!0)},b.exports=d},{"../stream/GenericWorker":28,"../utils":32}],13:[function(a,b,c){"use strict";function d(a,b,c){e.call(this,b),this._helper=a;var d=this;a.on("data",function(a,b){d.push(a)||d._helper.pause(),c&&c(b)}).on("error",function(a){d.emit("error",a)}).on("end",function(){d.push(null)})}var e=a("readable-stream").Readable,f=a("../utils");f.inherits(d,e),d.prototype._read=function(){this._helper.resume()},b.exports=d},{"../utils":32,"readable-stream":16}],14:[function(a,b,c){"use strict";b.exports={isNode:"undefined"!=typeof Buffer,newBufferFrom:function(a,b){return new Buffer(a,b)},allocBuffer:function(a){return Buffer.alloc?Buffer.alloc(a):new Buffer(a)},isBuffer:function(a){return Buffer.isBuffer(a)},isStream:function(a){return a&&"function"==typeof a.on&&"function"==typeof a.pause&&"function"==typeof a.resume}}},{}],15:[function(a,b,c){"use strict";function d(a){return"[object RegExp]"===Object.prototype.toString.call(a)}var e=a("./utf8"),f=a("./utils"),g=a("./stream/GenericWorker"),h=a("./stream/StreamHelper"),i=a("./defaults"),j=a("./compressedObject"),k=a("./zipObject"),l=a("./generate"),m=a("./nodejsUtils"),n=a("./nodejs/NodejsStreamInputAdapter"),o=function(a,b,c){var d,e=f.getTypeOf(b),h=f.extend(c||{},i);h.date=h.date||new Date,null!==h.compression&&(h.compression=h.compression.toUpperCase()),"string"==typeof h.unixPermissions&&(h.unixPermissions=parseInt(h.unixPermissions,8)),h.unixPermissions&&16384&h.unixPermissions&&(h.dir=!0),h.dosPermissions&&16&h.dosPermissions&&(h.dir=!0),h.dir&&(a=q(a)),h.createFolders&&(d=p(a))&&r.call(this,d,!0);var l="string"===e&&h.binary===!1&&h.base64===!1;c&&"undefined"!=typeof c.binary||(h.binary=!l);var o=b instanceof j&&0===b.uncompressedSize;(o||h.dir||!b||0===b.length)&&(h.base64=!1,h.binary=!0,b="",h.compression="STORE",e="string");var s=null;s=b instanceof j||b instanceof g?b:m.isNode&&m.isStream(b)?new n(a,b):f.prepareContent(a,b,h.binary,h.optimizedBinaryString,h.base64);var t=new k(a,s,h);this.files[a]=t},p=function(a){"/"===a.slice(-1)&&(a=a.substring(0,a.length-1));var b=a.lastIndexOf("/");return b>0?a.substring(0,b):""},q=function(a){return"/"!==a.slice(-1)&&(a+="/"),a},r=function(a,b){return b="undefined"!=typeof b?b:i.createFolders,a=q(a),this.files[a]||o.call(this,a,null,{dir:!0,createFolders:b}),this.files[a]},s={load:function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},forEach:function(a){var b,c,d;for(b in this.files)this.files.hasOwnProperty(b)&&(d=this.files[b],c=b.slice(this.root.length,b.length),c&&b.slice(0,this.root.length)===this.root&&a(c,d))},filter:function(a){var b=[];return this.forEach(function(c,d){a(c,d)&&b.push(d)}),b},file:function(a,b,c){if(1===arguments.length){if(d(a)){var e=a;return this.filter(function(a,b){return!b.dir&&e.test(a)})}var f=this.files[this.root+a];return f&&!f.dir?f:null}return a=this.root+a,o.call(this,a,b,c),this},folder:function(a){if(!a)return this;if(d(a))return this.filter(function(b,c){return c.dir&&a.test(b)});var b=this.root+a,c=r.call(this,b),e=this.clone();return e.root=c.name,e},remove:function(a){a=this.root+a;var b=this.files[a];if(b||("/"!==a.slice(-1)&&(a+="/"),b=this.files[a]),b&&!b.dir)delete this.files[a];else for(var c=this.filter(function(b,c){return c.name.slice(0,a.length)===a}),d=0;d<c.length;d++)delete this.files[c[d].name];return this},generate:function(a){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},generateInternalStream:function(a){var b,c={};try{if(c=f.extend(a||{},{streamFiles:!1,compression:"STORE",compressionOptions:null,type:"",platform:"DOS",comment:null,mimeType:"application/zip",encodeFileName:e.utf8encode}),c.type=c.type.toLowerCase(),c.compression=c.compression.toUpperCase(),"binarystring"===c.type&&(c.type="string"),!c.type)throw new Error("No output type specified.");f.checkSupport(c.type),"darwin"!==c.platform&&"freebsd"!==c.platform&&"linux"!==c.platform&&"sunos"!==c.platform||(c.platform="UNIX"),"win32"===c.platform&&(c.platform="DOS");var d=c.comment||this.comment||"";b=l.generateWorker(this,c,d)}catch(i){b=new g("error"),b.error(i)}return new h(b,c.type||"string",c.mimeType)},generateAsync:function(a,b){return this.generateInternalStream(a).accumulate(b)},generateNodeStream:function(a,b){return a=a||{},a.type||(a.type="nodebuffer"),this.generateInternalStream(a).toNodejsStream(b)}};b.exports=s},{"./compressedObject":2,"./defaults":5,"./generate":9,"./nodejs/NodejsStreamInputAdapter":12,"./nodejsUtils":14,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31,"./utils":32,"./zipObject":35}],16:[function(a,b,c){b.exports=a("stream")},{stream:void 0}],17:[function(a,b,c){"use strict";function d(a){e.call(this,a);for(var b=0;b<this.data.length;b++)a[b]=255&a[b]}var e=a("./DataReader"),f=a("../utils");f.inherits(d,e),d.prototype.byteAt=function(a){return this.data[this.zero+a]},d.prototype.lastIndexOfSignature=function(a){for(var b=a.charCodeAt(0),c=a.charCodeAt(1),d=a.charCodeAt(2),e=a.charCodeAt(3),f=this.length-4;f>=0;--f)if(this.data[f]===b&&this.data[f+1]===c&&this.data[f+2]===d&&this.data[f+3]===e)return f-this.zero;return-1},d.prototype.readAndCheckSignature=function(a){var b=a.charCodeAt(0),c=a.charCodeAt(1),d=a.charCodeAt(2),e=a.charCodeAt(3),f=this.readData(4);return b===f[0]&&c===f[1]&&d===f[2]&&e===f[3]},d.prototype.readData=function(a){if(this.checkOffset(a),0===a)return[];var b=this.data.slice(this.zero+this.index,this.zero+this.index+a);return this.index+=a,b},b.exports=d},{"../utils":32,"./DataReader":18}],18:[function(a,b,c){"use strict";function d(a){this.data=a,this.length=a.length,this.index=0,this.zero=0}var e=a("../utils");d.prototype={checkOffset:function(a){this.checkIndex(this.index+a)},checkIndex:function(a){if(this.length<this.zero+a||a<0)throw new Error("End of data reached (data length = "+this.length+", asked index = "+a+"). Corrupted zip ?")},setIndex:function(a){this.checkIndex(a),this.index=a},skip:function(a){this.setIndex(this.index+a)},byteAt:function(a){},readInt:function(a){var b,c=0;for(this.checkOffset(a),b=this.index+a-1;b>=this.index;b--)c=(c<<8)+this.byteAt(b);return this.index+=a,c},readString:function(a){return e.transformTo("string",this.readData(a))},readData:function(a){},lastIndexOfSignature:function(a){},readAndCheckSignature:function(a){},readDate:function(){var a=this.readInt(4);return new Date(Date.UTC((a>>25&127)+1980,(a>>21&15)-1,a>>16&31,a>>11&31,a>>5&63,(31&a)<<1))}},b.exports=d},{"../utils":32}],19:[function(a,b,c){"use strict";function d(a){e.call(this,a)}var e=a("./Uint8ArrayReader"),f=a("../utils");f.inherits(d,e),d.prototype.readData=function(a){this.checkOffset(a);var b=this.data.slice(this.zero+this.index,this.zero+this.index+a);return this.index+=a,b},b.exports=d},{"../utils":32,"./Uint8ArrayReader":21}],20:[function(a,b,c){"use strict";function d(a){e.call(this,a)}var e=a("./DataReader"),f=a("../utils");f.inherits(d,e),d.prototype.byteAt=function(a){return this.data.charCodeAt(this.zero+a)},d.prototype.lastIndexOfSignature=function(a){return this.data.lastIndexOf(a)-this.zero},d.prototype.readAndCheckSignature=function(a){var b=this.readData(4);return a===b},d.prototype.readData=function(a){this.checkOffset(a);var b=this.data.slice(this.zero+this.index,this.zero+this.index+a);return this.index+=a,b},b.exports=d},{"../utils":32,"./DataReader":18}],21:[function(a,b,c){"use strict";function d(a){e.call(this,a)}var e=a("./ArrayReader"),f=a("../utils");f.inherits(d,e),d.prototype.readData=function(a){if(this.checkOffset(a),0===a)return new Uint8Array(0);var b=this.data.subarray(this.zero+this.index,this.zero+this.index+a);return this.index+=a,b},b.exports=d},{"../utils":32,"./ArrayReader":17}],22:[function(a,b,c){"use strict";var d=a("../utils"),e=a("../support"),f=a("./ArrayReader"),g=a("./StringReader"),h=a("./NodeBufferReader"),i=a("./Uint8ArrayReader");b.exports=function(a){var b=d.getTypeOf(a);return d.checkSupport(b),"string"!==b||e.uint8array?"nodebuffer"===b?new h(a):e.uint8array?new i(d.transformTo("uint8array",a)):new f(d.transformTo("array",a)):new g(a)}},{"../support":30,"../utils":32,"./ArrayReader":17,"./NodeBufferReader":19,"./StringReader":20,"./Uint8ArrayReader":21}],23:[function(a,b,c){"use strict";c.LOCAL_FILE_HEADER="PK",c.CENTRAL_FILE_HEADER="PK",c.CENTRAL_DIRECTORY_END="PK",c.ZIP64_CENTRAL_DIRECTORY_LOCATOR="PK",c.ZIP64_CENTRAL_DIRECTORY_END="PK",c.DATA_DESCRIPTOR="PK\b"},{}],24:[function(a,b,c){"use strict";function d(a){e.call(this,"ConvertWorker to "+a),this.destType=a}var e=a("./GenericWorker"),f=a("../utils");f.inherits(d,e),d.prototype.processChunk=function(a){this.push({data:f.transformTo(this.destType,a.data),meta:a.meta})},b.exports=d},{"../utils":32,"./GenericWorker":28}],25:[function(a,b,c){"use strict";function d(){e.call(this,"Crc32Probe"),this.withStreamInfo("crc32",0)}var e=a("./GenericWorker"),f=a("../crc32"),g=a("../utils");g.inherits(d,e),d.prototype.processChunk=function(a){this.streamInfo.crc32=f(a.data,this.streamInfo.crc32||0),this.push(a)},b.exports=d},{"../crc32":4,"../utils":32,"./GenericWorker":28}],26:[function(a,b,c){"use strict";function d(a){f.call(this,"DataLengthProbe for "+a),this.propName=a,this.withStreamInfo(a,0)}var e=a("../utils"),f=a("./GenericWorker");e.inherits(d,f),d.prototype.processChunk=function(a){if(a){var b=this.streamInfo[this.propName]||0;this.streamInfo[this.propName]=b+a.data.length}f.prototype.processChunk.call(this,a)},b.exports=d},{"../utils":32,"./GenericWorker":28}],27:[function(a,b,c){"use strict";function d(a){f.call(this,"DataWorker");var b=this;this.dataIsReady=!1,this.index=0,this.max=0,this.data=null,this.type="",this._tickScheduled=!1,a.then(function(a){b.dataIsReady=!0,b.data=a,b.max=a&&a.length||0,b.type=e.getTypeOf(a),b.isPaused||b._tickAndRepeat()},function(a){b.error(a)})}var e=a("../utils"),f=a("./GenericWorker"),g=16384;e.inherits(d,f),d.prototype.cleanUp=function(){f.prototype.cleanUp.call(this),this.data=null},d.prototype.resume=function(){return!!f.prototype.resume.call(this)&&(!this._tickScheduled&&this.dataIsReady&&(this._tickScheduled=!0,e.delay(this._tickAndRepeat,[],this)),!0)},d.prototype._tickAndRepeat=function(){this._tickScheduled=!1,this.isPaused||this.isFinished||(this._tick(),this.isFinished||(e.delay(this._tickAndRepeat,[],this),this._tickScheduled=!0))},d.prototype._tick=function(){if(this.isPaused||this.isFinished)return!1;var a=g,b=null,c=Math.min(this.max,this.index+a);if(this.index>=this.max)return this.end();switch(this.type){case"string":b=this.data.substring(this.index,c);break;case"uint8array":b=this.data.subarray(this.index,c);break;case"array":case"nodebuffer":b=this.data.slice(this.index,c)}return this.index=c,this.push({data:b,meta:{percent:this.max?this.index/this.max*100:0}})},b.exports=d},{"../utils":32,"./GenericWorker":28}],28:[function(a,b,c){"use strict";function d(a){this.name=a||"default",this.streamInfo={},this.generatedError=null,this.extraStreamInfo={},this.isPaused=!0,this.isFinished=!1,this.isLocked=!1,this._listeners={data:[],end:[],error:[]},this.previous=null}d.prototype={push:function(a){this.emit("data",a)},end:function(){if(this.isFinished)return!1;this.flush();try{this.emit("end"),this.cleanUp(),this.isFinished=!0}catch(a){this.emit("error",a)}return!0},error:function(a){return!this.isFinished&&(this.isPaused?this.generatedError=a:(this.isFinished=!0,this.emit("error",a),this.previous&&this.previous.error(a),this.cleanUp()),!0)},on:function(a,b){return this._listeners[a].push(b),this},cleanUp:function(){this.streamInfo=this.generatedError=this.extraStreamInfo=null,this._listeners=[]},emit:function(a,b){if(this._listeners[a])for(var c=0;c<this._listeners[a].length;c++)this._listeners[a][c].call(this,b)},pipe:function(a){return a.registerPrevious(this)},registerPrevious:function(a){if(this.isLocked)throw new Error("The stream '"+this+"' has already been used.");this.streamInfo=a.streamInfo,this.mergeStreamInfo(),this.previous=a;var b=this;return a.on("data",function(a){b.processChunk(a)}),a.on("end",function(){b.end()}),a.on("error",function(a){b.error(a)}),this},pause:function(){return!this.isPaused&&!this.isFinished&&(this.isPaused=!0,this.previous&&this.previous.pause(),!0)},resume:function(){if(!this.isPaused||this.isFinished)return!1;this.isPaused=!1;var a=!1;return this.generatedError&&(this.error(this.generatedError),a=!0),this.previous&&this.previous.resume(),!a},flush:function(){},processChunk:function(a){this.push(a)},withStreamInfo:function(a,b){return this.extraStreamInfo[a]=b,this.mergeStreamInfo(),this},mergeStreamInfo:function(){for(var a in this.extraStreamInfo)this.extraStreamInfo.hasOwnProperty(a)&&(this.streamInfo[a]=this.extraStreamInfo[a])},lock:function(){if(this.isLocked)throw new Error("The stream '"+this+"' has already been used.");this.isLocked=!0,this.previous&&this.previous.lock()},toString:function(){var a="Worker "+this.name;return this.previous?this.previous+" -> "+a:a}},b.exports=d},{}],29:[function(a,b,c){"use strict";function d(a,b,c){switch(a){case"blob":return h.newBlob(h.transformTo("arraybuffer",b),c);case"base64":return k.encode(b);default:return h.transformTo(a,b)}}function e(a,b){var c,d=0,e=null,f=0;for(c=0;c<b.length;c++)f+=b[c].length;switch(a){case"string":return b.join("");case"array":return Array.prototype.concat.apply([],b);case"uint8array":for(e=new Uint8Array(f),c=0;c<b.length;c++)e.set(b[c],d),d+=b[c].length;return e;case"nodebuffer":return Buffer.concat(b);default:throw new Error("concat : unsupported type '"+a+"'")}}function f(a,b){return new m.Promise(function(c,f){var g=[],h=a._internalType,i=a._outputType,j=a._mimeType;a.on("data",function(a,c){g.push(a),b&&b(c)}).on("error",function(a){g=[],f(a)}).on("end",function(){try{var a=d(i,e(h,g),j);c(a)}catch(b){f(b)}g=[]}).resume()})}function g(a,b,c){var d=b;switch(b){case"blob":case"arraybuffer":d="uint8array";break;case"base64":d="string"}try{this._internalType=d,this._outputType=b,this._mimeType=c,h.checkSupport(d),this._worker=a.pipe(new i(d)),a.lock()}catch(e){this._worker=new j("error"),this._worker.error(e)}}var h=a("../utils"),i=a("./ConvertWorker"),j=a("./GenericWorker"),k=a("../base64"),l=a("../support"),m=a("../external"),n=null;if(l.nodestream)try{n=a("../nodejs/NodejsStreamOutputAdapter")}catch(o){}g.prototype={accumulate:function(a){return f(this,a)},on:function(a,b){var c=this;return"data"===a?this._worker.on(a,function(a){b.call(c,a.data,a.meta)}):this._worker.on(a,function(){h.delay(b,arguments,c)}),this},resume:function(){return h.delay(this._worker.resume,[],this._worker),this},pause:function(){return this._worker.pause(),this},toNodejsStream:function(a){if(h.checkSupport("nodestream"),"nodebuffer"!==this._outputType)throw new Error(this._outputType+" is not supported by this method");return new n(this,{objectMode:"nodebuffer"!==this._outputType},a)}},b.exports=g},{"../base64":1,"../external":6,"../nodejs/NodejsStreamOutputAdapter":13,"../support":30,"../utils":32,"./ConvertWorker":24,"./GenericWorker":28}],30:[function(a,b,c){"use strict";if(c.base64=!0,c.array=!0,c.string=!0,c.arraybuffer="undefined"!=typeof ArrayBuffer&&"undefined"!=typeof Uint8Array,c.nodebuffer="undefined"!=typeof Buffer,c.uint8array="undefined"!=typeof Uint8Array,"undefined"==typeof ArrayBuffer)c.blob=!1;else{var d=new ArrayBuffer(0);try{c.blob=0===new Blob([d],{type:"application/zip"}).size}catch(e){try{var f=self.BlobBuilder||self.WebKitBlobBuilder||self.MozBlobBuilder||self.MSBlobBuilder,g=new f;g.append(d),c.blob=0===g.getBlob("application/zip").size}catch(e){c.blob=!1}}}try{c.nodestream=!!a("readable-stream").Readable}catch(e){c.nodestream=!1}},{"readable-stream":16}],31:[function(a,b,c){"use strict";function d(){i.call(this,"utf-8 decode"),this.leftOver=null}function e(){i.call(this,"utf-8 encode")}for(var f=a("./utils"),g=a("./support"),h=a("./nodejsUtils"),i=a("./stream/GenericWorker"),j=new Array(256),k=0;k<256;k++)j[k]=k>=252?6:k>=248?5:k>=240?4:k>=224?3:k>=192?2:1;j[254]=j[254]=1;var l=function(a){var b,c,d,e,f,h=a.length,i=0;for(e=0;e<h;e++)c=a.charCodeAt(e),55296===(64512&c)&&e+1<h&&(d=a.charCodeAt(e+1),56320===(64512&d)&&(c=65536+(c-55296<<10)+(d-56320),e++)),i+=c<128?1:c<2048?2:c<65536?3:4;for(b=g.uint8array?new Uint8Array(i):new Array(i),f=0,e=0;f<i;e++)c=a.charCodeAt(e),55296===(64512&c)&&e+1<h&&(d=a.charCodeAt(e+1),56320===(64512&d)&&(c=65536+(c-55296<<10)+(d-56320),e++)),c<128?b[f++]=c:c<2048?(b[f++]=192|c>>>6,b[f++]=128|63&c):c<65536?(b[f++]=224|c>>>12,b[f++]=128|c>>>6&63,b[f++]=128|63&c):(b[f++]=240|c>>>18,b[f++]=128|c>>>12&63,b[f++]=128|c>>>6&63,b[f++]=128|63&c);return b},m=function(a,b){var c;for(b=b||a.length,b>a.length&&(b=a.length),c=b-1;c>=0&&128===(192&a[c]);)c--;return c<0?b:0===c?b:c+j[a[c]]>b?c:b},n=function(a){var b,c,d,e,g=a.length,h=new Array(2*g);for(c=0,b=0;b<g;)if(d=a[b++],d<128)h[c++]=d;else if(e=j[d],e>4)h[c++]=65533,b+=e-1;else{for(d&=2===e?31:3===e?15:7;e>1&&b<g;)d=d<<6|63&a[b++],e--;e>1?h[c++]=65533:d<65536?h[c++]=d:(d-=65536,h[c++]=55296|d>>10&1023,h[c++]=56320|1023&d)}return h.length!==c&&(h.subarray?h=h.subarray(0,c):h.length=c),f.applyFromCharCode(h)};c.utf8encode=function(a){return g.nodebuffer?h.newBufferFrom(a,"utf-8"):l(a)},c.utf8decode=function(a){return g.nodebuffer?f.transformTo("nodebuffer",a).toString("utf-8"):(a=f.transformTo(g.uint8array?"uint8array":"array",a),n(a))},f.inherits(d,i),d.prototype.processChunk=function(a){var b=f.transformTo(g.uint8array?"uint8array":"array",a.data);if(this.leftOver&&this.leftOver.length){if(g.uint8array){var d=b;b=new Uint8Array(d.length+this.leftOver.length),b.set(this.leftOver,0),b.set(d,this.leftOver.length)}else b=this.leftOver.concat(b);this.leftOver=null}var e=m(b),h=b;e!==b.length&&(g.uint8array?(h=b.subarray(0,e),this.leftOver=b.subarray(e,b.length)):(h=b.slice(0,e),this.leftOver=b.slice(e,b.length))),this.push({data:c.utf8decode(h),meta:a.meta})},d.prototype.flush=function(){this.leftOver&&this.leftOver.length&&(this.push({data:c.utf8decode(this.leftOver),meta:{}}),this.leftOver=null)},c.Utf8DecodeWorker=d,f.inherits(e,i),e.prototype.processChunk=function(a){this.push({data:c.utf8encode(a.data),meta:a.meta})},c.Utf8EncodeWorker=e},{"./nodejsUtils":14,"./stream/GenericWorker":28,"./support":30,"./utils":32}],32:[function(a,b,c){"use strict";function d(a){var b=null;return b=i.uint8array?new Uint8Array(a.length):new Array(a.length),f(a,b)}function e(a){return a}function f(a,b){for(var c=0;c<a.length;++c)b[c]=255&a.charCodeAt(c);return b}function g(a){var b=65536,d=c.getTypeOf(a),e=!0;if("uint8array"===d?e=n.applyCanBeUsed.uint8array:"nodebuffer"===d&&(e=n.applyCanBeUsed.nodebuffer),e)for(;b>1;)try{return n.stringifyByChunk(a,d,b)}catch(f){b=Math.floor(b/2)}return n.stringifyByChar(a)}function h(a,b){for(var c=0;c<a.length;c++)b[c]=a[c];
return b}var i=a("./support"),j=a("./base64"),k=a("./nodejsUtils"),l=a("core-js/library/fn/set-immediate"),m=a("./external");c.newBlob=function(a,b){c.checkSupport("blob");try{return new Blob([a],{type:b})}catch(d){try{var e=self.BlobBuilder||self.WebKitBlobBuilder||self.MozBlobBuilder||self.MSBlobBuilder,f=new e;return f.append(a),f.getBlob(b)}catch(d){throw new Error("Bug : can't construct the Blob.")}}};var n={stringifyByChunk:function(a,b,c){var d=[],e=0,f=a.length;if(f<=c)return String.fromCharCode.apply(null,a);for(;e<f;)"array"===b||"nodebuffer"===b?d.push(String.fromCharCode.apply(null,a.slice(e,Math.min(e+c,f)))):d.push(String.fromCharCode.apply(null,a.subarray(e,Math.min(e+c,f)))),e+=c;return d.join("")},stringifyByChar:function(a){for(var b="",c=0;c<a.length;c++)b+=String.fromCharCode(a[c]);return b},applyCanBeUsed:{uint8array:function(){try{return i.uint8array&&1===String.fromCharCode.apply(null,new Uint8Array(1)).length}catch(a){return!1}}(),nodebuffer:function(){try{return i.nodebuffer&&1===String.fromCharCode.apply(null,k.allocBuffer(1)).length}catch(a){return!1}}()}};c.applyFromCharCode=g;var o={};o.string={string:e,array:function(a){return f(a,new Array(a.length))},arraybuffer:function(a){return o.string.uint8array(a).buffer},uint8array:function(a){return f(a,new Uint8Array(a.length))},nodebuffer:function(a){return f(a,k.allocBuffer(a.length))}},o.array={string:g,array:e,arraybuffer:function(a){return new Uint8Array(a).buffer},uint8array:function(a){return new Uint8Array(a)},nodebuffer:function(a){return k.newBufferFrom(a)}},o.arraybuffer={string:function(a){return g(new Uint8Array(a))},array:function(a){return h(new Uint8Array(a),new Array(a.byteLength))},arraybuffer:e,uint8array:function(a){return new Uint8Array(a)},nodebuffer:function(a){return k.newBufferFrom(new Uint8Array(a))}},o.uint8array={string:g,array:function(a){return h(a,new Array(a.length))},arraybuffer:function(a){return a.buffer},uint8array:e,nodebuffer:function(a){return k.newBufferFrom(a)}},o.nodebuffer={string:g,array:function(a){return h(a,new Array(a.length))},arraybuffer:function(a){return o.nodebuffer.uint8array(a).buffer},uint8array:function(a){return h(a,new Uint8Array(a.length))},nodebuffer:e},c.transformTo=function(a,b){if(b||(b=""),!a)return b;c.checkSupport(a);var d=c.getTypeOf(b),e=o[d][a](b);return e},c.getTypeOf=function(a){return"string"==typeof a?"string":"[object Array]"===Object.prototype.toString.call(a)?"array":i.nodebuffer&&k.isBuffer(a)?"nodebuffer":i.uint8array&&a instanceof Uint8Array?"uint8array":i.arraybuffer&&a instanceof ArrayBuffer?"arraybuffer":void 0},c.checkSupport=function(a){var b=i[a.toLowerCase()];if(!b)throw new Error(a+" is not supported by this platform")},c.MAX_VALUE_16BITS=65535,c.MAX_VALUE_32BITS=-1,c.pretty=function(a){var b,c,d="";for(c=0;c<(a||"").length;c++)b=a.charCodeAt(c),d+="\\x"+(b<16?"0":"")+b.toString(16).toUpperCase();return d},c.delay=function(a,b,c){l(function(){a.apply(c||null,b||[])})},c.inherits=function(a,b){var c=function(){};c.prototype=b.prototype,a.prototype=new c},c.extend=function(){var a,b,c={};for(a=0;a<arguments.length;a++)for(b in arguments[a])arguments[a].hasOwnProperty(b)&&"undefined"==typeof c[b]&&(c[b]=arguments[a][b]);return c},c.prepareContent=function(a,b,e,f,g){var h=m.Promise.resolve(b).then(function(a){var b=i.blob&&(a instanceof Blob||["[object File]","[object Blob]"].indexOf(Object.prototype.toString.call(a))!==-1);return b&&"undefined"!=typeof FileReader?new m.Promise(function(b,c){var d=new FileReader;d.onload=function(a){b(a.target.result)},d.onerror=function(a){c(a.target.error)},d.readAsArrayBuffer(a)}):a});return h.then(function(b){var h=c.getTypeOf(b);return h?("arraybuffer"===h?b=c.transformTo("uint8array",b):"string"===h&&(g?b=j.decode(b):e&&f!==!0&&(b=d(b))),b):m.Promise.reject(new Error("Can't read the data of '"+a+"'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"))})}},{"./base64":1,"./external":6,"./nodejsUtils":14,"./support":30,"core-js/library/fn/set-immediate":36}],33:[function(a,b,c){"use strict";function d(a){this.files=[],this.loadOptions=a}var e=a("./reader/readerFor"),f=a("./utils"),g=a("./signature"),h=a("./zipEntry"),i=(a("./utf8"),a("./support"));d.prototype={checkSignature:function(a){if(!this.reader.readAndCheckSignature(a)){this.reader.index-=4;var b=this.reader.readString(4);throw new Error("Corrupted zip or bug: unexpected signature ("+f.pretty(b)+", expected "+f.pretty(a)+")")}},isSignature:function(a,b){var c=this.reader.index;this.reader.setIndex(a);var d=this.reader.readString(4),e=d===b;return this.reader.setIndex(c),e},readBlockEndOfCentral:function(){this.diskNumber=this.reader.readInt(2),this.diskWithCentralDirStart=this.reader.readInt(2),this.centralDirRecordsOnThisDisk=this.reader.readInt(2),this.centralDirRecords=this.reader.readInt(2),this.centralDirSize=this.reader.readInt(4),this.centralDirOffset=this.reader.readInt(4),this.zipCommentLength=this.reader.readInt(2);var a=this.reader.readData(this.zipCommentLength),b=i.uint8array?"uint8array":"array",c=f.transformTo(b,a);this.zipComment=this.loadOptions.decodeFileName(c)},readBlockZip64EndOfCentral:function(){this.zip64EndOfCentralSize=this.reader.readInt(8),this.reader.skip(4),this.diskNumber=this.reader.readInt(4),this.diskWithCentralDirStart=this.reader.readInt(4),this.centralDirRecordsOnThisDisk=this.reader.readInt(8),this.centralDirRecords=this.reader.readInt(8),this.centralDirSize=this.reader.readInt(8),this.centralDirOffset=this.reader.readInt(8),this.zip64ExtensibleData={};for(var a,b,c,d=this.zip64EndOfCentralSize-44,e=0;e<d;)a=this.reader.readInt(2),b=this.reader.readInt(4),c=this.reader.readData(b),this.zip64ExtensibleData[a]={id:a,length:b,value:c}},readBlockZip64EndOfCentralLocator:function(){if(this.diskWithZip64CentralDirStart=this.reader.readInt(4),this.relativeOffsetEndOfZip64CentralDir=this.reader.readInt(8),this.disksCount=this.reader.readInt(4),this.disksCount>1)throw new Error("Multi-volumes zip are not supported")},readLocalFiles:function(){var a,b;for(a=0;a<this.files.length;a++)b=this.files[a],this.reader.setIndex(b.localHeaderOffset),this.checkSignature(g.LOCAL_FILE_HEADER),b.readLocalPart(this.reader),b.handleUTF8(),b.processAttributes()},readCentralDir:function(){var a;for(this.reader.setIndex(this.centralDirOffset);this.reader.readAndCheckSignature(g.CENTRAL_FILE_HEADER);)a=new h({zip64:this.zip64},this.loadOptions),a.readCentralPart(this.reader),this.files.push(a);if(this.centralDirRecords!==this.files.length&&0!==this.centralDirRecords&&0===this.files.length)throw new Error("Corrupted zip or bug: expected "+this.centralDirRecords+" records in central dir, got "+this.files.length)},readEndOfCentral:function(){var a=this.reader.lastIndexOfSignature(g.CENTRAL_DIRECTORY_END);if(a<0){var b=!this.isSignature(0,g.LOCAL_FILE_HEADER);throw b?new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html"):new Error("Corrupted zip: can't find end of central directory")}this.reader.setIndex(a);var c=a;if(this.checkSignature(g.CENTRAL_DIRECTORY_END),this.readBlockEndOfCentral(),this.diskNumber===f.MAX_VALUE_16BITS||this.diskWithCentralDirStart===f.MAX_VALUE_16BITS||this.centralDirRecordsOnThisDisk===f.MAX_VALUE_16BITS||this.centralDirRecords===f.MAX_VALUE_16BITS||this.centralDirSize===f.MAX_VALUE_32BITS||this.centralDirOffset===f.MAX_VALUE_32BITS){if(this.zip64=!0,a=this.reader.lastIndexOfSignature(g.ZIP64_CENTRAL_DIRECTORY_LOCATOR),a<0)throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");if(this.reader.setIndex(a),this.checkSignature(g.ZIP64_CENTRAL_DIRECTORY_LOCATOR),this.readBlockZip64EndOfCentralLocator(),!this.isSignature(this.relativeOffsetEndOfZip64CentralDir,g.ZIP64_CENTRAL_DIRECTORY_END)&&(this.relativeOffsetEndOfZip64CentralDir=this.reader.lastIndexOfSignature(g.ZIP64_CENTRAL_DIRECTORY_END),this.relativeOffsetEndOfZip64CentralDir<0))throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir),this.checkSignature(g.ZIP64_CENTRAL_DIRECTORY_END),this.readBlockZip64EndOfCentral()}var d=this.centralDirOffset+this.centralDirSize;this.zip64&&(d+=20,d+=12+this.zip64EndOfCentralSize);var e=c-d;if(e>0)this.isSignature(c,g.CENTRAL_FILE_HEADER)||(this.reader.zero=e);else if(e<0)throw new Error("Corrupted zip: missing "+Math.abs(e)+" bytes.")},prepareReader:function(a){this.reader=e(a)},load:function(a){this.prepareReader(a),this.readEndOfCentral(),this.readCentralDir(),this.readLocalFiles()}},b.exports=d},{"./reader/readerFor":22,"./signature":23,"./support":30,"./utf8":31,"./utils":32,"./zipEntry":34}],34:[function(a,b,c){"use strict";function d(a,b){this.options=a,this.loadOptions=b}var e=a("./reader/readerFor"),f=a("./utils"),g=a("./compressedObject"),h=a("./crc32"),i=a("./utf8"),j=a("./compressions"),k=a("./support"),l=0,m=3,n=function(a){for(var b in j)if(j.hasOwnProperty(b)&&j[b].magic===a)return j[b];return null};d.prototype={isEncrypted:function(){return 1===(1&this.bitFlag)},useUTF8:function(){return 2048===(2048&this.bitFlag)},readLocalPart:function(a){var b,c;if(a.skip(22),this.fileNameLength=a.readInt(2),c=a.readInt(2),this.fileName=a.readData(this.fileNameLength),a.skip(c),this.compressedSize===-1||this.uncompressedSize===-1)throw new Error("Bug or corrupted zip : didn't get enough informations from the central directory (compressedSize === -1 || uncompressedSize === -1)");if(b=n(this.compressionMethod),null===b)throw new Error("Corrupted zip : compression "+f.pretty(this.compressionMethod)+" unknown (inner file : "+f.transformTo("string",this.fileName)+")");this.decompressed=new g(this.compressedSize,this.uncompressedSize,this.crc32,b,a.readData(this.compressedSize))},readCentralPart:function(a){this.versionMadeBy=a.readInt(2),a.skip(2),this.bitFlag=a.readInt(2),this.compressionMethod=a.readString(2),this.date=a.readDate(),this.crc32=a.readInt(4),this.compressedSize=a.readInt(4),this.uncompressedSize=a.readInt(4);var b=a.readInt(2);if(this.extraFieldsLength=a.readInt(2),this.fileCommentLength=a.readInt(2),this.diskNumberStart=a.readInt(2),this.internalFileAttributes=a.readInt(2),this.externalFileAttributes=a.readInt(4),this.localHeaderOffset=a.readInt(4),this.isEncrypted())throw new Error("Encrypted zip are not supported");a.skip(b),this.readExtraFields(a),this.parseZIP64ExtraField(a),this.fileComment=a.readData(this.fileCommentLength)},processAttributes:function(){this.unixPermissions=null,this.dosPermissions=null;var a=this.versionMadeBy>>8;this.dir=!!(16&this.externalFileAttributes),a===l&&(this.dosPermissions=63&this.externalFileAttributes),a===m&&(this.unixPermissions=this.externalFileAttributes>>16&65535),this.dir||"/"!==this.fileNameStr.slice(-1)||(this.dir=!0)},parseZIP64ExtraField:function(a){if(this.extraFields[1]){var b=e(this.extraFields[1].value);this.uncompressedSize===f.MAX_VALUE_32BITS&&(this.uncompressedSize=b.readInt(8)),this.compressedSize===f.MAX_VALUE_32BITS&&(this.compressedSize=b.readInt(8)),this.localHeaderOffset===f.MAX_VALUE_32BITS&&(this.localHeaderOffset=b.readInt(8)),this.diskNumberStart===f.MAX_VALUE_32BITS&&(this.diskNumberStart=b.readInt(4))}},readExtraFields:function(a){var b,c,d,e=a.index+this.extraFieldsLength;for(this.extraFields||(this.extraFields={});a.index<e;)b=a.readInt(2),c=a.readInt(2),d=a.readData(c),this.extraFields[b]={id:b,length:c,value:d}},handleUTF8:function(){var a=k.uint8array?"uint8array":"array";if(this.useUTF8())this.fileNameStr=i.utf8decode(this.fileName),this.fileCommentStr=i.utf8decode(this.fileComment);else{var b=this.findExtraFieldUnicodePath();if(null!==b)this.fileNameStr=b;else{var c=f.transformTo(a,this.fileName);this.fileNameStr=this.loadOptions.decodeFileName(c)}var d=this.findExtraFieldUnicodeComment();if(null!==d)this.fileCommentStr=d;else{var e=f.transformTo(a,this.fileComment);this.fileCommentStr=this.loadOptions.decodeFileName(e)}}},findExtraFieldUnicodePath:function(){var a=this.extraFields[28789];if(a){var b=e(a.value);return 1!==b.readInt(1)?null:h(this.fileName)!==b.readInt(4)?null:i.utf8decode(b.readData(a.length-5))}return null},findExtraFieldUnicodeComment:function(){var a=this.extraFields[25461];if(a){var b=e(a.value);return 1!==b.readInt(1)?null:h(this.fileComment)!==b.readInt(4)?null:i.utf8decode(b.readData(a.length-5))}return null}},b.exports=d},{"./compressedObject":2,"./compressions":3,"./crc32":4,"./reader/readerFor":22,"./support":30,"./utf8":31,"./utils":32}],35:[function(a,b,c){"use strict";var d=a("./stream/StreamHelper"),e=a("./stream/DataWorker"),f=a("./utf8"),g=a("./compressedObject"),h=a("./stream/GenericWorker"),i=function(a,b,c){this.name=a,this.dir=c.dir,this.date=c.date,this.comment=c.comment,this.unixPermissions=c.unixPermissions,this.dosPermissions=c.dosPermissions,this._data=b,this._dataBinary=c.binary,this.options={compression:c.compression,compressionOptions:c.compressionOptions}};i.prototype={internalStream:function(a){var b=null,c="string";try{if(!a)throw new Error("No output type specified.");c=a.toLowerCase();var e="string"===c||"text"===c;"binarystring"!==c&&"text"!==c||(c="string"),b=this._decompressWorker();var g=!this._dataBinary;g&&!e&&(b=b.pipe(new f.Utf8EncodeWorker)),!g&&e&&(b=b.pipe(new f.Utf8DecodeWorker))}catch(i){b=new h("error"),b.error(i)}return new d(b,c,"")},async:function(a,b){return this.internalStream(a).accumulate(b)},nodeStream:function(a,b){return this.internalStream(a||"nodebuffer").toNodejsStream(b)},_compressWorker:function(a,b){if(this._data instanceof g&&this._data.compression.magic===a.magic)return this._data.getCompressedWorker();var c=this._decompressWorker();return this._dataBinary||(c=c.pipe(new f.Utf8EncodeWorker)),g.createWorkerFrom(c,a,b)},_decompressWorker:function(){return this._data instanceof g?this._data.getContentWorker():this._data instanceof h?this._data:new e(this._data)}};for(var j=["asText","asBinary","asNodeBuffer","asUint8Array","asArrayBuffer"],k=function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},l=0;l<j.length;l++)i.prototype[j[l]]=k;b.exports=i},{"./compressedObject":2,"./stream/DataWorker":27,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31}],36:[function(a,b,c){a("../modules/web.immediate"),b.exports=a("../modules/_core").setImmediate},{"../modules/_core":40,"../modules/web.immediate":56}],37:[function(a,b,c){b.exports=function(a){if("function"!=typeof a)throw TypeError(a+" is not a function!");return a}},{}],38:[function(a,b,c){var d=a("./_is-object");b.exports=function(a){if(!d(a))throw TypeError(a+" is not an object!");return a}},{"./_is-object":51}],39:[function(a,b,c){var d={}.toString;b.exports=function(a){return d.call(a).slice(8,-1)}},{}],40:[function(a,b,c){var d=b.exports={version:"2.3.0"};"number"==typeof __e&&(__e=d)},{}],41:[function(a,b,c){var d=a("./_a-function");b.exports=function(a,b,c){if(d(a),void 0===b)return a;switch(c){case 1:return function(c){return a.call(b,c)};case 2:return function(c,d){return a.call(b,c,d)};case 3:return function(c,d,e){return a.call(b,c,d,e)}}return function(){return a.apply(b,arguments)}}},{"./_a-function":37}],42:[function(a,b,c){b.exports=!a("./_fails")(function(){return 7!=Object.defineProperty({},"a",{get:function(){return 7}}).a})},{"./_fails":45}],43:[function(a,b,c){var d=a("./_is-object"),e=a("./_global").document,f=d(e)&&d(e.createElement);b.exports=function(a){return f?e.createElement(a):{}}},{"./_global":46,"./_is-object":51}],44:[function(a,b,c){var d=a("./_global"),e=a("./_core"),f=a("./_ctx"),g=a("./_hide"),h="prototype",i=function(a,b,c){var j,k,l,m=a&i.F,n=a&i.G,o=a&i.S,p=a&i.P,q=a&i.B,r=a&i.W,s=n?e:e[b]||(e[b]={}),t=s[h],u=n?d:o?d[b]:(d[b]||{})[h];n&&(c=b);for(j in c)k=!m&&u&&void 0!==u[j],k&&j in s||(l=k?u[j]:c[j],s[j]=n&&"function"!=typeof u[j]?c[j]:q&&k?f(l,d):r&&u[j]==l?function(a){var b=function(b,c,d){if(this instanceof a){switch(arguments.length){case 0:return new a;case 1:return new a(b);case 2:return new a(b,c)}return new a(b,c,d)}return a.apply(this,arguments)};return b[h]=a[h],b}(l):p&&"function"==typeof l?f(Function.call,l):l,p&&((s.virtual||(s.virtual={}))[j]=l,a&i.R&&t&&!t[j]&&g(t,j,l)))};i.F=1,i.G=2,i.S=4,i.P=8,i.B=16,i.W=32,i.U=64,i.R=128,b.exports=i},{"./_core":40,"./_ctx":41,"./_global":46,"./_hide":47}],45:[function(a,b,c){b.exports=function(a){try{return!!a()}catch(b){return!0}}},{}],46:[function(a,b,c){var d=b.exports="undefined"!=typeof window&&window.Math==Math?window:"undefined"!=typeof self&&self.Math==Math?self:Function("return this")();"number"==typeof __g&&(__g=d)},{}],47:[function(a,b,c){var d=a("./_object-dp"),e=a("./_property-desc");b.exports=a("./_descriptors")?function(a,b,c){return d.f(a,b,e(1,c))}:function(a,b,c){return a[b]=c,a}},{"./_descriptors":42,"./_object-dp":52,"./_property-desc":53}],48:[function(a,b,c){b.exports=a("./_global").document&&document.documentElement},{"./_global":46}],49:[function(a,b,c){b.exports=!a("./_descriptors")&&!a("./_fails")(function(){return 7!=Object.defineProperty(a("./_dom-create")("div"),"a",{get:function(){return 7}}).a})},{"./_descriptors":42,"./_dom-create":43,"./_fails":45}],50:[function(a,b,c){b.exports=function(a,b,c){var d=void 0===c;switch(b.length){case 0:return d?a():a.call(c);case 1:return d?a(b[0]):a.call(c,b[0]);case 2:return d?a(b[0],b[1]):a.call(c,b[0],b[1]);case 3:return d?a(b[0],b[1],b[2]):a.call(c,b[0],b[1],b[2]);case 4:return d?a(b[0],b[1],b[2],b[3]):a.call(c,b[0],b[1],b[2],b[3])}return a.apply(c,b)}},{}],51:[function(a,b,c){b.exports=function(a){return"object"==typeof a?null!==a:"function"==typeof a}},{}],52:[function(a,b,c){var d=a("./_an-object"),e=a("./_ie8-dom-define"),f=a("./_to-primitive"),g=Object.defineProperty;c.f=a("./_descriptors")?Object.defineProperty:function(a,b,c){if(d(a),b=f(b,!0),d(c),e)try{return g(a,b,c)}catch(h){}if("get"in c||"set"in c)throw TypeError("Accessors not supported!");return"value"in c&&(a[b]=c.value),a}},{"./_an-object":38,"./_descriptors":42,"./_ie8-dom-define":49,"./_to-primitive":55}],53:[function(a,b,c){b.exports=function(a,b){return{enumerable:!(1&a),configurable:!(2&a),writable:!(4&a),value:b}}},{}],54:[function(a,b,c){var d,e,f,g=a("./_ctx"),h=a("./_invoke"),i=a("./_html"),j=a("./_dom-create"),k=a("./_global"),l=k.process,m=k.setImmediate,n=k.clearImmediate,o=k.MessageChannel,p=0,q={},r="onreadystatechange",s=function(){var a=+this;if(q.hasOwnProperty(a)){var b=q[a];delete q[a],b()}},t=function(a){s.call(a.data)};m&&n||(m=function(a){for(var b=[],c=1;arguments.length>c;)b.push(arguments[c++]);return q[++p]=function(){h("function"==typeof a?a:Function(a),b)},d(p),p},n=function(a){delete q[a]},"process"==a("./_cof")(l)?d=function(a){l.nextTick(g(s,a,1))}:o?(e=new o,f=e.port2,e.port1.onmessage=t,d=g(f.postMessage,f,1)):k.addEventListener&&"function"==typeof postMessage&&!k.importScripts?(d=function(a){k.postMessage(a+"","*")},k.addEventListener("message",t,!1)):d=r in j("script")?function(a){i.appendChild(j("script"))[r]=function(){i.removeChild(this),s.call(a)}}:function(a){setTimeout(g(s,a,1),0)}),b.exports={set:m,clear:n}},{"./_cof":39,"./_ctx":41,"./_dom-create":43,"./_global":46,"./_html":48,"./_invoke":50}],55:[function(a,b,c){var d=a("./_is-object");b.exports=function(a,b){if(!d(a))return a;var c,e;if(b&&"function"==typeof(c=a.toString)&&!d(e=c.call(a)))return e;if("function"==typeof(c=a.valueOf)&&!d(e=c.call(a)))return e;if(!b&&"function"==typeof(c=a.toString)&&!d(e=c.call(a)))return e;throw TypeError("Can't convert object to primitive value")}},{"./_is-object":51}],56:[function(a,b,c){var d=a("./_export"),e=a("./_task");d(d.G+d.B,{setImmediate:e.set,clearImmediate:e.clear})},{"./_export":44,"./_task":54}],57:[function(a,b,c){(function(a){"use strict";function c(){k=!0;for(var a,b,c=l.length;c;){for(b=l,l=[],a=-1;++a<c;)b[a]();c=l.length}k=!1}function d(a){1!==l.push(a)||k||e()}var e,f=a.MutationObserver||a.WebKitMutationObserver;if(f){var g=0,h=new f(c),i=a.document.createTextNode("");h.observe(i,{characterData:!0}),e=function(){i.data=g=++g%2}}else if(a.setImmediate||"undefined"==typeof a.MessageChannel)e="document"in a&&"onreadystatechange"in a.document.createElement("script")?function(){var b=a.document.createElement("script");b.onreadystatechange=function(){c(),b.onreadystatechange=null,b.parentNode.removeChild(b),b=null},a.document.documentElement.appendChild(b)}:function(){setTimeout(c,0)};else{var j=new a.MessageChannel;j.port1.onmessage=c,e=function(){j.port2.postMessage(0)}}var k,l=[];b.exports=d}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],58:[function(a,b,c){"use strict";function d(){}function e(a){if("function"!=typeof a)throw new TypeError("resolver must be a function");this.state=s,this.queue=[],this.outcome=void 0,a!==d&&i(this,a)}function f(a,b,c){this.promise=a,"function"==typeof b&&(this.onFulfilled=b,this.callFulfilled=this.otherCallFulfilled),"function"==typeof c&&(this.onRejected=c,this.callRejected=this.otherCallRejected)}function g(a,b,c){o(function(){var d;try{d=b(c)}catch(e){return p.reject(a,e)}d===a?p.reject(a,new TypeError("Cannot resolve promise with itself")):p.resolve(a,d)})}function h(a){var b=a&&a.then;if(a&&("object"==typeof a||"function"==typeof a)&&"function"==typeof b)return function(){b.apply(a,arguments)}}function i(a,b){function c(b){f||(f=!0,p.reject(a,b))}function d(b){f||(f=!0,p.resolve(a,b))}function e(){b(d,c)}var f=!1,g=j(e);"error"===g.status&&c(g.value)}function j(a,b){var c={};try{c.value=a(b),c.status="success"}catch(d){c.status="error",c.value=d}return c}function k(a){return a instanceof this?a:p.resolve(new this(d),a)}function l(a){var b=new this(d);return p.reject(b,a)}function m(a){function b(a,b){function d(a){g[b]=a,++h!==e||f||(f=!0,p.resolve(j,g))}c.resolve(a).then(d,function(a){f||(f=!0,p.reject(j,a))})}var c=this;if("[object Array]"!==Object.prototype.toString.call(a))return this.reject(new TypeError("must be an array"));var e=a.length,f=!1;if(!e)return this.resolve([]);for(var g=new Array(e),h=0,i=-1,j=new this(d);++i<e;)b(a[i],i);return j}function n(a){function b(a){c.resolve(a).then(function(a){f||(f=!0,p.resolve(h,a))},function(a){f||(f=!0,p.reject(h,a))})}var c=this;if("[object Array]"!==Object.prototype.toString.call(a))return this.reject(new TypeError("must be an array"));var e=a.length,f=!1;if(!e)return this.resolve([]);for(var g=-1,h=new this(d);++g<e;)b(a[g]);return h}var o=a("immediate"),p={},q=["REJECTED"],r=["FULFILLED"],s=["PENDING"];b.exports=e,e.prototype["catch"]=function(a){return this.then(null,a)},e.prototype.then=function(a,b){if("function"!=typeof a&&this.state===r||"function"!=typeof b&&this.state===q)return this;var c=new this.constructor(d);if(this.state!==s){var e=this.state===r?a:b;g(c,e,this.outcome)}else this.queue.push(new f(c,a,b));return c},f.prototype.callFulfilled=function(a){p.resolve(this.promise,a)},f.prototype.otherCallFulfilled=function(a){g(this.promise,this.onFulfilled,a)},f.prototype.callRejected=function(a){p.reject(this.promise,a)},f.prototype.otherCallRejected=function(a){g(this.promise,this.onRejected,a)},p.resolve=function(a,b){var c=j(h,b);if("error"===c.status)return p.reject(a,c.value);var d=c.value;if(d)i(a,d);else{a.state=r,a.outcome=b;for(var e=-1,f=a.queue.length;++e<f;)a.queue[e].callFulfilled(b)}return a},p.reject=function(a,b){a.state=q,a.outcome=b;for(var c=-1,d=a.queue.length;++c<d;)a.queue[c].callRejected(b);return a},e.resolve=k,e.reject=l,e.all=m,e.race=n},{immediate:57}],59:[function(a,b,c){"use strict";var d=a("./lib/utils/common").assign,e=a("./lib/deflate"),f=a("./lib/inflate"),g=a("./lib/zlib/constants"),h={};d(h,e,f,g),b.exports=h},{"./lib/deflate":60,"./lib/inflate":61,"./lib/utils/common":62,"./lib/zlib/constants":65}],60:[function(a,b,c){"use strict";function d(a){if(!(this instanceof d))return new d(a);this.options=i.assign({level:s,method:u,chunkSize:16384,windowBits:15,memLevel:8,strategy:t,to:""},a||{});var b=this.options;b.raw&&b.windowBits>0?b.windowBits=-b.windowBits:b.gzip&&b.windowBits>0&&b.windowBits<16&&(b.windowBits+=16),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new l,this.strm.avail_out=0;var c=h.deflateInit2(this.strm,b.level,b.method,b.windowBits,b.memLevel,b.strategy);if(c!==p)throw new Error(k[c]);if(b.header&&h.deflateSetHeader(this.strm,b.header),b.dictionary){var e;if(e="string"==typeof b.dictionary?j.string2buf(b.dictionary):"[object ArrayBuffer]"===m.call(b.dictionary)?new Uint8Array(b.dictionary):b.dictionary,c=h.deflateSetDictionary(this.strm,e),c!==p)throw new Error(k[c]);this._dict_set=!0}}function e(a,b){var c=new d(b);if(c.push(a,!0),c.err)throw c.msg||k[c.err];return c.result}function f(a,b){return b=b||{},b.raw=!0,e(a,b)}function g(a,b){return b=b||{},b.gzip=!0,e(a,b)}var h=a("./zlib/deflate"),i=a("./utils/common"),j=a("./utils/strings"),k=a("./zlib/messages"),l=a("./zlib/zstream"),m=Object.prototype.toString,n=0,o=4,p=0,q=1,r=2,s=-1,t=0,u=8;d.prototype.push=function(a,b){var c,d,e=this.strm,f=this.options.chunkSize;if(this.ended)return!1;d=b===~~b?b:b===!0?o:n,"string"==typeof a?e.input=j.string2buf(a):"[object ArrayBuffer]"===m.call(a)?e.input=new Uint8Array(a):e.input=a,e.next_in=0,e.avail_in=e.input.length;do{if(0===e.avail_out&&(e.output=new i.Buf8(f),e.next_out=0,e.avail_out=f),c=h.deflate(e,d),c!==q&&c!==p)return this.onEnd(c),this.ended=!0,!1;0!==e.avail_out&&(0!==e.avail_in||d!==o&&d!==r)||("string"===this.options.to?this.onData(j.buf2binstring(i.shrinkBuf(e.output,e.next_out))):this.onData(i.shrinkBuf(e.output,e.next_out)))}while((e.avail_in>0||0===e.avail_out)&&c!==q);return d===o?(c=h.deflateEnd(this.strm),this.onEnd(c),this.ended=!0,c===p):d!==r||(this.onEnd(p),e.avail_out=0,!0)},d.prototype.onData=function(a){this.chunks.push(a)},d.prototype.onEnd=function(a){a===p&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=i.flattenChunks(this.chunks)),this.chunks=[],this.err=a,this.msg=this.strm.msg},c.Deflate=d,c.deflate=e,c.deflateRaw=f,c.gzip=g},{"./utils/common":62,"./utils/strings":63,"./zlib/deflate":67,"./zlib/messages":72,"./zlib/zstream":74}],61:[function(a,b,c){"use strict";function d(a){if(!(this instanceof d))return new d(a);this.options=h.assign({chunkSize:16384,windowBits:0,to:""},a||{});var b=this.options;b.raw&&b.windowBits>=0&&b.windowBits<16&&(b.windowBits=-b.windowBits,0===b.windowBits&&(b.windowBits=-15)),!(b.windowBits>=0&&b.windowBits<16)||a&&a.windowBits||(b.windowBits+=32),b.windowBits>15&&b.windowBits<48&&0===(15&b.windowBits)&&(b.windowBits|=15),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new l,this.strm.avail_out=0;var c=g.inflateInit2(this.strm,b.windowBits);if(c!==j.Z_OK)throw new Error(k[c]);this.header=new m,g.inflateGetHeader(this.strm,this.header)}function e(a,b){var c=new d(b);if(c.push(a,!0),c.err)throw c.msg||k[c.err];return c.result}function f(a,b){return b=b||{},b.raw=!0,e(a,b)}var g=a("./zlib/inflate"),h=a("./utils/common"),i=a("./utils/strings"),j=a("./zlib/constants"),k=a("./zlib/messages"),l=a("./zlib/zstream"),m=a("./zlib/gzheader"),n=Object.prototype.toString;d.prototype.push=function(a,b){var c,d,e,f,k,l,m=this.strm,o=this.options.chunkSize,p=this.options.dictionary,q=!1;if(this.ended)return!1;d=b===~~b?b:b===!0?j.Z_FINISH:j.Z_NO_FLUSH,"string"==typeof a?m.input=i.binstring2buf(a):"[object ArrayBuffer]"===n.call(a)?m.input=new Uint8Array(a):m.input=a,m.next_in=0,m.avail_in=m.input.length;do{if(0===m.avail_out&&(m.output=new h.Buf8(o),m.next_out=0,m.avail_out=o),c=g.inflate(m,j.Z_NO_FLUSH),c===j.Z_NEED_DICT&&p&&(l="string"==typeof p?i.string2buf(p):"[object ArrayBuffer]"===n.call(p)?new Uint8Array(p):p,c=g.inflateSetDictionary(this.strm,l)),c===j.Z_BUF_ERROR&&q===!0&&(c=j.Z_OK,q=!1),c!==j.Z_STREAM_END&&c!==j.Z_OK)return this.onEnd(c),this.ended=!0,!1;m.next_out&&(0!==m.avail_out&&c!==j.Z_STREAM_END&&(0!==m.avail_in||d!==j.Z_FINISH&&d!==j.Z_SYNC_FLUSH)||("string"===this.options.to?(e=i.utf8border(m.output,m.next_out),f=m.next_out-e,k=i.buf2string(m.output,e),m.next_out=f,m.avail_out=o-f,f&&h.arraySet(m.output,m.output,e,f,0),this.onData(k)):this.onData(h.shrinkBuf(m.output,m.next_out)))),0===m.avail_in&&0===m.avail_out&&(q=!0)}while((m.avail_in>0||0===m.avail_out)&&c!==j.Z_STREAM_END);return c===j.Z_STREAM_END&&(d=j.Z_FINISH),d===j.Z_FINISH?(c=g.inflateEnd(this.strm),this.onEnd(c),this.ended=!0,c===j.Z_OK):d!==j.Z_SYNC_FLUSH||(this.onEnd(j.Z_OK),m.avail_out=0,!0)},d.prototype.onData=function(a){this.chunks.push(a)},d.prototype.onEnd=function(a){a===j.Z_OK&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=h.flattenChunks(this.chunks)),this.chunks=[],this.err=a,this.msg=this.strm.msg},c.Inflate=d,c.inflate=e,c.inflateRaw=f,c.ungzip=e},{"./utils/common":62,"./utils/strings":63,"./zlib/constants":65,"./zlib/gzheader":68,"./zlib/inflate":70,"./zlib/messages":72,"./zlib/zstream":74}],62:[function(a,b,c){"use strict";var d="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Int32Array;c.assign=function(a){for(var b=Array.prototype.slice.call(arguments,1);b.length;){var c=b.shift();if(c){if("object"!=typeof c)throw new TypeError(c+"must be non-object");for(var d in c)c.hasOwnProperty(d)&&(a[d]=c[d])}}return a},c.shrinkBuf=function(a,b){return a.length===b?a:a.subarray?a.subarray(0,b):(a.length=b,a)};var e={arraySet:function(a,b,c,d,e){if(b.subarray&&a.subarray)return void a.set(b.subarray(c,c+d),e);for(var f=0;f<d;f++)a[e+f]=b[c+f]},flattenChunks:function(a){var b,c,d,e,f,g;for(d=0,b=0,c=a.length;b<c;b++)d+=a[b].length;for(g=new Uint8Array(d),e=0,b=0,c=a.length;b<c;b++)f=a[b],g.set(f,e),e+=f.length;return g}},f={arraySet:function(a,b,c,d,e){for(var f=0;f<d;f++)a[e+f]=b[c+f]},flattenChunks:function(a){return[].concat.apply([],a)}};c.setTyped=function(a){a?(c.Buf8=Uint8Array,c.Buf16=Uint16Array,c.Buf32=Int32Array,c.assign(c,e)):(c.Buf8=Array,c.Buf16=Array,c.Buf32=Array,c.assign(c,f))},c.setTyped(d)},{}],63:[function(a,b,c){"use strict";function d(a,b){if(b<65537&&(a.subarray&&g||!a.subarray&&f))return String.fromCharCode.apply(null,e.shrinkBuf(a,b));for(var c="",d=0;d<b;d++)c+=String.fromCharCode(a[d]);return c}var e=a("./common"),f=!0,g=!0;try{String.fromCharCode.apply(null,[0])}catch(h){f=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(h){g=!1}for(var i=new e.Buf8(256),j=0;j<256;j++)i[j]=j>=252?6:j>=248?5:j>=240?4:j>=224?3:j>=192?2:1;i[254]=i[254]=1,c.string2buf=function(a){var b,c,d,f,g,h=a.length,i=0;for(f=0;f<h;f++)c=a.charCodeAt(f),55296===(64512&c)&&f+1<h&&(d=a.charCodeAt(f+1),56320===(64512&d)&&(c=65536+(c-55296<<10)+(d-56320),f++)),i+=c<128?1:c<2048?2:c<65536?3:4;for(b=new e.Buf8(i),g=0,f=0;g<i;f++)c=a.charCodeAt(f),55296===(64512&c)&&f+1<h&&(d=a.charCodeAt(f+1),56320===(64512&d)&&(c=65536+(c-55296<<10)+(d-56320),f++)),c<128?b[g++]=c:c<2048?(b[g++]=192|c>>>6,b[g++]=128|63&c):c<65536?(b[g++]=224|c>>>12,b[g++]=128|c>>>6&63,b[g++]=128|63&c):(b[g++]=240|c>>>18,b[g++]=128|c>>>12&63,b[g++]=128|c>>>6&63,b[g++]=128|63&c);return b},c.buf2binstring=function(a){return d(a,a.length)},c.binstring2buf=function(a){for(var b=new e.Buf8(a.length),c=0,d=b.length;c<d;c++)b[c]=a.charCodeAt(c);return b},c.buf2string=function(a,b){var c,e,f,g,h=b||a.length,j=new Array(2*h);for(e=0,c=0;c<h;)if(f=a[c++],f<128)j[e++]=f;else if(g=i[f],g>4)j[e++]=65533,c+=g-1;else{for(f&=2===g?31:3===g?15:7;g>1&&c<h;)f=f<<6|63&a[c++],g--;g>1?j[e++]=65533:f<65536?j[e++]=f:(f-=65536,j[e++]=55296|f>>10&1023,j[e++]=56320|1023&f)}return d(j,e)},c.utf8border=function(a,b){var c;for(b=b||a.length,b>a.length&&(b=a.length),c=b-1;c>=0&&128===(192&a[c]);)c--;return c<0?b:0===c?b:c+i[a[c]]>b?c:b}},{"./common":62}],64:[function(a,b,c){"use strict";function d(a,b,c,d){for(var e=65535&a|0,f=a>>>16&65535|0,g=0;0!==c;){g=c>2e3?2e3:c,c-=g;do e=e+b[d++]|0,f=f+e|0;while(--g);e%=65521,f%=65521}return e|f<<16|0;
}b.exports=d},{}],65:[function(a,b,c){"use strict";b.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8}},{}],66:[function(a,b,c){"use strict";function d(){for(var a,b=[],c=0;c<256;c++){a=c;for(var d=0;d<8;d++)a=1&a?3988292384^a>>>1:a>>>1;b[c]=a}return b}function e(a,b,c,d){var e=f,g=d+c;a^=-1;for(var h=d;h<g;h++)a=a>>>8^e[255&(a^b[h])];return a^-1}var f=d();b.exports=e},{}],67:[function(a,b,c){"use strict";function d(a,b){return a.msg=I[b],b}function e(a){return(a<<1)-(a>4?9:0)}function f(a){for(var b=a.length;--b>=0;)a[b]=0}function g(a){var b=a.state,c=b.pending;c>a.avail_out&&(c=a.avail_out),0!==c&&(E.arraySet(a.output,b.pending_buf,b.pending_out,c,a.next_out),a.next_out+=c,b.pending_out+=c,a.total_out+=c,a.avail_out-=c,b.pending-=c,0===b.pending&&(b.pending_out=0))}function h(a,b){F._tr_flush_block(a,a.block_start>=0?a.block_start:-1,a.strstart-a.block_start,b),a.block_start=a.strstart,g(a.strm)}function i(a,b){a.pending_buf[a.pending++]=b}function j(a,b){a.pending_buf[a.pending++]=b>>>8&255,a.pending_buf[a.pending++]=255&b}function k(a,b,c,d){var e=a.avail_in;return e>d&&(e=d),0===e?0:(a.avail_in-=e,E.arraySet(b,a.input,a.next_in,e,c),1===a.state.wrap?a.adler=G(a.adler,b,e,c):2===a.state.wrap&&(a.adler=H(a.adler,b,e,c)),a.next_in+=e,a.total_in+=e,e)}function l(a,b){var c,d,e=a.max_chain_length,f=a.strstart,g=a.prev_length,h=a.nice_match,i=a.strstart>a.w_size-la?a.strstart-(a.w_size-la):0,j=a.window,k=a.w_mask,l=a.prev,m=a.strstart+ka,n=j[f+g-1],o=j[f+g];a.prev_length>=a.good_match&&(e>>=2),h>a.lookahead&&(h=a.lookahead);do if(c=b,j[c+g]===o&&j[c+g-1]===n&&j[c]===j[f]&&j[++c]===j[f+1]){f+=2,c++;do;while(j[++f]===j[++c]&&j[++f]===j[++c]&&j[++f]===j[++c]&&j[++f]===j[++c]&&j[++f]===j[++c]&&j[++f]===j[++c]&&j[++f]===j[++c]&&j[++f]===j[++c]&&f<m);if(d=ka-(m-f),f=m-ka,d>g){if(a.match_start=b,g=d,d>=h)break;n=j[f+g-1],o=j[f+g]}}while((b=l[b&k])>i&&0!==--e);return g<=a.lookahead?g:a.lookahead}function m(a){var b,c,d,e,f,g=a.w_size;do{if(e=a.window_size-a.lookahead-a.strstart,a.strstart>=g+(g-la)){E.arraySet(a.window,a.window,g,g,0),a.match_start-=g,a.strstart-=g,a.block_start-=g,c=a.hash_size,b=c;do d=a.head[--b],a.head[b]=d>=g?d-g:0;while(--c);c=g,b=c;do d=a.prev[--b],a.prev[b]=d>=g?d-g:0;while(--c);e+=g}if(0===a.strm.avail_in)break;if(c=k(a.strm,a.window,a.strstart+a.lookahead,e),a.lookahead+=c,a.lookahead+a.insert>=ja)for(f=a.strstart-a.insert,a.ins_h=a.window[f],a.ins_h=(a.ins_h<<a.hash_shift^a.window[f+1])&a.hash_mask;a.insert&&(a.ins_h=(a.ins_h<<a.hash_shift^a.window[f+ja-1])&a.hash_mask,a.prev[f&a.w_mask]=a.head[a.ins_h],a.head[a.ins_h]=f,f++,a.insert--,!(a.lookahead+a.insert<ja)););}while(a.lookahead<la&&0!==a.strm.avail_in)}function n(a,b){var c=65535;for(c>a.pending_buf_size-5&&(c=a.pending_buf_size-5);;){if(a.lookahead<=1){if(m(a),0===a.lookahead&&b===J)return ua;if(0===a.lookahead)break}a.strstart+=a.lookahead,a.lookahead=0;var d=a.block_start+c;if((0===a.strstart||a.strstart>=d)&&(a.lookahead=a.strstart-d,a.strstart=d,h(a,!1),0===a.strm.avail_out))return ua;if(a.strstart-a.block_start>=a.w_size-la&&(h(a,!1),0===a.strm.avail_out))return ua}return a.insert=0,b===M?(h(a,!0),0===a.strm.avail_out?wa:xa):a.strstart>a.block_start&&(h(a,!1),0===a.strm.avail_out)?ua:ua}function o(a,b){for(var c,d;;){if(a.lookahead<la){if(m(a),a.lookahead<la&&b===J)return ua;if(0===a.lookahead)break}if(c=0,a.lookahead>=ja&&(a.ins_h=(a.ins_h<<a.hash_shift^a.window[a.strstart+ja-1])&a.hash_mask,c=a.prev[a.strstart&a.w_mask]=a.head[a.ins_h],a.head[a.ins_h]=a.strstart),0!==c&&a.strstart-c<=a.w_size-la&&(a.match_length=l(a,c)),a.match_length>=ja)if(d=F._tr_tally(a,a.strstart-a.match_start,a.match_length-ja),a.lookahead-=a.match_length,a.match_length<=a.max_lazy_match&&a.lookahead>=ja){a.match_length--;do a.strstart++,a.ins_h=(a.ins_h<<a.hash_shift^a.window[a.strstart+ja-1])&a.hash_mask,c=a.prev[a.strstart&a.w_mask]=a.head[a.ins_h],a.head[a.ins_h]=a.strstart;while(0!==--a.match_length);a.strstart++}else a.strstart+=a.match_length,a.match_length=0,a.ins_h=a.window[a.strstart],a.ins_h=(a.ins_h<<a.hash_shift^a.window[a.strstart+1])&a.hash_mask;else d=F._tr_tally(a,0,a.window[a.strstart]),a.lookahead--,a.strstart++;if(d&&(h(a,!1),0===a.strm.avail_out))return ua}return a.insert=a.strstart<ja-1?a.strstart:ja-1,b===M?(h(a,!0),0===a.strm.avail_out?wa:xa):a.last_lit&&(h(a,!1),0===a.strm.avail_out)?ua:va}function p(a,b){for(var c,d,e;;){if(a.lookahead<la){if(m(a),a.lookahead<la&&b===J)return ua;if(0===a.lookahead)break}if(c=0,a.lookahead>=ja&&(a.ins_h=(a.ins_h<<a.hash_shift^a.window[a.strstart+ja-1])&a.hash_mask,c=a.prev[a.strstart&a.w_mask]=a.head[a.ins_h],a.head[a.ins_h]=a.strstart),a.prev_length=a.match_length,a.prev_match=a.match_start,a.match_length=ja-1,0!==c&&a.prev_length<a.max_lazy_match&&a.strstart-c<=a.w_size-la&&(a.match_length=l(a,c),a.match_length<=5&&(a.strategy===U||a.match_length===ja&&a.strstart-a.match_start>4096)&&(a.match_length=ja-1)),a.prev_length>=ja&&a.match_length<=a.prev_length){e=a.strstart+a.lookahead-ja,d=F._tr_tally(a,a.strstart-1-a.prev_match,a.prev_length-ja),a.lookahead-=a.prev_length-1,a.prev_length-=2;do++a.strstart<=e&&(a.ins_h=(a.ins_h<<a.hash_shift^a.window[a.strstart+ja-1])&a.hash_mask,c=a.prev[a.strstart&a.w_mask]=a.head[a.ins_h],a.head[a.ins_h]=a.strstart);while(0!==--a.prev_length);if(a.match_available=0,a.match_length=ja-1,a.strstart++,d&&(h(a,!1),0===a.strm.avail_out))return ua}else if(a.match_available){if(d=F._tr_tally(a,0,a.window[a.strstart-1]),d&&h(a,!1),a.strstart++,a.lookahead--,0===a.strm.avail_out)return ua}else a.match_available=1,a.strstart++,a.lookahead--}return a.match_available&&(d=F._tr_tally(a,0,a.window[a.strstart-1]),a.match_available=0),a.insert=a.strstart<ja-1?a.strstart:ja-1,b===M?(h(a,!0),0===a.strm.avail_out?wa:xa):a.last_lit&&(h(a,!1),0===a.strm.avail_out)?ua:va}function q(a,b){for(var c,d,e,f,g=a.window;;){if(a.lookahead<=ka){if(m(a),a.lookahead<=ka&&b===J)return ua;if(0===a.lookahead)break}if(a.match_length=0,a.lookahead>=ja&&a.strstart>0&&(e=a.strstart-1,d=g[e],d===g[++e]&&d===g[++e]&&d===g[++e])){f=a.strstart+ka;do;while(d===g[++e]&&d===g[++e]&&d===g[++e]&&d===g[++e]&&d===g[++e]&&d===g[++e]&&d===g[++e]&&d===g[++e]&&e<f);a.match_length=ka-(f-e),a.match_length>a.lookahead&&(a.match_length=a.lookahead)}if(a.match_length>=ja?(c=F._tr_tally(a,1,a.match_length-ja),a.lookahead-=a.match_length,a.strstart+=a.match_length,a.match_length=0):(c=F._tr_tally(a,0,a.window[a.strstart]),a.lookahead--,a.strstart++),c&&(h(a,!1),0===a.strm.avail_out))return ua}return a.insert=0,b===M?(h(a,!0),0===a.strm.avail_out?wa:xa):a.last_lit&&(h(a,!1),0===a.strm.avail_out)?ua:va}function r(a,b){for(var c;;){if(0===a.lookahead&&(m(a),0===a.lookahead)){if(b===J)return ua;break}if(a.match_length=0,c=F._tr_tally(a,0,a.window[a.strstart]),a.lookahead--,a.strstart++,c&&(h(a,!1),0===a.strm.avail_out))return ua}return a.insert=0,b===M?(h(a,!0),0===a.strm.avail_out?wa:xa):a.last_lit&&(h(a,!1),0===a.strm.avail_out)?ua:va}function s(a,b,c,d,e){this.good_length=a,this.max_lazy=b,this.nice_length=c,this.max_chain=d,this.func=e}function t(a){a.window_size=2*a.w_size,f(a.head),a.max_lazy_match=D[a.level].max_lazy,a.good_match=D[a.level].good_length,a.nice_match=D[a.level].nice_length,a.max_chain_length=D[a.level].max_chain,a.strstart=0,a.block_start=0,a.lookahead=0,a.insert=0,a.match_length=a.prev_length=ja-1,a.match_available=0,a.ins_h=0}function u(){this.strm=null,this.status=0,this.pending_buf=null,this.pending_buf_size=0,this.pending_out=0,this.pending=0,this.wrap=0,this.gzhead=null,this.gzindex=0,this.method=$,this.last_flush=-1,this.w_size=0,this.w_bits=0,this.w_mask=0,this.window=null,this.window_size=0,this.prev=null,this.head=null,this.ins_h=0,this.hash_size=0,this.hash_bits=0,this.hash_mask=0,this.hash_shift=0,this.block_start=0,this.match_length=0,this.prev_match=0,this.match_available=0,this.strstart=0,this.match_start=0,this.lookahead=0,this.prev_length=0,this.max_chain_length=0,this.max_lazy_match=0,this.level=0,this.strategy=0,this.good_match=0,this.nice_match=0,this.dyn_ltree=new E.Buf16(2*ha),this.dyn_dtree=new E.Buf16(2*(2*fa+1)),this.bl_tree=new E.Buf16(2*(2*ga+1)),f(this.dyn_ltree),f(this.dyn_dtree),f(this.bl_tree),this.l_desc=null,this.d_desc=null,this.bl_desc=null,this.bl_count=new E.Buf16(ia+1),this.heap=new E.Buf16(2*ea+1),f(this.heap),this.heap_len=0,this.heap_max=0,this.depth=new E.Buf16(2*ea+1),f(this.depth),this.l_buf=0,this.lit_bufsize=0,this.last_lit=0,this.d_buf=0,this.opt_len=0,this.static_len=0,this.matches=0,this.insert=0,this.bi_buf=0,this.bi_valid=0}function v(a){var b;return a&&a.state?(a.total_in=a.total_out=0,a.data_type=Z,b=a.state,b.pending=0,b.pending_out=0,b.wrap<0&&(b.wrap=-b.wrap),b.status=b.wrap?na:sa,a.adler=2===b.wrap?0:1,b.last_flush=J,F._tr_init(b),O):d(a,Q)}function w(a){var b=v(a);return b===O&&t(a.state),b}function x(a,b){return a&&a.state?2!==a.state.wrap?Q:(a.state.gzhead=b,O):Q}function y(a,b,c,e,f,g){if(!a)return Q;var h=1;if(b===T&&(b=6),e<0?(h=0,e=-e):e>15&&(h=2,e-=16),f<1||f>_||c!==$||e<8||e>15||b<0||b>9||g<0||g>X)return d(a,Q);8===e&&(e=9);var i=new u;return a.state=i,i.strm=a,i.wrap=h,i.gzhead=null,i.w_bits=e,i.w_size=1<<i.w_bits,i.w_mask=i.w_size-1,i.hash_bits=f+7,i.hash_size=1<<i.hash_bits,i.hash_mask=i.hash_size-1,i.hash_shift=~~((i.hash_bits+ja-1)/ja),i.window=new E.Buf8(2*i.w_size),i.head=new E.Buf16(i.hash_size),i.prev=new E.Buf16(i.w_size),i.lit_bufsize=1<<f+6,i.pending_buf_size=4*i.lit_bufsize,i.pending_buf=new E.Buf8(i.pending_buf_size),i.d_buf=1*i.lit_bufsize,i.l_buf=3*i.lit_bufsize,i.level=b,i.strategy=g,i.method=c,w(a)}function z(a,b){return y(a,b,$,aa,ba,Y)}function A(a,b){var c,h,k,l;if(!a||!a.state||b>N||b<0)return a?d(a,Q):Q;if(h=a.state,!a.output||!a.input&&0!==a.avail_in||h.status===ta&&b!==M)return d(a,0===a.avail_out?S:Q);if(h.strm=a,c=h.last_flush,h.last_flush=b,h.status===na)if(2===h.wrap)a.adler=0,i(h,31),i(h,139),i(h,8),h.gzhead?(i(h,(h.gzhead.text?1:0)+(h.gzhead.hcrc?2:0)+(h.gzhead.extra?4:0)+(h.gzhead.name?8:0)+(h.gzhead.comment?16:0)),i(h,255&h.gzhead.time),i(h,h.gzhead.time>>8&255),i(h,h.gzhead.time>>16&255),i(h,h.gzhead.time>>24&255),i(h,9===h.level?2:h.strategy>=V||h.level<2?4:0),i(h,255&h.gzhead.os),h.gzhead.extra&&h.gzhead.extra.length&&(i(h,255&h.gzhead.extra.length),i(h,h.gzhead.extra.length>>8&255)),h.gzhead.hcrc&&(a.adler=H(a.adler,h.pending_buf,h.pending,0)),h.gzindex=0,h.status=oa):(i(h,0),i(h,0),i(h,0),i(h,0),i(h,0),i(h,9===h.level?2:h.strategy>=V||h.level<2?4:0),i(h,ya),h.status=sa);else{var m=$+(h.w_bits-8<<4)<<8,n=-1;n=h.strategy>=V||h.level<2?0:h.level<6?1:6===h.level?2:3,m|=n<<6,0!==h.strstart&&(m|=ma),m+=31-m%31,h.status=sa,j(h,m),0!==h.strstart&&(j(h,a.adler>>>16),j(h,65535&a.adler)),a.adler=1}if(h.status===oa)if(h.gzhead.extra){for(k=h.pending;h.gzindex<(65535&h.gzhead.extra.length)&&(h.pending!==h.pending_buf_size||(h.gzhead.hcrc&&h.pending>k&&(a.adler=H(a.adler,h.pending_buf,h.pending-k,k)),g(a),k=h.pending,h.pending!==h.pending_buf_size));)i(h,255&h.gzhead.extra[h.gzindex]),h.gzindex++;h.gzhead.hcrc&&h.pending>k&&(a.adler=H(a.adler,h.pending_buf,h.pending-k,k)),h.gzindex===h.gzhead.extra.length&&(h.gzindex=0,h.status=pa)}else h.status=pa;if(h.status===pa)if(h.gzhead.name){k=h.pending;do{if(h.pending===h.pending_buf_size&&(h.gzhead.hcrc&&h.pending>k&&(a.adler=H(a.adler,h.pending_buf,h.pending-k,k)),g(a),k=h.pending,h.pending===h.pending_buf_size)){l=1;break}l=h.gzindex<h.gzhead.name.length?255&h.gzhead.name.charCodeAt(h.gzindex++):0,i(h,l)}while(0!==l);h.gzhead.hcrc&&h.pending>k&&(a.adler=H(a.adler,h.pending_buf,h.pending-k,k)),0===l&&(h.gzindex=0,h.status=qa)}else h.status=qa;if(h.status===qa)if(h.gzhead.comment){k=h.pending;do{if(h.pending===h.pending_buf_size&&(h.gzhead.hcrc&&h.pending>k&&(a.adler=H(a.adler,h.pending_buf,h.pending-k,k)),g(a),k=h.pending,h.pending===h.pending_buf_size)){l=1;break}l=h.gzindex<h.gzhead.comment.length?255&h.gzhead.comment.charCodeAt(h.gzindex++):0,i(h,l)}while(0!==l);h.gzhead.hcrc&&h.pending>k&&(a.adler=H(a.adler,h.pending_buf,h.pending-k,k)),0===l&&(h.status=ra)}else h.status=ra;if(h.status===ra&&(h.gzhead.hcrc?(h.pending+2>h.pending_buf_size&&g(a),h.pending+2<=h.pending_buf_size&&(i(h,255&a.adler),i(h,a.adler>>8&255),a.adler=0,h.status=sa)):h.status=sa),0!==h.pending){if(g(a),0===a.avail_out)return h.last_flush=-1,O}else if(0===a.avail_in&&e(b)<=e(c)&&b!==M)return d(a,S);if(h.status===ta&&0!==a.avail_in)return d(a,S);if(0!==a.avail_in||0!==h.lookahead||b!==J&&h.status!==ta){var o=h.strategy===V?r(h,b):h.strategy===W?q(h,b):D[h.level].func(h,b);if(o!==wa&&o!==xa||(h.status=ta),o===ua||o===wa)return 0===a.avail_out&&(h.last_flush=-1),O;if(o===va&&(b===K?F._tr_align(h):b!==N&&(F._tr_stored_block(h,0,0,!1),b===L&&(f(h.head),0===h.lookahead&&(h.strstart=0,h.block_start=0,h.insert=0))),g(a),0===a.avail_out))return h.last_flush=-1,O}return b!==M?O:h.wrap<=0?P:(2===h.wrap?(i(h,255&a.adler),i(h,a.adler>>8&255),i(h,a.adler>>16&255),i(h,a.adler>>24&255),i(h,255&a.total_in),i(h,a.total_in>>8&255),i(h,a.total_in>>16&255),i(h,a.total_in>>24&255)):(j(h,a.adler>>>16),j(h,65535&a.adler)),g(a),h.wrap>0&&(h.wrap=-h.wrap),0!==h.pending?O:P)}function B(a){var b;return a&&a.state?(b=a.state.status,b!==na&&b!==oa&&b!==pa&&b!==qa&&b!==ra&&b!==sa&&b!==ta?d(a,Q):(a.state=null,b===sa?d(a,R):O)):Q}function C(a,b){var c,d,e,g,h,i,j,k,l=b.length;if(!a||!a.state)return Q;if(c=a.state,g=c.wrap,2===g||1===g&&c.status!==na||c.lookahead)return Q;for(1===g&&(a.adler=G(a.adler,b,l,0)),c.wrap=0,l>=c.w_size&&(0===g&&(f(c.head),c.strstart=0,c.block_start=0,c.insert=0),k=new E.Buf8(c.w_size),E.arraySet(k,b,l-c.w_size,c.w_size,0),b=k,l=c.w_size),h=a.avail_in,i=a.next_in,j=a.input,a.avail_in=l,a.next_in=0,a.input=b,m(c);c.lookahead>=ja;){d=c.strstart,e=c.lookahead-(ja-1);do c.ins_h=(c.ins_h<<c.hash_shift^c.window[d+ja-1])&c.hash_mask,c.prev[d&c.w_mask]=c.head[c.ins_h],c.head[c.ins_h]=d,d++;while(--e);c.strstart=d,c.lookahead=ja-1,m(c)}return c.strstart+=c.lookahead,c.block_start=c.strstart,c.insert=c.lookahead,c.lookahead=0,c.match_length=c.prev_length=ja-1,c.match_available=0,a.next_in=i,a.input=j,a.avail_in=h,c.wrap=g,O}var D,E=a("../utils/common"),F=a("./trees"),G=a("./adler32"),H=a("./crc32"),I=a("./messages"),J=0,K=1,L=3,M=4,N=5,O=0,P=1,Q=-2,R=-3,S=-5,T=-1,U=1,V=2,W=3,X=4,Y=0,Z=2,$=8,_=9,aa=15,ba=8,ca=29,da=256,ea=da+1+ca,fa=30,ga=19,ha=2*ea+1,ia=15,ja=3,ka=258,la=ka+ja+1,ma=32,na=42,oa=69,pa=73,qa=91,ra=103,sa=113,ta=666,ua=1,va=2,wa=3,xa=4,ya=3;D=[new s(0,0,0,0,n),new s(4,4,8,4,o),new s(4,5,16,8,o),new s(4,6,32,32,o),new s(4,4,16,16,p),new s(8,16,32,32,p),new s(8,16,128,128,p),new s(8,32,128,256,p),new s(32,128,258,1024,p),new s(32,258,258,4096,p)],c.deflateInit=z,c.deflateInit2=y,c.deflateReset=w,c.deflateResetKeep=v,c.deflateSetHeader=x,c.deflate=A,c.deflateEnd=B,c.deflateSetDictionary=C,c.deflateInfo="pako deflate (from Nodeca project)"},{"../utils/common":62,"./adler32":64,"./crc32":66,"./messages":72,"./trees":73}],68:[function(a,b,c){"use strict";function d(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1}b.exports=d},{}],69:[function(a,b,c){"use strict";var d=30,e=12;b.exports=function(a,b){var c,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C;c=a.state,f=a.next_in,B=a.input,g=f+(a.avail_in-5),h=a.next_out,C=a.output,i=h-(b-a.avail_out),j=h+(a.avail_out-257),k=c.dmax,l=c.wsize,m=c.whave,n=c.wnext,o=c.window,p=c.hold,q=c.bits,r=c.lencode,s=c.distcode,t=(1<<c.lenbits)-1,u=(1<<c.distbits)-1;a:do{q<15&&(p+=B[f++]<<q,q+=8,p+=B[f++]<<q,q+=8),v=r[p&t];b:for(;;){if(w=v>>>24,p>>>=w,q-=w,w=v>>>16&255,0===w)C[h++]=65535&v;else{if(!(16&w)){if(0===(64&w)){v=r[(65535&v)+(p&(1<<w)-1)];continue b}if(32&w){c.mode=e;break a}a.msg="invalid literal/length code",c.mode=d;break a}x=65535&v,w&=15,w&&(q<w&&(p+=B[f++]<<q,q+=8),x+=p&(1<<w)-1,p>>>=w,q-=w),q<15&&(p+=B[f++]<<q,q+=8,p+=B[f++]<<q,q+=8),v=s[p&u];c:for(;;){if(w=v>>>24,p>>>=w,q-=w,w=v>>>16&255,!(16&w)){if(0===(64&w)){v=s[(65535&v)+(p&(1<<w)-1)];continue c}a.msg="invalid distance code",c.mode=d;break a}if(y=65535&v,w&=15,q<w&&(p+=B[f++]<<q,q+=8,q<w&&(p+=B[f++]<<q,q+=8)),y+=p&(1<<w)-1,y>k){a.msg="invalid distance too far back",c.mode=d;break a}if(p>>>=w,q-=w,w=h-i,y>w){if(w=y-w,w>m&&c.sane){a.msg="invalid distance too far back",c.mode=d;break a}if(z=0,A=o,0===n){if(z+=l-w,w<x){x-=w;do C[h++]=o[z++];while(--w);z=h-y,A=C}}else if(n<w){if(z+=l+n-w,w-=n,w<x){x-=w;do C[h++]=o[z++];while(--w);if(z=0,n<x){w=n,x-=w;do C[h++]=o[z++];while(--w);z=h-y,A=C}}}else if(z+=n-w,w<x){x-=w;do C[h++]=o[z++];while(--w);z=h-y,A=C}for(;x>2;)C[h++]=A[z++],C[h++]=A[z++],C[h++]=A[z++],x-=3;x&&(C[h++]=A[z++],x>1&&(C[h++]=A[z++]))}else{z=h-y;do C[h++]=C[z++],C[h++]=C[z++],C[h++]=C[z++],x-=3;while(x>2);x&&(C[h++]=C[z++],x>1&&(C[h++]=C[z++]))}break}}break}}while(f<g&&h<j);x=q>>3,f-=x,q-=x<<3,p&=(1<<q)-1,a.next_in=f,a.next_out=h,a.avail_in=f<g?5+(g-f):5-(f-g),a.avail_out=h<j?257+(j-h):257-(h-j),c.hold=p,c.bits=q}},{}],70:[function(a,b,c){"use strict";function d(a){return(a>>>24&255)+(a>>>8&65280)+((65280&a)<<8)+((255&a)<<24)}function e(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new s.Buf16(320),this.work=new s.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function f(a){var b;return a&&a.state?(b=a.state,a.total_in=a.total_out=b.total=0,a.msg="",b.wrap&&(a.adler=1&b.wrap),b.mode=L,b.last=0,b.havedict=0,b.dmax=32768,b.head=null,b.hold=0,b.bits=0,b.lencode=b.lendyn=new s.Buf32(pa),b.distcode=b.distdyn=new s.Buf32(qa),b.sane=1,b.back=-1,D):G}function g(a){var b;return a&&a.state?(b=a.state,b.wsize=0,b.whave=0,b.wnext=0,f(a)):G}function h(a,b){var c,d;return a&&a.state?(d=a.state,b<0?(c=0,b=-b):(c=(b>>4)+1,b<48&&(b&=15)),b&&(b<8||b>15)?G:(null!==d.window&&d.wbits!==b&&(d.window=null),d.wrap=c,d.wbits=b,g(a))):G}function i(a,b){var c,d;return a?(d=new e,a.state=d,d.window=null,c=h(a,b),c!==D&&(a.state=null),c):G}function j(a){return i(a,sa)}function k(a){if(ta){var b;for(q=new s.Buf32(512),r=new s.Buf32(32),b=0;b<144;)a.lens[b++]=8;for(;b<256;)a.lens[b++]=9;for(;b<280;)a.lens[b++]=7;for(;b<288;)a.lens[b++]=8;for(w(y,a.lens,0,288,q,0,a.work,{bits:9}),b=0;b<32;)a.lens[b++]=5;w(z,a.lens,0,32,r,0,a.work,{bits:5}),ta=!1}a.lencode=q,a.lenbits=9,a.distcode=r,a.distbits=5}function l(a,b,c,d){var e,f=a.state;return null===f.window&&(f.wsize=1<<f.wbits,f.wnext=0,f.whave=0,f.window=new s.Buf8(f.wsize)),d>=f.wsize?(s.arraySet(f.window,b,c-f.wsize,f.wsize,0),f.wnext=0,f.whave=f.wsize):(e=f.wsize-f.wnext,e>d&&(e=d),s.arraySet(f.window,b,c-d,e,f.wnext),d-=e,d?(s.arraySet(f.window,b,c-d,d,0),f.wnext=d,f.whave=f.wsize):(f.wnext+=e,f.wnext===f.wsize&&(f.wnext=0),f.whave<f.wsize&&(f.whave+=e))),0}function m(a,b){var c,e,f,g,h,i,j,m,n,o,p,q,r,pa,qa,ra,sa,ta,ua,va,wa,xa,ya,za,Aa=0,Ba=new s.Buf8(4),Ca=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!a||!a.state||!a.output||!a.input&&0!==a.avail_in)return G;c=a.state,c.mode===W&&(c.mode=X),h=a.next_out,f=a.output,j=a.avail_out,g=a.next_in,e=a.input,i=a.avail_in,m=c.hold,n=c.bits,o=i,p=j,xa=D;a:for(;;)switch(c.mode){case L:if(0===c.wrap){c.mode=X;break}for(;n<16;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(2&c.wrap&&35615===m){c.check=0,Ba[0]=255&m,Ba[1]=m>>>8&255,c.check=u(c.check,Ba,2,0),m=0,n=0,c.mode=M;break}if(c.flags=0,c.head&&(c.head.done=!1),!(1&c.wrap)||(((255&m)<<8)+(m>>8))%31){a.msg="incorrect header check",c.mode=ma;break}if((15&m)!==K){a.msg="unknown compression method",c.mode=ma;break}if(m>>>=4,n-=4,wa=(15&m)+8,0===c.wbits)c.wbits=wa;else if(wa>c.wbits){a.msg="invalid window size",c.mode=ma;break}c.dmax=1<<wa,a.adler=c.check=1,c.mode=512&m?U:W,m=0,n=0;break;case M:for(;n<16;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(c.flags=m,(255&c.flags)!==K){a.msg="unknown compression method",c.mode=ma;break}if(57344&c.flags){a.msg="unknown header flags set",c.mode=ma;break}c.head&&(c.head.text=m>>8&1),512&c.flags&&(Ba[0]=255&m,Ba[1]=m>>>8&255,c.check=u(c.check,Ba,2,0)),m=0,n=0,c.mode=N;case N:for(;n<32;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.head&&(c.head.time=m),512&c.flags&&(Ba[0]=255&m,Ba[1]=m>>>8&255,Ba[2]=m>>>16&255,Ba[3]=m>>>24&255,c.check=u(c.check,Ba,4,0)),m=0,n=0,c.mode=O;case O:for(;n<16;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.head&&(c.head.xflags=255&m,c.head.os=m>>8),512&c.flags&&(Ba[0]=255&m,Ba[1]=m>>>8&255,c.check=u(c.check,Ba,2,0)),m=0,n=0,c.mode=P;case P:if(1024&c.flags){for(;n<16;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.length=m,c.head&&(c.head.extra_len=m),512&c.flags&&(Ba[0]=255&m,Ba[1]=m>>>8&255,c.check=u(c.check,Ba,2,0)),m=0,n=0}else c.head&&(c.head.extra=null);c.mode=Q;case Q:if(1024&c.flags&&(q=c.length,q>i&&(q=i),q&&(c.head&&(wa=c.head.extra_len-c.length,c.head.extra||(c.head.extra=new Array(c.head.extra_len)),s.arraySet(c.head.extra,e,g,q,wa)),512&c.flags&&(c.check=u(c.check,e,q,g)),i-=q,g+=q,c.length-=q),c.length))break a;c.length=0,c.mode=R;case R:if(2048&c.flags){if(0===i)break a;q=0;do wa=e[g+q++],c.head&&wa&&c.length<65536&&(c.head.name+=String.fromCharCode(wa));while(wa&&q<i);if(512&c.flags&&(c.check=u(c.check,e,q,g)),i-=q,g+=q,wa)break a}else c.head&&(c.head.name=null);c.length=0,c.mode=S;case S:if(4096&c.flags){if(0===i)break a;q=0;do wa=e[g+q++],c.head&&wa&&c.length<65536&&(c.head.comment+=String.fromCharCode(wa));while(wa&&q<i);if(512&c.flags&&(c.check=u(c.check,e,q,g)),i-=q,g+=q,wa)break a}else c.head&&(c.head.comment=null);c.mode=T;case T:if(512&c.flags){for(;n<16;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(m!==(65535&c.check)){a.msg="header crc mismatch",c.mode=ma;break}m=0,n=0}c.head&&(c.head.hcrc=c.flags>>9&1,c.head.done=!0),a.adler=c.check=0,c.mode=W;break;case U:for(;n<32;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}a.adler=c.check=d(m),m=0,n=0,c.mode=V;case V:if(0===c.havedict)return a.next_out=h,a.avail_out=j,a.next_in=g,a.avail_in=i,c.hold=m,c.bits=n,F;a.adler=c.check=1,c.mode=W;case W:if(b===B||b===C)break a;case X:if(c.last){m>>>=7&n,n-=7&n,c.mode=ja;break}for(;n<3;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}switch(c.last=1&m,m>>>=1,n-=1,3&m){case 0:c.mode=Y;break;case 1:if(k(c),c.mode=ca,b===C){m>>>=2,n-=2;break a}break;case 2:c.mode=_;break;case 3:a.msg="invalid block type",c.mode=ma}m>>>=2,n-=2;break;case Y:for(m>>>=7&n,n-=7&n;n<32;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if((65535&m)!==(m>>>16^65535)){a.msg="invalid stored block lengths",c.mode=ma;break}if(c.length=65535&m,m=0,n=0,c.mode=Z,b===C)break a;case Z:c.mode=$;case $:if(q=c.length){if(q>i&&(q=i),q>j&&(q=j),0===q)break a;s.arraySet(f,e,g,q,h),i-=q,g+=q,j-=q,h+=q,c.length-=q;break}c.mode=W;break;case _:for(;n<14;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(c.nlen=(31&m)+257,m>>>=5,n-=5,c.ndist=(31&m)+1,m>>>=5,n-=5,c.ncode=(15&m)+4,m>>>=4,n-=4,c.nlen>286||c.ndist>30){a.msg="too many length or distance symbols",c.mode=ma;break}c.have=0,c.mode=aa;case aa:for(;c.have<c.ncode;){for(;n<3;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.lens[Ca[c.have++]]=7&m,m>>>=3,n-=3}for(;c.have<19;)c.lens[Ca[c.have++]]=0;if(c.lencode=c.lendyn,c.lenbits=7,ya={bits:c.lenbits},xa=w(x,c.lens,0,19,c.lencode,0,c.work,ya),c.lenbits=ya.bits,xa){a.msg="invalid code lengths set",c.mode=ma;break}c.have=0,c.mode=ba;case ba:for(;c.have<c.nlen+c.ndist;){for(;Aa=c.lencode[m&(1<<c.lenbits)-1],qa=Aa>>>24,ra=Aa>>>16&255,sa=65535&Aa,!(qa<=n);){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(sa<16)m>>>=qa,n-=qa,c.lens[c.have++]=sa;else{if(16===sa){for(za=qa+2;n<za;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(m>>>=qa,n-=qa,0===c.have){a.msg="invalid bit length repeat",c.mode=ma;break}wa=c.lens[c.have-1],q=3+(3&m),m>>>=2,n-=2}else if(17===sa){for(za=qa+3;n<za;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}m>>>=qa,n-=qa,wa=0,q=3+(7&m),m>>>=3,n-=3}else{for(za=qa+7;n<za;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}m>>>=qa,n-=qa,wa=0,q=11+(127&m),m>>>=7,n-=7}if(c.have+q>c.nlen+c.ndist){a.msg="invalid bit length repeat",c.mode=ma;break}for(;q--;)c.lens[c.have++]=wa}}if(c.mode===ma)break;if(0===c.lens[256]){a.msg="invalid code -- missing end-of-block",c.mode=ma;break}if(c.lenbits=9,ya={bits:c.lenbits},xa=w(y,c.lens,0,c.nlen,c.lencode,0,c.work,ya),c.lenbits=ya.bits,xa){a.msg="invalid literal/lengths set",c.mode=ma;break}if(c.distbits=6,c.distcode=c.distdyn,ya={bits:c.distbits},xa=w(z,c.lens,c.nlen,c.ndist,c.distcode,0,c.work,ya),c.distbits=ya.bits,xa){a.msg="invalid distances set",c.mode=ma;break}if(c.mode=ca,b===C)break a;case ca:c.mode=da;case da:if(i>=6&&j>=258){a.next_out=h,a.avail_out=j,a.next_in=g,a.avail_in=i,c.hold=m,c.bits=n,v(a,p),h=a.next_out,f=a.output,j=a.avail_out,g=a.next_in,e=a.input,i=a.avail_in,m=c.hold,n=c.bits,c.mode===W&&(c.back=-1);break}for(c.back=0;Aa=c.lencode[m&(1<<c.lenbits)-1],qa=Aa>>>24,ra=Aa>>>16&255,sa=65535&Aa,!(qa<=n);){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(ra&&0===(240&ra)){for(ta=qa,ua=ra,va=sa;Aa=c.lencode[va+((m&(1<<ta+ua)-1)>>ta)],qa=Aa>>>24,ra=Aa>>>16&255,sa=65535&Aa,!(ta+qa<=n);){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}m>>>=ta,n-=ta,c.back+=ta}if(m>>>=qa,n-=qa,c.back+=qa,c.length=sa,0===ra){c.mode=ia;break}if(32&ra){c.back=-1,c.mode=W;break}if(64&ra){a.msg="invalid literal/length code",c.mode=ma;break}c.extra=15&ra,c.mode=ea;case ea:if(c.extra){for(za=c.extra;n<za;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.length+=m&(1<<c.extra)-1,m>>>=c.extra,n-=c.extra,c.back+=c.extra}c.was=c.length,c.mode=fa;case fa:for(;Aa=c.distcode[m&(1<<c.distbits)-1],qa=Aa>>>24,ra=Aa>>>16&255,sa=65535&Aa,!(qa<=n);){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(0===(240&ra)){for(ta=qa,ua=ra,va=sa;Aa=c.distcode[va+((m&(1<<ta+ua)-1)>>ta)],qa=Aa>>>24,ra=Aa>>>16&255,sa=65535&Aa,!(ta+qa<=n);){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}m>>>=ta,n-=ta,c.back+=ta}if(m>>>=qa,n-=qa,c.back+=qa,64&ra){a.msg="invalid distance code",c.mode=ma;break}c.offset=sa,c.extra=15&ra,c.mode=ga;case ga:if(c.extra){for(za=c.extra;n<za;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.offset+=m&(1<<c.extra)-1,m>>>=c.extra,n-=c.extra,c.back+=c.extra}if(c.offset>c.dmax){a.msg="invalid distance too far back",c.mode=ma;break}c.mode=ha;case ha:if(0===j)break a;if(q=p-j,c.offset>q){if(q=c.offset-q,q>c.whave&&c.sane){a.msg="invalid distance too far back",c.mode=ma;break}q>c.wnext?(q-=c.wnext,r=c.wsize-q):r=c.wnext-q,q>c.length&&(q=c.length),pa=c.window}else pa=f,r=h-c.offset,q=c.length;q>j&&(q=j),j-=q,c.length-=q;do f[h++]=pa[r++];while(--q);0===c.length&&(c.mode=da);break;case ia:if(0===j)break a;f[h++]=c.length,j--,c.mode=da;break;case ja:if(c.wrap){for(;n<32;){if(0===i)break a;i--,m|=e[g++]<<n,n+=8}if(p-=j,a.total_out+=p,c.total+=p,p&&(a.adler=c.check=c.flags?u(c.check,f,p,h-p):t(c.check,f,p,h-p)),p=j,(c.flags?m:d(m))!==c.check){a.msg="incorrect data check",c.mode=ma;break}m=0,n=0}c.mode=ka;case ka:if(c.wrap&&c.flags){for(;n<32;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(m!==(4294967295&c.total)){a.msg="incorrect length check",c.mode=ma;break}m=0,n=0}c.mode=la;case la:xa=E;break a;case ma:xa=H;break a;case na:return I;case oa:default:return G}return a.next_out=h,a.avail_out=j,a.next_in=g,a.avail_in=i,c.hold=m,c.bits=n,(c.wsize||p!==a.avail_out&&c.mode<ma&&(c.mode<ja||b!==A))&&l(a,a.output,a.next_out,p-a.avail_out)?(c.mode=na,I):(o-=a.avail_in,p-=a.avail_out,a.total_in+=o,a.total_out+=p,c.total+=p,c.wrap&&p&&(a.adler=c.check=c.flags?u(c.check,f,p,a.next_out-p):t(c.check,f,p,a.next_out-p)),a.data_type=c.bits+(c.last?64:0)+(c.mode===W?128:0)+(c.mode===ca||c.mode===Z?256:0),(0===o&&0===p||b===A)&&xa===D&&(xa=J),xa)}function n(a){if(!a||!a.state)return G;var b=a.state;return b.window&&(b.window=null),a.state=null,D}function o(a,b){var c;return a&&a.state?(c=a.state,0===(2&c.wrap)?G:(c.head=b,b.done=!1,D)):G}function p(a,b){var c,d,e,f=b.length;return a&&a.state?(c=a.state,0!==c.wrap&&c.mode!==V?G:c.mode===V&&(d=1,d=t(d,b,f,0),d!==c.check)?H:(e=l(a,b,f,f))?(c.mode=na,I):(c.havedict=1,D)):G}var q,r,s=a("../utils/common"),t=a("./adler32"),u=a("./crc32"),v=a("./inffast"),w=a("./inftrees"),x=0,y=1,z=2,A=4,B=5,C=6,D=0,E=1,F=2,G=-2,H=-3,I=-4,J=-5,K=8,L=1,M=2,N=3,O=4,P=5,Q=6,R=7,S=8,T=9,U=10,V=11,W=12,X=13,Y=14,Z=15,$=16,_=17,aa=18,ba=19,ca=20,da=21,ea=22,fa=23,ga=24,ha=25,ia=26,ja=27,ka=28,la=29,ma=30,na=31,oa=32,pa=852,qa=592,ra=15,sa=ra,ta=!0;c.inflateReset=g,c.inflateReset2=h,c.inflateResetKeep=f,c.inflateInit=j,c.inflateInit2=i,c.inflate=m,c.inflateEnd=n,c.inflateGetHeader=o,c.inflateSetDictionary=p,c.inflateInfo="pako inflate (from Nodeca project)"},{"../utils/common":62,"./adler32":64,"./crc32":66,"./inffast":69,"./inftrees":71}],71:[function(a,b,c){"use strict";var d=a("../utils/common"),e=15,f=852,g=592,h=0,i=1,j=2,k=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],l=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],m=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],n=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];b.exports=function(a,b,c,o,p,q,r,s){var t,u,v,w,x,y,z,A,B,C=s.bits,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=null,O=0,P=new d.Buf16(e+1),Q=new d.Buf16(e+1),R=null,S=0;for(D=0;D<=e;D++)P[D]=0;for(E=0;E<o;E++)P[b[c+E]]++;for(H=C,G=e;G>=1&&0===P[G];G--);if(H>G&&(H=G),0===G)return p[q++]=20971520,p[q++]=20971520,s.bits=1,0;for(F=1;F<G&&0===P[F];F++);for(H<F&&(H=F),K=1,D=1;D<=e;D++)if(K<<=1,K-=P[D],K<0)return-1;if(K>0&&(a===h||1!==G))return-1;for(Q[1]=0,D=1;D<e;D++)Q[D+1]=Q[D]+P[D];for(E=0;E<o;E++)0!==b[c+E]&&(r[Q[b[c+E]]++]=E);if(a===h?(N=R=r,y=19):a===i?(N=k,O-=257,R=l,S-=257,y=256):(N=m,R=n,y=-1),M=0,E=0,D=F,x=q,I=H,J=0,v=-1,L=1<<H,w=L-1,a===i&&L>f||a===j&&L>g)return 1;for(;;){z=D-J,r[E]<y?(A=0,B=r[E]):r[E]>y?(A=R[S+r[E]],B=N[O+r[E]]):(A=96,B=0),t=1<<D-J,u=1<<I,F=u;do u-=t,p[x+(M>>J)+u]=z<<24|A<<16|B|0;while(0!==u);for(t=1<<D-1;M&t;)t>>=1;if(0!==t?(M&=t-1,M+=t):M=0,E++,0===--P[D]){if(D===G)break;D=b[c+r[E]]}if(D>H&&(M&w)!==v){for(0===J&&(J=H),x+=F,I=D-J,K=1<<I;I+J<G&&(K-=P[I+J],!(K<=0));)I++,K<<=1;if(L+=1<<I,a===i&&L>f||a===j&&L>g)return 1;v=M&w,p[v]=H<<24|I<<16|x-q|0}}return 0!==M&&(p[x+M]=D-J<<24|64<<16|0),s.bits=H,0}},{"../utils/common":62}],72:[function(a,b,c){"use strict";b.exports={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"}},{}],73:[function(a,b,c){"use strict";function d(a){for(var b=a.length;--b>=0;)a[b]=0}function e(a,b,c,d,e){this.static_tree=a,this.extra_bits=b,this.extra_base=c,this.elems=d,this.max_length=e,this.has_stree=a&&a.length}function f(a,b){this.dyn_tree=a,this.max_code=0,this.stat_desc=b}function g(a){return a<256?ia[a]:ia[256+(a>>>7)]}function h(a,b){a.pending_buf[a.pending++]=255&b,a.pending_buf[a.pending++]=b>>>8&255}function i(a,b,c){a.bi_valid>X-c?(a.bi_buf|=b<<a.bi_valid&65535,h(a,a.bi_buf),a.bi_buf=b>>X-a.bi_valid,a.bi_valid+=c-X):(a.bi_buf|=b<<a.bi_valid&65535,a.bi_valid+=c)}function j(a,b,c){i(a,c[2*b],c[2*b+1])}function k(a,b){var c=0;do c|=1&a,a>>>=1,c<<=1;while(--b>0);return c>>>1}function l(a){16===a.bi_valid?(h(a,a.bi_buf),a.bi_buf=0,a.bi_valid=0):a.bi_valid>=8&&(a.pending_buf[a.pending++]=255&a.bi_buf,a.bi_buf>>=8,a.bi_valid-=8)}function m(a,b){var c,d,e,f,g,h,i=b.dyn_tree,j=b.max_code,k=b.stat_desc.static_tree,l=b.stat_desc.has_stree,m=b.stat_desc.extra_bits,n=b.stat_desc.extra_base,o=b.stat_desc.max_length,p=0;for(f=0;f<=W;f++)a.bl_count[f]=0;for(i[2*a.heap[a.heap_max]+1]=0,
c=a.heap_max+1;c<V;c++)d=a.heap[c],f=i[2*i[2*d+1]+1]+1,f>o&&(f=o,p++),i[2*d+1]=f,d>j||(a.bl_count[f]++,g=0,d>=n&&(g=m[d-n]),h=i[2*d],a.opt_len+=h*(f+g),l&&(a.static_len+=h*(k[2*d+1]+g)));if(0!==p){do{for(f=o-1;0===a.bl_count[f];)f--;a.bl_count[f]--,a.bl_count[f+1]+=2,a.bl_count[o]--,p-=2}while(p>0);for(f=o;0!==f;f--)for(d=a.bl_count[f];0!==d;)e=a.heap[--c],e>j||(i[2*e+1]!==f&&(a.opt_len+=(f-i[2*e+1])*i[2*e],i[2*e+1]=f),d--)}}function n(a,b,c){var d,e,f=new Array(W+1),g=0;for(d=1;d<=W;d++)f[d]=g=g+c[d-1]<<1;for(e=0;e<=b;e++){var h=a[2*e+1];0!==h&&(a[2*e]=k(f[h]++,h))}}function o(){var a,b,c,d,f,g=new Array(W+1);for(c=0,d=0;d<Q-1;d++)for(ka[d]=c,a=0;a<1<<ba[d];a++)ja[c++]=d;for(ja[c-1]=d,f=0,d=0;d<16;d++)for(la[d]=f,a=0;a<1<<ca[d];a++)ia[f++]=d;for(f>>=7;d<T;d++)for(la[d]=f<<7,a=0;a<1<<ca[d]-7;a++)ia[256+f++]=d;for(b=0;b<=W;b++)g[b]=0;for(a=0;a<=143;)ga[2*a+1]=8,a++,g[8]++;for(;a<=255;)ga[2*a+1]=9,a++,g[9]++;for(;a<=279;)ga[2*a+1]=7,a++,g[7]++;for(;a<=287;)ga[2*a+1]=8,a++,g[8]++;for(n(ga,S+1,g),a=0;a<T;a++)ha[2*a+1]=5,ha[2*a]=k(a,5);ma=new e(ga,ba,R+1,S,W),na=new e(ha,ca,0,T,W),oa=new e(new Array(0),da,0,U,Y)}function p(a){var b;for(b=0;b<S;b++)a.dyn_ltree[2*b]=0;for(b=0;b<T;b++)a.dyn_dtree[2*b]=0;for(b=0;b<U;b++)a.bl_tree[2*b]=0;a.dyn_ltree[2*Z]=1,a.opt_len=a.static_len=0,a.last_lit=a.matches=0}function q(a){a.bi_valid>8?h(a,a.bi_buf):a.bi_valid>0&&(a.pending_buf[a.pending++]=a.bi_buf),a.bi_buf=0,a.bi_valid=0}function r(a,b,c,d){q(a),d&&(h(a,c),h(a,~c)),G.arraySet(a.pending_buf,a.window,b,c,a.pending),a.pending+=c}function s(a,b,c,d){var e=2*b,f=2*c;return a[e]<a[f]||a[e]===a[f]&&d[b]<=d[c]}function t(a,b,c){for(var d=a.heap[c],e=c<<1;e<=a.heap_len&&(e<a.heap_len&&s(b,a.heap[e+1],a.heap[e],a.depth)&&e++,!s(b,d,a.heap[e],a.depth));)a.heap[c]=a.heap[e],c=e,e<<=1;a.heap[c]=d}function u(a,b,c){var d,e,f,h,k=0;if(0!==a.last_lit)do d=a.pending_buf[a.d_buf+2*k]<<8|a.pending_buf[a.d_buf+2*k+1],e=a.pending_buf[a.l_buf+k],k++,0===d?j(a,e,b):(f=ja[e],j(a,f+R+1,b),h=ba[f],0!==h&&(e-=ka[f],i(a,e,h)),d--,f=g(d),j(a,f,c),h=ca[f],0!==h&&(d-=la[f],i(a,d,h)));while(k<a.last_lit);j(a,Z,b)}function v(a,b){var c,d,e,f=b.dyn_tree,g=b.stat_desc.static_tree,h=b.stat_desc.has_stree,i=b.stat_desc.elems,j=-1;for(a.heap_len=0,a.heap_max=V,c=0;c<i;c++)0!==f[2*c]?(a.heap[++a.heap_len]=j=c,a.depth[c]=0):f[2*c+1]=0;for(;a.heap_len<2;)e=a.heap[++a.heap_len]=j<2?++j:0,f[2*e]=1,a.depth[e]=0,a.opt_len--,h&&(a.static_len-=g[2*e+1]);for(b.max_code=j,c=a.heap_len>>1;c>=1;c--)t(a,f,c);e=i;do c=a.heap[1],a.heap[1]=a.heap[a.heap_len--],t(a,f,1),d=a.heap[1],a.heap[--a.heap_max]=c,a.heap[--a.heap_max]=d,f[2*e]=f[2*c]+f[2*d],a.depth[e]=(a.depth[c]>=a.depth[d]?a.depth[c]:a.depth[d])+1,f[2*c+1]=f[2*d+1]=e,a.heap[1]=e++,t(a,f,1);while(a.heap_len>=2);a.heap[--a.heap_max]=a.heap[1],m(a,b),n(f,j,a.bl_count)}function w(a,b,c){var d,e,f=-1,g=b[1],h=0,i=7,j=4;for(0===g&&(i=138,j=3),b[2*(c+1)+1]=65535,d=0;d<=c;d++)e=g,g=b[2*(d+1)+1],++h<i&&e===g||(h<j?a.bl_tree[2*e]+=h:0!==e?(e!==f&&a.bl_tree[2*e]++,a.bl_tree[2*$]++):h<=10?a.bl_tree[2*_]++:a.bl_tree[2*aa]++,h=0,f=e,0===g?(i=138,j=3):e===g?(i=6,j=3):(i=7,j=4))}function x(a,b,c){var d,e,f=-1,g=b[1],h=0,k=7,l=4;for(0===g&&(k=138,l=3),d=0;d<=c;d++)if(e=g,g=b[2*(d+1)+1],!(++h<k&&e===g)){if(h<l){do j(a,e,a.bl_tree);while(0!==--h)}else 0!==e?(e!==f&&(j(a,e,a.bl_tree),h--),j(a,$,a.bl_tree),i(a,h-3,2)):h<=10?(j(a,_,a.bl_tree),i(a,h-3,3)):(j(a,aa,a.bl_tree),i(a,h-11,7));h=0,f=e,0===g?(k=138,l=3):e===g?(k=6,l=3):(k=7,l=4)}}function y(a){var b;for(w(a,a.dyn_ltree,a.l_desc.max_code),w(a,a.dyn_dtree,a.d_desc.max_code),v(a,a.bl_desc),b=U-1;b>=3&&0===a.bl_tree[2*ea[b]+1];b--);return a.opt_len+=3*(b+1)+5+5+4,b}function z(a,b,c,d){var e;for(i(a,b-257,5),i(a,c-1,5),i(a,d-4,4),e=0;e<d;e++)i(a,a.bl_tree[2*ea[e]+1],3);x(a,a.dyn_ltree,b-1),x(a,a.dyn_dtree,c-1)}function A(a){var b,c=4093624447;for(b=0;b<=31;b++,c>>>=1)if(1&c&&0!==a.dyn_ltree[2*b])return I;if(0!==a.dyn_ltree[18]||0!==a.dyn_ltree[20]||0!==a.dyn_ltree[26])return J;for(b=32;b<R;b++)if(0!==a.dyn_ltree[2*b])return J;return I}function B(a){pa||(o(),pa=!0),a.l_desc=new f(a.dyn_ltree,ma),a.d_desc=new f(a.dyn_dtree,na),a.bl_desc=new f(a.bl_tree,oa),a.bi_buf=0,a.bi_valid=0,p(a)}function C(a,b,c,d){i(a,(L<<1)+(d?1:0),3),r(a,b,c,!0)}function D(a){i(a,M<<1,3),j(a,Z,ga),l(a)}function E(a,b,c,d){var e,f,g=0;a.level>0?(a.strm.data_type===K&&(a.strm.data_type=A(a)),v(a,a.l_desc),v(a,a.d_desc),g=y(a),e=a.opt_len+3+7>>>3,f=a.static_len+3+7>>>3,f<=e&&(e=f)):e=f=c+5,c+4<=e&&b!==-1?C(a,b,c,d):a.strategy===H||f===e?(i(a,(M<<1)+(d?1:0),3),u(a,ga,ha)):(i(a,(N<<1)+(d?1:0),3),z(a,a.l_desc.max_code+1,a.d_desc.max_code+1,g+1),u(a,a.dyn_ltree,a.dyn_dtree)),p(a),d&&q(a)}function F(a,b,c){return a.pending_buf[a.d_buf+2*a.last_lit]=b>>>8&255,a.pending_buf[a.d_buf+2*a.last_lit+1]=255&b,a.pending_buf[a.l_buf+a.last_lit]=255&c,a.last_lit++,0===b?a.dyn_ltree[2*c]++:(a.matches++,b--,a.dyn_ltree[2*(ja[c]+R+1)]++,a.dyn_dtree[2*g(b)]++),a.last_lit===a.lit_bufsize-1}var G=a("../utils/common"),H=4,I=0,J=1,K=2,L=0,M=1,N=2,O=3,P=258,Q=29,R=256,S=R+1+Q,T=30,U=19,V=2*S+1,W=15,X=16,Y=7,Z=256,$=16,_=17,aa=18,ba=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],ca=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],da=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7],ea=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],fa=512,ga=new Array(2*(S+2));d(ga);var ha=new Array(2*T);d(ha);var ia=new Array(fa);d(ia);var ja=new Array(P-O+1);d(ja);var ka=new Array(Q);d(ka);var la=new Array(T);d(la);var ma,na,oa,pa=!1;c._tr_init=B,c._tr_stored_block=C,c._tr_flush_block=E,c._tr_tally=F,c._tr_align=D},{"../utils/common":62}],74:[function(a,b,c){"use strict";function d(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0}b.exports=d},{}]},{},[10])(10)});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)

},{"buffer":2}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
								value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mvc = require('./lib/mvc.js');

var _IStore = require('./store/IStore.js');

var _IStore2 = _interopRequireDefault(_IStore);

var _dryDom = require('./lib/dry-dom.js');

var _dryDom2 = _interopRequireDefault(_dryDom);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

window.strldr = require("./lib/strldr.js");

var App = function () {
								function App() {
																_classCallCheck(this, App);

																window.store = this.store;

																this.pool.add(this);

																this.models = [];

																this.store.onload = this.init.bind(this);
								}

								_createClass(App, [{
																key: 'init',
																value: function init() {
																								var _this = this;

																								document.body.addEventListener("keydown", function (evt) {
																																_this.pool.call("onPress" + evt.code);
																																// console.log(evt);
																								});

																								document.body.addEventListener("keyup", function (evt) {
																																_this.pool.call("onRelease" + evt.code);
																																// console.log(evt);
																								});

																								this.controllers.forEach(function (controller) {
																																_this.pool.add(controller);
																								});

																								this.pool.call("enterSplash");

																								setInterval(this.commit.bind(this), 3000);

																								var pending = 2;
																								this.openModel("app", done.bind(this));
																								setTimeout(done.bind(this), 1000);

																								function done() {
																																pending--;
																																if (!pending) this.pool.call("exitSplash");
																								}
																}
								}, {
																key: 'openModel',
																value: function openModel(name, cb, model) {
																								var _this2 = this;

																								var oldModel = this.models.find(function (obj) {
																																return obj.name == name;
																								});

																								if (oldModel) {

																																if (oldModel == model) return;
																																this.closeModel(name);
																								}

																								var path = name;

																								if (typeof model == "string") {
																																path = model;
																																model = null;
																								}

																								if (!model) model = new _mvc.Model();

																								this.root.setItem(name, model.data);

																								this.models[this.models.length] = {
																																model: model,
																																name: name,
																																path: path,
																																dirty: false
																								};

																								this.store.getTextItem(path, function (data) {

																																if (data) {
																																								model.load(JSON.parse(data));
																																								if (model.getItem("expires") > new Date().getTime()) {
																																																model.dirty = false;
																																																cb.call();
																																																return;
																																								}
																																}

																																_this2.pool.call(name + "ModelInit", model, cb);
																								});
																}
								}, {
																key: 'closeModel',
																value: function closeModel(name) {
																								// to-do: find, commit, remove from this.models
																}
								}, {
																key: 'appModelInit',
																value: function appModelInit(model, cb) {

																								var repoURL = ["http://www.crait.net/arduboy/repo2.json", "http://arduboy.ried.cl/repo.json", "repo.json"];

																								if (navigator.userAgent.indexOf("Electron") == -1 && typeof cordova == "undefined") {
																																// model.setItem("proxy", "https://crossorigin.me/");
																																model.setItem("proxy", "https://cors-anywhere.herokuapp.com/");
																																repoURL = repoURL.map(function (url) {
																																								return (/^https?.*/.test(url) ? model.getItem("proxy") : "") + url;
																																});
																								} else {
																																model.setItem("proxy", "");
																								}

																								var items = [];
																								var pending = 3;

																								repoURL.forEach(function (url) {
																																return fetch(url).then(function (rsp) {
																																								return rsp.json();
																																}).then(add).catch(function (err) {
																																								console.log(err);
																																								done();
																																});
																								});

																								function add(json) {

																																if (json && json.items) {

																																								json.items.forEach(function (item) {

																																																item.author = item.author || "<<unknown>>";

																																																if (item.banner && (!item.screenshots || !item.screenshots[0] || !item.screenshots[0].filename)) item.screenshots = [{ filename: item.banner }];

																																																if (item.arduboy && (!item.binaries || !item.binaries[0] || !item.binaries[0].filename)) item.binaries = [{ filename: item.arduboy }];

																																																items.push(item);
																																								});
																																}

																																done();
																								}

																								function done() {
																																pending--;

																																if (!pending) {
																																								items = items.sort(function (a, b) {
																																																if (a.title > b.title) return 1;
																																																if (a.title < b.title) return -1;
																																																return 0;
																																								});
																																								model.removeItem("repo");
																																								model.setItem("repo", items);
																																								model.setItem("expires", new Date().getTime() + 60 * 60 * 1000);
																																								cb();
																																}
																								}
																}
								}, {
																key: 'commit',
																value: function commit() {

																								for (var i = 0; i < this.models.length; ++i) {

																																var obj = this.models[i];
																																if (!obj.dirty && obj.model.dirty) {

																																								obj.dirty = true;
																																								obj.model.dirty = false;
																																} else if (obj.dirty && !obj.model.dirty) {

																																								obj.dirty = false;
																																								this.store.setItem(obj.path, JSON.stringify(obj.model.data));
																																} else if (obj.dirty && obj.model.dirty) {

																																								obj.model.dirty = false;
																																}
																								}
																}
								}, {
																key: 'setActiveView',
																value: function setActiveView(view) {
																								[].concat(_toConsumableArray(this.DOM.element.children)).forEach(function (node) {
																																return node.parentElement.removeChild(node);
																								});
																}
								}]);

								return App;
}();

App["@inject"] = {
								DOM: _dryDom2.default,
								store: _IStore2.default,
								pool: "pool",
								controllers: [_mvc.IController, []],
								root: [_mvc.Model, { scope: "root" }]
};
exports.default = App;

},{"./lib/dry-dom.js":24,"./lib/mvc.js":26,"./lib/strldr.js":28,"./store/IStore.js":30}],7:[function(require,module,exports){
"use strict";

var _write, _read;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

module.exports = {

    write: (_write = {}, _defineProperty(_write, 0x15 + 0x20, function (value) {

        this.TOV0 = value & 1;
        this.OCF0A = value >> 1 & 1;
        this.OCF0B = value >> 2 & 1;
    }), _defineProperty(_write, 0x24 + 0x20, function (value) {

        this.WGM00 = value >> 0 & 1;
        this.WGM01 = value >> 1 & 1;
        this.COM0B0 = value >> 4 & 1;
        this.COM0B1 = value >> 5 & 1;
        this.COM0A0 = value >> 6 & 1;
        this.COM0A1 = value >> 7 & 1;

        this.updateState();

        // console.log(`TCCR0A:\n  WGM00:${this.WGM00}\n  WGM01:${this.WGM01}\n  COM0B0:${this.COM0B0}\n  COM0B1:${this.COM0B1}\n  COM0A0:${this.COM0A0}\n  COM0A1:${this.COM0A1}`);
    }), _defineProperty(_write, 0x25 + 0x20, function (value) {

        this.FOC0A = value >> 7 & 1;
        this.FOC0B = value >> 6 & 1;
        this.WGM02 = value >> 3 & 1;
        this.CS = value & 7;

        this.updateState();

        // console.log(`TCCR0B:\n  FOC0A:${this.FOC0A}\n  FOC0B:${this.FOC0B}\n  WGM02:${this.WGM02}`);

        // console.log( "PC=" + (this.core.pc<<1).toString(16) + " WRITE TCCR0B: #" + value.toString(16) + " : " + value );
    }), _defineProperty(_write, 0x27 + 0x20, function (value) {
        this.OCR0A = value;
        // console.log( "OCR0A = " + value );
    }), _defineProperty(_write, 0x28 + 0x20, function (value) {
        this.OCR0B = value;
        // console.log( "OCR0B = " + value );
    }), _defineProperty(_write, 0x6E, function _(value) {
        this.TOIE0 = value & 1;
        this.OCIE0A = value >> 1 & 1;
        this.OCIE0B = value >> 2 & 1;
    }), _write),

    init: function init() {
        this.tick = 0;
        this.WGM00 = 0;
        this.WGM01 = 0;
        this.COM0B0 = 0;
        this.COM0B1 = 0;
        this.COM0A0 = 0;
        this.COM0A1 = 0;
        this.FOC0A = 0;
        this.FOC0B = 0;
        this.WGM02 = 0;
        this.CS = 0;
        this.TOV0 = 0;

        this.TOIE0 = 0;
        this.OCIE0A = 0;
        this.OCIE0B = 0;

        this.time = 0;

        this.updateState = function () {

            var MAX = 0xFF,
                BOTTOM = 0,
                WGM00 = this.WGM00,
                WGM01 = this.WGM01,
                WGM02 = this.WGM02;

            if (WGM02 == 0 && WGM01 == 0 && WGM00 == 0) {
                this.mode = 0;
                console.log("Timer Mode: Normal (" + this.mode + ")");
            } else if (WGM02 == 0 && WGM01 == 0 && WGM00 == 1) {
                this.mode = 1;
                console.log("Timer Mode: PWM, phase correct (" + this.mode + ")");
            } else if (WGM02 == 0 && WGM01 == 1 && WGM00 == 0) {
                this.mode = 2;
                console.log("Timer Mode: CTC (" + this.mode + ")");
            } else if (WGM02 == 0 && WGM01 == 1 && WGM00 == 1) {
                this.mode = 3;
                console.log("Timer Mode: Fast PWM (" + this.mode + ")");
            } else if (WGM02 == 1 && WGM01 == 0 && WGM00 == 0) {
                this.mode = 4;
                console.log("Timer Mode: Reserved (" + this.mode + ")");
            } else if (WGM02 == 1 && WGM01 == 0 && WGM00 == 1) {
                this.mode = 5;
                console.log("Timer Mode: PWM, phase correct (" + this.mode + ")");
            } else if (WGM02 == 1 && WGM01 == 1 && WGM00 == 0) {
                this.mode = 6;
                console.log("Timer Mode: Reserved (" + this.mode + ")");
            } else if (WGM02 == 1 && WGM01 == 1 && WGM00 == 1) {
                this.mode = 7;
                console.log("Timer Mode: Fast PWM (" + this.mode + ")");
            }

            switch (this.CS) {
                case 0:
                    this.prescale = 0;break;
                case 1:
                    this.prescale = 1;break;
                case 2:
                    this.prescale = 8;break;
                case 3:
                    this.prescale = 64;break;
                case 4:
                    this.prescale = 256;break;
                case 5:
                    this.prescale = 1024;break;
                default:
                    this.prescale = 1;break;
            }
        };
    },

    read: (_read = {}, _defineProperty(_read, 0x15 + 0x20, function () {
        return !!this.TOV0 & 1 | this.OCF0A << 1 | this.OCF0B << 2;
    }), _defineProperty(_read, 0x26 + 0x20, function () {

        var tick = this.core.tick;

        var ticksSinceOVF = tick - this.tick;
        var interval = ticksSinceOVF / this.prescale | 0;
        if (!interval) return;

        var TCNT0 = 0x26 + 0x20;
        var cnt = this.core.memory[TCNT0] + interval;

        this.core.memory[TCNT0] += interval;

        this.tick += interval * this.prescale;

        this.TOV0 += cnt / 0xFF | 0;
    }), _read),

    update: function update(tick, ie) {

        var ticksSinceOVF = tick - this.tick;
        var interval = ticksSinceOVF / this.prescale | 0;

        if (interval) {
            var TCNT0 = 0x26 + 0x20;
            var cnt = this.core.memory[TCNT0] + interval;

            this.core.memory[TCNT0] += interval;

            this.tick += interval * this.prescale;

            this.TOV0 += cnt / 0xFF | 0;
        }

        if (this.TOV0 > 0 && ie) {
            this.TOV0--;
            return "TIMER0O";
        }
    }

};

},{}],8:[function(require,module,exports){
"use strict";

module.exports = {

    write: {
        0xC0: function _(value) {
            return this.UCSR0A = this.UCSR0A & 188 | value & 67;
        },
        0xC1: function _(value) {
            return this.UCSR0B = value;
        },
        0xC2: function _(value) {
            return this.UCSR0C = value;
        },
        0xC4: function _(value) {
            return this.UBRR0L = value;
        },
        0xC5: function _(value) {
            return this.UBRR0H = value;
        },
        0xC6: function _(value) {
            this.core.pins.serial0 = (this.core.pins.serial0 || "") + String.fromCharCode(value);return this.UDR0 = value;
        }
    },

    read: {
        0xC0: function _() {
            return this.UCSR0A;
        },
        0xC1: function _() {
            return this.UCSR0B;
        },
        0xC2: function _() {
            return this.UCSR0C;
        },
        0xC4: function _() {
            return this.UBRR0L;
        },
        0xC5: function _() {
            return this.UBRR0H & 0x0F;
        },
        0xC6: function _() {
            return this.UDR0;
        }
    },

    init: function init() {
        this.UCSR0A = 0x20;
        this.UCSR0B = 0;
        this.UCSR0C = 0x06;
        this.UBRR0L = 0; // USART Baud Rate 0 Register Low
        this.UBRR0H = 0; // USART Baud Rate 0 Register High            
        this.UDR0 = 0;
    },

    update: function update(tick, ie) {}

};

},{}],9:[function(require,module,exports){
'use strict';

var _write, _write2, _write3;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

module.exports = {

    PORTB: {
        write: (_write = {}, _defineProperty(_write, 0x04 + 0x20, function (value) {
            this.core.pins.DDRB = value;
        }), _defineProperty(_write, 0x05 + 0x20, function (value, oldValue) {

            if (oldValue == value) return;

            /*
                          if( typeof document != "undefined" ){
                              if( value & 0x20 ) document.body.style.backgroundColor = "black";
                              else document.body.style.backgroundColor = "white";
                          }else if( typeof WorkerGlobalScope == "undefined" ){
                              if( value & 0x20 ) console.log( "LED ON #", (this.core.pc<<1).toString(16) );
                              else console.log( "LED OFF #", (this.core.pc<<1).toString(16) );
                          }
            */

            this.core.pins.PORTB = value;

            // console.log("worker@" + this.core.pc.toString(16) + "[tick " + (this.core.tick / this.core.clock * 1000).toFixed(3) + "]", " PORTB = ", value.toString(2));
        }), _write),
        read: _defineProperty({}, 0x03 + 0x20, function () {
            return this.PINB & 0xFF | 0;
        }),
        init: function init() {
            var _this = this;

            this.PINB = 0;
            Object.defineProperty(this.core.pins, "PINB", {
                set: function set(v) {
                    return _this.PINB = v >>> 0 & 0xFF;
                },
                get: function get() {
                    return _this.PINB;
                }
            });
        }
    },

    PORTC: {
        write: (_write2 = {}, _defineProperty(_write2, 0x07 + 0x20, function (value) {
            this.core.pins.DDRC = value;
        }), _defineProperty(_write2, 0x08 + 0x20, function (value) {
            this.core.pins.PORTC = value;
        }), _write2),
        read: _defineProperty({}, 0x06 + 0x20, function () {
            return this.core.pins.PINC = this.core.pins.PINC & 0xFF || 0;
        })
    },

    PORTD: {
        write: (_write3 = {}, _defineProperty(_write3, 0x0A + 0x20, function (value) {
            this.core.pins.DDRD = value;
        }), _defineProperty(_write3, 0x0B + 0x20, function (value) {
            this.core.pins.PORTD = value;
        }), _write3),
        read: _defineProperty({}, 0x09 + 0x20, function () {
            return this.core.pins.PIND = this.core.pins.PIND & 0xFF || 0;
        })
    },

    TC: require('./At328P-TC.js'),

    USART: require('./At328P-USART.js')

};

},{"./At328P-TC.js":7,"./At328P-USART.js":8}],10:[function(require,module,exports){
"use strict";

module.exports = {
			init: function init() {
						this.SPDR = 0;
						this.SPIF = 0;
						this.WCOL = 0;
						this.SPI2X = 0;
						this.SPIE = 0;
						this.SPE = 0;
						this.DORD = 0;
						this.MSTR = 0;
						this.CPOL = 0;
						this.CPHA = 0;
						this.SPR1 = 0;
						this.SPR0 = 0;
						this.core.pins.spiOut = this.core.pins.spiOut || [];
			},

			write: {
						0x4C: function _(value, oldValue) {
									this.SPIE = value >> 7;
									this.SPE = value >> 6;
									this.DORD = value >> 5;
									this.MSTR = value >> 4;
									this.CPOL = value >> 3;
									this.CPHA = value >> 2;
									this.SPR1 = value >> 1;
									this.SPR0 = value >> 0;
						},

						0x4D: function _(value, oldValue) {
									this.SPI2X = value & 1;
									return this.SPIF << 7 | this.WCOL << 6 | this.SPI2X;
						},
						0x4E: function _(value) {
									this.SPDR = value;
									this.core.pins.spiOut.push(value);
									this.SPIF = 1;
						}
			},

			read: {
						0x4D: function _() {
									this.SPIF = !!this.core.pins.spiIn.length | 0;
									return this.SPIF << 7 | this.WCOL << 6 | this.SPI2X;
						},
						0x4E: function _() {
									var spiIn = this.core.pins.spiIn;
									if (spiIn.length) return this.SPDR = spiIn.shift();
									return this.SPDR;
						}
			},

			update: function update(tick, ie) {

						if (this.SPIF && this.SPIE && ie) {
									this.SPIF = 0;
									return "SPI";
						}
			}
};

},{}],11:[function(require,module,exports){
'use strict';

function port(obj) {

	var out = { write: {}, read: {}, init: null };

	for (var k in obj) {

		var addr = obj[k];
		if (/DDR.|PORT./.test(k)) {

			out.write[addr] = setter(k);
		} else {

			out.read[addr] = getter(k);
			out.init = init(k);
		}
	}

	function setter(k) {
		return function (value, oldValue) {
			if (value != oldValue) this.core.pins[k] = value;
		};
	}

	function getter(k) {
		return function () {
			return this[k] & 0xFF | 0;
		};
	}

	function init(k) {
		return function () {
			this[k] = 0;
			var _this = this;
			Object.defineProperty(this.core.pins, k, {
				set: function set(v) {
					return _this[k] = v >>> 0 & 0xFF;
				},
				get: function get() {
					return _this[k];
				}
			});
		};
	}

	return out;
}

module.exports = {

	PORTB: port({ PINB: 0x23, DDRB: 0x24, PORTB: 0x25 }),
	PORTC: port({ PINC: 0x26, DDRC: 0x27, PORTC: 0x28 }),
	PORTD: port({ PIND: 0x29, DDRD: 0x2A, PORTD: 0x2B }),
	PORTE: port({ PINE: 0x2C, DDRE: 0x2D, PORTE: 0x2E }),
	PORTF: port({ PINF: 0x2F, DDRF: 0x30, PORTF: 0x31 }),

	TC: require('./At328P-TC.js'),

	USART: require('./At328P-USART.js'),

	PLL: {
		read: {
			0x49: function _(value) {
				return this.PINDIV << 4 | this.PLLE << 1 | this.PLOCK;
			}
		},
		write: {
			0x49: function _(value, oldValue) {
				if (value === oldValue) return;
				this.PINDIV = value >> 4 & 1;
				this.PLLE = value >> 1 & 1;
				this.PLOCK = 1;
			}
		},
		init: function init() {
			this.PINDIV = 0;
			this.PLLE = 0;
			this.PLOCK = 0;
		}
	},

	SPI: require('./At32u4-SPI.js'),

	EEPROM: {
		write: {
			0x3F: function _(value, oldValue) {
				value &= ~2;
				return value;
			}
		},
		read: {},
		init: function init() {}
	},

	ADCSRA: {

		write: {
			0x7A: function _(value, oldValue) {
				this.ADEN = value >> 7 & 1;
				this.ADSC = value >> 6 & 1;
				this.ADATE = value >> 5 & 1;
				this.ADIF = value >> 4 & 1;
				this.ADIE = value >> 3 & 1;
				this.ADPS2 = value >> 2 & 1;
				this.ADPS1 = value >> 1 & 1;
				this.ADPS0 = value & 1;
				if (this.ADEN) {
					if (this.ADSC) {
						this.ADCH = Math.random() * 0xFF >>> 0;
						this.ADCL = Math.random() * 0xFF >>> 0;
						this.ADSC = 0;
						value &= ~(1 << 6);
					}
				}
				return value;
			}
		},

		read: {
			0x79: function _() {
				return this.ADCH;
			},
			0x78: function _() {
				return this.ADCL;
			}
		},

		init: function init() {
			this.ADEN = 0;
			this.ADSC = 0;
			this.ADATE = 0;
			this.ADIF = 0;
			this.ADIE = 0;
			this.ADPS2 = 0;
			this.ADPS1 = 0;
			this.ADPS0 = 0;
		},

		update: function update(tick, ie) {
			if (this.ADEN && this.ADIE) {
				this.ADIF = 1;
				this.ADSC = 0;
				this.ADCH = Math.random() * 0xFF >>> 0;
				this.ADCL = Math.random() * 0xFF >>> 0;
			}

			if (this.ADIF && this.ADIE && ie) {
				this.ADIF = 0;
				return "ADC";
			}
		}

	}

};

},{"./At328P-TC.js":7,"./At328P-USART.js":8,"./At32u4-SPI.js":10}],12:[function(require,module,exports){
(function (global){
"use strict";

// http://www.atmel.com/webdoc/avrassembler/avrassembler.wb_instruction_list.html

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function bin(bytes, size) {

    var s = (bytes >>> 0).toString(2);
    while (s.length < size) {
        s = "0" + s;
    }return s.replace(/([01]{4,4})/g, "$1 ") + "  #" + (bytes >>> 0).toString(16).toUpperCase();
}

if (typeof performance === "undefined") {
    if (Date.now) global.performance = { now: function now() {
            return Date.now();
        } };else global.performance = { now: function now() {
            return new Date().getTime();
        } };
}

var Atcore = function () {
    function Atcore(desc) {
        var _this = this;

        _classCallCheck(this, Atcore);

        if (!desc) return;

        this.sleeping = false;
        this.sreg = 0;
        this.pc = 0;
        this.sp = 0;
        this.clock = desc.clock;
        this.codec = desc.codec;
        this.interruptMap = desc.interrupt;
        this.error = 0;
        this.flags = desc.flags;
        this.tick = 0;
        this.startTick = 0;
        this.endTick = 0;
        this.execTime = 0;
        this.time = performance.now();

        this.i8a = new Int8Array(4);

        self.BREAKPOINTS = { 0: 0 };
        self.DUMP = function () {
            console.log('PC: #' + (_this.pc << 1).toString(16) + '\nSR: ' + _this.memory[0x5F].toString(2) + '\nSP: #' + _this.sp.toString(16) + '\n' + Array.prototype.map.call(_this.reg, function (v, i) {
                return 'R' + (i + '') + ' ' + (i < 10 ? ' ' : '') + '=\t#' + v.toString(16) + '\t' + v;
            }).join('\n'));
        };

        /*
        The I/O memory space contains 64 addresses for CPU peripheral functions as control registers, SPI, and other I/O functions.
        The I/O memory can be accessed directly, or as the data space locations following those of the register file, 0x20 - 0x5F. In
        addition, the ATmega328P has extended I/O space from 0x60 - 0xFF in SRAM where only the ST/STS/STD and
        LD/LDS/LDD instructions can be used.        
        */
        this.memory = new Uint8Array(32 // register file
        + (0xFF - 0x1F) // io
        + desc.sram);

        this.flash = new Uint8Array(desc.flash);
        this.eeprom = new Uint8Array(desc.eeprom);

        this.initMapping();
        this.instruction = null;
        this.periferals = {};
        this.pins = {};

        for (var periferalName in desc.periferals) {

            var addr = void 0,
                periferal = desc.periferals[periferalName];
            var obj = this.periferals[periferalName] = { core: this };

            for (addr in periferal.write) {
                this.writeMap[addr] = periferal.write[addr].bind(obj);
            }for (addr in periferal.read) {
                this.readMap[addr] = periferal.read[addr].bind(obj);
            }if (periferal.update) this.updateList.push(periferal.update.bind(obj));

            if (periferal.init) periferal.init.call(obj);
        }
    }

    _createClass(Atcore, [{
        key: "initMapping",
        value: function initMapping() {
            Object.defineProperties(this, {
                writeMap: { value: {}, enumerable: false, writable: false },
                readMap: { value: {}, enumerable: false, writable: false },
                updateList: { value: [], enumerable: false, writable: false },
                reg: { value: new Uint8Array(this.memory.buffer, 0, 0x20), enumerable: false },
                wreg: { value: new Uint16Array(this.memory.buffer, 0x20 - 8, 4), enumerable: false },
                sram: { value: new Uint8Array(this.memory.buffer, 0x100), enumerable: false },
                io: { value: new Uint8Array(this.memory.buffer, 0x20, 0xFF - 0x20), enumerable: false },
                prog: { value: new Uint16Array(this.flash.buffer), enumerable: false },
                native: { value: {}, enumerable: false }
            });

            this.codec.forEach(function (op) {
                if (op.str) parse(op);
                op.argv = Object.assign({}, op.args);
                op.bytes = op.bytes || 2;
                op.cycles = op.cycles || 1;
            });
        }
    }, {
        key: "read",
        value: function read(addr, pc) {
            var value = this.memory[addr];

            var periferal = this.readMap[addr];
            if (periferal) {
                var ret = periferal(value);
                if (ret !== undefined) value = ret;
            }

            // if( !({
            //     0x5d:1, // Stack Pointer Low
            //     0x5e:1, // Stack Pointer High
            //     0x5f:1, // status register
            //     0x25:1, // PORTB
            //     0x35:1, // TOV0
            //     0x23:1,  // PINB
            //     0x14B:1 // verbose USART stuff
            // })[addr] )
            // console.log( "READ: #", addr.toString(16) );

            return value;
        }
    }, {
        key: "readBit",
        value: function readBit(addr, bit, pc) {

            // if( !({
            //     0x5d:1, // Stack Pointer Low
            //     0x5e:1, // Stack Pointer High
            //     0x5f:1, // status register
            //     0x25:1, // PORTB
            //     0x35:1, // TOV0
            //     0x23:1  // PINB
            // })[addr] )
            // console.log( "PC=" + (pc<<1).toString(16) + " READ #" + (addr !== undefined ? addr.toString(16) : 'undefined') + " @ " + bit );

            var value = this.memory[addr];

            var periferal = this.readMap[addr];
            if (periferal) {
                var ret = periferal(value);
                if (ret !== undefined) value = ret;
            }

            return value >>> bit & 1;
        }
    }, {
        key: "write",
        value: function write(addr, value) {

            var periferal = this.writeMap[addr];

            if (periferal) {
                var ret = periferal(value, this.memory[addr]);
                if (ret === false) return;
                if (ret !== undefined) value = ret;
            }

            return this.memory[addr] = value;
        }
    }, {
        key: "writeBit",
        value: function writeBit(addr, bit, bvalue) {
            bvalue = !!bvalue | 0;
            var value = this.memory[addr];
            value = value & ~(1 << bit) | bvalue << bit;

            var periferal = this.writeMap[addr];

            if (periferal) {
                var ret = periferal(value, this.memory[addr]);
                if (ret === false) return;
                if (ret !== undefined) value = ret;
            }

            return this.memory[addr] = value;
        }
    }, {
        key: "exec",
        value: function exec(time) {
            var cycles = time * this.clock | 0;

            var start = this.tick;
            this.endTick = this.startTick + cycles;
            this.execTime = time;
            var lastUpdate = start;

            try {

                while (this.tick < this.endTick) {
                    if (!this.sleeping) {

                        if (this.pc > 0xFFFF) break;

                        var func = this.native[this.pc];
                        // if( !func ) 		    console.log( this.pc );
                        if (func) func.call(this);else if (!this.getBlock()) break;
                    } else {
                        this.tick += 100;
                    }

                    if (this.tick >= this.endTick || this.tick - lastUpdate > 1000) {
                        lastUpdate = this.tick;
                        this.updatePeriferals();
                    }
                }
            } finally {

                this.startTick = this.endTick;
            }
        }
    }, {
        key: "updatePeriferals",
        value: function updatePeriferals() {

            var interruptsEnabled = this.memory[0x5F] & 1 << 7;

            var updateList = this.updateList;

            for (var i = 0, l = updateList.length; i < l; ++i) {

                var ret = updateList[i](this.tick, interruptsEnabled);

                if (ret && interruptsEnabled) {
                    interruptsEnabled = 0;
                    this.sleeping = false;
                    this.interrupt(ret);
                }
            }
        }
    }, {
        key: "update",
        value: function update() {
            var now = performance.now();
            var delta = now - this.time;

            delta = Math.max(0, Math.min(33, delta));

            this.exec(delta / 1000);

            this.time = now;
        }
    }, {
        key: "getBlock",
        value: function getBlock() {
            var _this2 = this;

            var startPC = this.pc;

            var skip = false,
                prev = false;
            var nop = { name: 'NOP', cycles: 1, end: true, argv: {} };
            var cacheList = ['reg', 'wreg', 'io', 'memory', 'sram', 'flash'];
            var code = '"use strict";\nvar sp=this.sp, r, t1, i8a=this.i8a, SKIP=false, ';
            code += cacheList.map(function (c) {
                return c + " = this." + c;
            }).join(', ');
            code += ';\n';
            code += 'var sr = memory[0x5F]';
            for (var i = 0; i < 8; ++i) {
                code += ", sr" + i + " = (sr>>" + i + ")&1";
            }code += ';\n';

            // code += "console.log('\\nENTER BLOCK: " + (this.pc<<1).toString(16).toUpperCase() + " @ ', (this.pc<<1).toString(16).toUpperCase() );\n";
            // console.log('CREATE BLOCK: ', (this.pc<<1).toString(16).toUpperCase() );
            code += 'switch( this.pc ){\n';

            var addrs = [];

            do {

                var inst = this.identify();
                if (!inst) {
                    // inst = nop;
                    console.warn(this.error);
                    (function () {
                        debugger;
                    })();
                    return;
                }

                addrs.push(this.pc);

                code += "\ncase " + this.pc + ": // #" + (this.pc << 1).toString(16) + ": " + inst.name + ' [' + inst.decbytes.toString(2).padStart(16, "0") + ']' + '\n';

                var chunk = "\n                this.pc = " + this.pc + ";\n                if( (this.tick += " + inst.cycles + ") >= this.endTick ) break;\n                ";

                // BREAKPOINTS
                if (self.BREAKPOINTS && self.BREAKPOINTS[this.pc << 1] || inst.debug) {
                    chunk += "console.log('PC: #'+(this.pc<<1).toString(16)+'\\nSR: ' + memory[0x5F].toString(2) + '\\nSP: #' + sp.toString(16) + '\\n' + Array.prototype.map.call( reg, (v,i) => 'R'+(i+'')+' '+(i<10?' ':'')+'=\\t#'+v.toString(16) + '\\t' + v ).join('\\n') );\n";
                    chunk += '  debugger;\n';
                }

                var op = this.getOpcodeImpl(inst, inst.impl);
                var srDirty = op.srDirty;
                var line = op.begin,
                    endline = op.end;
                if (inst.flags) {
                    for (var i = 0, l = inst.flags.length; i < l; ++i) {
                        var flagOp = this.getOpcodeImpl(inst, this.flags[inst.flags[i]]);
                        line += flagOp.begin;
                        endline += flagOp.end;
                        srDirty |= flagOp.srDirty;
                    }
                }

                if (srDirty) {
                    var pres = (~srDirty >>> 0 & 0xFF).toString(2);
                    endline += "sr = (sr&0b" + pres + ") ";
                    for (var i = 0; i < 8; i++) {
                        if (srDirty & 1 << i) endline += " | (sr" + i + "<<" + i + ")";
                    }endline += ';\nmemory[0x5F] = sr;\n';
                }

                chunk += line + endline;

                if (skip) code += "  if( !SKIP ){\n    " + chunk + "\n  }\nSKIP = false;\n";else code += chunk;

                prev = skip;
                skip = inst.skip;

                this.pc += inst.bytes >> 1;
            } while (this.pc < this.prog.length && (!inst.end || skip || prev));

            code += "\nthis.pc = " + this.pc + ";\n";
            code += "break;\ndefault: this.tick += 2; console.warn('fell through #' + (this.pc++<<1).toString(16));\n";
            code += "\n\n}";
            // code += cacheList.map(c=>`this.${c} = ${c};`).join('\n');
            code += 'this.sp = sp;\n';

            var endPC = this.pc;
            this.pc = startPC;

            code = "return (function _" + (startPC << 1).toString(16) + "(){\n" + code + "});";

            try {
                var func = new Function(code)();

                for (var i = 0; i < addrs.length; ++i) {
                    this.native[addrs[i]] = func;
                }func.call(this);
            } catch (ex) {

                setTimeout(function () {
                    debugger;
                    var func = new Function(code);
                    func.call(_this2);
                }, 1);
                throw ex;
            }

            return true;
        }
    }, {
        key: "identify",
        value: function identify() {

            // if( this.pc<<1 == 0x966 ) debugger;

            var prog = this.prog,
                codec = this.codec,
                bytes = void 0,
                h = void 0,
                j = void 0,
                i = 0,
                l = codec.length,
                pc = this.pc;

            var bytes2 = void 0,
                bytes4 = void 0;
            bytes2 = prog[pc] >>> 0;
            bytes4 = (bytes2 << 16 | prog[pc + 1]) >>> 0;

            var verbose = 1;

            for (; i < l; ++i) {

                var desc = codec[i];
                var opcode = desc.opcode >>> 0;
                var mask = desc.mask >>> 0;
                var size = desc.bytes;

                if (size === 4) {

                    if (verbose == 2 || verbose == desc.name) console.log(desc.name + "\n" + bin(bytes4 & mask, 8 * 4) + "\n" + bin(opcode, 8 * 4));

                    if ((bytes4 & mask) >>> 0 !== opcode) continue;
                    bytes = bytes4;
                } else {

                    if (verbose == 2 || verbose == desc.name) console.log(desc.name + "\n" + bin(bytes2 & mask, 8 * 2) + "\n" + bin(opcode, 8 * 2));

                    if ((bytes2 & mask) >>> 0 !== opcode) continue;
                    bytes = bytes2;
                }

                this.instruction = desc;

                // var log = desc.name + " ";

                for (var k in desc.args) {
                    mask = desc.args[k];
                    var value = 0;
                    h = 0;
                    j = 0;
                    while (mask) {
                        if (mask & 1) {
                            value |= (bytes >> h & 1) << j;
                            j++;
                        }
                        mask = mask >>> 1;
                        h++;
                    }
                    desc.argv[k] = value;
                    // log += k + ":" + value + "  "
                }
                desc.decbytes = bytes;
                // console.log(log);

                return this.instruction;
            }

            this.error = "#" + (this.pc << 1).toString(16).toUpperCase() + " opcode: " + bin(bytes2, 16);

            return null;
        }
    }, {
        key: "interrupt",
        value: function interrupt(source) {

            // console.log("INTERRUPT " + source);

            var addr = this.interruptMap[source];
            var pc = this.pc;
            this.memory[this.sp--] = pc >> 8;
            this.memory[this.sp--] = pc;
            this.memory[0x5F] &= ~(1 << 7); // disable interrupts
            this.pc = addr;
        }
    }, {
        key: "getOpcodeImpl",
        value: function getOpcodeImpl(inst, str) {
            var i,
                l,
                op = { begin: "", end: "", srDirty: 0 };

            if (Array.isArray(str)) {
                for (i = 0, l = str.length; i < l; ++i) {
                    var tmp = this.getOpcodeImpl(inst, str[i]);
                    op.begin += tmp.begin + "\n";
                    op.end += tmp.end + "\n";
                    op.srDirty |= tmp.srDirty;
                }
                return op;
            }

            var src = str,
                argv = inst.argv;

            for (var k in argv) {
                str = str.split(k.toLowerCase()).join(argv[k]);
            }var SRSync = "",
                SRDirty = 0;

            str = str.replace(/SR@([0-9]+)\s*←\s*1;?\s*$/g, function (m, bit, assign) {
                SRDirty |= 1 << bit;
                return "sr" + bit + " = 1;\n";
            });
            str = str.replace(/SR@([0-9]+)\s*←\s*0;?\s*$/g, function (m, bit, assign) {
                SRDirty |= 1 << bit;
                return "sr" + bit + " = 0;\n";
            });
            str = str.replace(/SR([0-9]+)\s*=(.*)/g, function (m, bit, assign) {
                SRDirty |= 1 << bit;
                return "sr" + bit + " = " + assign + ";\n";
            });
            str = str.replace(/SR\s*←/g, function () {
                SRSync = 'memory[0x5F] = sr; sr0=sr&1; sr1=(sr>>1)&1; sr2=(sr>>2)&1; sr3=(sr>>3)&1; sr4=(sr>>4)&1; sr5=(sr>>5)&1; sr6=(sr>>6)&1; sr7=(sr>>7)&1;';
                return 'sr =';
            });
            str = str.replace(/SR@([0-9]+)\s*←(.*)$/g, function (m, bit, assign) {
                SRDirty |= 1 << bit;
                return "sr" + bit + " = (!!(" + assign + "))|0;";
            });
            str = str.replace(/SR\s*¯/g, '(~sr)');
            str = str.replace(/SR@([0-9]+)\s*¯/g, '(~sr$1) ');
            str = str.replace(/SR@([0-9]+)\s*/g, '(sr$1) ');
            str = str.replace(/SR/g, 'sr');

            str = str.replace(/WR([0-9]+)\s*←/g, 'r = wreg[$1] =');
            str = str.replace(/WR([0-9]+)@([0-9]+)\s*←(.*)$/g, function (m, num, bit, assign) {
                return "r = wreg[" + num + "] = (wreg[" + num + "] & ~(1<<" + bit + ")) | (((!!(" + assign + "))|0)<<" + bit + ");";
            });
            str = str.replace(/WR([0-9]+)\s*¯/g, '(~wreg[$1]) ');
            str = str.replace(/WR([0-9]+)@([0-9]+)\s*¯/g, '(~(wreg[$1]>>>$2)&1) ');
            str = str.replace(/WR([0-9]+)@([0-9]+)\s*/g, '((wreg[$1]>>>$2)&1) ');
            str = str.replace(/WR([0-9]+)/g, 'wreg[$1]');

            str = str.replace(/R([0-9<]+)(\+[0-9]+)?\s*←/g, function (m, num, numadd) {
                numadd = numadd || "";
                op.end += "reg[(" + num + ")" + numadd + "] = r;\n";
                return 'r = ';
            });
            str = str.replace(/R([0-9<]+)(\+[0-9]+)?@([0-9]+)\s*←(.*)$/g, function (m, num, numadd, bit, assign) {
                numadd = numadd || "";
                op.end += "reg[(" + num + ")" + numadd + "] = r;\n";
                return "r = (reg[(" + num + ")" + numadd + "] & ~(1<<" + bit + ")) | (((!!(" + assign + "))|0)<<" + bit + ");";
            });

            str = str.replace(/R([0-9<]+)(\+[0-9]+)?\s*=\s+/g, function (m, num, numadd) {
                numadd = numadd || "";
                return "r = reg[(" + num + ")" + numadd + "] = ";
            });
            str = str.replace(/R([0-9<]+)(\+[0-9]+)?@([0-9]+)\s*=\s+(.*)$/g, function (m, num, numadd, bit, assign) {
                numadd = numadd || "";
                return "r = reg[(" + num + ")" + numadd + "] = (reg[(" + num + ")" + numadd + "] & ~(1<<" + bit + ")) | (((!!(" + assign + "))|0)<<" + bit + ");";
            });

            str = str.replace(/R([0-9<]+)(\+[0-9]+)?\s*¯/g, '(~reg[($1)$2]) ');
            str = str.replace(/R([0-9<]+)(\+[0-9]+)?@([0-9]+)\s*¯/g, '(~(reg[($1)$2]>>>$3)&1) ');
            str = str.replace(/R([0-9<]+)(\+[0-9]+)?@([0-9]+)\s*/g, '((reg[($1)$2]>>>$3)&1) ');
            str = str.replace(/R([0-9<]+)(\+[0-9]+)?/g, '(reg[($1)$2]>>>0)');

            str = str.replace(/R@([0-9]+)\s*¯/g, '(~(r>>>$1)&1) ');
            str = str.replace(/R@([0-9]+)\s*/g, '((r>>>$1)&1) ');
            str = str.replace(/I\/O/g, 'io');
            str = str.replace(/R/g, 'r');

            str = str.replace(/FLASH\(([XYZ])\)\s*←(.*);?$/g, function (m, n, v) {
                return 'flash[ wreg[' + (n.charCodeAt(0) - 87) + '] ] = ' + v + ';';
            });
            str = str.replace(/FLASH\(([XYZ])\)/g, function (m, n) {
                return 'flash[ wreg[' + (n.charCodeAt(0) - 87) + '] ]';
            });
            str = str.replace(/\(([XYZ])(\+[0-9]+)?\)\s*←(.*);?$/g, function (m, n, off, v) {
                return 'this.write( wreg[' + (n.charCodeAt(0) - 87) + ']' + (off || '') + ', ' + v + ');';
            });
            str = str.replace(/\(([XYZ])(\+[0-9]+)?\)/g, function (m, n, off) {
                return 'this.read( wreg[' + (n.charCodeAt(0) - 87) + ']' + (off || '') + ', this.pc )';
            });

            str = str.replace(/\(STACK\)\s*←/g, function (m, n) {
                return 'memory[sp--] =';
            });
            str = str.replace(/\((STACK)\)/g, function (m, n) {
                return 'memory[++sp]';
            });
            str = str.replace(/\(STACK2\)\s*←(.*)/g, 't1 = $1;\nmemory[sp--] = t1>>8;\nmemory[sp--] = t1;\n');
            str = str.replace(/\((STACK2)\)/g, '(memory[++sp] + (memory[++sp]<<8))');

            str = str.replace(/⊕/g, '^');
            str = str.replace(/•/g, '&');

            str = str.replace(/io\[([0-9]+)\]\s*←(.*?);?$/g, 'this.write( 32+$1, $2 )');
            str = str.replace(/io\[([0-9]+)@([0-9]+)\]\s*←(.*?);?$/g, 'this.writeBit( 32+$1, $2, $3 )');
            str = str.replace(/io\[([0-9+<]+)@([0-9]+)\]/g, 'this.readBit( 32+$1, $2, this.pc )');
            str = str.replace(/io\[([0-9+<]+)\]/g, 'this.read( 32+$1, this.pc )');
            str = str.replace(/SP/g, 'sp');
            str = str.replace(/PC\s*←(.*)$/g, 't1 = $1;\nif( !t1 ) (function(){debugger;})(); this.pc = t1; break;\n');
            str = str.replace(/PC/g, 'this.pc');
            str = str.replace(/←/g, '=');

            str = '// ' + src.replace(/[\n\r]+\s*/g, '\n\t// ') + "\n" + str + "\n";

            op.srDirty = SRDirty;

            op.begin = str;
            op.end += SRSync;

            return op;
        }
    }, {
        key: "statusI",
        get: function get() {
            return this.sreg & 1 << 7;
        }
    }, {
        key: "statusT",
        get: function get() {
            return this.sreg & 1 << 6;
        }
    }, {
        key: "statusH",
        get: function get() {
            return this.sreg & 1 << 5;
        }
    }, {
        key: "statusS",
        get: function get() {
            return this.sreg & 1 << 4;
        }
    }, {
        key: "statusV",
        get: function get() {
            return this.sreg & 1 << 3;
        }
    }, {
        key: "statusN",
        get: function get() {
            return this.sreg & 1 << 2;
        }
    }, {
        key: "statusZ",
        get: function get() {
            return this.sreg & 1 << 1;
        }
    }, {
        key: "statusC",
        get: function get() {
            return this.sreg & 1 << 0;
        }
    }], [{
        key: "ATmega328P",
        value: function ATmega328P() {

            var core = new Atcore({
                flash: 32 * 1024,
                eeprom: 1 * 1024,
                sram: 2 * 1024,
                codec: AtCODEC,
                flags: AtFlags,
                clock: 16 * 1000 * 1000, // speed in kHz
                periferals: require('./At328P-periferals.js'),
                interrupt: {
                    RESET: 0x0000, //  External pin, power-on reset, brown-out reset and watchdog system reset
                    INT0: 0x002, //  External interrupt request 0
                    INT1: 0x0004, //  External interrupt request 1
                    PCINT0: 0x0006, //  Pin change interrupt request 0
                    PCINT1: 0x0008, //  Pin change interrupt request 1
                    PCINT2: 0x000A, //  Pin change interrupt request 2
                    WDT: 0x000C, //  Watchdog time-out interrupt
                    TIMER2A: 0x000E, //  COMPA Timer/Counter2 compare match A
                    TIMER2B: 0x0010, //  COMPB Timer/Counter2 compare match B
                    TIMER2O: 0x0012, //  OVF Timer/Counter2 overflow
                    TIMER1C: 0x0014, //  CAPT Timer/Counter1 capture event
                    TIMER1A: 0x0016, //  COMPA Timer/Counter1 compare match A
                    TIMER1B: 0x0018, //  COMPB Timer/Counter1 compare match B
                    TIMER1O: 0x001A, //  OVF Timer/Counter1 overflow
                    TIMER0A: 0x001C, //  COMPA Timer/Counter0 compare match A
                    TIMER0B: 0x001E, //  COMPB Timer/Counter0 compare match B
                    TIMER0O: 0x0020, //  OVF Timer/Counter0 overflow
                    SPI: 0x0022, // , STC SPI serial transfer complete
                    USARTRX: 0x0024, // , RX USART Rx complete
                    USARTE: 0x0026, // , UDRE USART, data register empty
                    USARTTX: 0x0028, // , TX USART, Tx complete
                    ADC: 0x002A, //  ADC conversion complete
                    EEREADY: 0x002C, //  READY EEPROM ready
                    ANALOG: 0x002E, //  COMP Analog comparator
                    TWI: 0x0030, //  2-wire serial interface
                    SPM: 0x0032 //  READY Store program memory ready                
                }
            });

            return core;
        }
    }, {
        key: "ATmega32u4",
        value: function ATmega32u4() {
            var _interrupt;

            var core = new Atcore({
                flash: 32 * 1024,
                eeprom: 1 * 1024,
                sram: 2 * 1024 + 512,
                codec: AtCODEC,
                flags: AtFlags,
                clock: 16 * 1000 * 1000, // speed in kHz
                periferals: require('./At32u4-periferals.js'),
                interrupt: (_interrupt = {
                    RESET: 0x0000, //  External pin, power-on reset, brown-out reset and watchdog system reset
                    INT0: 0x002, //  External interrupt request 0
                    INT1: 0x0004, //  External interrupt request 1
                    INT2: 0x0006, //  External interrupt request 2
                    INT3: 0x0008, //  External interrupt request 3
                    RESERVED0: 0x000A,
                    RESERVED1: 0x000C,
                    INT6: 0x000E, //  External interrupt request 6
                    PCINT0: 0x0012, //  Pin change interrupt request 0
                    USBGEN: 0x0014, // USB General Interrupt request
                    USBEND: 0x0016, // USB Endpoint Interrupt request
                    WDT: 0x0018, //  Watchdog time-out interrupt

                    TIMER1C: 0x0020, //  CAPT Timer/Counter1 capture event
                    TIMER1A: 0x0022, //  COMPA Timer/Counter1 compare match A
                    TIMER1B: 0x0024 }, _defineProperty(_interrupt, "TIMER1C", 0x0026), _defineProperty(_interrupt, "TIMER1O", 0x0028), _defineProperty(_interrupt, "TIMER0A", 0x002A), _defineProperty(_interrupt, "TIMER0B", 0x002C), _defineProperty(_interrupt, "TIMER0O", 0x002E), _defineProperty(_interrupt, "SPI", 0x0030), _defineProperty(_interrupt, "USARTRX", 0x0032), _defineProperty(_interrupt, "USARTE", 0x0034), _defineProperty(_interrupt, "USARTTX", 0x0036), _defineProperty(_interrupt, "ANALOG", 0x0038), _defineProperty(_interrupt, "ADC", 0x003A), _defineProperty(_interrupt, "EEREADY", 0x003C), _defineProperty(_interrupt, "TIMER3C", 0x003E), _defineProperty(_interrupt, "TIMER3A", 0x0040), _defineProperty(_interrupt, "TIMER3B", 0x0042), _defineProperty(_interrupt, "TIMER3C", 0x0044), _defineProperty(_interrupt, "TIMER3O", 0x0046), _defineProperty(_interrupt, "TWI", 0x0048), _defineProperty(_interrupt, "SPM", 0x004A), _defineProperty(_interrupt, "TIMER4A", 0x004C), _defineProperty(_interrupt, "TIMER4B", 0x004E), _defineProperty(_interrupt, "TIMER4D", 0x0050), _defineProperty(_interrupt, "TIMER4O", 0x0052), _defineProperty(_interrupt, "TIMER4FPF", 0x0054), _interrupt)
            });

            return core;
        }
    }]);

    return Atcore;
}();

function parse(out) {
    var opcode = 0;
    var mask = 0;
    var args = {};

    var str = out.str,
        l = str.length;
    for (var i = 0; i < l; ++i) {
        var chr = str[i];
        var bit = l - i - 1 >>> 0;
        if (chr == '0') {
            mask |= 1 << bit;
        } else if (chr == '1') {
            mask |= 1 << bit;
            opcode |= 1 << bit;
        } else {
            if (!(chr in args)) args[chr] = 0;
            args[chr] |= 1 << bit;
        }
    }

    out.opcode = opcode;
    out.mask = mask;
    out.args = args;
    out.bytes = l / 8 | 0;
}

var AtCODEC = [{
    name: 'ADC',
    str: '000111rdddddrrrr',
    impl: 'Rd ← Rd + Rr + SR@0;',
    flags: 'hzvnsc'
}, {
    name: 'ADD',
    str: '000011rdddddrrrr',
    impl: 'Rd ← Rd + Rr;',
    flags: 'hzvnsc'
}, {
    name: 'MUL',
    str: '100111rdddddrrrr',
    impl: ['t1 = Rd * Rr', 'R0 = t1', 'R1 = t1 >> 8', 'SR1 = !t1|0', 'SR0 = (t1>>15)&1'],
    flags: 'hvnsc'
}, {
    name: 'ADIW',
    str: '10010110KKddKKKK',
    impl: ['WRd ← WRd + k;'],
    flags: 'ZVNSC'
}, {
    name: 'AND',
    str: '001000rdddddrrrr',
    impl: ['Rd ← Rd • Rr;', 'SR@3 ← 0'],
    flags: 'zns'
}, {
    name: 'ANDI',
    str: '0111KKKKddddKKKK',
    impl: ['Rd+16 ← Rd+16 • k;', 'SR@3 ← 0'],
    flags: 'zns'
}, {
    name: 'ASR',
    str: '1001010ddddd0101',
    impl: ['SR@0 ← Rd • 1', 'Rd ← Rd >> 1;'],
    flags: 'zns'
}, {
    name: 'BCLRi',
    str: '1001010011111000',
    impl: 'SR@7 ← 0'
}, {
    name: 'BCLRt',
    str: '1001010011101000',
    impl: 'SR@6 ← 0'
}, {
    name: 'BCLRh',
    str: '1001010011011000',
    impl: 'SR@5 ← 0'
}, {
    name: 'BCLRs',
    str: '1001010011001000',
    impl: 'SR@4 ← 0'
}, {
    name: 'BCLRv',
    str: '1001010010111000',
    impl: 'SR@3 ← 0'
}, {
    name: 'BCLRn',
    str: '1001010010101000',
    impl: 'SR@2 ← 0'
}, {
    name: 'BCLRz',
    str: '1001010010011000',
    impl: 'SR@1 ← 0'
}, {
    name: 'BCLRc',
    str: '1001010010001000',
    impl: 'SR@0 ← 0'
}, {
    name: 'BRCC',
    str: '111101kkkkkkk000',
    impl: ['if( !SR@0 ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 2
}, {
    name: 'BRBS',
    str: '111100kkkkkkksss',
    impl: ['if( SR@s ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 2
}, {
    name: 'BRBC',
    str: '111101kkkkkkksss',
    impl: ['if( !SR@s ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 2
}, {
    name: 'BRCS',
    str: '111100kkkkkkk000',
    impl: ['if( SR@0 ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 2
}, {
    name: 'BREQ',
    str: '111100kkkkkkk001',
    impl: ['if( SR@1 ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 3
}, {
    name: 'BRLT',
    str: '111100kkkkkkk100',
    impl: ['if( SR@4 ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 3
}, {
    name: 'BRGE',
    str: '111101kkkkkkk100',
    impl: ['if( !SR@4 ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 3
}, {
    name: 'BRNE',
    str: '111101kkkkkkk001',
    impl: ['if( !SR@1 ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 3
}, {
    name: 'BRPL',
    str: '111101kkkkkkk010',
    impl: ['if( !SR@2 ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 2
}, {
    name: 'BRMI',
    str: '111100kkkkkkk010',
    impl: ['if( SR@2 ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 2
}, {
    name: 'BRTC',
    str: '111101kkkkkkk110',
    impl: ['if( !SR@6 ){', '  PC ← PC + (k << 25 >> 25) + 1;', '}'],
    cycles: 3
}, {
    name: 'BST',
    str: '1111101ddddd0bbb',
    impl: 'SR6 = Rd@b'
    //,debug: true
}, {
    name: 'BLD',
    str: '1111100ddddd0bbb',
    impl: 'Rd@b ← SR@6'
}, {
    name: 'CALL',
    str: '1001010kkkkk111kkkkkkkkkkkkkkkkk',
    cycles: 4,
    impl: ['(STACK2) ← PC + 2', 'PC ← k']
}, {
    name: 'CBI',
    str: '10011000AAAAAbbb',
    impl: 'I/O[a@b] ← 0;'
}, {
    name: 'COM',
    str: '1001010ddddd0000',
    impl: ['Rd ← ~ Rd;', 'SR@3 ← 0', 'SR@0 ← 1'],
    flags: 'zns'
}, {
    name: 'FMUL',
    str: '000000110ddd1rrr',
    impl: ['t1 = Rd+16 * Rr+16 << 1', 'R0 = t1', 'R1 = t1 >> 8', 'SR1 = !t1|0', 'SR0 = (t1>>15)&1']
}, {
    name: 'NOP',
    str: '0000000000000000',
    impl: ''
}, {
    name: 'NEG',
    str: '1001010ddddd0001',
    impl: ['Rd ← - Rd;', 'SR3 = R@7 • R@6 ¯ • R@5 ¯ • R@4 ¯ • R@3 ¯ • R@2 ¯ • R@1 ¯ • R@0 ¯', 'SR0 = (!!R)|0', 'SR@5 ← R@3 | Rd3 ¯'],
    flags: 'zns'
}, {
    name: 'CP',
    str: '000101rdddddrrrr',
    impl: ['R = ((Rd - Rr) >>> 0) & 0xFF;', 'SR@5 ← (Rd@3 ¯ • Rr@3) | (Rr@3 • R@3) | (R@3 • Rd@3 ¯)', 'SR@0 ← (Rd@7 ¯ • Rr@7) | (Rr@7 • R@7) | (R@7 • Rd@7 ¯)', 'SR@3 ← (Rd@7 • Rr@7 ¯ • R@7 ¯) + (Rd@7 ¯ • Rr@7 • R@7)'],
    flags: 'zns'
}, {
    name: 'CPI',
    str: '0011KKKKddddKKKK',
    impl: ['R = ((Rd+16 - k) >>> 0) & 0xFF;', 'SR@5 ← (Rd+16@3 ¯ • ((k>>3)&1)) | (((k>>3)&1) • R@3) | (R@3 • Rd+16@3 ¯)', 'SR@0 ← (Rd+16@7 ¯ • ((k>>7)&1)) | (((k>>7)&1) • R@7) | (R@7 • Rd+16@7 ¯)', 'SR@3 ← (Rd+16@7 • ((k>>7)&1^1) • R@7 ¯) + (Rd+16@7 ¯ • ((k>>7)&1) • R@7)'],
    flags: 'zns'
}, {
    name: 'CPC',
    str: '000001rdddddrrrr',
    impl: ['R = (Rd - Rr - SR@0) & 0xFF', 'SR@5 ← (Rd@3 ¯ • Rr@3) | (Rr@3 • R@3) | (R@3 • Rd@3 ¯)', 'SR@0 ← (Rd@7 ¯ • Rr@7) | (Rr@7 • R@7) | (R@7 • Rd@7 ¯)', 'SR@3 ← (Rd@7 • Rr@7 ¯ • R@7 ¯) | (Rd@7 ¯ • Rr@7 • R@7)', 'SR@1 ← (!R) & SR@1'],
    flags: 'ns'
}, {
    name: 'CPSE',
    str: '000100rdddddrrrr',
    impl: 'SKIP ← Rr == Rd',
    skip: true
}, {
    name: 'DEC',
    str: '1001010ddddd1010',
    impl: ['Rd ← Rd - 1', 'SR@3 ← R@7 ¯ • R@6 • R@5 • R@4 • R@3 • R@2 • R@1 • R@0'],
    flags: 'zns'
}, {
    name: 'EOR',
    str: '001001rdddddrrrr',
    impl: ['Rd ← Rd ⊕ Rr;', 'SR@3 ← 0'],
    flags: 'zns'
}, {
    name: 'ICALL',
    str: '1001010100001001',
    cycles: 3,
    impl: ['(STACK2) ← PC + 2', 'PC ← WR3']
    // end:true
}, {
    name: 'INSR',
    str: '1011011ddddd1111',
    impl: "Rd \u2190 SR",
    cycles: 1
    // debug: true
}, {
    name: 'IN',
    str: '10110AAddddd1110',
    impl: "Rd \u2190 sp>>>8",
    cycles: 1
}, {
    name: 'IN',
    str: '10110AAddddd1101',
    impl: "Rd \u2190 sp&0xFF",
    cycles: 1
}, {
    name: 'IN',
    str: '10110AAdddddAAAA',
    impl: "Rd \u2190 I/O[a]",
    cycles: 1
}, {
    name: 'INC',
    str: '1001010ddddd0011',
    impl: ['Rd ← Rd + 1;', 'SR@3 ← R@7 • R@6 ¯ • R@5 ¯ • R@4 ¯ • R@3 ¯ • R@2 ¯ • R@1 ¯ • R@0 ¯'],
    flags: 'zns'
}, {
    name: 'IJMP',
    str: '1001010000001001',
    impl: "PC \u2190 WR3",
    cycles: 2,
    end: true
}, {
    name: 'JMP',
    str: '1001010kkkkk110kkkkkkkkkkkkkkkkk',
    impl: "PC \u2190 k",
    cycles: 3,
    end: true
}, {
    name: 'LDI',
    str: '1110KKKKddddKKKK',
    impl: 'Rd+16 ← k'
}, {
    name: 'LDS',
    str: '1001000xxxxx0000kkkkkkkkkkkkkkkk',
    impl: 'Rx ← this.read(k)',
    bytes: 4
}, {
    name: 'LDX',
    str: '1001000ddddd1100',
    impl: "Rd \u2190 (X);",
    cycles: 2
}, {
    name: 'LDX+',
    str: '1001000ddddd1101',
    impl: ["Rd \u2190 (X);", "WR1 ++;"],
    cycles: 2
}, {
    name: 'LDX-',
    str: '1001000ddddd1110',
    impl: ["WR1 --;", "Rd \u2190 (X);"],
    cycles: 2
}, {
    name: 'LDY',
    str: '1000000ddddd1000',
    impl: "Rd \u2190 (Y)",
    cycles: 2
}, {
    name: 'LDY+',
    str: '1001000ddddd1001',
    impl: ["Rd \u2190 (Y);", "WR3 ++;"],
    cycles: 2
}, {
    name: 'LDY-',
    str: '1001000ddddd1010',
    impl: ["WR3 --;", "Rd \u2190 (Y);"],
    cycles: 2
}, {
    name: 'LDYQ',
    str: '10q0qq0ddddd1qqq',
    impl: ["Rd \u2190 (Y+q);"],
    cycles: 2
}, {
    name: 'LDZ',
    str: '1000000ddddd0000',
    impl: "Rd \u2190 (Z);",
    cycles: 2
}, {
    name: 'LDZ+',
    str: '1001000ddddd0001',
    impl: ["Rd \u2190 (Z);", "WR3 ++;"],
    cycles: 2
}, {
    name: 'LDZ-',
    str: '1001000ddddd0010',
    impl: ["WR3 --;", "Rd \u2190 (Z);"],
    cycles: 2
}, {
    name: 'LDZQ',
    str: '10q0qq0ddddd0qqq',
    impl: ["Rd \u2190 (Z+q);"],
    cycles: 2
}, {
    name: 'LPMi',
    str: '1001010111001000',
    impl: 'R0 ← FLASH(Z)'
}, {
    name: 'LPMii',
    str: '1001000ddddd0100',
    impl: 'Rd ← FLASH(Z)'
}, {
    name: 'LPMiii',
    str: '1001000ddddd0101',
    impl: ['Rd ← FLASH(Z);', 'WR3 ++;']
}, {
    name: 'LSR',
    str: '1001010ddddd0110',
    // debug:true,
    impl: ['SR0 = Rd@0', 'Rd ← Rd >>> 1', 'SR2 = 0', 'SR3 = SR@2 ^ SR0'],
    flags: 'zs'
}, {
    name: 'MOV',
    str: '001011rdddddrrrr',
    impl: ['Rd ← Rr;']
}, {
    name: 'MOVW',
    str: '00000001ddddrrrr',
    impl: ['Rd<<1 = Rr<<1', 'Rd<<1+1 = Rr<<1+1']
}, {
    name: 'MULSU',
    str: '000000110ddd0rrr',
    impl: ['i8a[0] = Rd+16', 't1 = i8a[0] * Rr+16', 'R0 = t1', 'R1 = t1 >> 8', 'SR1 = !t1|0', 'SR0 = (t1>>15)&1']
}, {
    name: 'MULS',
    str: '00000010ddddrrrr',
    impl: ['i8a[0] = Rd+16', 'i8a[1] = Rr+16', 't1 = i8a[0] * i8a[1]', 'R0 = t1', 'R1 = t1 >> 8', 'SR1 = !t1|0', 'SR0 = (t1>>15)&1']
}, {
    name: 'OR',
    str: '001010rdddddrrrr',
    impl: ['Rd ← Rd | Rr;', 'SR@3 ← 0'],
    flags: 'zns'
}, {
    name: 'ORI',
    str: '0110KKKKddddKKKK',
    impl: ['Rd+16 ← Rd+16 | k;', 'SR@3 ← 0'],
    flags: 'zns'
}, {
    name: 'OUTsr',
    str: '1011111rrrrr1111',
    impl: 'I/O[63] ← SR ← Rr',
    cycles: 1
}, {
    name: 'OUTsph',
    str: '1011111rrrrr1110',
    impl: ['I/O[62] ← Rr;', 'sp = (io[62]<<8) | (sp&0xFF);'],
    cycles: 1
}, {
    name: 'OUTspl',
    str: '1011111rrrrr1101',
    impl: ['I/O[61] ← Rr;', 'sp = (sp&0xFF00) | io[61];'],
    cycles: 1
}, {
    name: 'OUT',
    str: '10111AArrrrrAAAA',
    impl: "I/O[a] \u2190 Rr",
    cycles: 1
}, {
    name: 'PUSH',
    str: '1001001ddddd1111',
    impl: '(STACK) ← Rd',
    cycles: 2
}, {
    name: 'POP',
    str: '1001000ddddd1111',
    impl: 'Rd ← (STACK)',
    cycles: 2
}, {
    name: 'RET',
    str: '1001010100001000',
    cycles: 4,
    end: true,
    impl: 'PC ← (STACK2)'
}, {
    name: 'RETI',
    str: '1001010100011000',
    cycles: 4,
    end: true,
    impl: ['memory[0x5F] = (SR |= 1<<7);', 'PC ← (STACK2)']
}, {
    name: 'ROR',
    str: '1001010ddddd0111',
    impl: ['SR0 = Rd@0', 'Rd ← Rd >>> 1 | (SR<<7&0x80)', 'SR2 = R>>7', 'SR3 = SR@2 ^ SR0'],
    flags: 'zs'
}, {
    name: 'HALT',
    str: '1100111111111111',
    impl: "PC \u2190 PC - 1",
    end: true
}, {
    name: 'RCALL',
    str: '1101kkkkkkkkkkkk',
    cycles: 3,
    impl: ['(STACK2) ← PC + 1', "PC \u2190 PC + (k << 20 >> 20) + 1"],
    end: false
}, {
    name: 'RJMP',
    str: '1100kkkkkkkkkkkk',
    impl: "PC \u2190 PC + (k << 20 >> 20) + 1",
    end: true
}, {
    name: 'SEC',
    str: '1001010000001000',
    impl: "SR@0 \u2190 1"
}, {
    name: 'SET',
    str: '1001010001101000',
    impl: "SR@6 \u2190 1"
}, {
    name: 'SEI',
    str: '1001010001111000',
    impl: "SR@7 \u2190 1"
}, {
    name: 'SFMUL',
    str: '000000111ddd0rrr',
    impl: ['i8a[0] = Rd+16', 'i8a[1] = Rr+16', 't1 = i8a[0] * i8a[1] << 1', 'R0 = t1', 'R1 = t1 >> 8', 'SR1 = !t1|0', 'SR0 = (t1>>15)&1']
}, {
    name: 'STS',
    str: '1001001ddddd0000kkkkkkkkkkkkkkkk',
    impl: "this.write( k, Rd )",
    bytes: 4
}, {
    name: 'STX',
    str: '1001001rrrrr1100',
    impl: "(X) \u2190 Rr"
}, {
    name: 'STX+',
    str: '1001001rrrrr1101',
    impl: ["(X) \u2190 Rr", "WR1 ++;"]
}, {
    name: 'STX-',
    str: '1001001rrrrr1110',
    impl: ["WR1 --;", "(X) \u2190 Rr"]
}, {
    name: 'STY',
    str: '1000001rrrrr1000',
    impl: "(Y) \u2190 Rr"
}, {
    name: 'STY+',
    str: '1001001rrrrr1001',
    impl: ["(Y) \u2190 Rr", "WR1 ++;"]
}, {
    name: 'STY-',
    str: '1001001rrrrr1010',
    impl: ["WR1 --;", "(Y) \u2190 Rr"]
}, {
    name: 'STYQ',
    str: '10q0qq1rrrrr1qqq',
    impl: ["(Y+q) \u2190 Rr"]
}, {
    name: 'STZ',
    str: '1000001rrrrr0000',
    impl: "(Z) \u2190 Rr"
}, {
    name: 'STZ+',
    str: '1001001rrrrr0001',
    impl: ["(Z) \u2190 Rr", "WR3 ++;"]
}, {
    name: 'STZ-',
    str: '1001001rrrrr0010',
    impl: ["WR3 --;", "(Z) \u2190 Rr"]
}, {
    name: 'STZQ',
    str: '10q0qq1rrrrr0qqq',
    impl: ["(Z+q) \u2190 Rr"]
}, {
    name: 'SBC',
    str: '000010rdddddrrrr',
    impl: ['Rd ← (Rd - Rr - SR@0) & 0xFF;', 'SR@5 ← (Rd@3 ¯ • Rr@3) | (Rr@3 • R@3) | (R@3 • Rd@3 ¯)', 'SR@0 ← (Rd@7 ¯ • Rr@7) | (Rr@7 • R@7) | (R@7 • Rd@7 ¯)', 'SR@3 ← (Rd@7 • Rr@7 ¯ • R@7 ¯) | (Rd@7 ¯ • Rr@7 • R@7)', 'SR@1 ← (!R) & SR@1'],
    flags: 'ns'
}, {
    name: 'SUB',
    str: '000110rdddddrrrr',
    impl: ['Rd ← (Rd - Rr)&0xFF;', 'SR@5 ← (Rd@3 ¯ • Rr@3) | (Rr@3 • R@3) | (R@3 • Rd@3 ¯)', 'SR@0 ← (Rd@7 ¯ • Rr@7) | (Rr@7 • R@7) | (R@7 • Rd@7 ¯)', 'SR@3 ← (Rd@7 • Rr@7 ¯ • R@7 ¯) | (Rd@7 ¯ • Rr@7 • R@7)'],
    flags: 'zns'
}, {
    name: 'SBCI',
    str: '0100KKKKddddKKKK',
    impl: ['Rd+16 ← (Rd+16 - k - SR@0)&0xFF;', 'SR@5 ← (Rd+16@3 ¯ • ((k>>3)&1)) | (((k>>3)&1) • R@3) | (R@3 • Rd+16@3 ¯)', 'SR@0 ← (Rd+16@7 ¯ • ((k>>7)&1)) | (((k>>7)&1) • R@7) | (R@7 • Rd+16@7 ¯)', 'SR@3 ← (Rd+16@7 • ((k>>7)&1^1) • R@7 ¯) | (Rd+16@7 ¯ • ((k>>7)&1) • R@7)', 'SR@1 ← (!R) & SR@1'],
    flags: 'ns'
}, {
    name: 'SUBI',
    str: '0101KKKKddddKKKK',
    impl: ['Rd+16 ← Rd+16 - k;', 'SR@5 ← (Rd+16@3 ¯ • ((k>>3)&1)) | (((k>>3)&1) • R@3) | (R@3 • Rd+16@3 ¯)', 'SR@0 ← (Rd+16@7 ¯ • ((k>>7)&1)) | (((k>>7)&1) • R@7) | (R@7 • Rd+16@7 ¯)', 'SR@3 ← (Rd+16@7 • ((k>>7)&1^1) • R@7 ¯) | (Rd+16@7 ¯ • ((k>>7)&1) • R@7)'],
    flags: 'zns'
}, {
    name: 'SBI',
    str: '10011010AAAAAbbb',
    impl: 'I/O[a@b] ← 1;'
}, {
    name: 'SBIW',
    str: '10010111KKddKKKK',
    impl: ['WRd ← WRd - k;'],
    flags: 'ZVNS'
}, {
    name: 'SBIC',
    str: '10011001AAAAAbbb',
    impl: 'SKIP ← !I/O[a@b]',
    skip: true
}, {
    name: 'SBIS',
    str: '10011011AAAAAbbb',
    impl: 'SKIP ← I/O[a@b]',
    skip: true
}, {
    name: 'SBRC',
    str: '1111110rrrrr0bbb',
    // debug: true,
    impl: 'SKIP ← !(Rr & (1<<b))',
    skip: true
}, {
    name: 'SBRS',
    str: '1111111rrrrr0bbb',
    // debug: true,
    impl: 'SKIP ← Rr & (1<<b)',
    skip: true
}, {
    name: 'SLEEP',
    str: '1001010110001000',
    impl: ['this.sleeping = true', 'PC ← PC + 1'],
    // debug: true,
    cycles: 0
}, {
    name: 'SWAP',
    str: '1001010ddddd0010',
    impl: ['Rd ← (Rd >>> 4) | (Rd << 4)']
}];

var AtFlags = {

    h: 'SR@5 ← (Rd@3 • Rr@3) + (Rr@3 • R@3 ¯) | (R@3 ¯ • Rd@3)',
    H: '',
    z: 'SR1 = !(R&0xFF)|0',
    Z: 'SR1 = !(R&0xFF)|0',
    v: 'SR3 = (Rd@7 • Rr@7 • R@7 ¯) | (Rd@7 ¯ • Rr@7 ¯ • R@7)',
    V: 'SR3 = WRd@15 ¯ • R@15',
    n: 'SR2 = R@7',
    N: 'SR2 = R@15',
    s: 'SR4 = SR@2 ⊕ SR@3',
    S: 'SR4 = SR@2 ⊕ SR@3',
    c: 'SR0 = (Rd@7 • Rr@7) | (Rr@7 • R@7 ¯) | (R@7 ¯ • Rd@7)',
    C: 'SR0 = (R@15 ¯ • WRd@15)',

    /*
    Bit 7 – I: Global Interrupt Enable
    The global interrupt enable bit must be set for the interrupts to be enabled. The individual interrupt enable control is then
    performed in separate control registers. If the global interrupt enable register is cleared, none of the interrupts are enabled
    independent of the individual interrupt enable settings. The I-bit is cleared by hardware after an interrupt has occurred, and is
    set by the RETI instruction to enable subsequent interrupts. The I-bit can also be set and cleared by the application with the
    SEI and CLI instructions, as described in the instruction set reference    
    */
    SEI: function SEI() {
        this.sreg |= 1 << 7;
    },
    CLI: function CLI() {
        this.sreg &= ~(1 << 7);
    },


    /*
    Bit 6 – T: Bit Copy Storage
    The bit copy instructions BLD (bit LoaD) and BST (Bit STore) use the T-bit as source or destination for the operated bit. A bit
    from a register in the register file can be copied into T by the BST instruction, and a bit in T can be copied into a bit in a
    register in the register file by the BLD instruction.
    */
    BLD: function BLD(REG, BIT) {
        if (this.reg & 1 << 6) this.reg[REG] |= 1 << BIT;else this.reg[REG] &= ~(1 << BIT);
    },
    BST: function BST(REG, BIT) {
        var v = this.reg[REG] >> BIT & 1;
        if (v) this.sreg |= 1 << 6;else this.sreg &= ~(1 << 6);
    }
};

module.exports = Atcore;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./At328P-periferals.js":9,"./At32u4-periferals.js":11}],13:[function(require,module,exports){
'use strict';

var Hex = {
    parseURL: function parseURL(url, buffer, cb) {

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                try {
                    Hex.parse(xhr.responseText, buffer);
                } catch (ex) {
                    cb(false);
                    return;
                }
                cb(true);
            }
        };
        xhr.open("GET", url, true);
        xhr.send();
    },
    parse: function parse(src, buffer) {

        var state = 0,
            size = 0,
            num = void 0,
            byte = void 0,
            offset = void 0,
            sum = 0;

        for (var i = 0, l = src.length; i < l;) {

            byte = src.charCodeAt(i++);

            if (byte === 58) {
                state = 0;
                continue;
            }

            if (byte >= 65 && byte <= 70) {
                num = byte - 55 << 4;
            } else if (byte >= 48 && byte <= 57) {
                num = byte - 48 << 4;
            } else continue;

            while (i < l) {
                byte = src.charCodeAt(i++);
                if (byte >= 65 && byte <= 70) {
                    num += byte - 55;
                    break;
                } else if (byte >= 48 && byte <= 57) {
                    num += byte - 48;
                    break;
                } else continue;
            }

            switch (state) {
                case 0:
                    size = num;
                    state++;
                    sum = num;
                    break;

                case 1:
                    offset = num << 8;
                    state++;
                    sum += num;
                    break;

                case 2:
                    offset += num;
                    state++;
                    sum += num;
                    break;

                case 3:
                    if (num === 1) return;
                    if (num === 3 || num === 5) {
                        state++;
                    } else if (num !== 0) throw 'Unsupported record type: ' + num;
                    state++;
                    sum += num;
                    break;

                case 4:
                    buffer[offset++] = num;
                case 5:
                    sum += num;
                    if (! --size) state = 6;
                    break;

                case 6:
                    sum += num;
                    sum = -sum & 0xFF;
                    if (!sum) state++;else throw 'Checksum mismatch: ' + sum;
                    break;

                case 7:
                default:
                    throw 'Illegal state ' + state;
            }
        }
    }
};

module.exports = Hex;

},{}],14:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var BTN = function () {
			function BTN(DOM) {
						var _this = this;

						_classCallCheck(this, BTN);

						this.on = {
									connect: null,
									init: function init() {
												this.on.value = !this.active;
									}
						};


						DOM.element.controller = this;
						DOM.element.dispatchEvent(new Event("addperiferal", { bubbles: true }));
						this.on.connect = DOM.element.getAttribute("pin-on");
						this.active = DOM.element.getAttribute("active") != "low";

						DOM.element.addEventListener("mousedown", function (_) {
									return _this.on.value = _this.active;
						});
						DOM.element.addEventListener("mouseup", function (_) {
									return _this.on.value = !_this.active;
						});
						DOM.element.addEventListener("touchstart", function (_) {
									return _this.on.value = _this.active;
						});
						DOM.element.addEventListener("touchend", function (_) {
									return _this.on.value = !_this.active;
						});

						(DOM.element.getAttribute("bind-key") || "").split(/\s*,\s*/).forEach(function (k) {
									_this["onPress" + k] = function (_) {
												return _this.on.value = _this.active;
									};
									_this["onRelease" + k] = function (_) {
												return _this.on.value = !_this.active;
									};
						});

						this.pool.add(this);
			}

			_createClass(BTN, [{
						key: "setActiveView",
						value: function setActiveView() {
									this.pool.remove(this);
						}
			}]);

			return BTN;
}();

BTN["@inject"] = {
			pool: "pool"
};


module.exports = BTN;

},{}],15:[function(require,module,exports){
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LED = function LED(DOM) {
			_classCallCheck(this, LED);

			this.on = {

						connect: null,

						onLowToHigh: function onLowToHigh() {
									this.el.style.opacity = "0";
						},
						onHighToLow: function onHighToLow() {
									this.el.style.opacity = "1";
						}
			};


			this.el = DOM.element;
			DOM.element.controller = this;
			DOM.element.dispatchEvent(new Event("addperiferal", { bubbles: true }));
			this.on.connect = DOM.element.getAttribute("pin-on");
			this.el.style.opacity = 0;
};

module.exports = LED;

},{}],16:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SCREEN = function () {
			function SCREEN(DOM) {
						_classCallCheck(this, SCREEN);

						this.state = function (data) {
									// console.log( "DATA: " + data.toString(16) );
									var cs = this.colStart;
									var ce = this.colEnd;
									var cd = ce - cs;
									var ps = this.pageStart;
									var pe = this.pageEnd;
									var pd = pe - ps;

									var x = cs + this.col;
									var y = (ps + this.page) * 8;

									for (var i = 0; i < 8; ++i) {
												var offset = ((y + i) * 128 + x) * 4;
												var bit = (data >>> i & 1) * 0xE0;
												this.fb.data[offset++] = bit;
												this.fb.data[offset++] = bit;
												this.fb.data[offset++] = bit;
												this.fb.data[offset++] = bit;
									}

									this.col++;
									if (this.col > cd) {
												this.col = 0;
												this.page++;
												if (this.page > pd) this.page = 0;
									}

									this.dirty = true;
						};

						this.sck = {
									connect: null
						};
						this.sda = {
									connect: null,
									MOSI: function MOSI(data) {

												if (this.mode == 0) {
															// data is a command
															var cmd = "cmd" + data.toString(16).toUpperCase();
															if (this.cmd.length) {
																		this.cmd.push(data);
																		cmd = this.cmd[0];
															} else this.cmd.push(cmd);

															var fnc = this[cmd];

															if (!fnc) return console.warn("Unknown SSD1306 command: " + cmd.toString(16));

															if (fnc.length == this.cmd.length - 1) {
																		this.cmd.shift();
																		this[cmd].apply(this, this.cmd);
																		this.cmd.length = 0;
															}
												} else {
															this.state(data);
												}
									}
						};
						this.res = {
									connect: null,
									onLowToHigh: function onLowToHigh() {
												this.reset();
									}
						};
						this.dc = {
									connect: null,
									onLowToHigh: function onLowToHigh() {
												this.mode = 1; // data
									},
									onHighToLow: function onHighToLow() {
												this.mode = 0; // command
									}

									// Display Off
						};


						var canvas = this.canvas = DOM.screen;
						if (!canvas) throw "No canvas in Arduboy element";

						this.pool.add(this);

						canvas.width = 128;
						canvas.height = 64;

						this.ctx = canvas.getContext("2d");
						this.ctx.imageSmoothingEnabled = false;
						this.ctx.msImageSmoothingEnabled = false;

						this.fb = this.createBuffer();
						this.fbON = this.createBuffer();
						this.fbOFF = this.createBuffer();
						this.activeBuffer = this.fbON;
						this.dirty = true;

						this.fbON.data.fill(0xFF);

						DOM.element.controller = this;
						DOM.element.dispatchEvent(new Event("addperiferal", { bubbles: true }));

						this.sck.connect = DOM.element.getAttribute("pin-sck");
						this.sda.connect = DOM.element.getAttribute("pin-sda");
						this.res.connect = DOM.element.getAttribute("pin-res");
						this.dc.connect = DOM.element.getAttribute("pin-dc");

						this.reset();
			}

			_createClass(SCREEN, [{
						key: "setActiveView",
						value: function setActiveView() {
									this.pool.remove(this);
						}
			}, {
						key: "onPressKeyF",
						value: function onPressKeyF() {
									var docEl = this.canvas; // doc.documentElement;

									toggleFullScreen();

									return;

									function isFullScreen() {
												var doc = window.document;
												return doc.fullscreenElement || doc.mozFullScreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement || false;
									}

									function toggleFullScreen(toggle) {
												var doc = window.document;

												var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
												var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
												var state = isFullScreen();

												if (toggle == undefined) toggle = !state;else if (toggle == state) return;

												if (toggle) requestFullScreen.call(docEl);else cancelFullScreen.call(doc);
									}
						}
			}, {
						key: "tick",
						value: function tick() {
									if (this.dirty) {
												this.ctx.putImageData(this.activeBuffer, 0, 0);
												this.dirty = false;
									}
						}
			}, {
						key: "createBuffer",
						value: function createBuffer() {
									var canvas = this.canvas;
									try {
												return new ImageData(new Uint8ClampedArray(canvas.width * canvas.height * 4), canvas.width, canvas.height);
									} catch (e) {
												return this.ctx.createImageData(canvas.width, canvas.height);
									}
						}
			}, {
						key: "reset",
						value: function reset() {
									this.mode = 0;
									this.clockDivisor = 0x80;
									this.cmd = [];
									this.pos = 0;
									this.fb.data.fill(0);
									this.colStart = 0;
									this.colEnd = 127;
									this.pageStart = 0;
									this.pageEnd = 7;
									this.col = 0;
									this.page = 0;
						}
			}, {
						key: "cmdAE",
						value: function cmdAE() {
									this.activeBuffer = this.fbOFF;
						}

						// Set Display Clock Divisor v = 0xF0

			}, {
						key: "cmdD5",
						value: function cmdD5(v) {
									this.clockDivisor = v;
						}

						// Charge Pump Setting v = enable (0x14)

			}, {
						key: "cmd8D",
						value: function cmd8D(v) {
									this.chargePumpEnabled = v;
						}

						// Set Segment Re-map (A0) | (b0001)

			}, {
						key: "cmdA0",
						value: function cmdA0() {
									this.segmentRemap = 0;
						}
			}, {
						key: "cmdA1",
						value: function cmdA1() {
									this.segmentRemap = 1;
						}
			}, {
						key: "cmdA5",
						value: function cmdA5() {}
			}, {
						key: "cmd0",
						// multiplex something or other

						value: function cmd0() {
									this.colStart = this.colStart & 0xF0 | 0;
						}
			}, {
						key: "cmd1",
						value: function cmd1() {
									this.colStart = this.colStart & 0xF0 | 0x1;
						}
			}, {
						key: "cmd2",
						value: function cmd2() {
									this.colStart = this.colStart & 0xF0 | 0x2;
						}
			}, {
						key: "cmd3",
						value: function cmd3() {
									this.colStart = this.colStart & 0xF0 | 0x3;
						}
			}, {
						key: "cmd4",
						value: function cmd4() {
									this.colStart = this.colStart & 0xF0 | 0x4;
						}
			}, {
						key: "cmd5",
						value: function cmd5() {
									this.colStart = this.colStart & 0xF0 | 0x5;
						}
			}, {
						key: "cmd6",
						value: function cmd6() {
									this.colStart = this.colStart & 0xF0 | 0x6;
						}
			}, {
						key: "cmd7",
						value: function cmd7() {
									this.colStart = this.colStart & 0xF0 | 0x7;
						}
			}, {
						key: "cmd8",
						value: function cmd8() {
									this.colStart = this.colStart & 0xF0 | 0x8;
						}
			}, {
						key: "cmd9",
						value: function cmd9() {
									this.colStart = this.colStart & 0xF0 | 0x9;
						}
			}, {
						key: "cmdA",
						value: function cmdA() {
									this.colStart = this.colStart & 0xF0 | 0xA;
						}
			}, {
						key: "cmdB",
						value: function cmdB() {
									this.colStart = this.colStart & 0xF0 | 0xB;
						}
			}, {
						key: "cmdC",
						value: function cmdC() {
									this.colStart = this.colStart & 0xF0 | 0xC;
						}
			}, {
						key: "cmdD",
						value: function cmdD() {
									this.colStart = this.colStart & 0xF0 | 0xD;
						}
			}, {
						key: "cmdE",
						value: function cmdE() {
									this.colStart = this.colStart & 0xF0 | 0xE;
						}
			}, {
						key: "cmdF",
						value: function cmdF() {
									this.colStart = this.colStart & 0xF0 | 0xF;
						}
			}, {
						key: "cmd10",
						value: function cmd10() {
									this.colStart = this.colStart & 0x0F;
						}
			}, {
						key: "cmd11",
						value: function cmd11() {
									this.colStart = 0x1 << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd12",
						value: function cmd12() {
									this.colStart = 0x2 << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd13",
						value: function cmd13() {
									this.colStart = 0x3 << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd14",
						value: function cmd14() {
									this.colStart = 0x4 << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd15",
						value: function cmd15() {
									this.colStart = 0x5 << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd16",
						value: function cmd16() {
									this.colStart = 0x6 << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd17",
						value: function cmd17() {
									this.colStart = 0x7 << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd18",
						value: function cmd18() {
									this.colStart = 0x8 << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd19",
						value: function cmd19() {
									this.colStart = 0x9 << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd1A",
						value: function cmd1A() {
									this.colStart = 0xA << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd1B",
						value: function cmd1B() {
									this.colStart = 0xB << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd1C",
						value: function cmd1C() {
									this.colStart = 0xC << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd1D",
						value: function cmd1D() {
									this.colStart = 0xD << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd1E",
						value: function cmd1E() {
									this.colStart = 0xE << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmd1F",
						value: function cmd1F() {
									this.colStart = 0xF << 4 | this.colStart & 0x0F;
						}
			}, {
						key: "cmdB0",
						value: function cmdB0() {
									this.page = 0;
						}
			}, {
						key: "cmdB1",
						value: function cmdB1() {
									this.page = 1;
						}
			}, {
						key: "cmdB2",
						value: function cmdB2() {
									this.page = 2;
						}
			}, {
						key: "cmdB3",
						value: function cmdB3() {
									this.page = 3;
						}
			}, {
						key: "cmdB4",
						value: function cmdB4() {
									this.page = 4;
						}
			}, {
						key: "cmdB5",
						value: function cmdB5() {
									this.page = 5;
						}
			}, {
						key: "cmdB6",
						value: function cmdB6() {
									this.page = 6;
						}
			}, {
						key: "cmdB7",
						value: function cmdB7() {
									this.page = 7;
						}

						// Set COM Output Scan Direction

			}, {
						key: "cmdC8",
						value: function cmdC8() {}

						// Set COM Pins v

			}, {
						key: "cmdDA",
						value: function cmdDA(v) {}

						// Set Contrast v = 0xCF

			}, {
						key: "cmd81",
						value: function cmd81(v) {}

						// Set Precharge = 0xF1

			}, {
						key: "cmdD9",
						value: function cmdD9(v) {}

						// Set VCom Detect

			}, {
						key: "cmdDB",
						value: function cmdDB(v) {}

						// Entire Display ON

			}, {
						key: "cmdA4",
						value: function cmdA4(v) {
									this.activeBuffer = v ? this.fbON : this.fb;
						}

						// Set normal/inverse display

			}, {
						key: "cmdA6",
						value: function cmdA6(v) {}

						// Display On

			}, {
						key: "cmdAF",
						value: function cmdAF(v) {
									this.activeBuffer = this.fb;
						}

						// set display mode = horizontal addressing mode (0x00)

			}, {
						key: "cmd20",
						value: function cmd20(v) {}

						// set col address range

			}, {
						key: "cmd21",
						value: function cmd21(v, e) {
									this.colStart = v;
									this.colEnd = e;
									this.col = 0;
						}

						// set page address range

			}, {
						key: "cmd22",
						value: function cmd22(v, e) {
									this.pageStart = v;
									this.pageEnd = e;
									this.page = 0;
						}
			}]);

			return SCREEN;
}();

SCREEN["@inject"] = {
			pool: "pool"
};


module.exports = SCREEN;

},{}],17:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mvc = require('../lib/mvc.js');

var _dryDi = require('dry-di');

var _Atcore = require('../atcore/Atcore.js');

var _Atcore2 = _interopRequireDefault(_Atcore);

var _Hex = require('../atcore/Hex.js');

var _Hex2 = _interopRequireDefault(_Hex);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Arduboy = function () {
										function Arduboy(DOM) {
																				var _this = this;

																				_classCallCheck(this, Arduboy);

																				this.tick = [];


																				this.pool.add(this);

																				this.DOM = DOM;
																				this.parent = DOM.element.parentElement;
																				this.width = 0;
																				this.height = 0;
																				this.dead = false;

																				DOM.element.addEventListener("addperiferal", function (evt) {
																														return _this.addPeriferal(evt.target.controller);
																				});

																				this.periferals = [];

																				this.update = this._update.bind(this);
																				this.resize();

																				var url = this.root.getItem("app.AT328P.url", null);
																				if (url) {

																														this.core = _Atcore2.default.ATmega328P();

																														_Hex2.default.parseURL(url, this.core.flash, function (success) {
																																								if (success) _this.initCore();
																														});
																														return;
																				}

																				var hex = this.root.getItem("app.AT328P.hex", null);
																				if (hex) {

																														this.core = _Atcore2.default.ATmega328P();
																														_Hex2.default.parse(hex, this.core.flash);
																														this.initCore();
																														return;
																				}

																				url = this.root.getItem("app.AT32u4.url", null);
																				if (url) {

																														this.core = _Atcore2.default.ATmega32u4();
																														_Hex2.default.parseURL(url, this.core.flash, function (success) {
																																								if (success) _this.initCore();
																														});
																														return;
																				}

																				hex = this.root.getItem("app.AT32u4.hex", null);
																				if (hex) {

																														this.core = _Atcore2.default.ATmega32u4();
																														_Hex2.default.parse(hex, this.core.flash);
																														this.initCore();
																														return;
																				}

																				console.error("Nothing to load");
										}

										_createClass(Arduboy, [{
																				key: 'onPressEscape',
																				value: function onPressEscape() {
																														this.powerOff();
																				}
										}, {
																				key: 'setActiveView',
																				value: function setActiveView() {
																														this.pool.remove(this);
																				}
										}, {
																				key: 'powerOff',
																				value: function powerOff() {
																														this.pool.remove(this);
																														this.dead = true;
																														this.DOM.element.dispatchEvent(new Event("poweroff", { bubbles: true }));
																				}
										}, {
																				key: 'initCore',
																				value: function initCore() {
																														var _this2 = this;

																														var core = this.core,
																														    oldValues = {},
																														    DDRB = void 0,
																														    serial0Buffer = "",
																														    callbacks = {
																																								DDRB: {},
																																								DDRC: {},
																																								DDRD: {},
																																								PORTB: {},
																																								PORTC: {},
																																								PORTD: {},
																																								PORTE: {},
																																								PORTF: {}
																														};

																														Object.keys(callbacks).forEach(function (k) {
																																								return Object.assign(callbacks[k], {
																																																		onHighToLow: [],
																																																		onLowToHigh: []
																																								});
																														});

																														Object.defineProperties(core.pins, {

																																								onHighToLow: { value: function value(port, bit, cb) {
																																																												(callbacks[port].onHighToLow[bit] = callbacks[port][bit] || []).push(cb);
																																																		} },

																																								onLowToHigh: { value: function value(port, bit, cb) {
																																																												(callbacks[port].onLowToHigh[bit] = callbacks[port][bit] || []).push(cb);
																																																		} },

																																								0: { value: { out: { port: "PORTD", bit: 2 }, in: { port: "PIND", bit: 2 } } },
																																								1: { value: { out: { port: "PORTD", bit: 3 }, in: { port: "PIND", bit: 3 } } },
																																								2: { value: { out: { port: "PORTD", bit: 1 }, in: { port: "PIND", bit: 1 } } },
																																								3: { value: { out: { port: "PORTD", bit: 0 }, in: { port: "PIND", bit: 0 } } },
																																								4: { value: { out: { port: "PORTD", bit: 4 }, in: { port: "PIND", bit: 4 } } },
																																								5: { value: { out: { port: "PORTC", bit: 6 }, in: { port: "PINC", bit: 6 } } },
																																								6: { value: { out: { port: "PORTD", bit: 7 }, in: { port: "PIND", bit: 7 } } },
																																								7: { value: { out: { port: "PORTE", bit: 6 }, in: { port: "PINE", bit: 6 } } },
																																								8: { value: { out: { port: "PORTB", bit: 4 }, in: { port: "PINB", bit: 4 } } },
																																								9: { value: { out: { port: "PORTB", bit: 5 }, in: { port: "PINB", bit: 5 } } },
																																								10: { value: { out: { port: "PORTB", bit: 6 }, in: { port: "PINB", bit: 6 } } },
																																								11: { value: { out: { port: "PORTB", bit: 7 }, in: { port: "PINB", bit: 7 } } },

																																								16: { value: { out: { port: "PORTB", bit: 2 }, in: { port: "PINB", bit: 2 } } },
																																								14: { value: { out: { port: "PORTB", bit: 3 }, in: { port: "PINB", bit: 3 } } },
																																								15: { value: { out: { port: "PORTB", bit: 1 }, in: { port: "PINB", bit: 1 } } },
																																								17: { value: { out: { port: "PORTB", bit: 0 }, in: { port: "PINB", bit: 0 } } },

																																								18: { value: { out: { port: "PORTF", bit: 7 }, in: { port: "PINF", bit: 7 } } },
																																								A0: { value: { out: { port: "PORTF", bit: 7 }, in: { port: "PINF", bit: 7 } } },
																																								19: { value: { out: { port: "PORTF", bit: 6 }, in: { port: "PINF", bit: 6 } } },
																																								A1: { value: { out: { port: "PORTF", bit: 6 }, in: { port: "PINF", bit: 6 } } },
																																								20: { value: { out: { port: "PORTF", bit: 5 }, in: { port: "PINF", bit: 5 } } },
																																								A2: { value: { out: { port: "PORTF", bit: 5 }, in: { port: "PINF", bit: 5 } } },
																																								21: { value: { out: { port: "PORTF", bit: 4 }, in: { port: "PINF", bit: 4 } } },
																																								A3: { value: { out: { port: "PORTF", bit: 4 }, in: { port: "PINF", bit: 4 } } },

																																								MOSI: { value: {} },
																																								MISO: { value: {} },

																																								spiIn: {
																																																		value: []
																																								},

																																								spiOut: {
																																																		value: {
																																																												listeners: [],
																																																												push: function push(data) {
																																																																						var i = 0,
																																																																						    listeners = this.listeners,
																																																																						    l = listeners.length;
																																																																						for (; i < l; ++i) {
																																																																																listeners[i](data);
																																																																						}
																																																												}
																																																		}
																																								},

																																								serial0: {
																																																		set: function set(str) {
																																																												str = (str || "").replace(/\r\n?/, '\n');
																																																												serial0Buffer += str;

																																																												var br = serial0Buffer.indexOf("\n");
																																																												if (br != -1) {

																																																																						var parts = serial0Buffer.split("\n");
																																																																						while (parts.length > 1) {
																																																																																console.log('SERIAL: ', parts.shift());
																																																																						}serial0Buffer = parts[0];
																																																												}
																																																		}
																																								},

																																								DDRB: {
																																																		set: setDDR.bind(null, "DDRB"),
																																																		get: function get() {
																																																												return oldValues.DDRB | 0;
																																																		}
																																								},
																																								DDRC: {
																																																		set: setDDR.bind(null, "DDRC")
																																								},
																																								DDRD: {
																																																		set: setDDR.bind(null, "DDRD")
																																								},
																																								DDRE: {
																																																		set: setDDR.bind(null, "DDRD")
																																								},
																																								DDRF: {
																																																		set: setDDR.bind(null, "DDRD")
																																								},
																																								PORTB: {
																																																		set: setPort.bind(null, "PORTB")
																																								},
																																								PORTC: {
																																																		set: setPort.bind(null, "PORTC")
																																								},
																																								PORTD: {
																																																		set: setPort.bind(null, "PORTD")
																																								},
																																								PORTE: {
																																																		set: setPort.bind(null, "PORTE")
																																								},
																																								PORTF: {
																																																		set: setPort.bind(null, "PORTF")
																																								}

																														});

																														setTimeout(function (_) {
																																								_this2.setupPeriferals();
																																								_this2._update();
																														}, 5);

																														function setDDR(name, cur) {
																																								var old = oldValues[name];
																																								if (old === cur) return;
																																								oldValues[name] = cur;
																														}

																														function setPort(name, cur) {
																																								var old = oldValues[name];

																																								if (old === cur) return;
																																								var s,
																																								    j,
																																								    l,
																																								    lth = callbacks[name].onLowToHigh,
																																								    htl = callbacks[name].onHighToLow,
																																								    tick = core.tick;

																																								for (var i = 0; i < 8; ++i) {

																																																		var ob = old >>> i & 1,
																																																		    nb = cur >>> i & 1;
																																																		if (lth[i] && !ob && nb) {
																																																												for (j = 0, s = lth[i], l = s.length; j < l; ++j) {
																																																																						s[j](tick);
																																																												}
																																																		}
																																																		if (htl[i] && ob && !nb) {
																																																												for (j = 0, s = htl[i], l = s.length; j < l; ++j) {
																																																																						s[j](tick);
																																																												}
																																																		}
																																								}

																																								oldValues[name] = cur;
																														}
																				}
										}, {
																				key: 'addPeriferal',
																				value: function addPeriferal(ctrl) {

																														this.periferals.push(ctrl);
																				}
										}, {
																				key: 'setupPeriferals',
																				value: function setupPeriferals() {
																														var _this3 = this;

																														var pins = this.core.pins;
																														var map = { cpu: this.core.pins };

																														this.periferals.forEach(function (ctrl) {

																																								if (ctrl.tick) _this3.tick.push(ctrl);

																																								for (var k in ctrl) {

																																																		var v = ctrl[k];
																																																		if (!v || !v.connect) continue;

																																																		var target = v.connect;
																																																		if (typeof target == "number") target = "cpu." + target;

																																																		var tobj = map;
																																																		var tparts = target.split(".");
																																																		while (tparts.length && tobj) {
																																																												tobj = tobj[tparts.shift()];
																																																		}if (v.MOSI) pins.spiOut.listeners.push(v.MOSI.bind(ctrl));

																																																		if (!tobj) {
																																																												console.warn("Could not attach wire from ", k, " to ", target);
																																																												continue;
																																																		}

																																																		if (v.onLowToHigh) pins.onLowToHigh(tobj.out.port, tobj.out.bit, v.onLowToHigh.bind(ctrl));

																																																		if (v.onHighToLow) pins.onHighToLow(tobj.out.port, tobj.out.bit, v.onHighToLow.bind(ctrl));

																																																		var setter = function (tobj, nv) {

																																																												if (nv) pins[tobj.in.port] |= 1 << tobj.in.bit;else pins[tobj.in.port] &= ~(1 << tobj.in.bit);
																																																		}.bind(_this3, tobj);

																																																		var getter = function (tobj) {
																																																												return pins[tobj.out.port] >>> tobj.out.bit & 1;
																																																		}.bind(_this3, tobj);

																																																		Object.defineProperty(v, "value", {
																																																												set: setter,
																																																												get: getter
																																																		});

																																																		if (v.init) v.init.call(ctrl);
																																								}
																														});
																				}
										}, {
																				key: '_update',
																				value: function _update() {
																														if (this.dead) return;

																														requestAnimationFrame(this.update);
																														this.core.update();
																														this.resize();
																														for (var i = 0, l = this.tick.length; i < l; ++i) {
																																								this.tick[i].tick();
																														}
																				}
										}, {
																				key: 'resize',
																				value: function resize() {

																														var maxHeight = this.parent.clientHeight;
																														var maxWidth = this.parent.clientWidth;

																														if (this.width == maxWidth && this.height == maxHeight) return;

																														this.width = maxWidth;
																														this.height = maxHeight;

																														var ratio = 393 / 624;

																														if (this.height * ratio > this.width) {
																																								this.DOM.element.style.width = this.width + "px";
																																								this.DOM.element.style.height = this.width / ratio + "px";
																														} else {
																																								this.DOM.element.style.width = this.height * ratio + "px";
																																								this.DOM.element.style.height = this.height + "px";
																														}
																				}
										}]);

										return Arduboy;
}();

Arduboy["@inject"] = {
										root: [_mvc.Model, { scope: "root" }],
										pool: "pool"
};


module.exports = Arduboy;

},{"../atcore/Atcore.js":12,"../atcore/Hex.js":13,"../lib/mvc.js":26,"dry-di":3}],18:[function(require,module,exports){
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Config = function Config(DOM) {
    _classCallCheck(this, Config);

    DOM.element.innerHTML = "C O N F I G";
};

module.exports = Config;

},{}],19:[function(require,module,exports){
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Files = function Files(DOM) {
    _classCallCheck(this, Files);

    DOM.element.innerHTML = "C O N F I G";
};

module.exports = Files;

},{}],20:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mvc = require("../lib/mvc.js");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Market = function () {
    function Market(DOM) {
        _classCallCheck(this, Market);
    }

    _createClass(Market, [{
        key: "run",
        value: function run() {
            this.pool.call("runSim");
        }
    }]);

    return Market;
}();

Market["@inject"] = {
    root: [_mvc.Model, { scope: "root" }]
};


module.exports = Market;

},{"../lib/mvc.js":26}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _IStore = require('../store/IStore.js');

var _IStore2 = _interopRequireDefault(_IStore);

var _mvc = require('../lib/mvc.js');

var _jszipMin = require('jszip/dist/jszip.min.js');

var _jszipMin2 = _interopRequireDefault(_jszipMin);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Env = function (_IController) {
	_inherits(Env, _IController);

	function Env() {
		_classCallCheck(this, Env);

		return _possibleConstructorReturn(this, (Env.__proto__ || Object.getPrototypeOf(Env)).apply(this, arguments));
	}

	_createClass(Env, [{
		key: 'exitSplash',
		value: function exitSplash() {
			/* */
			this._show();
			/*/
   this.model.setItem("app.AT32u4.url", "HelloWorld32u4.hex");
   this.pool.call("runSim");
   /* */
		}
	}, {
		key: 'exitSim',
		value: function exitSim() {
			this._show();
		}
	}, {
		key: 'onDropFile',
		value: function onDropFile(dom, event) {
			event.stopPropagation();
			event.preventDefault();

			var dt = event.dataTransfer;
			var files = dt.files;

			for (var i = 0; i < files.length; i++) {
				var file = files[i];
				if (/.*\.arduboy$|.*\.hex$/i.test(file.name)) return loadFile.call(this, file);
			}

			function loadFile(file) {
				var _this2 = this;

				var fr = new FileReader();
				fr.onload = function (evt) {
					_this2.model.removeItem("app.AT32u4");
					_this2.model.setItem("app.AT32u4.hex", fr.result);
					_this2.pool.call("runSim");
				};
				fr.readAsText(file);
			}
		}
	}, {
		key: 'play',
		value: function play(opt) {
			var _this3 = this;

			var url = opt.element.dataset.url;

			this.model.removeItem("app.AT32u4");

			if (/\.arduboy$/i.test(url)) {

				var zip = null;
				fetch(this.model.getItem("app.proxy") + url).then(function (rsp) {
					return rsp.arrayBuffer();
				}).then(function (buff) {
					return _jszipMin2.default.loadAsync(buff);
				}).then(function (z) {
					return (zip = z).file("info.json").async("text");
				}).then(function (info) {
					return zip.file(JSON.parse(fixJSON(info)).binaries[0].filename).async("text");
				}).then(function (hex) {
					_this3.model.setItem("app.AT32u4.hex", hex);
					_this3.pool.call("runSim");
				}).catch(function (err) {
					console.error(err);
				});
			} else {
				this.model.setItem("app.AT32u4.url", this.model.getItem("app.proxy") + url);
				this.pool.call("runSim");
			}

			function fixJSON(str) {

				if (str.charCodeAt(0) == 0xFEFF) str = str.substr(1);

				return str.replace(/\,(?!\s*?[\{\[\"\'\w])/g, '');
			}
		}
	}]);

	return Env;
}(_mvc.IController);

Env["@inject"] = {
	store: _IStore2.default,
	pool: "pool",
	viewFactory: [_mvc.IView, { controller: Env }],
	model: [_mvc.Model, { scope: "root" }]
};
exports.default = Env;

},{"../lib/mvc.js":26,"../store/IStore.js":30,"jszip/dist/jszip.min.js":5}],22:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mvc = require("../lib/mvc.js");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Sim = function (_IController) {
    _inherits(Sim, _IController);

    function Sim() {
        _classCallCheck(this, Sim);

        return _possibleConstructorReturn(this, (Sim.__proto__ || Object.getPrototypeOf(Sim)).apply(this, arguments));
    }

    _createClass(Sim, [{
        key: "runSim",
        value: function runSim() {
            this._show();
        }
    }, {
        key: "onEndSim",
        value: function onEndSim() {
            this.pool.call("exitSim");
        }
    }]);

    return Sim;
}(_mvc.IController);

Sim["@inject"] = {
    pool: "pool",
    viewFactory: [_mvc.IView, { controller: Sim }],
    model: [_mvc.Model, { scope: "root" }]
};
exports.default = Sim;

},{"../lib/mvc.js":26}],23:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mvc = require("../lib/mvc.js");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // import IStore from '../store/IStore.js';


var Splash = function (_IController) {
    _inherits(Splash, _IController);

    function Splash() {
        var _ref;

        var _temp, _this, _ret;

        _classCallCheck(this, Splash);

        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Splash.__proto__ || Object.getPrototypeOf(Splash)).call.apply(_ref, [this].concat(args))), _this), _this.BODY = {
            bound: function bound(evt) {
                var target = evt.target;
            }
        }, _temp), _possibleConstructorReturn(_this, _ret);
    }

    _createClass(Splash, [{
        key: "enterSplash",
        value: function enterSplash() {
            this._show();
        }
    }]);

    return Splash;
}(_mvc.IController);

Splash["@inject"] = {
    pool: "pool",
    viewFactory: [_mvc.IView, { controller: Splash }]
};
exports.default = Splash;

},{"../lib/mvc.js":26}],24:[function(require,module,exports){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

module.exports = DOM;

function DOM(element) {

    if (!element && document && document.body) element = document.body;

    this.element = element;
}

var spare = null;
function getThis(that) {

    if (!that || typeof that == "function") return spare = spare || new DOM();

    return that;
}

function prototype(obj) {

    var desc = {};
    for (var k in obj) {
        desc[k] = {
            enumerable: false,
            value: obj[k]
        };
    }

    var ret = {};
    Object.defineProperties(ret, desc);

    return ret;
}

var impl = {

    create: function create(strTagName, objProperties, arrChildren, elParent) {
        var args = Array.from(arguments);
        strTagName = objProperties = arrChildren = elParent = undefined;

        for (var i = 0, l = args.length; i < l; ++i) {
            var arg = args[i];
            if (typeof arg == "string") strTagName = arg;else if ((typeof arg === "undefined" ? "undefined" : _typeof(arg)) == "object") {
                if (Array.isArray(arg)) arrChildren = arg;else if (arg instanceof Element) elParent = arg;else objProperties = arg;
            }
        }

        if (!elParent && this.element) elParent = this.element;

        if (!strTagName) {
            if (!elParent) strTagName = "span";else strTagName = {
                table: "tr",
                tr: "td",
                select: "option",
                ul: "li",
                ol: "li",
                dl: "dt",
                optgroup: "option",
                datalist: "option"
            }[elParent.tagName] || elParent.tagName;
        }

        var element = document.createElement(strTagName);
        if (elParent) elParent.appendChild(element);

        var listener;

        for (var key in objProperties) {
            var value = objProperties[key];
            if (key == "text") element.appendChild(document.createTextNode(value));else if (key == "listener") listener = value;else if (key == "attr") {
                for (var attr in value) {
                    element.setAttribute(attr, value[attr]);
                }
            } else if (element[key] && _typeof(element[key]) == "object" && (typeof value === "undefined" ? "undefined" : _typeof(value)) == "object") Object.assign(element[key], value);else element[key] = value;
        }

        if (this.element && element.id) this[element.id] = element;

        for (i = 0, l = arrChildren && arrChildren.length; i < l; ++i) {
            this.create.apply(this, arrChildren[i].concat(element));
        }

        if (listener) new DOM(element).listen(listener);

        return element;
    },

    listen: function listen(listeners, that, prefix) {
        prefix = prefix || "";
        if (that === undefined) that = listeners;

        var THIS = getThis(this);

        var keys = Object.keys(listeners);

        THIS.forEach(function (element) {

            if (listeners[prefix + element.tagName]) bind(listeners[prefix + element.tagName], element);

            if (listeners[prefix + element.id]) bind(listeners[prefix + element.id], element);

            if (listeners[prefix + element.className]) bind(listeners[prefix + element.className], element);

            if (listeners[prefix + element.name]) bind(listeners[prefix + element.name], element);
        });

        return THIS;

        function bind(obj, element) {

            for (var event in obj) {
                var func = obj[event];
                if (!func.call) continue;
                element.addEventListener(event, that ? func.bind(that) : func);
            }
        }
    },

    index: function index(keys, multiple, property) {
        var THIS = getThis(this);

        var index = Object.create(DOM.prototype);

        if (typeof keys == "string") keys = [keys];

        for (var i = 0, l = keys.length; i < l; ++i) {

            var key = keys[i];
            if (typeof key != "string") continue;

            if (!property && !multiple) {

                THIS.forEach(function (child) {
                    return child[key] !== undefined && (index[child[key]] = child);
                });
            } else if (property && !multiple) {

                THIS.forEach(function (child) {
                    if (child[property] && _typeof(child[property]) == "object" && child[property][key] !== undefined) index[child[property][key]] = child;
                });
            } else if (!property && typeof multiple == "function") {

                THIS.forEach(function (child) {
                    if (child[key] !== undefined) multiple(child[key], child);
                });
            } else if (property && typeof multiple == "function") {

                THIS.forEach(function (child) {

                    if (!child[property] || _typeof(child[property]) != "object") return;

                    var v = child[property][key];
                    if (v !== undefined) multiple(v, child);
                });
            } else if (!property && multiple) {

                THIS.forEach(function (child) {
                    if (child[key] !== undefined) {
                        if (!index[child[key]]) index[child[key]] = [child];else index[child[key]].push(child);
                    }
                });
            } else if (property && multiple) {

                THIS.forEach(function (child) {

                    if (!child[property] || _typeof(child[property]) != "object") return;

                    var v = child[property][key];
                    if (v !== undefined) {
                        if (!index[v]) index[v] = [child];else index[v].push(child);
                    }
                });
            }
        }

        return index;
    },

    forEach: function forEach(cb, element) {
        var THIS = getThis(this);

        element = element || THIS.element;

        if (!element) return;

        if (cb(element) === false) return;

        if (!element.children) return;

        for (var i = 0, l = element.children.length; i < l; ++i) {
            THIS.forEach(cb, element.children[i]);
        }
    }

};

Object.assign(DOM, impl);
DOM.prototype = prototype(impl);

},{}],25:[function(require,module,exports){
"use strict";

/*
  I've wrapped Makoto Matsumoto and Takuji Nishimura's code in a namespace
  so it's better encapsulated. Now you can have multiple random number generators
  and they won't stomp all over eachother's state.
  
  If you want to use this as a substitute for Math.random(), use the random()
  method like so:
  
  var m = new MersenneTwister();
  var randomNumber = m.random();
  
  You can also call the other genrand_{foo}() methods on the instance.
  If you want to use a specific seed in order to get a repeatable random
  sequence, pass an integer into the constructor:
  var m = new MersenneTwister(123);
  and that will always produce the same random sequence.
  Sean McCullough (banksean@gmail.com)
*/

/* 
   A C-program for MT19937, with initialization improved 2002/1/26.
   Coded by Takuji Nishimura and Makoto Matsumoto.
 
   Before using, initialize the state by using init_genrand(seed)  
   or init_by_array(init_key, key_length).
 
   Copyright (C) 1997 - 2002, Makoto Matsumoto and Takuji Nishimura,
   All rights reserved.                          
 
   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions
   are met:
 
     1. Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.
 
     2. Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.
 
     3. The names of its contributors may not be used to endorse or promote 
        products derived from this software without specific prior written 
        permission.
 
   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
   "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
   LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
   A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR
   CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
   EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
   PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 
 
   Any feedback is very welcome.
   http://www.math.sci.hiroshima-u.ac.jp/~m-mat/MT/emt.html
   email: m-mat @ math.sci.hiroshima-u.ac.jp (remove space)
*/

var MersenneTwister = function MersenneTwister(seed) {
  if (seed == undefined) {
    seed = new Date().getTime();
  }
  /* Period parameters */
  this.N = 624;
  this.M = 397;
  this.MATRIX_A = 0x9908b0df; /* constant vector a */
  this.UPPER_MASK = 0x80000000; /* most significant w-r bits */
  this.LOWER_MASK = 0x7fffffff; /* least significant r bits */

  this.mt = new Array(this.N); /* the array for the state vector */
  this.mti = this.N + 1; /* mti==N+1 means mt[N] is not initialized */

  this.init_genrand(seed);
};

/* initializes mt[N] with a seed */
MersenneTwister.prototype.init_genrand = function (s) {
  this.mt[0] = s >>> 0;
  for (this.mti = 1; this.mti < this.N; this.mti++) {
    var s = this.mt[this.mti - 1] ^ this.mt[this.mti - 1] >>> 30;
    this.mt[this.mti] = (((s & 0xffff0000) >>> 16) * 1812433253 << 16) + (s & 0x0000ffff) * 1812433253 + this.mti;
    /* See Knuth TAOCP Vol2. 3rd Ed. P.106 for multiplier. */
    /* In the previous versions, MSBs of the seed affect   */
    /* only MSBs of the array mt[].                        */
    /* 2002/01/09 modified by Makoto Matsumoto             */
    this.mt[this.mti] >>>= 0;
    /* for >32 bit machines */
  }
};

/* initialize by an array with array-length */
/* init_key is the array for initializing keys */
/* key_length is its length */
/* slight change for C++, 2004/2/26 */
MersenneTwister.prototype.init_by_array = function (init_key, key_length) {
  var i, j, k;
  this.init_genrand(19650218);
  i = 1;j = 0;
  k = this.N > key_length ? this.N : key_length;
  for (; k; k--) {
    var s = this.mt[i - 1] ^ this.mt[i - 1] >>> 30;
    this.mt[i] = (this.mt[i] ^ (((s & 0xffff0000) >>> 16) * 1664525 << 16) + (s & 0x0000ffff) * 1664525) + init_key[j] + j; /* non linear */
    this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
    i++;j++;
    if (i >= this.N) {
      this.mt[0] = this.mt[this.N - 1];i = 1;
    }
    if (j >= key_length) j = 0;
  }
  for (k = this.N - 1; k; k--) {
    var s = this.mt[i - 1] ^ this.mt[i - 1] >>> 30;
    this.mt[i] = (this.mt[i] ^ (((s & 0xffff0000) >>> 16) * 1566083941 << 16) + (s & 0x0000ffff) * 1566083941) - i; /* non linear */
    this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
    i++;
    if (i >= this.N) {
      this.mt[0] = this.mt[this.N - 1];i = 1;
    }
  }

  this.mt[0] = 0x80000000; /* MSB is 1; assuring non-zero initial array */
};

/* generates a random number on [0,0xffffffff]-interval */
MersenneTwister.prototype.genrand_int32 = function () {
  var y;
  var mag01 = new Array(0x0, this.MATRIX_A);
  /* mag01[x] = x * MATRIX_A  for x=0,1 */

  if (this.mti >= this.N) {
    /* generate N words at one time */
    var kk;

    if (this.mti == this.N + 1) /* if init_genrand() has not been called, */
      this.init_genrand(5489); /* a default initial seed is used */

    for (kk = 0; kk < this.N - this.M; kk++) {
      y = this.mt[kk] & this.UPPER_MASK | this.mt[kk + 1] & this.LOWER_MASK;
      this.mt[kk] = this.mt[kk + this.M] ^ y >>> 1 ^ mag01[y & 0x1];
    }
    for (; kk < this.N - 1; kk++) {
      y = this.mt[kk] & this.UPPER_MASK | this.mt[kk + 1] & this.LOWER_MASK;
      this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ y >>> 1 ^ mag01[y & 0x1];
    }
    y = this.mt[this.N - 1] & this.UPPER_MASK | this.mt[0] & this.LOWER_MASK;
    this.mt[this.N - 1] = this.mt[this.M - 1] ^ y >>> 1 ^ mag01[y & 0x1];

    this.mti = 0;
  }

  y = this.mt[this.mti++];

  /* Tempering */
  y ^= y >>> 11;
  y ^= y << 7 & 0x9d2c5680;
  y ^= y << 15 & 0xefc60000;
  y ^= y >>> 18;

  return y >>> 0;
};

/* generates a random number on [0,0x7fffffff]-interval */
MersenneTwister.prototype.genrand_int31 = function () {
  return this.genrand_int32() >>> 1;
};

/* generates a random number on [0,1]-real-interval */
MersenneTwister.prototype.genrand_real1 = function () {
  return this.genrand_int32() * (1.0 / 4294967295.0);
  /* divided by 2^32-1 */
};

/* generates a random number on [0,1)-real-interval */
MersenneTwister.prototype.random = function () {
  return this.genrand_int32() * (1.0 / 4294967296.0);
  /* divided by 2^32 */
};

/* generates a random number on (0,1)-real-interval */
MersenneTwister.prototype.genrand_real3 = function () {
  return (this.genrand_int32() + 0.5) * (1.0 / 4294967296.0);
  /* divided by 2^32 */
};

/* generates a random number on [0,1) with 53-bit resolution*/
MersenneTwister.prototype.genrand_res53 = function () {
  var a = this.genrand_int32() >>> 5,
      b = this.genrand_int32() >>> 6;
  return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
};

/* These real versions are due to Isaku Wada, 2002/01/09 added */

module.exports = MersenneTwister;

},{}],26:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.boot = exports.IController = exports.IView = exports.Model = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _dryDi = require('dry-di');

var _strldr = require('./strldr.js');

var _strldr2 = _interopRequireDefault(_strldr);

var _IStore = require('../store/IStore.js');

var _IStore2 = _interopRequireDefault(_IStore);

var _dryDom = require('./dry-dom.js');

var _dryDom2 = _interopRequireDefault(_dryDom);

var _pool = require('./pool.js');

var _pool2 = _interopRequireDefault(_pool);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function read(str, ctx) {

    var parts = str.split("."),
        i = 0;

    while (i < parts.length && ctx) {
        ctx = ctx[parts[i++]];
    }return ctx;
}

function readMethod(str, ctx) {
    var _ctx;

    var parts = str.split("."),
        i = 0;

    var pctx = ctx;

    while (i < parts.length && ctx) {
        pctx = ctx;
        ctx = ctx[parts[i++]];
    }

    for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
    }

    if (ctx && typeof ctx === "function") return (_ctx = ctx).bind.apply(_ctx, [pctx].concat(args));

    return null;
}

function write(str, value, ctx) {

    var parts = str.split("."),
        i = 0;

    while (parts.length - 1 && ctx) {
        if (!(parts[i] in ctx)) ctx[parts[i]] = {};
        ctx = ctx[parts[i++]];
    }

    if (ctx) ctx[parts[i]] = value;

    return !!ctx;
}

var pending = [];
var nextModelId = 0;

var Model = function () {
    function Model() {
        var _this = this;

        _classCallCheck(this, Model);

        var listeners = {};
        var data = {};
        var children = {};
        var revChildren = {};
        var parents = {};

        Object.defineProperty(data, "__model__", { value: this, writable: false, enumerable: false });

        Object.defineProperties(this, {
            root: { value: this, enumerable: false, writable: true },
            listeners: { value: listeners, enumerable: false, writable: false },
            data: { value: data, enumerable: false, writable: true },
            children: { value: children, enumerable: false, writable: false },
            revChildren: { value: revChildren, enumerable: false, writable: false },
            parents: { value: parents, enumerable: false, writable: false },
            id: { value: ++nextModelId, enumerable: false, writable: false },
            dirty: {
                get: function get() {
                    return _this.root.__dirty;
                },
                set: function set(v) {
                    return _this.root.__dirty = v;
                }
            }
        });
    }

    _createClass(Model, [{
        key: 'store',
        value: function store() {
            var binary = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

            return _strldr2.default.store(this.data, binary);
        }
    }, {
        key: 'load',
        value: function load(data) {
            var doRaise = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;


            if (typeof data === "string") {
                try {
                    data = JSON.parse(data);
                    data = _strldr2.default.load(data);
                } catch (ex) {}
            }

            if (data && data.buffer && data.buffer instanceof ArrayBuffer) {
                if (!(data instanceof Uint8Array)) data = new Uint8Array(data.buffer);
                data = _strldr2.default.load(data, true);
            }

            for (var k in data) {
                this.setItem(k, data[k], doRaise);
            }

            return this;
        }
    }, {
        key: 'setItem',
        value: function setItem(k, v) {
            var doRaise = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;


            if (k.charCodeAt) k = k.split(".");
            var prop = k.shift(),
                child;
            var data = this.data,
                children = this.children,
                revChildren = this.revChildren;

            if (k.length) {

                child = children[prop];
                if (!child) {
                    child = children[prop] = new Model();
                    child.root = this.root;
                    child.parents[this.id] = this;
                    data[prop] = child.data;
                    this.dirty = true;
                    revChildren[child.id] = [prop];
                    this.raise(prop, false);
                }

                return children[prop].setItem(k, v, doRaise);
            }

            if (children[prop]) {

                if (children[prop].data !== v) return;

                child = children[prop];

                var index = revChildren[child.id].indexOf(prop);
                if (index === -1) throw new Error("Integrity compromised");

                revChildren[child.id].splice(index, 1);

                delete child.parents[this.id];
            }

            if (v && (typeof v === 'undefined' ? 'undefined' : _typeof(v)) == "object") {

                var doLoad = false;
                if (!v.__model__) {
                    child = new Model();
                    child.root = this.root;
                    doLoad = true;
                } else {
                    child = v.__model__;
                }

                if (!revChildren[child.id]) revChildren[child.id] = [prop];else revChildren[child.id].push(prop);
                children[prop] = child;
                child.parents[this.id] = this;

                if (doLoad) {
                    child.load(v, false);
                    child.data = v;
                    Object.defineProperty(v, "__model__", { value: child, writable: false });
                }
            }

            data[prop] = v;

            this.dirty = true;
            this.raise(prop, doRaise);

            return this;
        }
    }, {
        key: 'getModel',
        value: function getModel(k, create) {

            if (k.charCodeAt) k = k.split(".");

            var ctx = this,
                i = 0;
            if (create) {
                while (ctx && i < k.length) {
                    if (!ctx.children[k[i]]) ctx.setItem(k[i], {});
                    ctx = ctx.children[k[i++]];
                }
            } else {
                while (ctx && i < k.length) {
                    ctx = ctx.children[k[i++]];
                }
            }

            return ctx;
        }
    }, {
        key: 'getItem',
        value: function getItem(k, defaultValue) {
            var v = read(k, this.data);
            if (v === undefined) v = defaultValue;
            return v;
        }
    }, {
        key: 'removeItem',
        value: function removeItem(k, cb) {

            var parent = k.split(".");
            var key = parent.pop();

            var model = this.getModel(parent);
            var data = model.data,
                children = model.children;

            if (!(key in data)) return;

            if (children[key]) {

                var child = children[key],
                    revChildren = model.revChildren[child.id];

                var index = revChildren.indexOf(key);
                if (index == -1) throw "Integrity compromised";

                revChildren.splice(index, 1);

                if (revChildren.length == 0) {
                    delete child.parents[model.id];
                    delete model.revChildren[child.id];
                }

                delete children[key];
            }

            delete data[key];

            model.raise(key, true);
        }
    }, {
        key: 'raise',
        value: function raise(k, doRaise) {

            pending[pending.length++] = { model: this, key: k };

            if (!doRaise) return;

            for (var i = 0, l = pending.length; i < l; ++i) {

                k = pending[i].key;
                var model = pending[i].model;

                if (k) {

                    dispatch(model.listeners[k], model.data[k], k);
                } else {

                    for (var pid in model.parents) {

                        var parent = model.parents[pid];
                        var revChildren = parent.revChildren[model.id];
                        if (!revChildren) throw "Integrity compromised";

                        for (var j = 0, rcl = revChildren.length; j < rcl; ++j) {

                            dispatch(parent.listeners[revChildren[j]], parent.data, revChildren[j]);
                        }
                    }
                }
            }

            pending.length = 0;

            function dispatch(listeners, value, key) {

                if (!listeners) return;

                for (var i = 0, l = listeners.length; i < l; ++i) {
                    listeners[i](value, key);
                }
            }
        }

        // attach( k:String, cb:Function )
        // listen to notifications from a particular key
        // attach( cb:Function )
        // listen to key additions/removals

    }, {
        key: 'attach',
        value: function attach(k, cb) {
            var key = k.split(".");
            var model;
            if (key.length == 1) {
                key = k;
                model = this;
            } else {
                k = key.pop();
                model = this.getModel(key, true);
                key = k;
            }

            if (!model.listeners[key]) model.listeners[key] = [cb];else model.listeners[key].push(cb);
        }

        // stop listening

    }, {
        key: 'detach',
        value: function detach(k, cb) {

            var index, listeners;

            if (typeof k == "function") {
                cb = k;
                k = "";
            }

            listeners = this.listeners[k];
            if (!listeners[k]) return;

            index = listeners.indexOf(cb);
            if (index == -1) return;

            listeners.splice(index, 1);
        }
    }]);

    return Model;
}();

var cache = {};

var IView = function () {
    function IView(controller) {
        var _this2 = this;

        _classCallCheck(this, IView);

        var layout = "layouts/" + controller.constructor.name + ".html";
        this.controller = controller;
        this.dom = null;

        if (!cache[layout]) {

            fetch(layout).then(function (rsp) {

                if (!rsp.ok && rsp.status !== 0) throw new Error("Not OK!");
                return rsp.text();
            }).then(function (text) {
                return new window.DOMParser().parseFromString(text, "text/html");
            }).then(function (html) {
                cache[layout] = html;
                _this2.loadLayout(html);
            }).catch(function (ex) {

                _this2.parentElement.innerHTML = '<div>' + (ex.message || ex) + (': ' + layout + '!</div>');
            });
        } else this.loadLayout(cache[layout]);
    }

    _createClass(IView, [{
        key: 'loadLayout',
        value: function loadLayout(doc) {
            var _this3 = this;

            doc = doc.cloneNode(true);
            [].concat(_toConsumableArray(doc.body.children)).forEach(function (child) {
                return _this3.parentElement.appendChild(child);
            });

            var dom = new _dryDom2.default(this.parentElement);
            this.dom = dom;

            prepareDOM(dom, this.controller, this.model);
        }
    }]);

    return IView;
}();

IView["@inject"] = {
    parentElement: "ParentElement",
    model: [Model, { scope: 'root' }]
};


function prepareDOM(dom, controller, _model) {

    dom.forEach(function (element) {

        if (element.dataset.src && !element.dataset.inject) {
            switch (element.tagName) {
                case 'UL':
                case 'OL':
                    var template = element.cloneNode(true);
                    _model.attach(element.dataset.src, renderList.bind(element, template));
                    renderList(element, template, _model.getItem(element.dataset.src));
                    break;

                default:
                    break;
            }
            return false;
        }

        for (var i = 0; i < element.attributes.length; ++i) {
            var key = element.attributes[i].name;
            var value = element.attributes[i].value;

            var parts = key.split("-");

            if (parts.length == 2) switch (parts[1]) {
                case "call":
                    var target = readMethod(value, controller, dom);
                    if (target) element.addEventListener(parts[0], target);else console.warn("Could not bind event to " + controller.constructor.name + "." + name);

                    break;

                case "toggle":
                    var vparts = value.match(/^([^@]+)\@([^=]+)\=(.+)$/);

                    if (vparts) bindToggle(element, parts[0], vparts);else console.warn("Could not parse toggle: " + value);
                    break;

            }

            var memo = { __src: value, __hnd: 0 };
            value.replace(/\{\{([^\}]+)\}\}/g, bindAttribute.bind(null, element.attributes[i], memo));
            updateAttribute(element.attributes[i], memo);
        }

        if (element.dataset.inject && element != dom.element) {

            var childDom = new _dryDom2.default(element);
            Object.assign(childDom, childDom.index("id"));

            var ctrl = (0, _dryDi.getInstanceOf)(element.dataset.inject, childDom);
            dom[element.dataset.inject] = ctrl;

            prepareDOM(childDom, ctrl);

            return false;
        }
    });

    function bindToggle(element, event, cmd) {
        element.addEventListener(event, function () {
            [].concat(_toConsumableArray(dom.element.querySelectorAll(cmd[1]))).forEach(function (target) {
                return target.setAttribute(cmd[2], cmd[3]);
            });
        });
    }

    function renderList(element, template, arr) {

        while (element.children.length) {
            element.removeChild(element.children[0]);
        }for (var key in arr) {

            var childModel = new Model();
            childModel.load(_model.data);
            childModel.setItem("key", key);
            childModel.setItem("value", arr[key]);
            childModel.root = _model.root;

            [].concat(_toConsumableArray(template.cloneNode(true).children)).forEach(function (child) {

                element.appendChild(child);
                prepareDOM(new _dryDom2.default(child), controller, childModel);
            });
        }
    }

    function bindAttribute(attr, memo, match, inner) {

        if (inner in memo) return "";

        _model.attach(inner, function (value) {
            memo[inner] = value;
            if (memo.__hnd) return;
            memo.__hnd = setTimeout(updateAttribute.bind(null, attr, memo), 1);
        });

        memo[inner] = _model.getItem(inner);

        return "";
    }

    function updateAttribute(attr, memo) {
        memo.__hnd = 0;
        attr.value = memo.__src.replace(/\{\{([^\}]+)\}\}/g, function (match, path) {
            return _typeof(memo[path]) == "object" ? JSON.stringify(memo[path]) : memo[path];
        });
    }
}

var defaultModel = null;

var IController = function () {
    function IController() {
        _classCallCheck(this, IController);

        this.pool.add(this);
    }

    _createClass(IController, [{
        key: '_show',
        value: function _show() {
            console.log("created view");
            this.pool.call("setActiveView", null);
            var view = this.viewFactory(this);
            return view;
        }
    }]);

    return IController;
}();

IController["@inject"] = {
    viewFactory: IView,
    pool: "pool",
    model: Model
};


function boot(_ref) {
    var main = _ref.main,
        element = _ref.element,
        components = _ref.components,
        entities = _ref.entities;


    (0, _dryDi.bind)(_pool2.default).to('pool').singleton();
    (0, _dryDi.bind)(Model).to(Model).withTags({ scope: 'root' }).singleton();

    for (var k in components) {
        (0, _dryDi.bind)(components[k]).to(k);
    }for (var k in entities) {
        var ctrl = entities[k];
        // console.log( "Adding entity " + k, ctrl );
        (0, _dryDi.bind)(ctrl).to(IController);
        (0, _dryDi.bind)(IView).to(IView).injecting([document.body, 'ParentElement']).withTags({ controller: ctrl }).factory();
    }

    (0, _dryDi.bind)(main).to(main).injecting([new _dryDom2.default(element), _dryDom2.default]);
    (0, _dryDi.getInstanceOf)(main);
}

exports.Model = Model;
exports.IView = IView;
exports.IController = IController;
exports.boot = boot;

},{"../store/IStore.js":30,"./dry-dom.js":24,"./pool.js":27,"./strldr.js":28,"dry-di":3}],27:[function(require,module,exports){
"use strict";

var nextUID = 0;

function getUID() {
    return ++nextUID;
}

function Pool() {
    var methods = {
        constructor: []
    };
    var silence = {
        "onTick": 1,
        "onPostTick": 1,
        "onRender": 1
    };
    var debug = null;
    var proxies = [];
    var contents = {};

    function onEvent(e) {
        var target = e.target;
        var names = (target.className || "").split(/\s+/).filter(function (n) {
            return n.length > 0;
        });

        var event = e.type;
        event = event.substr(0, 1).toUpperCase() + event.substr(1);

        while (target) {
            var id = target.id;
            if (target.onclick) return;
            if (id) {
                id = id.substr(0, 1).toUpperCase() + id.substr(1);

                var i = 0,
                    name;
                if (names.length) {
                    while (name = names[i++]) {
                        name = name.substr(0, 1).toUpperCase() + name.substr(1);
                        $$("on" + event + id + name, target);
                    }
                } else {
                    $$("on" + event + id, target);
                }
                break;
            }
            target = target.parentNode;
        }
    }

    this.registerEvents = function (target, args) {
        if (!args && target && DOC.typeOf(target) == "array") {
            args = target;
            target = null;
        }
        if (!target) target = document.body;
        if (!args) {
            args = [];
            for (var k in target) {
                var m = k.match(/^on(.+)/);
                if (!m) continue;
                args.push(m[1]);
            }
        }
        args.forEach(function (arg) {
            target.addEventListener(arg, onEvent);
        });
    };

    this.debug = function (m) {
        debug = m;
    };

    this.silence = function (m) {
        silence[m] = 1;
    };

    this.addProxy = function (obj) {
        if (obj && obj.call) proxies.push(obj);
    };

    this.removeProxy = function (obj) {
        var i = proxies.indexOf(obj);
        if (i == -1) return;
        proxies.splice(i, 1);
    };

    this.add = function (obj, enableDirectMsg) {
        if (!obj) return;
        if (debug && obj.constructor.name == debug) console.log("add", obj);

        if (!("__uid" in obj)) obj.__uid = getUID();

        if (!("__uid" in obj)) console.warn("Could not add __uid to ", obj, obj.constructor.name);

        contents[obj.__uid] = obj;
        var clazz = obj.constructor;
        if (obj.methods || clazz.methods) {
            var arr = obj.methods || clazz.methods;
            if (!(arr instanceof Array)) arr = Object.keys(arr);
            var l = arr.length;
            for (var i = 0; i < l; ++i) {
                var m = arr[i];
                if (m && m[0] != "_") {
                    this.listen(obj, m, enableDirectMsg);
                    if (clazz.meta[m] && clazz.meta[m].silence) this.silence(m);
                }
            }
        } else {
            var properties = {},
                cobj = obj;
            do {
                Object.assign(properties, Object.getOwnPropertyDescriptors(cobj));
            } while (cobj = Object.getPrototypeOf(cobj));

            for (var k in properties) {
                if (typeof obj[k] != "function") continue;
                if (k && k[0] != "_") this.listen(obj, k);
            }
        }
    };

    this.remove = function (obj) {
        if (obj.constructor.name == debug) console.log("remove", obj);

        delete contents[obj.__uid];

        if (obj.methods || obj.constructor.methods) {
            for (var k in obj.methods || obj.constructor.methods) {
                this.mute(obj, k);
            }
        } else {
            var properties = {},
                cobj = obj;
            do {
                Object.assign(properties, Object.getOwnPropertyDescriptors(cobj));
            } while (cobj = Object.getPrototypeOf(cobj));

            for (var k in properties) {
                this.mute(obj, k);
            }
        }
    };

    this.poll = function (t) {
        if (!t) return contents;
        var keys = Object.keys(contents);
        var ret = [];
        var count = 0;
        for (; count < keys.length; ++count) {
            ret.push(t(contents[keys[count]]));
        }return ret;
    };

    this.listen = function (obj, name, enableDirectMsg) {
        var method = obj[name];
        if (typeof method != "function") return;

        var arr = methods[name];
        if (!arr) arr = methods[name] = {};
        arr[obj.__uid] = {
            THIS: obj,
            method: method
        };

        if (enableDirectMsg) {
            arr = methods[name + obj.__uid];
            if (!arr) arr = methods[name + obj.__uid] = {};
            arr[obj.__uid] = {
                THIS: obj,
                method: method
            };
        }
    };

    this.mute = function (obj, name) {
        var method = obj[name];
        var listeners = methods[name];
        if (!listeners) return;
        delete listeners[obj.__uid];
    };

    this.call = function (method) {
        if (method === undefined) {
            console.error("Undefined call");
            return;
        }

        var i, l;

        /* * /
        var args = Array.prototype.slice.call(arguments, 1);
        /*/
        var args = new Array(arguments.length - 1);
        for (i = 1, l = arguments.length; i < l; i++) {
            args[i - 1] = arguments[i];
        } /* */

        for (i = 0; i < proxies.length; ++i) {
            proxies[i].call(method, args);
        }

        var listeners = methods[method];
        if (!listeners) {
            if (!(method in silence)) console.log(method + ": 0");
            return;
        }

        var keys = Object.keys(listeners);
        var ret; //=undefined
        var count = 0,
            c;
        for (; count < keys.length; ++count) {
            c = listeners[keys[count]];

            // DEBUG
            if (debug && (method == debug || c.THIS.constructor.name == debug)) console.log(c.THIS, method, args);
            // END-DEBUG

            var lret = c && c.method.apply(c.THIS, args);
            if (lret !== undefined) ret = lret;
        }
        if (!(method in silence)) console.log(method + ": " + count);
        return ret;
    };
}

module.exports = Pool;

},{}],28:[function(require,module,exports){
(function (global){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function store(obj, asBuffer) {

    if (typeof obj == "function") obj = undefined;
    if (!obj || (typeof obj === "undefined" ? "undefined" : _typeof(obj)) != "object") return obj;

    var inst = [],
        strIndex = { "Object": -2, "Array": -3 },
        arrIndex = {},
        objIndex = [];

    add(obj);

    if (asBuffer) return toBuffer(inst);

    return inst;

    function add(obj) {
        var type = typeof obj === "undefined" ? "undefined" : _typeof(obj);
        if (type == "function") {
            obj = undefined;
            type = typeof obj === "undefined" ? "undefined" : _typeof(obj);
        }

        var index;
        if (obj === undefined) {
            index = -4;
        } else if (type == "string") {
            index = strIndex[obj];
            if (index === undefined) index = -1;
        } else index = inst.indexOf(obj);

        if (index != -1) return index;

        if (type == "object") {
            index = objIndex.indexOf(obj);
            if (index != -1) return index;
        }

        index = inst.length;
        inst[index] = obj;

        if (type == "string") strIndex[obj] = index;

        if (!obj || type != "object") return index;

        objIndex[index] = obj;

        var ctorIndex = add(obj.constructor.fullName || obj.constructor.name);

        if (obj.buffer && obj.buffer instanceof ArrayBuffer) {

            if (!asBuffer) obj = Array.from(obj);

            inst[index] = [ctorIndex, -3, obj];
            return index;
        }

        var key,
            keySet = [];
        for (key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                var keyIndex = strIndex[key];
                if (keyIndex === undefined) {
                    keyIndex = inst.length;
                    inst[keyIndex] = key;
                    strIndex[key] = keyIndex;
                    keyIndex = -1;
                }
                keySet[keySet.length] = keyIndex;
            }
        }

        var strKeySet = JSON.stringify(keySet);
        keyIndex = arrIndex[strKeySet];
        if (keyIndex === undefined) {
            keyIndex = inst.length;
            inst[keyIndex] = keySet;
            arrIndex[strKeySet] = keyIndex;
        }

        var valueSet = [ctorIndex, keyIndex];

        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                var value = obj[key];
                var valueIndex = add(value);
                valueSet[valueSet.length] = valueIndex;
            }
        }

        strKeySet = JSON.stringify(valueSet);
        keyIndex = arrIndex[strKeySet];
        if (keyIndex === undefined) {
            arrIndex[strKeySet] = index;
            inst[index] = valueSet;
        } else {
            inst[index] = [keyIndex];
        }

        return index;
    }
}

function load(arr, isBuffer) {

    if (isBuffer || arr && arr.buffer) arr = fromBuffer(arr);

    var SELF = null;

    if (!arr || (typeof arr === "undefined" ? "undefined" : _typeof(arr)) !== "object") return arr;

    if (!Array.isArray(arr)) return undefined;

    (function () {
        try {
            SELF = window;
        } catch (ex) {}
    })();
    if (!SELF) (function () {
        try {
            SELF = global;
        } catch (ex) {}
    })();

    var objects = [];

    var cursor = 0;
    return read(-1);

    function read(pos) {

        switch (pos) {
            case -1:
                pos = cursor;
                break;
            case -2:
                return "Object";
            case -3:
                return "Array";
            default:
                if (objects[pos]) return objects[pos];

                break;
        }

        if (pos == cursor) cursor++;

        var value = arr[pos];
        if (!value) return value;

        var type = typeof value === "undefined" ? "undefined" : _typeof(value);
        if (type != "object") return value;

        if (value.length == 1) value = arr[value[0]];

        var className = read(value[0]);

        if (!className.split) console.log(className, value[0]);

        var ctor = SELF,
            obj;
        className.split(".").forEach(function (part) {
            return ctor = ctor[part];
        });

        if (value[1] !== -3) {
            obj = new ctor();
            objects[pos] = obj;

            var fieldRefList,
                mustAdd = value[1] > pos;

            fieldRefList = arr[value[1]];

            var fieldList = fieldRefList.map(function (ref) {
                return read(ref);
            });

            if (mustAdd) cursor++;

            for (var i = 2; i < value.length; ++i) {
                var vi = value[i];
                if (vi !== -4) obj[fieldList[i - 2]] = read(vi);
            }
        } else {

            obj = value[2];
            if (!isBuffer) objects[pos] = obj = ctor.from(obj);else objects[pos] = obj = new ctor(obj);

            cursor++;
        }

        return obj;
    }
}

function toBuffer(src) {
    var out = [];

    var dab = new Float64Array(1);
    var bab = new Uint8Array(dab.buffer);
    var sab = new Int32Array(dab.buffer);
    var fab = new Float32Array(dab.buffer);

    var p = 0;

    for (var i = 0, l = src.length; i < l; ++i) {
        var value = src[i],
            type = typeof value === "undefined" ? "undefined" : _typeof(value);

        switch (type) {
            case "boolean":
                // 1, 2
                out[p++] = 1 + (value | 0);
                break;

            case "number":
                var isFloat = Math.floor(value) !== value;
                if (isFloat) {

                    fab[0] = value;

                    if (fab[0] === value || isNaN(value)) {
                        out[p++] = 3;
                        out[p++] = bab[0];out[p++] = bab[1];
                        out[p++] = bab[2];out[p++] = bab[3];
                    } else {
                        dab[0] = value;
                        out[p++] = 4;
                        out[p++] = bab[0];out[p++] = bab[1];
                        out[p++] = bab[2];out[p++] = bab[3];
                        out[p++] = bab[4];out[p++] = bab[5];
                        out[p++] = bab[6];out[p++] = bab[7];
                    }
                } else {
                    saveInt(0, value);
                }
                break;

            case "string":
                var start = p,
                    restart = false;
                saveInt(1, value.length);
                for (var bi = 0, bl = value.length; bi < bl; ++bi) {
                    var byte = value.charCodeAt(bi);
                    if (byte > 0xFF) {
                        restart = true;
                        break;
                    }
                    out[p++] = byte;
                }

                if (!restart) break;

                p = start;
                saveInt(2, value.length);

                for (var bi = 0, bl = value.length; bi < bl; ++bi) {
                    var byte = value.charCodeAt(bi);
                    out[p++] = byte & 0xFF;
                    out[p++] = byte >> 8 & 0xFF;
                }

                break;

            case "object":
                if (_typeof(value[2]) == "object") {
                    var typed = new Uint8Array(value[2].buffer);

                    saveInt(3, -typed.length);
                    saveInt(0, value[0]);

                    for (var bi = 0, bl = typed.length; bi < bl; ++bi) {
                        out[p++] = typed[bi];
                    }
                } else {
                    saveInt(3, value.length);
                    for (var bi = 0, bl = value.length; bi < bl; ++bi) {
                        saveInt(0, value[bi]);
                    }
                }

                break;
        }
    }

    return Uint8Array.from(out);

    function saveInt(type, value) {

        var bitCount = Math.ceil(Math.log2(Math.abs(value)));
        var byte = type << 6;

        if (bitCount < 3 || value === -8) {
            byte |= 0x30;
            byte |= value & 0xF;
            out[p++] = byte;
            return;
        }

        if (bitCount <= 8 + 3 || value === -2048) {
            byte |= 0x10;
            byte |= value >>> 8 & 0xF;
            out[p++] = byte;
            out[p++] = value & 0xFF;
            return;
        }

        if (bitCount <= 16 + 3 || value === -524288) {
            byte |= 0x20;
            byte |= value >>> 16 & 0xF;
            out[p++] = byte;
            out[p++] = value >>> 8 & 0xFF;
            out[p++] = value & 0xFF;
            return;
        }

        sab[0] = value;
        out[p++] = byte;
        out[p++] = bab[0];out[p++] = bab[1];
        out[p++] = bab[2];out[p++] = bab[3];
        return;
    }
}

function fromBuffer(src) {
    var out = [];
    var dab = new Float64Array(1);
    var bab = new Uint8Array(dab.buffer);
    var sab = new Int32Array(dab.buffer);
    var fab = new Float32Array(dab.buffer);

    var pos = 0;

    for (var l = src.length; pos < l;) {
        out[out.length] = read();
    }return out;

    function read() {
        var tmp;
        var byte = src[pos++];
        switch (byte) {
            case 0:
                break;
            case 1:
                return false;
            case 2:
                return true;
            case 3:
                return decodeFloat32();
            case 4:
                return decodeFloat64();
        }

        var hb = byte >>> 4;
        var lb = byte & 0xF;
        switch (hb & 3) {
            case 0:
                // 32 bit int
                tmp = decodeInt32();
                break;
            case 1:
                // 12 bit int
                tmp = src[pos++] | lb << 28 >> 20;
                break;
            case 2:
                // 19 bit int
                tmp = lb << 28 >> 12 | src[pos] | src[pos + 1] << 8;
                pos += 2;
                break;
            case 3:
                // 4-bit int
                tmp = lb << 28 >> 28;
        }

        switch (hb >> 2) {
            case 0:
                return tmp;
            case 1:
                return decodeStr8(tmp);
            case 2:
                return decodeStr16(tmp);
            case 3:
                return decodeArray(tmp);
        }
    }

    function decodeStr8(size) {
        var acc = "";
        for (var i = 0; i < size; ++i) {
            acc += String.fromCharCode(src[pos++]);
        }return acc;
    }

    function decodeStr16(size) {
        var acc = "";
        for (var i = 0; i < size; ++i) {
            var h = src[pos++];
            acc += String.fromCharCode(h << 8 | src[pos++]);
        }
        return acc;
    }

    function decodeArray(size) {

        var ret = [];
        if (size < 0) {

            ret[0] = read(); // type
            ret[1] = -3;

            size = -size;

            var bytes = new Uint8Array(size);

            for (var i = 0; i < size; ++i) {
                bytes[i] = src[pos++];
            }ret[2] = bytes.buffer;
        } else {

            for (var i = 0; i < size; ++i) {
                ret[i] = read();
            }
        }

        return ret;
    }

    function decodeInt32() {
        bab[0] = src[pos++];bab[1] = src[pos++];
        bab[2] = src[pos++];bab[3] = src[pos++];
        return sab[0];
    }

    function decodeFloat32() {
        bab[0] = src[pos++];bab[1] = src[pos++];
        bab[2] = src[pos++];bab[3] = src[pos++];
        return fab[0];
    }

    function decodeFloat64() {
        bab[0] = src[pos++];bab[1] = src[pos++];
        bab[2] = src[pos++];bab[3] = src[pos++];
        bab[4] = src[pos++];bab[5] = src[pos++];
        bab[6] = src[pos++];bab[7] = src[pos++];
        return dab[0];
    }
}

module.exports = { store: store, load: load };

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],29:[function(require,module,exports){
'use strict';

var _dryDi = require('dry-di');

var _App = require('./App.js');

var _App2 = _interopRequireDefault(_App);

var _IStore = require('./store/IStore.js');

var _IStore2 = _interopRequireDefault(_IStore);

var _Node = require('./store/Node.js');

var _Node2 = _interopRequireDefault(_Node);

var _mt = require('./lib/mt.js');

var _mt2 = _interopRequireDefault(_mt);

var _mvc = require('./lib/mvc.js');

var _Env = require('./entities\\Env.js');

var _Env2 = _interopRequireDefault(_Env);

var _Sim = require('./entities\\Sim.js');

var _Sim2 = _interopRequireDefault(_Sim);

var _Splash = require('./entities\\Splash.js');

var _Splash2 = _interopRequireDefault(_Splash);

var _arduboy = require('./components\\arduboy.js');

var _arduboy2 = _interopRequireDefault(_arduboy);

var _BTN = require('./components\\BTN.js');

var _BTN2 = _interopRequireDefault(_BTN);

var _config = require('./components\\config.js');

var _config2 = _interopRequireDefault(_config);

var _files = require('./components\\files.js');

var _files2 = _interopRequireDefault(_files);

var _LED = require('./components\\LED.js');

var _LED2 = _interopRequireDefault(_LED);

var _market = require('./components\\market.js');

var _market2 = _interopRequireDefault(_market);

var _SCREEN = require('./components\\SCREEN.js');

var _SCREEN2 = _interopRequireDefault(_SCREEN);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var entities = {
    Env: _Env2.default,
    Sim: _Sim2.default,
    Splash: _Splash2.default
}; // let {bind, inject, getInstanceOf} = require('./lib/dry-di.js');

Object.freeze(entities);
var components = {
    arduboy: _arduboy2.default,
    BTN: _BTN2.default,
    config: _config2.default,
    files: _files2.default,
    LED: _LED2.default,
    market: _market2.default,
    SCREEN: _SCREEN2.default
};
Object.freeze(components);
var scenecomponents = {};
Object.freeze(scenecomponents);
var scenecontrollers = {};
Object.freeze(scenecontrollers);


function makeRNG(seed) {
    var rng = new _mt2.default(Math.round(seed || 0));
    return rng.random.bind(rng);
}

document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {

        (0, _dryDi.bind)(_Node2.default).to(_IStore2.default).singleton();
        (0, _dryDi.bind)(makeRNG).to("RNG").factory();

        for (var k in scenecomponents) {
            (0, _dryDi.bind)(scenecomponents[k]).to(k).withTags({ scenecomponent: true });
        }for (var _k in scenecontrollers) {
            (0, _dryDi.bind)(scenecontrollers[_k]).to(_k).withTags({ scenecontroller: true });
        }(0, _mvc.boot)({
            main: _App2.default,
            element: document.body,
            components: components,
            entities: entities,
            modelName: 'default'
        });
    }, 2000);
});

},{"./App.js":6,"./components\\BTN.js":14,"./components\\LED.js":15,"./components\\SCREEN.js":16,"./components\\arduboy.js":17,"./components\\config.js":18,"./components\\files.js":19,"./components\\market.js":20,"./entities\\Env.js":21,"./entities\\Sim.js":22,"./entities\\Splash.js":23,"./lib/mt.js":25,"./lib/mvc.js":26,"./store/IStore.js":30,"./store/Node.js":31,"dry-di":3}],30:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fs = null;

function mkdirp(base, path, callback) {
    var acc = base || "";
    var paths = path.split(/[\/\\]+/);
    paths.pop(); // remove last file/empty entry
    work();
    return;

    function work() {
        if (!paths.length) return callback(true);
        var current = paths.shift();
        fs.mkdir(acc + current, function (err) {
            if (err && err.code != 'EEXIST') {
                callback(false);
            } else {
                acc += current + '/';
                work();
            }
        });
    }
}

var onload = [],
    wasInit = false;
var lock = {};

var IStore = function () {
    function IStore() {
        _classCallCheck(this, IStore);
    }

    _createClass(IStore, [{
        key: 'getTextItem',
        value: function getTextItem(k, cb) {

            if (lock[k]) cb(lock[k]);else fs.readFile(this.root + k, "utf-8", function (err, data) {
                return cb(data);
            });
        }
    }, {
        key: 'getItemBuffer',
        value: function getItemBuffer(k, cb) {

            if (lock[k]) cb(lock[k]);else {
                console.log("Reading ", k);
                fs.readFile(this.root + k, function (err, data) {
                    console.log("Read ", k, err);
                    cb(data);
                });
            }
        }
    }, {
        key: 'setItem',
        value: function setItem(k, v, cb) {
            var _this = this;

            mkdirp(this.root, k, function (success) {

                if (!success) {
                    cb(false);
                } else if (lock[k]) {
                    setTimeout(_this.setItem.bind(_this, k, v, cb), 200);
                } else {
                    lock[k] = v;
                    fs.writeFile(_this.root + k, v, function (err) {

                        delete lock[k];
                        if (cb) cb(!err);
                    });
                }
            });
        }
    }, {
        key: 'onload',
        set: function set(cb) {
            if (wasInit) cb();else onload.push(cb);
        }
    }, {
        key: 'fs',
        set: function set(_fs) {
            var _this2 = this;

            if (fs) return;

            fs = _fs;

            mkdirp(this.root, "store/", function () {

                _this2.root += "store/";

                wasInit = true;

                for (var i = 0, cb; cb = onload[i]; ++i) {
                    cb();
                }
            });
        }
    }]);

    return IStore;
}();

module.exports = IStore;

},{}],31:[function(require,module,exports){
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var IStore = require('./IStore.js');

if (window.require) {

    var fs = window.require('fs');

    var _window$require = window.require('electron'),
        app = _window$require.remote.app;

    var _window$require2 = window.require('electron'),
        webFrame = _window$require2.webFrame;

    webFrame.registerURLSchemeAsPrivileged('file', {});
} else {

    fs = {
        mkdir: function mkdir(path, cb) {
            cb();
        },
        readFile: function readFile(path, enc, cb) {

            var data = localStorage.getItem(path);

            if (typeof enc === "function") {

                cb = enc;
                if (data === null) return cb("ENOENT");

                data = data.split(",");
                var buffer = new Uint8Array(data.length);
                for (var i = 0, l = data.length; i < l; ++i) {
                    buffer[i] = data[i] | 0;
                }data = buffer;
            } else if (data === null) return cb("ENOENT");

            cb(undefined, data);
        },
        writeFile: function writeFile(path, data, cb) {

            localStorage.setItem(path, data);
            cb(true);
        }
    };
}

var NodeStore = function (_IStore) {
    _inherits(NodeStore, _IStore);

    function NodeStore() {
        _classCallCheck(this, NodeStore);

        var _this = _possibleConstructorReturn(this, (NodeStore.__proto__ || Object.getPrototypeOf(NodeStore)).call(this));

        if (app) _this.root = app.getPath("userData") + "/";else _this.root = "";

        _this.fs = fs;

        return _this;
    }

    return NodeStore;
}(IStore);

module.exports = NodeStore;

},{"./IStore.js":30}]},{},[29])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kcnktZGkvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIi4uXFxub2RlX21vZHVsZXNcXGpzemlwXFxkaXN0XFxub2RlX21vZHVsZXNcXGpzemlwXFxkaXN0XFxqc3ppcC5taW4uanMiLCIuLlxcc3JjXFxBcHAuanMiLCIuLlxcc3JjXFxhdGNvcmVcXEF0MzI4UC1UQy5qcyIsIi4uXFxzcmNcXGF0Y29yZVxcQXQzMjhQLVVTQVJULmpzIiwiLi5cXHNyY1xcYXRjb3JlXFxBdDMyOFAtcGVyaWZlcmFscy5qcyIsIi4uXFxzcmNcXGF0Y29yZVxcQXQzMnU0LVNQSS5qcyIsIi4uXFxzcmNcXGF0Y29yZVxcQXQzMnU0LXBlcmlmZXJhbHMuanMiLCIuLlxcc3JjXFxhdGNvcmVcXHNyY1xcYXRjb3JlXFxBdGNvcmUuanMiLCIuLlxcc3JjXFxhdGNvcmVcXEhleC5qcyIsIi4uXFxzcmNcXGNvbXBvbmVudHNcXEJUTi5qcyIsIi4uXFxzcmNcXGNvbXBvbmVudHNcXExFRC5qcyIsIi4uXFxzcmNcXGNvbXBvbmVudHNcXFNDUkVFTi5qcyIsIi4uXFxzcmNcXGNvbXBvbmVudHNcXGFyZHVib3kuanMiLCIuLlxcc3JjXFxjb21wb25lbnRzXFxjb25maWcuanMiLCIuLlxcc3JjXFxjb21wb25lbnRzXFxmaWxlcy5qcyIsIi4uXFxzcmNcXGNvbXBvbmVudHNcXG1hcmtldC5qcyIsIi4uXFxzcmNcXGVudGl0aWVzXFxFbnYuanMiLCIuLlxcc3JjXFxlbnRpdGllc1xcU2ltLmpzIiwiLi5cXHNyY1xcZW50aXRpZXNcXFNwbGFzaC5qcyIsIi4uXFxzcmNcXGxpYlxcZHJ5LWRvbS5qcyIsIi4uXFxzcmNcXGxpYlxcbXQuanMiLCIuLlxcc3JjXFxsaWJcXG12Yy5qcyIsIi4uXFxzcmNcXGxpYlxccG9vbC5qcyIsIi4uXFxzcmNcXGxpYlxcc3JjXFxsaWJcXHN0cmxkci5qcyIsIi4uXFxzcmNcXHBjLmpzIiwiLi5cXHNyY1xcc3RvcmVcXElTdG9yZS5qcyIsIi4uXFxzcmNcXHN0b3JlXFxOb2RlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxcURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeGpCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FB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WSxxQ0FBcUMsS0FBSyxJQUExQyxHQUFpRCxHQUE3RDtBQUNILGFBSEssTUFHQSxJQUFJLFNBQVMsQ0FBVCxJQUFjLFNBQVMsQ0FBdkIsSUFBNEIsU0FBUyxDQUF6QyxFQUE0QztBQUM5QyxxQkFBSyxJQUFMLEdBQVksQ0FBWjtBQUNBLHdCQUFRLEdBQVIsQ0FBWSxzQkFBc0IsS0FBSyxJQUEzQixHQUFrQyxHQUE5QztBQUNILGFBSEssTUFHQSxJQUFJLFNBQVMsQ0FBVCxJQUFjLFNBQVMsQ0FBdkIsSUFBNEIsU0FBUyxDQUF6QyxFQUE0QztBQUM5QyxxQkFBSyxJQUFMLEdBQVksQ0FBWjtBQUNBLHdCQUFRLEdBQVIsQ0FBWSwyQkFBMkIsS0FBSyxJQUFoQyxHQUF1QyxHQUFuRDtBQUNILGFBSEssTUFHQSxJQUFJLFNBQVMsQ0FBVCxJQUFjLFNBQVMsQ0FBdkIsSUFBNEIsU0FBUyxDQUF6QyxFQUE0QztBQUM5QyxxQkFBSyxJQUFMLEdBQVksQ0FBWjtBQUNBLHdCQUFRLEdBQVIsQ0FBWSwyQkFBMkIsS0FBSyxJQUFoQyxHQUF1QyxHQUFuRDtBQUNILGFBSEssTUFHQSxJQUFJLFNBQVMsQ0FBVCxJQUFjLFNBQVMsQ0FBdkIsSUFBNEIsU0FBUyxDQUF6QyxFQUE0QztBQUM5QyxxQkFBSyxJQUFMLEdBQVksQ0FBWjtBQUNBLHdCQUFRLEdBQVIsQ0FBWSxxQ0FBcUMsS0FBSyxJQUExQyxHQUFpRCxHQUE3RDtBQUNILGFBSEssTUFHQSxJQUFJLFNBQVMsQ0FBVCxJQUFjLFNBQVMsQ0FBdkIsSUFBNEIsU0FBUyxDQUF6QyxFQUE0QztBQUM5QyxxQkFBSyxJQUFMLEdBQVksQ0FBWjtBQUNBLHdCQUFRLEdBQVIsQ0FBWSwyQkFBMkIsS0FBSyxJQUFoQyxHQUF1QyxHQUFuRDtBQUNILGFBSEssTUFHQSxJQUFJLFNBQVMsQ0FBVCxJQUFjLFNBQVMsQ0FBdkIsSUFBNEIsU0FBUyxDQUF6QyxFQUE0QztBQUM5QyxxQkFBSyxJQUFMLEdBQVksQ0FBWjtBQUNBLHdCQUFRLEdBQVIsQ0FBWSwyQkFBMkIsS0FBSyxJQUFo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O0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBQ2xEO0FBQUUsY0FBSyxRQUFMLEdBQWlCLE9BQUssQ0FBTixHQUFXLEtBQUssUUFBTCxHQUFjLElBQXpDO0FBQWdEOzs7OEJBRWxEO0FBQUUsY0FBSyxJQUFMLEdBQVks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MkJBQU8sQ0FBUCxJQUFZLEtBQUssQ0FBTCxJQUFVLENBQXRCO0FBREosaUJBRUEsT0FBTyxNQUFQO0FBRUgsYUFaRCxNQVlNLElBQUksU0FBUyxJQUFiLEVBQ0YsT0FBTyxHQUFJLFFBQUosQ0FBUDs7QUFFSixlQUFJLFNBQUosRUFBZSxJQUFmO0FBRUgsU0EzQkE7QUE2QkQsaUJBN0JDLHFCQTZCVSxJQTdCVixFQTZCZ0IsSUE3QmhCLEVBNkJzQixFQTdCdEIsRUE2QjBCOztBQUV2Qix5QkFBYSxPQUFiLENBQXNCLElBQXRCLEVBQTRCLElBQTVCO0FBQ0EsZUFBRyxJQUFIO0FBRUg7QUFsQ0EsS0FBTDtBQXFDSDs7SUFFSyxTOzs7QUFFRix5QkFBYTtBQUFBOztBQUFBOztBQUdULFlBQUksR0FBSixFQUNJLE1BQUssSUFBTCxHQUFZLElBQUksT0FBSixDQUFZLFVBQVosSUFBMEIsR0FBdEMsQ0FESixLQUdJLE1BQUssSUFBTCxHQUFZLEVBQVo7O0FBRUosY0FBSyxFQUFMLEdBQVUsRUFBVjs7QUFSUztBQVVaOzs7RUFabUIsTTs7QUFpQnhCLE9BQU8sT0FBUCxHQUFpQixTQUFqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCdcblxuZXhwb3J0cy5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuZXhwb3J0cy50b0J5dGVBcnJheSA9IHRvQnl0ZUFycmF5XG5leHBvcnRzLmZyb21CeXRlQXJyYXkgPSBmcm9tQnl0ZUFycmF5XG5cbnZhciBsb29rdXAgPSBbXVxudmFyIHJldkxvb2t1cCA9IFtdXG52YXIgQXJyID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnID8gVWludDhBcnJheSA6IEFycmF5XG5cbnZhciBjb2RlID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG5mb3IgKHZhciBpID0gMCwgbGVuID0gY29kZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICBsb29rdXBbaV0gPSBjb2RlW2ldXG4gIHJldkxvb2t1cFtjb2RlLmNoYXJDb2RlQXQoaSldID0gaVxufVxuXG5yZXZMb29rdXBbJy0nLmNoYXJDb2RlQXQoMCldID0gNjJcbnJldkxvb2t1cFsnXycuY2hhckNvZGVBdCgwKV0gPSA2M1xuXG5mdW5jdGlvbiBwbGFjZUhvbGRlcnNDb3VudCAoYjY0KSB7XG4gIHZhciBsZW4gPSBiNjQubGVuZ3RoXG4gIGlmIChsZW4gJSA0ID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG4gIH1cblxuICAvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuICAvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG4gIC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuICAvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcbiAgLy8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuICByZXR1cm4gYjY0W2xlbiAtIDJdID09PSAnPScgPyAyIDogYjY0W2xlbiAtIDFdID09PSAnPScgPyAxIDogMFxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChiNjQpIHtcbiAgLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG4gIHJldHVybiBiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnNDb3VudChiNjQpXG59XG5cbmZ1bmN0aW9uIHRvQnl0ZUFycmF5IChiNjQpIHtcbiAgdmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcbiAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcbiAgcGxhY2VIb2xkZXJzID0gcGxhY2VIb2xkZXJzQ291bnQoYjY0KVxuXG4gIGFyciA9IG5ldyBBcnIobGVuICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cbiAgLy8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuICBsID0gcGxhY2VIb2xkZXJzID4gMCA/IGxlbiAtIDQgOiBsZW5cblxuICB2YXIgTCA9IDBcblxuICBmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTgpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDEyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA8PCA2KSB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMyldXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDE2KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMikgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPj4gNClcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxMCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgNCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPj4gMilcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXVxufVxuXG5mdW5jdGlvbiBlbmNvZGVDaHVuayAodWludDgsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHRtcFxuICB2YXIgb3V0cHV0ID0gW11cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDMpIHtcbiAgICB0bXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG4gICAgb3V0cHV0LnB1c2godHJpcGxldFRvQmFzZTY0KHRtcCkpXG4gIH1cbiAgcmV0dXJuIG91dHB1dC5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQnl0ZUFycmF5ICh1aW50OCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW4gPSB1aW50OC5sZW5ndGhcbiAgdmFyIGV4dHJhQnl0ZXMgPSBsZW4gJSAzIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG4gIHZhciBvdXRwdXQgPSAnJ1xuICB2YXIgcGFydHMgPSBbXVxuICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4yID0gbGVuIC0gZXh0cmFCeXRlczsgaSA8IGxlbjI7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKHVpbnQ4LCBpLCAoaSArIG1heENodW5rTGVuZ3RoKSA+IGxlbjIgPyBsZW4yIDogKGkgKyBtYXhDaHVua0xlbmd0aCkpKVxuICB9XG5cbiAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgIHRtcCA9IHVpbnQ4W2xlbiAtIDFdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPT0nXG4gIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgIHRtcCA9ICh1aW50OFtsZW4gLSAyXSA8PCA4KSArICh1aW50OFtsZW4gLSAxXSlcbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAxMF1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPj4gNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCAyKSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9J1xuICB9XG5cbiAgcGFydHMucHVzaChvdXRwdXQpXG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpXG59XG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1wcm90byAqL1xuXG4ndXNlIHN0cmljdCdcblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5cbnZhciBLX01BWF9MRU5HVEggPSAweDdmZmZmZmZmXG5leHBvcnRzLmtNYXhMZW5ndGggPSBLX01BWF9MRU5HVEhcblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgUHJpbnQgd2FybmluZyBhbmQgcmVjb21tZW5kIHVzaW5nIGBidWZmZXJgIHY0Lnggd2hpY2ggaGFzIGFuIE9iamVjdFxuICogICAgICAgICAgICAgICBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogV2UgcmVwb3J0IHRoYXQgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCB0eXBlZCBhcnJheXMgaWYgdGhlIGFyZSBub3Qgc3ViY2xhc3NhYmxlXG4gKiB1c2luZyBfX3Byb3RvX18uIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgXG4gKiAoU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzgpLiBJRSAxMCBsYWNrcyBzdXBwb3J0XG4gKiBmb3IgX19wcm90b19fIGFuZCBoYXMgYSBidWdneSB0eXBlZCBhcnJheSBpbXBsZW1lbnRhdGlvbi5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSB0eXBlZEFycmF5U3VwcG9ydCgpXG5cbmlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgdHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmXG4gICAgdHlwZW9mIGNvbnNvbGUuZXJyb3IgPT09ICdmdW5jdGlvbicpIHtcbiAgY29uc29sZS5lcnJvcihcbiAgICAnVGhpcyBicm93c2VyIGxhY2tzIHR5cGVkIGFycmF5IChVaW50OEFycmF5KSBzdXBwb3J0IHdoaWNoIGlzIHJlcXVpcmVkIGJ5ICcgK1xuICAgICdgYnVmZmVyYCB2NS54LiBVc2UgYGJ1ZmZlcmAgdjQueCBpZiB5b3UgcmVxdWlyZSBvbGQgYnJvd3NlciBzdXBwb3J0LidcbiAgKVxufVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIC8vIENhbiB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZD9cbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICBhcnIuX19wcm90b19fID0ge19fcHJvdG9fXzogVWludDhBcnJheS5wcm90b3R5cGUsIGZvbzogZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfX1cbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MlxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQnVmZmVyIChsZW5ndGgpIHtcbiAgaWYgKGxlbmd0aCA+IEtfTUFYX0xFTkdUSCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHR5cGVkIGFycmF5IGxlbmd0aCcpXG4gIH1cbiAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2VcbiAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgYnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIGJ1ZlxufVxuXG4vKipcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgaGF2ZSB0aGVpclxuICogcHJvdG90eXBlIGNoYW5nZWQgdG8gYEJ1ZmZlci5wcm90b3R5cGVgLiBGdXJ0aGVybW9yZSwgYEJ1ZmZlcmAgaXMgYSBzdWJjbGFzcyBvZlxuICogYFVpbnQ4QXJyYXlgLCBzbyB0aGUgcmV0dXJuZWQgaW5zdGFuY2VzIHdpbGwgaGF2ZSBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgbWV0aG9kc1xuICogYW5kIHRoZSBgVWludDhBcnJheWAgbWV0aG9kcy4gU3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXRcbiAqIHJldHVybnMgYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogVGhlIGBVaW50OEFycmF5YCBwcm90b3R5cGUgcmVtYWlucyB1bm1vZGlmaWVkLlxuICovXG5cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIGlmICh0eXBlb2YgZW5jb2RpbmdPck9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ0lmIGVuY29kaW5nIGlzIHNwZWNpZmllZCB0aGVuIHRoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nJ1xuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gYWxsb2NVbnNhZmUoYXJnKVxuICB9XG4gIHJldHVybiBmcm9tKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG4vLyBGaXggc3ViYXJyYXkoKSBpbiBFUzIwMTYuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC85N1xuaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC5zcGVjaWVzICYmXG4gICAgQnVmZmVyW1N5bWJvbC5zcGVjaWVzXSA9PT0gQnVmZmVyKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIsIFN5bWJvbC5zcGVjaWVzLCB7XG4gICAgdmFsdWU6IG51bGwsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgIHdyaXRhYmxlOiBmYWxzZVxuICB9KVxufVxuXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxuZnVuY3Rpb24gZnJvbSAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1widmFsdWVcIiBhcmd1bWVudCBtdXN0IG5vdCBiZSBhIG51bWJlcicpXG4gIH1cblxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgIHJldHVybiBmcm9tQXJyYXlCdWZmZXIodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQpXG4gIH1cblxuICByZXR1cm4gZnJvbU9iamVjdCh2YWx1ZSlcbn1cblxuLyoqXG4gKiBGdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB0byBCdWZmZXIoYXJnLCBlbmNvZGluZykgYnV0IHRocm93cyBhIFR5cGVFcnJvclxuICogaWYgdmFsdWUgaXMgYSBudW1iZXIuXG4gKiBCdWZmZXIuZnJvbShzdHJbLCBlbmNvZGluZ10pXG4gKiBCdWZmZXIuZnJvbShhcnJheSlcbiAqIEJ1ZmZlci5mcm9tKGJ1ZmZlcilcbiAqIEJ1ZmZlci5mcm9tKGFycmF5QnVmZmVyWywgYnl0ZU9mZnNldFssIGxlbmd0aF1dKVxuICoqL1xuQnVmZmVyLmZyb20gPSBmdW5jdGlvbiAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gZnJvbSh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG4vLyBOb3RlOiBDaGFuZ2UgcHJvdG90eXBlICphZnRlciogQnVmZmVyLmZyb20gaXMgZGVmaW5lZCB0byB3b3JrYXJvdW5kIENocm9tZSBidWc6XG4vLyBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzE0OFxuQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcblxuZnVuY3Rpb24gYXNzZXJ0U2l6ZSAoc2l6ZSkge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBiZSBhIG51bWJlcicpXG4gIH0gZWxzZSBpZiAoc2l6ZSA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgbmVnYXRpdmUnKVxuICB9XG59XG5cbmZ1bmN0aW9uIGFsbG9jIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICBhc3NlcnRTaXplKHNpemUpXG4gIGlmIChzaXplIDw9IDApIHtcbiAgICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUpXG4gIH1cbiAgaWYgKGZpbGwgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE9ubHkgcGF5IGF0dGVudGlvbiB0byBlbmNvZGluZyBpZiBpdCdzIGEgc3RyaW5nLiBUaGlzXG4gICAgLy8gcHJldmVudHMgYWNjaWRlbnRhbGx5IHNlbmRpbmcgaW4gYSBudW1iZXIgdGhhdCB3b3VsZFxuICAgIC8vIGJlIGludGVycHJldHRlZCBhcyBhIHN0YXJ0IG9mZnNldC5cbiAgICByZXR1cm4gdHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJ1xuICAgICAgPyBjcmVhdGVCdWZmZXIoc2l6ZSkuZmlsbChmaWxsLCBlbmNvZGluZylcbiAgICAgIDogY3JlYXRlQnVmZmVyKHNpemUpLmZpbGwoZmlsbClcbiAgfVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUpXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBmaWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogYWxsb2Moc2l6ZVssIGZpbGxbLCBlbmNvZGluZ11dKVxuICoqL1xuQnVmZmVyLmFsbG9jID0gZnVuY3Rpb24gKHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIHJldHVybiBhbGxvYyhzaXplLCBmaWxsLCBlbmNvZGluZylcbn1cblxuZnVuY3Rpb24gYWxsb2NVbnNhZmUgKHNpemUpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUgPCAwID8gMCA6IGNoZWNrZWQoc2l6ZSkgfCAwKVxufVxuXG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gQnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKHNpemUpXG59XG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gU2xvd0J1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICovXG5CdWZmZXIuYWxsb2NVbnNhZmVTbG93ID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKHNpemUpXG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgfVxuXG4gIGlmICghQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJlbmNvZGluZ1wiIG11c3QgYmUgYSB2YWxpZCBzdHJpbmcgZW5jb2RpbmcnKVxuICB9XG5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuZ3RoKVxuXG4gIHZhciBhY3R1YWwgPSBidWYud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcblxuICBpZiAoYWN0dWFsICE9PSBsZW5ndGgpIHtcbiAgICAvLyBXcml0aW5nIGEgaGV4IHN0cmluZywgZm9yIGV4YW1wbGUsIHRoYXQgY29udGFpbnMgaW52YWxpZCBjaGFyYWN0ZXJzIHdpbGxcbiAgICAvLyBjYXVzZSBldmVyeXRoaW5nIGFmdGVyIHRoZSBmaXJzdCBpbnZhbGlkIGNoYXJhY3RlciB0byBiZSBpZ25vcmVkLiAoZS5nLlxuICAgIC8vICdhYnh4Y2QnIHdpbGwgYmUgdHJlYXRlZCBhcyAnYWInKVxuICAgIGJ1ZiA9IGJ1Zi5zbGljZSgwLCBhY3R1YWwpXG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGggPCAwID8gMCA6IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdmFyIGJ1ZiA9IGNyZWF0ZUJ1ZmZlcihsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICBidWZbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyIChhcnJheSwgYnl0ZU9mZnNldCwgbGVuZ3RoKSB7XG4gIGlmIChieXRlT2Zmc2V0IDwgMCB8fCBhcnJheS5ieXRlTGVuZ3RoIDwgYnl0ZU9mZnNldCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcXCdvZmZzZXRcXCcgaXMgb3V0IG9mIGJvdW5kcycpXG4gIH1cblxuICBpZiAoYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQgKyAobGVuZ3RoIHx8IDApKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1xcJ2xlbmd0aFxcJyBpcyBvdXQgb2YgYm91bmRzJylcbiAgfVxuXG4gIHZhciBidWZcbiAgaWYgKGJ5dGVPZmZzZXQgPT09IHVuZGVmaW5lZCAmJiBsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5KVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgYnVmID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQpXG4gIH0gZWxzZSB7XG4gICAgYnVmID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlXG4gIGJ1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAob2JqKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqKSkge1xuICAgIHZhciBsZW4gPSBjaGVja2VkKG9iai5sZW5ndGgpIHwgMFxuICAgIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuKVxuXG4gICAgaWYgKGJ1Zi5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBidWZcbiAgICB9XG5cbiAgICBvYmouY29weShidWYsIDAsIDAsIGxlbilcbiAgICByZXR1cm4gYnVmXG4gIH1cblxuICBpZiAob2JqKSB7XG4gICAgaWYgKGlzQXJyYXlCdWZmZXJWaWV3KG9iaikgfHwgJ2xlbmd0aCcgaW4gb2JqKSB7XG4gICAgICBpZiAodHlwZW9mIG9iai5sZW5ndGggIT09ICdudW1iZXInIHx8IG51bWJlcklzTmFOKG9iai5sZW5ndGgpKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVCdWZmZXIoMClcbiAgICAgIH1cbiAgICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKG9iailcbiAgICB9XG5cbiAgICBpZiAob2JqLnR5cGUgPT09ICdCdWZmZXInICYmIEFycmF5LmlzQXJyYXkob2JqLmRhdGEpKSB7XG4gICAgICByZXR1cm4gZnJvbUFycmF5TGlrZShvYmouZGF0YSlcbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nLCBCdWZmZXIsIEFycmF5QnVmZmVyLCBBcnJheSwgb3IgYXJyYXktbGlrZSBvYmplY3QuJylcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IEtfTUFYX0xFTkdUSGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBLX01BWF9MRU5HVEgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsgS19NQVhfTEVOR1RILnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKGxlbmd0aCkge1xuICBpZiAoK2xlbmd0aCAhPSBsZW5ndGgpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBlcWVxZXFcbiAgICBsZW5ndGggPSAwXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlci5hbGxvYygrbGVuZ3RoKVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyID09PSB0cnVlXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW47ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICB4ID0gYVtpXVxuICAgICAgeSA9IGJbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIGlzRW5jb2RpbmcgKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gY29uY2F0IChsaXN0LCBsZW5ndGgpIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KGxpc3QpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBCdWZmZXIuYWxsb2MoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZmZlciA9IEJ1ZmZlci5hbGxvY1Vuc2FmZShsZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGJ1ZiA9IGxpc3RbaV1cbiAgICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImxpc3RcIiBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMnKVxuICAgIH1cbiAgICBidWYuY29weShidWZmZXIsIHBvcylcbiAgICBwb3MgKz0gYnVmLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZmZXJcbn1cblxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN0cmluZykpIHtcbiAgICByZXR1cm4gc3RyaW5nLmxlbmd0aFxuICB9XG4gIGlmIChpc0FycmF5QnVmZmVyVmlldyhzdHJpbmcpIHx8IHN0cmluZyBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgcmV0dXJuIHN0cmluZy5ieXRlTGVuZ3RoXG4gIH1cbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgc3RyaW5nID0gJycgKyBzdHJpbmdcbiAgfVxuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIC8vIE5vIG5lZWQgdG8gdmVyaWZ5IHRoYXQgXCJ0aGlzLmxlbmd0aCA8PSBNQVhfVUlOVDMyXCIgc2luY2UgaXQncyBhIHJlYWQtb25seVxuICAvLyBwcm9wZXJ0eSBvZiBhIHR5cGVkIGFycmF5LlxuXG4gIC8vIFRoaXMgYmVoYXZlcyBuZWl0aGVyIGxpa2UgU3RyaW5nIG5vciBVaW50OEFycmF5IGluIHRoYXQgd2Ugc2V0IHN0YXJ0L2VuZFxuICAvLyB0byB0aGVpciB1cHBlci9sb3dlciBib3VuZHMgaWYgdGhlIHZhbHVlIHBhc3NlZCBpcyBvdXQgb2YgcmFuZ2UuXG4gIC8vIHVuZGVmaW5lZCBpcyBoYW5kbGVkIHNwZWNpYWxseSBhcyBwZXIgRUNNQS0yNjIgNnRoIEVkaXRpb24sXG4gIC8vIFNlY3Rpb24gMTMuMy4zLjcgUnVudGltZSBTZW1hbnRpY3M6IEtleWVkQmluZGluZ0luaXRpYWxpemF0aW9uLlxuICBpZiAoc3RhcnQgPT09IHVuZGVmaW5lZCB8fCBzdGFydCA8IDApIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICAvLyBSZXR1cm4gZWFybHkgaWYgc3RhcnQgPiB0aGlzLmxlbmd0aC4gRG9uZSBoZXJlIHRvIHByZXZlbnQgcG90ZW50aWFsIHVpbnQzMlxuICAvLyBjb2VyY2lvbiBmYWlsIGJlbG93LlxuICBpZiAoc3RhcnQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgfVxuXG4gIGlmIChlbmQgPD0gMCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgLy8gRm9yY2UgY29lcnNpb24gdG8gdWludDMyLiBUaGlzIHdpbGwgYWxzbyBjb2VyY2UgZmFsc2V5L05hTiB2YWx1ZXMgdG8gMC5cbiAgZW5kID4+Pj0gMFxuICBzdGFydCA+Pj49IDBcblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsYXRpbjFTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhpcyBwcm9wZXJ0eSBpcyB1c2VkIGJ5IGBCdWZmZXIuaXNCdWZmZXJgIChhbmQgdGhlIGBpcy1idWZmZXJgIG5wbSBwYWNrYWdlKVxuLy8gdG8gZGV0ZWN0IGEgQnVmZmVyIGluc3RhbmNlLiBJdCdzIG5vdCBwb3NzaWJsZSB0byB1c2UgYGluc3RhbmNlb2YgQnVmZmVyYFxuLy8gcmVsaWFibHkgaW4gYSBicm93c2VyaWZ5IGNvbnRleHQgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBtdWx0aXBsZSBkaWZmZXJlbnRcbi8vIGNvcGllcyBvZiB0aGUgJ2J1ZmZlcicgcGFja2FnZSBpbiB1c2UuIFRoaXMgbWV0aG9kIHdvcmtzIGV2ZW4gZm9yIEJ1ZmZlclxuLy8gaW5zdGFuY2VzIHRoYXQgd2VyZSBjcmVhdGVkIGZyb20gYW5vdGhlciBjb3B5IG9mIHRoZSBgYnVmZmVyYCBwYWNrYWdlLlxuLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9pc3N1ZXMvMTU0XG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuZnVuY3Rpb24gc3dhcCAoYiwgbiwgbSkge1xuICB2YXIgaSA9IGJbbl1cbiAgYltuXSA9IGJbbV1cbiAgYlttXSA9IGlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMTYgPSBmdW5jdGlvbiBzd2FwMTYgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDIgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDE2LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDIpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAxKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDMyID0gZnVuY3Rpb24gc3dhcDMyICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSA0ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAzMi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA0KSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMylcbiAgICBzd2FwKHRoaXMsIGkgKyAxLCBpICsgMilcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXA2NCA9IGZ1bmN0aW9uIHN3YXA2NCAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgOCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNjQtYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gOCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDcpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDYpXG4gICAgc3dhcCh0aGlzLCBpICsgMiwgaSArIDUpXG4gICAgc3dhcCh0aGlzLCBpICsgMywgaSArIDQpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAodGFyZ2V0LCBzdGFydCwgZW5kLCB0aGlzU3RhcnQsIHRoaXNFbmQpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIodGFyZ2V0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICB9XG5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICBpZiAoZW5kID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmQgPSB0YXJnZXQgPyB0YXJnZXQubGVuZ3RoIDogMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNTdGFydCA9IDBcbiAgfVxuICBpZiAodGhpc0VuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpc0VuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoc3RhcnQgPCAwIHx8IGVuZCA+IHRhcmdldC5sZW5ndGggfHwgdGhpc1N0YXJ0IDwgMCB8fCB0aGlzRW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCAmJiBzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCkge1xuICAgIHJldHVybiAtMVxuICB9XG4gIGlmIChzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMVxuICB9XG5cbiAgc3RhcnQgPj4+PSAwXG4gIGVuZCA+Pj49IDBcbiAgdGhpc1N0YXJ0ID4+Pj0gMFxuICB0aGlzRW5kID4+Pj0gMFxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQpIHJldHVybiAwXG5cbiAgdmFyIHggPSB0aGlzRW5kIC0gdGhpc1N0YXJ0XG4gIHZhciB5ID0gZW5kIC0gc3RhcnRcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG5cbiAgdmFyIHRoaXNDb3B5ID0gdGhpcy5zbGljZSh0aGlzU3RhcnQsIHRoaXNFbmQpXG4gIHZhciB0YXJnZXRDb3B5ID0gdGFyZ2V0LnNsaWNlKHN0YXJ0LCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICh0aGlzQ29weVtpXSAhPT0gdGFyZ2V0Q29weVtpXSkge1xuICAgICAgeCA9IHRoaXNDb3B5W2ldXG4gICAgICB5ID0gdGFyZ2V0Q29weVtpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbi8vIEZpbmRzIGVpdGhlciB0aGUgZmlyc3QgaW5kZXggb2YgYHZhbGAgaW4gYGJ1ZmZlcmAgYXQgb2Zmc2V0ID49IGBieXRlT2Zmc2V0YCxcbi8vIE9SIHRoZSBsYXN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA8PSBgYnl0ZU9mZnNldGAuXG4vL1xuLy8gQXJndW1lbnRzOlxuLy8gLSBidWZmZXIgLSBhIEJ1ZmZlciB0byBzZWFyY2hcbi8vIC0gdmFsIC0gYSBzdHJpbmcsIEJ1ZmZlciwgb3IgbnVtYmVyXG4vLyAtIGJ5dGVPZmZzZXQgLSBhbiBpbmRleCBpbnRvIGBidWZmZXJgOyB3aWxsIGJlIGNsYW1wZWQgdG8gYW4gaW50MzJcbi8vIC0gZW5jb2RpbmcgLSBhbiBvcHRpb25hbCBlbmNvZGluZywgcmVsZXZhbnQgaXMgdmFsIGlzIGEgc3RyaW5nXG4vLyAtIGRpciAtIHRydWUgZm9yIGluZGV4T2YsIGZhbHNlIGZvciBsYXN0SW5kZXhPZlxuZnVuY3Rpb24gYmlkaXJlY3Rpb25hbEluZGV4T2YgKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKSB7XG4gIC8vIEVtcHR5IGJ1ZmZlciBtZWFucyBubyBtYXRjaFxuICBpZiAoYnVmZmVyLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG5cbiAgLy8gTm9ybWFsaXplIGJ5dGVPZmZzZXRcbiAgaWYgKHR5cGVvZiBieXRlT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gYnl0ZU9mZnNldFxuICAgIGJ5dGVPZmZzZXQgPSAwXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIHtcbiAgICBieXRlT2Zmc2V0ID0gMHg3ZmZmZmZmZlxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkge1xuICAgIGJ5dGVPZmZzZXQgPSAtMHg4MDAwMDAwMFxuICB9XG4gIGJ5dGVPZmZzZXQgPSArYnl0ZU9mZnNldCAgLy8gQ29lcmNlIHRvIE51bWJlci5cbiAgaWYgKG51bWJlcklzTmFOKGJ5dGVPZmZzZXQpKSB7XG4gICAgLy8gYnl0ZU9mZnNldDogaXQgaXQncyB1bmRlZmluZWQsIG51bGwsIE5hTiwgXCJmb29cIiwgZXRjLCBzZWFyY2ggd2hvbGUgYnVmZmVyXG4gICAgYnl0ZU9mZnNldCA9IGRpciA/IDAgOiAoYnVmZmVyLmxlbmd0aCAtIDEpXG4gIH1cblxuICAvLyBOb3JtYWxpemUgYnl0ZU9mZnNldDogbmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBidWZmZXIubGVuZ3RoICsgYnl0ZU9mZnNldFxuICBpZiAoYnl0ZU9mZnNldCA+PSBidWZmZXIubGVuZ3RoKSB7XG4gICAgaWYgKGRpcikgcmV0dXJuIC0xXG4gICAgZWxzZSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCAtIDFcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgMCkge1xuICAgIGlmIChkaXIpIGJ5dGVPZmZzZXQgPSAwXG4gICAgZWxzZSByZXR1cm4gLTFcbiAgfVxuXG4gIC8vIE5vcm1hbGl6ZSB2YWxcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsID0gQnVmZmVyLmZyb20odmFsLCBlbmNvZGluZylcbiAgfVxuXG4gIC8vIEZpbmFsbHksIHNlYXJjaCBlaXRoZXIgaW5kZXhPZiAoaWYgZGlyIGlzIHRydWUpIG9yIGxhc3RJbmRleE9mXG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIC8vIFNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nL2J1ZmZlciBhbHdheXMgZmFpbHNcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIC0xXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAweEZGIC8vIFNlYXJjaCBmb3IgYSBieXRlIHZhbHVlIFswLTI1NV1cbiAgICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGlmIChkaXIpIHtcbiAgICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5sYXN0SW5kZXhPZi5jYWxsKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0KVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgWyB2YWwgXSwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcilcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbmZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpIHtcbiAgdmFyIGluZGV4U2l6ZSA9IDFcbiAgdmFyIGFyckxlbmd0aCA9IGFyci5sZW5ndGhcbiAgdmFyIHZhbExlbmd0aCA9IHZhbC5sZW5ndGhcblxuICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgaWYgKGVuY29kaW5nID09PSAndWNzMicgfHwgZW5jb2RpbmcgPT09ICd1Y3MtMicgfHxcbiAgICAgICAgZW5jb2RpbmcgPT09ICd1dGYxNmxlJyB8fCBlbmNvZGluZyA9PT0gJ3V0Zi0xNmxlJykge1xuICAgICAgaWYgKGFyci5sZW5ndGggPCAyIHx8IHZhbC5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiAtMVxuICAgICAgfVxuICAgICAgaW5kZXhTaXplID0gMlxuICAgICAgYXJyTGVuZ3RoIC89IDJcbiAgICAgIHZhbExlbmd0aCAvPSAyXG4gICAgICBieXRlT2Zmc2V0IC89IDJcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChidWYsIGkpIHtcbiAgICBpZiAoaW5kZXhTaXplID09PSAxKSB7XG4gICAgICByZXR1cm4gYnVmW2ldXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBidWYucmVhZFVJbnQxNkJFKGkgKiBpbmRleFNpemUpXG4gICAgfVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGRpcikge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKGkgPSBieXRlT2Zmc2V0OyBpIDwgYXJyTGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChyZWFkKGFyciwgaSkgPT09IHJlYWQodmFsLCBmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleCkpIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWxMZW5ndGgpIHJldHVybiBmb3VuZEluZGV4ICogaW5kZXhTaXplXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoZm91bmRJbmRleCAhPT0gLTEpIGkgLT0gaSAtIGZvdW5kSW5kZXhcbiAgICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChieXRlT2Zmc2V0ICsgdmFsTGVuZ3RoID4gYXJyTGVuZ3RoKSBieXRlT2Zmc2V0ID0gYXJyTGVuZ3RoIC0gdmFsTGVuZ3RoXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHZhciBmb3VuZCA9IHRydWVcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdmFsTGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKHJlYWQoYXJyLCBpICsgaikgIT09IHJlYWQodmFsLCBqKSkge1xuICAgICAgICAgIGZvdW5kID0gZmFsc2VcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZm91bmQpIHJldHVybiBpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIC0xXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5jbHVkZXMgPSBmdW5jdGlvbiBpbmNsdWRlcyAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gdGhpcy5pbmRleE9mKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpICE9PSAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCB0cnVlKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmxhc3RJbmRleE9mID0gZnVuY3Rpb24gbGFzdEluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGJpZGlyZWN0aW9uYWxJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGZhbHNlKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChudW1iZXJJc05hTihwYXJzZWQpKSByZXR1cm4gaVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gbGF0aW4xV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCA+Pj4gMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0J1ZmZlci53cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXRbLCBsZW5ndGhdKSBpcyBubyBsb25nZXIgc3VwcG9ydGVkJ1xuICAgIClcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxhdGluMVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcbiAgdmFyIHJlcyA9IFtdXG5cbiAgdmFyIGkgPSBzdGFydFxuICB3aGlsZSAoaSA8IGVuZCkge1xuICAgIHZhciBmaXJzdEJ5dGUgPSBidWZbaV1cbiAgICB2YXIgY29kZVBvaW50ID0gbnVsbFxuICAgIHZhciBieXRlc1BlclNlcXVlbmNlID0gKGZpcnN0Qnl0ZSA+IDB4RUYpID8gNFxuICAgICAgOiAoZmlyc3RCeXRlID4gMHhERikgPyAzXG4gICAgICA6IChmaXJzdEJ5dGUgPiAweEJGKSA/IDJcbiAgICAgIDogMVxuXG4gICAgaWYgKGkgKyBieXRlc1BlclNlcXVlbmNlIDw9IGVuZCkge1xuICAgICAgdmFyIHNlY29uZEJ5dGUsIHRoaXJkQnl0ZSwgZm91cnRoQnl0ZSwgdGVtcENvZGVQb2ludFxuXG4gICAgICBzd2l0Y2ggKGJ5dGVzUGVyU2VxdWVuY2UpIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmIChmaXJzdEJ5dGUgPCAweDgwKSB7XG4gICAgICAgICAgICBjb2RlUG9pbnQgPSBmaXJzdEJ5dGVcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHgxRikgPDwgMHg2IHwgKHNlY29uZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4QyB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKHRoaXJkQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0ZGICYmICh0ZW1wQ29kZVBvaW50IDwgMHhEODAwIHx8IHRlbXBDb2RlUG9pbnQgPiAweERGRkYpKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGZvdXJ0aEJ5dGUgPSBidWZbaSArIDNdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwICYmIChmb3VydGhCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweDEyIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweEMgfCAodGhpcmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKGZvdXJ0aEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweEZGRkYgJiYgdGVtcENvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA9PT0gbnVsbCkge1xuICAgICAgLy8gd2UgZGlkIG5vdCBnZW5lcmF0ZSBhIHZhbGlkIGNvZGVQb2ludCBzbyBpbnNlcnQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQgY2hhciAoVStGRkZEKSBhbmQgYWR2YW5jZSBvbmx5IDEgYnl0ZVxuICAgICAgY29kZVBvaW50ID0gMHhGRkZEXG4gICAgICBieXRlc1BlclNlcXVlbmNlID0gMVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50ID4gMHhGRkZGKSB7XG4gICAgICAvLyBlbmNvZGUgdG8gdXRmMTYgKHN1cnJvZ2F0ZSBwYWlyIGRhbmNlKVxuICAgICAgY29kZVBvaW50IC09IDB4MTAwMDBcbiAgICAgIHJlcy5wdXNoKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMClcbiAgICAgIGNvZGVQb2ludCA9IDB4REMwMCB8IGNvZGVQb2ludCAmIDB4M0ZGXG4gICAgfVxuXG4gICAgcmVzLnB1c2goY29kZVBvaW50KVxuICAgIGkgKz0gYnl0ZXNQZXJTZXF1ZW5jZVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZUNvZGVQb2ludHNBcnJheShyZXMpXG59XG5cbi8vIEJhc2VkIG9uIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyNzQ3MjcyLzY4MDc0MiwgdGhlIGJyb3dzZXIgd2l0aFxuLy8gdGhlIGxvd2VzdCBsaW1pdCBpcyBDaHJvbWUsIHdpdGggMHgxMDAwMCBhcmdzLlxuLy8gV2UgZ28gMSBtYWduaXR1ZGUgbGVzcywgZm9yIHNhZmV0eVxudmFyIE1BWF9BUkdVTUVOVFNfTEVOR1RIID0gMHgxMDAwXG5cbmZ1bmN0aW9uIGRlY29kZUNvZGVQb2ludHNBcnJheSAoY29kZVBvaW50cykge1xuICB2YXIgbGVuID0gY29kZVBvaW50cy5sZW5ndGhcbiAgaWYgKGxlbiA8PSBNQVhfQVJHVU1FTlRTX0xFTkdUSCkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY29kZVBvaW50cykgLy8gYXZvaWQgZXh0cmEgc2xpY2UoKVxuICB9XG5cbiAgLy8gRGVjb2RlIGluIGNodW5rcyB0byBhdm9pZCBcImNhbGwgc3RhY2sgc2l6ZSBleGNlZWRlZFwiLlxuICB2YXIgcmVzID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoXG4gICAgICBTdHJpbmcsXG4gICAgICBjb2RlUG9pbnRzLnNsaWNlKGksIGkgKz0gTUFYX0FSR1VNRU5UU19MRU5HVEgpXG4gICAgKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0gJiAweDdGKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gbGF0aW4xU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIChieXRlc1tpICsgMV0gKiAyNTYpKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWYgPSB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpXG4gIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlXG4gIG5ld0J1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcbiAgfVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF1cbiAgdmFyIG11bCA9IDFcbiAgd2hpbGUgKGJ5dGVMZW5ndGggPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIHJlYWRVSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiByZWFkVUludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50QkUgPSBmdW5jdGlvbiByZWFkSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gcmVhZEludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdExFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiByZWFkRG91YmxlQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJidWZmZXJcIiBhcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIG1heEJ5dGVzID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpIC0gMVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG1heEJ5dGVzLCAwKVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgKDggKiBieXRlTGVuZ3RoKSAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gMFxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgLSAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsICg4ICogYnl0ZUxlbmd0aCkgLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpICsgMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuICB2YXIgaVxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAoaSA9IGxlbiAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIGlmIChsZW4gPCAxMDAwKSB7XG4gICAgLy8gYXNjZW5kaW5nIGNvcHkgZnJvbSBzdGFydFxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksXG4gICAgICB0YXJnZXRTdGFydFxuICAgIClcbiAgfVxuXG4gIHJldHVybiBsZW5cbn1cblxuLy8gVXNhZ2U6XG4vLyAgICBidWZmZXIuZmlsbChudW1iZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKGJ1ZmZlclssIG9mZnNldFssIGVuZF1dKVxuLy8gICAgYnVmZmVyLmZpbGwoc3RyaW5nWywgb2Zmc2V0WywgZW5kXV1bLCBlbmNvZGluZ10pXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiBmaWxsICh2YWwsIHN0YXJ0LCBlbmQsIGVuY29kaW5nKSB7XG4gIC8vIEhhbmRsZSBzdHJpbmcgY2FzZXM6XG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIGlmICh0eXBlb2Ygc3RhcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmNvZGluZyA9IHN0YXJ0XG4gICAgICBzdGFydCA9IDBcbiAgICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZW5kID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBlbmRcbiAgICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gICAgfVxuICAgIGlmICh2YWwubGVuZ3RoID09PSAxKSB7XG4gICAgICB2YXIgY29kZSA9IHZhbC5jaGFyQ29kZUF0KDApXG4gICAgICBpZiAoY29kZSA8IDI1Nikge1xuICAgICAgICB2YWwgPSBjb2RlXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChlbmNvZGluZyAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2VuY29kaW5nIG11c3QgYmUgYSBzdHJpbmcnKVxuICAgIH1cbiAgICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJyAmJiAhQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMjU1XG4gIH1cblxuICAvLyBJbnZhbGlkIHJhbmdlcyBhcmUgbm90IHNldCB0byBhIGRlZmF1bHQsIHNvIGNhbiByYW5nZSBjaGVjayBlYXJseS5cbiAgaWYgKHN0YXJ0IDwgMCB8fCB0aGlzLmxlbmd0aCA8IHN0YXJ0IHx8IHRoaXMubGVuZ3RoIDwgZW5kKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ091dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHN0YXJ0ID0gc3RhcnQgPj4+IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyB0aGlzLmxlbmd0aCA6IGVuZCA+Pj4gMFxuXG4gIGlmICghdmFsKSB2YWwgPSAwXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgICAgdGhpc1tpXSA9IHZhbFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSBCdWZmZXIuaXNCdWZmZXIodmFsKVxuICAgICAgPyB2YWxcbiAgICAgIDogbmV3IEJ1ZmZlcih2YWwsIGVuY29kaW5nKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSAwOyBpIDwgZW5kIC0gc3RhcnQ7ICsraSkge1xuICAgICAgdGhpc1tpICsgc3RhcnRdID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXisvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyLnRyaW0oKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBjb252ZXJ0cyBzdHJpbmdzIHdpdGggbGVuZ3RoIDwgMiB0byAnJ1xuICBpZiAoc3RyLmxlbmd0aCA8IDIpIHJldHVybiAnJ1xuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHJpbmcsIHVuaXRzKSB7XG4gIHVuaXRzID0gdW5pdHMgfHwgSW5maW5pdHlcbiAgdmFyIGNvZGVQb2ludFxuICB2YXIgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgdmFyIGJ5dGVzID0gW11cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgY29kZVBvaW50ID0gc3RyaW5nLmNoYXJDb2RlQXQoaSlcblxuICAgIC8vIGlzIHN1cnJvZ2F0ZSBjb21wb25lbnRcbiAgICBpZiAoY29kZVBvaW50ID4gMHhEN0ZGICYmIGNvZGVQb2ludCA8IDB4RTAwMCkge1xuICAgICAgLy8gbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICghbGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgICAvLyBubyBsZWFkIHlldFxuICAgICAgICBpZiAoY29kZVBvaW50ID4gMHhEQkZGKSB7XG4gICAgICAgICAgLy8gdW5leHBlY3RlZCB0cmFpbFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaSArIDEgPT09IGxlbmd0aCkge1xuICAgICAgICAgIC8vIHVucGFpcmVkIGxlYWRcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgbGVhZFxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgaWYgKGNvZGVQb2ludCA8IDB4REMwMCkge1xuICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyB2YWxpZCBzdXJyb2dhdGUgcGFpclxuICAgICAgY29kZVBvaW50ID0gKGxlYWRTdXJyb2dhdGUgLSAweEQ4MDAgPDwgMTAgfCBjb2RlUG9pbnQgLSAweERDMDApICsgMHgxMDAwMFxuICAgIH0gZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgLy8gdmFsaWQgYm1wIGNoYXIsIGJ1dCBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgfVxuXG4gICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcblxuICAgIC8vIGVuY29kZSB1dGY4XG4gICAgaWYgKGNvZGVQb2ludCA8IDB4ODApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMSkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChjb2RlUG9pbnQpXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDgwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2IHwgMHhDMCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyB8IDB4RTAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDQpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDEyIHwgMHhGMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIHBvaW50JylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnl0ZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0ciwgdW5pdHMpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcblxuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbi8vIE5vZGUgMC4xMCBzdXBwb3J0cyBgQXJyYXlCdWZmZXJgIGJ1dCBsYWNrcyBgQXJyYXlCdWZmZXIuaXNWaWV3YFxuZnVuY3Rpb24gaXNBcnJheUJ1ZmZlclZpZXcgKG9iaikge1xuICByZXR1cm4gKHR5cGVvZiBBcnJheUJ1ZmZlci5pc1ZpZXcgPT09ICdmdW5jdGlvbicpICYmIEFycmF5QnVmZmVyLmlzVmlldyhvYmopXG59XG5cbmZ1bmN0aW9uIG51bWJlcklzTmFOIChvYmopIHtcbiAgcmV0dXJuIG9iaiAhPT0gb2JqIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tc2VsZi1jb21wYXJlXG59XG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7IHJldHVybiB0eXBlb2Ygb2JqOyB9IDogZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCAmJiBvYmogIT09IFN5bWJvbC5wcm90b3R5cGUgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajsgfTtcclxuXHJcbnZhciBfc2xpY2VkVG9BcnJheSA9IGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gc2xpY2VJdGVyYXRvcihhcnIsIGkpIHsgdmFyIF9hcnIgPSBbXTsgdmFyIF9uID0gdHJ1ZTsgdmFyIF9kID0gZmFsc2U7IHZhciBfZSA9IHVuZGVmaW5lZDsgdHJ5IHsgZm9yICh2YXIgX2kgPSBhcnJbU3ltYm9sLml0ZXJhdG9yXSgpLCBfczsgIShfbiA9IChfcyA9IF9pLm5leHQoKSkuZG9uZSk7IF9uID0gdHJ1ZSkgeyBfYXJyLnB1c2goX3MudmFsdWUpOyBpZiAoaSAmJiBfYXJyLmxlbmd0aCA9PT0gaSkgYnJlYWs7IH0gfSBjYXRjaCAoZXJyKSB7IF9kID0gdHJ1ZTsgX2UgPSBlcnI7IH0gZmluYWxseSB7IHRyeSB7IGlmICghX24gJiYgX2lbXCJyZXR1cm5cIl0pIF9pW1wicmV0dXJuXCJdKCk7IH0gZmluYWxseSB7IGlmIChfZCkgdGhyb3cgX2U7IH0gfSByZXR1cm4gX2FycjsgfSByZXR1cm4gZnVuY3Rpb24gKGFyciwgaSkgeyBpZiAoQXJyYXkuaXNBcnJheShhcnIpKSB7IHJldHVybiBhcnI7IH0gZWxzZSBpZiAoU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChhcnIpKSB7IHJldHVybiBzbGljZUl0ZXJhdG9yKGFyciwgaSk7IH0gZWxzZSB7IHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlXCIpOyB9IH07IH0oKTtcclxuXHJcbnZhciBfY3JlYXRlQ2xhc3MgPSBmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KCk7XHJcblxyXG5mdW5jdGlvbiBfdG9Db25zdW1hYmxlQXJyYXkoYXJyKSB7IGlmIChBcnJheS5pc0FycmF5KGFycikpIHsgZm9yICh2YXIgaSA9IDAsIGFycjIgPSBBcnJheShhcnIubGVuZ3RoKTsgaSA8IGFyci5sZW5ndGg7IGkrKykgeyBhcnIyW2ldID0gYXJyW2ldOyB9IHJldHVybiBhcnIyOyB9IGVsc2UgeyByZXR1cm4gQXJyYXkuZnJvbShhcnIpOyB9IH1cclxuXHJcbmZ1bmN0aW9uIF9wb3NzaWJsZUNvbnN0cnVjdG9yUmV0dXJuKHNlbGYsIGNhbGwpIHsgaWYgKCFzZWxmKSB7IHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcihcInRoaXMgaGFzbid0IGJlZW4gaW5pdGlhbGlzZWQgLSBzdXBlcigpIGhhc24ndCBiZWVuIGNhbGxlZFwiKTsgfSByZXR1cm4gY2FsbCAmJiAodHlwZW9mIGNhbGwgPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIGNhbGwgPT09IFwiZnVuY3Rpb25cIikgPyBjYWxsIDogc2VsZjsgfVxyXG5cclxuZnVuY3Rpb24gX2luaGVyaXRzKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7IGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gXCJmdW5jdGlvblwiICYmIHN1cGVyQ2xhc3MgIT09IG51bGwpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgXCIgKyB0eXBlb2Ygc3VwZXJDbGFzcyk7IH0gc3ViQ2xhc3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzICYmIHN1cGVyQ2xhc3MucHJvdG90eXBlLCB7IGNvbnN0cnVjdG9yOiB7IHZhbHVlOiBzdWJDbGFzcywgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlLCBjb25maWd1cmFibGU6IHRydWUgfSB9KTsgaWYgKHN1cGVyQ2xhc3MpIE9iamVjdC5zZXRQcm90b3R5cGVPZiA/IE9iamVjdC5zZXRQcm90b3R5cGVPZihzdWJDbGFzcywgc3VwZXJDbGFzcykgOiBzdWJDbGFzcy5fX3Byb3RvX18gPSBzdXBlckNsYXNzOyB9XHJcblxyXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIik7IH0gfVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7IGJpbmQ6IGJpbmQsIGluamVjdDogaW5qZWN0LCBnZXRJbnN0YW5jZU9mOiBnZXRJbnN0YW5jZU9mLCBnZXRQb2xpY3k6IGdldFBvbGljeSB9O1xyXG5cclxuLypcclxuXHJcbldlbGNvbWUgdG8gRFJZLURJLlxyXG5cclxuKi9cclxuXHJcbnZhciBrbm93bkludGVyZmFjZXMgPSBbXTtcclxudmFyIGludGVyZmFjZXMgPSB7fTtcclxudmFyIGNvbmNyZXRpb25zID0ge307XHJcblxyXG52YXIgY29udGV4dCA9IFt7fV07XHJcblxyXG52YXIgUmVmID0gZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gUmVmKHByb3ZpZGVyLCBpZmlkLCBzY29wZSkge1xyXG4gICAgICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZWYpO1xyXG5cclxuICAgICAgICB0aGlzLmlmaWQgPSBpZmlkO1xyXG4gICAgICAgIHRoaXMuY291bnQgPSBwcm92aWRlci5kZXBlbmRlbmN5Q291bnQ7XHJcbiAgICAgICAgdGhpcy5kZXBlbmRlbmN5Q291bnQgPSBwcm92aWRlci5kZXBlbmRlbmN5Q291bnQ7XHJcbiAgICAgICAgdGhpcy5zY29wZSA9IHNjb3BlO1xyXG5cclxuICAgICAgICB0aGlzLmJpbmRzID0ge307XHJcbiAgICAgICAgdGhpcy5pbmplY3Rpb25zID0gbnVsbDtcclxuICAgICAgICB0aGlzLnByb3ZpZGVyID0gcHJvdmlkZXI7XHJcblxyXG4gICAgICAgIHZhciBwc2xvdCA9IHNjb3BlW2lmaWRdIHx8IChzY29wZVtpZmlkXSA9IG5ldyBTbG90KCkpO1xyXG5cclxuICAgICAgICBpZiAocHJvdmlkZXIuaW5qZWN0aW9ucykge1xyXG4gICAgICAgICAgICB0aGlzLmluamVjdGlvbnMgPSB7fTtcclxuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLmluamVjdGlvbnMsIHByb3ZpZGVyLmluamVjdGlvbnMpO1xyXG5cclxuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMuaW5qZWN0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgdmFyIF9pZmlkID0gdGhpcy5pbmplY3Rpb25zW2tleV07XHJcbiAgICAgICAgICAgICAgICB2YXIgc2xvdCA9IHNjb3BlW19pZmlkXSB8fCAoc2NvcGVbX2lmaWRdID0gbmV3IFNsb3QoKSk7XHJcbiAgICAgICAgICAgICAgICBzbG90LmFkZEluamVjdG9yKHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwc2xvdC5hZGRQcm92aWRlcih0aGlzKTtcclxuICAgIH1cclxuXHJcbiAgICBfY3JlYXRlQ2xhc3MoUmVmLCBbe1xyXG4gICAgICAgIGtleTogXCJiaW5kSW5qZWN0aW9uc1wiLFxyXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBiaW5kSW5qZWN0aW9ucyhpbmplY3Rpb25zKSB7XHJcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgICAgICAgICBpbmplY3Rpb25zLmZvckVhY2goZnVuY3Rpb24gKF9yZWYpIHtcclxuICAgICAgICAgICAgICAgIHZhciBfcmVmMiA9IF9zbGljZWRUb0FycmF5KF9yZWYsIDIpLFxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXp6ID0gX3JlZjJbMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgX2ludGVyZmFjZSA9IF9yZWYyWzFdO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBrZXkgPSBrbm93bkludGVyZmFjZXMuaW5kZXhPZihfaW50ZXJmYWNlKTtcclxuICAgICAgICAgICAgICAgIHZhciBpbmplY3Rpb24gPSBpbmplY3Rpb25zW2tleV07XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCEoa2V5IGluIF90aGlzLmJpbmRzKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpZmlkID0gX3RoaXMuaW5qZWN0aW9uc1trZXldO1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLnNjb3BlW190aGlzLmlmaWRdLnJlbW92ZUluamVjdG9yKF90aGlzKTtcclxuICAgICAgICAgICAgICAgICAgICBfdGhpcy5zYXRpc2Z5KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuZGVwZW5kZW5jeUNvdW50LS07XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgX3RoaXMuYmluZHNba2V5XSA9IGNsYXp6O1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9LCB7XHJcbiAgICAgICAga2V5OiBcInNhdGlzZnlcIixcclxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gc2F0aXNmeSgpIHtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuY291bnQtLTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmNvdW50ID09IDApIHRoaXMuc2NvcGVbdGhpcy5pZmlkXS5hZGRWaWFibGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9XSk7XHJcblxyXG4gICAgcmV0dXJuIFJlZjtcclxufSgpO1xyXG5cclxudmFyIFNsb3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBTbG90KCkge1xyXG4gICAgICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBTbG90KTtcclxuXHJcbiAgICAgICAgdGhpcy52aWFibGVQcm92aWRlcnMgPSAwO1xyXG4gICAgICAgIHRoaXMucHJvdmlkZXJzID0gW107XHJcbiAgICAgICAgdGhpcy5pbmplY3RvcnMgPSBbXTtcclxuICAgIH1cclxuXHJcbiAgICBfY3JlYXRlQ2xhc3MoU2xvdCwgW3tcclxuICAgICAgICBrZXk6IFwiYWRkSW5qZWN0b3JcIixcclxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gYWRkSW5qZWN0b3IocmVmKSB7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmluamVjdG9ycy5wdXNoKHJlZik7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnZpYWJsZVByb3ZpZGVycyA+IDApIHJlZi5zYXRpc2Z5KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSwge1xyXG4gICAgICAgIGtleTogXCJyZW1vdmVJbmplY3RvclwiLFxyXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiByZW1vdmVJbmplY3RvcihyZWYpIHtcclxuXHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHRoaXMuaW5qZWN0b3JzLmluZGV4T2YocmVmKTtcclxuICAgICAgICAgICAgaWYgKGluZGV4ID4gLTEpIHRoaXMuaW5qZWN0b3JzLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSwge1xyXG4gICAgICAgIGtleTogXCJhZGRQcm92aWRlclwiLFxyXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBhZGRQcm92aWRlcihyZWYpIHtcclxuXHJcbiAgICAgICAgICAgIHRoaXMucHJvdmlkZXJzLnB1c2gocmVmKTtcclxuICAgICAgICAgICAgaWYgKHJlZi5jb3VudCA9PSAwKSB0aGlzLmFkZFZpYWJsZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH0sIHtcclxuICAgICAgICBrZXk6IFwiYWRkVmlhYmxlXCIsXHJcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGFkZFZpYWJsZSgpIHtcclxuXHJcbiAgICAgICAgICAgIHRoaXMudmlhYmxlUHJvdmlkZXJzKys7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnZpYWJsZVByb3ZpZGVycyA9PSAxKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGluamVjdG9ycyA9IHRoaXMuaW5qZWN0b3JzO1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBpbmplY3RvcnMubGVuZ3RoOyBpIDwgbDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5qZWN0b3JzW2ldLnNhdGlzZnkoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0sIHtcclxuICAgICAgICBrZXk6IFwiZ2V0VmlhYmxlXCIsXHJcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGdldFZpYWJsZShjbGF6eiwgdGFncywgbXVsdGlwbGUpIHtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnZpYWJsZVByb3ZpZGVycyA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIW11bHRpcGxlKSB0aHJvdyBuZXcgRXJyb3IoXCJObyB2aWFibGUgcHJvdmlkZXJzIGZvciBcIiArIGNsYXp6ICsgXCIuICMxMjZcIik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciByZXQgPSBtdWx0aXBsZSA/IFtdIDogbnVsbDtcclxuXHJcbiAgICAgICAgICAgIHZhciBtb3N0VmlhYmxlID0gbnVsbDtcclxuICAgICAgICAgICAgdmFyIG1heFBvaW50cyA9IC0xO1xyXG4gICAgICAgICAgICBub3RWaWFibGU6IGZvciAodmFyIGkgPSAwLCBjOyBjID0gdGhpcy5wcm92aWRlcnNbaV07ICsraSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGMuY291bnQpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgdmFyIHBvaW50cyA9IGMuZGVwZW5kZW5jeUNvdW50O1xyXG4gICAgICAgICAgICAgICAgaWYgKHRhZ3MgJiYgYy50YWdzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgdGFnIGluIHRhZ3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGMudGFnc1t0YWddICE9PSB0YWdzW3RhZ10pIGNvbnRpbnVlIG5vdFZpYWJsZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRzKys7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKG11bHRpcGxlKSByZXRbcmV0Lmxlbmd0aF0gPSBjLnByb3ZpZGVyLnBvbGljeS5iaW5kKGMucHJvdmlkZXIsIGMuYmluZHMpO2Vsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwb2ludHMgPiBtYXhQb2ludHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4UG9pbnRzID0gcG9pbnRzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBtb3N0VmlhYmxlID0gYztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghbXVsdGlwbGUpIHtcclxuICAgICAgICAgICAgICAgIGlmICghbW9zdFZpYWJsZSkgdGhyb3cgbmV3IEVycm9yKFwiTm8gdmlhYmxlIHByb3ZpZGVycyBmb3IgXCIgKyBjbGF6eiArIFwiLiBUYWcgbWlzbWF0Y2guXCIpO1xyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBtb3N0VmlhYmxlLnByb3ZpZGVyLnBvbGljeS5iaW5kKG1vc3RWaWFibGUucHJvdmlkZXIsIG1vc3RWaWFibGUuYmluZHMpO1xyXG4gICAgICAgICAgICB9IGVsc2UgcmV0dXJuIHJldDtcclxuICAgICAgICB9XHJcbiAgICB9XSk7XHJcblxyXG4gICAgcmV0dXJuIFNsb3Q7XHJcbn0oKTtcclxuXHJcbmZ1bmN0aW9uIHJlZ2lzdGVySW50ZXJmYWNlKGlmYykge1xyXG5cclxuICAgIHZhciBwcm9wcyA9IHt9LFxyXG4gICAgICAgIGN1cnJpZmMgPSB2b2lkIDA7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBpZmMgPT0gXCJmdW5jdGlvblwiKSBjdXJyaWZjID0gaWZjLnByb3RvdHlwZTtlbHNlIGlmICgodHlwZW9mIGlmYyA9PT0gXCJ1bmRlZmluZWRcIiA/IFwidW5kZWZpbmVkXCIgOiBfdHlwZW9mKGlmYykpID09IFwib2JqZWN0XCIpIGN1cnJpZmMgPSBpZmM7XHJcblxyXG4gICAgd2hpbGUgKGN1cnJpZmMgJiYgY3VycmlmYyAhPT0gT2JqZWN0LnByb3RvdHlwZSkge1xyXG5cclxuICAgICAgICB2YXIgbmFtZXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhpZmMucHJvdG90eXBlKTtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBuYW1lcy5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIG5hbWUgPSBuYW1lc1tpXTtcclxuXHJcbiAgICAgICAgICAgIGlmICghcHJvcHNbbmFtZV0pIHByb3BzW25hbWVdID0gX3R5cGVvZihpZmMucHJvdG90eXBlW25hbWVdKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGN1cnJpZmMgPSBjdXJyaWZjLnByb3RvdHlwZTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgbGVuID0ga25vd25JbnRlcmZhY2VzLmxlbmd0aDtcclxuICAgIGludGVyZmFjZXNbbGVuXSA9IHByb3BzO1xyXG4gICAga25vd25JbnRlcmZhY2VzW2xlbl0gPSBpZmM7XHJcblxyXG4gICAgcmV0dXJuIGxlbjtcclxufVxyXG5cclxudmFyIFByb3ZpZGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBQcm92aWRlKCkge1xyXG4gICAgICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBQcm92aWRlKTtcclxuXHJcbiAgICAgICAgdGhpcy5pbmplY3Rpb25zID0gbnVsbDtcclxuICAgICAgICB0aGlzLmRlcGVuZGVuY3lDb3VudCA9IDA7XHJcbiAgICAgICAgdGhpcy5jbGF6eiA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5jdG9yID0gbnVsbDtcclxuICAgICAgICB0aGlzLmJpbmRzID0gbnVsbDtcclxuXHJcbiAgICAgICAgLy8gZGVmYXVsdCBwb2xpY3kgaXMgdG8gY3JlYXRlIGEgbmV3IGluc3RhbmNlIGZvciBlYWNoIGluamVjdGlvblxyXG4gICAgICAgIHRoaXMucG9saWN5ID0gZnVuY3Rpb24gKGJpbmRzLCBhcmdzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgdGhpcy5jdG9yKGJpbmRzLCBhcmdzKTtcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIF9jcmVhdGVDbGFzcyhQcm92aWRlLCBbe1xyXG4gICAgICAgIGtleTogXCJjbG9uZVwiLFxyXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBjbG9uZSgpIHtcclxuXHJcbiAgICAgICAgICAgIHZhciByZXQgPSBuZXcgUHJvdmlkZSgpO1xyXG5cclxuICAgICAgICAgICAgcmV0LmluamVjdGlvbnMgPSB0aGlzLmluamVjdGlvbnM7XHJcbiAgICAgICAgICAgIHJldC5kZXBlbmRlbmN5Q291bnQgPSB0aGlzLmRlcGVuZGVuY3lDb3VudDtcclxuICAgICAgICAgICAgcmV0LmNsYXp6ID0gdGhpcy5jbGF6ejtcclxuICAgICAgICAgICAgcmV0LnBvbGljeSA9IHRoaXMucG9saWN5O1xyXG4gICAgICAgICAgICByZXQuY3RvciA9IHRoaXMuY3RvcjtcclxuICAgICAgICAgICAgcmV0LmJpbmRzID0gdGhpcy5iaW5kcztcclxuXHJcbiAgICAgICAgICAgIHJldHVybiByZXQ7XHJcbiAgICAgICAgfVxyXG4gICAgfSwge1xyXG4gICAgICAgIGtleTogXCJiaW5kSW5qZWN0aW9uc1wiLFxyXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBiaW5kSW5qZWN0aW9ucyhpbmplY3Rpb25zKSB7XHJcblxyXG4gICAgICAgICAgICB2YXIgYmluZHMgPSB0aGlzLmJpbmRzID0gdGhpcy5iaW5kcyB8fCBbXTtcclxuICAgICAgICAgICAgdmFyIGJpbmRDb3VudCA9IHRoaXMuYmluZHMubGVuZ3RoO1xyXG5cclxuICAgICAgICAgICAgaW5qZWN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uIChfcmVmMykge1xyXG4gICAgICAgICAgICAgICAgdmFyIF9yZWY0ID0gX3NsaWNlZFRvQXJyYXkoX3JlZjMsIDIpLFxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXp6ID0gX3JlZjRbMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgX2ludGVyZmFjZSA9IF9yZWY0WzFdO1xyXG5cclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYmluZENvdW50OyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYmluZHNbaV1bMF0gPT0gY2xhenopIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJpbmRzW2JpbmRzLmxlbmd0aF0gPSBbY2xhenosIF9pbnRlcmZhY2VdO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH1cclxuICAgIH0sIHtcclxuICAgICAgICBrZXk6IFwiZ2V0UmVmXCIsXHJcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGdldFJlZihpZmlkLCBfaW50ZXJmYWNlKSB7XHJcblxyXG4gICAgICAgICAgICB2YXIgbWFwID0gaW50ZXJmYWNlc1tpZmlkXSxcclxuICAgICAgICAgICAgICAgIGNsYXp6ID0gdGhpcy5jbGF6ejtcclxuXHJcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBtYXApIHtcclxuICAgICAgICAgICAgICAgIGlmIChfdHlwZW9mKGNsYXp6LnByb3RvdHlwZVtrZXldKSA9PSBtYXBba2V5XSkgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDbGFzcyBcIiArIGNsYXp6Lm5hbWUgKyBcIiBjYW4ndCBwcm92aWRlIHRvIGludGVyZmFjZSBcIiArIF9pbnRlcmZhY2UubmFtZSArIFwiIGJlY2F1c2UgXCIgKyBrZXkgKyBcIiBpcyBcIiArIF90eXBlb2YoY2xhenpba2V5XSkgKyBcIiBpbnN0ZWFkIG9mIFwiICsgbWFwW2tleV0gKyBcIi5cIik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgUmVmKHRoaXMsIGlmaWQsIGNvbnRleHRbY29udGV4dC5sZW5ndGggLSAxXSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSwge1xyXG4gICAgICAgIGtleTogXCJzZXRDb25jcmV0aW9uXCIsXHJcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIHNldENvbmNyZXRpb24oY2xhenopIHtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuY2xhenogPSBjbGF6ejtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjbGF6eiA9PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3RvciA9IGZ1bmN0aW9uIChfY2xhenopIHtcclxuICAgICAgICAgICAgICAgICAgICBfaW5oZXJpdHMoX2NsYXNzLCBfY2xhenopO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBfY2xhc3MoYmluZHMsIGFyZ3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIF9yZWY1O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIF9jbGFzcyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gX3Bvc3NpYmxlQ29uc3RydWN0b3JSZXR1cm4odGhpcywgKF9yZWY1ID0gX2NsYXNzLl9fcHJvdG9fXyB8fCBPYmplY3QuZ2V0UHJvdG90eXBlT2YoX2NsYXNzKSkuY2FsbC5hcHBseShfcmVmNSwgW3RoaXNdLmNvbmNhdChfdG9Db25zdW1hYmxlQXJyYXkoYXJncykpKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gX2NsYXNzO1xyXG4gICAgICAgICAgICAgICAgfShjbGF6eik7XHJcbiAgICAgICAgICAgICAgICAvLyB0aGlzLmN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShjbGF6ei5wcm90b3R5cGUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wb2xpY3kgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNsYXp6O1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFyIGNpZCA9IGtub3duSW50ZXJmYWNlcy5pbmRleE9mKGNsYXp6KTtcclxuICAgICAgICAgICAgaWYgKGNpZCA9PSAtMSkgY2lkID0gcmVnaXN0ZXJJbnRlcmZhY2UoY2xhenopO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFjb25jcmV0aW9uc1tjaWRdKSBjb25jcmV0aW9uc1tjaWRdID0gW3RoaXNdO2Vsc2UgY29uY3JldGlvbnNbY2lkXS5wdXNoKHRoaXMpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG4gICAgfSwge1xyXG4gICAgICAgIGtleTogXCJmYWN0b3J5XCIsXHJcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGZhY3RvcnkoKSB7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnBvbGljeSA9IGZ1bmN0aW9uIChiaW5kcywgYXJncykge1xyXG4gICAgICAgICAgICAgICAgdmFyIFRISVMgPSB0aGlzO1xyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MyID0gQXJyYXkoX2xlbiksIF9rZXkgPSAwOyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MyW19rZXldID0gYXJndW1lbnRzW19rZXldO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBUSElTLmN0b3IoYmluZHMsIGFyZ3MuY29uY2F0KGFyZ3MyKSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG4gICAgfSwge1xyXG4gICAgICAgIGtleTogXCJzaW5nbGV0b25cIixcclxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gc2luZ2xldG9uKCkge1xyXG5cclxuICAgICAgICAgICAgdmFyIGluc3RhbmNlID0gbnVsbDtcclxuICAgICAgICAgICAgdGhpcy5wb2xpY3kgPSBmdW5jdGlvbiAoYmluZHMsIGFyZ3MpIHtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UpIHJldHVybiBpbnN0YW5jZTtcclxuXHJcbiAgICAgICAgICAgICAgICBpbnN0YW5jZSA9IE9iamVjdC5jcmVhdGUodGhpcy5jdG9yLnByb3RvdHlwZSk7XHJcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5jb25zdHJ1Y3RvciA9IHRoaXMuY3RvcjtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3Rvci5jYWxsKGluc3RhbmNlLCBiaW5kcywgYXJncyk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gbmV3IChjbGFzcyBleHRlbmRzIHRoaXMuY3RvcntcclxuICAgICAgICAgICAgICAgIC8vICAgICBjb25zdHJ1Y3RvciggYXJncyApe1xyXG4gICAgICAgICAgICAgICAgLy8gICAgICAgICBpbnN0YW5jZSA9IHRoaXM7IC8vIGNhbnQgZG8gdGhpcyA6KFxyXG4gICAgICAgICAgICAgICAgLy8gICAgICAgICBzdXBlcihhcmdzKTtcclxuICAgICAgICAgICAgICAgIC8vICAgICB9XHJcbiAgICAgICAgICAgICAgICAvLyB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG4gICAgfV0pO1xyXG5cclxuICAgIHJldHVybiBQcm92aWRlO1xyXG59KCk7XHJcblxyXG5mdW5jdGlvbiBiaW5kKGNsYXp6KSB7XHJcblxyXG4gICAgdmFyIGNpZCA9IGtub3duSW50ZXJmYWNlcy5pbmRleE9mKGNsYXp6KTtcclxuICAgIGlmIChjaWQgPT0gLTEpIHtcclxuICAgICAgICBjaWQgPSByZWdpc3RlckludGVyZmFjZShjbGF6eik7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3ZpZGVycyA9IGNvbmNyZXRpb25zW2NpZF07XHJcbiAgICB2YXIgbG9jYWxQcm92aWRlcnMgPSBbXTtcclxuXHJcbiAgICBpZiAoIXByb3ZpZGVycykge1xyXG5cclxuICAgICAgICBpZiAoY2xhenogJiYgY2xhenpbXCJAaW5qZWN0XCJdKSBpbmplY3QoY2xhenpbXCJAaW5qZWN0XCJdKS5pbnRvKGNsYXp6KTtlbHNlIG5ldyBQcm92aWRlKCkuc2V0Q29uY3JldGlvbihjbGF6eik7XHJcblxyXG4gICAgICAgIHByb3ZpZGVycyA9IGNvbmNyZXRpb25zW2NpZF07XHJcbiAgICB9XHJcblxyXG4gICAgbG9jYWxQcm92aWRlcnMgPSBwcm92aWRlcnMubWFwKGZ1bmN0aW9uIChwYXJ0aWFsKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhcnRpYWwuY2xvbmUoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHZhciByZWZzID0gW107XHJcbiAgICB2YXIgdGFncyA9IG51bGw7XHJcbiAgICB2YXIgaWZpZCA9IHZvaWQgMDtcclxuXHJcbiAgICB2YXIgcGFydGlhbEJpbmQgPSB7XHJcbiAgICAgICAgdG86IGZ1bmN0aW9uIHRvKF9pbnRlcmZhY2UpIHtcclxuXHJcbiAgICAgICAgICAgIHZhciBpZmlkID0ga25vd25JbnRlcmZhY2VzLmluZGV4T2YoX2ludGVyZmFjZSk7XHJcbiAgICAgICAgICAgIGlmIChpZmlkID09IC0xKSBpZmlkID0gcmVnaXN0ZXJJbnRlcmZhY2UoX2ludGVyZmFjZSk7XHJcblxyXG4gICAgICAgICAgICBsb2NhbFByb3ZpZGVycy5mb3JFYWNoKGZ1bmN0aW9uIChwcm92aWRlcikge1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciByZWYgPSBwcm92aWRlci5nZXRSZWYoaWZpZCwgX2ludGVyZmFjZSk7XHJcbiAgICAgICAgICAgICAgICByZWYudGFncyA9IHRhZ3M7XHJcbiAgICAgICAgICAgICAgICByZWZzLnB1c2gocmVmKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICB3aXRoVGFnczogZnVuY3Rpb24gd2l0aFRhZ3ModGFncykge1xyXG4gICAgICAgICAgICByZWZzLmZvckVhY2goZnVuY3Rpb24gKHJlZikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlZi50YWdzID0gdGFncztcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHNpbmdsZXRvbjogZnVuY3Rpb24gc2luZ2xldG9uKCkge1xyXG4gICAgICAgICAgICBsb2NhbFByb3ZpZGVycy5mb3JFYWNoKGZ1bmN0aW9uIChwcm92aWRlcikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHByb3ZpZGVyLnNpbmdsZXRvbigpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBmYWN0b3J5OiBmdW5jdGlvbiBmYWN0b3J5KCkge1xyXG4gICAgICAgICAgICBsb2NhbFByb3ZpZGVycy5mb3JFYWNoKGZ1bmN0aW9uIChwcm92aWRlcikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHByb3ZpZGVyLmZhY3RvcnkoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaW5qZWN0OiBmdW5jdGlvbiBpbmplY3QobWFwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmluamVjdGluZyhtYXApO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaW5qZWN0aW5nOiBmdW5jdGlvbiBpbmplY3RpbmcoKSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIF9sZW4yID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IEFycmF5KF9sZW4yKSwgX2tleTIgPSAwOyBfa2V5MiA8IF9sZW4yOyBfa2V5MisrKSB7XHJcbiAgICAgICAgICAgICAgICBhcmdzW19rZXkyXSA9IGFyZ3VtZW50c1tfa2V5Ml07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJlZnMuZm9yRWFjaChmdW5jdGlvbiAocmVmKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVmLmJpbmRJbmplY3Rpb25zKGFyZ3MpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgbG9jYWxQcm92aWRlcnMuZm9yRWFjaChmdW5jdGlvbiAocHJvdmlkZXIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBwcm92aWRlci5iaW5kSW5qZWN0aW9ucyhhcmdzKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBwYXJ0aWFsQmluZDtcclxufVxyXG5cclxudmFyIEluamVjdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIEluamVjdChkZXBlbmRlbmNpZXMpIHtcclxuICAgICAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgSW5qZWN0KTtcclxuXHJcbiAgICAgICAgdGhpcy5kZXBlbmRlbmNpZXMgPSBkZXBlbmRlbmNpZXM7XHJcbiAgICAgICAgdmFyIHRhZ3MgPSB0aGlzLnRhZ3MgPSB7fTtcclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gZGVwZW5kZW5jaWVzKSB7XHJcbiAgICAgICAgICAgIHRhZ3Nba2V5XSA9IHt9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBfY3JlYXRlQ2xhc3MoSW5qZWN0LCBbe1xyXG4gICAgICAgIGtleTogXCJpbnRvXCIsXHJcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGludG8oY2xhenopIHtcclxuXHJcbiAgICAgICAgICAgIHZhciBjaWQgPSBrbm93bkludGVyZmFjZXMuaW5kZXhPZihjbGF6eik7XHJcbiAgICAgICAgICAgIGlmIChjaWQgPT0gLTEpIGNpZCA9IHJlZ2lzdGVySW50ZXJmYWNlKGNsYXp6KTtcclxuXHJcbiAgICAgICAgICAgIHZhciBpbmplY3Rpb25zID0ge30sXHJcbiAgICAgICAgICAgICAgICBtYXAgPSB0aGlzLmRlcGVuZGVuY2llcyxcclxuICAgICAgICAgICAgICAgIGRlcGVuZGVuY3lDb3VudCA9IDAsXHJcbiAgICAgICAgICAgICAgICB0YWdzID0gdGhpcy50YWdzLFxyXG4gICAgICAgICAgICAgICAgbXVsdGlwbGUgPSB7fTtcclxuXHJcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBtYXApIHtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgX2ludGVyZmFjZSA9IG1hcFtrZXldO1xyXG4gICAgICAgICAgICAgICAgdmFyIGRlcGVuZGVuY3kgPSBfaW50ZXJmYWNlO1xyXG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGVwZW5kZW5jeSkpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgX2ludGVyZmFjZSA9IF9pbnRlcmZhY2VbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBkZXBlbmRlbmN5Lmxlbmd0aDsgKytpKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGRlcGVuZGVuY3lbaV0gPT0gXCJzdHJpbmdcIikgdGFnc1trZXldW2RlcGVuZGVuY3lbaV1dID0gdHJ1ZTtlbHNlIGlmIChBcnJheS5pc0FycmF5KGRlcGVuZGVuY3lbaV0pKSBtdWx0aXBsZVtrZXldID0gdHJ1ZTtlbHNlIGlmIChkZXBlbmRlbmN5W2ldKSBPYmplY3QuYXNzaWduKHRhZ3Nba2V5XSwgZGVwZW5kZW5jeVtpXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHZhciBpZmlkID0ga25vd25JbnRlcmZhY2VzLmluZGV4T2YoX2ludGVyZmFjZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGlmaWQgPT0gLTEpIGlmaWQgPSByZWdpc3RlckludGVyZmFjZShfaW50ZXJmYWNlKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpbmplY3Rpb25zW2tleV0gPSBpZmlkO1xyXG5cclxuICAgICAgICAgICAgICAgIGRlcGVuZGVuY3lDb3VudCsrO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB2YXIgcHJvdmlkZXIgPSBuZXcgUHJvdmlkZSgpLnNldENvbmNyZXRpb24oY2xhenopLFxyXG4gICAgICAgICAgICAgICAgcHJvdG8gPSBjbGF6ei5wcm90b3R5cGU7XHJcbiAgICAgICAgICAgIHZhciBwcm92aWRlcnMgPSBjb25jcmV0aW9uc1tjaWRdO1xyXG5cclxuICAgICAgICAgICAgcHJvdmlkZXIuaW5qZWN0aW9ucyA9IGluamVjdGlvbnM7XHJcbiAgICAgICAgICAgIHByb3ZpZGVyLmRlcGVuZGVuY3lDb3VudCA9IGRlcGVuZGVuY3lDb3VudDtcclxuXHJcbiAgICAgICAgICAgIHByb3ZpZGVyLmN0b3IgPSBmdW5jdGlvbiAoYmluZHMsIGFyZ3MpIHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmVEZXBlbmRlbmNpZXMoYmluZHMsIHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgY2xhenouYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHByb3ZpZGVyLmN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShjbGF6ei5wcm90b3R5cGUpO1xyXG4gICAgICAgICAgICBwcm92aWRlci5jdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGNsYXp6O1xyXG5cclxuICAgICAgICAgICAgLy8gcHJvdmlkZXIuY3RvciA9IGNsYXNzIGV4dGVuZHMgY2xhenoge1xyXG4gICAgICAgICAgICAvLyAgICAgY29uc3RydWN0b3IoIGFyZ3MgKXtcclxuICAgICAgICAgICAgLy8gICAgICAgICByZXNvbHZlRGVwZW5kZW5jaWVzKCB0aGlzICk7IC8vICpzaWdoKlxyXG4gICAgICAgICAgICAvLyAgICAgICAgIHN1cGVyKC4uLmFyZ3MpO1xyXG4gICAgICAgICAgICAvLyAgICAgfVxyXG4gICAgICAgICAgICAvLyB9O1xyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gcmVzb2x2ZURlcGVuZGVuY2llcyhiaW5kcywgb2JqKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgc2xvdHNldCA9IGNvbnRleHRbY29udGV4dC5sZW5ndGggLSAxXTtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIF9rZXkzIGluIGluamVjdGlvbnMpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYmluZHMgJiYgaW5qZWN0aW9uc1tfa2V5M10gaW4gYmluZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqW19rZXkzXSA9IGJpbmRzW2luamVjdGlvbnNbX2tleTNdXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICB2YXIgc2xvdCA9IHNsb3RzZXRbaW5qZWN0aW9uc1tfa2V5M11dO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwb2xpY3kgPSBzbG90LmdldFZpYWJsZShfa2V5MywgdGFnc1tfa2V5M10sIG11bHRpcGxlW19rZXkzXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFtdWx0aXBsZVtfa2V5M10pIG9ialtfa2V5M10gPSBwb2xpY3koW10pO2Vsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgb3V0ID0gb2JqW19rZXkzXSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBfaTIgPSAwOyBfaTIgPCBwb2xpY3kubGVuZ3RoOyArK19pMikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0W19pMl0gPSBwb2xpY3lbX2kyXShbXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XSk7XHJcblxyXG4gICAgcmV0dXJuIEluamVjdDtcclxufSgpO1xyXG5cclxuZnVuY3Rpb24gaW5qZWN0KGRlcGVuZGVuY2llcykge1xyXG5cclxuICAgIHJldHVybiBuZXcgSW5qZWN0KGRlcGVuZGVuY2llcyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEluc3RhbmNlT2YoX2ludGVyZmFjZSkge1xyXG4gICAgZm9yICh2YXIgX2xlbjMgPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbjMgPiAxID8gX2xlbjMgLSAxIDogMCksIF9rZXk0ID0gMTsgX2tleTQgPCBfbGVuMzsgX2tleTQrKykge1xyXG4gICAgICAgIGFyZ3NbX2tleTQgLSAxXSA9IGFyZ3VtZW50c1tfa2V5NF07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gbGV0IGlmaWQgPSBrbm93bkludGVyZmFjZXMuaW5kZXhPZiggX2ludGVyZmFjZSApO1xyXG4gICAgLy8gbGV0IHNsb3QgPSBjb250ZXh0WyBjb250ZXh0Lmxlbmd0aC0xIF1bIGlmaWQgXTtcclxuXHJcbiAgICAvLyBpZiggIXNsb3QgKVxyXG4gICAgLy8gICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHByb3ZpZGVycyBmb3IgXCIgKyAoX2ludGVyZmFjZS5uYW1lIHx8IF9pbnRlcmZhY2UpICsgXCIuICM0NjdcIik7XHJcblxyXG4gICAgLy8gbGV0IHBvbGljeSA9IHNsb3QuZ2V0VmlhYmxlKCBfaW50ZXJmYWNlLm5hbWUgfHwgX2ludGVyZmFjZSApO1xyXG5cclxuICAgIC8vIHJldHVybiBwb2xpY3kuY2FsbCggbnVsbCwgYXJncyApO1xyXG4gICAgcmV0dXJuIGdldFBvbGljeSh7IF9pbnRlcmZhY2U6IF9pbnRlcmZhY2UsIGFyZ3M6IGFyZ3MgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFBvbGljeShkZXNjKSB7XHJcbiAgICBkZXNjID0gZGVzYyB8fCB7fTtcclxuICAgIGlmICghZGVzYy5faW50ZXJmYWNlKSB0aHJvdyBuZXcgRXJyb3IoXCJQb2xpY3kgZGVzY3JpcHRvciBoYXMgbm8gaW50ZXJmYWNlLlwiKTtcclxuICAgIHZhciBuYW1lID0gZGVzYy5faW50ZXJmYWNlLm5hbWUgfHwgZGVzYy5faW50ZXJmYWNlO1xyXG4gICAgdmFyIHRhZ3MgPSBkZXNjLnRhZ3M7XHJcbiAgICB2YXIgbXVsdGlwbGUgPSBkZXNjLm11bHRpcGxlO1xyXG4gICAgdmFyIGFyZ3MgPSBkZXNjLmFyZ3M7XHJcblxyXG4gICAgdmFyIGlmaWQgPSBrbm93bkludGVyZmFjZXMuaW5kZXhPZihkZXNjLl9pbnRlcmZhY2UpO1xyXG4gICAgdmFyIHNsb3QgPSBjb250ZXh0W2NvbnRleHQubGVuZ3RoIC0gMV1baWZpZF07XHJcblxyXG4gICAgaWYgKCFzbG90KSB0aHJvdyBuZXcgRXJyb3IoXCJObyBwcm92aWRlcnMgZm9yIFwiICsgbmFtZSArIFwiLiAjNDY3XCIpO1xyXG5cclxuICAgIHZhciBwb2xpY3kgPSBzbG90LmdldFZpYWJsZShuYW1lLCB0YWdzLCBtdWx0aXBsZSk7XHJcbiAgICBpZiAoYXJncykge1xyXG4gICAgICAgIGlmIChtdWx0aXBsZSkgcG9saWN5ID0gcG9saWN5Lm1hcChmdW5jdGlvbiAocCkge1xyXG4gICAgICAgICAgICByZXR1cm4gcC5jYWxsKG51bGwsIGFyZ3MpO1xyXG4gICAgICAgIH0pO2Vsc2UgcG9saWN5ID0gcG9saWN5LmNhbGwobnVsbCwgYXJncyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcG9saWN5O1xyXG59XHJcbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwiLyohXG5cbkpTWmlwIHYzLjEuNSAtIEEgSmF2YVNjcmlwdCBjbGFzcyBmb3IgZ2VuZXJhdGluZyBhbmQgcmVhZGluZyB6aXAgZmlsZXNcbjxodHRwOi8vc3R1YXJ0ay5jb20vanN6aXA+XG5cbihjKSAyMDA5LTIwMTYgU3R1YXJ0IEtuaWdodGxleSA8c3R1YXJ0IFthdF0gc3R1YXJ0ay5jb20+XG5EdWFsIGxpY2VuY2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSBvciBHUEx2My4gU2VlIGh0dHBzOi8vcmF3LmdpdGh1Yi5jb20vU3R1ay9qc3ppcC9tYXN0ZXIvTElDRU5TRS5tYXJrZG93bi5cblxuSlNaaXAgdXNlcyB0aGUgbGlicmFyeSBwYWtvIHJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSA6XG5odHRwczovL2dpdGh1Yi5jb20vbm9kZWNhL3Bha28vYmxvYi9tYXN0ZXIvTElDRU5TRVxuKi9cbiFmdW5jdGlvbihhKXtpZihcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIG1vZHVsZSltb2R1bGUuZXhwb3J0cz1hKCk7ZWxzZSBpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQpZGVmaW5lKFtdLGEpO2Vsc2V7dmFyIGI7Yj1cInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93P3dpbmRvdzpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP2dsb2JhbDpcInVuZGVmaW5lZFwiIT10eXBlb2Ygc2VsZj9zZWxmOnRoaXMsYi5KU1ppcD1hKCl9fShmdW5jdGlvbigpe3JldHVybiBmdW5jdGlvbiBhKGIsYyxkKXtmdW5jdGlvbiBlKGcsaCl7aWYoIWNbZ10pe2lmKCFiW2ddKXt2YXIgaT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFoJiZpKXJldHVybiBpKGcsITApO2lmKGYpcmV0dXJuIGYoZywhMCk7dmFyIGo9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitnK1wiJ1wiKTt0aHJvdyBqLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsan12YXIgaz1jW2ddPXtleHBvcnRzOnt9fTtiW2ddWzBdLmNhbGwoay5leHBvcnRzLGZ1bmN0aW9uKGEpe3ZhciBjPWJbZ11bMV1bYV07cmV0dXJuIGUoYz9jOmEpfSxrLGsuZXhwb3J0cyxhLGIsYyxkKX1yZXR1cm4gY1tnXS5leHBvcnRzfWZvcih2YXIgZj1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGc9MDtnPGQubGVuZ3RoO2crKyllKGRbZ10pO3JldHVybiBlfSh7MTpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO3ZhciBkPWEoXCIuL3V0aWxzXCIpLGU9YShcIi4vc3VwcG9ydFwiKSxmPVwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz1cIjtjLmVuY29kZT1mdW5jdGlvbihhKXtmb3IodmFyIGIsYyxlLGcsaCxpLGosaz1bXSxsPTAsbT1hLmxlbmd0aCxuPW0sbz1cInN0cmluZ1wiIT09ZC5nZXRUeXBlT2YoYSk7bDxhLmxlbmd0aDspbj1tLWwsbz8oYj1hW2wrK10sYz1sPG0/YVtsKytdOjAsZT1sPG0/YVtsKytdOjApOihiPWEuY2hhckNvZGVBdChsKyspLGM9bDxtP2EuY2hhckNvZGVBdChsKyspOjAsZT1sPG0/YS5jaGFyQ29kZUF0KGwrKyk6MCksZz1iPj4yLGg9KDMmYik8PDR8Yz4+NCxpPW4+MT8oMTUmYyk8PDJ8ZT4+Njo2NCxqPW4+Mj82MyZlOjY0LGsucHVzaChmLmNoYXJBdChnKStmLmNoYXJBdChoKStmLmNoYXJBdChpKStmLmNoYXJBdChqKSk7cmV0dXJuIGsuam9pbihcIlwiKX0sYy5kZWNvZGU9ZnVuY3Rpb24oYSl7dmFyIGIsYyxkLGcsaCxpLGosaz0wLGw9MCxtPVwiZGF0YTpcIjtpZihhLnN1YnN0cigwLG0ubGVuZ3RoKT09PW0pdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBiYXNlNjQgaW5wdXQsIGl0IGxvb2tzIGxpa2UgYSBkYXRhIHVybC5cIik7YT1hLnJlcGxhY2UoL1teQS1aYS16MC05XFwrXFwvXFw9XS9nLFwiXCIpO3ZhciBuPTMqYS5sZW5ndGgvNDtpZihhLmNoYXJBdChhLmxlbmd0aC0xKT09PWYuY2hhckF0KDY0KSYmbi0tLGEuY2hhckF0KGEubGVuZ3RoLTIpPT09Zi5jaGFyQXQoNjQpJiZuLS0sbiUxIT09MCl0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGJhc2U2NCBpbnB1dCwgYmFkIGNvbnRlbnQgbGVuZ3RoLlwiKTt2YXIgbztmb3Iobz1lLnVpbnQ4YXJyYXk/bmV3IFVpbnQ4QXJyYXkoMHxuKTpuZXcgQXJyYXkoMHxuKTtrPGEubGVuZ3RoOylnPWYuaW5kZXhPZihhLmNoYXJBdChrKyspKSxoPWYuaW5kZXhPZihhLmNoYXJBdChrKyspKSxpPWYuaW5kZXhPZihhLmNoYXJBdChrKyspKSxqPWYuaW5kZXhPZihhLmNoYXJBdChrKyspKSxiPWc8PDJ8aD4+NCxjPSgxNSZoKTw8NHxpPj4yLGQ9KDMmaSk8PDZ8aixvW2wrK109Yiw2NCE9PWkmJihvW2wrK109YyksNjQhPT1qJiYob1tsKytdPWQpO3JldHVybiBvfX0se1wiLi9zdXBwb3J0XCI6MzAsXCIuL3V0aWxzXCI6MzJ9XSwyOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhLGIsYyxkLGUpe3RoaXMuY29tcHJlc3NlZFNpemU9YSx0aGlzLnVuY29tcHJlc3NlZFNpemU9Yix0aGlzLmNyYzMyPWMsdGhpcy5jb21wcmVzc2lvbj1kLHRoaXMuY29tcHJlc3NlZENvbnRlbnQ9ZX12YXIgZT1hKFwiLi9leHRlcm5hbFwiKSxmPWEoXCIuL3N0cmVhbS9EYXRhV29ya2VyXCIpLGc9YShcIi4vc3RyZWFtL0RhdGFMZW5ndGhQcm9iZVwiKSxoPWEoXCIuL3N0cmVhbS9DcmMzMlByb2JlXCIpLGc9YShcIi4vc3RyZWFtL0RhdGFMZW5ndGhQcm9iZVwiKTtkLnByb3RvdHlwZT17Z2V0Q29udGVudFdvcmtlcjpmdW5jdGlvbigpe3ZhciBhPW5ldyBmKGUuUHJvbWlzZS5yZXNvbHZlKHRoaXMuY29tcHJlc3NlZENvbnRlbnQpKS5waXBlKHRoaXMuY29tcHJlc3Npb24udW5jb21wcmVzc1dvcmtlcigpKS5waXBlKG5ldyBnKFwiZGF0YV9sZW5ndGhcIikpLGI9dGhpcztyZXR1cm4gYS5vbihcImVuZFwiLGZ1bmN0aW9uKCl7aWYodGhpcy5zdHJlYW1JbmZvLmRhdGFfbGVuZ3RoIT09Yi51bmNvbXByZXNzZWRTaXplKXRocm93IG5ldyBFcnJvcihcIkJ1ZyA6IHVuY29tcHJlc3NlZCBkYXRhIHNpemUgbWlzbWF0Y2hcIil9KSxhfSxnZXRDb21wcmVzc2VkV29ya2VyOmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyBmKGUuUHJvbWlzZS5yZXNvbHZlKHRoaXMuY29tcHJlc3NlZENvbnRlbnQpKS53aXRoU3RyZWFtSW5mbyhcImNvbXByZXNzZWRTaXplXCIsdGhpcy5jb21wcmVzc2VkU2l6ZSkud2l0aFN0cmVhbUluZm8oXCJ1bmNvbXByZXNzZWRTaXplXCIsdGhpcy51bmNvbXByZXNzZWRTaXplKS53aXRoU3RyZWFtSW5mbyhcImNyYzMyXCIsdGhpcy5jcmMzMikud2l0aFN0cmVhbUluZm8oXCJjb21wcmVzc2lvblwiLHRoaXMuY29tcHJlc3Npb24pfX0sZC5jcmVhdGVXb3JrZXJGcm9tPWZ1bmN0aW9uKGEsYixjKXtyZXR1cm4gYS5waXBlKG5ldyBoKS5waXBlKG5ldyBnKFwidW5jb21wcmVzc2VkU2l6ZVwiKSkucGlwZShiLmNvbXByZXNzV29ya2VyKGMpKS5waXBlKG5ldyBnKFwiY29tcHJlc3NlZFNpemVcIikpLndpdGhTdHJlYW1JbmZvKFwiY29tcHJlc3Npb25cIixiKX0sYi5leHBvcnRzPWR9LHtcIi4vZXh0ZXJuYWxcIjo2LFwiLi9zdHJlYW0vQ3JjMzJQcm9iZVwiOjI1LFwiLi9zdHJlYW0vRGF0YUxlbmd0aFByb2JlXCI6MjYsXCIuL3N0cmVhbS9EYXRhV29ya2VyXCI6Mjd9XSwzOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7dmFyIGQ9YShcIi4vc3RyZWFtL0dlbmVyaWNXb3JrZXJcIik7Yy5TVE9SRT17bWFnaWM6XCJcXDBcXDBcIixjb21wcmVzc1dvcmtlcjpmdW5jdGlvbihhKXtyZXR1cm4gbmV3IGQoXCJTVE9SRSBjb21wcmVzc2lvblwiKX0sdW5jb21wcmVzc1dvcmtlcjpmdW5jdGlvbigpe3JldHVybiBuZXcgZChcIlNUT1JFIGRlY29tcHJlc3Npb25cIil9fSxjLkRFRkxBVEU9YShcIi4vZmxhdGVcIil9LHtcIi4vZmxhdGVcIjo3LFwiLi9zdHJlYW0vR2VuZXJpY1dvcmtlclwiOjI4fV0sNDpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoKXtmb3IodmFyIGEsYj1bXSxjPTA7YzwyNTY7YysrKXthPWM7Zm9yKHZhciBkPTA7ZDw4O2QrKylhPTEmYT8zOTg4MjkyMzg0XmE+Pj4xOmE+Pj4xO2JbY109YX1yZXR1cm4gYn1mdW5jdGlvbiBlKGEsYixjLGQpe3ZhciBlPWgsZj1kK2M7YV49LTE7Zm9yKHZhciBnPWQ7ZzxmO2crKylhPWE+Pj44XmVbMjU1JihhXmJbZ10pXTtyZXR1cm4gYV4tMX1mdW5jdGlvbiBmKGEsYixjLGQpe3ZhciBlPWgsZj1kK2M7YV49LTE7Zm9yKHZhciBnPWQ7ZzxmO2crKylhPWE+Pj44XmVbMjU1JihhXmIuY2hhckNvZGVBdChnKSldO3JldHVybiBhXi0xfXZhciBnPWEoXCIuL3V0aWxzXCIpLGg9ZCgpO2IuZXhwb3J0cz1mdW5jdGlvbihhLGIpe2lmKFwidW5kZWZpbmVkXCI9PXR5cGVvZiBhfHwhYS5sZW5ndGgpcmV0dXJuIDA7dmFyIGM9XCJzdHJpbmdcIiE9PWcuZ2V0VHlwZU9mKGEpO3JldHVybiBjP2UoMHxiLGEsYS5sZW5ndGgsMCk6ZigwfGIsYSxhLmxlbmd0aCwwKX19LHtcIi4vdXRpbHNcIjozMn1dLDU6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtjLmJhc2U2ND0hMSxjLmJpbmFyeT0hMSxjLmRpcj0hMSxjLmNyZWF0ZUZvbGRlcnM9ITAsYy5kYXRlPW51bGwsYy5jb21wcmVzc2lvbj1udWxsLGMuY29tcHJlc3Npb25PcHRpb25zPW51bGwsYy5jb21tZW50PW51bGwsYy51bml4UGVybWlzc2lvbnM9bnVsbCxjLmRvc1Blcm1pc3Npb25zPW51bGx9LHt9XSw2OltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7dmFyIGQ9bnVsbDtkPVwidW5kZWZpbmVkXCIhPXR5cGVvZiBQcm9taXNlP1Byb21pc2U6YShcImxpZVwiKSxiLmV4cG9ydHM9e1Byb21pc2U6ZH19LHtsaWU6NTh9XSw3OltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhLGIpe2guY2FsbCh0aGlzLFwiRmxhdGVXb3JrZXIvXCIrYSksdGhpcy5fcGFrbz1udWxsLHRoaXMuX3Bha29BY3Rpb249YSx0aGlzLl9wYWtvT3B0aW9ucz1iLHRoaXMubWV0YT17fX12YXIgZT1cInVuZGVmaW5lZFwiIT10eXBlb2YgVWludDhBcnJheSYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIFVpbnQxNkFycmF5JiZcInVuZGVmaW5lZFwiIT10eXBlb2YgVWludDMyQXJyYXksZj1hKFwicGFrb1wiKSxnPWEoXCIuL3V0aWxzXCIpLGg9YShcIi4vc3RyZWFtL0dlbmVyaWNXb3JrZXJcIiksaT1lP1widWludDhhcnJheVwiOlwiYXJyYXlcIjtjLm1hZ2ljPVwiXFxiXFwwXCIsZy5pbmhlcml0cyhkLGgpLGQucHJvdG90eXBlLnByb2Nlc3NDaHVuaz1mdW5jdGlvbihhKXt0aGlzLm1ldGE9YS5tZXRhLG51bGw9PT10aGlzLl9wYWtvJiZ0aGlzLl9jcmVhdGVQYWtvKCksdGhpcy5fcGFrby5wdXNoKGcudHJhbnNmb3JtVG8oaSxhLmRhdGEpLCExKX0sZC5wcm90b3R5cGUuZmx1c2g9ZnVuY3Rpb24oKXtoLnByb3RvdHlwZS5mbHVzaC5jYWxsKHRoaXMpLG51bGw9PT10aGlzLl9wYWtvJiZ0aGlzLl9jcmVhdGVQYWtvKCksdGhpcy5fcGFrby5wdXNoKFtdLCEwKX0sZC5wcm90b3R5cGUuY2xlYW5VcD1mdW5jdGlvbigpe2gucHJvdG90eXBlLmNsZWFuVXAuY2FsbCh0aGlzKSx0aGlzLl9wYWtvPW51bGx9LGQucHJvdG90eXBlLl9jcmVhdGVQYWtvPWZ1bmN0aW9uKCl7dGhpcy5fcGFrbz1uZXcgZlt0aGlzLl9wYWtvQWN0aW9uXSh7cmF3OiEwLGxldmVsOnRoaXMuX3Bha29PcHRpb25zLmxldmVsfHwtMX0pO3ZhciBhPXRoaXM7dGhpcy5fcGFrby5vbkRhdGE9ZnVuY3Rpb24oYil7YS5wdXNoKHtkYXRhOmIsbWV0YTphLm1ldGF9KX19LGMuY29tcHJlc3NXb3JrZXI9ZnVuY3Rpb24oYSl7cmV0dXJuIG5ldyBkKFwiRGVmbGF0ZVwiLGEpfSxjLnVuY29tcHJlc3NXb3JrZXI9ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IGQoXCJJbmZsYXRlXCIse30pfX0se1wiLi9zdHJlYW0vR2VuZXJpY1dvcmtlclwiOjI4LFwiLi91dGlsc1wiOjMyLHBha286NTl9XSw4OltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhLGIsYyxkKXtmLmNhbGwodGhpcyxcIlppcEZpbGVXb3JrZXJcIiksdGhpcy5ieXRlc1dyaXR0ZW49MCx0aGlzLnppcENvbW1lbnQ9Yix0aGlzLnppcFBsYXRmb3JtPWMsdGhpcy5lbmNvZGVGaWxlTmFtZT1kLHRoaXMuc3RyZWFtRmlsZXM9YSx0aGlzLmFjY3VtdWxhdGU9ITEsdGhpcy5jb250ZW50QnVmZmVyPVtdLHRoaXMuZGlyUmVjb3Jkcz1bXSx0aGlzLmN1cnJlbnRTb3VyY2VPZmZzZXQ9MCx0aGlzLmVudHJpZXNDb3VudD0wLHRoaXMuY3VycmVudEZpbGU9bnVsbCx0aGlzLl9zb3VyY2VzPVtdfXZhciBlPWEoXCIuLi91dGlsc1wiKSxmPWEoXCIuLi9zdHJlYW0vR2VuZXJpY1dvcmtlclwiKSxnPWEoXCIuLi91dGY4XCIpLGg9YShcIi4uL2NyYzMyXCIpLGk9YShcIi4uL3NpZ25hdHVyZVwiKSxqPWZ1bmN0aW9uKGEsYil7dmFyIGMsZD1cIlwiO2ZvcihjPTA7YzxiO2MrKylkKz1TdHJpbmcuZnJvbUNoYXJDb2RlKDI1NSZhKSxhPj4+PTg7cmV0dXJuIGR9LGs9ZnVuY3Rpb24oYSxiKXt2YXIgYz1hO3JldHVybiBhfHwoYz1iPzE2ODkzOjMzMjA0KSwoNjU1MzUmYyk8PDE2fSxsPWZ1bmN0aW9uKGEsYil7cmV0dXJuIDYzJihhfHwwKX0sbT1mdW5jdGlvbihhLGIsYyxkLGYsbSl7dmFyIG4sbyxwPWEuZmlsZSxxPWEuY29tcHJlc3Npb24scj1tIT09Zy51dGY4ZW5jb2RlLHM9ZS50cmFuc2Zvcm1UbyhcInN0cmluZ1wiLG0ocC5uYW1lKSksdD1lLnRyYW5zZm9ybVRvKFwic3RyaW5nXCIsZy51dGY4ZW5jb2RlKHAubmFtZSkpLHU9cC5jb21tZW50LHY9ZS50cmFuc2Zvcm1UbyhcInN0cmluZ1wiLG0odSkpLHc9ZS50cmFuc2Zvcm1UbyhcInN0cmluZ1wiLGcudXRmOGVuY29kZSh1KSkseD10Lmxlbmd0aCE9PXAubmFtZS5sZW5ndGgseT13Lmxlbmd0aCE9PXUubGVuZ3RoLHo9XCJcIixBPVwiXCIsQj1cIlwiLEM9cC5kaXIsRD1wLmRhdGUsRT17Y3JjMzI6MCxjb21wcmVzc2VkU2l6ZTowLHVuY29tcHJlc3NlZFNpemU6MH07YiYmIWN8fChFLmNyYzMyPWEuY3JjMzIsRS5jb21wcmVzc2VkU2l6ZT1hLmNvbXByZXNzZWRTaXplLEUudW5jb21wcmVzc2VkU2l6ZT1hLnVuY29tcHJlc3NlZFNpemUpO3ZhciBGPTA7YiYmKEZ8PTgpLHJ8fCF4JiYheXx8KEZ8PTIwNDgpO3ZhciBHPTAsSD0wO0MmJihHfD0xNiksXCJVTklYXCI9PT1mPyhIPTc5OCxHfD1rKHAudW5peFBlcm1pc3Npb25zLEMpKTooSD0yMCxHfD1sKHAuZG9zUGVybWlzc2lvbnMsQykpLG49RC5nZXRVVENIb3VycygpLG48PD02LG58PUQuZ2V0VVRDTWludXRlcygpLG48PD01LG58PUQuZ2V0VVRDU2Vjb25kcygpLzIsbz1ELmdldFVUQ0Z1bGxZZWFyKCktMTk4MCxvPDw9NCxvfD1ELmdldFVUQ01vbnRoKCkrMSxvPDw9NSxvfD1ELmdldFVUQ0RhdGUoKSx4JiYoQT1qKDEsMSkraihoKHMpLDQpK3Qseis9XCJ1cFwiK2ooQS5sZW5ndGgsMikrQSkseSYmKEI9aigxLDEpK2ooaCh2KSw0KSt3LHorPVwidWNcIitqKEIubGVuZ3RoLDIpK0IpO3ZhciBJPVwiXCI7SSs9XCJcXG5cXDBcIixJKz1qKEYsMiksSSs9cS5tYWdpYyxJKz1qKG4sMiksSSs9aihvLDIpLEkrPWooRS5jcmMzMiw0KSxJKz1qKEUuY29tcHJlc3NlZFNpemUsNCksSSs9aihFLnVuY29tcHJlc3NlZFNpemUsNCksSSs9aihzLmxlbmd0aCwyKSxJKz1qKHoubGVuZ3RoLDIpO3ZhciBKPWkuTE9DQUxfRklMRV9IRUFERVIrSStzK3osSz1pLkNFTlRSQUxfRklMRV9IRUFERVIraihILDIpK0kraih2Lmxlbmd0aCwyKStcIlxcMFxcMFxcMFxcMFwiK2ooRyw0KStqKGQsNCkrcyt6K3Y7cmV0dXJue2ZpbGVSZWNvcmQ6SixkaXJSZWNvcmQ6S319LG49ZnVuY3Rpb24oYSxiLGMsZCxmKXt2YXIgZz1cIlwiLGg9ZS50cmFuc2Zvcm1UbyhcInN0cmluZ1wiLGYoZCkpO3JldHVybiBnPWkuQ0VOVFJBTF9ESVJFQ1RPUllfRU5EK1wiXFwwXFwwXFwwXFwwXCIraihhLDIpK2ooYSwyKStqKGIsNCkraihjLDQpK2ooaC5sZW5ndGgsMikraH0sbz1mdW5jdGlvbihhKXt2YXIgYj1cIlwiO3JldHVybiBiPWkuREFUQV9ERVNDUklQVE9SK2ooYS5jcmMzMiw0KStqKGEuY29tcHJlc3NlZFNpemUsNCkraihhLnVuY29tcHJlc3NlZFNpemUsNCl9O2UuaW5oZXJpdHMoZCxmKSxkLnByb3RvdHlwZS5wdXNoPWZ1bmN0aW9uKGEpe3ZhciBiPWEubWV0YS5wZXJjZW50fHwwLGM9dGhpcy5lbnRyaWVzQ291bnQsZD10aGlzLl9zb3VyY2VzLmxlbmd0aDt0aGlzLmFjY3VtdWxhdGU/dGhpcy5jb250ZW50QnVmZmVyLnB1c2goYSk6KHRoaXMuYnl0ZXNXcml0dGVuKz1hLmRhdGEubGVuZ3RoLGYucHJvdG90eXBlLnB1c2guY2FsbCh0aGlzLHtkYXRhOmEuZGF0YSxtZXRhOntjdXJyZW50RmlsZTp0aGlzLmN1cnJlbnRGaWxlLHBlcmNlbnQ6Yz8oYisxMDAqKGMtZC0xKSkvYzoxMDB9fSkpfSxkLnByb3RvdHlwZS5vcGVuZWRTb3VyY2U9ZnVuY3Rpb24oYSl7dGhpcy5jdXJyZW50U291cmNlT2Zmc2V0PXRoaXMuYnl0ZXNXcml0dGVuLHRoaXMuY3VycmVudEZpbGU9YS5maWxlLm5hbWU7dmFyIGI9dGhpcy5zdHJlYW1GaWxlcyYmIWEuZmlsZS5kaXI7aWYoYil7dmFyIGM9bShhLGIsITEsdGhpcy5jdXJyZW50U291cmNlT2Zmc2V0LHRoaXMuemlwUGxhdGZvcm0sdGhpcy5lbmNvZGVGaWxlTmFtZSk7dGhpcy5wdXNoKHtkYXRhOmMuZmlsZVJlY29yZCxtZXRhOntwZXJjZW50OjB9fSl9ZWxzZSB0aGlzLmFjY3VtdWxhdGU9ITB9LGQucHJvdG90eXBlLmNsb3NlZFNvdXJjZT1mdW5jdGlvbihhKXt0aGlzLmFjY3VtdWxhdGU9ITE7dmFyIGI9dGhpcy5zdHJlYW1GaWxlcyYmIWEuZmlsZS5kaXIsYz1tKGEsYiwhMCx0aGlzLmN1cnJlbnRTb3VyY2VPZmZzZXQsdGhpcy56aXBQbGF0Zm9ybSx0aGlzLmVuY29kZUZpbGVOYW1lKTtpZih0aGlzLmRpclJlY29yZHMucHVzaChjLmRpclJlY29yZCksYil0aGlzLnB1c2goe2RhdGE6byhhKSxtZXRhOntwZXJjZW50OjEwMH19KTtlbHNlIGZvcih0aGlzLnB1c2goe2RhdGE6Yy5maWxlUmVjb3JkLG1ldGE6e3BlcmNlbnQ6MH19KTt0aGlzLmNvbnRlbnRCdWZmZXIubGVuZ3RoOyl0aGlzLnB1c2godGhpcy5jb250ZW50QnVmZmVyLnNoaWZ0KCkpO3RoaXMuY3VycmVudEZpbGU9bnVsbH0sZC5wcm90b3R5cGUuZmx1c2g9ZnVuY3Rpb24oKXtmb3IodmFyIGE9dGhpcy5ieXRlc1dyaXR0ZW4sYj0wO2I8dGhpcy5kaXJSZWNvcmRzLmxlbmd0aDtiKyspdGhpcy5wdXNoKHtkYXRhOnRoaXMuZGlyUmVjb3Jkc1tiXSxtZXRhOntwZXJjZW50OjEwMH19KTt2YXIgYz10aGlzLmJ5dGVzV3JpdHRlbi1hLGQ9bih0aGlzLmRpclJlY29yZHMubGVuZ3RoLGMsYSx0aGlzLnppcENvbW1lbnQsdGhpcy5lbmNvZGVGaWxlTmFtZSk7dGhpcy5wdXNoKHtkYXRhOmQsbWV0YTp7cGVyY2VudDoxMDB9fSl9LGQucHJvdG90eXBlLnByZXBhcmVOZXh0U291cmNlPWZ1bmN0aW9uKCl7dGhpcy5wcmV2aW91cz10aGlzLl9zb3VyY2VzLnNoaWZ0KCksdGhpcy5vcGVuZWRTb3VyY2UodGhpcy5wcmV2aW91cy5zdHJlYW1JbmZvKSx0aGlzLmlzUGF1c2VkP3RoaXMucHJldmlvdXMucGF1c2UoKTp0aGlzLnByZXZpb3VzLnJlc3VtZSgpfSxkLnByb3RvdHlwZS5yZWdpc3RlclByZXZpb3VzPWZ1bmN0aW9uKGEpe3RoaXMuX3NvdXJjZXMucHVzaChhKTt2YXIgYj10aGlzO3JldHVybiBhLm9uKFwiZGF0YVwiLGZ1bmN0aW9uKGEpe2IucHJvY2Vzc0NodW5rKGEpfSksYS5vbihcImVuZFwiLGZ1bmN0aW9uKCl7Yi5jbG9zZWRTb3VyY2UoYi5wcmV2aW91cy5zdHJlYW1JbmZvKSxiLl9zb3VyY2VzLmxlbmd0aD9iLnByZXBhcmVOZXh0U291cmNlKCk6Yi5lbmQoKX0pLGEub24oXCJlcnJvclwiLGZ1bmN0aW9uKGEpe2IuZXJyb3IoYSl9KSx0aGlzfSxkLnByb3RvdHlwZS5yZXN1bWU9ZnVuY3Rpb24oKXtyZXR1cm4hIWYucHJvdG90eXBlLnJlc3VtZS5jYWxsKHRoaXMpJiYoIXRoaXMucHJldmlvdXMmJnRoaXMuX3NvdXJjZXMubGVuZ3RoPyh0aGlzLnByZXBhcmVOZXh0U291cmNlKCksITApOnRoaXMucHJldmlvdXN8fHRoaXMuX3NvdXJjZXMubGVuZ3RofHx0aGlzLmdlbmVyYXRlZEVycm9yP3ZvaWQgMDoodGhpcy5lbmQoKSwhMCkpfSxkLnByb3RvdHlwZS5lcnJvcj1mdW5jdGlvbihhKXt2YXIgYj10aGlzLl9zb3VyY2VzO2lmKCFmLnByb3RvdHlwZS5lcnJvci5jYWxsKHRoaXMsYSkpcmV0dXJuITE7Zm9yKHZhciBjPTA7YzxiLmxlbmd0aDtjKyspdHJ5e2JbY10uZXJyb3IoYSl9Y2F0Y2goYSl7fXJldHVybiEwfSxkLnByb3RvdHlwZS5sb2NrPWZ1bmN0aW9uKCl7Zi5wcm90b3R5cGUubG9jay5jYWxsKHRoaXMpO2Zvcih2YXIgYT10aGlzLl9zb3VyY2VzLGI9MDtiPGEubGVuZ3RoO2IrKylhW2JdLmxvY2soKX0sYi5leHBvcnRzPWR9LHtcIi4uL2NyYzMyXCI6NCxcIi4uL3NpZ25hdHVyZVwiOjIzLFwiLi4vc3RyZWFtL0dlbmVyaWNXb3JrZXJcIjoyOCxcIi4uL3V0ZjhcIjozMSxcIi4uL3V0aWxzXCI6MzJ9XSw5OltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7dmFyIGQ9YShcIi4uL2NvbXByZXNzaW9uc1wiKSxlPWEoXCIuL1ppcEZpbGVXb3JrZXJcIiksZj1mdW5jdGlvbihhLGIpe3ZhciBjPWF8fGIsZT1kW2NdO2lmKCFlKXRocm93IG5ldyBFcnJvcihjK1wiIGlzIG5vdCBhIHZhbGlkIGNvbXByZXNzaW9uIG1ldGhvZCAhXCIpO3JldHVybiBlfTtjLmdlbmVyYXRlV29ya2VyPWZ1bmN0aW9uKGEsYixjKXt2YXIgZD1uZXcgZShiLnN0cmVhbUZpbGVzLGMsYi5wbGF0Zm9ybSxiLmVuY29kZUZpbGVOYW1lKSxnPTA7dHJ5e2EuZm9yRWFjaChmdW5jdGlvbihhLGMpe2crKzt2YXIgZT1mKGMub3B0aW9ucy5jb21wcmVzc2lvbixiLmNvbXByZXNzaW9uKSxoPWMub3B0aW9ucy5jb21wcmVzc2lvbk9wdGlvbnN8fGIuY29tcHJlc3Npb25PcHRpb25zfHx7fSxpPWMuZGlyLGo9Yy5kYXRlO2MuX2NvbXByZXNzV29ya2VyKGUsaCkud2l0aFN0cmVhbUluZm8oXCJmaWxlXCIse25hbWU6YSxkaXI6aSxkYXRlOmosY29tbWVudDpjLmNvbW1lbnR8fFwiXCIsdW5peFBlcm1pc3Npb25zOmMudW5peFBlcm1pc3Npb25zLGRvc1Blcm1pc3Npb25zOmMuZG9zUGVybWlzc2lvbnN9KS5waXBlKGQpfSksZC5lbnRyaWVzQ291bnQ9Z31jYXRjaChoKXtkLmVycm9yKGgpfXJldHVybiBkfX0se1wiLi4vY29tcHJlc3Npb25zXCI6MyxcIi4vWmlwRmlsZVdvcmtlclwiOjh9XSwxMDpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoKXtpZighKHRoaXMgaW5zdGFuY2VvZiBkKSlyZXR1cm4gbmV3IGQ7aWYoYXJndW1lbnRzLmxlbmd0aCl0aHJvdyBuZXcgRXJyb3IoXCJUaGUgY29uc3RydWN0b3Igd2l0aCBwYXJhbWV0ZXJzIGhhcyBiZWVuIHJlbW92ZWQgaW4gSlNaaXAgMy4wLCBwbGVhc2UgY2hlY2sgdGhlIHVwZ3JhZGUgZ3VpZGUuXCIpO3RoaXMuZmlsZXM9e30sdGhpcy5jb21tZW50PW51bGwsdGhpcy5yb290PVwiXCIsdGhpcy5jbG9uZT1mdW5jdGlvbigpe3ZhciBhPW5ldyBkO2Zvcih2YXIgYiBpbiB0aGlzKVwiZnVuY3Rpb25cIiE9dHlwZW9mIHRoaXNbYl0mJihhW2JdPXRoaXNbYl0pO3JldHVybiBhfX1kLnByb3RvdHlwZT1hKFwiLi9vYmplY3RcIiksZC5wcm90b3R5cGUubG9hZEFzeW5jPWEoXCIuL2xvYWRcIiksZC5zdXBwb3J0PWEoXCIuL3N1cHBvcnRcIiksZC5kZWZhdWx0cz1hKFwiLi9kZWZhdWx0c1wiKSxkLnZlcnNpb249XCIzLjEuNVwiLGQubG9hZEFzeW5jPWZ1bmN0aW9uKGEsYil7cmV0dXJuKG5ldyBkKS5sb2FkQXN5bmMoYSxiKX0sZC5leHRlcm5hbD1hKFwiLi9leHRlcm5hbFwiKSxiLmV4cG9ydHM9ZH0se1wiLi9kZWZhdWx0c1wiOjUsXCIuL2V4dGVybmFsXCI6NixcIi4vbG9hZFwiOjExLFwiLi9vYmplY3RcIjoxNSxcIi4vc3VwcG9ydFwiOjMwfV0sMTE6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBkKGEpe3JldHVybiBuZXcgZi5Qcm9taXNlKGZ1bmN0aW9uKGIsYyl7dmFyIGQ9YS5kZWNvbXByZXNzZWQuZ2V0Q29udGVudFdvcmtlcigpLnBpcGUobmV3IGkpO2Qub24oXCJlcnJvclwiLGZ1bmN0aW9uKGEpe2MoYSl9KS5vbihcImVuZFwiLGZ1bmN0aW9uKCl7ZC5zdHJlYW1JbmZvLmNyYzMyIT09YS5kZWNvbXByZXNzZWQuY3JjMzI/YyhuZXcgRXJyb3IoXCJDb3JydXB0ZWQgemlwIDogQ1JDMzIgbWlzbWF0Y2hcIikpOmIoKX0pLnJlc3VtZSgpfSl9dmFyIGU9YShcIi4vdXRpbHNcIiksZj1hKFwiLi9leHRlcm5hbFwiKSxnPWEoXCIuL3V0ZjhcIiksZT1hKFwiLi91dGlsc1wiKSxoPWEoXCIuL3ppcEVudHJpZXNcIiksaT1hKFwiLi9zdHJlYW0vQ3JjMzJQcm9iZVwiKSxqPWEoXCIuL25vZGVqc1V0aWxzXCIpO2IuZXhwb3J0cz1mdW5jdGlvbihhLGIpe3ZhciBjPXRoaXM7cmV0dXJuIGI9ZS5leHRlbmQoYnx8e30se2Jhc2U2NDohMSxjaGVja0NSQzMyOiExLG9wdGltaXplZEJpbmFyeVN0cmluZzohMSxjcmVhdGVGb2xkZXJzOiExLGRlY29kZUZpbGVOYW1lOmcudXRmOGRlY29kZX0pLGouaXNOb2RlJiZqLmlzU3RyZWFtKGEpP2YuUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiSlNaaXAgY2FuJ3QgYWNjZXB0IGEgc3RyZWFtIHdoZW4gbG9hZGluZyBhIHppcCBmaWxlLlwiKSk6ZS5wcmVwYXJlQ29udGVudChcInRoZSBsb2FkZWQgemlwIGZpbGVcIixhLCEwLGIub3B0aW1pemVkQmluYXJ5U3RyaW5nLGIuYmFzZTY0KS50aGVuKGZ1bmN0aW9uKGEpe3ZhciBjPW5ldyBoKGIpO3JldHVybiBjLmxvYWQoYSksY30pLnRoZW4oZnVuY3Rpb24oYSl7dmFyIGM9W2YuUHJvbWlzZS5yZXNvbHZlKGEpXSxlPWEuZmlsZXM7aWYoYi5jaGVja0NSQzMyKWZvcih2YXIgZz0wO2c8ZS5sZW5ndGg7ZysrKWMucHVzaChkKGVbZ10pKTtyZXR1cm4gZi5Qcm9taXNlLmFsbChjKX0pLnRoZW4oZnVuY3Rpb24oYSl7Zm9yKHZhciBkPWEuc2hpZnQoKSxlPWQuZmlsZXMsZj0wO2Y8ZS5sZW5ndGg7ZisrKXt2YXIgZz1lW2ZdO2MuZmlsZShnLmZpbGVOYW1lU3RyLGcuZGVjb21wcmVzc2VkLHtiaW5hcnk6ITAsb3B0aW1pemVkQmluYXJ5U3RyaW5nOiEwLGRhdGU6Zy5kYXRlLGRpcjpnLmRpcixjb21tZW50OmcuZmlsZUNvbW1lbnRTdHIubGVuZ3RoP2cuZmlsZUNvbW1lbnRTdHI6bnVsbCx1bml4UGVybWlzc2lvbnM6Zy51bml4UGVybWlzc2lvbnMsZG9zUGVybWlzc2lvbnM6Zy5kb3NQZXJtaXNzaW9ucyxjcmVhdGVGb2xkZXJzOmIuY3JlYXRlRm9sZGVyc30pfXJldHVybiBkLnppcENvbW1lbnQubGVuZ3RoJiYoYy5jb21tZW50PWQuemlwQ29tbWVudCksY30pfX0se1wiLi9leHRlcm5hbFwiOjYsXCIuL25vZGVqc1V0aWxzXCI6MTQsXCIuL3N0cmVhbS9DcmMzMlByb2JlXCI6MjUsXCIuL3V0ZjhcIjozMSxcIi4vdXRpbHNcIjozMixcIi4vemlwRW50cmllc1wiOjMzfV0sMTI6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBkKGEsYil7Zi5jYWxsKHRoaXMsXCJOb2RlanMgc3RyZWFtIGlucHV0IGFkYXB0ZXIgZm9yIFwiK2EpLHRoaXMuX3Vwc3RyZWFtRW5kZWQ9ITEsdGhpcy5fYmluZFN0cmVhbShiKX12YXIgZT1hKFwiLi4vdXRpbHNcIiksZj1hKFwiLi4vc3RyZWFtL0dlbmVyaWNXb3JrZXJcIik7ZS5pbmhlcml0cyhkLGYpLGQucHJvdG90eXBlLl9iaW5kU3RyZWFtPWZ1bmN0aW9uKGEpe3ZhciBiPXRoaXM7dGhpcy5fc3RyZWFtPWEsYS5wYXVzZSgpLGEub24oXCJkYXRhXCIsZnVuY3Rpb24oYSl7Yi5wdXNoKHtkYXRhOmEsbWV0YTp7cGVyY2VudDowfX0pfSkub24oXCJlcnJvclwiLGZ1bmN0aW9uKGEpe2IuaXNQYXVzZWQ/dGhpcy5nZW5lcmF0ZWRFcnJvcj1hOmIuZXJyb3IoYSl9KS5vbihcImVuZFwiLGZ1bmN0aW9uKCl7Yi5pc1BhdXNlZD9iLl91cHN0cmVhbUVuZGVkPSEwOmIuZW5kKCl9KX0sZC5wcm90b3R5cGUucGF1c2U9ZnVuY3Rpb24oKXtyZXR1cm4hIWYucHJvdG90eXBlLnBhdXNlLmNhbGwodGhpcykmJih0aGlzLl9zdHJlYW0ucGF1c2UoKSwhMCl9LGQucHJvdG90eXBlLnJlc3VtZT1mdW5jdGlvbigpe3JldHVybiEhZi5wcm90b3R5cGUucmVzdW1lLmNhbGwodGhpcykmJih0aGlzLl91cHN0cmVhbUVuZGVkP3RoaXMuZW5kKCk6dGhpcy5fc3RyZWFtLnJlc3VtZSgpLCEwKX0sYi5leHBvcnRzPWR9LHtcIi4uL3N0cmVhbS9HZW5lcmljV29ya2VyXCI6MjgsXCIuLi91dGlsc1wiOjMyfV0sMTM6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBkKGEsYixjKXtlLmNhbGwodGhpcyxiKSx0aGlzLl9oZWxwZXI9YTt2YXIgZD10aGlzO2Eub24oXCJkYXRhXCIsZnVuY3Rpb24oYSxiKXtkLnB1c2goYSl8fGQuX2hlbHBlci5wYXVzZSgpLGMmJmMoYil9KS5vbihcImVycm9yXCIsZnVuY3Rpb24oYSl7ZC5lbWl0KFwiZXJyb3JcIixhKX0pLm9uKFwiZW5kXCIsZnVuY3Rpb24oKXtkLnB1c2gobnVsbCl9KX12YXIgZT1hKFwicmVhZGFibGUtc3RyZWFtXCIpLlJlYWRhYmxlLGY9YShcIi4uL3V0aWxzXCIpO2YuaW5oZXJpdHMoZCxlKSxkLnByb3RvdHlwZS5fcmVhZD1mdW5jdGlvbigpe3RoaXMuX2hlbHBlci5yZXN1bWUoKX0sYi5leHBvcnRzPWR9LHtcIi4uL3V0aWxzXCI6MzIsXCJyZWFkYWJsZS1zdHJlYW1cIjoxNn1dLDE0OltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7Yi5leHBvcnRzPXtpc05vZGU6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIEJ1ZmZlcixuZXdCdWZmZXJGcm9tOmZ1bmN0aW9uKGEsYil7cmV0dXJuIG5ldyBCdWZmZXIoYSxiKX0sYWxsb2NCdWZmZXI6ZnVuY3Rpb24oYSl7cmV0dXJuIEJ1ZmZlci5hbGxvYz9CdWZmZXIuYWxsb2MoYSk6bmV3IEJ1ZmZlcihhKX0saXNCdWZmZXI6ZnVuY3Rpb24oYSl7cmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihhKX0saXNTdHJlYW06ZnVuY3Rpb24oYSl7cmV0dXJuIGEmJlwiZnVuY3Rpb25cIj09dHlwZW9mIGEub24mJlwiZnVuY3Rpb25cIj09dHlwZW9mIGEucGF1c2UmJlwiZnVuY3Rpb25cIj09dHlwZW9mIGEucmVzdW1lfX19LHt9XSwxNTpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoYSl7cmV0dXJuXCJbb2JqZWN0IFJlZ0V4cF1cIj09PU9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhKX12YXIgZT1hKFwiLi91dGY4XCIpLGY9YShcIi4vdXRpbHNcIiksZz1hKFwiLi9zdHJlYW0vR2VuZXJpY1dvcmtlclwiKSxoPWEoXCIuL3N0cmVhbS9TdHJlYW1IZWxwZXJcIiksaT1hKFwiLi9kZWZhdWx0c1wiKSxqPWEoXCIuL2NvbXByZXNzZWRPYmplY3RcIiksaz1hKFwiLi96aXBPYmplY3RcIiksbD1hKFwiLi9nZW5lcmF0ZVwiKSxtPWEoXCIuL25vZGVqc1V0aWxzXCIpLG49YShcIi4vbm9kZWpzL05vZGVqc1N0cmVhbUlucHV0QWRhcHRlclwiKSxvPWZ1bmN0aW9uKGEsYixjKXt2YXIgZCxlPWYuZ2V0VHlwZU9mKGIpLGg9Zi5leHRlbmQoY3x8e30saSk7aC5kYXRlPWguZGF0ZXx8bmV3IERhdGUsbnVsbCE9PWguY29tcHJlc3Npb24mJihoLmNvbXByZXNzaW9uPWguY29tcHJlc3Npb24udG9VcHBlckNhc2UoKSksXCJzdHJpbmdcIj09dHlwZW9mIGgudW5peFBlcm1pc3Npb25zJiYoaC51bml4UGVybWlzc2lvbnM9cGFyc2VJbnQoaC51bml4UGVybWlzc2lvbnMsOCkpLGgudW5peFBlcm1pc3Npb25zJiYxNjM4NCZoLnVuaXhQZXJtaXNzaW9ucyYmKGguZGlyPSEwKSxoLmRvc1Blcm1pc3Npb25zJiYxNiZoLmRvc1Blcm1pc3Npb25zJiYoaC5kaXI9ITApLGguZGlyJiYoYT1xKGEpKSxoLmNyZWF0ZUZvbGRlcnMmJihkPXAoYSkpJiZyLmNhbGwodGhpcyxkLCEwKTt2YXIgbD1cInN0cmluZ1wiPT09ZSYmaC5iaW5hcnk9PT0hMSYmaC5iYXNlNjQ9PT0hMTtjJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgYy5iaW5hcnl8fChoLmJpbmFyeT0hbCk7dmFyIG89YiBpbnN0YW5jZW9mIGomJjA9PT1iLnVuY29tcHJlc3NlZFNpemU7KG98fGguZGlyfHwhYnx8MD09PWIubGVuZ3RoKSYmKGguYmFzZTY0PSExLGguYmluYXJ5PSEwLGI9XCJcIixoLmNvbXByZXNzaW9uPVwiU1RPUkVcIixlPVwic3RyaW5nXCIpO3ZhciBzPW51bGw7cz1iIGluc3RhbmNlb2Yganx8YiBpbnN0YW5jZW9mIGc/YjptLmlzTm9kZSYmbS5pc1N0cmVhbShiKT9uZXcgbihhLGIpOmYucHJlcGFyZUNvbnRlbnQoYSxiLGguYmluYXJ5LGgub3B0aW1pemVkQmluYXJ5U3RyaW5nLGguYmFzZTY0KTt2YXIgdD1uZXcgayhhLHMsaCk7dGhpcy5maWxlc1thXT10fSxwPWZ1bmN0aW9uKGEpe1wiL1wiPT09YS5zbGljZSgtMSkmJihhPWEuc3Vic3RyaW5nKDAsYS5sZW5ndGgtMSkpO3ZhciBiPWEubGFzdEluZGV4T2YoXCIvXCIpO3JldHVybiBiPjA/YS5zdWJzdHJpbmcoMCxiKTpcIlwifSxxPWZ1bmN0aW9uKGEpe3JldHVyblwiL1wiIT09YS5zbGljZSgtMSkmJihhKz1cIi9cIiksYX0scj1mdW5jdGlvbihhLGIpe3JldHVybiBiPVwidW5kZWZpbmVkXCIhPXR5cGVvZiBiP2I6aS5jcmVhdGVGb2xkZXJzLGE9cShhKSx0aGlzLmZpbGVzW2FdfHxvLmNhbGwodGhpcyxhLG51bGwse2RpcjohMCxjcmVhdGVGb2xkZXJzOmJ9KSx0aGlzLmZpbGVzW2FdfSxzPXtsb2FkOmZ1bmN0aW9uKCl7dGhyb3cgbmV3IEVycm9yKFwiVGhpcyBtZXRob2QgaGFzIGJlZW4gcmVtb3ZlZCBpbiBKU1ppcCAzLjAsIHBsZWFzZSBjaGVjayB0aGUgdXBncmFkZSBndWlkZS5cIil9LGZvckVhY2g6ZnVuY3Rpb24oYSl7dmFyIGIsYyxkO2ZvcihiIGluIHRoaXMuZmlsZXMpdGhpcy5maWxlcy5oYXNPd25Qcm9wZXJ0eShiKSYmKGQ9dGhpcy5maWxlc1tiXSxjPWIuc2xpY2UodGhpcy5yb290Lmxlbmd0aCxiLmxlbmd0aCksYyYmYi5zbGljZSgwLHRoaXMucm9vdC5sZW5ndGgpPT09dGhpcy5yb290JiZhKGMsZCkpfSxmaWx0ZXI6ZnVuY3Rpb24oYSl7dmFyIGI9W107cmV0dXJuIHRoaXMuZm9yRWFjaChmdW5jdGlvbihjLGQpe2EoYyxkKSYmYi5wdXNoKGQpfSksYn0sZmlsZTpmdW5jdGlvbihhLGIsYyl7aWYoMT09PWFyZ3VtZW50cy5sZW5ndGgpe2lmKGQoYSkpe3ZhciBlPWE7cmV0dXJuIHRoaXMuZmlsdGVyKGZ1bmN0aW9uKGEsYil7cmV0dXJuIWIuZGlyJiZlLnRlc3QoYSl9KX12YXIgZj10aGlzLmZpbGVzW3RoaXMucm9vdCthXTtyZXR1cm4gZiYmIWYuZGlyP2Y6bnVsbH1yZXR1cm4gYT10aGlzLnJvb3QrYSxvLmNhbGwodGhpcyxhLGIsYyksdGhpc30sZm9sZGVyOmZ1bmN0aW9uKGEpe2lmKCFhKXJldHVybiB0aGlzO2lmKGQoYSkpcmV0dXJuIHRoaXMuZmlsdGVyKGZ1bmN0aW9uKGIsYyl7cmV0dXJuIGMuZGlyJiZhLnRlc3QoYil9KTt2YXIgYj10aGlzLnJvb3QrYSxjPXIuY2FsbCh0aGlzLGIpLGU9dGhpcy5jbG9uZSgpO3JldHVybiBlLnJvb3Q9Yy5uYW1lLGV9LHJlbW92ZTpmdW5jdGlvbihhKXthPXRoaXMucm9vdCthO3ZhciBiPXRoaXMuZmlsZXNbYV07aWYoYnx8KFwiL1wiIT09YS5zbGljZSgtMSkmJihhKz1cIi9cIiksYj10aGlzLmZpbGVzW2FdKSxiJiYhYi5kaXIpZGVsZXRlIHRoaXMuZmlsZXNbYV07ZWxzZSBmb3IodmFyIGM9dGhpcy5maWx0ZXIoZnVuY3Rpb24oYixjKXtyZXR1cm4gYy5uYW1lLnNsaWNlKDAsYS5sZW5ndGgpPT09YX0pLGQ9MDtkPGMubGVuZ3RoO2QrKylkZWxldGUgdGhpcy5maWxlc1tjW2RdLm5hbWVdO3JldHVybiB0aGlzfSxnZW5lcmF0ZTpmdW5jdGlvbihhKXt0aHJvdyBuZXcgRXJyb3IoXCJUaGlzIG1ldGhvZCBoYXMgYmVlbiByZW1vdmVkIGluIEpTWmlwIDMuMCwgcGxlYXNlIGNoZWNrIHRoZSB1cGdyYWRlIGd1aWRlLlwiKX0sZ2VuZXJhdGVJbnRlcm5hbFN0cmVhbTpmdW5jdGlvbihhKXt2YXIgYixjPXt9O3RyeXtpZihjPWYuZXh0ZW5kKGF8fHt9LHtzdHJlYW1GaWxlczohMSxjb21wcmVzc2lvbjpcIlNUT1JFXCIsY29tcHJlc3Npb25PcHRpb25zOm51bGwsdHlwZTpcIlwiLHBsYXRmb3JtOlwiRE9TXCIsY29tbWVudDpudWxsLG1pbWVUeXBlOlwiYXBwbGljYXRpb24vemlwXCIsZW5jb2RlRmlsZU5hbWU6ZS51dGY4ZW5jb2RlfSksYy50eXBlPWMudHlwZS50b0xvd2VyQ2FzZSgpLGMuY29tcHJlc3Npb249Yy5jb21wcmVzc2lvbi50b1VwcGVyQ2FzZSgpLFwiYmluYXJ5c3RyaW5nXCI9PT1jLnR5cGUmJihjLnR5cGU9XCJzdHJpbmdcIiksIWMudHlwZSl0aHJvdyBuZXcgRXJyb3IoXCJObyBvdXRwdXQgdHlwZSBzcGVjaWZpZWQuXCIpO2YuY2hlY2tTdXBwb3J0KGMudHlwZSksXCJkYXJ3aW5cIiE9PWMucGxhdGZvcm0mJlwiZnJlZWJzZFwiIT09Yy5wbGF0Zm9ybSYmXCJsaW51eFwiIT09Yy5wbGF0Zm9ybSYmXCJzdW5vc1wiIT09Yy5wbGF0Zm9ybXx8KGMucGxhdGZvcm09XCJVTklYXCIpLFwid2luMzJcIj09PWMucGxhdGZvcm0mJihjLnBsYXRmb3JtPVwiRE9TXCIpO3ZhciBkPWMuY29tbWVudHx8dGhpcy5jb21tZW50fHxcIlwiO2I9bC5nZW5lcmF0ZVdvcmtlcih0aGlzLGMsZCl9Y2F0Y2goaSl7Yj1uZXcgZyhcImVycm9yXCIpLGIuZXJyb3IoaSl9cmV0dXJuIG5ldyBoKGIsYy50eXBlfHxcInN0cmluZ1wiLGMubWltZVR5cGUpfSxnZW5lcmF0ZUFzeW5jOmZ1bmN0aW9uKGEsYil7cmV0dXJuIHRoaXMuZ2VuZXJhdGVJbnRlcm5hbFN0cmVhbShhKS5hY2N1bXVsYXRlKGIpfSxnZW5lcmF0ZU5vZGVTdHJlYW06ZnVuY3Rpb24oYSxiKXtyZXR1cm4gYT1hfHx7fSxhLnR5cGV8fChhLnR5cGU9XCJub2RlYnVmZmVyXCIpLHRoaXMuZ2VuZXJhdGVJbnRlcm5hbFN0cmVhbShhKS50b05vZGVqc1N0cmVhbShiKX19O2IuZXhwb3J0cz1zfSx7XCIuL2NvbXByZXNzZWRPYmplY3RcIjoyLFwiLi9kZWZhdWx0c1wiOjUsXCIuL2dlbmVyYXRlXCI6OSxcIi4vbm9kZWpzL05vZGVqc1N0cmVhbUlucHV0QWRhcHRlclwiOjEyLFwiLi9ub2RlanNVdGlsc1wiOjE0LFwiLi9zdHJlYW0vR2VuZXJpY1dvcmtlclwiOjI4LFwiLi9zdHJlYW0vU3RyZWFtSGVscGVyXCI6MjksXCIuL3V0ZjhcIjozMSxcIi4vdXRpbHNcIjozMixcIi4vemlwT2JqZWN0XCI6MzV9XSwxNjpbZnVuY3Rpb24oYSxiLGMpe2IuZXhwb3J0cz1hKFwic3RyZWFtXCIpfSx7c3RyZWFtOnZvaWQgMH1dLDE3OltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhKXtlLmNhbGwodGhpcyxhKTtmb3IodmFyIGI9MDtiPHRoaXMuZGF0YS5sZW5ndGg7YisrKWFbYl09MjU1JmFbYl19dmFyIGU9YShcIi4vRGF0YVJlYWRlclwiKSxmPWEoXCIuLi91dGlsc1wiKTtmLmluaGVyaXRzKGQsZSksZC5wcm90b3R5cGUuYnl0ZUF0PWZ1bmN0aW9uKGEpe3JldHVybiB0aGlzLmRhdGFbdGhpcy56ZXJvK2FdfSxkLnByb3RvdHlwZS5sYXN0SW5kZXhPZlNpZ25hdHVyZT1mdW5jdGlvbihhKXtmb3IodmFyIGI9YS5jaGFyQ29kZUF0KDApLGM9YS5jaGFyQ29kZUF0KDEpLGQ9YS5jaGFyQ29kZUF0KDIpLGU9YS5jaGFyQ29kZUF0KDMpLGY9dGhpcy5sZW5ndGgtNDtmPj0wOy0tZilpZih0aGlzLmRhdGFbZl09PT1iJiZ0aGlzLmRhdGFbZisxXT09PWMmJnRoaXMuZGF0YVtmKzJdPT09ZCYmdGhpcy5kYXRhW2YrM109PT1lKXJldHVybiBmLXRoaXMuemVybztyZXR1cm4tMX0sZC5wcm90b3R5cGUucmVhZEFuZENoZWNrU2lnbmF0dXJlPWZ1bmN0aW9uKGEpe3ZhciBiPWEuY2hhckNvZGVBdCgwKSxjPWEuY2hhckNvZGVBdCgxKSxkPWEuY2hhckNvZGVBdCgyKSxlPWEuY2hhckNvZGVBdCgzKSxmPXRoaXMucmVhZERhdGEoNCk7cmV0dXJuIGI9PT1mWzBdJiZjPT09ZlsxXSYmZD09PWZbMl0mJmU9PT1mWzNdfSxkLnByb3RvdHlwZS5yZWFkRGF0YT1mdW5jdGlvbihhKXtpZih0aGlzLmNoZWNrT2Zmc2V0KGEpLDA9PT1hKXJldHVybltdO3ZhciBiPXRoaXMuZGF0YS5zbGljZSh0aGlzLnplcm8rdGhpcy5pbmRleCx0aGlzLnplcm8rdGhpcy5pbmRleCthKTtyZXR1cm4gdGhpcy5pbmRleCs9YSxifSxiLmV4cG9ydHM9ZH0se1wiLi4vdXRpbHNcIjozMixcIi4vRGF0YVJlYWRlclwiOjE4fV0sMTg6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBkKGEpe3RoaXMuZGF0YT1hLHRoaXMubGVuZ3RoPWEubGVuZ3RoLHRoaXMuaW5kZXg9MCx0aGlzLnplcm89MH12YXIgZT1hKFwiLi4vdXRpbHNcIik7ZC5wcm90b3R5cGU9e2NoZWNrT2Zmc2V0OmZ1bmN0aW9uKGEpe3RoaXMuY2hlY2tJbmRleCh0aGlzLmluZGV4K2EpfSxjaGVja0luZGV4OmZ1bmN0aW9uKGEpe2lmKHRoaXMubGVuZ3RoPHRoaXMuemVybythfHxhPDApdGhyb3cgbmV3IEVycm9yKFwiRW5kIG9mIGRhdGEgcmVhY2hlZCAoZGF0YSBsZW5ndGggPSBcIit0aGlzLmxlbmd0aCtcIiwgYXNrZWQgaW5kZXggPSBcIithK1wiKS4gQ29ycnVwdGVkIHppcCA/XCIpfSxzZXRJbmRleDpmdW5jdGlvbihhKXt0aGlzLmNoZWNrSW5kZXgoYSksdGhpcy5pbmRleD1hfSxza2lwOmZ1bmN0aW9uKGEpe3RoaXMuc2V0SW5kZXgodGhpcy5pbmRleCthKX0sYnl0ZUF0OmZ1bmN0aW9uKGEpe30scmVhZEludDpmdW5jdGlvbihhKXt2YXIgYixjPTA7Zm9yKHRoaXMuY2hlY2tPZmZzZXQoYSksYj10aGlzLmluZGV4K2EtMTtiPj10aGlzLmluZGV4O2ItLSljPShjPDw4KSt0aGlzLmJ5dGVBdChiKTtyZXR1cm4gdGhpcy5pbmRleCs9YSxjfSxyZWFkU3RyaW5nOmZ1bmN0aW9uKGEpe3JldHVybiBlLnRyYW5zZm9ybVRvKFwic3RyaW5nXCIsdGhpcy5yZWFkRGF0YShhKSl9LHJlYWREYXRhOmZ1bmN0aW9uKGEpe30sbGFzdEluZGV4T2ZTaWduYXR1cmU6ZnVuY3Rpb24oYSl7fSxyZWFkQW5kQ2hlY2tTaWduYXR1cmU6ZnVuY3Rpb24oYSl7fSxyZWFkRGF0ZTpmdW5jdGlvbigpe3ZhciBhPXRoaXMucmVhZEludCg0KTtyZXR1cm4gbmV3IERhdGUoRGF0ZS5VVEMoKGE+PjI1JjEyNykrMTk4MCwoYT4+MjEmMTUpLTEsYT4+MTYmMzEsYT4+MTEmMzEsYT4+NSY2MywoMzEmYSk8PDEpKX19LGIuZXhwb3J0cz1kfSx7XCIuLi91dGlsc1wiOjMyfV0sMTk6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBkKGEpe2UuY2FsbCh0aGlzLGEpfXZhciBlPWEoXCIuL1VpbnQ4QXJyYXlSZWFkZXJcIiksZj1hKFwiLi4vdXRpbHNcIik7Zi5pbmhlcml0cyhkLGUpLGQucHJvdG90eXBlLnJlYWREYXRhPWZ1bmN0aW9uKGEpe3RoaXMuY2hlY2tPZmZzZXQoYSk7dmFyIGI9dGhpcy5kYXRhLnNsaWNlKHRoaXMuemVybyt0aGlzLmluZGV4LHRoaXMuemVybyt0aGlzLmluZGV4K2EpO3JldHVybiB0aGlzLmluZGV4Kz1hLGJ9LGIuZXhwb3J0cz1kfSx7XCIuLi91dGlsc1wiOjMyLFwiLi9VaW50OEFycmF5UmVhZGVyXCI6MjF9XSwyMDpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoYSl7ZS5jYWxsKHRoaXMsYSl9dmFyIGU9YShcIi4vRGF0YVJlYWRlclwiKSxmPWEoXCIuLi91dGlsc1wiKTtmLmluaGVyaXRzKGQsZSksZC5wcm90b3R5cGUuYnl0ZUF0PWZ1bmN0aW9uKGEpe3JldHVybiB0aGlzLmRhdGEuY2hhckNvZGVBdCh0aGlzLnplcm8rYSl9LGQucHJvdG90eXBlLmxhc3RJbmRleE9mU2lnbmF0dXJlPWZ1bmN0aW9uKGEpe3JldHVybiB0aGlzLmRhdGEubGFzdEluZGV4T2YoYSktdGhpcy56ZXJvfSxkLnByb3RvdHlwZS5yZWFkQW5kQ2hlY2tTaWduYXR1cmU9ZnVuY3Rpb24oYSl7dmFyIGI9dGhpcy5yZWFkRGF0YSg0KTtyZXR1cm4gYT09PWJ9LGQucHJvdG90eXBlLnJlYWREYXRhPWZ1bmN0aW9uKGEpe3RoaXMuY2hlY2tPZmZzZXQoYSk7dmFyIGI9dGhpcy5kYXRhLnNsaWNlKHRoaXMuemVybyt0aGlzLmluZGV4LHRoaXMuemVybyt0aGlzLmluZGV4K2EpO3JldHVybiB0aGlzLmluZGV4Kz1hLGJ9LGIuZXhwb3J0cz1kfSx7XCIuLi91dGlsc1wiOjMyLFwiLi9EYXRhUmVhZGVyXCI6MTh9XSwyMTpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoYSl7ZS5jYWxsKHRoaXMsYSl9dmFyIGU9YShcIi4vQXJyYXlSZWFkZXJcIiksZj1hKFwiLi4vdXRpbHNcIik7Zi5pbmhlcml0cyhkLGUpLGQucHJvdG90eXBlLnJlYWREYXRhPWZ1bmN0aW9uKGEpe2lmKHRoaXMuY2hlY2tPZmZzZXQoYSksMD09PWEpcmV0dXJuIG5ldyBVaW50OEFycmF5KDApO3ZhciBiPXRoaXMuZGF0YS5zdWJhcnJheSh0aGlzLnplcm8rdGhpcy5pbmRleCx0aGlzLnplcm8rdGhpcy5pbmRleCthKTtyZXR1cm4gdGhpcy5pbmRleCs9YSxifSxiLmV4cG9ydHM9ZH0se1wiLi4vdXRpbHNcIjozMixcIi4vQXJyYXlSZWFkZXJcIjoxN31dLDIyOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7dmFyIGQ9YShcIi4uL3V0aWxzXCIpLGU9YShcIi4uL3N1cHBvcnRcIiksZj1hKFwiLi9BcnJheVJlYWRlclwiKSxnPWEoXCIuL1N0cmluZ1JlYWRlclwiKSxoPWEoXCIuL05vZGVCdWZmZXJSZWFkZXJcIiksaT1hKFwiLi9VaW50OEFycmF5UmVhZGVyXCIpO2IuZXhwb3J0cz1mdW5jdGlvbihhKXt2YXIgYj1kLmdldFR5cGVPZihhKTtyZXR1cm4gZC5jaGVja1N1cHBvcnQoYiksXCJzdHJpbmdcIiE9PWJ8fGUudWludDhhcnJheT9cIm5vZGVidWZmZXJcIj09PWI/bmV3IGgoYSk6ZS51aW50OGFycmF5P25ldyBpKGQudHJhbnNmb3JtVG8oXCJ1aW50OGFycmF5XCIsYSkpOm5ldyBmKGQudHJhbnNmb3JtVG8oXCJhcnJheVwiLGEpKTpuZXcgZyhhKX19LHtcIi4uL3N1cHBvcnRcIjozMCxcIi4uL3V0aWxzXCI6MzIsXCIuL0FycmF5UmVhZGVyXCI6MTcsXCIuL05vZGVCdWZmZXJSZWFkZXJcIjoxOSxcIi4vU3RyaW5nUmVhZGVyXCI6MjAsXCIuL1VpbnQ4QXJyYXlSZWFkZXJcIjoyMX1dLDIzOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7Yy5MT0NBTF9GSUxFX0hFQURFUj1cIlBLXHUwMDAzXHUwMDA0XCIsYy5DRU5UUkFMX0ZJTEVfSEVBREVSPVwiUEtcdTAwMDFcdTAwMDJcIixjLkNFTlRSQUxfRElSRUNUT1JZX0VORD1cIlBLXHUwMDA1XHUwMDA2XCIsYy5aSVA2NF9DRU5UUkFMX0RJUkVDVE9SWV9MT0NBVE9SPVwiUEtcdTAwMDZcdTAwMDdcIixjLlpJUDY0X0NFTlRSQUxfRElSRUNUT1JZX0VORD1cIlBLXHUwMDA2XHUwMDA2XCIsYy5EQVRBX0RFU0NSSVBUT1I9XCJQS1x1MDAwN1xcYlwifSx7fV0sMjQ6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBkKGEpe2UuY2FsbCh0aGlzLFwiQ29udmVydFdvcmtlciB0byBcIithKSx0aGlzLmRlc3RUeXBlPWF9dmFyIGU9YShcIi4vR2VuZXJpY1dvcmtlclwiKSxmPWEoXCIuLi91dGlsc1wiKTtmLmluaGVyaXRzKGQsZSksZC5wcm90b3R5cGUucHJvY2Vzc0NodW5rPWZ1bmN0aW9uKGEpe3RoaXMucHVzaCh7ZGF0YTpmLnRyYW5zZm9ybVRvKHRoaXMuZGVzdFR5cGUsYS5kYXRhKSxtZXRhOmEubWV0YX0pfSxiLmV4cG9ydHM9ZH0se1wiLi4vdXRpbHNcIjozMixcIi4vR2VuZXJpY1dvcmtlclwiOjI4fV0sMjU6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBkKCl7ZS5jYWxsKHRoaXMsXCJDcmMzMlByb2JlXCIpLHRoaXMud2l0aFN0cmVhbUluZm8oXCJjcmMzMlwiLDApfXZhciBlPWEoXCIuL0dlbmVyaWNXb3JrZXJcIiksZj1hKFwiLi4vY3JjMzJcIiksZz1hKFwiLi4vdXRpbHNcIik7Zy5pbmhlcml0cyhkLGUpLGQucHJvdG90eXBlLnByb2Nlc3NDaHVuaz1mdW5jdGlvbihhKXt0aGlzLnN0cmVhbUluZm8uY3JjMzI9ZihhLmRhdGEsdGhpcy5zdHJlYW1JbmZvLmNyYzMyfHwwKSx0aGlzLnB1c2goYSl9LGIuZXhwb3J0cz1kfSx7XCIuLi9jcmMzMlwiOjQsXCIuLi91dGlsc1wiOjMyLFwiLi9HZW5lcmljV29ya2VyXCI6Mjh9XSwyNjpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoYSl7Zi5jYWxsKHRoaXMsXCJEYXRhTGVuZ3RoUHJvYmUgZm9yIFwiK2EpLHRoaXMucHJvcE5hbWU9YSx0aGlzLndpdGhTdHJlYW1JbmZvKGEsMCl9dmFyIGU9YShcIi4uL3V0aWxzXCIpLGY9YShcIi4vR2VuZXJpY1dvcmtlclwiKTtlLmluaGVyaXRzKGQsZiksZC5wcm90b3R5cGUucHJvY2Vzc0NodW5rPWZ1bmN0aW9uKGEpe2lmKGEpe3ZhciBiPXRoaXMuc3RyZWFtSW5mb1t0aGlzLnByb3BOYW1lXXx8MDt0aGlzLnN0cmVhbUluZm9bdGhpcy5wcm9wTmFtZV09YithLmRhdGEubGVuZ3RofWYucHJvdG90eXBlLnByb2Nlc3NDaHVuay5jYWxsKHRoaXMsYSl9LGIuZXhwb3J0cz1kfSx7XCIuLi91dGlsc1wiOjMyLFwiLi9HZW5lcmljV29ya2VyXCI6Mjh9XSwyNzpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoYSl7Zi5jYWxsKHRoaXMsXCJEYXRhV29ya2VyXCIpO3ZhciBiPXRoaXM7dGhpcy5kYXRhSXNSZWFkeT0hMSx0aGlzLmluZGV4PTAsdGhpcy5tYXg9MCx0aGlzLmRhdGE9bnVsbCx0aGlzLnR5cGU9XCJcIix0aGlzLl90aWNrU2NoZWR1bGVkPSExLGEudGhlbihmdW5jdGlvbihhKXtiLmRhdGFJc1JlYWR5PSEwLGIuZGF0YT1hLGIubWF4PWEmJmEubGVuZ3RofHwwLGIudHlwZT1lLmdldFR5cGVPZihhKSxiLmlzUGF1c2VkfHxiLl90aWNrQW5kUmVwZWF0KCl9LGZ1bmN0aW9uKGEpe2IuZXJyb3IoYSl9KX12YXIgZT1hKFwiLi4vdXRpbHNcIiksZj1hKFwiLi9HZW5lcmljV29ya2VyXCIpLGc9MTYzODQ7ZS5pbmhlcml0cyhkLGYpLGQucHJvdG90eXBlLmNsZWFuVXA9ZnVuY3Rpb24oKXtmLnByb3RvdHlwZS5jbGVhblVwLmNhbGwodGhpcyksdGhpcy5kYXRhPW51bGx9LGQucHJvdG90eXBlLnJlc3VtZT1mdW5jdGlvbigpe3JldHVybiEhZi5wcm90b3R5cGUucmVzdW1lLmNhbGwodGhpcykmJighdGhpcy5fdGlja1NjaGVkdWxlZCYmdGhpcy5kYXRhSXNSZWFkeSYmKHRoaXMuX3RpY2tTY2hlZHVsZWQ9ITAsZS5kZWxheSh0aGlzLl90aWNrQW5kUmVwZWF0LFtdLHRoaXMpKSwhMCl9LGQucHJvdG90eXBlLl90aWNrQW5kUmVwZWF0PWZ1bmN0aW9uKCl7dGhpcy5fdGlja1NjaGVkdWxlZD0hMSx0aGlzLmlzUGF1c2VkfHx0aGlzLmlzRmluaXNoZWR8fCh0aGlzLl90aWNrKCksdGhpcy5pc0ZpbmlzaGVkfHwoZS5kZWxheSh0aGlzLl90aWNrQW5kUmVwZWF0LFtdLHRoaXMpLHRoaXMuX3RpY2tTY2hlZHVsZWQ9ITApKX0sZC5wcm90b3R5cGUuX3RpY2s9ZnVuY3Rpb24oKXtpZih0aGlzLmlzUGF1c2VkfHx0aGlzLmlzRmluaXNoZWQpcmV0dXJuITE7dmFyIGE9ZyxiPW51bGwsYz1NYXRoLm1pbih0aGlzLm1heCx0aGlzLmluZGV4K2EpO2lmKHRoaXMuaW5kZXg+PXRoaXMubWF4KXJldHVybiB0aGlzLmVuZCgpO3N3aXRjaCh0aGlzLnR5cGUpe2Nhc2VcInN0cmluZ1wiOmI9dGhpcy5kYXRhLnN1YnN0cmluZyh0aGlzLmluZGV4LGMpO2JyZWFrO2Nhc2VcInVpbnQ4YXJyYXlcIjpiPXRoaXMuZGF0YS5zdWJhcnJheSh0aGlzLmluZGV4LGMpO2JyZWFrO2Nhc2VcImFycmF5XCI6Y2FzZVwibm9kZWJ1ZmZlclwiOmI9dGhpcy5kYXRhLnNsaWNlKHRoaXMuaW5kZXgsYyl9cmV0dXJuIHRoaXMuaW5kZXg9Yyx0aGlzLnB1c2goe2RhdGE6YixtZXRhOntwZXJjZW50OnRoaXMubWF4P3RoaXMuaW5kZXgvdGhpcy5tYXgqMTAwOjB9fSl9LGIuZXhwb3J0cz1kfSx7XCIuLi91dGlsc1wiOjMyLFwiLi9HZW5lcmljV29ya2VyXCI6Mjh9XSwyODpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoYSl7dGhpcy5uYW1lPWF8fFwiZGVmYXVsdFwiLHRoaXMuc3RyZWFtSW5mbz17fSx0aGlzLmdlbmVyYXRlZEVycm9yPW51bGwsdGhpcy5leHRyYVN0cmVhbUluZm89e30sdGhpcy5pc1BhdXNlZD0hMCx0aGlzLmlzRmluaXNoZWQ9ITEsdGhpcy5pc0xvY2tlZD0hMSx0aGlzLl9saXN0ZW5lcnM9e2RhdGE6W10sZW5kOltdLGVycm9yOltdfSx0aGlzLnByZXZpb3VzPW51bGx9ZC5wcm90b3R5cGU9e3B1c2g6ZnVuY3Rpb24oYSl7dGhpcy5lbWl0KFwiZGF0YVwiLGEpfSxlbmQ6ZnVuY3Rpb24oKXtpZih0aGlzLmlzRmluaXNoZWQpcmV0dXJuITE7dGhpcy5mbHVzaCgpO3RyeXt0aGlzLmVtaXQoXCJlbmRcIiksdGhpcy5jbGVhblVwKCksdGhpcy5pc0ZpbmlzaGVkPSEwfWNhdGNoKGEpe3RoaXMuZW1pdChcImVycm9yXCIsYSl9cmV0dXJuITB9LGVycm9yOmZ1bmN0aW9uKGEpe3JldHVybiF0aGlzLmlzRmluaXNoZWQmJih0aGlzLmlzUGF1c2VkP3RoaXMuZ2VuZXJhdGVkRXJyb3I9YToodGhpcy5pc0ZpbmlzaGVkPSEwLHRoaXMuZW1pdChcImVycm9yXCIsYSksdGhpcy5wcmV2aW91cyYmdGhpcy5wcmV2aW91cy5lcnJvcihhKSx0aGlzLmNsZWFuVXAoKSksITApfSxvbjpmdW5jdGlvbihhLGIpe3JldHVybiB0aGlzLl9saXN0ZW5lcnNbYV0ucHVzaChiKSx0aGlzfSxjbGVhblVwOmZ1bmN0aW9uKCl7dGhpcy5zdHJlYW1JbmZvPXRoaXMuZ2VuZXJhdGVkRXJyb3I9dGhpcy5leHRyYVN0cmVhbUluZm89bnVsbCx0aGlzLl9saXN0ZW5lcnM9W119LGVtaXQ6ZnVuY3Rpb24oYSxiKXtpZih0aGlzLl9saXN0ZW5lcnNbYV0pZm9yKHZhciBjPTA7Yzx0aGlzLl9saXN0ZW5lcnNbYV0ubGVuZ3RoO2MrKyl0aGlzLl9saXN0ZW5lcnNbYV1bY10uY2FsbCh0aGlzLGIpfSxwaXBlOmZ1bmN0aW9uKGEpe3JldHVybiBhLnJlZ2lzdGVyUHJldmlvdXModGhpcyl9LHJlZ2lzdGVyUHJldmlvdXM6ZnVuY3Rpb24oYSl7aWYodGhpcy5pc0xvY2tlZCl0aHJvdyBuZXcgRXJyb3IoXCJUaGUgc3RyZWFtICdcIit0aGlzK1wiJyBoYXMgYWxyZWFkeSBiZWVuIHVzZWQuXCIpO3RoaXMuc3RyZWFtSW5mbz1hLnN0cmVhbUluZm8sdGhpcy5tZXJnZVN0cmVhbUluZm8oKSx0aGlzLnByZXZpb3VzPWE7dmFyIGI9dGhpcztyZXR1cm4gYS5vbihcImRhdGFcIixmdW5jdGlvbihhKXtiLnByb2Nlc3NDaHVuayhhKX0pLGEub24oXCJlbmRcIixmdW5jdGlvbigpe2IuZW5kKCl9KSxhLm9uKFwiZXJyb3JcIixmdW5jdGlvbihhKXtiLmVycm9yKGEpfSksdGhpc30scGF1c2U6ZnVuY3Rpb24oKXtyZXR1cm4hdGhpcy5pc1BhdXNlZCYmIXRoaXMuaXNGaW5pc2hlZCYmKHRoaXMuaXNQYXVzZWQ9ITAsdGhpcy5wcmV2aW91cyYmdGhpcy5wcmV2aW91cy5wYXVzZSgpLCEwKX0scmVzdW1lOmZ1bmN0aW9uKCl7aWYoIXRoaXMuaXNQYXVzZWR8fHRoaXMuaXNGaW5pc2hlZClyZXR1cm4hMTt0aGlzLmlzUGF1c2VkPSExO3ZhciBhPSExO3JldHVybiB0aGlzLmdlbmVyYXRlZEVycm9yJiYodGhpcy5lcnJvcih0aGlzLmdlbmVyYXRlZEVycm9yKSxhPSEwKSx0aGlzLnByZXZpb3VzJiZ0aGlzLnByZXZpb3VzLnJlc3VtZSgpLCFhfSxmbHVzaDpmdW5jdGlvbigpe30scHJvY2Vzc0NodW5rOmZ1bmN0aW9uKGEpe3RoaXMucHVzaChhKX0sd2l0aFN0cmVhbUluZm86ZnVuY3Rpb24oYSxiKXtyZXR1cm4gdGhpcy5leHRyYVN0cmVhbUluZm9bYV09Yix0aGlzLm1lcmdlU3RyZWFtSW5mbygpLHRoaXN9LG1lcmdlU3RyZWFtSW5mbzpmdW5jdGlvbigpe2Zvcih2YXIgYSBpbiB0aGlzLmV4dHJhU3RyZWFtSW5mbyl0aGlzLmV4dHJhU3RyZWFtSW5mby5oYXNPd25Qcm9wZXJ0eShhKSYmKHRoaXMuc3RyZWFtSW5mb1thXT10aGlzLmV4dHJhU3RyZWFtSW5mb1thXSl9LGxvY2s6ZnVuY3Rpb24oKXtpZih0aGlzLmlzTG9ja2VkKXRocm93IG5ldyBFcnJvcihcIlRoZSBzdHJlYW0gJ1wiK3RoaXMrXCInIGhhcyBhbHJlYWR5IGJlZW4gdXNlZC5cIik7dGhpcy5pc0xvY2tlZD0hMCx0aGlzLnByZXZpb3VzJiZ0aGlzLnByZXZpb3VzLmxvY2soKX0sdG9TdHJpbmc6ZnVuY3Rpb24oKXt2YXIgYT1cIldvcmtlciBcIit0aGlzLm5hbWU7cmV0dXJuIHRoaXMucHJldmlvdXM/dGhpcy5wcmV2aW91cytcIiAtPiBcIithOmF9fSxiLmV4cG9ydHM9ZH0se31dLDI5OltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhLGIsYyl7c3dpdGNoKGEpe2Nhc2VcImJsb2JcIjpyZXR1cm4gaC5uZXdCbG9iKGgudHJhbnNmb3JtVG8oXCJhcnJheWJ1ZmZlclwiLGIpLGMpO2Nhc2VcImJhc2U2NFwiOnJldHVybiBrLmVuY29kZShiKTtkZWZhdWx0OnJldHVybiBoLnRyYW5zZm9ybVRvKGEsYil9fWZ1bmN0aW9uIGUoYSxiKXt2YXIgYyxkPTAsZT1udWxsLGY9MDtmb3IoYz0wO2M8Yi5sZW5ndGg7YysrKWYrPWJbY10ubGVuZ3RoO3N3aXRjaChhKXtjYXNlXCJzdHJpbmdcIjpyZXR1cm4gYi5qb2luKFwiXCIpO2Nhc2VcImFycmF5XCI6cmV0dXJuIEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkoW10sYik7Y2FzZVwidWludDhhcnJheVwiOmZvcihlPW5ldyBVaW50OEFycmF5KGYpLGM9MDtjPGIubGVuZ3RoO2MrKyllLnNldChiW2NdLGQpLGQrPWJbY10ubGVuZ3RoO3JldHVybiBlO2Nhc2VcIm5vZGVidWZmZXJcIjpyZXR1cm4gQnVmZmVyLmNvbmNhdChiKTtkZWZhdWx0OnRocm93IG5ldyBFcnJvcihcImNvbmNhdCA6IHVuc3VwcG9ydGVkIHR5cGUgJ1wiK2ErXCInXCIpfX1mdW5jdGlvbiBmKGEsYil7cmV0dXJuIG5ldyBtLlByb21pc2UoZnVuY3Rpb24oYyxmKXt2YXIgZz1bXSxoPWEuX2ludGVybmFsVHlwZSxpPWEuX291dHB1dFR5cGUsaj1hLl9taW1lVHlwZTthLm9uKFwiZGF0YVwiLGZ1bmN0aW9uKGEsYyl7Zy5wdXNoKGEpLGImJmIoYyl9KS5vbihcImVycm9yXCIsZnVuY3Rpb24oYSl7Zz1bXSxmKGEpfSkub24oXCJlbmRcIixmdW5jdGlvbigpe3RyeXt2YXIgYT1kKGksZShoLGcpLGopO2MoYSl9Y2F0Y2goYil7ZihiKX1nPVtdfSkucmVzdW1lKCl9KX1mdW5jdGlvbiBnKGEsYixjKXt2YXIgZD1iO3N3aXRjaChiKXtjYXNlXCJibG9iXCI6Y2FzZVwiYXJyYXlidWZmZXJcIjpkPVwidWludDhhcnJheVwiO2JyZWFrO2Nhc2VcImJhc2U2NFwiOmQ9XCJzdHJpbmdcIn10cnl7dGhpcy5faW50ZXJuYWxUeXBlPWQsdGhpcy5fb3V0cHV0VHlwZT1iLHRoaXMuX21pbWVUeXBlPWMsaC5jaGVja1N1cHBvcnQoZCksdGhpcy5fd29ya2VyPWEucGlwZShuZXcgaShkKSksYS5sb2NrKCl9Y2F0Y2goZSl7dGhpcy5fd29ya2VyPW5ldyBqKFwiZXJyb3JcIiksdGhpcy5fd29ya2VyLmVycm9yKGUpfX12YXIgaD1hKFwiLi4vdXRpbHNcIiksaT1hKFwiLi9Db252ZXJ0V29ya2VyXCIpLGo9YShcIi4vR2VuZXJpY1dvcmtlclwiKSxrPWEoXCIuLi9iYXNlNjRcIiksbD1hKFwiLi4vc3VwcG9ydFwiKSxtPWEoXCIuLi9leHRlcm5hbFwiKSxuPW51bGw7aWYobC5ub2Rlc3RyZWFtKXRyeXtuPWEoXCIuLi9ub2RlanMvTm9kZWpzU3RyZWFtT3V0cHV0QWRhcHRlclwiKX1jYXRjaChvKXt9Zy5wcm90b3R5cGU9e2FjY3VtdWxhdGU6ZnVuY3Rpb24oYSl7cmV0dXJuIGYodGhpcyxhKX0sb246ZnVuY3Rpb24oYSxiKXt2YXIgYz10aGlzO3JldHVyblwiZGF0YVwiPT09YT90aGlzLl93b3JrZXIub24oYSxmdW5jdGlvbihhKXtiLmNhbGwoYyxhLmRhdGEsYS5tZXRhKX0pOnRoaXMuX3dvcmtlci5vbihhLGZ1bmN0aW9uKCl7aC5kZWxheShiLGFyZ3VtZW50cyxjKX0pLHRoaXN9LHJlc3VtZTpmdW5jdGlvbigpe3JldHVybiBoLmRlbGF5KHRoaXMuX3dvcmtlci5yZXN1bWUsW10sdGhpcy5fd29ya2VyKSx0aGlzfSxwYXVzZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLl93b3JrZXIucGF1c2UoKSx0aGlzfSx0b05vZGVqc1N0cmVhbTpmdW5jdGlvbihhKXtpZihoLmNoZWNrU3VwcG9ydChcIm5vZGVzdHJlYW1cIiksXCJub2RlYnVmZmVyXCIhPT10aGlzLl9vdXRwdXRUeXBlKXRocm93IG5ldyBFcnJvcih0aGlzLl9vdXRwdXRUeXBlK1wiIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBtZXRob2RcIik7cmV0dXJuIG5ldyBuKHRoaXMse29iamVjdE1vZGU6XCJub2RlYnVmZmVyXCIhPT10aGlzLl9vdXRwdXRUeXBlfSxhKX19LGIuZXhwb3J0cz1nfSx7XCIuLi9iYXNlNjRcIjoxLFwiLi4vZXh0ZXJuYWxcIjo2LFwiLi4vbm9kZWpzL05vZGVqc1N0cmVhbU91dHB1dEFkYXB0ZXJcIjoxMyxcIi4uL3N1cHBvcnRcIjozMCxcIi4uL3V0aWxzXCI6MzIsXCIuL0NvbnZlcnRXb3JrZXJcIjoyNCxcIi4vR2VuZXJpY1dvcmtlclwiOjI4fV0sMzA6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtpZihjLmJhc2U2ND0hMCxjLmFycmF5PSEwLGMuc3RyaW5nPSEwLGMuYXJyYXlidWZmZXI9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIEFycmF5QnVmZmVyJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgVWludDhBcnJheSxjLm5vZGVidWZmZXI9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIEJ1ZmZlcixjLnVpbnQ4YXJyYXk9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIFVpbnQ4QXJyYXksXCJ1bmRlZmluZWRcIj09dHlwZW9mIEFycmF5QnVmZmVyKWMuYmxvYj0hMTtlbHNle3ZhciBkPW5ldyBBcnJheUJ1ZmZlcigwKTt0cnl7Yy5ibG9iPTA9PT1uZXcgQmxvYihbZF0se3R5cGU6XCJhcHBsaWNhdGlvbi96aXBcIn0pLnNpemV9Y2F0Y2goZSl7dHJ5e3ZhciBmPXNlbGYuQmxvYkJ1aWxkZXJ8fHNlbGYuV2ViS2l0QmxvYkJ1aWxkZXJ8fHNlbGYuTW96QmxvYkJ1aWxkZXJ8fHNlbGYuTVNCbG9iQnVpbGRlcixnPW5ldyBmO2cuYXBwZW5kKGQpLGMuYmxvYj0wPT09Zy5nZXRCbG9iKFwiYXBwbGljYXRpb24vemlwXCIpLnNpemV9Y2F0Y2goZSl7Yy5ibG9iPSExfX19dHJ5e2Mubm9kZXN0cmVhbT0hIWEoXCJyZWFkYWJsZS1zdHJlYW1cIikuUmVhZGFibGV9Y2F0Y2goZSl7Yy5ub2Rlc3RyZWFtPSExfX0se1wicmVhZGFibGUtc3RyZWFtXCI6MTZ9XSwzMTpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoKXtpLmNhbGwodGhpcyxcInV0Zi04IGRlY29kZVwiKSx0aGlzLmxlZnRPdmVyPW51bGx9ZnVuY3Rpb24gZSgpe2kuY2FsbCh0aGlzLFwidXRmLTggZW5jb2RlXCIpfWZvcih2YXIgZj1hKFwiLi91dGlsc1wiKSxnPWEoXCIuL3N1cHBvcnRcIiksaD1hKFwiLi9ub2RlanNVdGlsc1wiKSxpPWEoXCIuL3N0cmVhbS9HZW5lcmljV29ya2VyXCIpLGo9bmV3IEFycmF5KDI1Niksaz0wO2s8MjU2O2srKylqW2tdPWs+PTI1Mj82Oms+PTI0OD81Oms+PTI0MD80Oms+PTIyND8zOms+PTE5Mj8yOjE7alsyNTRdPWpbMjU0XT0xO3ZhciBsPWZ1bmN0aW9uKGEpe3ZhciBiLGMsZCxlLGYsaD1hLmxlbmd0aCxpPTA7Zm9yKGU9MDtlPGg7ZSsrKWM9YS5jaGFyQ29kZUF0KGUpLDU1Mjk2PT09KDY0NTEyJmMpJiZlKzE8aCYmKGQ9YS5jaGFyQ29kZUF0KGUrMSksNTYzMjA9PT0oNjQ1MTImZCkmJihjPTY1NTM2KyhjLTU1Mjk2PDwxMCkrKGQtNTYzMjApLGUrKykpLGkrPWM8MTI4PzE6YzwyMDQ4PzI6Yzw2NTUzNj8zOjQ7Zm9yKGI9Zy51aW50OGFycmF5P25ldyBVaW50OEFycmF5KGkpOm5ldyBBcnJheShpKSxmPTAsZT0wO2Y8aTtlKyspYz1hLmNoYXJDb2RlQXQoZSksNTUyOTY9PT0oNjQ1MTImYykmJmUrMTxoJiYoZD1hLmNoYXJDb2RlQXQoZSsxKSw1NjMyMD09PSg2NDUxMiZkKSYmKGM9NjU1MzYrKGMtNTUyOTY8PDEwKSsoZC01NjMyMCksZSsrKSksYzwxMjg/YltmKytdPWM6YzwyMDQ4PyhiW2YrK109MTkyfGM+Pj42LGJbZisrXT0xMjh8NjMmYyk6Yzw2NTUzNj8oYltmKytdPTIyNHxjPj4+MTIsYltmKytdPTEyOHxjPj4+NiY2MyxiW2YrK109MTI4fDYzJmMpOihiW2YrK109MjQwfGM+Pj4xOCxiW2YrK109MTI4fGM+Pj4xMiY2MyxiW2YrK109MTI4fGM+Pj42JjYzLGJbZisrXT0xMjh8NjMmYyk7cmV0dXJuIGJ9LG09ZnVuY3Rpb24oYSxiKXt2YXIgYztmb3IoYj1ifHxhLmxlbmd0aCxiPmEubGVuZ3RoJiYoYj1hLmxlbmd0aCksYz1iLTE7Yz49MCYmMTI4PT09KDE5MiZhW2NdKTspYy0tO3JldHVybiBjPDA/YjowPT09Yz9iOmMralthW2NdXT5iP2M6Yn0sbj1mdW5jdGlvbihhKXt2YXIgYixjLGQsZSxnPWEubGVuZ3RoLGg9bmV3IEFycmF5KDIqZyk7Zm9yKGM9MCxiPTA7YjxnOylpZihkPWFbYisrXSxkPDEyOCloW2MrK109ZDtlbHNlIGlmKGU9altkXSxlPjQpaFtjKytdPTY1NTMzLGIrPWUtMTtlbHNle2ZvcihkJj0yPT09ZT8zMTozPT09ZT8xNTo3O2U+MSYmYjxnOylkPWQ8PDZ8NjMmYVtiKytdLGUtLTtlPjE/aFtjKytdPTY1NTMzOmQ8NjU1MzY/aFtjKytdPWQ6KGQtPTY1NTM2LGhbYysrXT01NTI5NnxkPj4xMCYxMDIzLGhbYysrXT01NjMyMHwxMDIzJmQpfXJldHVybiBoLmxlbmd0aCE9PWMmJihoLnN1YmFycmF5P2g9aC5zdWJhcnJheSgwLGMpOmgubGVuZ3RoPWMpLGYuYXBwbHlGcm9tQ2hhckNvZGUoaCl9O2MudXRmOGVuY29kZT1mdW5jdGlvbihhKXtyZXR1cm4gZy5ub2RlYnVmZmVyP2gubmV3QnVmZmVyRnJvbShhLFwidXRmLThcIik6bChhKX0sYy51dGY4ZGVjb2RlPWZ1bmN0aW9uKGEpe3JldHVybiBnLm5vZGVidWZmZXI/Zi50cmFuc2Zvcm1UbyhcIm5vZGVidWZmZXJcIixhKS50b1N0cmluZyhcInV0Zi04XCIpOihhPWYudHJhbnNmb3JtVG8oZy51aW50OGFycmF5P1widWludDhhcnJheVwiOlwiYXJyYXlcIixhKSxuKGEpKX0sZi5pbmhlcml0cyhkLGkpLGQucHJvdG90eXBlLnByb2Nlc3NDaHVuaz1mdW5jdGlvbihhKXt2YXIgYj1mLnRyYW5zZm9ybVRvKGcudWludDhhcnJheT9cInVpbnQ4YXJyYXlcIjpcImFycmF5XCIsYS5kYXRhKTtpZih0aGlzLmxlZnRPdmVyJiZ0aGlzLmxlZnRPdmVyLmxlbmd0aCl7aWYoZy51aW50OGFycmF5KXt2YXIgZD1iO2I9bmV3IFVpbnQ4QXJyYXkoZC5sZW5ndGgrdGhpcy5sZWZ0T3Zlci5sZW5ndGgpLGIuc2V0KHRoaXMubGVmdE92ZXIsMCksYi5zZXQoZCx0aGlzLmxlZnRPdmVyLmxlbmd0aCl9ZWxzZSBiPXRoaXMubGVmdE92ZXIuY29uY2F0KGIpO3RoaXMubGVmdE92ZXI9bnVsbH12YXIgZT1tKGIpLGg9YjtlIT09Yi5sZW5ndGgmJihnLnVpbnQ4YXJyYXk/KGg9Yi5zdWJhcnJheSgwLGUpLHRoaXMubGVmdE92ZXI9Yi5zdWJhcnJheShlLGIubGVuZ3RoKSk6KGg9Yi5zbGljZSgwLGUpLHRoaXMubGVmdE92ZXI9Yi5zbGljZShlLGIubGVuZ3RoKSkpLHRoaXMucHVzaCh7ZGF0YTpjLnV0ZjhkZWNvZGUoaCksbWV0YTphLm1ldGF9KX0sZC5wcm90b3R5cGUuZmx1c2g9ZnVuY3Rpb24oKXt0aGlzLmxlZnRPdmVyJiZ0aGlzLmxlZnRPdmVyLmxlbmd0aCYmKHRoaXMucHVzaCh7ZGF0YTpjLnV0ZjhkZWNvZGUodGhpcy5sZWZ0T3ZlciksbWV0YTp7fX0pLHRoaXMubGVmdE92ZXI9bnVsbCl9LGMuVXRmOERlY29kZVdvcmtlcj1kLGYuaW5oZXJpdHMoZSxpKSxlLnByb3RvdHlwZS5wcm9jZXNzQ2h1bms9ZnVuY3Rpb24oYSl7dGhpcy5wdXNoKHtkYXRhOmMudXRmOGVuY29kZShhLmRhdGEpLG1ldGE6YS5tZXRhfSl9LGMuVXRmOEVuY29kZVdvcmtlcj1lfSx7XCIuL25vZGVqc1V0aWxzXCI6MTQsXCIuL3N0cmVhbS9HZW5lcmljV29ya2VyXCI6MjgsXCIuL3N1cHBvcnRcIjozMCxcIi4vdXRpbHNcIjozMn1dLDMyOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhKXt2YXIgYj1udWxsO3JldHVybiBiPWkudWludDhhcnJheT9uZXcgVWludDhBcnJheShhLmxlbmd0aCk6bmV3IEFycmF5KGEubGVuZ3RoKSxmKGEsYil9ZnVuY3Rpb24gZShhKXtyZXR1cm4gYX1mdW5jdGlvbiBmKGEsYil7Zm9yKHZhciBjPTA7YzxhLmxlbmd0aDsrK2MpYltjXT0yNTUmYS5jaGFyQ29kZUF0KGMpO3JldHVybiBifWZ1bmN0aW9uIGcoYSl7dmFyIGI9NjU1MzYsZD1jLmdldFR5cGVPZihhKSxlPSEwO2lmKFwidWludDhhcnJheVwiPT09ZD9lPW4uYXBwbHlDYW5CZVVzZWQudWludDhhcnJheTpcIm5vZGVidWZmZXJcIj09PWQmJihlPW4uYXBwbHlDYW5CZVVzZWQubm9kZWJ1ZmZlciksZSlmb3IoO2I+MTspdHJ5e3JldHVybiBuLnN0cmluZ2lmeUJ5Q2h1bmsoYSxkLGIpfWNhdGNoKGYpe2I9TWF0aC5mbG9vcihiLzIpfXJldHVybiBuLnN0cmluZ2lmeUJ5Q2hhcihhKX1mdW5jdGlvbiBoKGEsYil7Zm9yKHZhciBjPTA7YzxhLmxlbmd0aDtjKyspYltjXT1hW2NdO1xucmV0dXJuIGJ9dmFyIGk9YShcIi4vc3VwcG9ydFwiKSxqPWEoXCIuL2Jhc2U2NFwiKSxrPWEoXCIuL25vZGVqc1V0aWxzXCIpLGw9YShcImNvcmUtanMvbGlicmFyeS9mbi9zZXQtaW1tZWRpYXRlXCIpLG09YShcIi4vZXh0ZXJuYWxcIik7Yy5uZXdCbG9iPWZ1bmN0aW9uKGEsYil7Yy5jaGVja1N1cHBvcnQoXCJibG9iXCIpO3RyeXtyZXR1cm4gbmV3IEJsb2IoW2FdLHt0eXBlOmJ9KX1jYXRjaChkKXt0cnl7dmFyIGU9c2VsZi5CbG9iQnVpbGRlcnx8c2VsZi5XZWJLaXRCbG9iQnVpbGRlcnx8c2VsZi5Nb3pCbG9iQnVpbGRlcnx8c2VsZi5NU0Jsb2JCdWlsZGVyLGY9bmV3IGU7cmV0dXJuIGYuYXBwZW5kKGEpLGYuZ2V0QmxvYihiKX1jYXRjaChkKXt0aHJvdyBuZXcgRXJyb3IoXCJCdWcgOiBjYW4ndCBjb25zdHJ1Y3QgdGhlIEJsb2IuXCIpfX19O3ZhciBuPXtzdHJpbmdpZnlCeUNodW5rOmZ1bmN0aW9uKGEsYixjKXt2YXIgZD1bXSxlPTAsZj1hLmxlbmd0aDtpZihmPD1jKXJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsYSk7Zm9yKDtlPGY7KVwiYXJyYXlcIj09PWJ8fFwibm9kZWJ1ZmZlclwiPT09Yj9kLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLGEuc2xpY2UoZSxNYXRoLm1pbihlK2MsZikpKSk6ZC5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCxhLnN1YmFycmF5KGUsTWF0aC5taW4oZStjLGYpKSkpLGUrPWM7cmV0dXJuIGQuam9pbihcIlwiKX0sc3RyaW5naWZ5QnlDaGFyOmZ1bmN0aW9uKGEpe2Zvcih2YXIgYj1cIlwiLGM9MDtjPGEubGVuZ3RoO2MrKyliKz1TdHJpbmcuZnJvbUNoYXJDb2RlKGFbY10pO3JldHVybiBifSxhcHBseUNhbkJlVXNlZDp7dWludDhhcnJheTpmdW5jdGlvbigpe3RyeXtyZXR1cm4gaS51aW50OGFycmF5JiYxPT09U3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLG5ldyBVaW50OEFycmF5KDEpKS5sZW5ndGh9Y2F0Y2goYSl7cmV0dXJuITF9fSgpLG5vZGVidWZmZXI6ZnVuY3Rpb24oKXt0cnl7cmV0dXJuIGkubm9kZWJ1ZmZlciYmMT09PVN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCxrLmFsbG9jQnVmZmVyKDEpKS5sZW5ndGh9Y2F0Y2goYSl7cmV0dXJuITF9fSgpfX07Yy5hcHBseUZyb21DaGFyQ29kZT1nO3ZhciBvPXt9O28uc3RyaW5nPXtzdHJpbmc6ZSxhcnJheTpmdW5jdGlvbihhKXtyZXR1cm4gZihhLG5ldyBBcnJheShhLmxlbmd0aCkpfSxhcnJheWJ1ZmZlcjpmdW5jdGlvbihhKXtyZXR1cm4gby5zdHJpbmcudWludDhhcnJheShhKS5idWZmZXJ9LHVpbnQ4YXJyYXk6ZnVuY3Rpb24oYSl7cmV0dXJuIGYoYSxuZXcgVWludDhBcnJheShhLmxlbmd0aCkpfSxub2RlYnVmZmVyOmZ1bmN0aW9uKGEpe3JldHVybiBmKGEsay5hbGxvY0J1ZmZlcihhLmxlbmd0aCkpfX0sby5hcnJheT17c3RyaW5nOmcsYXJyYXk6ZSxhcnJheWJ1ZmZlcjpmdW5jdGlvbihhKXtyZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYSkuYnVmZmVyfSx1aW50OGFycmF5OmZ1bmN0aW9uKGEpe3JldHVybiBuZXcgVWludDhBcnJheShhKX0sbm9kZWJ1ZmZlcjpmdW5jdGlvbihhKXtyZXR1cm4gay5uZXdCdWZmZXJGcm9tKGEpfX0sby5hcnJheWJ1ZmZlcj17c3RyaW5nOmZ1bmN0aW9uKGEpe3JldHVybiBnKG5ldyBVaW50OEFycmF5KGEpKX0sYXJyYXk6ZnVuY3Rpb24oYSl7cmV0dXJuIGgobmV3IFVpbnQ4QXJyYXkoYSksbmV3IEFycmF5KGEuYnl0ZUxlbmd0aCkpfSxhcnJheWJ1ZmZlcjplLHVpbnQ4YXJyYXk6ZnVuY3Rpb24oYSl7cmV0dXJuIG5ldyBVaW50OEFycmF5KGEpfSxub2RlYnVmZmVyOmZ1bmN0aW9uKGEpe3JldHVybiBrLm5ld0J1ZmZlckZyb20obmV3IFVpbnQ4QXJyYXkoYSkpfX0sby51aW50OGFycmF5PXtzdHJpbmc6ZyxhcnJheTpmdW5jdGlvbihhKXtyZXR1cm4gaChhLG5ldyBBcnJheShhLmxlbmd0aCkpfSxhcnJheWJ1ZmZlcjpmdW5jdGlvbihhKXtyZXR1cm4gYS5idWZmZXJ9LHVpbnQ4YXJyYXk6ZSxub2RlYnVmZmVyOmZ1bmN0aW9uKGEpe3JldHVybiBrLm5ld0J1ZmZlckZyb20oYSl9fSxvLm5vZGVidWZmZXI9e3N0cmluZzpnLGFycmF5OmZ1bmN0aW9uKGEpe3JldHVybiBoKGEsbmV3IEFycmF5KGEubGVuZ3RoKSl9LGFycmF5YnVmZmVyOmZ1bmN0aW9uKGEpe3JldHVybiBvLm5vZGVidWZmZXIudWludDhhcnJheShhKS5idWZmZXJ9LHVpbnQ4YXJyYXk6ZnVuY3Rpb24oYSl7cmV0dXJuIGgoYSxuZXcgVWludDhBcnJheShhLmxlbmd0aCkpfSxub2RlYnVmZmVyOmV9LGMudHJhbnNmb3JtVG89ZnVuY3Rpb24oYSxiKXtpZihifHwoYj1cIlwiKSwhYSlyZXR1cm4gYjtjLmNoZWNrU3VwcG9ydChhKTt2YXIgZD1jLmdldFR5cGVPZihiKSxlPW9bZF1bYV0oYik7cmV0dXJuIGV9LGMuZ2V0VHlwZU9mPWZ1bmN0aW9uKGEpe3JldHVyblwic3RyaW5nXCI9PXR5cGVvZiBhP1wic3RyaW5nXCI6XCJbb2JqZWN0IEFycmF5XVwiPT09T2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGEpP1wiYXJyYXlcIjppLm5vZGVidWZmZXImJmsuaXNCdWZmZXIoYSk/XCJub2RlYnVmZmVyXCI6aS51aW50OGFycmF5JiZhIGluc3RhbmNlb2YgVWludDhBcnJheT9cInVpbnQ4YXJyYXlcIjppLmFycmF5YnVmZmVyJiZhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXI/XCJhcnJheWJ1ZmZlclwiOnZvaWQgMH0sYy5jaGVja1N1cHBvcnQ9ZnVuY3Rpb24oYSl7dmFyIGI9aVthLnRvTG93ZXJDYXNlKCldO2lmKCFiKXRocm93IG5ldyBFcnJvcihhK1wiIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBwbGF0Zm9ybVwiKX0sYy5NQVhfVkFMVUVfMTZCSVRTPTY1NTM1LGMuTUFYX1ZBTFVFXzMyQklUUz0tMSxjLnByZXR0eT1mdW5jdGlvbihhKXt2YXIgYixjLGQ9XCJcIjtmb3IoYz0wO2M8KGF8fFwiXCIpLmxlbmd0aDtjKyspYj1hLmNoYXJDb2RlQXQoYyksZCs9XCJcXFxceFwiKyhiPDE2P1wiMFwiOlwiXCIpK2IudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCk7cmV0dXJuIGR9LGMuZGVsYXk9ZnVuY3Rpb24oYSxiLGMpe2woZnVuY3Rpb24oKXthLmFwcGx5KGN8fG51bGwsYnx8W10pfSl9LGMuaW5oZXJpdHM9ZnVuY3Rpb24oYSxiKXt2YXIgYz1mdW5jdGlvbigpe307Yy5wcm90b3R5cGU9Yi5wcm90b3R5cGUsYS5wcm90b3R5cGU9bmV3IGN9LGMuZXh0ZW5kPWZ1bmN0aW9uKCl7dmFyIGEsYixjPXt9O2ZvcihhPTA7YTxhcmd1bWVudHMubGVuZ3RoO2ErKylmb3IoYiBpbiBhcmd1bWVudHNbYV0pYXJndW1lbnRzW2FdLmhhc093blByb3BlcnR5KGIpJiZcInVuZGVmaW5lZFwiPT10eXBlb2YgY1tiXSYmKGNbYl09YXJndW1lbnRzW2FdW2JdKTtyZXR1cm4gY30sYy5wcmVwYXJlQ29udGVudD1mdW5jdGlvbihhLGIsZSxmLGcpe3ZhciBoPW0uUHJvbWlzZS5yZXNvbHZlKGIpLnRoZW4oZnVuY3Rpb24oYSl7dmFyIGI9aS5ibG9iJiYoYSBpbnN0YW5jZW9mIEJsb2J8fFtcIltvYmplY3QgRmlsZV1cIixcIltvYmplY3QgQmxvYl1cIl0uaW5kZXhPZihPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYSkpIT09LTEpO3JldHVybiBiJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgRmlsZVJlYWRlcj9uZXcgbS5Qcm9taXNlKGZ1bmN0aW9uKGIsYyl7dmFyIGQ9bmV3IEZpbGVSZWFkZXI7ZC5vbmxvYWQ9ZnVuY3Rpb24oYSl7YihhLnRhcmdldC5yZXN1bHQpfSxkLm9uZXJyb3I9ZnVuY3Rpb24oYSl7YyhhLnRhcmdldC5lcnJvcil9LGQucmVhZEFzQXJyYXlCdWZmZXIoYSl9KTphfSk7cmV0dXJuIGgudGhlbihmdW5jdGlvbihiKXt2YXIgaD1jLmdldFR5cGVPZihiKTtyZXR1cm4gaD8oXCJhcnJheWJ1ZmZlclwiPT09aD9iPWMudHJhbnNmb3JtVG8oXCJ1aW50OGFycmF5XCIsYik6XCJzdHJpbmdcIj09PWgmJihnP2I9ai5kZWNvZGUoYik6ZSYmZiE9PSEwJiYoYj1kKGIpKSksYik6bS5Qcm9taXNlLnJlamVjdChuZXcgRXJyb3IoXCJDYW4ndCByZWFkIHRoZSBkYXRhIG9mICdcIithK1wiJy4gSXMgaXQgaW4gYSBzdXBwb3J0ZWQgSmF2YVNjcmlwdCB0eXBlIChTdHJpbmcsIEJsb2IsIEFycmF5QnVmZmVyLCBldGMpID9cIikpfSl9fSx7XCIuL2Jhc2U2NFwiOjEsXCIuL2V4dGVybmFsXCI6NixcIi4vbm9kZWpzVXRpbHNcIjoxNCxcIi4vc3VwcG9ydFwiOjMwLFwiY29yZS1qcy9saWJyYXJ5L2ZuL3NldC1pbW1lZGlhdGVcIjozNn1dLDMzOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhKXt0aGlzLmZpbGVzPVtdLHRoaXMubG9hZE9wdGlvbnM9YX12YXIgZT1hKFwiLi9yZWFkZXIvcmVhZGVyRm9yXCIpLGY9YShcIi4vdXRpbHNcIiksZz1hKFwiLi9zaWduYXR1cmVcIiksaD1hKFwiLi96aXBFbnRyeVwiKSxpPShhKFwiLi91dGY4XCIpLGEoXCIuL3N1cHBvcnRcIikpO2QucHJvdG90eXBlPXtjaGVja1NpZ25hdHVyZTpmdW5jdGlvbihhKXtpZighdGhpcy5yZWFkZXIucmVhZEFuZENoZWNrU2lnbmF0dXJlKGEpKXt0aGlzLnJlYWRlci5pbmRleC09NDt2YXIgYj10aGlzLnJlYWRlci5yZWFkU3RyaW5nKDQpO3Rocm93IG5ldyBFcnJvcihcIkNvcnJ1cHRlZCB6aXAgb3IgYnVnOiB1bmV4cGVjdGVkIHNpZ25hdHVyZSAoXCIrZi5wcmV0dHkoYikrXCIsIGV4cGVjdGVkIFwiK2YucHJldHR5KGEpK1wiKVwiKX19LGlzU2lnbmF0dXJlOmZ1bmN0aW9uKGEsYil7dmFyIGM9dGhpcy5yZWFkZXIuaW5kZXg7dGhpcy5yZWFkZXIuc2V0SW5kZXgoYSk7dmFyIGQ9dGhpcy5yZWFkZXIucmVhZFN0cmluZyg0KSxlPWQ9PT1iO3JldHVybiB0aGlzLnJlYWRlci5zZXRJbmRleChjKSxlfSxyZWFkQmxvY2tFbmRPZkNlbnRyYWw6ZnVuY3Rpb24oKXt0aGlzLmRpc2tOdW1iZXI9dGhpcy5yZWFkZXIucmVhZEludCgyKSx0aGlzLmRpc2tXaXRoQ2VudHJhbERpclN0YXJ0PXRoaXMucmVhZGVyLnJlYWRJbnQoMiksdGhpcy5jZW50cmFsRGlyUmVjb3Jkc09uVGhpc0Rpc2s9dGhpcy5yZWFkZXIucmVhZEludCgyKSx0aGlzLmNlbnRyYWxEaXJSZWNvcmRzPXRoaXMucmVhZGVyLnJlYWRJbnQoMiksdGhpcy5jZW50cmFsRGlyU2l6ZT10aGlzLnJlYWRlci5yZWFkSW50KDQpLHRoaXMuY2VudHJhbERpck9mZnNldD10aGlzLnJlYWRlci5yZWFkSW50KDQpLHRoaXMuemlwQ29tbWVudExlbmd0aD10aGlzLnJlYWRlci5yZWFkSW50KDIpO3ZhciBhPXRoaXMucmVhZGVyLnJlYWREYXRhKHRoaXMuemlwQ29tbWVudExlbmd0aCksYj1pLnVpbnQ4YXJyYXk/XCJ1aW50OGFycmF5XCI6XCJhcnJheVwiLGM9Zi50cmFuc2Zvcm1UbyhiLGEpO3RoaXMuemlwQ29tbWVudD10aGlzLmxvYWRPcHRpb25zLmRlY29kZUZpbGVOYW1lKGMpfSxyZWFkQmxvY2taaXA2NEVuZE9mQ2VudHJhbDpmdW5jdGlvbigpe3RoaXMuemlwNjRFbmRPZkNlbnRyYWxTaXplPXRoaXMucmVhZGVyLnJlYWRJbnQoOCksdGhpcy5yZWFkZXIuc2tpcCg0KSx0aGlzLmRpc2tOdW1iZXI9dGhpcy5yZWFkZXIucmVhZEludCg0KSx0aGlzLmRpc2tXaXRoQ2VudHJhbERpclN0YXJ0PXRoaXMucmVhZGVyLnJlYWRJbnQoNCksdGhpcy5jZW50cmFsRGlyUmVjb3Jkc09uVGhpc0Rpc2s9dGhpcy5yZWFkZXIucmVhZEludCg4KSx0aGlzLmNlbnRyYWxEaXJSZWNvcmRzPXRoaXMucmVhZGVyLnJlYWRJbnQoOCksdGhpcy5jZW50cmFsRGlyU2l6ZT10aGlzLnJlYWRlci5yZWFkSW50KDgpLHRoaXMuY2VudHJhbERpck9mZnNldD10aGlzLnJlYWRlci5yZWFkSW50KDgpLHRoaXMuemlwNjRFeHRlbnNpYmxlRGF0YT17fTtmb3IodmFyIGEsYixjLGQ9dGhpcy56aXA2NEVuZE9mQ2VudHJhbFNpemUtNDQsZT0wO2U8ZDspYT10aGlzLnJlYWRlci5yZWFkSW50KDIpLGI9dGhpcy5yZWFkZXIucmVhZEludCg0KSxjPXRoaXMucmVhZGVyLnJlYWREYXRhKGIpLHRoaXMuemlwNjRFeHRlbnNpYmxlRGF0YVthXT17aWQ6YSxsZW5ndGg6Yix2YWx1ZTpjfX0scmVhZEJsb2NrWmlwNjRFbmRPZkNlbnRyYWxMb2NhdG9yOmZ1bmN0aW9uKCl7aWYodGhpcy5kaXNrV2l0aFppcDY0Q2VudHJhbERpclN0YXJ0PXRoaXMucmVhZGVyLnJlYWRJbnQoNCksdGhpcy5yZWxhdGl2ZU9mZnNldEVuZE9mWmlwNjRDZW50cmFsRGlyPXRoaXMucmVhZGVyLnJlYWRJbnQoOCksdGhpcy5kaXNrc0NvdW50PXRoaXMucmVhZGVyLnJlYWRJbnQoNCksdGhpcy5kaXNrc0NvdW50PjEpdGhyb3cgbmV3IEVycm9yKFwiTXVsdGktdm9sdW1lcyB6aXAgYXJlIG5vdCBzdXBwb3J0ZWRcIil9LHJlYWRMb2NhbEZpbGVzOmZ1bmN0aW9uKCl7dmFyIGEsYjtmb3IoYT0wO2E8dGhpcy5maWxlcy5sZW5ndGg7YSsrKWI9dGhpcy5maWxlc1thXSx0aGlzLnJlYWRlci5zZXRJbmRleChiLmxvY2FsSGVhZGVyT2Zmc2V0KSx0aGlzLmNoZWNrU2lnbmF0dXJlKGcuTE9DQUxfRklMRV9IRUFERVIpLGIucmVhZExvY2FsUGFydCh0aGlzLnJlYWRlciksYi5oYW5kbGVVVEY4KCksYi5wcm9jZXNzQXR0cmlidXRlcygpfSxyZWFkQ2VudHJhbERpcjpmdW5jdGlvbigpe3ZhciBhO2Zvcih0aGlzLnJlYWRlci5zZXRJbmRleCh0aGlzLmNlbnRyYWxEaXJPZmZzZXQpO3RoaXMucmVhZGVyLnJlYWRBbmRDaGVja1NpZ25hdHVyZShnLkNFTlRSQUxfRklMRV9IRUFERVIpOylhPW5ldyBoKHt6aXA2NDp0aGlzLnppcDY0fSx0aGlzLmxvYWRPcHRpb25zKSxhLnJlYWRDZW50cmFsUGFydCh0aGlzLnJlYWRlciksdGhpcy5maWxlcy5wdXNoKGEpO2lmKHRoaXMuY2VudHJhbERpclJlY29yZHMhPT10aGlzLmZpbGVzLmxlbmd0aCYmMCE9PXRoaXMuY2VudHJhbERpclJlY29yZHMmJjA9PT10aGlzLmZpbGVzLmxlbmd0aCl0aHJvdyBuZXcgRXJyb3IoXCJDb3JydXB0ZWQgemlwIG9yIGJ1ZzogZXhwZWN0ZWQgXCIrdGhpcy5jZW50cmFsRGlyUmVjb3JkcytcIiByZWNvcmRzIGluIGNlbnRyYWwgZGlyLCBnb3QgXCIrdGhpcy5maWxlcy5sZW5ndGgpfSxyZWFkRW5kT2ZDZW50cmFsOmZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5yZWFkZXIubGFzdEluZGV4T2ZTaWduYXR1cmUoZy5DRU5UUkFMX0RJUkVDVE9SWV9FTkQpO2lmKGE8MCl7dmFyIGI9IXRoaXMuaXNTaWduYXR1cmUoMCxnLkxPQ0FMX0ZJTEVfSEVBREVSKTt0aHJvdyBiP25ldyBFcnJvcihcIkNhbid0IGZpbmQgZW5kIG9mIGNlbnRyYWwgZGlyZWN0b3J5IDogaXMgdGhpcyBhIHppcCBmaWxlID8gSWYgaXQgaXMsIHNlZSBodHRwczovL3N0dWsuZ2l0aHViLmlvL2pzemlwL2RvY3VtZW50YXRpb24vaG93dG8vcmVhZF96aXAuaHRtbFwiKTpuZXcgRXJyb3IoXCJDb3JydXB0ZWQgemlwOiBjYW4ndCBmaW5kIGVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeVwiKX10aGlzLnJlYWRlci5zZXRJbmRleChhKTt2YXIgYz1hO2lmKHRoaXMuY2hlY2tTaWduYXR1cmUoZy5DRU5UUkFMX0RJUkVDVE9SWV9FTkQpLHRoaXMucmVhZEJsb2NrRW5kT2ZDZW50cmFsKCksdGhpcy5kaXNrTnVtYmVyPT09Zi5NQVhfVkFMVUVfMTZCSVRTfHx0aGlzLmRpc2tXaXRoQ2VudHJhbERpclN0YXJ0PT09Zi5NQVhfVkFMVUVfMTZCSVRTfHx0aGlzLmNlbnRyYWxEaXJSZWNvcmRzT25UaGlzRGlzaz09PWYuTUFYX1ZBTFVFXzE2QklUU3x8dGhpcy5jZW50cmFsRGlyUmVjb3Jkcz09PWYuTUFYX1ZBTFVFXzE2QklUU3x8dGhpcy5jZW50cmFsRGlyU2l6ZT09PWYuTUFYX1ZBTFVFXzMyQklUU3x8dGhpcy5jZW50cmFsRGlyT2Zmc2V0PT09Zi5NQVhfVkFMVUVfMzJCSVRTKXtpZih0aGlzLnppcDY0PSEwLGE9dGhpcy5yZWFkZXIubGFzdEluZGV4T2ZTaWduYXR1cmUoZy5aSVA2NF9DRU5UUkFMX0RJUkVDVE9SWV9MT0NBVE9SKSxhPDApdGhyb3cgbmV3IEVycm9yKFwiQ29ycnVwdGVkIHppcDogY2FuJ3QgZmluZCB0aGUgWklQNjQgZW5kIG9mIGNlbnRyYWwgZGlyZWN0b3J5IGxvY2F0b3JcIik7aWYodGhpcy5yZWFkZXIuc2V0SW5kZXgoYSksdGhpcy5jaGVja1NpZ25hdHVyZShnLlpJUDY0X0NFTlRSQUxfRElSRUNUT1JZX0xPQ0FUT1IpLHRoaXMucmVhZEJsb2NrWmlwNjRFbmRPZkNlbnRyYWxMb2NhdG9yKCksIXRoaXMuaXNTaWduYXR1cmUodGhpcy5yZWxhdGl2ZU9mZnNldEVuZE9mWmlwNjRDZW50cmFsRGlyLGcuWklQNjRfQ0VOVFJBTF9ESVJFQ1RPUllfRU5EKSYmKHRoaXMucmVsYXRpdmVPZmZzZXRFbmRPZlppcDY0Q2VudHJhbERpcj10aGlzLnJlYWRlci5sYXN0SW5kZXhPZlNpZ25hdHVyZShnLlpJUDY0X0NFTlRSQUxfRElSRUNUT1JZX0VORCksdGhpcy5yZWxhdGl2ZU9mZnNldEVuZE9mWmlwNjRDZW50cmFsRGlyPDApKXRocm93IG5ldyBFcnJvcihcIkNvcnJ1cHRlZCB6aXA6IGNhbid0IGZpbmQgdGhlIFpJUDY0IGVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeVwiKTt0aGlzLnJlYWRlci5zZXRJbmRleCh0aGlzLnJlbGF0aXZlT2Zmc2V0RW5kT2ZaaXA2NENlbnRyYWxEaXIpLHRoaXMuY2hlY2tTaWduYXR1cmUoZy5aSVA2NF9DRU5UUkFMX0RJUkVDVE9SWV9FTkQpLHRoaXMucmVhZEJsb2NrWmlwNjRFbmRPZkNlbnRyYWwoKX12YXIgZD10aGlzLmNlbnRyYWxEaXJPZmZzZXQrdGhpcy5jZW50cmFsRGlyU2l6ZTt0aGlzLnppcDY0JiYoZCs9MjAsZCs9MTIrdGhpcy56aXA2NEVuZE9mQ2VudHJhbFNpemUpO3ZhciBlPWMtZDtpZihlPjApdGhpcy5pc1NpZ25hdHVyZShjLGcuQ0VOVFJBTF9GSUxFX0hFQURFUil8fCh0aGlzLnJlYWRlci56ZXJvPWUpO2Vsc2UgaWYoZTwwKXRocm93IG5ldyBFcnJvcihcIkNvcnJ1cHRlZCB6aXA6IG1pc3NpbmcgXCIrTWF0aC5hYnMoZSkrXCIgYnl0ZXMuXCIpfSxwcmVwYXJlUmVhZGVyOmZ1bmN0aW9uKGEpe3RoaXMucmVhZGVyPWUoYSl9LGxvYWQ6ZnVuY3Rpb24oYSl7dGhpcy5wcmVwYXJlUmVhZGVyKGEpLHRoaXMucmVhZEVuZE9mQ2VudHJhbCgpLHRoaXMucmVhZENlbnRyYWxEaXIoKSx0aGlzLnJlYWRMb2NhbEZpbGVzKCl9fSxiLmV4cG9ydHM9ZH0se1wiLi9yZWFkZXIvcmVhZGVyRm9yXCI6MjIsXCIuL3NpZ25hdHVyZVwiOjIzLFwiLi9zdXBwb3J0XCI6MzAsXCIuL3V0ZjhcIjozMSxcIi4vdXRpbHNcIjozMixcIi4vemlwRW50cnlcIjozNH1dLDM0OltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhLGIpe3RoaXMub3B0aW9ucz1hLHRoaXMubG9hZE9wdGlvbnM9Yn12YXIgZT1hKFwiLi9yZWFkZXIvcmVhZGVyRm9yXCIpLGY9YShcIi4vdXRpbHNcIiksZz1hKFwiLi9jb21wcmVzc2VkT2JqZWN0XCIpLGg9YShcIi4vY3JjMzJcIiksaT1hKFwiLi91dGY4XCIpLGo9YShcIi4vY29tcHJlc3Npb25zXCIpLGs9YShcIi4vc3VwcG9ydFwiKSxsPTAsbT0zLG49ZnVuY3Rpb24oYSl7Zm9yKHZhciBiIGluIGopaWYoai5oYXNPd25Qcm9wZXJ0eShiKSYmaltiXS5tYWdpYz09PWEpcmV0dXJuIGpbYl07cmV0dXJuIG51bGx9O2QucHJvdG90eXBlPXtpc0VuY3J5cHRlZDpmdW5jdGlvbigpe3JldHVybiAxPT09KDEmdGhpcy5iaXRGbGFnKX0sdXNlVVRGODpmdW5jdGlvbigpe3JldHVybiAyMDQ4PT09KDIwNDgmdGhpcy5iaXRGbGFnKX0scmVhZExvY2FsUGFydDpmdW5jdGlvbihhKXt2YXIgYixjO2lmKGEuc2tpcCgyMiksdGhpcy5maWxlTmFtZUxlbmd0aD1hLnJlYWRJbnQoMiksYz1hLnJlYWRJbnQoMiksdGhpcy5maWxlTmFtZT1hLnJlYWREYXRhKHRoaXMuZmlsZU5hbWVMZW5ndGgpLGEuc2tpcChjKSx0aGlzLmNvbXByZXNzZWRTaXplPT09LTF8fHRoaXMudW5jb21wcmVzc2VkU2l6ZT09PS0xKXRocm93IG5ldyBFcnJvcihcIkJ1ZyBvciBjb3JydXB0ZWQgemlwIDogZGlkbid0IGdldCBlbm91Z2ggaW5mb3JtYXRpb25zIGZyb20gdGhlIGNlbnRyYWwgZGlyZWN0b3J5IChjb21wcmVzc2VkU2l6ZSA9PT0gLTEgfHwgdW5jb21wcmVzc2VkU2l6ZSA9PT0gLTEpXCIpO2lmKGI9bih0aGlzLmNvbXByZXNzaW9uTWV0aG9kKSxudWxsPT09Yil0aHJvdyBuZXcgRXJyb3IoXCJDb3JydXB0ZWQgemlwIDogY29tcHJlc3Npb24gXCIrZi5wcmV0dHkodGhpcy5jb21wcmVzc2lvbk1ldGhvZCkrXCIgdW5rbm93biAoaW5uZXIgZmlsZSA6IFwiK2YudHJhbnNmb3JtVG8oXCJzdHJpbmdcIix0aGlzLmZpbGVOYW1lKStcIilcIik7dGhpcy5kZWNvbXByZXNzZWQ9bmV3IGcodGhpcy5jb21wcmVzc2VkU2l6ZSx0aGlzLnVuY29tcHJlc3NlZFNpemUsdGhpcy5jcmMzMixiLGEucmVhZERhdGEodGhpcy5jb21wcmVzc2VkU2l6ZSkpfSxyZWFkQ2VudHJhbFBhcnQ6ZnVuY3Rpb24oYSl7dGhpcy52ZXJzaW9uTWFkZUJ5PWEucmVhZEludCgyKSxhLnNraXAoMiksdGhpcy5iaXRGbGFnPWEucmVhZEludCgyKSx0aGlzLmNvbXByZXNzaW9uTWV0aG9kPWEucmVhZFN0cmluZygyKSx0aGlzLmRhdGU9YS5yZWFkRGF0ZSgpLHRoaXMuY3JjMzI9YS5yZWFkSW50KDQpLHRoaXMuY29tcHJlc3NlZFNpemU9YS5yZWFkSW50KDQpLHRoaXMudW5jb21wcmVzc2VkU2l6ZT1hLnJlYWRJbnQoNCk7dmFyIGI9YS5yZWFkSW50KDIpO2lmKHRoaXMuZXh0cmFGaWVsZHNMZW5ndGg9YS5yZWFkSW50KDIpLHRoaXMuZmlsZUNvbW1lbnRMZW5ndGg9YS5yZWFkSW50KDIpLHRoaXMuZGlza051bWJlclN0YXJ0PWEucmVhZEludCgyKSx0aGlzLmludGVybmFsRmlsZUF0dHJpYnV0ZXM9YS5yZWFkSW50KDIpLHRoaXMuZXh0ZXJuYWxGaWxlQXR0cmlidXRlcz1hLnJlYWRJbnQoNCksdGhpcy5sb2NhbEhlYWRlck9mZnNldD1hLnJlYWRJbnQoNCksdGhpcy5pc0VuY3J5cHRlZCgpKXRocm93IG5ldyBFcnJvcihcIkVuY3J5cHRlZCB6aXAgYXJlIG5vdCBzdXBwb3J0ZWRcIik7YS5za2lwKGIpLHRoaXMucmVhZEV4dHJhRmllbGRzKGEpLHRoaXMucGFyc2VaSVA2NEV4dHJhRmllbGQoYSksdGhpcy5maWxlQ29tbWVudD1hLnJlYWREYXRhKHRoaXMuZmlsZUNvbW1lbnRMZW5ndGgpfSxwcm9jZXNzQXR0cmlidXRlczpmdW5jdGlvbigpe3RoaXMudW5peFBlcm1pc3Npb25zPW51bGwsdGhpcy5kb3NQZXJtaXNzaW9ucz1udWxsO3ZhciBhPXRoaXMudmVyc2lvbk1hZGVCeT4+ODt0aGlzLmRpcj0hISgxNiZ0aGlzLmV4dGVybmFsRmlsZUF0dHJpYnV0ZXMpLGE9PT1sJiYodGhpcy5kb3NQZXJtaXNzaW9ucz02MyZ0aGlzLmV4dGVybmFsRmlsZUF0dHJpYnV0ZXMpLGE9PT1tJiYodGhpcy51bml4UGVybWlzc2lvbnM9dGhpcy5leHRlcm5hbEZpbGVBdHRyaWJ1dGVzPj4xNiY2NTUzNSksdGhpcy5kaXJ8fFwiL1wiIT09dGhpcy5maWxlTmFtZVN0ci5zbGljZSgtMSl8fCh0aGlzLmRpcj0hMCl9LHBhcnNlWklQNjRFeHRyYUZpZWxkOmZ1bmN0aW9uKGEpe2lmKHRoaXMuZXh0cmFGaWVsZHNbMV0pe3ZhciBiPWUodGhpcy5leHRyYUZpZWxkc1sxXS52YWx1ZSk7dGhpcy51bmNvbXByZXNzZWRTaXplPT09Zi5NQVhfVkFMVUVfMzJCSVRTJiYodGhpcy51bmNvbXByZXNzZWRTaXplPWIucmVhZEludCg4KSksdGhpcy5jb21wcmVzc2VkU2l6ZT09PWYuTUFYX1ZBTFVFXzMyQklUUyYmKHRoaXMuY29tcHJlc3NlZFNpemU9Yi5yZWFkSW50KDgpKSx0aGlzLmxvY2FsSGVhZGVyT2Zmc2V0PT09Zi5NQVhfVkFMVUVfMzJCSVRTJiYodGhpcy5sb2NhbEhlYWRlck9mZnNldD1iLnJlYWRJbnQoOCkpLHRoaXMuZGlza051bWJlclN0YXJ0PT09Zi5NQVhfVkFMVUVfMzJCSVRTJiYodGhpcy5kaXNrTnVtYmVyU3RhcnQ9Yi5yZWFkSW50KDQpKX19LHJlYWRFeHRyYUZpZWxkczpmdW5jdGlvbihhKXt2YXIgYixjLGQsZT1hLmluZGV4K3RoaXMuZXh0cmFGaWVsZHNMZW5ndGg7Zm9yKHRoaXMuZXh0cmFGaWVsZHN8fCh0aGlzLmV4dHJhRmllbGRzPXt9KTthLmluZGV4PGU7KWI9YS5yZWFkSW50KDIpLGM9YS5yZWFkSW50KDIpLGQ9YS5yZWFkRGF0YShjKSx0aGlzLmV4dHJhRmllbGRzW2JdPXtpZDpiLGxlbmd0aDpjLHZhbHVlOmR9fSxoYW5kbGVVVEY4OmZ1bmN0aW9uKCl7dmFyIGE9ay51aW50OGFycmF5P1widWludDhhcnJheVwiOlwiYXJyYXlcIjtpZih0aGlzLnVzZVVURjgoKSl0aGlzLmZpbGVOYW1lU3RyPWkudXRmOGRlY29kZSh0aGlzLmZpbGVOYW1lKSx0aGlzLmZpbGVDb21tZW50U3RyPWkudXRmOGRlY29kZSh0aGlzLmZpbGVDb21tZW50KTtlbHNle3ZhciBiPXRoaXMuZmluZEV4dHJhRmllbGRVbmljb2RlUGF0aCgpO2lmKG51bGwhPT1iKXRoaXMuZmlsZU5hbWVTdHI9YjtlbHNle3ZhciBjPWYudHJhbnNmb3JtVG8oYSx0aGlzLmZpbGVOYW1lKTt0aGlzLmZpbGVOYW1lU3RyPXRoaXMubG9hZE9wdGlvbnMuZGVjb2RlRmlsZU5hbWUoYyl9dmFyIGQ9dGhpcy5maW5kRXh0cmFGaWVsZFVuaWNvZGVDb21tZW50KCk7aWYobnVsbCE9PWQpdGhpcy5maWxlQ29tbWVudFN0cj1kO2Vsc2V7dmFyIGU9Zi50cmFuc2Zvcm1UbyhhLHRoaXMuZmlsZUNvbW1lbnQpO3RoaXMuZmlsZUNvbW1lbnRTdHI9dGhpcy5sb2FkT3B0aW9ucy5kZWNvZGVGaWxlTmFtZShlKX19fSxmaW5kRXh0cmFGaWVsZFVuaWNvZGVQYXRoOmZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5leHRyYUZpZWxkc1syODc4OV07aWYoYSl7dmFyIGI9ZShhLnZhbHVlKTtyZXR1cm4gMSE9PWIucmVhZEludCgxKT9udWxsOmgodGhpcy5maWxlTmFtZSkhPT1iLnJlYWRJbnQoNCk/bnVsbDppLnV0ZjhkZWNvZGUoYi5yZWFkRGF0YShhLmxlbmd0aC01KSl9cmV0dXJuIG51bGx9LGZpbmRFeHRyYUZpZWxkVW5pY29kZUNvbW1lbnQ6ZnVuY3Rpb24oKXt2YXIgYT10aGlzLmV4dHJhRmllbGRzWzI1NDYxXTtpZihhKXt2YXIgYj1lKGEudmFsdWUpO3JldHVybiAxIT09Yi5yZWFkSW50KDEpP251bGw6aCh0aGlzLmZpbGVDb21tZW50KSE9PWIucmVhZEludCg0KT9udWxsOmkudXRmOGRlY29kZShiLnJlYWREYXRhKGEubGVuZ3RoLTUpKX1yZXR1cm4gbnVsbH19LGIuZXhwb3J0cz1kfSx7XCIuL2NvbXByZXNzZWRPYmplY3RcIjoyLFwiLi9jb21wcmVzc2lvbnNcIjozLFwiLi9jcmMzMlwiOjQsXCIuL3JlYWRlci9yZWFkZXJGb3JcIjoyMixcIi4vc3VwcG9ydFwiOjMwLFwiLi91dGY4XCI6MzEsXCIuL3V0aWxzXCI6MzJ9XSwzNTpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO3ZhciBkPWEoXCIuL3N0cmVhbS9TdHJlYW1IZWxwZXJcIiksZT1hKFwiLi9zdHJlYW0vRGF0YVdvcmtlclwiKSxmPWEoXCIuL3V0ZjhcIiksZz1hKFwiLi9jb21wcmVzc2VkT2JqZWN0XCIpLGg9YShcIi4vc3RyZWFtL0dlbmVyaWNXb3JrZXJcIiksaT1mdW5jdGlvbihhLGIsYyl7dGhpcy5uYW1lPWEsdGhpcy5kaXI9Yy5kaXIsdGhpcy5kYXRlPWMuZGF0ZSx0aGlzLmNvbW1lbnQ9Yy5jb21tZW50LHRoaXMudW5peFBlcm1pc3Npb25zPWMudW5peFBlcm1pc3Npb25zLHRoaXMuZG9zUGVybWlzc2lvbnM9Yy5kb3NQZXJtaXNzaW9ucyx0aGlzLl9kYXRhPWIsdGhpcy5fZGF0YUJpbmFyeT1jLmJpbmFyeSx0aGlzLm9wdGlvbnM9e2NvbXByZXNzaW9uOmMuY29tcHJlc3Npb24sY29tcHJlc3Npb25PcHRpb25zOmMuY29tcHJlc3Npb25PcHRpb25zfX07aS5wcm90b3R5cGU9e2ludGVybmFsU3RyZWFtOmZ1bmN0aW9uKGEpe3ZhciBiPW51bGwsYz1cInN0cmluZ1wiO3RyeXtpZighYSl0aHJvdyBuZXcgRXJyb3IoXCJObyBvdXRwdXQgdHlwZSBzcGVjaWZpZWQuXCIpO2M9YS50b0xvd2VyQ2FzZSgpO3ZhciBlPVwic3RyaW5nXCI9PT1jfHxcInRleHRcIj09PWM7XCJiaW5hcnlzdHJpbmdcIiE9PWMmJlwidGV4dFwiIT09Y3x8KGM9XCJzdHJpbmdcIiksYj10aGlzLl9kZWNvbXByZXNzV29ya2VyKCk7dmFyIGc9IXRoaXMuX2RhdGFCaW5hcnk7ZyYmIWUmJihiPWIucGlwZShuZXcgZi5VdGY4RW5jb2RlV29ya2VyKSksIWcmJmUmJihiPWIucGlwZShuZXcgZi5VdGY4RGVjb2RlV29ya2VyKSl9Y2F0Y2goaSl7Yj1uZXcgaChcImVycm9yXCIpLGIuZXJyb3IoaSl9cmV0dXJuIG5ldyBkKGIsYyxcIlwiKX0sYXN5bmM6ZnVuY3Rpb24oYSxiKXtyZXR1cm4gdGhpcy5pbnRlcm5hbFN0cmVhbShhKS5hY2N1bXVsYXRlKGIpfSxub2RlU3RyZWFtOmZ1bmN0aW9uKGEsYil7cmV0dXJuIHRoaXMuaW50ZXJuYWxTdHJlYW0oYXx8XCJub2RlYnVmZmVyXCIpLnRvTm9kZWpzU3RyZWFtKGIpfSxfY29tcHJlc3NXb3JrZXI6ZnVuY3Rpb24oYSxiKXtpZih0aGlzLl9kYXRhIGluc3RhbmNlb2YgZyYmdGhpcy5fZGF0YS5jb21wcmVzc2lvbi5tYWdpYz09PWEubWFnaWMpcmV0dXJuIHRoaXMuX2RhdGEuZ2V0Q29tcHJlc3NlZFdvcmtlcigpO3ZhciBjPXRoaXMuX2RlY29tcHJlc3NXb3JrZXIoKTtyZXR1cm4gdGhpcy5fZGF0YUJpbmFyeXx8KGM9Yy5waXBlKG5ldyBmLlV0ZjhFbmNvZGVXb3JrZXIpKSxnLmNyZWF0ZVdvcmtlckZyb20oYyxhLGIpfSxfZGVjb21wcmVzc1dvcmtlcjpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9kYXRhIGluc3RhbmNlb2YgZz90aGlzLl9kYXRhLmdldENvbnRlbnRXb3JrZXIoKTp0aGlzLl9kYXRhIGluc3RhbmNlb2YgaD90aGlzLl9kYXRhOm5ldyBlKHRoaXMuX2RhdGEpfX07Zm9yKHZhciBqPVtcImFzVGV4dFwiLFwiYXNCaW5hcnlcIixcImFzTm9kZUJ1ZmZlclwiLFwiYXNVaW50OEFycmF5XCIsXCJhc0FycmF5QnVmZmVyXCJdLGs9ZnVuY3Rpb24oKXt0aHJvdyBuZXcgRXJyb3IoXCJUaGlzIG1ldGhvZCBoYXMgYmVlbiByZW1vdmVkIGluIEpTWmlwIDMuMCwgcGxlYXNlIGNoZWNrIHRoZSB1cGdyYWRlIGd1aWRlLlwiKX0sbD0wO2w8ai5sZW5ndGg7bCsrKWkucHJvdG90eXBlW2pbbF1dPWs7Yi5leHBvcnRzPWl9LHtcIi4vY29tcHJlc3NlZE9iamVjdFwiOjIsXCIuL3N0cmVhbS9EYXRhV29ya2VyXCI6MjcsXCIuL3N0cmVhbS9HZW5lcmljV29ya2VyXCI6MjgsXCIuL3N0cmVhbS9TdHJlYW1IZWxwZXJcIjoyOSxcIi4vdXRmOFwiOjMxfV0sMzY6W2Z1bmN0aW9uKGEsYixjKXthKFwiLi4vbW9kdWxlcy93ZWIuaW1tZWRpYXRlXCIpLGIuZXhwb3J0cz1hKFwiLi4vbW9kdWxlcy9fY29yZVwiKS5zZXRJbW1lZGlhdGV9LHtcIi4uL21vZHVsZXMvX2NvcmVcIjo0MCxcIi4uL21vZHVsZXMvd2ViLmltbWVkaWF0ZVwiOjU2fV0sMzc6W2Z1bmN0aW9uKGEsYixjKXtiLmV4cG9ydHM9ZnVuY3Rpb24oYSl7aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgYSl0aHJvdyBUeXBlRXJyb3IoYStcIiBpcyBub3QgYSBmdW5jdGlvbiFcIik7cmV0dXJuIGF9fSx7fV0sMzg6W2Z1bmN0aW9uKGEsYixjKXt2YXIgZD1hKFwiLi9faXMtb2JqZWN0XCIpO2IuZXhwb3J0cz1mdW5jdGlvbihhKXtpZighZChhKSl0aHJvdyBUeXBlRXJyb3IoYStcIiBpcyBub3QgYW4gb2JqZWN0IVwiKTtyZXR1cm4gYX19LHtcIi4vX2lzLW9iamVjdFwiOjUxfV0sMzk6W2Z1bmN0aW9uKGEsYixjKXt2YXIgZD17fS50b1N0cmluZztiLmV4cG9ydHM9ZnVuY3Rpb24oYSl7cmV0dXJuIGQuY2FsbChhKS5zbGljZSg4LC0xKX19LHt9XSw0MDpbZnVuY3Rpb24oYSxiLGMpe3ZhciBkPWIuZXhwb3J0cz17dmVyc2lvbjpcIjIuMy4wXCJ9O1wibnVtYmVyXCI9PXR5cGVvZiBfX2UmJihfX2U9ZCl9LHt9XSw0MTpbZnVuY3Rpb24oYSxiLGMpe3ZhciBkPWEoXCIuL19hLWZ1bmN0aW9uXCIpO2IuZXhwb3J0cz1mdW5jdGlvbihhLGIsYyl7aWYoZChhKSx2b2lkIDA9PT1iKXJldHVybiBhO3N3aXRjaChjKXtjYXNlIDE6cmV0dXJuIGZ1bmN0aW9uKGMpe3JldHVybiBhLmNhbGwoYixjKX07Y2FzZSAyOnJldHVybiBmdW5jdGlvbihjLGQpe3JldHVybiBhLmNhbGwoYixjLGQpfTtjYXNlIDM6cmV0dXJuIGZ1bmN0aW9uKGMsZCxlKXtyZXR1cm4gYS5jYWxsKGIsYyxkLGUpfX1yZXR1cm4gZnVuY3Rpb24oKXtyZXR1cm4gYS5hcHBseShiLGFyZ3VtZW50cyl9fX0se1wiLi9fYS1mdW5jdGlvblwiOjM3fV0sNDI6W2Z1bmN0aW9uKGEsYixjKXtiLmV4cG9ydHM9IWEoXCIuL19mYWlsc1wiKShmdW5jdGlvbigpe3JldHVybiA3IT1PYmplY3QuZGVmaW5lUHJvcGVydHkoe30sXCJhXCIse2dldDpmdW5jdGlvbigpe3JldHVybiA3fX0pLmF9KX0se1wiLi9fZmFpbHNcIjo0NX1dLDQzOltmdW5jdGlvbihhLGIsYyl7dmFyIGQ9YShcIi4vX2lzLW9iamVjdFwiKSxlPWEoXCIuL19nbG9iYWxcIikuZG9jdW1lbnQsZj1kKGUpJiZkKGUuY3JlYXRlRWxlbWVudCk7Yi5leHBvcnRzPWZ1bmN0aW9uKGEpe3JldHVybiBmP2UuY3JlYXRlRWxlbWVudChhKTp7fX19LHtcIi4vX2dsb2JhbFwiOjQ2LFwiLi9faXMtb2JqZWN0XCI6NTF9XSw0NDpbZnVuY3Rpb24oYSxiLGMpe3ZhciBkPWEoXCIuL19nbG9iYWxcIiksZT1hKFwiLi9fY29yZVwiKSxmPWEoXCIuL19jdHhcIiksZz1hKFwiLi9faGlkZVwiKSxoPVwicHJvdG90eXBlXCIsaT1mdW5jdGlvbihhLGIsYyl7dmFyIGosayxsLG09YSZpLkYsbj1hJmkuRyxvPWEmaS5TLHA9YSZpLlAscT1hJmkuQixyPWEmaS5XLHM9bj9lOmVbYl18fChlW2JdPXt9KSx0PXNbaF0sdT1uP2Q6bz9kW2JdOihkW2JdfHx7fSlbaF07biYmKGM9Yik7Zm9yKGogaW4gYylrPSFtJiZ1JiZ2b2lkIDAhPT11W2pdLGsmJmogaW4gc3x8KGw9az91W2pdOmNbal0sc1tqXT1uJiZcImZ1bmN0aW9uXCIhPXR5cGVvZiB1W2pdP2Nbal06cSYmaz9mKGwsZCk6ciYmdVtqXT09bD9mdW5jdGlvbihhKXt2YXIgYj1mdW5jdGlvbihiLGMsZCl7aWYodGhpcyBpbnN0YW5jZW9mIGEpe3N3aXRjaChhcmd1bWVudHMubGVuZ3RoKXtjYXNlIDA6cmV0dXJuIG5ldyBhO2Nhc2UgMTpyZXR1cm4gbmV3IGEoYik7Y2FzZSAyOnJldHVybiBuZXcgYShiLGMpfXJldHVybiBuZXcgYShiLGMsZCl9cmV0dXJuIGEuYXBwbHkodGhpcyxhcmd1bWVudHMpfTtyZXR1cm4gYltoXT1hW2hdLGJ9KGwpOnAmJlwiZnVuY3Rpb25cIj09dHlwZW9mIGw/ZihGdW5jdGlvbi5jYWxsLGwpOmwscCYmKChzLnZpcnR1YWx8fChzLnZpcnR1YWw9e30pKVtqXT1sLGEmaS5SJiZ0JiYhdFtqXSYmZyh0LGosbCkpKX07aS5GPTEsaS5HPTIsaS5TPTQsaS5QPTgsaS5CPTE2LGkuVz0zMixpLlU9NjQsaS5SPTEyOCxiLmV4cG9ydHM9aX0se1wiLi9fY29yZVwiOjQwLFwiLi9fY3R4XCI6NDEsXCIuL19nbG9iYWxcIjo0NixcIi4vX2hpZGVcIjo0N31dLDQ1OltmdW5jdGlvbihhLGIsYyl7Yi5leHBvcnRzPWZ1bmN0aW9uKGEpe3RyeXtyZXR1cm4hIWEoKX1jYXRjaChiKXtyZXR1cm4hMH19fSx7fV0sNDY6W2Z1bmN0aW9uKGEsYixjKXt2YXIgZD1iLmV4cG9ydHM9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdyYmd2luZG93Lk1hdGg9PU1hdGg/d2luZG93OlwidW5kZWZpbmVkXCIhPXR5cGVvZiBzZWxmJiZzZWxmLk1hdGg9PU1hdGg/c2VsZjpGdW5jdGlvbihcInJldHVybiB0aGlzXCIpKCk7XCJudW1iZXJcIj09dHlwZW9mIF9fZyYmKF9fZz1kKX0se31dLDQ3OltmdW5jdGlvbihhLGIsYyl7dmFyIGQ9YShcIi4vX29iamVjdC1kcFwiKSxlPWEoXCIuL19wcm9wZXJ0eS1kZXNjXCIpO2IuZXhwb3J0cz1hKFwiLi9fZGVzY3JpcHRvcnNcIik/ZnVuY3Rpb24oYSxiLGMpe3JldHVybiBkLmYoYSxiLGUoMSxjKSl9OmZ1bmN0aW9uKGEsYixjKXtyZXR1cm4gYVtiXT1jLGF9fSx7XCIuL19kZXNjcmlwdG9yc1wiOjQyLFwiLi9fb2JqZWN0LWRwXCI6NTIsXCIuL19wcm9wZXJ0eS1kZXNjXCI6NTN9XSw0ODpbZnVuY3Rpb24oYSxiLGMpe2IuZXhwb3J0cz1hKFwiLi9fZ2xvYmFsXCIpLmRvY3VtZW50JiZkb2N1bWVudC5kb2N1bWVudEVsZW1lbnR9LHtcIi4vX2dsb2JhbFwiOjQ2fV0sNDk6W2Z1bmN0aW9uKGEsYixjKXtiLmV4cG9ydHM9IWEoXCIuL19kZXNjcmlwdG9yc1wiKSYmIWEoXCIuL19mYWlsc1wiKShmdW5jdGlvbigpe3JldHVybiA3IT1PYmplY3QuZGVmaW5lUHJvcGVydHkoYShcIi4vX2RvbS1jcmVhdGVcIikoXCJkaXZcIiksXCJhXCIse2dldDpmdW5jdGlvbigpe3JldHVybiA3fX0pLmF9KX0se1wiLi9fZGVzY3JpcHRvcnNcIjo0MixcIi4vX2RvbS1jcmVhdGVcIjo0MyxcIi4vX2ZhaWxzXCI6NDV9XSw1MDpbZnVuY3Rpb24oYSxiLGMpe2IuZXhwb3J0cz1mdW5jdGlvbihhLGIsYyl7dmFyIGQ9dm9pZCAwPT09Yztzd2l0Y2goYi5sZW5ndGgpe2Nhc2UgMDpyZXR1cm4gZD9hKCk6YS5jYWxsKGMpO2Nhc2UgMTpyZXR1cm4gZD9hKGJbMF0pOmEuY2FsbChjLGJbMF0pO2Nhc2UgMjpyZXR1cm4gZD9hKGJbMF0sYlsxXSk6YS5jYWxsKGMsYlswXSxiWzFdKTtjYXNlIDM6cmV0dXJuIGQ/YShiWzBdLGJbMV0sYlsyXSk6YS5jYWxsKGMsYlswXSxiWzFdLGJbMl0pO2Nhc2UgNDpyZXR1cm4gZD9hKGJbMF0sYlsxXSxiWzJdLGJbM10pOmEuY2FsbChjLGJbMF0sYlsxXSxiWzJdLGJbM10pfXJldHVybiBhLmFwcGx5KGMsYil9fSx7fV0sNTE6W2Z1bmN0aW9uKGEsYixjKXtiLmV4cG9ydHM9ZnVuY3Rpb24oYSl7cmV0dXJuXCJvYmplY3RcIj09dHlwZW9mIGE/bnVsbCE9PWE6XCJmdW5jdGlvblwiPT10eXBlb2YgYX19LHt9XSw1MjpbZnVuY3Rpb24oYSxiLGMpe3ZhciBkPWEoXCIuL19hbi1vYmplY3RcIiksZT1hKFwiLi9faWU4LWRvbS1kZWZpbmVcIiksZj1hKFwiLi9fdG8tcHJpbWl0aXZlXCIpLGc9T2JqZWN0LmRlZmluZVByb3BlcnR5O2MuZj1hKFwiLi9fZGVzY3JpcHRvcnNcIik/T2JqZWN0LmRlZmluZVByb3BlcnR5OmZ1bmN0aW9uKGEsYixjKXtpZihkKGEpLGI9ZihiLCEwKSxkKGMpLGUpdHJ5e3JldHVybiBnKGEsYixjKX1jYXRjaChoKXt9aWYoXCJnZXRcImluIGN8fFwic2V0XCJpbiBjKXRocm93IFR5cGVFcnJvcihcIkFjY2Vzc29ycyBub3Qgc3VwcG9ydGVkIVwiKTtyZXR1cm5cInZhbHVlXCJpbiBjJiYoYVtiXT1jLnZhbHVlKSxhfX0se1wiLi9fYW4tb2JqZWN0XCI6MzgsXCIuL19kZXNjcmlwdG9yc1wiOjQyLFwiLi9faWU4LWRvbS1kZWZpbmVcIjo0OSxcIi4vX3RvLXByaW1pdGl2ZVwiOjU1fV0sNTM6W2Z1bmN0aW9uKGEsYixjKXtiLmV4cG9ydHM9ZnVuY3Rpb24oYSxiKXtyZXR1cm57ZW51bWVyYWJsZTohKDEmYSksY29uZmlndXJhYmxlOiEoMiZhKSx3cml0YWJsZTohKDQmYSksdmFsdWU6Yn19fSx7fV0sNTQ6W2Z1bmN0aW9uKGEsYixjKXt2YXIgZCxlLGYsZz1hKFwiLi9fY3R4XCIpLGg9YShcIi4vX2ludm9rZVwiKSxpPWEoXCIuL19odG1sXCIpLGo9YShcIi4vX2RvbS1jcmVhdGVcIiksaz1hKFwiLi9fZ2xvYmFsXCIpLGw9ay5wcm9jZXNzLG09ay5zZXRJbW1lZGlhdGUsbj1rLmNsZWFySW1tZWRpYXRlLG89ay5NZXNzYWdlQ2hhbm5lbCxwPTAscT17fSxyPVwib25yZWFkeXN0YXRlY2hhbmdlXCIscz1mdW5jdGlvbigpe3ZhciBhPSt0aGlzO2lmKHEuaGFzT3duUHJvcGVydHkoYSkpe3ZhciBiPXFbYV07ZGVsZXRlIHFbYV0sYigpfX0sdD1mdW5jdGlvbihhKXtzLmNhbGwoYS5kYXRhKX07bSYmbnx8KG09ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPVtdLGM9MTthcmd1bWVudHMubGVuZ3RoPmM7KWIucHVzaChhcmd1bWVudHNbYysrXSk7cmV0dXJuIHFbKytwXT1mdW5jdGlvbigpe2goXCJmdW5jdGlvblwiPT10eXBlb2YgYT9hOkZ1bmN0aW9uKGEpLGIpfSxkKHApLHB9LG49ZnVuY3Rpb24oYSl7ZGVsZXRlIHFbYV19LFwicHJvY2Vzc1wiPT1hKFwiLi9fY29mXCIpKGwpP2Q9ZnVuY3Rpb24oYSl7bC5uZXh0VGljayhnKHMsYSwxKSl9Om8/KGU9bmV3IG8sZj1lLnBvcnQyLGUucG9ydDEub25tZXNzYWdlPXQsZD1nKGYucG9zdE1lc3NhZ2UsZiwxKSk6ay5hZGRFdmVudExpc3RlbmVyJiZcImZ1bmN0aW9uXCI9PXR5cGVvZiBwb3N0TWVzc2FnZSYmIWsuaW1wb3J0U2NyaXB0cz8oZD1mdW5jdGlvbihhKXtrLnBvc3RNZXNzYWdlKGErXCJcIixcIipcIil9LGsuYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIix0LCExKSk6ZD1yIGluIGooXCJzY3JpcHRcIik/ZnVuY3Rpb24oYSl7aS5hcHBlbmRDaGlsZChqKFwic2NyaXB0XCIpKVtyXT1mdW5jdGlvbigpe2kucmVtb3ZlQ2hpbGQodGhpcykscy5jYWxsKGEpfX06ZnVuY3Rpb24oYSl7c2V0VGltZW91dChnKHMsYSwxKSwwKX0pLGIuZXhwb3J0cz17c2V0Om0sY2xlYXI6bn19LHtcIi4vX2NvZlwiOjM5LFwiLi9fY3R4XCI6NDEsXCIuL19kb20tY3JlYXRlXCI6NDMsXCIuL19nbG9iYWxcIjo0NixcIi4vX2h0bWxcIjo0OCxcIi4vX2ludm9rZVwiOjUwfV0sNTU6W2Z1bmN0aW9uKGEsYixjKXt2YXIgZD1hKFwiLi9faXMtb2JqZWN0XCIpO2IuZXhwb3J0cz1mdW5jdGlvbihhLGIpe2lmKCFkKGEpKXJldHVybiBhO3ZhciBjLGU7aWYoYiYmXCJmdW5jdGlvblwiPT10eXBlb2YoYz1hLnRvU3RyaW5nKSYmIWQoZT1jLmNhbGwoYSkpKXJldHVybiBlO2lmKFwiZnVuY3Rpb25cIj09dHlwZW9mKGM9YS52YWx1ZU9mKSYmIWQoZT1jLmNhbGwoYSkpKXJldHVybiBlO2lmKCFiJiZcImZ1bmN0aW9uXCI9PXR5cGVvZihjPWEudG9TdHJpbmcpJiYhZChlPWMuY2FsbChhKSkpcmV0dXJuIGU7dGhyb3cgVHlwZUVycm9yKFwiQ2FuJ3QgY29udmVydCBvYmplY3QgdG8gcHJpbWl0aXZlIHZhbHVlXCIpfX0se1wiLi9faXMtb2JqZWN0XCI6NTF9XSw1NjpbZnVuY3Rpb24oYSxiLGMpe3ZhciBkPWEoXCIuL19leHBvcnRcIiksZT1hKFwiLi9fdGFza1wiKTtkKGQuRytkLkIse3NldEltbWVkaWF0ZTplLnNldCxjbGVhckltbWVkaWF0ZTplLmNsZWFyfSl9LHtcIi4vX2V4cG9ydFwiOjQ0LFwiLi9fdGFza1wiOjU0fV0sNTc6W2Z1bmN0aW9uKGEsYixjKXsoZnVuY3Rpb24oYSl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gYygpe2s9ITA7Zm9yKHZhciBhLGIsYz1sLmxlbmd0aDtjOyl7Zm9yKGI9bCxsPVtdLGE9LTE7KythPGM7KWJbYV0oKTtjPWwubGVuZ3RofWs9ITF9ZnVuY3Rpb24gZChhKXsxIT09bC5wdXNoKGEpfHxrfHxlKCl9dmFyIGUsZj1hLk11dGF0aW9uT2JzZXJ2ZXJ8fGEuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjtpZihmKXt2YXIgZz0wLGg9bmV3IGYoYyksaT1hLmRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpO2gub2JzZXJ2ZShpLHtjaGFyYWN0ZXJEYXRhOiEwfSksZT1mdW5jdGlvbigpe2kuZGF0YT1nPSsrZyUyfX1lbHNlIGlmKGEuc2V0SW1tZWRpYXRlfHxcInVuZGVmaW5lZFwiPT10eXBlb2YgYS5NZXNzYWdlQ2hhbm5lbCllPVwiZG9jdW1lbnRcImluIGEmJlwib25yZWFkeXN0YXRlY2hhbmdlXCJpbiBhLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik/ZnVuY3Rpb24oKXt2YXIgYj1hLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7Yi5vbnJlYWR5c3RhdGVjaGFuZ2U9ZnVuY3Rpb24oKXtjKCksYi5vbnJlYWR5c3RhdGVjaGFuZ2U9bnVsbCxiLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYiksYj1udWxsfSxhLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hcHBlbmRDaGlsZChiKX06ZnVuY3Rpb24oKXtzZXRUaW1lb3V0KGMsMCl9O2Vsc2V7dmFyIGo9bmV3IGEuTWVzc2FnZUNoYW5uZWw7ai5wb3J0MS5vbm1lc3NhZ2U9YyxlPWZ1bmN0aW9uKCl7ai5wb3J0Mi5wb3N0TWVzc2FnZSgwKX19dmFyIGssbD1bXTtiLmV4cG9ydHM9ZH0pLmNhbGwodGhpcyxcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP2dsb2JhbDpcInVuZGVmaW5lZFwiIT10eXBlb2Ygc2VsZj9zZWxmOlwidW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3c/d2luZG93Ont9KX0se31dLDU4OltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZCgpe31mdW5jdGlvbiBlKGEpe2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGEpdGhyb3cgbmV3IFR5cGVFcnJvcihcInJlc29sdmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTt0aGlzLnN0YXRlPXMsdGhpcy5xdWV1ZT1bXSx0aGlzLm91dGNvbWU9dm9pZCAwLGEhPT1kJiZpKHRoaXMsYSl9ZnVuY3Rpb24gZihhLGIsYyl7dGhpcy5wcm9taXNlPWEsXCJmdW5jdGlvblwiPT10eXBlb2YgYiYmKHRoaXMub25GdWxmaWxsZWQ9Yix0aGlzLmNhbGxGdWxmaWxsZWQ9dGhpcy5vdGhlckNhbGxGdWxmaWxsZWQpLFwiZnVuY3Rpb25cIj09dHlwZW9mIGMmJih0aGlzLm9uUmVqZWN0ZWQ9Yyx0aGlzLmNhbGxSZWplY3RlZD10aGlzLm90aGVyQ2FsbFJlamVjdGVkKX1mdW5jdGlvbiBnKGEsYixjKXtvKGZ1bmN0aW9uKCl7dmFyIGQ7dHJ5e2Q9YihjKX1jYXRjaChlKXtyZXR1cm4gcC5yZWplY3QoYSxlKX1kPT09YT9wLnJlamVjdChhLG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVzb2x2ZSBwcm9taXNlIHdpdGggaXRzZWxmXCIpKTpwLnJlc29sdmUoYSxkKX0pfWZ1bmN0aW9uIGgoYSl7dmFyIGI9YSYmYS50aGVuO2lmKGEmJihcIm9iamVjdFwiPT10eXBlb2YgYXx8XCJmdW5jdGlvblwiPT10eXBlb2YgYSkmJlwiZnVuY3Rpb25cIj09dHlwZW9mIGIpcmV0dXJuIGZ1bmN0aW9uKCl7Yi5hcHBseShhLGFyZ3VtZW50cyl9fWZ1bmN0aW9uIGkoYSxiKXtmdW5jdGlvbiBjKGIpe2Z8fChmPSEwLHAucmVqZWN0KGEsYikpfWZ1bmN0aW9uIGQoYil7Znx8KGY9ITAscC5yZXNvbHZlKGEsYikpfWZ1bmN0aW9uIGUoKXtiKGQsYyl9dmFyIGY9ITEsZz1qKGUpO1wiZXJyb3JcIj09PWcuc3RhdHVzJiZjKGcudmFsdWUpfWZ1bmN0aW9uIGooYSxiKXt2YXIgYz17fTt0cnl7Yy52YWx1ZT1hKGIpLGMuc3RhdHVzPVwic3VjY2Vzc1wifWNhdGNoKGQpe2Muc3RhdHVzPVwiZXJyb3JcIixjLnZhbHVlPWR9cmV0dXJuIGN9ZnVuY3Rpb24gayhhKXtyZXR1cm4gYSBpbnN0YW5jZW9mIHRoaXM/YTpwLnJlc29sdmUobmV3IHRoaXMoZCksYSl9ZnVuY3Rpb24gbChhKXt2YXIgYj1uZXcgdGhpcyhkKTtyZXR1cm4gcC5yZWplY3QoYixhKX1mdW5jdGlvbiBtKGEpe2Z1bmN0aW9uIGIoYSxiKXtmdW5jdGlvbiBkKGEpe2dbYl09YSwrK2ghPT1lfHxmfHwoZj0hMCxwLnJlc29sdmUoaixnKSl9Yy5yZXNvbHZlKGEpLnRoZW4oZCxmdW5jdGlvbihhKXtmfHwoZj0hMCxwLnJlamVjdChqLGEpKX0pfXZhciBjPXRoaXM7aWYoXCJbb2JqZWN0IEFycmF5XVwiIT09T2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGEpKXJldHVybiB0aGlzLnJlamVjdChuZXcgVHlwZUVycm9yKFwibXVzdCBiZSBhbiBhcnJheVwiKSk7dmFyIGU9YS5sZW5ndGgsZj0hMTtpZighZSlyZXR1cm4gdGhpcy5yZXNvbHZlKFtdKTtmb3IodmFyIGc9bmV3IEFycmF5KGUpLGg9MCxpPS0xLGo9bmV3IHRoaXMoZCk7KytpPGU7KWIoYVtpXSxpKTtyZXR1cm4gan1mdW5jdGlvbiBuKGEpe2Z1bmN0aW9uIGIoYSl7Yy5yZXNvbHZlKGEpLnRoZW4oZnVuY3Rpb24oYSl7Znx8KGY9ITAscC5yZXNvbHZlKGgsYSkpfSxmdW5jdGlvbihhKXtmfHwoZj0hMCxwLnJlamVjdChoLGEpKX0pfXZhciBjPXRoaXM7aWYoXCJbb2JqZWN0IEFycmF5XVwiIT09T2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGEpKXJldHVybiB0aGlzLnJlamVjdChuZXcgVHlwZUVycm9yKFwibXVzdCBiZSBhbiBhcnJheVwiKSk7dmFyIGU9YS5sZW5ndGgsZj0hMTtpZighZSlyZXR1cm4gdGhpcy5yZXNvbHZlKFtdKTtmb3IodmFyIGc9LTEsaD1uZXcgdGhpcyhkKTsrK2c8ZTspYihhW2ddKTtyZXR1cm4gaH12YXIgbz1hKFwiaW1tZWRpYXRlXCIpLHA9e30scT1bXCJSRUpFQ1RFRFwiXSxyPVtcIkZVTEZJTExFRFwiXSxzPVtcIlBFTkRJTkdcIl07Yi5leHBvcnRzPWUsZS5wcm90b3R5cGVbXCJjYXRjaFwiXT1mdW5jdGlvbihhKXtyZXR1cm4gdGhpcy50aGVuKG51bGwsYSl9LGUucHJvdG90eXBlLnRoZW49ZnVuY3Rpb24oYSxiKXtpZihcImZ1bmN0aW9uXCIhPXR5cGVvZiBhJiZ0aGlzLnN0YXRlPT09cnx8XCJmdW5jdGlvblwiIT10eXBlb2YgYiYmdGhpcy5zdGF0ZT09PXEpcmV0dXJuIHRoaXM7dmFyIGM9bmV3IHRoaXMuY29uc3RydWN0b3IoZCk7aWYodGhpcy5zdGF0ZSE9PXMpe3ZhciBlPXRoaXMuc3RhdGU9PT1yP2E6YjtnKGMsZSx0aGlzLm91dGNvbWUpfWVsc2UgdGhpcy5xdWV1ZS5wdXNoKG5ldyBmKGMsYSxiKSk7cmV0dXJuIGN9LGYucHJvdG90eXBlLmNhbGxGdWxmaWxsZWQ9ZnVuY3Rpb24oYSl7cC5yZXNvbHZlKHRoaXMucHJvbWlzZSxhKX0sZi5wcm90b3R5cGUub3RoZXJDYWxsRnVsZmlsbGVkPWZ1bmN0aW9uKGEpe2codGhpcy5wcm9taXNlLHRoaXMub25GdWxmaWxsZWQsYSl9LGYucHJvdG90eXBlLmNhbGxSZWplY3RlZD1mdW5jdGlvbihhKXtwLnJlamVjdCh0aGlzLnByb21pc2UsYSl9LGYucHJvdG90eXBlLm90aGVyQ2FsbFJlamVjdGVkPWZ1bmN0aW9uKGEpe2codGhpcy5wcm9taXNlLHRoaXMub25SZWplY3RlZCxhKX0scC5yZXNvbHZlPWZ1bmN0aW9uKGEsYil7dmFyIGM9aihoLGIpO2lmKFwiZXJyb3JcIj09PWMuc3RhdHVzKXJldHVybiBwLnJlamVjdChhLGMudmFsdWUpO3ZhciBkPWMudmFsdWU7aWYoZClpKGEsZCk7ZWxzZXthLnN0YXRlPXIsYS5vdXRjb21lPWI7Zm9yKHZhciBlPS0xLGY9YS5xdWV1ZS5sZW5ndGg7KytlPGY7KWEucXVldWVbZV0uY2FsbEZ1bGZpbGxlZChiKX1yZXR1cm4gYX0scC5yZWplY3Q9ZnVuY3Rpb24oYSxiKXthLnN0YXRlPXEsYS5vdXRjb21lPWI7Zm9yKHZhciBjPS0xLGQ9YS5xdWV1ZS5sZW5ndGg7KytjPGQ7KWEucXVldWVbY10uY2FsbFJlamVjdGVkKGIpO3JldHVybiBhfSxlLnJlc29sdmU9ayxlLnJlamVjdD1sLGUuYWxsPW0sZS5yYWNlPW59LHtpbW1lZGlhdGU6NTd9XSw1OTpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO3ZhciBkPWEoXCIuL2xpYi91dGlscy9jb21tb25cIikuYXNzaWduLGU9YShcIi4vbGliL2RlZmxhdGVcIiksZj1hKFwiLi9saWIvaW5mbGF0ZVwiKSxnPWEoXCIuL2xpYi96bGliL2NvbnN0YW50c1wiKSxoPXt9O2QoaCxlLGYsZyksYi5leHBvcnRzPWh9LHtcIi4vbGliL2RlZmxhdGVcIjo2MCxcIi4vbGliL2luZmxhdGVcIjo2MSxcIi4vbGliL3V0aWxzL2NvbW1vblwiOjYyLFwiLi9saWIvemxpYi9jb25zdGFudHNcIjo2NX1dLDYwOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhKXtpZighKHRoaXMgaW5zdGFuY2VvZiBkKSlyZXR1cm4gbmV3IGQoYSk7dGhpcy5vcHRpb25zPWkuYXNzaWduKHtsZXZlbDpzLG1ldGhvZDp1LGNodW5rU2l6ZToxNjM4NCx3aW5kb3dCaXRzOjE1LG1lbUxldmVsOjgsc3RyYXRlZ3k6dCx0bzpcIlwifSxhfHx7fSk7dmFyIGI9dGhpcy5vcHRpb25zO2IucmF3JiZiLndpbmRvd0JpdHM+MD9iLndpbmRvd0JpdHM9LWIud2luZG93Qml0czpiLmd6aXAmJmIud2luZG93Qml0cz4wJiZiLndpbmRvd0JpdHM8MTYmJihiLndpbmRvd0JpdHMrPTE2KSx0aGlzLmVycj0wLHRoaXMubXNnPVwiXCIsdGhpcy5lbmRlZD0hMSx0aGlzLmNodW5rcz1bXSx0aGlzLnN0cm09bmV3IGwsdGhpcy5zdHJtLmF2YWlsX291dD0wO3ZhciBjPWguZGVmbGF0ZUluaXQyKHRoaXMuc3RybSxiLmxldmVsLGIubWV0aG9kLGIud2luZG93Qml0cyxiLm1lbUxldmVsLGIuc3RyYXRlZ3kpO2lmKGMhPT1wKXRocm93IG5ldyBFcnJvcihrW2NdKTtpZihiLmhlYWRlciYmaC5kZWZsYXRlU2V0SGVhZGVyKHRoaXMuc3RybSxiLmhlYWRlciksYi5kaWN0aW9uYXJ5KXt2YXIgZTtpZihlPVwic3RyaW5nXCI9PXR5cGVvZiBiLmRpY3Rpb25hcnk/ai5zdHJpbmcyYnVmKGIuZGljdGlvbmFyeSk6XCJbb2JqZWN0IEFycmF5QnVmZmVyXVwiPT09bS5jYWxsKGIuZGljdGlvbmFyeSk/bmV3IFVpbnQ4QXJyYXkoYi5kaWN0aW9uYXJ5KTpiLmRpY3Rpb25hcnksYz1oLmRlZmxhdGVTZXREaWN0aW9uYXJ5KHRoaXMuc3RybSxlKSxjIT09cCl0aHJvdyBuZXcgRXJyb3Ioa1tjXSk7dGhpcy5fZGljdF9zZXQ9ITB9fWZ1bmN0aW9uIGUoYSxiKXt2YXIgYz1uZXcgZChiKTtpZihjLnB1c2goYSwhMCksYy5lcnIpdGhyb3cgYy5tc2d8fGtbYy5lcnJdO3JldHVybiBjLnJlc3VsdH1mdW5jdGlvbiBmKGEsYil7cmV0dXJuIGI9Ynx8e30sYi5yYXc9ITAsZShhLGIpfWZ1bmN0aW9uIGcoYSxiKXtyZXR1cm4gYj1ifHx7fSxiLmd6aXA9ITAsZShhLGIpfXZhciBoPWEoXCIuL3psaWIvZGVmbGF0ZVwiKSxpPWEoXCIuL3V0aWxzL2NvbW1vblwiKSxqPWEoXCIuL3V0aWxzL3N0cmluZ3NcIiksaz1hKFwiLi96bGliL21lc3NhZ2VzXCIpLGw9YShcIi4vemxpYi96c3RyZWFtXCIpLG09T2JqZWN0LnByb3RvdHlwZS50b1N0cmluZyxuPTAsbz00LHA9MCxxPTEscj0yLHM9LTEsdD0wLHU9ODtkLnByb3RvdHlwZS5wdXNoPWZ1bmN0aW9uKGEsYil7dmFyIGMsZCxlPXRoaXMuc3RybSxmPXRoaXMub3B0aW9ucy5jaHVua1NpemU7aWYodGhpcy5lbmRlZClyZXR1cm4hMTtkPWI9PT1+fmI/YjpiPT09ITA/bzpuLFwic3RyaW5nXCI9PXR5cGVvZiBhP2UuaW5wdXQ9ai5zdHJpbmcyYnVmKGEpOlwiW29iamVjdCBBcnJheUJ1ZmZlcl1cIj09PW0uY2FsbChhKT9lLmlucHV0PW5ldyBVaW50OEFycmF5KGEpOmUuaW5wdXQ9YSxlLm5leHRfaW49MCxlLmF2YWlsX2luPWUuaW5wdXQubGVuZ3RoO2Rve2lmKDA9PT1lLmF2YWlsX291dCYmKGUub3V0cHV0PW5ldyBpLkJ1ZjgoZiksZS5uZXh0X291dD0wLGUuYXZhaWxfb3V0PWYpLGM9aC5kZWZsYXRlKGUsZCksYyE9PXEmJmMhPT1wKXJldHVybiB0aGlzLm9uRW5kKGMpLHRoaXMuZW5kZWQ9ITAsITE7MCE9PWUuYXZhaWxfb3V0JiYoMCE9PWUuYXZhaWxfaW58fGQhPT1vJiZkIT09cil8fChcInN0cmluZ1wiPT09dGhpcy5vcHRpb25zLnRvP3RoaXMub25EYXRhKGouYnVmMmJpbnN0cmluZyhpLnNocmlua0J1ZihlLm91dHB1dCxlLm5leHRfb3V0KSkpOnRoaXMub25EYXRhKGkuc2hyaW5rQnVmKGUub3V0cHV0LGUubmV4dF9vdXQpKSl9d2hpbGUoKGUuYXZhaWxfaW4+MHx8MD09PWUuYXZhaWxfb3V0KSYmYyE9PXEpO3JldHVybiBkPT09bz8oYz1oLmRlZmxhdGVFbmQodGhpcy5zdHJtKSx0aGlzLm9uRW5kKGMpLHRoaXMuZW5kZWQ9ITAsYz09PXApOmQhPT1yfHwodGhpcy5vbkVuZChwKSxlLmF2YWlsX291dD0wLCEwKX0sZC5wcm90b3R5cGUub25EYXRhPWZ1bmN0aW9uKGEpe3RoaXMuY2h1bmtzLnB1c2goYSl9LGQucHJvdG90eXBlLm9uRW5kPWZ1bmN0aW9uKGEpe2E9PT1wJiYoXCJzdHJpbmdcIj09PXRoaXMub3B0aW9ucy50bz90aGlzLnJlc3VsdD10aGlzLmNodW5rcy5qb2luKFwiXCIpOnRoaXMucmVzdWx0PWkuZmxhdHRlbkNodW5rcyh0aGlzLmNodW5rcykpLHRoaXMuY2h1bmtzPVtdLHRoaXMuZXJyPWEsdGhpcy5tc2c9dGhpcy5zdHJtLm1zZ30sYy5EZWZsYXRlPWQsYy5kZWZsYXRlPWUsYy5kZWZsYXRlUmF3PWYsYy5nemlwPWd9LHtcIi4vdXRpbHMvY29tbW9uXCI6NjIsXCIuL3V0aWxzL3N0cmluZ3NcIjo2MyxcIi4vemxpYi9kZWZsYXRlXCI6NjcsXCIuL3psaWIvbWVzc2FnZXNcIjo3MixcIi4vemxpYi96c3RyZWFtXCI6NzR9XSw2MTpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoYSl7aWYoISh0aGlzIGluc3RhbmNlb2YgZCkpcmV0dXJuIG5ldyBkKGEpO3RoaXMub3B0aW9ucz1oLmFzc2lnbih7Y2h1bmtTaXplOjE2Mzg0LHdpbmRvd0JpdHM6MCx0bzpcIlwifSxhfHx7fSk7dmFyIGI9dGhpcy5vcHRpb25zO2IucmF3JiZiLndpbmRvd0JpdHM+PTAmJmIud2luZG93Qml0czwxNiYmKGIud2luZG93Qml0cz0tYi53aW5kb3dCaXRzLDA9PT1iLndpbmRvd0JpdHMmJihiLndpbmRvd0JpdHM9LTE1KSksIShiLndpbmRvd0JpdHM+PTAmJmIud2luZG93Qml0czwxNil8fGEmJmEud2luZG93Qml0c3x8KGIud2luZG93Qml0cys9MzIpLGIud2luZG93Qml0cz4xNSYmYi53aW5kb3dCaXRzPDQ4JiYwPT09KDE1JmIud2luZG93Qml0cykmJihiLndpbmRvd0JpdHN8PTE1KSx0aGlzLmVycj0wLHRoaXMubXNnPVwiXCIsdGhpcy5lbmRlZD0hMSx0aGlzLmNodW5rcz1bXSx0aGlzLnN0cm09bmV3IGwsdGhpcy5zdHJtLmF2YWlsX291dD0wO3ZhciBjPWcuaW5mbGF0ZUluaXQyKHRoaXMuc3RybSxiLndpbmRvd0JpdHMpO2lmKGMhPT1qLlpfT0spdGhyb3cgbmV3IEVycm9yKGtbY10pO3RoaXMuaGVhZGVyPW5ldyBtLGcuaW5mbGF0ZUdldEhlYWRlcih0aGlzLnN0cm0sdGhpcy5oZWFkZXIpfWZ1bmN0aW9uIGUoYSxiKXt2YXIgYz1uZXcgZChiKTtpZihjLnB1c2goYSwhMCksYy5lcnIpdGhyb3cgYy5tc2d8fGtbYy5lcnJdO3JldHVybiBjLnJlc3VsdH1mdW5jdGlvbiBmKGEsYil7cmV0dXJuIGI9Ynx8e30sYi5yYXc9ITAsZShhLGIpfXZhciBnPWEoXCIuL3psaWIvaW5mbGF0ZVwiKSxoPWEoXCIuL3V0aWxzL2NvbW1vblwiKSxpPWEoXCIuL3V0aWxzL3N0cmluZ3NcIiksaj1hKFwiLi96bGliL2NvbnN0YW50c1wiKSxrPWEoXCIuL3psaWIvbWVzc2FnZXNcIiksbD1hKFwiLi96bGliL3pzdHJlYW1cIiksbT1hKFwiLi96bGliL2d6aGVhZGVyXCIpLG49T2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztkLnByb3RvdHlwZS5wdXNoPWZ1bmN0aW9uKGEsYil7dmFyIGMsZCxlLGYsayxsLG09dGhpcy5zdHJtLG89dGhpcy5vcHRpb25zLmNodW5rU2l6ZSxwPXRoaXMub3B0aW9ucy5kaWN0aW9uYXJ5LHE9ITE7aWYodGhpcy5lbmRlZClyZXR1cm4hMTtkPWI9PT1+fmI/YjpiPT09ITA/ai5aX0ZJTklTSDpqLlpfTk9fRkxVU0gsXCJzdHJpbmdcIj09dHlwZW9mIGE/bS5pbnB1dD1pLmJpbnN0cmluZzJidWYoYSk6XCJbb2JqZWN0IEFycmF5QnVmZmVyXVwiPT09bi5jYWxsKGEpP20uaW5wdXQ9bmV3IFVpbnQ4QXJyYXkoYSk6bS5pbnB1dD1hLG0ubmV4dF9pbj0wLG0uYXZhaWxfaW49bS5pbnB1dC5sZW5ndGg7ZG97aWYoMD09PW0uYXZhaWxfb3V0JiYobS5vdXRwdXQ9bmV3IGguQnVmOChvKSxtLm5leHRfb3V0PTAsbS5hdmFpbF9vdXQ9byksYz1nLmluZmxhdGUobSxqLlpfTk9fRkxVU0gpLGM9PT1qLlpfTkVFRF9ESUNUJiZwJiYobD1cInN0cmluZ1wiPT10eXBlb2YgcD9pLnN0cmluZzJidWYocCk6XCJbb2JqZWN0IEFycmF5QnVmZmVyXVwiPT09bi5jYWxsKHApP25ldyBVaW50OEFycmF5KHApOnAsYz1nLmluZmxhdGVTZXREaWN0aW9uYXJ5KHRoaXMuc3RybSxsKSksYz09PWouWl9CVUZfRVJST1ImJnE9PT0hMCYmKGM9ai5aX09LLHE9ITEpLGMhPT1qLlpfU1RSRUFNX0VORCYmYyE9PWouWl9PSylyZXR1cm4gdGhpcy5vbkVuZChjKSx0aGlzLmVuZGVkPSEwLCExO20ubmV4dF9vdXQmJigwIT09bS5hdmFpbF9vdXQmJmMhPT1qLlpfU1RSRUFNX0VORCYmKDAhPT1tLmF2YWlsX2lufHxkIT09ai5aX0ZJTklTSCYmZCE9PWouWl9TWU5DX0ZMVVNIKXx8KFwic3RyaW5nXCI9PT10aGlzLm9wdGlvbnMudG8/KGU9aS51dGY4Ym9yZGVyKG0ub3V0cHV0LG0ubmV4dF9vdXQpLGY9bS5uZXh0X291dC1lLGs9aS5idWYyc3RyaW5nKG0ub3V0cHV0LGUpLG0ubmV4dF9vdXQ9ZixtLmF2YWlsX291dD1vLWYsZiYmaC5hcnJheVNldChtLm91dHB1dCxtLm91dHB1dCxlLGYsMCksdGhpcy5vbkRhdGEoaykpOnRoaXMub25EYXRhKGguc2hyaW5rQnVmKG0ub3V0cHV0LG0ubmV4dF9vdXQpKSkpLDA9PT1tLmF2YWlsX2luJiYwPT09bS5hdmFpbF9vdXQmJihxPSEwKX13aGlsZSgobS5hdmFpbF9pbj4wfHwwPT09bS5hdmFpbF9vdXQpJiZjIT09ai5aX1NUUkVBTV9FTkQpO3JldHVybiBjPT09ai5aX1NUUkVBTV9FTkQmJihkPWouWl9GSU5JU0gpLGQ9PT1qLlpfRklOSVNIPyhjPWcuaW5mbGF0ZUVuZCh0aGlzLnN0cm0pLHRoaXMub25FbmQoYyksdGhpcy5lbmRlZD0hMCxjPT09ai5aX09LKTpkIT09ai5aX1NZTkNfRkxVU0h8fCh0aGlzLm9uRW5kKGouWl9PSyksbS5hdmFpbF9vdXQ9MCwhMCl9LGQucHJvdG90eXBlLm9uRGF0YT1mdW5jdGlvbihhKXt0aGlzLmNodW5rcy5wdXNoKGEpfSxkLnByb3RvdHlwZS5vbkVuZD1mdW5jdGlvbihhKXthPT09ai5aX09LJiYoXCJzdHJpbmdcIj09PXRoaXMub3B0aW9ucy50bz90aGlzLnJlc3VsdD10aGlzLmNodW5rcy5qb2luKFwiXCIpOnRoaXMucmVzdWx0PWguZmxhdHRlbkNodW5rcyh0aGlzLmNodW5rcykpLHRoaXMuY2h1bmtzPVtdLHRoaXMuZXJyPWEsdGhpcy5tc2c9dGhpcy5zdHJtLm1zZ30sYy5JbmZsYXRlPWQsYy5pbmZsYXRlPWUsYy5pbmZsYXRlUmF3PWYsYy51bmd6aXA9ZX0se1wiLi91dGlscy9jb21tb25cIjo2MixcIi4vdXRpbHMvc3RyaW5nc1wiOjYzLFwiLi96bGliL2NvbnN0YW50c1wiOjY1LFwiLi96bGliL2d6aGVhZGVyXCI6NjgsXCIuL3psaWIvaW5mbGF0ZVwiOjcwLFwiLi96bGliL21lc3NhZ2VzXCI6NzIsXCIuL3psaWIvenN0cmVhbVwiOjc0fV0sNjI6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjt2YXIgZD1cInVuZGVmaW5lZFwiIT10eXBlb2YgVWludDhBcnJheSYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIFVpbnQxNkFycmF5JiZcInVuZGVmaW5lZFwiIT10eXBlb2YgSW50MzJBcnJheTtjLmFzc2lnbj1mdW5jdGlvbihhKXtmb3IodmFyIGI9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpO2IubGVuZ3RoOyl7dmFyIGM9Yi5zaGlmdCgpO2lmKGMpe2lmKFwib2JqZWN0XCIhPXR5cGVvZiBjKXRocm93IG5ldyBUeXBlRXJyb3IoYytcIm11c3QgYmUgbm9uLW9iamVjdFwiKTtmb3IodmFyIGQgaW4gYyljLmhhc093blByb3BlcnR5KGQpJiYoYVtkXT1jW2RdKX19cmV0dXJuIGF9LGMuc2hyaW5rQnVmPWZ1bmN0aW9uKGEsYil7cmV0dXJuIGEubGVuZ3RoPT09Yj9hOmEuc3ViYXJyYXk/YS5zdWJhcnJheSgwLGIpOihhLmxlbmd0aD1iLGEpfTt2YXIgZT17YXJyYXlTZXQ6ZnVuY3Rpb24oYSxiLGMsZCxlKXtpZihiLnN1YmFycmF5JiZhLnN1YmFycmF5KXJldHVybiB2b2lkIGEuc2V0KGIuc3ViYXJyYXkoYyxjK2QpLGUpO2Zvcih2YXIgZj0wO2Y8ZDtmKyspYVtlK2ZdPWJbYytmXX0sZmxhdHRlbkNodW5rczpmdW5jdGlvbihhKXt2YXIgYixjLGQsZSxmLGc7Zm9yKGQ9MCxiPTAsYz1hLmxlbmd0aDtiPGM7YisrKWQrPWFbYl0ubGVuZ3RoO2ZvcihnPW5ldyBVaW50OEFycmF5KGQpLGU9MCxiPTAsYz1hLmxlbmd0aDtiPGM7YisrKWY9YVtiXSxnLnNldChmLGUpLGUrPWYubGVuZ3RoO3JldHVybiBnfX0sZj17YXJyYXlTZXQ6ZnVuY3Rpb24oYSxiLGMsZCxlKXtmb3IodmFyIGY9MDtmPGQ7ZisrKWFbZStmXT1iW2MrZl19LGZsYXR0ZW5DaHVua3M6ZnVuY3Rpb24oYSl7cmV0dXJuW10uY29uY2F0LmFwcGx5KFtdLGEpfX07Yy5zZXRUeXBlZD1mdW5jdGlvbihhKXthPyhjLkJ1Zjg9VWludDhBcnJheSxjLkJ1ZjE2PVVpbnQxNkFycmF5LGMuQnVmMzI9SW50MzJBcnJheSxjLmFzc2lnbihjLGUpKTooYy5CdWY4PUFycmF5LGMuQnVmMTY9QXJyYXksYy5CdWYzMj1BcnJheSxjLmFzc2lnbihjLGYpKX0sYy5zZXRUeXBlZChkKX0se31dLDYzOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhLGIpe2lmKGI8NjU1MzcmJihhLnN1YmFycmF5JiZnfHwhYS5zdWJhcnJheSYmZikpcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCxlLnNocmlua0J1ZihhLGIpKTtmb3IodmFyIGM9XCJcIixkPTA7ZDxiO2QrKyljKz1TdHJpbmcuZnJvbUNoYXJDb2RlKGFbZF0pO3JldHVybiBjfXZhciBlPWEoXCIuL2NvbW1vblwiKSxmPSEwLGc9ITA7dHJ5e1N0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCxbMF0pfWNhdGNoKGgpe2Y9ITF9dHJ5e1N0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCxuZXcgVWludDhBcnJheSgxKSl9Y2F0Y2goaCl7Zz0hMX1mb3IodmFyIGk9bmV3IGUuQnVmOCgyNTYpLGo9MDtqPDI1NjtqKyspaVtqXT1qPj0yNTI/NjpqPj0yNDg/NTpqPj0yNDA/NDpqPj0yMjQ/MzpqPj0xOTI/MjoxO2lbMjU0XT1pWzI1NF09MSxjLnN0cmluZzJidWY9ZnVuY3Rpb24oYSl7dmFyIGIsYyxkLGYsZyxoPWEubGVuZ3RoLGk9MDtmb3IoZj0wO2Y8aDtmKyspYz1hLmNoYXJDb2RlQXQoZiksNTUyOTY9PT0oNjQ1MTImYykmJmYrMTxoJiYoZD1hLmNoYXJDb2RlQXQoZisxKSw1NjMyMD09PSg2NDUxMiZkKSYmKGM9NjU1MzYrKGMtNTUyOTY8PDEwKSsoZC01NjMyMCksZisrKSksaSs9YzwxMjg/MTpjPDIwNDg/MjpjPDY1NTM2PzM6NDtmb3IoYj1uZXcgZS5CdWY4KGkpLGc9MCxmPTA7ZzxpO2YrKyljPWEuY2hhckNvZGVBdChmKSw1NTI5Nj09PSg2NDUxMiZjKSYmZisxPGgmJihkPWEuY2hhckNvZGVBdChmKzEpLDU2MzIwPT09KDY0NTEyJmQpJiYoYz02NTUzNisoYy01NTI5Njw8MTApKyhkLTU2MzIwKSxmKyspKSxjPDEyOD9iW2crK109YzpjPDIwNDg/KGJbZysrXT0xOTJ8Yz4+PjYsYltnKytdPTEyOHw2MyZjKTpjPDY1NTM2PyhiW2crK109MjI0fGM+Pj4xMixiW2crK109MTI4fGM+Pj42JjYzLGJbZysrXT0xMjh8NjMmYyk6KGJbZysrXT0yNDB8Yz4+PjE4LGJbZysrXT0xMjh8Yz4+PjEyJjYzLGJbZysrXT0xMjh8Yz4+PjYmNjMsYltnKytdPTEyOHw2MyZjKTtyZXR1cm4gYn0sYy5idWYyYmluc3RyaW5nPWZ1bmN0aW9uKGEpe3JldHVybiBkKGEsYS5sZW5ndGgpfSxjLmJpbnN0cmluZzJidWY9ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPW5ldyBlLkJ1ZjgoYS5sZW5ndGgpLGM9MCxkPWIubGVuZ3RoO2M8ZDtjKyspYltjXT1hLmNoYXJDb2RlQXQoYyk7cmV0dXJuIGJ9LGMuYnVmMnN0cmluZz1mdW5jdGlvbihhLGIpe3ZhciBjLGUsZixnLGg9Ynx8YS5sZW5ndGgsaj1uZXcgQXJyYXkoMipoKTtmb3IoZT0wLGM9MDtjPGg7KWlmKGY9YVtjKytdLGY8MTI4KWpbZSsrXT1mO2Vsc2UgaWYoZz1pW2ZdLGc+NClqW2UrK109NjU1MzMsYys9Zy0xO2Vsc2V7Zm9yKGYmPTI9PT1nPzMxOjM9PT1nPzE1Ojc7Zz4xJiZjPGg7KWY9Zjw8Nnw2MyZhW2MrK10sZy0tO2c+MT9qW2UrK109NjU1MzM6Zjw2NTUzNj9qW2UrK109ZjooZi09NjU1MzYsaltlKytdPTU1Mjk2fGY+PjEwJjEwMjMsaltlKytdPTU2MzIwfDEwMjMmZil9cmV0dXJuIGQoaixlKX0sYy51dGY4Ym9yZGVyPWZ1bmN0aW9uKGEsYil7dmFyIGM7Zm9yKGI9Ynx8YS5sZW5ndGgsYj5hLmxlbmd0aCYmKGI9YS5sZW5ndGgpLGM9Yi0xO2M+PTAmJjEyOD09PSgxOTImYVtjXSk7KWMtLTtyZXR1cm4gYzwwP2I6MD09PWM/YjpjK2lbYVtjXV0+Yj9jOmJ9fSx7XCIuL2NvbW1vblwiOjYyfV0sNjQ6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBkKGEsYixjLGQpe2Zvcih2YXIgZT02NTUzNSZhfDAsZj1hPj4+MTYmNjU1MzV8MCxnPTA7MCE9PWM7KXtnPWM+MmUzPzJlMzpjLGMtPWc7ZG8gZT1lK2JbZCsrXXwwLGY9ZitlfDA7d2hpbGUoLS1nKTtlJT02NTUyMSxmJT02NTUyMX1yZXR1cm4gZXxmPDwxNnwwO1xufWIuZXhwb3J0cz1kfSx7fV0sNjU6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtiLmV4cG9ydHM9e1pfTk9fRkxVU0g6MCxaX1BBUlRJQUxfRkxVU0g6MSxaX1NZTkNfRkxVU0g6MixaX0ZVTExfRkxVU0g6MyxaX0ZJTklTSDo0LFpfQkxPQ0s6NSxaX1RSRUVTOjYsWl9PSzowLFpfU1RSRUFNX0VORDoxLFpfTkVFRF9ESUNUOjIsWl9FUlJOTzotMSxaX1NUUkVBTV9FUlJPUjotMixaX0RBVEFfRVJST1I6LTMsWl9CVUZfRVJST1I6LTUsWl9OT19DT01QUkVTU0lPTjowLFpfQkVTVF9TUEVFRDoxLFpfQkVTVF9DT01QUkVTU0lPTjo5LFpfREVGQVVMVF9DT01QUkVTU0lPTjotMSxaX0ZJTFRFUkVEOjEsWl9IVUZGTUFOX09OTFk6MixaX1JMRTozLFpfRklYRUQ6NCxaX0RFRkFVTFRfU1RSQVRFR1k6MCxaX0JJTkFSWTowLFpfVEVYVDoxLFpfVU5LTk9XTjoyLFpfREVGTEFURUQ6OH19LHt9XSw2NjpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoKXtmb3IodmFyIGEsYj1bXSxjPTA7YzwyNTY7YysrKXthPWM7Zm9yKHZhciBkPTA7ZDw4O2QrKylhPTEmYT8zOTg4MjkyMzg0XmE+Pj4xOmE+Pj4xO2JbY109YX1yZXR1cm4gYn1mdW5jdGlvbiBlKGEsYixjLGQpe3ZhciBlPWYsZz1kK2M7YV49LTE7Zm9yKHZhciBoPWQ7aDxnO2grKylhPWE+Pj44XmVbMjU1JihhXmJbaF0pXTtyZXR1cm4gYV4tMX12YXIgZj1kKCk7Yi5leHBvcnRzPWV9LHt9XSw2NzpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoYSxiKXtyZXR1cm4gYS5tc2c9SVtiXSxifWZ1bmN0aW9uIGUoYSl7cmV0dXJuKGE8PDEpLShhPjQ/OTowKX1mdW5jdGlvbiBmKGEpe2Zvcih2YXIgYj1hLmxlbmd0aDstLWI+PTA7KWFbYl09MH1mdW5jdGlvbiBnKGEpe3ZhciBiPWEuc3RhdGUsYz1iLnBlbmRpbmc7Yz5hLmF2YWlsX291dCYmKGM9YS5hdmFpbF9vdXQpLDAhPT1jJiYoRS5hcnJheVNldChhLm91dHB1dCxiLnBlbmRpbmdfYnVmLGIucGVuZGluZ19vdXQsYyxhLm5leHRfb3V0KSxhLm5leHRfb3V0Kz1jLGIucGVuZGluZ19vdXQrPWMsYS50b3RhbF9vdXQrPWMsYS5hdmFpbF9vdXQtPWMsYi5wZW5kaW5nLT1jLDA9PT1iLnBlbmRpbmcmJihiLnBlbmRpbmdfb3V0PTApKX1mdW5jdGlvbiBoKGEsYil7Ri5fdHJfZmx1c2hfYmxvY2soYSxhLmJsb2NrX3N0YXJ0Pj0wP2EuYmxvY2tfc3RhcnQ6LTEsYS5zdHJzdGFydC1hLmJsb2NrX3N0YXJ0LGIpLGEuYmxvY2tfc3RhcnQ9YS5zdHJzdGFydCxnKGEuc3RybSl9ZnVuY3Rpb24gaShhLGIpe2EucGVuZGluZ19idWZbYS5wZW5kaW5nKytdPWJ9ZnVuY3Rpb24gaihhLGIpe2EucGVuZGluZ19idWZbYS5wZW5kaW5nKytdPWI+Pj44JjI1NSxhLnBlbmRpbmdfYnVmW2EucGVuZGluZysrXT0yNTUmYn1mdW5jdGlvbiBrKGEsYixjLGQpe3ZhciBlPWEuYXZhaWxfaW47cmV0dXJuIGU+ZCYmKGU9ZCksMD09PWU/MDooYS5hdmFpbF9pbi09ZSxFLmFycmF5U2V0KGIsYS5pbnB1dCxhLm5leHRfaW4sZSxjKSwxPT09YS5zdGF0ZS53cmFwP2EuYWRsZXI9RyhhLmFkbGVyLGIsZSxjKToyPT09YS5zdGF0ZS53cmFwJiYoYS5hZGxlcj1IKGEuYWRsZXIsYixlLGMpKSxhLm5leHRfaW4rPWUsYS50b3RhbF9pbis9ZSxlKX1mdW5jdGlvbiBsKGEsYil7dmFyIGMsZCxlPWEubWF4X2NoYWluX2xlbmd0aCxmPWEuc3Ryc3RhcnQsZz1hLnByZXZfbGVuZ3RoLGg9YS5uaWNlX21hdGNoLGk9YS5zdHJzdGFydD5hLndfc2l6ZS1sYT9hLnN0cnN0YXJ0LShhLndfc2l6ZS1sYSk6MCxqPWEud2luZG93LGs9YS53X21hc2ssbD1hLnByZXYsbT1hLnN0cnN0YXJ0K2thLG49altmK2ctMV0sbz1qW2YrZ107YS5wcmV2X2xlbmd0aD49YS5nb29kX21hdGNoJiYoZT4+PTIpLGg+YS5sb29rYWhlYWQmJihoPWEubG9va2FoZWFkKTtkbyBpZihjPWIsaltjK2ddPT09byYmaltjK2ctMV09PT1uJiZqW2NdPT09altmXSYmalsrK2NdPT09altmKzFdKXtmKz0yLGMrKztkbzt3aGlsZShqWysrZl09PT1qWysrY10mJmpbKytmXT09PWpbKytjXSYmalsrK2ZdPT09alsrK2NdJiZqWysrZl09PT1qWysrY10mJmpbKytmXT09PWpbKytjXSYmalsrK2ZdPT09alsrK2NdJiZqWysrZl09PT1qWysrY10mJmpbKytmXT09PWpbKytjXSYmZjxtKTtpZihkPWthLShtLWYpLGY9bS1rYSxkPmcpe2lmKGEubWF0Y2hfc3RhcnQ9YixnPWQsZD49aClicmVhaztuPWpbZitnLTFdLG89altmK2ddfX13aGlsZSgoYj1sW2Ima10pPmkmJjAhPT0tLWUpO3JldHVybiBnPD1hLmxvb2thaGVhZD9nOmEubG9va2FoZWFkfWZ1bmN0aW9uIG0oYSl7dmFyIGIsYyxkLGUsZixnPWEud19zaXplO2Rve2lmKGU9YS53aW5kb3dfc2l6ZS1hLmxvb2thaGVhZC1hLnN0cnN0YXJ0LGEuc3Ryc3RhcnQ+PWcrKGctbGEpKXtFLmFycmF5U2V0KGEud2luZG93LGEud2luZG93LGcsZywwKSxhLm1hdGNoX3N0YXJ0LT1nLGEuc3Ryc3RhcnQtPWcsYS5ibG9ja19zdGFydC09ZyxjPWEuaGFzaF9zaXplLGI9YztkbyBkPWEuaGVhZFstLWJdLGEuaGVhZFtiXT1kPj1nP2QtZzowO3doaWxlKC0tYyk7Yz1nLGI9YztkbyBkPWEucHJldlstLWJdLGEucHJldltiXT1kPj1nP2QtZzowO3doaWxlKC0tYyk7ZSs9Z31pZigwPT09YS5zdHJtLmF2YWlsX2luKWJyZWFrO2lmKGM9ayhhLnN0cm0sYS53aW5kb3csYS5zdHJzdGFydCthLmxvb2thaGVhZCxlKSxhLmxvb2thaGVhZCs9YyxhLmxvb2thaGVhZCthLmluc2VydD49amEpZm9yKGY9YS5zdHJzdGFydC1hLmluc2VydCxhLmluc19oPWEud2luZG93W2ZdLGEuaW5zX2g9KGEuaW5zX2g8PGEuaGFzaF9zaGlmdF5hLndpbmRvd1tmKzFdKSZhLmhhc2hfbWFzazthLmluc2VydCYmKGEuaW5zX2g9KGEuaW5zX2g8PGEuaGFzaF9zaGlmdF5hLndpbmRvd1tmK2phLTFdKSZhLmhhc2hfbWFzayxhLnByZXZbZiZhLndfbWFza109YS5oZWFkW2EuaW5zX2hdLGEuaGVhZFthLmluc19oXT1mLGYrKyxhLmluc2VydC0tLCEoYS5sb29rYWhlYWQrYS5pbnNlcnQ8amEpKTspO313aGlsZShhLmxvb2thaGVhZDxsYSYmMCE9PWEuc3RybS5hdmFpbF9pbil9ZnVuY3Rpb24gbihhLGIpe3ZhciBjPTY1NTM1O2ZvcihjPmEucGVuZGluZ19idWZfc2l6ZS01JiYoYz1hLnBlbmRpbmdfYnVmX3NpemUtNSk7Oyl7aWYoYS5sb29rYWhlYWQ8PTEpe2lmKG0oYSksMD09PWEubG9va2FoZWFkJiZiPT09SilyZXR1cm4gdWE7aWYoMD09PWEubG9va2FoZWFkKWJyZWFrfWEuc3Ryc3RhcnQrPWEubG9va2FoZWFkLGEubG9va2FoZWFkPTA7dmFyIGQ9YS5ibG9ja19zdGFydCtjO2lmKCgwPT09YS5zdHJzdGFydHx8YS5zdHJzdGFydD49ZCkmJihhLmxvb2thaGVhZD1hLnN0cnN0YXJ0LWQsYS5zdHJzdGFydD1kLGgoYSwhMSksMD09PWEuc3RybS5hdmFpbF9vdXQpKXJldHVybiB1YTtpZihhLnN0cnN0YXJ0LWEuYmxvY2tfc3RhcnQ+PWEud19zaXplLWxhJiYoaChhLCExKSwwPT09YS5zdHJtLmF2YWlsX291dCkpcmV0dXJuIHVhfXJldHVybiBhLmluc2VydD0wLGI9PT1NPyhoKGEsITApLDA9PT1hLnN0cm0uYXZhaWxfb3V0P3dhOnhhKTphLnN0cnN0YXJ0PmEuYmxvY2tfc3RhcnQmJihoKGEsITEpLDA9PT1hLnN0cm0uYXZhaWxfb3V0KT91YTp1YX1mdW5jdGlvbiBvKGEsYil7Zm9yKHZhciBjLGQ7Oyl7aWYoYS5sb29rYWhlYWQ8bGEpe2lmKG0oYSksYS5sb29rYWhlYWQ8bGEmJmI9PT1KKXJldHVybiB1YTtpZigwPT09YS5sb29rYWhlYWQpYnJlYWt9aWYoYz0wLGEubG9va2FoZWFkPj1qYSYmKGEuaW5zX2g9KGEuaW5zX2g8PGEuaGFzaF9zaGlmdF5hLndpbmRvd1thLnN0cnN0YXJ0K2phLTFdKSZhLmhhc2hfbWFzayxjPWEucHJldlthLnN0cnN0YXJ0JmEud19tYXNrXT1hLmhlYWRbYS5pbnNfaF0sYS5oZWFkW2EuaW5zX2hdPWEuc3Ryc3RhcnQpLDAhPT1jJiZhLnN0cnN0YXJ0LWM8PWEud19zaXplLWxhJiYoYS5tYXRjaF9sZW5ndGg9bChhLGMpKSxhLm1hdGNoX2xlbmd0aD49amEpaWYoZD1GLl90cl90YWxseShhLGEuc3Ryc3RhcnQtYS5tYXRjaF9zdGFydCxhLm1hdGNoX2xlbmd0aC1qYSksYS5sb29rYWhlYWQtPWEubWF0Y2hfbGVuZ3RoLGEubWF0Y2hfbGVuZ3RoPD1hLm1heF9sYXp5X21hdGNoJiZhLmxvb2thaGVhZD49amEpe2EubWF0Y2hfbGVuZ3RoLS07ZG8gYS5zdHJzdGFydCsrLGEuaW5zX2g9KGEuaW5zX2g8PGEuaGFzaF9zaGlmdF5hLndpbmRvd1thLnN0cnN0YXJ0K2phLTFdKSZhLmhhc2hfbWFzayxjPWEucHJldlthLnN0cnN0YXJ0JmEud19tYXNrXT1hLmhlYWRbYS5pbnNfaF0sYS5oZWFkW2EuaW5zX2hdPWEuc3Ryc3RhcnQ7d2hpbGUoMCE9PS0tYS5tYXRjaF9sZW5ndGgpO2Euc3Ryc3RhcnQrK31lbHNlIGEuc3Ryc3RhcnQrPWEubWF0Y2hfbGVuZ3RoLGEubWF0Y2hfbGVuZ3RoPTAsYS5pbnNfaD1hLndpbmRvd1thLnN0cnN0YXJ0XSxhLmluc19oPShhLmluc19oPDxhLmhhc2hfc2hpZnReYS53aW5kb3dbYS5zdHJzdGFydCsxXSkmYS5oYXNoX21hc2s7ZWxzZSBkPUYuX3RyX3RhbGx5KGEsMCxhLndpbmRvd1thLnN0cnN0YXJ0XSksYS5sb29rYWhlYWQtLSxhLnN0cnN0YXJ0Kys7aWYoZCYmKGgoYSwhMSksMD09PWEuc3RybS5hdmFpbF9vdXQpKXJldHVybiB1YX1yZXR1cm4gYS5pbnNlcnQ9YS5zdHJzdGFydDxqYS0xP2Euc3Ryc3RhcnQ6amEtMSxiPT09TT8oaChhLCEwKSwwPT09YS5zdHJtLmF2YWlsX291dD93YTp4YSk6YS5sYXN0X2xpdCYmKGgoYSwhMSksMD09PWEuc3RybS5hdmFpbF9vdXQpP3VhOnZhfWZ1bmN0aW9uIHAoYSxiKXtmb3IodmFyIGMsZCxlOzspe2lmKGEubG9va2FoZWFkPGxhKXtpZihtKGEpLGEubG9va2FoZWFkPGxhJiZiPT09SilyZXR1cm4gdWE7aWYoMD09PWEubG9va2FoZWFkKWJyZWFrfWlmKGM9MCxhLmxvb2thaGVhZD49amEmJihhLmluc19oPShhLmluc19oPDxhLmhhc2hfc2hpZnReYS53aW5kb3dbYS5zdHJzdGFydCtqYS0xXSkmYS5oYXNoX21hc2ssYz1hLnByZXZbYS5zdHJzdGFydCZhLndfbWFza109YS5oZWFkW2EuaW5zX2hdLGEuaGVhZFthLmluc19oXT1hLnN0cnN0YXJ0KSxhLnByZXZfbGVuZ3RoPWEubWF0Y2hfbGVuZ3RoLGEucHJldl9tYXRjaD1hLm1hdGNoX3N0YXJ0LGEubWF0Y2hfbGVuZ3RoPWphLTEsMCE9PWMmJmEucHJldl9sZW5ndGg8YS5tYXhfbGF6eV9tYXRjaCYmYS5zdHJzdGFydC1jPD1hLndfc2l6ZS1sYSYmKGEubWF0Y2hfbGVuZ3RoPWwoYSxjKSxhLm1hdGNoX2xlbmd0aDw9NSYmKGEuc3RyYXRlZ3k9PT1VfHxhLm1hdGNoX2xlbmd0aD09PWphJiZhLnN0cnN0YXJ0LWEubWF0Y2hfc3RhcnQ+NDA5NikmJihhLm1hdGNoX2xlbmd0aD1qYS0xKSksYS5wcmV2X2xlbmd0aD49amEmJmEubWF0Y2hfbGVuZ3RoPD1hLnByZXZfbGVuZ3RoKXtlPWEuc3Ryc3RhcnQrYS5sb29rYWhlYWQtamEsZD1GLl90cl90YWxseShhLGEuc3Ryc3RhcnQtMS1hLnByZXZfbWF0Y2gsYS5wcmV2X2xlbmd0aC1qYSksYS5sb29rYWhlYWQtPWEucHJldl9sZW5ndGgtMSxhLnByZXZfbGVuZ3RoLT0yO2RvKythLnN0cnN0YXJ0PD1lJiYoYS5pbnNfaD0oYS5pbnNfaDw8YS5oYXNoX3NoaWZ0XmEud2luZG93W2Euc3Ryc3RhcnQramEtMV0pJmEuaGFzaF9tYXNrLGM9YS5wcmV2W2Euc3Ryc3RhcnQmYS53X21hc2tdPWEuaGVhZFthLmluc19oXSxhLmhlYWRbYS5pbnNfaF09YS5zdHJzdGFydCk7d2hpbGUoMCE9PS0tYS5wcmV2X2xlbmd0aCk7aWYoYS5tYXRjaF9hdmFpbGFibGU9MCxhLm1hdGNoX2xlbmd0aD1qYS0xLGEuc3Ryc3RhcnQrKyxkJiYoaChhLCExKSwwPT09YS5zdHJtLmF2YWlsX291dCkpcmV0dXJuIHVhfWVsc2UgaWYoYS5tYXRjaF9hdmFpbGFibGUpe2lmKGQ9Ri5fdHJfdGFsbHkoYSwwLGEud2luZG93W2Euc3Ryc3RhcnQtMV0pLGQmJmgoYSwhMSksYS5zdHJzdGFydCsrLGEubG9va2FoZWFkLS0sMD09PWEuc3RybS5hdmFpbF9vdXQpcmV0dXJuIHVhfWVsc2UgYS5tYXRjaF9hdmFpbGFibGU9MSxhLnN0cnN0YXJ0KyssYS5sb29rYWhlYWQtLX1yZXR1cm4gYS5tYXRjaF9hdmFpbGFibGUmJihkPUYuX3RyX3RhbGx5KGEsMCxhLndpbmRvd1thLnN0cnN0YXJ0LTFdKSxhLm1hdGNoX2F2YWlsYWJsZT0wKSxhLmluc2VydD1hLnN0cnN0YXJ0PGphLTE/YS5zdHJzdGFydDpqYS0xLGI9PT1NPyhoKGEsITApLDA9PT1hLnN0cm0uYXZhaWxfb3V0P3dhOnhhKTphLmxhc3RfbGl0JiYoaChhLCExKSwwPT09YS5zdHJtLmF2YWlsX291dCk/dWE6dmF9ZnVuY3Rpb24gcShhLGIpe2Zvcih2YXIgYyxkLGUsZixnPWEud2luZG93Ozspe2lmKGEubG9va2FoZWFkPD1rYSl7aWYobShhKSxhLmxvb2thaGVhZDw9a2EmJmI9PT1KKXJldHVybiB1YTtpZigwPT09YS5sb29rYWhlYWQpYnJlYWt9aWYoYS5tYXRjaF9sZW5ndGg9MCxhLmxvb2thaGVhZD49amEmJmEuc3Ryc3RhcnQ+MCYmKGU9YS5zdHJzdGFydC0xLGQ9Z1tlXSxkPT09Z1srK2VdJiZkPT09Z1srK2VdJiZkPT09Z1srK2VdKSl7Zj1hLnN0cnN0YXJ0K2thO2RvO3doaWxlKGQ9PT1nWysrZV0mJmQ9PT1nWysrZV0mJmQ9PT1nWysrZV0mJmQ9PT1nWysrZV0mJmQ9PT1nWysrZV0mJmQ9PT1nWysrZV0mJmQ9PT1nWysrZV0mJmQ9PT1nWysrZV0mJmU8Zik7YS5tYXRjaF9sZW5ndGg9a2EtKGYtZSksYS5tYXRjaF9sZW5ndGg+YS5sb29rYWhlYWQmJihhLm1hdGNoX2xlbmd0aD1hLmxvb2thaGVhZCl9aWYoYS5tYXRjaF9sZW5ndGg+PWphPyhjPUYuX3RyX3RhbGx5KGEsMSxhLm1hdGNoX2xlbmd0aC1qYSksYS5sb29rYWhlYWQtPWEubWF0Y2hfbGVuZ3RoLGEuc3Ryc3RhcnQrPWEubWF0Y2hfbGVuZ3RoLGEubWF0Y2hfbGVuZ3RoPTApOihjPUYuX3RyX3RhbGx5KGEsMCxhLndpbmRvd1thLnN0cnN0YXJ0XSksYS5sb29rYWhlYWQtLSxhLnN0cnN0YXJ0KyspLGMmJihoKGEsITEpLDA9PT1hLnN0cm0uYXZhaWxfb3V0KSlyZXR1cm4gdWF9cmV0dXJuIGEuaW5zZXJ0PTAsYj09PU0/KGgoYSwhMCksMD09PWEuc3RybS5hdmFpbF9vdXQ/d2E6eGEpOmEubGFzdF9saXQmJihoKGEsITEpLDA9PT1hLnN0cm0uYXZhaWxfb3V0KT91YTp2YX1mdW5jdGlvbiByKGEsYil7Zm9yKHZhciBjOzspe2lmKDA9PT1hLmxvb2thaGVhZCYmKG0oYSksMD09PWEubG9va2FoZWFkKSl7aWYoYj09PUopcmV0dXJuIHVhO2JyZWFrfWlmKGEubWF0Y2hfbGVuZ3RoPTAsYz1GLl90cl90YWxseShhLDAsYS53aW5kb3dbYS5zdHJzdGFydF0pLGEubG9va2FoZWFkLS0sYS5zdHJzdGFydCsrLGMmJihoKGEsITEpLDA9PT1hLnN0cm0uYXZhaWxfb3V0KSlyZXR1cm4gdWF9cmV0dXJuIGEuaW5zZXJ0PTAsYj09PU0/KGgoYSwhMCksMD09PWEuc3RybS5hdmFpbF9vdXQ/d2E6eGEpOmEubGFzdF9saXQmJihoKGEsITEpLDA9PT1hLnN0cm0uYXZhaWxfb3V0KT91YTp2YX1mdW5jdGlvbiBzKGEsYixjLGQsZSl7dGhpcy5nb29kX2xlbmd0aD1hLHRoaXMubWF4X2xhenk9Yix0aGlzLm5pY2VfbGVuZ3RoPWMsdGhpcy5tYXhfY2hhaW49ZCx0aGlzLmZ1bmM9ZX1mdW5jdGlvbiB0KGEpe2Eud2luZG93X3NpemU9MiphLndfc2l6ZSxmKGEuaGVhZCksYS5tYXhfbGF6eV9tYXRjaD1EW2EubGV2ZWxdLm1heF9sYXp5LGEuZ29vZF9tYXRjaD1EW2EubGV2ZWxdLmdvb2RfbGVuZ3RoLGEubmljZV9tYXRjaD1EW2EubGV2ZWxdLm5pY2VfbGVuZ3RoLGEubWF4X2NoYWluX2xlbmd0aD1EW2EubGV2ZWxdLm1heF9jaGFpbixhLnN0cnN0YXJ0PTAsYS5ibG9ja19zdGFydD0wLGEubG9va2FoZWFkPTAsYS5pbnNlcnQ9MCxhLm1hdGNoX2xlbmd0aD1hLnByZXZfbGVuZ3RoPWphLTEsYS5tYXRjaF9hdmFpbGFibGU9MCxhLmluc19oPTB9ZnVuY3Rpb24gdSgpe3RoaXMuc3RybT1udWxsLHRoaXMuc3RhdHVzPTAsdGhpcy5wZW5kaW5nX2J1Zj1udWxsLHRoaXMucGVuZGluZ19idWZfc2l6ZT0wLHRoaXMucGVuZGluZ19vdXQ9MCx0aGlzLnBlbmRpbmc9MCx0aGlzLndyYXA9MCx0aGlzLmd6aGVhZD1udWxsLHRoaXMuZ3ppbmRleD0wLHRoaXMubWV0aG9kPSQsdGhpcy5sYXN0X2ZsdXNoPS0xLHRoaXMud19zaXplPTAsdGhpcy53X2JpdHM9MCx0aGlzLndfbWFzaz0wLHRoaXMud2luZG93PW51bGwsdGhpcy53aW5kb3dfc2l6ZT0wLHRoaXMucHJldj1udWxsLHRoaXMuaGVhZD1udWxsLHRoaXMuaW5zX2g9MCx0aGlzLmhhc2hfc2l6ZT0wLHRoaXMuaGFzaF9iaXRzPTAsdGhpcy5oYXNoX21hc2s9MCx0aGlzLmhhc2hfc2hpZnQ9MCx0aGlzLmJsb2NrX3N0YXJ0PTAsdGhpcy5tYXRjaF9sZW5ndGg9MCx0aGlzLnByZXZfbWF0Y2g9MCx0aGlzLm1hdGNoX2F2YWlsYWJsZT0wLHRoaXMuc3Ryc3RhcnQ9MCx0aGlzLm1hdGNoX3N0YXJ0PTAsdGhpcy5sb29rYWhlYWQ9MCx0aGlzLnByZXZfbGVuZ3RoPTAsdGhpcy5tYXhfY2hhaW5fbGVuZ3RoPTAsdGhpcy5tYXhfbGF6eV9tYXRjaD0wLHRoaXMubGV2ZWw9MCx0aGlzLnN0cmF0ZWd5PTAsdGhpcy5nb29kX21hdGNoPTAsdGhpcy5uaWNlX21hdGNoPTAsdGhpcy5keW5fbHRyZWU9bmV3IEUuQnVmMTYoMipoYSksdGhpcy5keW5fZHRyZWU9bmV3IEUuQnVmMTYoMiooMipmYSsxKSksdGhpcy5ibF90cmVlPW5ldyBFLkJ1ZjE2KDIqKDIqZ2ErMSkpLGYodGhpcy5keW5fbHRyZWUpLGYodGhpcy5keW5fZHRyZWUpLGYodGhpcy5ibF90cmVlKSx0aGlzLmxfZGVzYz1udWxsLHRoaXMuZF9kZXNjPW51bGwsdGhpcy5ibF9kZXNjPW51bGwsdGhpcy5ibF9jb3VudD1uZXcgRS5CdWYxNihpYSsxKSx0aGlzLmhlYXA9bmV3IEUuQnVmMTYoMiplYSsxKSxmKHRoaXMuaGVhcCksdGhpcy5oZWFwX2xlbj0wLHRoaXMuaGVhcF9tYXg9MCx0aGlzLmRlcHRoPW5ldyBFLkJ1ZjE2KDIqZWErMSksZih0aGlzLmRlcHRoKSx0aGlzLmxfYnVmPTAsdGhpcy5saXRfYnVmc2l6ZT0wLHRoaXMubGFzdF9saXQ9MCx0aGlzLmRfYnVmPTAsdGhpcy5vcHRfbGVuPTAsdGhpcy5zdGF0aWNfbGVuPTAsdGhpcy5tYXRjaGVzPTAsdGhpcy5pbnNlcnQ9MCx0aGlzLmJpX2J1Zj0wLHRoaXMuYmlfdmFsaWQ9MH1mdW5jdGlvbiB2KGEpe3ZhciBiO3JldHVybiBhJiZhLnN0YXRlPyhhLnRvdGFsX2luPWEudG90YWxfb3V0PTAsYS5kYXRhX3R5cGU9WixiPWEuc3RhdGUsYi5wZW5kaW5nPTAsYi5wZW5kaW5nX291dD0wLGIud3JhcDwwJiYoYi53cmFwPS1iLndyYXApLGIuc3RhdHVzPWIud3JhcD9uYTpzYSxhLmFkbGVyPTI9PT1iLndyYXA/MDoxLGIubGFzdF9mbHVzaD1KLEYuX3RyX2luaXQoYiksTyk6ZChhLFEpfWZ1bmN0aW9uIHcoYSl7dmFyIGI9dihhKTtyZXR1cm4gYj09PU8mJnQoYS5zdGF0ZSksYn1mdW5jdGlvbiB4KGEsYil7cmV0dXJuIGEmJmEuc3RhdGU/MiE9PWEuc3RhdGUud3JhcD9ROihhLnN0YXRlLmd6aGVhZD1iLE8pOlF9ZnVuY3Rpb24geShhLGIsYyxlLGYsZyl7aWYoIWEpcmV0dXJuIFE7dmFyIGg9MTtpZihiPT09VCYmKGI9NiksZTwwPyhoPTAsZT0tZSk6ZT4xNSYmKGg9MixlLT0xNiksZjwxfHxmPl98fGMhPT0kfHxlPDh8fGU+MTV8fGI8MHx8Yj45fHxnPDB8fGc+WClyZXR1cm4gZChhLFEpOzg9PT1lJiYoZT05KTt2YXIgaT1uZXcgdTtyZXR1cm4gYS5zdGF0ZT1pLGkuc3RybT1hLGkud3JhcD1oLGkuZ3poZWFkPW51bGwsaS53X2JpdHM9ZSxpLndfc2l6ZT0xPDxpLndfYml0cyxpLndfbWFzaz1pLndfc2l6ZS0xLGkuaGFzaF9iaXRzPWYrNyxpLmhhc2hfc2l6ZT0xPDxpLmhhc2hfYml0cyxpLmhhc2hfbWFzaz1pLmhhc2hfc2l6ZS0xLGkuaGFzaF9zaGlmdD1+figoaS5oYXNoX2JpdHMramEtMSkvamEpLGkud2luZG93PW5ldyBFLkJ1ZjgoMippLndfc2l6ZSksaS5oZWFkPW5ldyBFLkJ1ZjE2KGkuaGFzaF9zaXplKSxpLnByZXY9bmV3IEUuQnVmMTYoaS53X3NpemUpLGkubGl0X2J1ZnNpemU9MTw8Zis2LGkucGVuZGluZ19idWZfc2l6ZT00KmkubGl0X2J1ZnNpemUsaS5wZW5kaW5nX2J1Zj1uZXcgRS5CdWY4KGkucGVuZGluZ19idWZfc2l6ZSksaS5kX2J1Zj0xKmkubGl0X2J1ZnNpemUsaS5sX2J1Zj0zKmkubGl0X2J1ZnNpemUsaS5sZXZlbD1iLGkuc3RyYXRlZ3k9ZyxpLm1ldGhvZD1jLHcoYSl9ZnVuY3Rpb24geihhLGIpe3JldHVybiB5KGEsYiwkLGFhLGJhLFkpfWZ1bmN0aW9uIEEoYSxiKXt2YXIgYyxoLGssbDtpZighYXx8IWEuc3RhdGV8fGI+Tnx8YjwwKXJldHVybiBhP2QoYSxRKTpRO2lmKGg9YS5zdGF0ZSwhYS5vdXRwdXR8fCFhLmlucHV0JiYwIT09YS5hdmFpbF9pbnx8aC5zdGF0dXM9PT10YSYmYiE9PU0pcmV0dXJuIGQoYSwwPT09YS5hdmFpbF9vdXQ/UzpRKTtpZihoLnN0cm09YSxjPWgubGFzdF9mbHVzaCxoLmxhc3RfZmx1c2g9YixoLnN0YXR1cz09PW5hKWlmKDI9PT1oLndyYXApYS5hZGxlcj0wLGkoaCwzMSksaShoLDEzOSksaShoLDgpLGguZ3poZWFkPyhpKGgsKGguZ3poZWFkLnRleHQ/MTowKSsoaC5nemhlYWQuaGNyYz8yOjApKyhoLmd6aGVhZC5leHRyYT80OjApKyhoLmd6aGVhZC5uYW1lPzg6MCkrKGguZ3poZWFkLmNvbW1lbnQ/MTY6MCkpLGkoaCwyNTUmaC5nemhlYWQudGltZSksaShoLGguZ3poZWFkLnRpbWU+PjgmMjU1KSxpKGgsaC5nemhlYWQudGltZT4+MTYmMjU1KSxpKGgsaC5nemhlYWQudGltZT4+MjQmMjU1KSxpKGgsOT09PWgubGV2ZWw/MjpoLnN0cmF0ZWd5Pj1WfHxoLmxldmVsPDI/NDowKSxpKGgsMjU1JmguZ3poZWFkLm9zKSxoLmd6aGVhZC5leHRyYSYmaC5nemhlYWQuZXh0cmEubGVuZ3RoJiYoaShoLDI1NSZoLmd6aGVhZC5leHRyYS5sZW5ndGgpLGkoaCxoLmd6aGVhZC5leHRyYS5sZW5ndGg+PjgmMjU1KSksaC5nemhlYWQuaGNyYyYmKGEuYWRsZXI9SChhLmFkbGVyLGgucGVuZGluZ19idWYsaC5wZW5kaW5nLDApKSxoLmd6aW5kZXg9MCxoLnN0YXR1cz1vYSk6KGkoaCwwKSxpKGgsMCksaShoLDApLGkoaCwwKSxpKGgsMCksaShoLDk9PT1oLmxldmVsPzI6aC5zdHJhdGVneT49Vnx8aC5sZXZlbDwyPzQ6MCksaShoLHlhKSxoLnN0YXR1cz1zYSk7ZWxzZXt2YXIgbT0kKyhoLndfYml0cy04PDw0KTw8OCxuPS0xO249aC5zdHJhdGVneT49Vnx8aC5sZXZlbDwyPzA6aC5sZXZlbDw2PzE6Nj09PWgubGV2ZWw/MjozLG18PW48PDYsMCE9PWguc3Ryc3RhcnQmJihtfD1tYSksbSs9MzEtbSUzMSxoLnN0YXR1cz1zYSxqKGgsbSksMCE9PWguc3Ryc3RhcnQmJihqKGgsYS5hZGxlcj4+PjE2KSxqKGgsNjU1MzUmYS5hZGxlcikpLGEuYWRsZXI9MX1pZihoLnN0YXR1cz09PW9hKWlmKGguZ3poZWFkLmV4dHJhKXtmb3Ioaz1oLnBlbmRpbmc7aC5nemluZGV4PCg2NTUzNSZoLmd6aGVhZC5leHRyYS5sZW5ndGgpJiYoaC5wZW5kaW5nIT09aC5wZW5kaW5nX2J1Zl9zaXplfHwoaC5nemhlYWQuaGNyYyYmaC5wZW5kaW5nPmsmJihhLmFkbGVyPUgoYS5hZGxlcixoLnBlbmRpbmdfYnVmLGgucGVuZGluZy1rLGspKSxnKGEpLGs9aC5wZW5kaW5nLGgucGVuZGluZyE9PWgucGVuZGluZ19idWZfc2l6ZSkpOylpKGgsMjU1JmguZ3poZWFkLmV4dHJhW2guZ3ppbmRleF0pLGguZ3ppbmRleCsrO2guZ3poZWFkLmhjcmMmJmgucGVuZGluZz5rJiYoYS5hZGxlcj1IKGEuYWRsZXIsaC5wZW5kaW5nX2J1ZixoLnBlbmRpbmctayxrKSksaC5nemluZGV4PT09aC5nemhlYWQuZXh0cmEubGVuZ3RoJiYoaC5nemluZGV4PTAsaC5zdGF0dXM9cGEpfWVsc2UgaC5zdGF0dXM9cGE7aWYoaC5zdGF0dXM9PT1wYSlpZihoLmd6aGVhZC5uYW1lKXtrPWgucGVuZGluZztkb3tpZihoLnBlbmRpbmc9PT1oLnBlbmRpbmdfYnVmX3NpemUmJihoLmd6aGVhZC5oY3JjJiZoLnBlbmRpbmc+ayYmKGEuYWRsZXI9SChhLmFkbGVyLGgucGVuZGluZ19idWYsaC5wZW5kaW5nLWssaykpLGcoYSksaz1oLnBlbmRpbmcsaC5wZW5kaW5nPT09aC5wZW5kaW5nX2J1Zl9zaXplKSl7bD0xO2JyZWFrfWw9aC5nemluZGV4PGguZ3poZWFkLm5hbWUubGVuZ3RoPzI1NSZoLmd6aGVhZC5uYW1lLmNoYXJDb2RlQXQoaC5nemluZGV4KyspOjAsaShoLGwpfXdoaWxlKDAhPT1sKTtoLmd6aGVhZC5oY3JjJiZoLnBlbmRpbmc+ayYmKGEuYWRsZXI9SChhLmFkbGVyLGgucGVuZGluZ19idWYsaC5wZW5kaW5nLWssaykpLDA9PT1sJiYoaC5nemluZGV4PTAsaC5zdGF0dXM9cWEpfWVsc2UgaC5zdGF0dXM9cWE7aWYoaC5zdGF0dXM9PT1xYSlpZihoLmd6aGVhZC5jb21tZW50KXtrPWgucGVuZGluZztkb3tpZihoLnBlbmRpbmc9PT1oLnBlbmRpbmdfYnVmX3NpemUmJihoLmd6aGVhZC5oY3JjJiZoLnBlbmRpbmc+ayYmKGEuYWRsZXI9SChhLmFkbGVyLGgucGVuZGluZ19idWYsaC5wZW5kaW5nLWssaykpLGcoYSksaz1oLnBlbmRpbmcsaC5wZW5kaW5nPT09aC5wZW5kaW5nX2J1Zl9zaXplKSl7bD0xO2JyZWFrfWw9aC5nemluZGV4PGguZ3poZWFkLmNvbW1lbnQubGVuZ3RoPzI1NSZoLmd6aGVhZC5jb21tZW50LmNoYXJDb2RlQXQoaC5nemluZGV4KyspOjAsaShoLGwpfXdoaWxlKDAhPT1sKTtoLmd6aGVhZC5oY3JjJiZoLnBlbmRpbmc+ayYmKGEuYWRsZXI9SChhLmFkbGVyLGgucGVuZGluZ19idWYsaC5wZW5kaW5nLWssaykpLDA9PT1sJiYoaC5zdGF0dXM9cmEpfWVsc2UgaC5zdGF0dXM9cmE7aWYoaC5zdGF0dXM9PT1yYSYmKGguZ3poZWFkLmhjcmM/KGgucGVuZGluZysyPmgucGVuZGluZ19idWZfc2l6ZSYmZyhhKSxoLnBlbmRpbmcrMjw9aC5wZW5kaW5nX2J1Zl9zaXplJiYoaShoLDI1NSZhLmFkbGVyKSxpKGgsYS5hZGxlcj4+OCYyNTUpLGEuYWRsZXI9MCxoLnN0YXR1cz1zYSkpOmguc3RhdHVzPXNhKSwwIT09aC5wZW5kaW5nKXtpZihnKGEpLDA9PT1hLmF2YWlsX291dClyZXR1cm4gaC5sYXN0X2ZsdXNoPS0xLE99ZWxzZSBpZigwPT09YS5hdmFpbF9pbiYmZShiKTw9ZShjKSYmYiE9PU0pcmV0dXJuIGQoYSxTKTtpZihoLnN0YXR1cz09PXRhJiYwIT09YS5hdmFpbF9pbilyZXR1cm4gZChhLFMpO2lmKDAhPT1hLmF2YWlsX2lufHwwIT09aC5sb29rYWhlYWR8fGIhPT1KJiZoLnN0YXR1cyE9PXRhKXt2YXIgbz1oLnN0cmF0ZWd5PT09Vj9yKGgsYik6aC5zdHJhdGVneT09PVc/cShoLGIpOkRbaC5sZXZlbF0uZnVuYyhoLGIpO2lmKG8hPT13YSYmbyE9PXhhfHwoaC5zdGF0dXM9dGEpLG89PT11YXx8bz09PXdhKXJldHVybiAwPT09YS5hdmFpbF9vdXQmJihoLmxhc3RfZmx1c2g9LTEpLE87aWYobz09PXZhJiYoYj09PUs/Ri5fdHJfYWxpZ24oaCk6YiE9PU4mJihGLl90cl9zdG9yZWRfYmxvY2soaCwwLDAsITEpLGI9PT1MJiYoZihoLmhlYWQpLDA9PT1oLmxvb2thaGVhZCYmKGguc3Ryc3RhcnQ9MCxoLmJsb2NrX3N0YXJ0PTAsaC5pbnNlcnQ9MCkpKSxnKGEpLDA9PT1hLmF2YWlsX291dCkpcmV0dXJuIGgubGFzdF9mbHVzaD0tMSxPfXJldHVybiBiIT09TT9POmgud3JhcDw9MD9QOigyPT09aC53cmFwPyhpKGgsMjU1JmEuYWRsZXIpLGkoaCxhLmFkbGVyPj44JjI1NSksaShoLGEuYWRsZXI+PjE2JjI1NSksaShoLGEuYWRsZXI+PjI0JjI1NSksaShoLDI1NSZhLnRvdGFsX2luKSxpKGgsYS50b3RhbF9pbj4+OCYyNTUpLGkoaCxhLnRvdGFsX2luPj4xNiYyNTUpLGkoaCxhLnRvdGFsX2luPj4yNCYyNTUpKTooaihoLGEuYWRsZXI+Pj4xNiksaihoLDY1NTM1JmEuYWRsZXIpKSxnKGEpLGgud3JhcD4wJiYoaC53cmFwPS1oLndyYXApLDAhPT1oLnBlbmRpbmc/TzpQKX1mdW5jdGlvbiBCKGEpe3ZhciBiO3JldHVybiBhJiZhLnN0YXRlPyhiPWEuc3RhdGUuc3RhdHVzLGIhPT1uYSYmYiE9PW9hJiZiIT09cGEmJmIhPT1xYSYmYiE9PXJhJiZiIT09c2EmJmIhPT10YT9kKGEsUSk6KGEuc3RhdGU9bnVsbCxiPT09c2E/ZChhLFIpOk8pKTpRfWZ1bmN0aW9uIEMoYSxiKXt2YXIgYyxkLGUsZyxoLGksaixrLGw9Yi5sZW5ndGg7aWYoIWF8fCFhLnN0YXRlKXJldHVybiBRO2lmKGM9YS5zdGF0ZSxnPWMud3JhcCwyPT09Z3x8MT09PWcmJmMuc3RhdHVzIT09bmF8fGMubG9va2FoZWFkKXJldHVybiBRO2ZvcigxPT09ZyYmKGEuYWRsZXI9RyhhLmFkbGVyLGIsbCwwKSksYy53cmFwPTAsbD49Yy53X3NpemUmJigwPT09ZyYmKGYoYy5oZWFkKSxjLnN0cnN0YXJ0PTAsYy5ibG9ja19zdGFydD0wLGMuaW5zZXJ0PTApLGs9bmV3IEUuQnVmOChjLndfc2l6ZSksRS5hcnJheVNldChrLGIsbC1jLndfc2l6ZSxjLndfc2l6ZSwwKSxiPWssbD1jLndfc2l6ZSksaD1hLmF2YWlsX2luLGk9YS5uZXh0X2luLGo9YS5pbnB1dCxhLmF2YWlsX2luPWwsYS5uZXh0X2luPTAsYS5pbnB1dD1iLG0oYyk7Yy5sb29rYWhlYWQ+PWphOyl7ZD1jLnN0cnN0YXJ0LGU9Yy5sb29rYWhlYWQtKGphLTEpO2RvIGMuaW5zX2g9KGMuaW5zX2g8PGMuaGFzaF9zaGlmdF5jLndpbmRvd1tkK2phLTFdKSZjLmhhc2hfbWFzayxjLnByZXZbZCZjLndfbWFza109Yy5oZWFkW2MuaW5zX2hdLGMuaGVhZFtjLmluc19oXT1kLGQrKzt3aGlsZSgtLWUpO2Muc3Ryc3RhcnQ9ZCxjLmxvb2thaGVhZD1qYS0xLG0oYyl9cmV0dXJuIGMuc3Ryc3RhcnQrPWMubG9va2FoZWFkLGMuYmxvY2tfc3RhcnQ9Yy5zdHJzdGFydCxjLmluc2VydD1jLmxvb2thaGVhZCxjLmxvb2thaGVhZD0wLGMubWF0Y2hfbGVuZ3RoPWMucHJldl9sZW5ndGg9amEtMSxjLm1hdGNoX2F2YWlsYWJsZT0wLGEubmV4dF9pbj1pLGEuaW5wdXQ9aixhLmF2YWlsX2luPWgsYy53cmFwPWcsT312YXIgRCxFPWEoXCIuLi91dGlscy9jb21tb25cIiksRj1hKFwiLi90cmVlc1wiKSxHPWEoXCIuL2FkbGVyMzJcIiksSD1hKFwiLi9jcmMzMlwiKSxJPWEoXCIuL21lc3NhZ2VzXCIpLEo9MCxLPTEsTD0zLE09NCxOPTUsTz0wLFA9MSxRPS0yLFI9LTMsUz0tNSxUPS0xLFU9MSxWPTIsVz0zLFg9NCxZPTAsWj0yLCQ9OCxfPTksYWE9MTUsYmE9OCxjYT0yOSxkYT0yNTYsZWE9ZGErMStjYSxmYT0zMCxnYT0xOSxoYT0yKmVhKzEsaWE9MTUsamE9MyxrYT0yNTgsbGE9a2EramErMSxtYT0zMixuYT00MixvYT02OSxwYT03MyxxYT05MSxyYT0xMDMsc2E9MTEzLHRhPTY2Nix1YT0xLHZhPTIsd2E9Myx4YT00LHlhPTM7RD1bbmV3IHMoMCwwLDAsMCxuKSxuZXcgcyg0LDQsOCw0LG8pLG5ldyBzKDQsNSwxNiw4LG8pLG5ldyBzKDQsNiwzMiwzMixvKSxuZXcgcyg0LDQsMTYsMTYscCksbmV3IHMoOCwxNiwzMiwzMixwKSxuZXcgcyg4LDE2LDEyOCwxMjgscCksbmV3IHMoOCwzMiwxMjgsMjU2LHApLG5ldyBzKDMyLDEyOCwyNTgsMTAyNCxwKSxuZXcgcygzMiwyNTgsMjU4LDQwOTYscCldLGMuZGVmbGF0ZUluaXQ9eixjLmRlZmxhdGVJbml0Mj15LGMuZGVmbGF0ZVJlc2V0PXcsYy5kZWZsYXRlUmVzZXRLZWVwPXYsYy5kZWZsYXRlU2V0SGVhZGVyPXgsYy5kZWZsYXRlPUEsYy5kZWZsYXRlRW5kPUIsYy5kZWZsYXRlU2V0RGljdGlvbmFyeT1DLGMuZGVmbGF0ZUluZm89XCJwYWtvIGRlZmxhdGUgKGZyb20gTm9kZWNhIHByb2plY3QpXCJ9LHtcIi4uL3V0aWxzL2NvbW1vblwiOjYyLFwiLi9hZGxlcjMyXCI6NjQsXCIuL2NyYzMyXCI6NjYsXCIuL21lc3NhZ2VzXCI6NzIsXCIuL3RyZWVzXCI6NzN9XSw2ODpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoKXt0aGlzLnRleHQ9MCx0aGlzLnRpbWU9MCx0aGlzLnhmbGFncz0wLHRoaXMub3M9MCx0aGlzLmV4dHJhPW51bGwsdGhpcy5leHRyYV9sZW49MCx0aGlzLm5hbWU9XCJcIix0aGlzLmNvbW1lbnQ9XCJcIix0aGlzLmhjcmM9MCx0aGlzLmRvbmU9ITF9Yi5leHBvcnRzPWR9LHt9XSw2OTpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO3ZhciBkPTMwLGU9MTI7Yi5leHBvcnRzPWZ1bmN0aW9uKGEsYil7dmFyIGMsZixnLGgsaSxqLGssbCxtLG4sbyxwLHEscixzLHQsdSx2LHcseCx5LHosQSxCLEM7Yz1hLnN0YXRlLGY9YS5uZXh0X2luLEI9YS5pbnB1dCxnPWYrKGEuYXZhaWxfaW4tNSksaD1hLm5leHRfb3V0LEM9YS5vdXRwdXQsaT1oLShiLWEuYXZhaWxfb3V0KSxqPWgrKGEuYXZhaWxfb3V0LTI1Nyksaz1jLmRtYXgsbD1jLndzaXplLG09Yy53aGF2ZSxuPWMud25leHQsbz1jLndpbmRvdyxwPWMuaG9sZCxxPWMuYml0cyxyPWMubGVuY29kZSxzPWMuZGlzdGNvZGUsdD0oMTw8Yy5sZW5iaXRzKS0xLHU9KDE8PGMuZGlzdGJpdHMpLTE7YTpkb3txPDE1JiYocCs9QltmKytdPDxxLHErPTgscCs9QltmKytdPDxxLHErPTgpLHY9cltwJnRdO2I6Zm9yKDs7KXtpZih3PXY+Pj4yNCxwPj4+PXcscS09dyx3PXY+Pj4xNiYyNTUsMD09PXcpQ1toKytdPTY1NTM1JnY7ZWxzZXtpZighKDE2JncpKXtpZigwPT09KDY0JncpKXt2PXJbKDY1NTM1JnYpKyhwJigxPDx3KS0xKV07Y29udGludWUgYn1pZigzMiZ3KXtjLm1vZGU9ZTticmVhayBhfWEubXNnPVwiaW52YWxpZCBsaXRlcmFsL2xlbmd0aCBjb2RlXCIsYy5tb2RlPWQ7YnJlYWsgYX14PTY1NTM1JnYsdyY9MTUsdyYmKHE8dyYmKHArPUJbZisrXTw8cSxxKz04KSx4Kz1wJigxPDx3KS0xLHA+Pj49dyxxLT13KSxxPDE1JiYocCs9QltmKytdPDxxLHErPTgscCs9QltmKytdPDxxLHErPTgpLHY9c1twJnVdO2M6Zm9yKDs7KXtpZih3PXY+Pj4yNCxwPj4+PXcscS09dyx3PXY+Pj4xNiYyNTUsISgxNiZ3KSl7aWYoMD09PSg2NCZ3KSl7dj1zWyg2NTUzNSZ2KSsocCYoMTw8dyktMSldO2NvbnRpbnVlIGN9YS5tc2c9XCJpbnZhbGlkIGRpc3RhbmNlIGNvZGVcIixjLm1vZGU9ZDticmVhayBhfWlmKHk9NjU1MzUmdix3Jj0xNSxxPHcmJihwKz1CW2YrK108PHEscSs9OCxxPHcmJihwKz1CW2YrK108PHEscSs9OCkpLHkrPXAmKDE8PHcpLTEseT5rKXthLm1zZz1cImludmFsaWQgZGlzdGFuY2UgdG9vIGZhciBiYWNrXCIsYy5tb2RlPWQ7YnJlYWsgYX1pZihwPj4+PXcscS09dyx3PWgtaSx5Pncpe2lmKHc9eS13LHc+bSYmYy5zYW5lKXthLm1zZz1cImludmFsaWQgZGlzdGFuY2UgdG9vIGZhciBiYWNrXCIsYy5tb2RlPWQ7YnJlYWsgYX1pZih6PTAsQT1vLDA9PT1uKXtpZih6Kz1sLXcsdzx4KXt4LT13O2RvIENbaCsrXT1vW3orK107d2hpbGUoLS13KTt6PWgteSxBPUN9fWVsc2UgaWYobjx3KXtpZih6Kz1sK24tdyx3LT1uLHc8eCl7eC09dztkbyBDW2grK109b1t6KytdO3doaWxlKC0tdyk7aWYoej0wLG48eCl7dz1uLHgtPXc7ZG8gQ1toKytdPW9beisrXTt3aGlsZSgtLXcpO3o9aC15LEE9Q319fWVsc2UgaWYoeis9bi13LHc8eCl7eC09dztkbyBDW2grK109b1t6KytdO3doaWxlKC0tdyk7ej1oLXksQT1DfWZvcig7eD4yOylDW2grK109QVt6KytdLENbaCsrXT1BW3orK10sQ1toKytdPUFbeisrXSx4LT0zO3gmJihDW2grK109QVt6KytdLHg+MSYmKENbaCsrXT1BW3orK10pKX1lbHNle3o9aC15O2RvIENbaCsrXT1DW3orK10sQ1toKytdPUNbeisrXSxDW2grK109Q1t6KytdLHgtPTM7d2hpbGUoeD4yKTt4JiYoQ1toKytdPUNbeisrXSx4PjEmJihDW2grK109Q1t6KytdKSl9YnJlYWt9fWJyZWFrfX13aGlsZShmPGcmJmg8aik7eD1xPj4zLGYtPXgscS09eDw8MyxwJj0oMTw8cSktMSxhLm5leHRfaW49ZixhLm5leHRfb3V0PWgsYS5hdmFpbF9pbj1mPGc/NSsoZy1mKTo1LShmLWcpLGEuYXZhaWxfb3V0PWg8aj8yNTcrKGotaCk6MjU3LShoLWopLGMuaG9sZD1wLGMuYml0cz1xfX0se31dLDcwOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhKXtyZXR1cm4oYT4+PjI0JjI1NSkrKGE+Pj44JjY1MjgwKSsoKDY1MjgwJmEpPDw4KSsoKDI1NSZhKTw8MjQpfWZ1bmN0aW9uIGUoKXt0aGlzLm1vZGU9MCx0aGlzLmxhc3Q9ITEsdGhpcy53cmFwPTAsdGhpcy5oYXZlZGljdD0hMSx0aGlzLmZsYWdzPTAsdGhpcy5kbWF4PTAsdGhpcy5jaGVjaz0wLHRoaXMudG90YWw9MCx0aGlzLmhlYWQ9bnVsbCx0aGlzLndiaXRzPTAsdGhpcy53c2l6ZT0wLHRoaXMud2hhdmU9MCx0aGlzLnduZXh0PTAsdGhpcy53aW5kb3c9bnVsbCx0aGlzLmhvbGQ9MCx0aGlzLmJpdHM9MCx0aGlzLmxlbmd0aD0wLHRoaXMub2Zmc2V0PTAsdGhpcy5leHRyYT0wLHRoaXMubGVuY29kZT1udWxsLHRoaXMuZGlzdGNvZGU9bnVsbCx0aGlzLmxlbmJpdHM9MCx0aGlzLmRpc3RiaXRzPTAsdGhpcy5uY29kZT0wLHRoaXMubmxlbj0wLHRoaXMubmRpc3Q9MCx0aGlzLmhhdmU9MCx0aGlzLm5leHQ9bnVsbCx0aGlzLmxlbnM9bmV3IHMuQnVmMTYoMzIwKSx0aGlzLndvcms9bmV3IHMuQnVmMTYoMjg4KSx0aGlzLmxlbmR5bj1udWxsLHRoaXMuZGlzdGR5bj1udWxsLHRoaXMuc2FuZT0wLHRoaXMuYmFjaz0wLHRoaXMud2FzPTB9ZnVuY3Rpb24gZihhKXt2YXIgYjtyZXR1cm4gYSYmYS5zdGF0ZT8oYj1hLnN0YXRlLGEudG90YWxfaW49YS50b3RhbF9vdXQ9Yi50b3RhbD0wLGEubXNnPVwiXCIsYi53cmFwJiYoYS5hZGxlcj0xJmIud3JhcCksYi5tb2RlPUwsYi5sYXN0PTAsYi5oYXZlZGljdD0wLGIuZG1heD0zMjc2OCxiLmhlYWQ9bnVsbCxiLmhvbGQ9MCxiLmJpdHM9MCxiLmxlbmNvZGU9Yi5sZW5keW49bmV3IHMuQnVmMzIocGEpLGIuZGlzdGNvZGU9Yi5kaXN0ZHluPW5ldyBzLkJ1ZjMyKHFhKSxiLnNhbmU9MSxiLmJhY2s9LTEsRCk6R31mdW5jdGlvbiBnKGEpe3ZhciBiO3JldHVybiBhJiZhLnN0YXRlPyhiPWEuc3RhdGUsYi53c2l6ZT0wLGIud2hhdmU9MCxiLnduZXh0PTAsZihhKSk6R31mdW5jdGlvbiBoKGEsYil7dmFyIGMsZDtyZXR1cm4gYSYmYS5zdGF0ZT8oZD1hLnN0YXRlLGI8MD8oYz0wLGI9LWIpOihjPShiPj40KSsxLGI8NDgmJihiJj0xNSkpLGImJihiPDh8fGI+MTUpP0c6KG51bGwhPT1kLndpbmRvdyYmZC53Yml0cyE9PWImJihkLndpbmRvdz1udWxsKSxkLndyYXA9YyxkLndiaXRzPWIsZyhhKSkpOkd9ZnVuY3Rpb24gaShhLGIpe3ZhciBjLGQ7cmV0dXJuIGE/KGQ9bmV3IGUsYS5zdGF0ZT1kLGQud2luZG93PW51bGwsYz1oKGEsYiksYyE9PUQmJihhLnN0YXRlPW51bGwpLGMpOkd9ZnVuY3Rpb24gaihhKXtyZXR1cm4gaShhLHNhKX1mdW5jdGlvbiBrKGEpe2lmKHRhKXt2YXIgYjtmb3IocT1uZXcgcy5CdWYzMig1MTIpLHI9bmV3IHMuQnVmMzIoMzIpLGI9MDtiPDE0NDspYS5sZW5zW2IrK109ODtmb3IoO2I8MjU2OylhLmxlbnNbYisrXT05O2Zvcig7YjwyODA7KWEubGVuc1tiKytdPTc7Zm9yKDtiPDI4ODspYS5sZW5zW2IrK109ODtmb3Iodyh5LGEubGVucywwLDI4OCxxLDAsYS53b3JrLHtiaXRzOjl9KSxiPTA7YjwzMjspYS5sZW5zW2IrK109NTt3KHosYS5sZW5zLDAsMzIsciwwLGEud29yayx7Yml0czo1fSksdGE9ITF9YS5sZW5jb2RlPXEsYS5sZW5iaXRzPTksYS5kaXN0Y29kZT1yLGEuZGlzdGJpdHM9NX1mdW5jdGlvbiBsKGEsYixjLGQpe3ZhciBlLGY9YS5zdGF0ZTtyZXR1cm4gbnVsbD09PWYud2luZG93JiYoZi53c2l6ZT0xPDxmLndiaXRzLGYud25leHQ9MCxmLndoYXZlPTAsZi53aW5kb3c9bmV3IHMuQnVmOChmLndzaXplKSksZD49Zi53c2l6ZT8ocy5hcnJheVNldChmLndpbmRvdyxiLGMtZi53c2l6ZSxmLndzaXplLDApLGYud25leHQ9MCxmLndoYXZlPWYud3NpemUpOihlPWYud3NpemUtZi53bmV4dCxlPmQmJihlPWQpLHMuYXJyYXlTZXQoZi53aW5kb3csYixjLWQsZSxmLnduZXh0KSxkLT1lLGQ/KHMuYXJyYXlTZXQoZi53aW5kb3csYixjLWQsZCwwKSxmLnduZXh0PWQsZi53aGF2ZT1mLndzaXplKTooZi53bmV4dCs9ZSxmLnduZXh0PT09Zi53c2l6ZSYmKGYud25leHQ9MCksZi53aGF2ZTxmLndzaXplJiYoZi53aGF2ZSs9ZSkpKSwwfWZ1bmN0aW9uIG0oYSxiKXt2YXIgYyxlLGYsZyxoLGksaixtLG4sbyxwLHEscixwYSxxYSxyYSxzYSx0YSx1YSx2YSx3YSx4YSx5YSx6YSxBYT0wLEJhPW5ldyBzLkJ1ZjgoNCksQ2E9WzE2LDE3LDE4LDAsOCw3LDksNiwxMCw1LDExLDQsMTIsMywxMywyLDE0LDEsMTVdO2lmKCFhfHwhYS5zdGF0ZXx8IWEub3V0cHV0fHwhYS5pbnB1dCYmMCE9PWEuYXZhaWxfaW4pcmV0dXJuIEc7Yz1hLnN0YXRlLGMubW9kZT09PVcmJihjLm1vZGU9WCksaD1hLm5leHRfb3V0LGY9YS5vdXRwdXQsaj1hLmF2YWlsX291dCxnPWEubmV4dF9pbixlPWEuaW5wdXQsaT1hLmF2YWlsX2luLG09Yy5ob2xkLG49Yy5iaXRzLG89aSxwPWoseGE9RDthOmZvcig7Oylzd2l0Y2goYy5tb2RlKXtjYXNlIEw6aWYoMD09PWMud3JhcCl7Yy5tb2RlPVg7YnJlYWt9Zm9yKDtuPDE2Oyl7aWYoMD09PWkpYnJlYWsgYTtpLS0sbSs9ZVtnKytdPDxuLG4rPTh9aWYoMiZjLndyYXAmJjM1NjE1PT09bSl7Yy5jaGVjaz0wLEJhWzBdPTI1NSZtLEJhWzFdPW0+Pj44JjI1NSxjLmNoZWNrPXUoYy5jaGVjayxCYSwyLDApLG09MCxuPTAsYy5tb2RlPU07YnJlYWt9aWYoYy5mbGFncz0wLGMuaGVhZCYmKGMuaGVhZC5kb25lPSExKSwhKDEmYy53cmFwKXx8KCgoMjU1Jm0pPDw4KSsobT4+OCkpJTMxKXthLm1zZz1cImluY29ycmVjdCBoZWFkZXIgY2hlY2tcIixjLm1vZGU9bWE7YnJlYWt9aWYoKDE1Jm0pIT09Syl7YS5tc2c9XCJ1bmtub3duIGNvbXByZXNzaW9uIG1ldGhvZFwiLGMubW9kZT1tYTticmVha31pZihtPj4+PTQsbi09NCx3YT0oMTUmbSkrOCwwPT09Yy53Yml0cyljLndiaXRzPXdhO2Vsc2UgaWYod2E+Yy53Yml0cyl7YS5tc2c9XCJpbnZhbGlkIHdpbmRvdyBzaXplXCIsYy5tb2RlPW1hO2JyZWFrfWMuZG1heD0xPDx3YSxhLmFkbGVyPWMuY2hlY2s9MSxjLm1vZGU9NTEyJm0/VTpXLG09MCxuPTA7YnJlYWs7Y2FzZSBNOmZvcig7bjwxNjspe2lmKDA9PT1pKWJyZWFrIGE7aS0tLG0rPWVbZysrXTw8bixuKz04fWlmKGMuZmxhZ3M9bSwoMjU1JmMuZmxhZ3MpIT09Syl7YS5tc2c9XCJ1bmtub3duIGNvbXByZXNzaW9uIG1ldGhvZFwiLGMubW9kZT1tYTticmVha31pZig1NzM0NCZjLmZsYWdzKXthLm1zZz1cInVua25vd24gaGVhZGVyIGZsYWdzIHNldFwiLGMubW9kZT1tYTticmVha31jLmhlYWQmJihjLmhlYWQudGV4dD1tPj44JjEpLDUxMiZjLmZsYWdzJiYoQmFbMF09MjU1Jm0sQmFbMV09bT4+PjgmMjU1LGMuY2hlY2s9dShjLmNoZWNrLEJhLDIsMCkpLG09MCxuPTAsYy5tb2RlPU47Y2FzZSBOOmZvcig7bjwzMjspe2lmKDA9PT1pKWJyZWFrIGE7aS0tLG0rPWVbZysrXTw8bixuKz04fWMuaGVhZCYmKGMuaGVhZC50aW1lPW0pLDUxMiZjLmZsYWdzJiYoQmFbMF09MjU1Jm0sQmFbMV09bT4+PjgmMjU1LEJhWzJdPW0+Pj4xNiYyNTUsQmFbM109bT4+PjI0JjI1NSxjLmNoZWNrPXUoYy5jaGVjayxCYSw0LDApKSxtPTAsbj0wLGMubW9kZT1PO2Nhc2UgTzpmb3IoO248MTY7KXtpZigwPT09aSlicmVhayBhO2ktLSxtKz1lW2crK108PG4sbis9OH1jLmhlYWQmJihjLmhlYWQueGZsYWdzPTI1NSZtLGMuaGVhZC5vcz1tPj44KSw1MTImYy5mbGFncyYmKEJhWzBdPTI1NSZtLEJhWzFdPW0+Pj44JjI1NSxjLmNoZWNrPXUoYy5jaGVjayxCYSwyLDApKSxtPTAsbj0wLGMubW9kZT1QO2Nhc2UgUDppZigxMDI0JmMuZmxhZ3Mpe2Zvcig7bjwxNjspe2lmKDA9PT1pKWJyZWFrIGE7aS0tLG0rPWVbZysrXTw8bixuKz04fWMubGVuZ3RoPW0sYy5oZWFkJiYoYy5oZWFkLmV4dHJhX2xlbj1tKSw1MTImYy5mbGFncyYmKEJhWzBdPTI1NSZtLEJhWzFdPW0+Pj44JjI1NSxjLmNoZWNrPXUoYy5jaGVjayxCYSwyLDApKSxtPTAsbj0wfWVsc2UgYy5oZWFkJiYoYy5oZWFkLmV4dHJhPW51bGwpO2MubW9kZT1RO2Nhc2UgUTppZigxMDI0JmMuZmxhZ3MmJihxPWMubGVuZ3RoLHE+aSYmKHE9aSkscSYmKGMuaGVhZCYmKHdhPWMuaGVhZC5leHRyYV9sZW4tYy5sZW5ndGgsYy5oZWFkLmV4dHJhfHwoYy5oZWFkLmV4dHJhPW5ldyBBcnJheShjLmhlYWQuZXh0cmFfbGVuKSkscy5hcnJheVNldChjLmhlYWQuZXh0cmEsZSxnLHEsd2EpKSw1MTImYy5mbGFncyYmKGMuY2hlY2s9dShjLmNoZWNrLGUscSxnKSksaS09cSxnKz1xLGMubGVuZ3RoLT1xKSxjLmxlbmd0aCkpYnJlYWsgYTtjLmxlbmd0aD0wLGMubW9kZT1SO2Nhc2UgUjppZigyMDQ4JmMuZmxhZ3Mpe2lmKDA9PT1pKWJyZWFrIGE7cT0wO2RvIHdhPWVbZytxKytdLGMuaGVhZCYmd2EmJmMubGVuZ3RoPDY1NTM2JiYoYy5oZWFkLm5hbWUrPVN0cmluZy5mcm9tQ2hhckNvZGUod2EpKTt3aGlsZSh3YSYmcTxpKTtpZig1MTImYy5mbGFncyYmKGMuY2hlY2s9dShjLmNoZWNrLGUscSxnKSksaS09cSxnKz1xLHdhKWJyZWFrIGF9ZWxzZSBjLmhlYWQmJihjLmhlYWQubmFtZT1udWxsKTtjLmxlbmd0aD0wLGMubW9kZT1TO2Nhc2UgUzppZig0MDk2JmMuZmxhZ3Mpe2lmKDA9PT1pKWJyZWFrIGE7cT0wO2RvIHdhPWVbZytxKytdLGMuaGVhZCYmd2EmJmMubGVuZ3RoPDY1NTM2JiYoYy5oZWFkLmNvbW1lbnQrPVN0cmluZy5mcm9tQ2hhckNvZGUod2EpKTt3aGlsZSh3YSYmcTxpKTtpZig1MTImYy5mbGFncyYmKGMuY2hlY2s9dShjLmNoZWNrLGUscSxnKSksaS09cSxnKz1xLHdhKWJyZWFrIGF9ZWxzZSBjLmhlYWQmJihjLmhlYWQuY29tbWVudD1udWxsKTtjLm1vZGU9VDtjYXNlIFQ6aWYoNTEyJmMuZmxhZ3Mpe2Zvcig7bjwxNjspe2lmKDA9PT1pKWJyZWFrIGE7aS0tLG0rPWVbZysrXTw8bixuKz04fWlmKG0hPT0oNjU1MzUmYy5jaGVjaykpe2EubXNnPVwiaGVhZGVyIGNyYyBtaXNtYXRjaFwiLGMubW9kZT1tYTticmVha31tPTAsbj0wfWMuaGVhZCYmKGMuaGVhZC5oY3JjPWMuZmxhZ3M+PjkmMSxjLmhlYWQuZG9uZT0hMCksYS5hZGxlcj1jLmNoZWNrPTAsYy5tb2RlPVc7YnJlYWs7Y2FzZSBVOmZvcig7bjwzMjspe2lmKDA9PT1pKWJyZWFrIGE7aS0tLG0rPWVbZysrXTw8bixuKz04fWEuYWRsZXI9Yy5jaGVjaz1kKG0pLG09MCxuPTAsYy5tb2RlPVY7Y2FzZSBWOmlmKDA9PT1jLmhhdmVkaWN0KXJldHVybiBhLm5leHRfb3V0PWgsYS5hdmFpbF9vdXQ9aixhLm5leHRfaW49ZyxhLmF2YWlsX2luPWksYy5ob2xkPW0sYy5iaXRzPW4sRjthLmFkbGVyPWMuY2hlY2s9MSxjLm1vZGU9VztjYXNlIFc6aWYoYj09PUJ8fGI9PT1DKWJyZWFrIGE7Y2FzZSBYOmlmKGMubGFzdCl7bT4+Pj03Jm4sbi09NyZuLGMubW9kZT1qYTticmVha31mb3IoO248Mzspe2lmKDA9PT1pKWJyZWFrIGE7aS0tLG0rPWVbZysrXTw8bixuKz04fXN3aXRjaChjLmxhc3Q9MSZtLG0+Pj49MSxuLT0xLDMmbSl7Y2FzZSAwOmMubW9kZT1ZO2JyZWFrO2Nhc2UgMTppZihrKGMpLGMubW9kZT1jYSxiPT09Qyl7bT4+Pj0yLG4tPTI7YnJlYWsgYX1icmVhaztjYXNlIDI6Yy5tb2RlPV87YnJlYWs7Y2FzZSAzOmEubXNnPVwiaW52YWxpZCBibG9jayB0eXBlXCIsYy5tb2RlPW1hfW0+Pj49MixuLT0yO2JyZWFrO2Nhc2UgWTpmb3IobT4+Pj03Jm4sbi09NyZuO248MzI7KXtpZigwPT09aSlicmVhayBhO2ktLSxtKz1lW2crK108PG4sbis9OH1pZigoNjU1MzUmbSkhPT0obT4+PjE2XjY1NTM1KSl7YS5tc2c9XCJpbnZhbGlkIHN0b3JlZCBibG9jayBsZW5ndGhzXCIsYy5tb2RlPW1hO2JyZWFrfWlmKGMubGVuZ3RoPTY1NTM1Jm0sbT0wLG49MCxjLm1vZGU9WixiPT09QylicmVhayBhO2Nhc2UgWjpjLm1vZGU9JDtjYXNlICQ6aWYocT1jLmxlbmd0aCl7aWYocT5pJiYocT1pKSxxPmomJihxPWopLDA9PT1xKWJyZWFrIGE7cy5hcnJheVNldChmLGUsZyxxLGgpLGktPXEsZys9cSxqLT1xLGgrPXEsYy5sZW5ndGgtPXE7YnJlYWt9Yy5tb2RlPVc7YnJlYWs7Y2FzZSBfOmZvcig7bjwxNDspe2lmKDA9PT1pKWJyZWFrIGE7aS0tLG0rPWVbZysrXTw8bixuKz04fWlmKGMubmxlbj0oMzEmbSkrMjU3LG0+Pj49NSxuLT01LGMubmRpc3Q9KDMxJm0pKzEsbT4+Pj01LG4tPTUsYy5uY29kZT0oMTUmbSkrNCxtPj4+PTQsbi09NCxjLm5sZW4+Mjg2fHxjLm5kaXN0PjMwKXthLm1zZz1cInRvbyBtYW55IGxlbmd0aCBvciBkaXN0YW5jZSBzeW1ib2xzXCIsYy5tb2RlPW1hO2JyZWFrfWMuaGF2ZT0wLGMubW9kZT1hYTtjYXNlIGFhOmZvcig7Yy5oYXZlPGMubmNvZGU7KXtmb3IoO248Mzspe2lmKDA9PT1pKWJyZWFrIGE7aS0tLG0rPWVbZysrXTw8bixuKz04fWMubGVuc1tDYVtjLmhhdmUrK11dPTcmbSxtPj4+PTMsbi09M31mb3IoO2MuaGF2ZTwxOTspYy5sZW5zW0NhW2MuaGF2ZSsrXV09MDtpZihjLmxlbmNvZGU9Yy5sZW5keW4sYy5sZW5iaXRzPTcseWE9e2JpdHM6Yy5sZW5iaXRzfSx4YT13KHgsYy5sZW5zLDAsMTksYy5sZW5jb2RlLDAsYy53b3JrLHlhKSxjLmxlbmJpdHM9eWEuYml0cyx4YSl7YS5tc2c9XCJpbnZhbGlkIGNvZGUgbGVuZ3RocyBzZXRcIixjLm1vZGU9bWE7YnJlYWt9Yy5oYXZlPTAsYy5tb2RlPWJhO2Nhc2UgYmE6Zm9yKDtjLmhhdmU8Yy5ubGVuK2MubmRpc3Q7KXtmb3IoO0FhPWMubGVuY29kZVttJigxPDxjLmxlbmJpdHMpLTFdLHFhPUFhPj4+MjQscmE9QWE+Pj4xNiYyNTUsc2E9NjU1MzUmQWEsIShxYTw9bik7KXtpZigwPT09aSlicmVhayBhO2ktLSxtKz1lW2crK108PG4sbis9OH1pZihzYTwxNiltPj4+PXFhLG4tPXFhLGMubGVuc1tjLmhhdmUrK109c2E7ZWxzZXtpZigxNj09PXNhKXtmb3IoemE9cWErMjtuPHphOyl7aWYoMD09PWkpYnJlYWsgYTtpLS0sbSs9ZVtnKytdPDxuLG4rPTh9aWYobT4+Pj1xYSxuLT1xYSwwPT09Yy5oYXZlKXthLm1zZz1cImludmFsaWQgYml0IGxlbmd0aCByZXBlYXRcIixjLm1vZGU9bWE7YnJlYWt9d2E9Yy5sZW5zW2MuaGF2ZS0xXSxxPTMrKDMmbSksbT4+Pj0yLG4tPTJ9ZWxzZSBpZigxNz09PXNhKXtmb3IoemE9cWErMztuPHphOyl7aWYoMD09PWkpYnJlYWsgYTtpLS0sbSs9ZVtnKytdPDxuLG4rPTh9bT4+Pj1xYSxuLT1xYSx3YT0wLHE9MysoNyZtKSxtPj4+PTMsbi09M31lbHNle2Zvcih6YT1xYSs3O248emE7KXtpZigwPT09aSlicmVhayBhO2ktLSxtKz1lW2crK108PG4sbis9OH1tPj4+PXFhLG4tPXFhLHdhPTAscT0xMSsoMTI3Jm0pLG0+Pj49NyxuLT03fWlmKGMuaGF2ZStxPmMubmxlbitjLm5kaXN0KXthLm1zZz1cImludmFsaWQgYml0IGxlbmd0aCByZXBlYXRcIixjLm1vZGU9bWE7YnJlYWt9Zm9yKDtxLS07KWMubGVuc1tjLmhhdmUrK109d2F9fWlmKGMubW9kZT09PW1hKWJyZWFrO2lmKDA9PT1jLmxlbnNbMjU2XSl7YS5tc2c9XCJpbnZhbGlkIGNvZGUgLS0gbWlzc2luZyBlbmQtb2YtYmxvY2tcIixjLm1vZGU9bWE7YnJlYWt9aWYoYy5sZW5iaXRzPTkseWE9e2JpdHM6Yy5sZW5iaXRzfSx4YT13KHksYy5sZW5zLDAsYy5ubGVuLGMubGVuY29kZSwwLGMud29yayx5YSksYy5sZW5iaXRzPXlhLmJpdHMseGEpe2EubXNnPVwiaW52YWxpZCBsaXRlcmFsL2xlbmd0aHMgc2V0XCIsYy5tb2RlPW1hO2JyZWFrfWlmKGMuZGlzdGJpdHM9NixjLmRpc3Rjb2RlPWMuZGlzdGR5bix5YT17Yml0czpjLmRpc3RiaXRzfSx4YT13KHosYy5sZW5zLGMubmxlbixjLm5kaXN0LGMuZGlzdGNvZGUsMCxjLndvcmsseWEpLGMuZGlzdGJpdHM9eWEuYml0cyx4YSl7YS5tc2c9XCJpbnZhbGlkIGRpc3RhbmNlcyBzZXRcIixjLm1vZGU9bWE7YnJlYWt9aWYoYy5tb2RlPWNhLGI9PT1DKWJyZWFrIGE7Y2FzZSBjYTpjLm1vZGU9ZGE7Y2FzZSBkYTppZihpPj02JiZqPj0yNTgpe2EubmV4dF9vdXQ9aCxhLmF2YWlsX291dD1qLGEubmV4dF9pbj1nLGEuYXZhaWxfaW49aSxjLmhvbGQ9bSxjLmJpdHM9bix2KGEscCksaD1hLm5leHRfb3V0LGY9YS5vdXRwdXQsaj1hLmF2YWlsX291dCxnPWEubmV4dF9pbixlPWEuaW5wdXQsaT1hLmF2YWlsX2luLG09Yy5ob2xkLG49Yy5iaXRzLGMubW9kZT09PVcmJihjLmJhY2s9LTEpO2JyZWFrfWZvcihjLmJhY2s9MDtBYT1jLmxlbmNvZGVbbSYoMTw8Yy5sZW5iaXRzKS0xXSxxYT1BYT4+PjI0LHJhPUFhPj4+MTYmMjU1LHNhPTY1NTM1JkFhLCEocWE8PW4pOyl7aWYoMD09PWkpYnJlYWsgYTtpLS0sbSs9ZVtnKytdPDxuLG4rPTh9aWYocmEmJjA9PT0oMjQwJnJhKSl7Zm9yKHRhPXFhLHVhPXJhLHZhPXNhO0FhPWMubGVuY29kZVt2YSsoKG0mKDE8PHRhK3VhKS0xKT4+dGEpXSxxYT1BYT4+PjI0LHJhPUFhPj4+MTYmMjU1LHNhPTY1NTM1JkFhLCEodGErcWE8PW4pOyl7aWYoMD09PWkpYnJlYWsgYTtpLS0sbSs9ZVtnKytdPDxuLG4rPTh9bT4+Pj10YSxuLT10YSxjLmJhY2srPXRhfWlmKG0+Pj49cWEsbi09cWEsYy5iYWNrKz1xYSxjLmxlbmd0aD1zYSwwPT09cmEpe2MubW9kZT1pYTticmVha31pZigzMiZyYSl7Yy5iYWNrPS0xLGMubW9kZT1XO2JyZWFrfWlmKDY0JnJhKXthLm1zZz1cImludmFsaWQgbGl0ZXJhbC9sZW5ndGggY29kZVwiLGMubW9kZT1tYTticmVha31jLmV4dHJhPTE1JnJhLGMubW9kZT1lYTtjYXNlIGVhOmlmKGMuZXh0cmEpe2Zvcih6YT1jLmV4dHJhO248emE7KXtpZigwPT09aSlicmVhayBhO2ktLSxtKz1lW2crK108PG4sbis9OH1jLmxlbmd0aCs9bSYoMTw8Yy5leHRyYSktMSxtPj4+PWMuZXh0cmEsbi09Yy5leHRyYSxjLmJhY2srPWMuZXh0cmF9Yy53YXM9Yy5sZW5ndGgsYy5tb2RlPWZhO2Nhc2UgZmE6Zm9yKDtBYT1jLmRpc3Rjb2RlW20mKDE8PGMuZGlzdGJpdHMpLTFdLHFhPUFhPj4+MjQscmE9QWE+Pj4xNiYyNTUsc2E9NjU1MzUmQWEsIShxYTw9bik7KXtpZigwPT09aSlicmVhayBhO2ktLSxtKz1lW2crK108PG4sbis9OH1pZigwPT09KDI0MCZyYSkpe2Zvcih0YT1xYSx1YT1yYSx2YT1zYTtBYT1jLmRpc3Rjb2RlW3ZhKygobSYoMTw8dGErdWEpLTEpPj50YSldLHFhPUFhPj4+MjQscmE9QWE+Pj4xNiYyNTUsc2E9NjU1MzUmQWEsISh0YStxYTw9bik7KXtpZigwPT09aSlicmVhayBhO2ktLSxtKz1lW2crK108PG4sbis9OH1tPj4+PXRhLG4tPXRhLGMuYmFjays9dGF9aWYobT4+Pj1xYSxuLT1xYSxjLmJhY2srPXFhLDY0JnJhKXthLm1zZz1cImludmFsaWQgZGlzdGFuY2UgY29kZVwiLGMubW9kZT1tYTticmVha31jLm9mZnNldD1zYSxjLmV4dHJhPTE1JnJhLGMubW9kZT1nYTtjYXNlIGdhOmlmKGMuZXh0cmEpe2Zvcih6YT1jLmV4dHJhO248emE7KXtpZigwPT09aSlicmVhayBhO2ktLSxtKz1lW2crK108PG4sbis9OH1jLm9mZnNldCs9bSYoMTw8Yy5leHRyYSktMSxtPj4+PWMuZXh0cmEsbi09Yy5leHRyYSxjLmJhY2srPWMuZXh0cmF9aWYoYy5vZmZzZXQ+Yy5kbWF4KXthLm1zZz1cImludmFsaWQgZGlzdGFuY2UgdG9vIGZhciBiYWNrXCIsYy5tb2RlPW1hO2JyZWFrfWMubW9kZT1oYTtjYXNlIGhhOmlmKDA9PT1qKWJyZWFrIGE7aWYocT1wLWosYy5vZmZzZXQ+cSl7aWYocT1jLm9mZnNldC1xLHE+Yy53aGF2ZSYmYy5zYW5lKXthLm1zZz1cImludmFsaWQgZGlzdGFuY2UgdG9vIGZhciBiYWNrXCIsYy5tb2RlPW1hO2JyZWFrfXE+Yy53bmV4dD8ocS09Yy53bmV4dCxyPWMud3NpemUtcSk6cj1jLnduZXh0LXEscT5jLmxlbmd0aCYmKHE9Yy5sZW5ndGgpLHBhPWMud2luZG93fWVsc2UgcGE9ZixyPWgtYy5vZmZzZXQscT1jLmxlbmd0aDtxPmomJihxPWopLGotPXEsYy5sZW5ndGgtPXE7ZG8gZltoKytdPXBhW3IrK107d2hpbGUoLS1xKTswPT09Yy5sZW5ndGgmJihjLm1vZGU9ZGEpO2JyZWFrO2Nhc2UgaWE6aWYoMD09PWopYnJlYWsgYTtmW2grK109Yy5sZW5ndGgsai0tLGMubW9kZT1kYTticmVhaztjYXNlIGphOmlmKGMud3JhcCl7Zm9yKDtuPDMyOyl7aWYoMD09PWkpYnJlYWsgYTtpLS0sbXw9ZVtnKytdPDxuLG4rPTh9aWYocC09aixhLnRvdGFsX291dCs9cCxjLnRvdGFsKz1wLHAmJihhLmFkbGVyPWMuY2hlY2s9Yy5mbGFncz91KGMuY2hlY2ssZixwLGgtcCk6dChjLmNoZWNrLGYscCxoLXApKSxwPWosKGMuZmxhZ3M/bTpkKG0pKSE9PWMuY2hlY2spe2EubXNnPVwiaW5jb3JyZWN0IGRhdGEgY2hlY2tcIixjLm1vZGU9bWE7YnJlYWt9bT0wLG49MH1jLm1vZGU9a2E7Y2FzZSBrYTppZihjLndyYXAmJmMuZmxhZ3Mpe2Zvcig7bjwzMjspe2lmKDA9PT1pKWJyZWFrIGE7aS0tLG0rPWVbZysrXTw8bixuKz04fWlmKG0hPT0oNDI5NDk2NzI5NSZjLnRvdGFsKSl7YS5tc2c9XCJpbmNvcnJlY3QgbGVuZ3RoIGNoZWNrXCIsYy5tb2RlPW1hO2JyZWFrfW09MCxuPTB9Yy5tb2RlPWxhO2Nhc2UgbGE6eGE9RTticmVhayBhO2Nhc2UgbWE6eGE9SDticmVhayBhO2Nhc2UgbmE6cmV0dXJuIEk7Y2FzZSBvYTpkZWZhdWx0OnJldHVybiBHfXJldHVybiBhLm5leHRfb3V0PWgsYS5hdmFpbF9vdXQ9aixhLm5leHRfaW49ZyxhLmF2YWlsX2luPWksYy5ob2xkPW0sYy5iaXRzPW4sKGMud3NpemV8fHAhPT1hLmF2YWlsX291dCYmYy5tb2RlPG1hJiYoYy5tb2RlPGphfHxiIT09QSkpJiZsKGEsYS5vdXRwdXQsYS5uZXh0X291dCxwLWEuYXZhaWxfb3V0KT8oYy5tb2RlPW5hLEkpOihvLT1hLmF2YWlsX2luLHAtPWEuYXZhaWxfb3V0LGEudG90YWxfaW4rPW8sYS50b3RhbF9vdXQrPXAsYy50b3RhbCs9cCxjLndyYXAmJnAmJihhLmFkbGVyPWMuY2hlY2s9Yy5mbGFncz91KGMuY2hlY2ssZixwLGEubmV4dF9vdXQtcCk6dChjLmNoZWNrLGYscCxhLm5leHRfb3V0LXApKSxhLmRhdGFfdHlwZT1jLmJpdHMrKGMubGFzdD82NDowKSsoYy5tb2RlPT09Vz8xMjg6MCkrKGMubW9kZT09PWNhfHxjLm1vZGU9PT1aPzI1NjowKSwoMD09PW8mJjA9PT1wfHxiPT09QSkmJnhhPT09RCYmKHhhPUopLHhhKX1mdW5jdGlvbiBuKGEpe2lmKCFhfHwhYS5zdGF0ZSlyZXR1cm4gRzt2YXIgYj1hLnN0YXRlO3JldHVybiBiLndpbmRvdyYmKGIud2luZG93PW51bGwpLGEuc3RhdGU9bnVsbCxEfWZ1bmN0aW9uIG8oYSxiKXt2YXIgYztyZXR1cm4gYSYmYS5zdGF0ZT8oYz1hLnN0YXRlLDA9PT0oMiZjLndyYXApP0c6KGMuaGVhZD1iLGIuZG9uZT0hMSxEKSk6R31mdW5jdGlvbiBwKGEsYil7dmFyIGMsZCxlLGY9Yi5sZW5ndGg7cmV0dXJuIGEmJmEuc3RhdGU/KGM9YS5zdGF0ZSwwIT09Yy53cmFwJiZjLm1vZGUhPT1WP0c6Yy5tb2RlPT09ViYmKGQ9MSxkPXQoZCxiLGYsMCksZCE9PWMuY2hlY2spP0g6KGU9bChhLGIsZixmKSk/KGMubW9kZT1uYSxJKTooYy5oYXZlZGljdD0xLEQpKTpHfXZhciBxLHIscz1hKFwiLi4vdXRpbHMvY29tbW9uXCIpLHQ9YShcIi4vYWRsZXIzMlwiKSx1PWEoXCIuL2NyYzMyXCIpLHY9YShcIi4vaW5mZmFzdFwiKSx3PWEoXCIuL2luZnRyZWVzXCIpLHg9MCx5PTEsej0yLEE9NCxCPTUsQz02LEQ9MCxFPTEsRj0yLEc9LTIsSD0tMyxJPS00LEo9LTUsSz04LEw9MSxNPTIsTj0zLE89NCxQPTUsUT02LFI9NyxTPTgsVD05LFU9MTAsVj0xMSxXPTEyLFg9MTMsWT0xNCxaPTE1LCQ9MTYsXz0xNyxhYT0xOCxiYT0xOSxjYT0yMCxkYT0yMSxlYT0yMixmYT0yMyxnYT0yNCxoYT0yNSxpYT0yNixqYT0yNyxrYT0yOCxsYT0yOSxtYT0zMCxuYT0zMSxvYT0zMixwYT04NTIscWE9NTkyLHJhPTE1LHNhPXJhLHRhPSEwO2MuaW5mbGF0ZVJlc2V0PWcsYy5pbmZsYXRlUmVzZXQyPWgsYy5pbmZsYXRlUmVzZXRLZWVwPWYsYy5pbmZsYXRlSW5pdD1qLGMuaW5mbGF0ZUluaXQyPWksYy5pbmZsYXRlPW0sYy5pbmZsYXRlRW5kPW4sYy5pbmZsYXRlR2V0SGVhZGVyPW8sYy5pbmZsYXRlU2V0RGljdGlvbmFyeT1wLGMuaW5mbGF0ZUluZm89XCJwYWtvIGluZmxhdGUgKGZyb20gTm9kZWNhIHByb2plY3QpXCJ9LHtcIi4uL3V0aWxzL2NvbW1vblwiOjYyLFwiLi9hZGxlcjMyXCI6NjQsXCIuL2NyYzMyXCI6NjYsXCIuL2luZmZhc3RcIjo2OSxcIi4vaW5mdHJlZXNcIjo3MX1dLDcxOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7dmFyIGQ9YShcIi4uL3V0aWxzL2NvbW1vblwiKSxlPTE1LGY9ODUyLGc9NTkyLGg9MCxpPTEsaj0yLGs9WzMsNCw1LDYsNyw4LDksMTAsMTEsMTMsMTUsMTcsMTksMjMsMjcsMzEsMzUsNDMsNTEsNTksNjcsODMsOTksMTE1LDEzMSwxNjMsMTk1LDIyNywyNTgsMCwwXSxsPVsxNiwxNiwxNiwxNiwxNiwxNiwxNiwxNiwxNywxNywxNywxNywxOCwxOCwxOCwxOCwxOSwxOSwxOSwxOSwyMCwyMCwyMCwyMCwyMSwyMSwyMSwyMSwxNiw3Miw3OF0sbT1bMSwyLDMsNCw1LDcsOSwxMywxNywyNSwzMyw0OSw2NSw5NywxMjksMTkzLDI1NywzODUsNTEzLDc2OSwxMDI1LDE1MzcsMjA0OSwzMDczLDQwOTcsNjE0NSw4MTkzLDEyMjg5LDE2Mzg1LDI0NTc3LDAsMF0sbj1bMTYsMTYsMTYsMTYsMTcsMTcsMTgsMTgsMTksMTksMjAsMjAsMjEsMjEsMjIsMjIsMjMsMjMsMjQsMjQsMjUsMjUsMjYsMjYsMjcsMjcsMjgsMjgsMjksMjksNjQsNjRdO2IuZXhwb3J0cz1mdW5jdGlvbihhLGIsYyxvLHAscSxyLHMpe3ZhciB0LHUsdix3LHgseSx6LEEsQixDPXMuYml0cyxEPTAsRT0wLEY9MCxHPTAsSD0wLEk9MCxKPTAsSz0wLEw9MCxNPTAsTj1udWxsLE89MCxQPW5ldyBkLkJ1ZjE2KGUrMSksUT1uZXcgZC5CdWYxNihlKzEpLFI9bnVsbCxTPTA7Zm9yKEQ9MDtEPD1lO0QrKylQW0RdPTA7Zm9yKEU9MDtFPG87RSsrKVBbYltjK0VdXSsrO2ZvcihIPUMsRz1lO0c+PTEmJjA9PT1QW0ddO0ctLSk7aWYoSD5HJiYoSD1HKSwwPT09RylyZXR1cm4gcFtxKytdPTIwOTcxNTIwLHBbcSsrXT0yMDk3MTUyMCxzLmJpdHM9MSwwO2ZvcihGPTE7RjxHJiYwPT09UFtGXTtGKyspO2ZvcihIPEYmJihIPUYpLEs9MSxEPTE7RDw9ZTtEKyspaWYoSzw8PTEsSy09UFtEXSxLPDApcmV0dXJuLTE7aWYoSz4wJiYoYT09PWh8fDEhPT1HKSlyZXR1cm4tMTtmb3IoUVsxXT0wLEQ9MTtEPGU7RCsrKVFbRCsxXT1RW0RdK1BbRF07Zm9yKEU9MDtFPG87RSsrKTAhPT1iW2MrRV0mJihyW1FbYltjK0VdXSsrXT1FKTtpZihhPT09aD8oTj1SPXIseT0xOSk6YT09PWk/KE49ayxPLT0yNTcsUj1sLFMtPTI1Nyx5PTI1Nik6KE49bSxSPW4seT0tMSksTT0wLEU9MCxEPUYseD1xLEk9SCxKPTAsdj0tMSxMPTE8PEgsdz1MLTEsYT09PWkmJkw+Znx8YT09PWomJkw+ZylyZXR1cm4gMTtmb3IoOzspe3o9RC1KLHJbRV08eT8oQT0wLEI9cltFXSk6cltFXT55PyhBPVJbUytyW0VdXSxCPU5bTytyW0VdXSk6KEE9OTYsQj0wKSx0PTE8PEQtSix1PTE8PEksRj11O2RvIHUtPXQscFt4KyhNPj5KKSt1XT16PDwyNHxBPDwxNnxCfDA7d2hpbGUoMCE9PXUpO2Zvcih0PTE8PEQtMTtNJnQ7KXQ+Pj0xO2lmKDAhPT10PyhNJj10LTEsTSs9dCk6TT0wLEUrKywwPT09LS1QW0RdKXtpZihEPT09RylicmVhaztEPWJbYytyW0VdXX1pZihEPkgmJihNJncpIT09dil7Zm9yKDA9PT1KJiYoSj1IKSx4Kz1GLEk9RC1KLEs9MTw8STtJK0o8RyYmKEstPVBbSStKXSwhKEs8PTApKTspSSsrLEs8PD0xO2lmKEwrPTE8PEksYT09PWkmJkw+Znx8YT09PWomJkw+ZylyZXR1cm4gMTt2PU0mdyxwW3ZdPUg8PDI0fEk8PDE2fHgtcXwwfX1yZXR1cm4gMCE9PU0mJihwW3grTV09RC1KPDwyNHw2NDw8MTZ8MCkscy5iaXRzPUgsMH19LHtcIi4uL3V0aWxzL2NvbW1vblwiOjYyfV0sNzI6W2Z1bmN0aW9uKGEsYixjKXtcInVzZSBzdHJpY3RcIjtiLmV4cG9ydHM9ezI6XCJuZWVkIGRpY3Rpb25hcnlcIiwxOlwic3RyZWFtIGVuZFwiLDA6XCJcIixcIi0xXCI6XCJmaWxlIGVycm9yXCIsXCItMlwiOlwic3RyZWFtIGVycm9yXCIsXCItM1wiOlwiZGF0YSBlcnJvclwiLFwiLTRcIjpcImluc3VmZmljaWVudCBtZW1vcnlcIixcIi01XCI6XCJidWZmZXIgZXJyb3JcIixcIi02XCI6XCJpbmNvbXBhdGlibGUgdmVyc2lvblwifX0se31dLDczOltmdW5jdGlvbihhLGIsYyl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZChhKXtmb3IodmFyIGI9YS5sZW5ndGg7LS1iPj0wOylhW2JdPTB9ZnVuY3Rpb24gZShhLGIsYyxkLGUpe3RoaXMuc3RhdGljX3RyZWU9YSx0aGlzLmV4dHJhX2JpdHM9Yix0aGlzLmV4dHJhX2Jhc2U9Yyx0aGlzLmVsZW1zPWQsdGhpcy5tYXhfbGVuZ3RoPWUsdGhpcy5oYXNfc3RyZWU9YSYmYS5sZW5ndGh9ZnVuY3Rpb24gZihhLGIpe3RoaXMuZHluX3RyZWU9YSx0aGlzLm1heF9jb2RlPTAsdGhpcy5zdGF0X2Rlc2M9Yn1mdW5jdGlvbiBnKGEpe3JldHVybiBhPDI1Nj9pYVthXTppYVsyNTYrKGE+Pj43KV19ZnVuY3Rpb24gaChhLGIpe2EucGVuZGluZ19idWZbYS5wZW5kaW5nKytdPTI1NSZiLGEucGVuZGluZ19idWZbYS5wZW5kaW5nKytdPWI+Pj44JjI1NX1mdW5jdGlvbiBpKGEsYixjKXthLmJpX3ZhbGlkPlgtYz8oYS5iaV9idWZ8PWI8PGEuYmlfdmFsaWQmNjU1MzUsaChhLGEuYmlfYnVmKSxhLmJpX2J1Zj1iPj5YLWEuYmlfdmFsaWQsYS5iaV92YWxpZCs9Yy1YKTooYS5iaV9idWZ8PWI8PGEuYmlfdmFsaWQmNjU1MzUsYS5iaV92YWxpZCs9Yyl9ZnVuY3Rpb24gaihhLGIsYyl7aShhLGNbMipiXSxjWzIqYisxXSl9ZnVuY3Rpb24gayhhLGIpe3ZhciBjPTA7ZG8gY3w9MSZhLGE+Pj49MSxjPDw9MTt3aGlsZSgtLWI+MCk7cmV0dXJuIGM+Pj4xfWZ1bmN0aW9uIGwoYSl7MTY9PT1hLmJpX3ZhbGlkPyhoKGEsYS5iaV9idWYpLGEuYmlfYnVmPTAsYS5iaV92YWxpZD0wKTphLmJpX3ZhbGlkPj04JiYoYS5wZW5kaW5nX2J1ZlthLnBlbmRpbmcrK109MjU1JmEuYmlfYnVmLGEuYmlfYnVmPj49OCxhLmJpX3ZhbGlkLT04KX1mdW5jdGlvbiBtKGEsYil7dmFyIGMsZCxlLGYsZyxoLGk9Yi5keW5fdHJlZSxqPWIubWF4X2NvZGUsaz1iLnN0YXRfZGVzYy5zdGF0aWNfdHJlZSxsPWIuc3RhdF9kZXNjLmhhc19zdHJlZSxtPWIuc3RhdF9kZXNjLmV4dHJhX2JpdHMsbj1iLnN0YXRfZGVzYy5leHRyYV9iYXNlLG89Yi5zdGF0X2Rlc2MubWF4X2xlbmd0aCxwPTA7Zm9yKGY9MDtmPD1XO2YrKylhLmJsX2NvdW50W2ZdPTA7Zm9yKGlbMiphLmhlYXBbYS5oZWFwX21heF0rMV09MCxcbmM9YS5oZWFwX21heCsxO2M8VjtjKyspZD1hLmhlYXBbY10sZj1pWzIqaVsyKmQrMV0rMV0rMSxmPm8mJihmPW8scCsrKSxpWzIqZCsxXT1mLGQ+anx8KGEuYmxfY291bnRbZl0rKyxnPTAsZD49biYmKGc9bVtkLW5dKSxoPWlbMipkXSxhLm9wdF9sZW4rPWgqKGYrZyksbCYmKGEuc3RhdGljX2xlbis9aCooa1syKmQrMV0rZykpKTtpZigwIT09cCl7ZG97Zm9yKGY9by0xOzA9PT1hLmJsX2NvdW50W2ZdOylmLS07YS5ibF9jb3VudFtmXS0tLGEuYmxfY291bnRbZisxXSs9MixhLmJsX2NvdW50W29dLS0scC09Mn13aGlsZShwPjApO2ZvcihmPW87MCE9PWY7Zi0tKWZvcihkPWEuYmxfY291bnRbZl07MCE9PWQ7KWU9YS5oZWFwWy0tY10sZT5qfHwoaVsyKmUrMV0hPT1mJiYoYS5vcHRfbGVuKz0oZi1pWzIqZSsxXSkqaVsyKmVdLGlbMiplKzFdPWYpLGQtLSl9fWZ1bmN0aW9uIG4oYSxiLGMpe3ZhciBkLGUsZj1uZXcgQXJyYXkoVysxKSxnPTA7Zm9yKGQ9MTtkPD1XO2QrKylmW2RdPWc9ZytjW2QtMV08PDE7Zm9yKGU9MDtlPD1iO2UrKyl7dmFyIGg9YVsyKmUrMV07MCE9PWgmJihhWzIqZV09ayhmW2hdKyssaCkpfX1mdW5jdGlvbiBvKCl7dmFyIGEsYixjLGQsZixnPW5ldyBBcnJheShXKzEpO2ZvcihjPTAsZD0wO2Q8US0xO2QrKylmb3Ioa2FbZF09YyxhPTA7YTwxPDxiYVtkXTthKyspamFbYysrXT1kO2ZvcihqYVtjLTFdPWQsZj0wLGQ9MDtkPDE2O2QrKylmb3IobGFbZF09ZixhPTA7YTwxPDxjYVtkXTthKyspaWFbZisrXT1kO2ZvcihmPj49NztkPFQ7ZCsrKWZvcihsYVtkXT1mPDw3LGE9MDthPDE8PGNhW2RdLTc7YSsrKWlhWzI1NitmKytdPWQ7Zm9yKGI9MDtiPD1XO2IrKylnW2JdPTA7Zm9yKGE9MDthPD0xNDM7KWdhWzIqYSsxXT04LGErKyxnWzhdKys7Zm9yKDthPD0yNTU7KWdhWzIqYSsxXT05LGErKyxnWzldKys7Zm9yKDthPD0yNzk7KWdhWzIqYSsxXT03LGErKyxnWzddKys7Zm9yKDthPD0yODc7KWdhWzIqYSsxXT04LGErKyxnWzhdKys7Zm9yKG4oZ2EsUysxLGcpLGE9MDthPFQ7YSsrKWhhWzIqYSsxXT01LGhhWzIqYV09ayhhLDUpO21hPW5ldyBlKGdhLGJhLFIrMSxTLFcpLG5hPW5ldyBlKGhhLGNhLDAsVCxXKSxvYT1uZXcgZShuZXcgQXJyYXkoMCksZGEsMCxVLFkpfWZ1bmN0aW9uIHAoYSl7dmFyIGI7Zm9yKGI9MDtiPFM7YisrKWEuZHluX2x0cmVlWzIqYl09MDtmb3IoYj0wO2I8VDtiKyspYS5keW5fZHRyZWVbMipiXT0wO2ZvcihiPTA7YjxVO2IrKylhLmJsX3RyZWVbMipiXT0wO2EuZHluX2x0cmVlWzIqWl09MSxhLm9wdF9sZW49YS5zdGF0aWNfbGVuPTAsYS5sYXN0X2xpdD1hLm1hdGNoZXM9MH1mdW5jdGlvbiBxKGEpe2EuYmlfdmFsaWQ+OD9oKGEsYS5iaV9idWYpOmEuYmlfdmFsaWQ+MCYmKGEucGVuZGluZ19idWZbYS5wZW5kaW5nKytdPWEuYmlfYnVmKSxhLmJpX2J1Zj0wLGEuYmlfdmFsaWQ9MH1mdW5jdGlvbiByKGEsYixjLGQpe3EoYSksZCYmKGgoYSxjKSxoKGEsfmMpKSxHLmFycmF5U2V0KGEucGVuZGluZ19idWYsYS53aW5kb3csYixjLGEucGVuZGluZyksYS5wZW5kaW5nKz1jfWZ1bmN0aW9uIHMoYSxiLGMsZCl7dmFyIGU9MipiLGY9MipjO3JldHVybiBhW2VdPGFbZl18fGFbZV09PT1hW2ZdJiZkW2JdPD1kW2NdfWZ1bmN0aW9uIHQoYSxiLGMpe2Zvcih2YXIgZD1hLmhlYXBbY10sZT1jPDwxO2U8PWEuaGVhcF9sZW4mJihlPGEuaGVhcF9sZW4mJnMoYixhLmhlYXBbZSsxXSxhLmhlYXBbZV0sYS5kZXB0aCkmJmUrKywhcyhiLGQsYS5oZWFwW2VdLGEuZGVwdGgpKTspYS5oZWFwW2NdPWEuaGVhcFtlXSxjPWUsZTw8PTE7YS5oZWFwW2NdPWR9ZnVuY3Rpb24gdShhLGIsYyl7dmFyIGQsZSxmLGgsaz0wO2lmKDAhPT1hLmxhc3RfbGl0KWRvIGQ9YS5wZW5kaW5nX2J1ZlthLmRfYnVmKzIqa108PDh8YS5wZW5kaW5nX2J1ZlthLmRfYnVmKzIqaysxXSxlPWEucGVuZGluZ19idWZbYS5sX2J1ZitrXSxrKyssMD09PWQ/aihhLGUsYik6KGY9amFbZV0saihhLGYrUisxLGIpLGg9YmFbZl0sMCE9PWgmJihlLT1rYVtmXSxpKGEsZSxoKSksZC0tLGY9ZyhkKSxqKGEsZixjKSxoPWNhW2ZdLDAhPT1oJiYoZC09bGFbZl0saShhLGQsaCkpKTt3aGlsZShrPGEubGFzdF9saXQpO2ooYSxaLGIpfWZ1bmN0aW9uIHYoYSxiKXt2YXIgYyxkLGUsZj1iLmR5bl90cmVlLGc9Yi5zdGF0X2Rlc2Muc3RhdGljX3RyZWUsaD1iLnN0YXRfZGVzYy5oYXNfc3RyZWUsaT1iLnN0YXRfZGVzYy5lbGVtcyxqPS0xO2ZvcihhLmhlYXBfbGVuPTAsYS5oZWFwX21heD1WLGM9MDtjPGk7YysrKTAhPT1mWzIqY10/KGEuaGVhcFsrK2EuaGVhcF9sZW5dPWo9YyxhLmRlcHRoW2NdPTApOmZbMipjKzFdPTA7Zm9yKDthLmhlYXBfbGVuPDI7KWU9YS5oZWFwWysrYS5oZWFwX2xlbl09ajwyPysrajowLGZbMiplXT0xLGEuZGVwdGhbZV09MCxhLm9wdF9sZW4tLSxoJiYoYS5zdGF0aWNfbGVuLT1nWzIqZSsxXSk7Zm9yKGIubWF4X2NvZGU9aixjPWEuaGVhcF9sZW4+PjE7Yz49MTtjLS0pdChhLGYsYyk7ZT1pO2RvIGM9YS5oZWFwWzFdLGEuaGVhcFsxXT1hLmhlYXBbYS5oZWFwX2xlbi0tXSx0KGEsZiwxKSxkPWEuaGVhcFsxXSxhLmhlYXBbLS1hLmhlYXBfbWF4XT1jLGEuaGVhcFstLWEuaGVhcF9tYXhdPWQsZlsyKmVdPWZbMipjXStmWzIqZF0sYS5kZXB0aFtlXT0oYS5kZXB0aFtjXT49YS5kZXB0aFtkXT9hLmRlcHRoW2NdOmEuZGVwdGhbZF0pKzEsZlsyKmMrMV09ZlsyKmQrMV09ZSxhLmhlYXBbMV09ZSsrLHQoYSxmLDEpO3doaWxlKGEuaGVhcF9sZW4+PTIpO2EuaGVhcFstLWEuaGVhcF9tYXhdPWEuaGVhcFsxXSxtKGEsYiksbihmLGosYS5ibF9jb3VudCl9ZnVuY3Rpb24gdyhhLGIsYyl7dmFyIGQsZSxmPS0xLGc9YlsxXSxoPTAsaT03LGo9NDtmb3IoMD09PWcmJihpPTEzOCxqPTMpLGJbMiooYysxKSsxXT02NTUzNSxkPTA7ZDw9YztkKyspZT1nLGc9YlsyKihkKzEpKzFdLCsraDxpJiZlPT09Z3x8KGg8aj9hLmJsX3RyZWVbMiplXSs9aDowIT09ZT8oZSE9PWYmJmEuYmxfdHJlZVsyKmVdKyssYS5ibF90cmVlWzIqJF0rKyk6aDw9MTA/YS5ibF90cmVlWzIqX10rKzphLmJsX3RyZWVbMiphYV0rKyxoPTAsZj1lLDA9PT1nPyhpPTEzOCxqPTMpOmU9PT1nPyhpPTYsaj0zKTooaT03LGo9NCkpfWZ1bmN0aW9uIHgoYSxiLGMpe3ZhciBkLGUsZj0tMSxnPWJbMV0saD0wLGs9NyxsPTQ7Zm9yKDA9PT1nJiYoaz0xMzgsbD0zKSxkPTA7ZDw9YztkKyspaWYoZT1nLGc9YlsyKihkKzEpKzFdLCEoKytoPGsmJmU9PT1nKSl7aWYoaDxsKXtkbyBqKGEsZSxhLmJsX3RyZWUpO3doaWxlKDAhPT0tLWgpfWVsc2UgMCE9PWU/KGUhPT1mJiYoaihhLGUsYS5ibF90cmVlKSxoLS0pLGooYSwkLGEuYmxfdHJlZSksaShhLGgtMywyKSk6aDw9MTA/KGooYSxfLGEuYmxfdHJlZSksaShhLGgtMywzKSk6KGooYSxhYSxhLmJsX3RyZWUpLGkoYSxoLTExLDcpKTtoPTAsZj1lLDA9PT1nPyhrPTEzOCxsPTMpOmU9PT1nPyhrPTYsbD0zKTooaz03LGw9NCl9fWZ1bmN0aW9uIHkoYSl7dmFyIGI7Zm9yKHcoYSxhLmR5bl9sdHJlZSxhLmxfZGVzYy5tYXhfY29kZSksdyhhLGEuZHluX2R0cmVlLGEuZF9kZXNjLm1heF9jb2RlKSx2KGEsYS5ibF9kZXNjKSxiPVUtMTtiPj0zJiYwPT09YS5ibF90cmVlWzIqZWFbYl0rMV07Yi0tKTtyZXR1cm4gYS5vcHRfbGVuKz0zKihiKzEpKzUrNSs0LGJ9ZnVuY3Rpb24geihhLGIsYyxkKXt2YXIgZTtmb3IoaShhLGItMjU3LDUpLGkoYSxjLTEsNSksaShhLGQtNCw0KSxlPTA7ZTxkO2UrKylpKGEsYS5ibF90cmVlWzIqZWFbZV0rMV0sMyk7eChhLGEuZHluX2x0cmVlLGItMSkseChhLGEuZHluX2R0cmVlLGMtMSl9ZnVuY3Rpb24gQShhKXt2YXIgYixjPTQwOTM2MjQ0NDc7Zm9yKGI9MDtiPD0zMTtiKyssYz4+Pj0xKWlmKDEmYyYmMCE9PWEuZHluX2x0cmVlWzIqYl0pcmV0dXJuIEk7aWYoMCE9PWEuZHluX2x0cmVlWzE4XXx8MCE9PWEuZHluX2x0cmVlWzIwXXx8MCE9PWEuZHluX2x0cmVlWzI2XSlyZXR1cm4gSjtmb3IoYj0zMjtiPFI7YisrKWlmKDAhPT1hLmR5bl9sdHJlZVsyKmJdKXJldHVybiBKO3JldHVybiBJfWZ1bmN0aW9uIEIoYSl7cGF8fChvKCkscGE9ITApLGEubF9kZXNjPW5ldyBmKGEuZHluX2x0cmVlLG1hKSxhLmRfZGVzYz1uZXcgZihhLmR5bl9kdHJlZSxuYSksYS5ibF9kZXNjPW5ldyBmKGEuYmxfdHJlZSxvYSksYS5iaV9idWY9MCxhLmJpX3ZhbGlkPTAscChhKX1mdW5jdGlvbiBDKGEsYixjLGQpe2koYSwoTDw8MSkrKGQ/MTowKSwzKSxyKGEsYixjLCEwKX1mdW5jdGlvbiBEKGEpe2koYSxNPDwxLDMpLGooYSxaLGdhKSxsKGEpfWZ1bmN0aW9uIEUoYSxiLGMsZCl7dmFyIGUsZixnPTA7YS5sZXZlbD4wPyhhLnN0cm0uZGF0YV90eXBlPT09SyYmKGEuc3RybS5kYXRhX3R5cGU9QShhKSksdihhLGEubF9kZXNjKSx2KGEsYS5kX2Rlc2MpLGc9eShhKSxlPWEub3B0X2xlbiszKzc+Pj4zLGY9YS5zdGF0aWNfbGVuKzMrNz4+PjMsZjw9ZSYmKGU9ZikpOmU9Zj1jKzUsYys0PD1lJiZiIT09LTE/QyhhLGIsYyxkKTphLnN0cmF0ZWd5PT09SHx8Zj09PWU/KGkoYSwoTTw8MSkrKGQ/MTowKSwzKSx1KGEsZ2EsaGEpKTooaShhLChOPDwxKSsoZD8xOjApLDMpLHooYSxhLmxfZGVzYy5tYXhfY29kZSsxLGEuZF9kZXNjLm1heF9jb2RlKzEsZysxKSx1KGEsYS5keW5fbHRyZWUsYS5keW5fZHRyZWUpKSxwKGEpLGQmJnEoYSl9ZnVuY3Rpb24gRihhLGIsYyl7cmV0dXJuIGEucGVuZGluZ19idWZbYS5kX2J1ZisyKmEubGFzdF9saXRdPWI+Pj44JjI1NSxhLnBlbmRpbmdfYnVmW2EuZF9idWYrMiphLmxhc3RfbGl0KzFdPTI1NSZiLGEucGVuZGluZ19idWZbYS5sX2J1ZithLmxhc3RfbGl0XT0yNTUmYyxhLmxhc3RfbGl0KyssMD09PWI/YS5keW5fbHRyZWVbMipjXSsrOihhLm1hdGNoZXMrKyxiLS0sYS5keW5fbHRyZWVbMiooamFbY10rUisxKV0rKyxhLmR5bl9kdHJlZVsyKmcoYildKyspLGEubGFzdF9saXQ9PT1hLmxpdF9idWZzaXplLTF9dmFyIEc9YShcIi4uL3V0aWxzL2NvbW1vblwiKSxIPTQsST0wLEo9MSxLPTIsTD0wLE09MSxOPTIsTz0zLFA9MjU4LFE9MjksUj0yNTYsUz1SKzErUSxUPTMwLFU9MTksVj0yKlMrMSxXPTE1LFg9MTYsWT03LFo9MjU2LCQ9MTYsXz0xNyxhYT0xOCxiYT1bMCwwLDAsMCwwLDAsMCwwLDEsMSwxLDEsMiwyLDIsMiwzLDMsMywzLDQsNCw0LDQsNSw1LDUsNSwwXSxjYT1bMCwwLDAsMCwxLDEsMiwyLDMsMyw0LDQsNSw1LDYsNiw3LDcsOCw4LDksOSwxMCwxMCwxMSwxMSwxMiwxMiwxMywxM10sZGE9WzAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMiwzLDddLGVhPVsxNiwxNywxOCwwLDgsNyw5LDYsMTAsNSwxMSw0LDEyLDMsMTMsMiwxNCwxLDE1XSxmYT01MTIsZ2E9bmV3IEFycmF5KDIqKFMrMikpO2QoZ2EpO3ZhciBoYT1uZXcgQXJyYXkoMipUKTtkKGhhKTt2YXIgaWE9bmV3IEFycmF5KGZhKTtkKGlhKTt2YXIgamE9bmV3IEFycmF5KFAtTysxKTtkKGphKTt2YXIga2E9bmV3IEFycmF5KFEpO2Qoa2EpO3ZhciBsYT1uZXcgQXJyYXkoVCk7ZChsYSk7dmFyIG1hLG5hLG9hLHBhPSExO2MuX3RyX2luaXQ9QixjLl90cl9zdG9yZWRfYmxvY2s9QyxjLl90cl9mbHVzaF9ibG9jaz1FLGMuX3RyX3RhbGx5PUYsYy5fdHJfYWxpZ249RH0se1wiLi4vdXRpbHMvY29tbW9uXCI6NjJ9XSw3NDpbZnVuY3Rpb24oYSxiLGMpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIGQoKXt0aGlzLmlucHV0PW51bGwsdGhpcy5uZXh0X2luPTAsdGhpcy5hdmFpbF9pbj0wLHRoaXMudG90YWxfaW49MCx0aGlzLm91dHB1dD1udWxsLHRoaXMubmV4dF9vdXQ9MCx0aGlzLmF2YWlsX291dD0wLHRoaXMudG90YWxfb3V0PTAsdGhpcy5tc2c9XCJcIix0aGlzLnN0YXRlPW51bGwsdGhpcy5kYXRhX3R5cGU9Mix0aGlzLmFkbGVyPTB9Yi5leHBvcnRzPWR9LHt9XX0se30sWzEwXSkoMTApfSk7IiwiaW1wb3J0IHsgTW9kZWwsIElDb250cm9sbGVyIH0gZnJvbSAnLi9saWIvbXZjLmpzJztcclxuaW1wb3J0IElTdG9yZSAgZnJvbSAnLi9zdG9yZS9JU3RvcmUuanMnO1xyXG5pbXBvcnQgRE9NIGZyb20gJy4vbGliL2RyeS1kb20uanMnO1xyXG5cclxud2luZG93LnN0cmxkciA9IHJlcXVpcmUoXCIuL2xpYi9zdHJsZHIuanNcIik7XHJcblxyXG5jbGFzcyBBcHAge1xyXG5cclxuICAgIHN0YXRpYyBcIkBpbmplY3RcIiA9IHtcclxuICAgICAgICBET006RE9NLFxyXG4gICAgICAgIHN0b3JlOklTdG9yZSxcclxuICAgICAgICBwb29sOlwicG9vbFwiLFxyXG4gICAgICAgIGNvbnRyb2xsZXJzOltJQ29udHJvbGxlcixbXV0sXHJcbiAgICAgICAgcm9vdDogW01vZGVsLCB7c2NvcGU6XCJyb290XCJ9XVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdHJ1Y3Rvcigpe1xyXG5cclxuICAgICAgICB3aW5kb3cuc3RvcmUgPSB0aGlzLnN0b3JlO1xyXG5cclxuICAgICAgICB0aGlzLnBvb2wuYWRkKHRoaXMpO1xyXG5cclxuICAgICAgICB0aGlzLm1vZGVscyA9IFtdO1xyXG5cclxuICAgICAgICB0aGlzLnN0b3JlLm9ubG9hZCA9IHRoaXMuaW5pdC5iaW5kKHRoaXMpO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBpbml0KCl7XHJcblxyXG5cdGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgZXZ0ID0+IHtcclxuXHQgICAgdGhpcy5wb29sLmNhbGwoXCJvblByZXNzXCIgKyBldnQuY29kZSk7XHJcblx0ICAgIC8vIGNvbnNvbGUubG9nKGV2dCk7XHJcblx0fSk7XHJcblxyXG5cdGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIGV2dCA9PiB7XHJcblx0ICAgIHRoaXMucG9vbC5jYWxsKFwib25SZWxlYXNlXCIgKyBldnQuY29kZSk7XHJcblx0ICAgIC8vIGNvbnNvbGUubG9nKGV2dCk7XHJcblx0fSk7XHJcblxyXG4gICAgICAgIHRoaXMuY29udHJvbGxlcnMuZm9yRWFjaCgoY29udHJvbGxlcikgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBvb2wuYWRkKCBjb250cm9sbGVyICk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMucG9vbC5jYWxsKFwiZW50ZXJTcGxhc2hcIik7XHJcblxyXG5cclxuICAgICAgICBzZXRJbnRlcnZhbCggdGhpcy5jb21taXQuYmluZCh0aGlzKSwgMzAwMCApO1xyXG5cclxuICAgICAgICB2YXIgcGVuZGluZyA9IDI7XHJcbiAgICAgICAgdGhpcy5vcGVuTW9kZWwoIFwiYXBwXCIsIGRvbmUuYmluZCh0aGlzKSApO1xyXG4gICAgICAgIHNldFRpbWVvdXQoIGRvbmUuYmluZCh0aGlzKSwgMTAwMCApO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiBkb25lKCl7XHJcbiAgICAgICAgICAgIHBlbmRpbmctLTtcclxuICAgICAgICAgICAgaWYoICFwZW5kaW5nIClcclxuICAgICAgICAgICAgICAgIHRoaXMucG9vbC5jYWxsKCBcImV4aXRTcGxhc2hcIiApO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIG9wZW5Nb2RlbCggbmFtZSwgY2IsIG1vZGVsICl7XHJcblxyXG4gICAgICAgIHZhciBvbGRNb2RlbCA9IHRoaXMubW9kZWxzLmZpbmQoKG9iaikgPT4gb2JqLm5hbWUgPT0gbmFtZSApO1xyXG5cclxuICAgICAgICBpZiggb2xkTW9kZWwgKXtcclxuXHJcbiAgICAgICAgICAgIGlmKCBvbGRNb2RlbCA9PSBtb2RlbCApIHJldHVybjtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZU1vZGVsKCBuYW1lICk7XHJcblxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHBhdGggPSBuYW1lO1xyXG5cclxuICAgICAgICBpZiggdHlwZW9mIG1vZGVsID09IFwic3RyaW5nXCIgKXtcclxuICAgICAgICAgICAgcGF0aCA9IG1vZGVsO1xyXG4gICAgICAgICAgICBtb2RlbCA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiggIW1vZGVsICkgbW9kZWwgPSBuZXcgTW9kZWwoKTtcclxuXHJcbiAgICAgICAgdGhpcy5yb290LnNldEl0ZW0oIG5hbWUsIG1vZGVsLmRhdGEgKTtcclxuXHJcbiAgICAgICAgdGhpcy5tb2RlbHNbIHRoaXMubW9kZWxzLmxlbmd0aCBdID0ge1xyXG4gICAgICAgICAgICBtb2RlbCxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgICAgcGF0aCxcclxuICAgICAgICAgICAgZGlydHk6IGZhbHNlXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5zdG9yZS5nZXRUZXh0SXRlbSggcGF0aCwgKGRhdGEpPT57XHJcblxyXG4gICAgICAgICAgICBpZiggZGF0YSApe1xyXG5cdFx0bW9kZWwubG9hZCggSlNPTi5wYXJzZShkYXRhKSApO1xyXG5cdFx0aWYoIG1vZGVsLmdldEl0ZW0oXCJleHBpcmVzXCIpID4gKG5ldyBEYXRlKCkpLmdldFRpbWUoKSApe1xyXG4gICAgICAgICAgICAgICAgICAgIG1vZGVsLmRpcnR5ID0gZmFsc2U7XHJcblx0XHQgICAgY2IuY2FsbCgpO1xyXG5cdFx0ICAgIHJldHVybjtcclxuXHRcdH1cclxuICAgICAgICAgICAgfVxyXG5cdCAgICBcclxuICAgICAgICAgICAgdGhpcy5wb29sLmNhbGwoIG5hbWUgKyBcIk1vZGVsSW5pdFwiLCBtb2RlbCwgY2IgKTtcclxuXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlTW9kZWwoIG5hbWUgKXtcclxuICAgICAgICAvLyB0by1kbzogZmluZCwgY29tbWl0LCByZW1vdmUgZnJvbSB0aGlzLm1vZGVsc1xyXG4gICAgfVxyXG5cclxuICAgIGFwcE1vZGVsSW5pdCggbW9kZWwsIGNiICl7XHJcblxyXG5cdGxldCByZXBvVVJMID0gW1xyXG5cdCAgICBcImh0dHA6Ly93d3cuY3JhaXQubmV0L2FyZHVib3kvcmVwbzIuanNvblwiLFxyXG5cdCAgICBcImh0dHA6Ly9hcmR1Ym95LnJpZWQuY2wvcmVwby5qc29uXCIsXHJcblx0ICAgIFwicmVwby5qc29uXCJcclxuXHRdO1xyXG5cclxuXHRpZiggbmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKFwiRWxlY3Ryb25cIikgPT0gLTEgJiYgdHlwZW9mIGNvcmRvdmEgPT0gXCJ1bmRlZmluZWRcIiApe1xyXG5cdCAgICAvLyBtb2RlbC5zZXRJdGVtKFwicHJveHlcIiwgXCJodHRwczovL2Nyb3Nzb3JpZ2luLm1lL1wiKTtcclxuXHQgICAgbW9kZWwuc2V0SXRlbShcInByb3h5XCIsIFwiaHR0cHM6Ly9jb3JzLWFueXdoZXJlLmhlcm9rdWFwcC5jb20vXCIpO1xyXG5cdCAgICByZXBvVVJMID0gcmVwb1VSTC5tYXAoIHVybCA9PiAoL15odHRwcz8uKi8udGVzdCh1cmwpID8gbW9kZWwuZ2V0SXRlbShcInByb3h5XCIpIDogXCJcIikgKyB1cmwgKTtcclxuXHR9ZWxzZXtcclxuXHQgICAgbW9kZWwuc2V0SXRlbShcInByb3h5XCIsIFwiXCIpO1xyXG5cdH1cclxuXHJcblx0bGV0IGl0ZW1zID0gW107XHJcblx0bGV0IHBlbmRpbmcgPSAzO1xyXG5cclxuXHRyZXBvVVJMLmZvckVhY2goIHVybCA9PlxyXG5cdFx0XHQgZmV0Y2goIHVybCApXHJcblx0XHRcdCAudGhlbiggcnNwID0+IHJzcC5qc29uKCkgKVxyXG5cdFx0XHQgLnRoZW4oIGFkZCApXHJcblx0XHRcdCAuY2F0Y2goIGVyciA9PiB7XHJcblx0XHRcdCAgICAgY29uc29sZS5sb2coIGVyciApO1xyXG5cdFx0XHQgICAgIGRvbmUoKTtcclxuXHRcdFx0IH0pXHRcclxuXHRcdCAgICAgICApO1xyXG5cclxuXHRmdW5jdGlvbiBhZGQoIGpzb24gKXtcclxuXHRcclxuXHQgICAgaWYoIGpzb24gJiYganNvbi5pdGVtcyApe1xyXG5cdCAgICBcclxuXHRcdGpzb24uaXRlbXMuZm9yRWFjaCggaXRlbSA9PiB7XHJcblx0XHQgICAgXHJcblx0XHQgICAgaXRlbS5hdXRob3IgPSBpdGVtLmF1dGhvciB8fCBcIjw8dW5rbm93bj4+XCI7XHJcblx0XHQgICAgXHJcblx0XHQgICAgaWYoXHJcblx0XHRcdGl0ZW0uYmFubmVyICYmIChcclxuXHRcdFx0ICAgICFpdGVtLnNjcmVlbnNob3RzIHx8XHJcblx0XHRcdFx0IWl0ZW0uc2NyZWVuc2hvdHNbMF0gfHxcclxuXHRcdFx0XHQhaXRlbS5zY3JlZW5zaG90c1swXS5maWxlbmFtZVxyXG5cdFx0XHQpKVxyXG5cdFx0XHRpdGVtLnNjcmVlbnNob3RzID0gW3tmaWxlbmFtZTppdGVtLmJhbm5lcn1dO1xyXG5cdFx0ICAgIFxyXG5cdFx0ICAgIGlmKCBpdGVtLmFyZHVib3kgJiYgKFxyXG5cdFx0XHQhaXRlbS5iaW5hcmllcyB8fFxyXG5cdFx0XHQgICAgIWl0ZW0uYmluYXJpZXNbMF0gfHxcclxuXHRcdFx0ICAgICFpdGVtLmJpbmFyaWVzWzBdLmZpbGVuYW1lXHJcblx0XHQgICAgKSlcclxuXHRcdFx0aXRlbS5iaW5hcmllcyA9IFt7ZmlsZW5hbWU6aXRlbS5hcmR1Ym95fV1cclxuXHRcdCAgICBcclxuXHRcdCAgICBpdGVtcy5wdXNoKGl0ZW0pO1xyXG5cdFx0fSk7XHJcblx0ICAgIH1cclxuXHQgICAgXHJcblx0ICAgIGRvbmUoKTtcclxuXHQgICAgXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBkb25lKCl7XHJcblx0ICAgIHBlbmRpbmctLTtcclxuXHJcblx0ICAgIGlmKCAhcGVuZGluZyApe1xyXG5cdFx0aXRlbXMgPSBpdGVtcy5zb3J0KChhLCBiKSA9PiB7XHJcblx0XHQgICAgaWYoIGEudGl0bGUgPiBiLnRpdGxlICkgcmV0dXJuIDE7XHJcblx0XHQgICAgaWYoIGEudGl0bGUgPCBiLnRpdGxlICkgcmV0dXJuIC0xO1xyXG5cdFx0ICAgIHJldHVybiAwO1xyXG5cdFx0fSk7XHJcblx0XHRtb2RlbC5yZW1vdmVJdGVtKFwicmVwb1wiKTtcclxuXHRcdG1vZGVsLnNldEl0ZW0oXCJyZXBvXCIsIGl0ZW1zKTtcclxuXHRcdG1vZGVsLnNldEl0ZW0oXCJleHBpcmVzXCIsIChuZXcgRGF0ZSgpKS5nZXRUaW1lKCkgKyA2MCAqIDYwICogMTAwMCApO1xyXG5cdFx0Y2IoKTtcclxuXHQgICAgfVxyXG5cdH1cclxuICAgIH1cclxuXHJcbiAgICBjb21taXQoKXtcclxuXHJcbiAgICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCB0aGlzLm1vZGVscy5sZW5ndGg7ICsraSApe1xyXG5cclxuICAgICAgICAgICAgdmFyIG9iaiA9IHRoaXMubW9kZWxzW2ldO1xyXG4gICAgICAgICAgICBpZiggIW9iai5kaXJ0eSAmJiBvYmoubW9kZWwuZGlydHkgKXtcclxuXHJcbiAgICAgICAgICAgICAgICBvYmouZGlydHkgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgb2JqLm1vZGVsLmRpcnR5ID0gZmFsc2U7XHJcblxyXG4gICAgICAgICAgICB9ZWxzZSBpZiggb2JqLmRpcnR5ICYmICFvYmoubW9kZWwuZGlydHkgKXtcclxuXHJcbiAgICAgICAgICAgICAgICBvYmouZGlydHkgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RvcmUuc2V0SXRlbSggb2JqLnBhdGgsIEpTT04uc3RyaW5naWZ5KG9iai5tb2RlbC5kYXRhKSApO1xyXG5cclxuICAgICAgICAgICAgfWVsc2UgaWYoIG9iai5kaXJ0eSAmJiBvYmoubW9kZWwuZGlydHkgKXtcclxuXHJcbiAgICAgICAgICAgICAgICBvYmoubW9kZWwuZGlydHkgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBzZXRBY3RpdmVWaWV3KCB2aWV3ICl7XHJcbiAgICAgICAgWy4uLnRoaXMuRE9NLmVsZW1lbnQuY2hpbGRyZW5dLmZvckVhY2goIG5vZGUgPT4gbm9kZS5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKG5vZGUpICk7XHJcbiAgICB9XHJcblxyXG59XHJcblxyXG5cclxuZXhwb3J0IGRlZmF1bHQgQXBwO1xyXG4iLCJcclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcblxyXG4gICAgd3JpdGU6e1xyXG5cclxuICAgICAgICBbMHgxNSArIDB4MjBdOmZ1bmN0aW9uKCB2YWx1ZSApe1xyXG5cclxuICAgICAgICAgICAgdGhpcy5UT1YwID0gdmFsdWUgJiAxO1xyXG4gICAgICAgICAgICB0aGlzLk9DRjBBID0gKHZhbHVlPj4xKSAmIDE7XHJcbiAgICAgICAgICAgIHRoaXMuT0NGMEIgPSAodmFsdWU+PjIpICYgMTtcclxuXHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgWzB4MjQgKyAweDIwXTpmdW5jdGlvbiggdmFsdWUgKXtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuV0dNMDAgID0gKHZhbHVlPj4wKSAmIDE7XHJcbiAgICAgICAgICAgIHRoaXMuV0dNMDEgID0gKHZhbHVlPj4xKSAmIDE7XHJcbiAgICAgICAgICAgIHRoaXMuQ09NMEIwID0gKHZhbHVlPj40KSAmIDE7XHJcbiAgICAgICAgICAgIHRoaXMuQ09NMEIxID0gKHZhbHVlPj41KSAmIDE7XHJcbiAgICAgICAgICAgIHRoaXMuQ09NMEEwID0gKHZhbHVlPj42KSAmIDE7XHJcbiAgICAgICAgICAgIHRoaXMuQ09NMEExID0gKHZhbHVlPj43KSAmIDE7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlKCk7XHJcblxyXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgVENDUjBBOlxcbiAgV0dNMDA6JHt0aGlzLldHTTAwfVxcbiAgV0dNMDE6JHt0aGlzLldHTTAxfVxcbiAgQ09NMEIwOiR7dGhpcy5DT00wQjB9XFxuICBDT00wQjE6JHt0aGlzLkNPTTBCMX1cXG4gIENPTTBBMDoke3RoaXMuQ09NMEEwfVxcbiAgQ09NMEExOiR7dGhpcy5DT00wQTF9YCk7XHJcblxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIFsweDI1ICsgMHgyMF06ZnVuY3Rpb24oIHZhbHVlICl7XHJcblxyXG4gICAgICAgICAgICB0aGlzLkZPQzBBID0gKHZhbHVlPj43KSAmIDE7XHJcbiAgICAgICAgICAgIHRoaXMuRk9DMEIgPSAodmFsdWU+PjYpICYgMTtcclxuICAgICAgICAgICAgdGhpcy5XR00wMiA9ICh2YWx1ZT4+MykgJiAxO1xyXG4gICAgICAgICAgICB0aGlzLkNTID0gdmFsdWUgJiA3O1xyXG5cclxuICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYFRDQ1IwQjpcXG4gIEZPQzBBOiR7dGhpcy5GT0MwQX1cXG4gIEZPQzBCOiR7dGhpcy5GT0MwQn1cXG4gIFdHTTAyOiR7dGhpcy5XR00wMn1gKTtcclxuXHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCBcIlBDPVwiICsgKHRoaXMuY29yZS5wYzw8MSkudG9TdHJpbmcoMTYpICsgXCIgV1JJVEUgVENDUjBCOiAjXCIgKyB2YWx1ZS50b1N0cmluZygxNikgKyBcIiA6IFwiICsgdmFsdWUgKTtcclxuXHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgWzB4MjcgKyAweDIwXTpmdW5jdGlvbiggdmFsdWUgKXtcclxuICAgICAgICAgICAgdGhpcy5PQ1IwQSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyggXCJPQ1IwQSA9IFwiICsgdmFsdWUgKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBbMHgyOCArIDB4MjBdOmZ1bmN0aW9uKCB2YWx1ZSApe1xyXG4gICAgICAgICAgICB0aGlzLk9DUjBCID0gdmFsdWU7XHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCBcIk9DUjBCID0gXCIgKyB2YWx1ZSApO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIFsweDZFXTpmdW5jdGlvbiggdmFsdWUgKXtcclxuICAgICAgICAgICAgdGhpcy5UT0lFMCA9IHZhbHVlICYgMTtcclxuICAgICAgICAgICAgdGhpcy5PQ0lFMEEgPSAodmFsdWU+PjEpICYgMTtcclxuICAgICAgICAgICAgdGhpcy5PQ0lFMEIgPSAodmFsdWU+PjIpICYgMTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICB9LFxyXG5cclxuICAgIGluaXQ6ZnVuY3Rpb24oKXtcclxuICAgICAgICB0aGlzLnRpY2sgPSAwO1xyXG4gICAgICAgIHRoaXMuV0dNMDAgID0gMDtcclxuICAgICAgICB0aGlzLldHTTAxICA9IDA7XHJcbiAgICAgICAgdGhpcy5DT00wQjAgPSAwO1xyXG4gICAgICAgIHRoaXMuQ09NMEIxID0gMDtcclxuICAgICAgICB0aGlzLkNPTTBBMCA9IDA7XHJcbiAgICAgICAgdGhpcy5DT00wQTEgPSAwO1xyXG4gICAgICAgIHRoaXMuRk9DMEEgPSAwO1xyXG4gICAgICAgIHRoaXMuRk9DMEIgPSAwO1xyXG4gICAgICAgIHRoaXMuV0dNMDIgPSAwO1xyXG4gICAgICAgIHRoaXMuQ1MgPSAwO1xyXG4gICAgICAgIHRoaXMuVE9WMCA9IDA7XHJcblxyXG4gICAgICAgIHRoaXMuVE9JRTAgPSAwO1xyXG4gICAgICAgIHRoaXMuT0NJRTBBID0gMDtcclxuICAgICAgICB0aGlzLk9DSUUwQiA9IDA7XHJcblxyXG4gICAgICAgIHRoaXMudGltZSA9IDA7XHJcblxyXG4gICAgICAgIHRoaXMudXBkYXRlU3RhdGUgPSBmdW5jdGlvbigpe1xyXG5cclxuICAgICAgICAgICAgdmFyIE1BWCA9IDB4RkYsIEJPVFRPTSA9IDAsIFdHTTAwID0gdGhpcy5XR00wMCwgV0dNMDEgPSB0aGlzLldHTTAxLCBXR00wMiA9IHRoaXMuV0dNMDI7XHJcblxyXG4gICAgICAgICAgICBpZiggICAgICAgV0dNMDIgPT0gMCAmJiBXR00wMSA9PSAwICYmIFdHTTAwID09IDAgKXtcclxuICAgICAgICAgICAgICAgIHRoaXMubW9kZSA9IDA7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlRpbWVyIE1vZGU6IE5vcm1hbCAoXCIgKyB0aGlzLm1vZGUgKyBcIilcIik7XHJcbiAgICAgICAgICAgIH1lbHNlIGlmKCBXR00wMiA9PSAwICYmIFdHTTAxID09IDAgJiYgV0dNMDAgPT0gMSApe1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlID0gMTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVGltZXIgTW9kZTogUFdNLCBwaGFzZSBjb3JyZWN0IChcIiArIHRoaXMubW9kZSArIFwiKVwiKTtcclxuICAgICAgICAgICAgfWVsc2UgaWYoIFdHTTAyID09IDAgJiYgV0dNMDEgPT0gMSAmJiBXR00wMCA9PSAwICl7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGUgPSAyO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJUaW1lciBNb2RlOiBDVEMgKFwiICsgdGhpcy5tb2RlICsgXCIpXCIpO1xyXG4gICAgICAgICAgICB9ZWxzZSBpZiggV0dNMDIgPT0gMCAmJiBXR00wMSA9PSAxICYmIFdHTTAwID09IDEgKXtcclxuICAgICAgICAgICAgICAgIHRoaXMubW9kZSA9IDM7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlRpbWVyIE1vZGU6IEZhc3QgUFdNIChcIiArIHRoaXMubW9kZSArIFwiKVwiKTtcclxuICAgICAgICAgICAgfWVsc2UgaWYoIFdHTTAyID09IDEgJiYgV0dNMDEgPT0gMCAmJiBXR00wMCA9PSAwICl7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGUgPSA0O1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJUaW1lciBNb2RlOiBSZXNlcnZlZCAoXCIgKyB0aGlzLm1vZGUgKyBcIilcIik7XHJcbiAgICAgICAgICAgIH1lbHNlIGlmKCBXR00wMiA9PSAxICYmIFdHTTAxID09IDAgJiYgV0dNMDAgPT0gMSApe1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlID0gNTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVGltZXIgTW9kZTogUFdNLCBwaGFzZSBjb3JyZWN0IChcIiArIHRoaXMubW9kZSArIFwiKVwiKTtcclxuICAgICAgICAgICAgfWVsc2UgaWYoIFdHTTAyID09IDEgJiYgV0dNMDEgPT0gMSAmJiBXR00wMCA9PSAwICl7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGUgPSA2O1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJUaW1lciBNb2RlOiBSZXNlcnZlZCAoXCIgKyB0aGlzLm1vZGUgKyBcIilcIik7XHJcbiAgICAgICAgICAgIH1lbHNlIGlmKCBXR00wMiA9PSAxICYmIFdHTTAxID09IDEgJiYgV0dNMDAgPT0gMSApe1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlID0gNztcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVGltZXIgTW9kZTogRmFzdCBQV00gKFwiICsgdGhpcy5tb2RlICsgXCIpXCIpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzd2l0Y2goIHRoaXMuQ1MgKXtcclxuICAgICAgICAgICAgY2FzZSAwOiB0aGlzLnByZXNjYWxlID0gMDsgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgMTogdGhpcy5wcmVzY2FsZSA9IDE7IGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIDI6IHRoaXMucHJlc2NhbGUgPSA4OyBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAzOiB0aGlzLnByZXNjYWxlID0gNjQ7IGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIDQ6IHRoaXMucHJlc2NhbGUgPSAyNTY7IGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIDU6IHRoaXMucHJlc2NhbGUgPSAxMDI0OyBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDogdGhpcy5wcmVzY2FsZSA9IDE7IGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgfSxcclxuXHJcbiAgICByZWFkOntcclxuXHJcbiAgICAgICAgWzB4MTUgKyAweDIwXTpmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICByZXR1cm4gKCghIXRoaXMuVE9WMCkmMSkgfCAodGhpcy5PQ0YwQTw8MSkgfCAodGhpcy5PQ0YwQjw8Mik7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgWzB4MjYgKyAweDIwXTpmdW5jdGlvbigpe1xyXG5cclxuICAgICAgICAgICAgdmFyIHRpY2sgPSB0aGlzLmNvcmUudGljaztcclxuXHJcbiAgICAgICAgICAgIHZhciB0aWNrc1NpbmNlT1ZGID0gdGljayAtIHRoaXMudGljaztcclxuICAgICAgICAgICAgdmFyIGludGVydmFsID0gKHRpY2tzU2luY2VPVkYgLyB0aGlzLnByZXNjYWxlKSB8IDA7XHJcbiAgICAgICAgICAgIGlmKCAhaW50ZXJ2YWwgKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgdmFyIFRDTlQwID0gMHgyNiArIDB4MjA7XHJcbiAgICAgICAgICAgIHZhciBjbnQgPSB0aGlzLmNvcmUubWVtb3J5WyBUQ05UMCBdICsgaW50ZXJ2YWw7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmNvcmUubWVtb3J5WyBUQ05UMCBdICs9IGludGVydmFsO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy50aWNrICs9IGludGVydmFsKnRoaXMucHJlc2NhbGU7XHJcblxyXG4gICAgICAgICAgICB0aGlzLlRPVjAgKz0gKGNudCAvIDB4RkYpIHwgMDtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH0sXHJcblxyXG4gICAgdXBkYXRlOmZ1bmN0aW9uKCB0aWNrLCBpZSApe1xyXG5cclxuICAgICAgICB2YXIgdGlja3NTaW5jZU9WRiA9IHRpY2sgLSB0aGlzLnRpY2s7XHJcbiAgICAgICAgdmFyIGludGVydmFsID0gKHRpY2tzU2luY2VPVkYgLyB0aGlzLnByZXNjYWxlKSB8IDA7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYoIGludGVydmFsICl7XHJcbiAgICAgICAgICAgIHZhciBUQ05UMCA9IDB4MjYgKyAweDIwO1xyXG4gICAgICAgICAgICB2YXIgY250ID0gdGhpcy5jb3JlLm1lbW9yeVsgVENOVDAgXSArIGludGVydmFsO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5jb3JlLm1lbW9yeVsgVENOVDAgXSArPSBpbnRlcnZhbDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMudGljayArPSBpbnRlcnZhbCp0aGlzLnByZXNjYWxlO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5UT1YwICs9IChjbnQgLyAweEZGKSB8IDA7XHJcblxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoIHRoaXMuVE9WMCA+IDAgJiYgaWUgKXtcclxuICAgICAgICAgICAgdGhpcy5UT1YwLS07XHJcbiAgICAgICAgICAgIHJldHVybiBcIlRJTUVSME9cIjtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcblxyXG4gICAgd3JpdGU6e1xyXG4gICAgICAgIDB4QzAoIHZhbHVlICl7IHJldHVybiB0aGlzLlVDU1IwQSA9ICh0aGlzLlVDU1IwQSAmIDBiMTAxMTExMDApIHwgKHZhbHVlICYgMGIwMTAwMDAxMSk7IH0sXHJcbiAgICAgICAgMHhDMSggdmFsdWUgKXsgcmV0dXJuIHRoaXMuVUNTUjBCID0gdmFsdWU7IH0sXHJcbiAgICAgICAgMHhDMiggdmFsdWUgKXsgcmV0dXJuIHRoaXMuVUNTUjBDID0gdmFsdWU7IH0sXHJcbiAgICAgICAgMHhDNCggdmFsdWUgKXsgcmV0dXJuIHRoaXMuVUJSUjBMID0gdmFsdWU7IH0sXHJcbiAgICAgICAgMHhDNSggdmFsdWUgKXsgcmV0dXJuIHRoaXMuVUJSUjBIID0gdmFsdWU7IH0sXHJcbiAgICAgICAgMHhDNiggdmFsdWUgKXsgdGhpcy5jb3JlLnBpbnMuc2VyaWFsMCA9ICh0aGlzLmNvcmUucGlucy5zZXJpYWwwfHxcIlwiKSArIFN0cmluZy5mcm9tQ2hhckNvZGUodmFsdWUpOyByZXR1cm4gdGhpcy5VRFIwID0gdmFsdWU7IH1cclxuICAgIH0sXHJcblxyXG4gICAgcmVhZDp7XHJcbiAgICAgICAgMHhDMCgpeyByZXR1cm4gdGhpcy5VQ1NSMEE7IH0sXHJcbiAgICAgICAgMHhDMSgpeyByZXR1cm4gdGhpcy5VQ1NSMEI7IH0sXHJcbiAgICAgICAgMHhDMigpeyByZXR1cm4gdGhpcy5VQ1NSMEM7IH0sXHJcbiAgICAgICAgMHhDNCgpeyByZXR1cm4gdGhpcy5VQlJSMEw7IH0sXHJcbiAgICAgICAgMHhDNSgpeyByZXR1cm4gdGhpcy5VQlJSMEggJiAweDBGOyB9LFxyXG4gICAgICAgIDB4QzYoKXsgcmV0dXJuIHRoaXMuVURSMDsgfVxyXG4gICAgfSxcclxuXHJcbiAgICBpbml0OmZ1bmN0aW9uKCl7XHJcbiAgICAgICAgdGhpcy5VQ1NSMEEgPSAweDIwO1xyXG4gICAgICAgIHRoaXMuVUNTUjBCID0gMDtcclxuICAgICAgICB0aGlzLlVDU1IwQyA9IDB4MDY7XHJcbiAgICAgICAgdGhpcy5VQlJSMEwgPSAwOyAvLyBVU0FSVCBCYXVkIFJhdGUgMCBSZWdpc3RlciBMb3dcclxuICAgICAgICB0aGlzLlVCUlIwSCA9IDA7IC8vIFVTQVJUIEJhdWQgUmF0ZSAwIFJlZ2lzdGVyIEhpZ2ggICAgICAgICAgICBcclxuICAgICAgICB0aGlzLlVEUjAgPSAwO1xyXG4gICAgfSxcclxuXHJcbiAgICB1cGRhdGU6ZnVuY3Rpb24oIHRpY2ssIGllICl7XHJcblxyXG4gICAgfVxyXG5cclxufTtcclxuIiwiXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIFBPUlRCOntcbiAgICAgICAgd3JpdGU6e1xuICAgICAgICAgICAgWzB4MDQgKyAweDIwXTpmdW5jdGlvbiggdmFsdWUgKXtcbiAgICAgICAgICAgICAgICB0aGlzLmNvcmUucGlucy5ERFJCID0gdmFsdWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgWzB4MDUgKyAweDIwXTpmdW5jdGlvbiggdmFsdWUsIG9sZFZhbHVlICl7XG5cbiAgICAgICAgICAgICAgICBpZiggb2xkVmFsdWUgPT0gdmFsdWUgKSByZXR1cm47XG5cblx0XHQvKlxuICAgICAgICAgICAgICAgIGlmKCB0eXBlb2YgZG9jdW1lbnQgIT0gXCJ1bmRlZmluZWRcIiApe1xuICAgICAgICAgICAgICAgICAgICBpZiggdmFsdWUgJiAweDIwICkgZG9jdW1lbnQuYm9keS5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcImJsYWNrXCI7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgZG9jdW1lbnQuYm9keS5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIndoaXRlXCI7XG4gICAgICAgICAgICAgICAgfWVsc2UgaWYoIHR5cGVvZiBXb3JrZXJHbG9iYWxTY29wZSA9PSBcInVuZGVmaW5lZFwiICl7XG4gICAgICAgICAgICAgICAgICAgIGlmKCB2YWx1ZSAmIDB4MjAgKSBjb25zb2xlLmxvZyggXCJMRUQgT04gI1wiLCAodGhpcy5jb3JlLnBjPDwxKS50b1N0cmluZygxNikgKTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBjb25zb2xlLmxvZyggXCJMRUQgT0ZGICNcIiwgKHRoaXMuY29yZS5wYzw8MSkudG9TdHJpbmcoMTYpICk7XG4gICAgICAgICAgICAgICAgfVxuXHRcdCovXG5cbiAgICAgICAgICAgICAgICB0aGlzLmNvcmUucGlucy5QT1JUQiA9IHZhbHVlO1xuXG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJ3b3JrZXJAXCIgKyB0aGlzLmNvcmUucGMudG9TdHJpbmcoMTYpICsgXCJbdGljayBcIiArICh0aGlzLmNvcmUudGljayAvIHRoaXMuY29yZS5jbG9jayAqIDEwMDApLnRvRml4ZWQoMykgKyBcIl1cIiwgXCIgUE9SVEIgPSBcIiwgdmFsdWUudG9TdHJpbmcoMikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZWFkOntcbiAgICAgICAgICAgIFsweDAzICsgMHgyMF06ZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gKHRoaXMuUElOQiAmIDB4RkYpIHwgMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5pdDpmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5QSU5CID0gMDtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLmNvcmUucGlucywgXCJQSU5CXCIsIHtcbiAgICAgICAgICAgICAgICBzZXQ6KCB2ICk9PnRoaXMuUElOQiA9ICh2Pj4+MCkmMHhGRixcbiAgICAgICAgICAgICAgICBnZXQ6KCk9PnRoaXMuUElOQlxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgUE9SVEM6e1xuICAgICAgICB3cml0ZTp7XG4gICAgICAgICAgICBbMHgwNyArIDB4MjBdOmZ1bmN0aW9uKCB2YWx1ZSApe1xuICAgICAgICAgICAgICAgIHRoaXMuY29yZS5waW5zLkREUkMgPSB2YWx1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBbMHgwOCArIDB4MjBdOmZ1bmN0aW9uKCB2YWx1ZSApe1xuICAgICAgICAgICAgICAgIHRoaXMuY29yZS5waW5zLlBPUlRDID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlYWQ6e1xuICAgICAgICAgICAgWzB4MDYgKyAweDIwXTpmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNvcmUucGlucy5QSU5DID0gKHRoaXMuY29yZS5waW5zLlBJTkMgJiAweEZGKSB8fCAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIFBPUlREOntcbiAgICAgICAgd3JpdGU6e1xuICAgICAgICAgICAgWzB4MEEgKyAweDIwXTpmdW5jdGlvbiggdmFsdWUgKXtcbiAgICAgICAgICAgICAgICB0aGlzLmNvcmUucGlucy5ERFJEID0gdmFsdWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgWzB4MEIgKyAweDIwXTpmdW5jdGlvbiggdmFsdWUgKXtcbiAgICAgICAgICAgICAgICB0aGlzLmNvcmUucGlucy5QT1JURCA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZWFkOntcbiAgICAgICAgICAgIFsweDA5ICsgMHgyMF06ZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jb3JlLnBpbnMuUElORCA9ICh0aGlzLmNvcmUucGlucy5QSU5EICYgMHhGRikgfHwgMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBUQzpyZXF1aXJlKCcuL0F0MzI4UC1UQy5qcycpLFxuXG4gICAgVVNBUlQ6cmVxdWlyZSgnLi9BdDMyOFAtVVNBUlQuanMnKVxuXG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgaW5pdDpmdW5jdGlvbigpe1xuXHR0aGlzLlNQRFIgPSAwO1xuXHR0aGlzLlNQSUYgPSAwO1xuXHR0aGlzLldDT0wgPSAwO1xuXHR0aGlzLlNQSTJYID0gMDtcblx0dGhpcy5TUElFID0gMDtcblx0dGhpcy5TUEUgPSAwO1xuXHR0aGlzLkRPUkQgPSAwO1xuXHR0aGlzLk1TVFIgPSAwO1xuXHR0aGlzLkNQT0wgPSAwO1xuXHR0aGlzLkNQSEEgPSAwO1xuXHR0aGlzLlNQUjEgPSAwO1xuXHR0aGlzLlNQUjAgPSAwO1xuXHR0aGlzLmNvcmUucGlucy5zcGlPdXQgPSB0aGlzLmNvcmUucGlucy5zcGlPdXQgfHwgW107XG4gICAgfSxcbiAgICBcbiAgICB3cml0ZTp7XG5cdDB4NEM6ZnVuY3Rpb24oIHZhbHVlLCBvbGRWYWx1ZSApe1xuXHQgICAgdGhpcy5TUElFID0gdmFsdWUgPj4gNztcblx0ICAgIHRoaXMuU1BFICA9IHZhbHVlID4+IDY7XG5cdCAgICB0aGlzLkRPUkQgPSB2YWx1ZSA+PiA1O1xuXHQgICAgdGhpcy5NU1RSID0gdmFsdWUgPj4gNDtcblx0ICAgIHRoaXMuQ1BPTCA9IHZhbHVlID4+IDM7XG5cdCAgICB0aGlzLkNQSEEgPSB2YWx1ZSA+PiAyO1xuXHQgICAgdGhpcy5TUFIxID0gdmFsdWUgPj4gMTtcblx0ICAgIHRoaXMuU1BSMCA9IHZhbHVlID4+IDA7XG5cdH0sXG5cdFxuXHQweDREOmZ1bmN0aW9uKCB2YWx1ZSwgb2xkVmFsdWUgKXtcblx0ICAgIHRoaXMuU1BJMlggPSB2YWx1ZSAmIDE7XG5cdCAgICByZXR1cm4gKHRoaXMuU1BJRiA8PCA3KSB8ICh0aGlzLldDT0wgPDwgNikgfCB0aGlzLlNQSTJYO1xuXHR9LFxuXHQweDRFOmZ1bmN0aW9uKCB2YWx1ZSApe1xuXHQgICAgdGhpcy5TUERSID0gdmFsdWU7XG5cdCAgICB0aGlzLmNvcmUucGlucy5zcGlPdXQucHVzaCggdmFsdWUgKTtcblx0ICAgIHRoaXMuU1BJRiA9IDE7XG5cdH1cbiAgICB9LFxuICAgIFxuICAgIHJlYWQ6e1xuXHQweDREOmZ1bmN0aW9uKCl7XG5cdCAgICB0aGlzLlNQSUYgPSAoISF0aGlzLmNvcmUucGlucy5zcGlJbi5sZW5ndGgpIHwgMDtcblx0ICAgIHJldHVybiAodGhpcy5TUElGIDw8IDcpIHwgKHRoaXMuV0NPTCA8PCA2KSB8IHRoaXMuU1BJMlg7XG5cdH0sXG5cdDB4NEU6ZnVuY3Rpb24oKXtcblx0ICAgIGxldCBzcGlJbiA9IHRoaXMuY29yZS5waW5zLnNwaUluO1xuXHQgICAgaWYoIHNwaUluLmxlbmd0aCApXG5cdFx0cmV0dXJuIHRoaXMuU1BEUiA9IHNwaUluLnNoaWZ0KCk7XHQgXG5cdCAgICByZXR1cm4gdGhpcy5TUERSO1xuXHR9XG4gICAgfSxcbiAgICBcbiAgICB1cGRhdGU6ZnVuY3Rpb24oIHRpY2ssIGllICl7XG5cdFxuXHRpZiggdGhpcy5TUElGICYmIHRoaXMuU1BJRSAmJiBpZSApe1xuXHQgICAgdGhpcy5TUElGID0gMDtcblx0ICAgIHJldHVybiBcIlNQSVwiO1xuXHR9XG5cdCAgICBcbiAgICB9XG59O1xuIiwiXG5mdW5jdGlvbiBwb3J0KCBvYmogKXtcbiAgICBcbiAgICBsZXQgb3V0ID0geyB3cml0ZTp7fSwgcmVhZDp7fSwgaW5pdDpudWxsIH07XG5cbiAgICBmb3IoIGxldCBrIGluIG9iaiApe1xuXHRcblx0bGV0IGFkZHIgPSBvYmpba107XG5cdGlmKCAvRERSLnxQT1JULi8udGVzdChrKSApe1xuXHQgICAgXG5cdCAgICBvdXQud3JpdGVbIGFkZHIgXSA9IHNldHRlcihrKTtcblx0ICAgIFxuXHR9ZWxzZXtcblxuXHQgICAgb3V0LnJlYWRbIGFkZHIgXSA9IGdldHRlcihrKTtcblx0ICAgIG91dC5pbml0ID0gaW5pdChrKTtcblx0ICAgIFxuXHR9XG5cdFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldHRlciggayApe1xuXHRyZXR1cm4gZnVuY3Rpb24oIHZhbHVlLCBvbGRWYWx1ZSApe1xuXHQgICAgaWYoIHZhbHVlICE9IG9sZFZhbHVlIClcblx0XHR0aGlzLmNvcmUucGluc1trXSA9IHZhbHVlO1x0ICAgIFxuXHR9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldHRlciggayApe1xuXHRyZXR1cm4gZnVuY3Rpb24oKXtcblx0ICAgIHJldHVybiAodGhpc1trXSAmIDB4RkYpIHwgMDtcblx0fTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0KCBrICl7XG5cdHJldHVybiBmdW5jdGlvbigpe1xuXHQgICAgdGhpc1trXSA9IDA7XG5cdCAgICBsZXQgX3RoaXMgPSB0aGlzO1xuXHQgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KCB0aGlzLmNvcmUucGlucywgaywge1xuXHRcdHNldDpmdW5jdGlvbih2KXsgcmV0dXJuIF90aGlzW2tdID0gKHY+Pj4wKSAmIDB4RkYgfSxcblx0XHRnZXQ6ZnVuY3Rpb24oICl7IHJldHVybiBfdGhpc1trXSB9XG5cdCAgICB9KTtcblx0fVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gb3V0O1xuICAgIFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIFBPUlRCOnBvcnQoeyBQSU5COjB4MjMsIEREUkI6MHgyNCwgUE9SVEI6MHgyNSB9KSxcbiAgICBQT1JUQzpwb3J0KHsgUElOQzoweDI2LCBERFJDOjB4MjcsIFBPUlRDOjB4MjggfSksXG4gICAgUE9SVEQ6cG9ydCh7IFBJTkQ6MHgyOSwgRERSRDoweDJBLCBQT1JURDoweDJCIH0pLFxuICAgIFBPUlRFOnBvcnQoeyBQSU5FOjB4MkMsIEREUkU6MHgyRCwgUE9SVEU6MHgyRSB9KSxcbiAgICBQT1JURjpwb3J0KHsgUElORjoweDJGLCBERFJGOjB4MzAsIFBPUlRGOjB4MzEgfSksXG5cbiAgICBUQzpyZXF1aXJlKCcuL0F0MzI4UC1UQy5qcycpLFxuXG4gICAgVVNBUlQ6cmVxdWlyZSgnLi9BdDMyOFAtVVNBUlQuanMnKSxcblxuICAgIFBMTDp7XG5cdHJlYWQ6e1xuXHQgICAgMHg0OTpmdW5jdGlvbiggdmFsdWUgKXtcblx0XHRyZXR1cm4gKHRoaXMuUElORElWIDw8IDQpIHwgKHRoaXMuUExMRSA8PCAxKSB8IHRoaXMuUExPQ0s7XG5cdCAgICB9XG5cdH0sXG5cdHdyaXRlOntcblx0ICAgIDB4NDk6ZnVuY3Rpb24oIHZhbHVlLCBvbGRWYWx1ZSApe1xuXHRcdGlmKCB2YWx1ZSA9PT0gb2xkVmFsdWUgKSByZXR1cm47XG5cdFx0dGhpcy5QSU5ESVYgPSAodmFsdWUgPj4gNCkgJiAxO1xuXHRcdHRoaXMuUExMRSAgID0gKHZhbHVlID4+IDEpICYgMTtcblx0XHR0aGlzLlBMT0NLICA9IDE7XG5cdCAgICB9XG5cdH0sXG5cdGluaXQ6ZnVuY3Rpb24oKXtcblx0ICAgIHRoaXMuUElORElWID0gMDtcblx0ICAgIHRoaXMuUExMRSA9IDA7XG5cdCAgICB0aGlzLlBMT0NLID0gMDtcblx0fVxuICAgIH0sXG5cbiAgICBTUEk6cmVxdWlyZSgnLi9BdDMydTQtU1BJLmpzJyksXG5cbiAgICBFRVBST006e1xuXHR3cml0ZTp7XG5cdCAgICAweDNGOmZ1bmN0aW9uKCB2YWx1ZSwgb2xkVmFsdWUgKXtcblx0XHR2YWx1ZSAmPSB+Mjtcblx0XHRyZXR1cm4gdmFsdWU7XG5cdCAgICB9XG5cdH0sXG5cdHJlYWQ6e30sXG5cdGluaXQ6ZnVuY3Rpb24oKXtcblx0ICAgIFxuXHR9XG4gICAgfSxcblxuICAgIEFEQ1NSQTp7XG5cdFxuXHR3cml0ZTp7XG5cdCAgICAweDdBOmZ1bmN0aW9uKHZhbHVlLCBvbGRWYWx1ZSl7XG5cdFx0dGhpcy5BREVOID0gdmFsdWU+PjcgJiAxO1xuXHRcdHRoaXMuQURTQyA9IHZhbHVlPj42ICYgMTtcblx0XHR0aGlzLkFEQVRFID0gdmFsdWU+PjUgJiAxO1xuXHRcdHRoaXMuQURJRiA9IHZhbHVlPj40ICYgMTtcblx0XHR0aGlzLkFESUUgPSB2YWx1ZT4+MyAmIDE7XG5cdFx0dGhpcy5BRFBTMiA9IHZhbHVlPj4yICYgMTtcblx0XHR0aGlzLkFEUFMxID0gdmFsdWU+PjEgJiAxO1xuXHRcdHRoaXMuQURQUzAgPSB2YWx1ZSAmIDE7XG5cdFx0aWYoIHRoaXMuQURFTiApe1xuXHRcdCAgICBpZiggdGhpcy5BRFNDICl7XG5cdFx0XHR0aGlzLkFEQ0ggPSAoTWF0aC5yYW5kb20oKSAqIDB4RkYpID4+PiAwO1xuXHRcdFx0dGhpcy5BRENMID0gKE1hdGgucmFuZG9tKCkgKiAweEZGKSA+Pj4gMDtcblx0XHRcdHRoaXMuQURTQyA9IDA7XG5cdFx0XHR2YWx1ZSAmPSB+KDE8PDYpO1xuXHRcdCAgICB9XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0ICAgIH1cblx0fSxcblxuXHRyZWFkOntcblx0ICAgIDB4Nzk6ZnVuY3Rpb24oKXtcblx0XHRyZXR1cm4gdGhpcy5BRENIO1xuXHQgICAgfSxcblx0ICAgIDB4Nzg6ZnVuY3Rpb24oKXtcblx0XHRyZXR1cm4gdGhpcy5BRENMO1xuXHQgICAgfVxuXHR9LFxuXHRcdFxuXHRpbml0OmZ1bmN0aW9uKCl7XG5cdCAgICB0aGlzLkFERU4gPSAwO1xuXHQgICAgdGhpcy5BRFNDID0gMDtcblx0ICAgIHRoaXMuQURBVEUgPSAwO1xuXHQgICAgdGhpcy5BRElGID0gMDtcblx0ICAgIHRoaXMuQURJRSA9IDA7XG5cdCAgICB0aGlzLkFEUFMyID0gMDtcblx0ICAgIHRoaXMuQURQUzEgPSAwO1xuXHQgICAgdGhpcy5BRFBTMCA9IDA7XG5cdH0sXG5cblx0dXBkYXRlOmZ1bmN0aW9uKCB0aWNrLCBpZSApe1xuXHQgICAgaWYoIHRoaXMuQURFTiAmJiB0aGlzLkFESUUgKXtcblx0XHR0aGlzLkFESUYgPSAxO1xuXHRcdHRoaXMuQURTQyA9IDA7XG5cdFx0dGhpcy5BRENIID0gKE1hdGgucmFuZG9tKCkgKiAweEZGKSA+Pj4gMDtcblx0XHR0aGlzLkFEQ0wgPSAoTWF0aC5yYW5kb20oKSAqIDB4RkYpID4+PiAwO1xuXHQgICAgfVxuXG5cdCAgICBpZiggdGhpcy5BRElGICYmIHRoaXMuQURJRSAmJiBpZSApe1xuXHRcdHRoaXMuQURJRiA9IDA7XG5cdFx0cmV0dXJuIFwiQURDXCI7XG5cdCAgICB9XG5cdH1cblx0XG4gICAgfVxuXG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8vIGh0dHA6Ly93d3cuYXRtZWwuY29tL3dlYmRvYy9hdnJhc3NlbWJsZXIvYXZyYXNzZW1ibGVyLndiX2luc3RydWN0aW9uX2xpc3QuaHRtbFxuXG5mdW5jdGlvbiBiaW4oIGJ5dGVzLCBzaXplICl7XG5cbiAgICB2YXIgcyA9IChieXRlcz4+PjApLnRvU3RyaW5nKDIpO1xuICAgIHdoaWxlKCBzLmxlbmd0aCA8IHNpemUgKSBzID0gXCIwXCIrcztcbiAgICByZXR1cm4gcy5yZXBsYWNlKC8oWzAxXXs0LDR9KS9nLCBcIiQxIFwiKSArIFwiICAjXCIgKyAoYnl0ZXM+Pj4wKS50b1N0cmluZygxNikudG9VcHBlckNhc2UoKTtcbiAgICBcbn1cblxuaWYoIHR5cGVvZiBwZXJmb3JtYW5jZSA9PT0gXCJ1bmRlZmluZWRcIiApe1xuICAgIGlmKCBEYXRlLm5vdyApIGdsb2JhbC5wZXJmb3JtYW5jZSA9IHsgbm93OigpPT5EYXRlLm5vdygpIH07XG4gICAgZWxzZSBnbG9iYWwucGVyZm9ybWFuY2UgPSB7IG5vdzooKT0+KG5ldyBEYXRlKCkpLmdldFRpbWUoKSB9O1xufVxuXG5jbGFzcyBBdGNvcmUge1xuXG4gICAgY29uc3RydWN0b3IoIGRlc2MgKXtcblxuICAgICAgICBpZiggIWRlc2MgKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG5cdHRoaXMuc2xlZXBpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5zcmVnID0gMDtcbiAgICAgICAgdGhpcy5wYyA9IDA7XG4gICAgICAgIHRoaXMuc3AgPSAwO1xuICAgICAgICB0aGlzLmNsb2NrID0gZGVzYy5jbG9jaztcbiAgICAgICAgdGhpcy5jb2RlYyA9IGRlc2MuY29kZWM7XG4gICAgICAgIHRoaXMuaW50ZXJydXB0TWFwID0gZGVzYy5pbnRlcnJ1cHQ7XG4gICAgICAgIHRoaXMuZXJyb3IgPSAwO1xuICAgICAgICB0aGlzLmZsYWdzID0gZGVzYy5mbGFncztcbiAgICAgICAgdGhpcy50aWNrID0gMDtcbiAgICAgICAgdGhpcy5zdGFydFRpY2sgPSAwO1xuICAgICAgICB0aGlzLmVuZFRpY2sgPSAwO1xuICAgICAgICB0aGlzLmV4ZWNUaW1lID0gMDtcbiAgICAgICAgdGhpcy50aW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cblx0dGhpcy5pOGEgPSBuZXcgSW50OEFycmF5KDQpO1xuXG4gICAgICAgIHNlbGYuQlJFQUtQT0lOVFMgPSB7IDA6MCB9O1xuICAgICAgICBzZWxmLkRVTVAgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICAnUEM6ICMnKyh0aGlzLnBjPDwxKS50b1N0cmluZygxNikrXG4gICAgICAgICAgICAgICAgJ1xcblNSOiAnICsgdGhpcy5tZW1vcnlbMHg1Rl0udG9TdHJpbmcoMikrXG4gICAgICAgICAgICAgICAgJ1xcblNQOiAjJyArIHRoaXMuc3AudG9TdHJpbmcoMTYpICtcbiAgICAgICAgICAgICAgICAnXFxuJyArIFxuICAgICAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbCggdGhpcy5yZWcsIFxuICAgICAgICAgICAgICAgICAgICAodixpKSA9PiAnUicrKGkrJycpKycgJysoaTwxMD8nICc6JycpKyc9XFx0Iycrdi50b1N0cmluZygxNikgKyAnXFx0JyArIHYgXG4gICAgICAgICAgICAgICAgKS5qb2luKCdcXG4nKSBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLypcbiAgICAgICAgVGhlIEkvTyBtZW1vcnkgc3BhY2UgY29udGFpbnMgNjQgYWRkcmVzc2VzIGZvciBDUFUgcGVyaXBoZXJhbCBmdW5jdGlvbnMgYXMgY29udHJvbCByZWdpc3RlcnMsIFNQSSwgYW5kIG90aGVyIEkvTyBmdW5jdGlvbnMuXG4gICAgICAgIFRoZSBJL08gbWVtb3J5IGNhbiBiZSBhY2Nlc3NlZCBkaXJlY3RseSwgb3IgYXMgdGhlIGRhdGEgc3BhY2UgbG9jYXRpb25zIGZvbGxvd2luZyB0aG9zZSBvZiB0aGUgcmVnaXN0ZXIgZmlsZSwgMHgyMCAtIDB4NUYuIEluXG4gICAgICAgIGFkZGl0aW9uLCB0aGUgQVRtZWdhMzI4UCBoYXMgZXh0ZW5kZWQgSS9PIHNwYWNlIGZyb20gMHg2MCAtIDB4RkYgaW4gU1JBTSB3aGVyZSBvbmx5IHRoZSBTVC9TVFMvU1REIGFuZFxuICAgICAgICBMRC9MRFMvTEREIGluc3RydWN0aW9ucyBjYW4gYmUgdXNlZC4gICAgICAgIFxuICAgICAgICAqL1xuICAgICAgICB0aGlzLm1lbW9yeSA9IG5ldyBVaW50OEFycmF5KCBcbiAgICAgICAgICAgIDMyIC8vIHJlZ2lzdGVyIGZpbGVcbiAgICAgICAgICAgICsgKDB4RkYgLSAweDFGKSAvLyBpb1xuICAgICAgICAgICAgKyBkZXNjLnNyYW1cbiAgICAgICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLmZsYXNoID0gbmV3IFVpbnQ4QXJyYXkoIGRlc2MuZmxhc2ggKTtcbiAgICAgICAgdGhpcy5lZXByb20gPSBuZXcgVWludDhBcnJheSggZGVzYy5lZXByb20gKTtcblxuICAgICAgICB0aGlzLmluaXRNYXBwaW5nKCk7XG4gICAgICAgIHRoaXMuaW5zdHJ1Y3Rpb24gPSBudWxsO1xuICAgICAgICB0aGlzLnBlcmlmZXJhbHMgPSB7fTtcbiAgICAgICAgdGhpcy5waW5zID0ge307XG5cbiAgICAgICAgZm9yKCB2YXIgcGVyaWZlcmFsTmFtZSBpbiBkZXNjLnBlcmlmZXJhbHMgKXtcblxuICAgICAgICAgICAgbGV0IGFkZHIsIHBlcmlmZXJhbCA9IGRlc2MucGVyaWZlcmFsc1sgcGVyaWZlcmFsTmFtZSBdO1xuICAgICAgICAgICAgbGV0IG9iaiA9IHRoaXMucGVyaWZlcmFsc1sgcGVyaWZlcmFsTmFtZSBdID0geyBjb3JlOnRoaXMgfTtcblxuICAgICAgICAgICAgZm9yKCBhZGRyIGluIHBlcmlmZXJhbC53cml0ZSApXG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZU1hcFsgYWRkciBdID0gcGVyaWZlcmFsLndyaXRlWyBhZGRyIF0uYmluZCggb2JqICk7XG5cbiAgICAgICAgICAgIGZvciggYWRkciBpbiBwZXJpZmVyYWwucmVhZCApXG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkTWFwWyBhZGRyIF0gPSBwZXJpZmVyYWwucmVhZFsgYWRkciBdLmJpbmQoIG9iaiApO1xuXG4gICAgICAgICAgICBpZiggcGVyaWZlcmFsLnVwZGF0ZSApXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVMaXN0LnB1c2goIHBlcmlmZXJhbC51cGRhdGUuYmluZCggb2JqICkgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYoIHBlcmlmZXJhbC5pbml0IClcbiAgICAgICAgICAgICAgICBwZXJpZmVyYWwuaW5pdC5jYWxsKCBvYmogKTtcblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBpbml0TWFwcGluZygpe1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyggdGhpcywge1xuICAgICAgICAgICAgd3JpdGVNYXA6eyB2YWx1ZTp7fSwgZW51bWVyYWJsZTpmYWxzZSwgd3JpdGFibGU6ZmFsc2UgfSxcbiAgICAgICAgICAgIHJlYWRNYXA6eyB2YWx1ZTp7fSwgZW51bWVyYWJsZTpmYWxzZSwgd3JpdGFibGU6ZmFsc2UgfSxcbiAgICAgICAgICAgIHVwZGF0ZUxpc3Q6eyB2YWx1ZTpbXSwgZW51bWVyYWJsZTpmYWxzZSwgd3JpdGFibGU6ZmFsc2UgfSxcbiAgICAgICAgICAgIHJlZzp7IHZhbHVlOiBuZXcgVWludDhBcnJheSggdGhpcy5tZW1vcnkuYnVmZmVyLCAwLCAweDIwICksIGVudW1lcmFibGU6ZmFsc2UgfSxcbiAgICAgICAgICAgIHdyZWc6eyB2YWx1ZTogbmV3IFVpbnQxNkFycmF5KCB0aGlzLm1lbW9yeS5idWZmZXIsIDB4MjAtOCwgNCApLCBlbnVtZXJhYmxlOiBmYWxzZSB9LFxuICAgICAgICAgICAgc3JhbTp7IHZhbHVlOiBuZXcgVWludDhBcnJheSggdGhpcy5tZW1vcnkuYnVmZmVyLCAweDEwMCApLCBlbnVtZXJhYmxlOmZhbHNlIH0sXG4gICAgICAgICAgICBpbzp7IHZhbHVlOiBuZXcgVWludDhBcnJheSggdGhpcy5tZW1vcnkuYnVmZmVyLCAweDIwLCAweEZGIC0gMHgyMCApLCBlbnVtZXJhYmxlOmZhbHNlIH0sXG4gICAgICAgICAgICBwcm9nOnsgdmFsdWU6IG5ldyBVaW50MTZBcnJheSggdGhpcy5mbGFzaC5idWZmZXIgKSwgZW51bWVyYWJsZTpmYWxzZSB9LFxuICAgICAgICAgICAgbmF0aXZlOnsgdmFsdWU6e30sIGVudW1lcmFibGU6ZmFsc2UgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmNvZGVjLmZvckVhY2goIG9wID0+e1xuICAgICAgICAgICAgaWYoIG9wLnN0ciApIHBhcnNlKCBvcCApO1xuICAgICAgICAgICAgb3AuYXJndiA9IE9iamVjdC5hc3NpZ24oe30sIG9wLmFyZ3MpIFxuICAgICAgICAgICAgb3AuYnl0ZXMgPSBvcC5ieXRlcyB8fCAyO1xuICAgICAgICAgICAgb3AuY3ljbGVzID0gb3AuY3ljbGVzIHx8IDE7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJlYWQoIGFkZHIsIHBjICl7XG4gICAgICAgIHZhciB2YWx1ZSA9IHRoaXMubWVtb3J5WyBhZGRyIF07XG5cbiAgICAgICAgdmFyIHBlcmlmZXJhbCA9IHRoaXMucmVhZE1hcFsgYWRkciBdO1xuICAgICAgICBpZiggcGVyaWZlcmFsICl7XG4gICAgICAgICAgICB2YXIgcmV0ID0gcGVyaWZlcmFsKCB2YWx1ZSApO1xuICAgICAgICAgICAgaWYoIHJldCAhPT0gdW5kZWZpbmVkICkgdmFsdWUgPSByZXQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiggISh7XG4gICAgICAgIC8vICAgICAweDVkOjEsIC8vIFN0YWNrIFBvaW50ZXIgTG93XG4gICAgICAgIC8vICAgICAweDVlOjEsIC8vIFN0YWNrIFBvaW50ZXIgSGlnaFxuICAgICAgICAvLyAgICAgMHg1ZjoxLCAvLyBzdGF0dXMgcmVnaXN0ZXJcbiAgICAgICAgLy8gICAgIDB4MjU6MSwgLy8gUE9SVEJcbiAgICAgICAgLy8gICAgIDB4MzU6MSwgLy8gVE9WMFxuICAgICAgICAvLyAgICAgMHgyMzoxLCAgLy8gUElOQlxuICAgICAgICAvLyAgICAgMHgxNEI6MSAvLyB2ZXJib3NlIFVTQVJUIHN0dWZmXG4gICAgICAgIC8vIH0pW2FkZHJdIClcbiAgICAgICAgLy8gY29uc29sZS5sb2coIFwiUkVBRDogI1wiLCBhZGRyLnRvU3RyaW5nKDE2KSApO1xuXG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICByZWFkQml0KCBhZGRyLCBiaXQsIHBjICl7XG5cbiAgICAgICAgLy8gaWYoICEoe1xuICAgICAgICAvLyAgICAgMHg1ZDoxLCAvLyBTdGFjayBQb2ludGVyIExvd1xuICAgICAgICAvLyAgICAgMHg1ZToxLCAvLyBTdGFjayBQb2ludGVyIEhpZ2hcbiAgICAgICAgLy8gICAgIDB4NWY6MSwgLy8gc3RhdHVzIHJlZ2lzdGVyXG4gICAgICAgIC8vICAgICAweDI1OjEsIC8vIFBPUlRCXG4gICAgICAgIC8vICAgICAweDM1OjEsIC8vIFRPVjBcbiAgICAgICAgLy8gICAgIDB4MjM6MSAgLy8gUElOQlxuICAgICAgICAvLyB9KVthZGRyXSApXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCBcIlBDPVwiICsgKHBjPDwxKS50b1N0cmluZygxNikgKyBcIiBSRUFEICNcIiArIChhZGRyICE9PSB1bmRlZmluZWQgPyBhZGRyLnRvU3RyaW5nKDE2KSA6ICd1bmRlZmluZWQnKSArIFwiIEAgXCIgKyBiaXQgKTtcblxuICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLm1lbW9yeVsgYWRkciBdO1xuXG4gICAgICAgIHZhciBwZXJpZmVyYWwgPSB0aGlzLnJlYWRNYXBbIGFkZHIgXTtcbiAgICAgICAgaWYoIHBlcmlmZXJhbCApe1xuICAgICAgICAgICAgdmFyIHJldCA9IHBlcmlmZXJhbCggdmFsdWUgKTtcbiAgICAgICAgICAgIGlmKCByZXQgIT09IHVuZGVmaW5lZCApIHZhbHVlID0gcmV0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICh2YWx1ZSA+Pj4gYml0KSAmIDE7XG4gICAgfVxuXG4gICAgd3JpdGUoIGFkZHIsIHZhbHVlICl7XG5cbiAgICAgICAgdmFyIHBlcmlmZXJhbCA9IHRoaXMud3JpdGVNYXBbIGFkZHIgXTtcblxuICAgICAgICBpZiggcGVyaWZlcmFsICl7XG4gICAgICAgICAgICB2YXIgcmV0ID0gcGVyaWZlcmFsKCB2YWx1ZSwgdGhpcy5tZW1vcnlbIGFkZHIgXSApO1xuICAgICAgICAgICAgaWYoIHJldCA9PT0gZmFsc2UgKSByZXR1cm47XG4gICAgICAgICAgICBpZiggcmV0ICE9PSB1bmRlZmluZWQgKSB2YWx1ZSA9IHJldDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLm1lbW9yeVsgYWRkciBdID0gdmFsdWU7XG4gICAgfVxuXG4gICAgd3JpdGVCaXQoIGFkZHIsIGJpdCwgYnZhbHVlICl7XG5cdGJ2YWx1ZSA9ICghIWJ2YWx1ZSkgfCAwO1xuXHR2YXIgdmFsdWUgPSB0aGlzLm1lbW9yeVsgYWRkciBdO1xuXHR2YWx1ZSA9ICh2YWx1ZSAmIH4oMTw8Yml0KSkgfCAoYnZhbHVlPDxiaXQpO1xuXHRcbiAgICAgICAgdmFyIHBlcmlmZXJhbCA9IHRoaXMud3JpdGVNYXBbIGFkZHIgXTtcblxuICAgICAgICBpZiggcGVyaWZlcmFsICl7XG4gICAgICAgICAgICB2YXIgcmV0ID0gcGVyaWZlcmFsKCB2YWx1ZSwgdGhpcy5tZW1vcnlbIGFkZHIgXSApO1xuICAgICAgICAgICAgaWYoIHJldCA9PT0gZmFsc2UgKSByZXR1cm47XG4gICAgICAgICAgICBpZiggcmV0ICE9PSB1bmRlZmluZWQgKSB2YWx1ZSA9IHJldDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLm1lbW9yeVsgYWRkciBdID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZXhlYyggdGltZSApe1xuICAgICAgICB2YXIgY3ljbGVzID0gKHRpbWUgKiB0aGlzLmNsb2NrKXwwO1xuICAgICAgICBcbiAgICAgICAgdmFyIHN0YXJ0ID0gdGhpcy50aWNrO1xuICAgICAgICB0aGlzLmVuZFRpY2sgPSB0aGlzLnN0YXJ0VGljayArIGN5Y2xlcztcbiAgICAgICAgdGhpcy5leGVjVGltZSA9IHRpbWU7XG5cdHZhciBsYXN0VXBkYXRlID0gc3RhcnQ7XG5cbiAgICAgICAgdHJ5e1xuXG5cdCAgICB3aGlsZSggdGhpcy50aWNrIDwgdGhpcy5lbmRUaWNrICl7XG5cdFx0aWYoICF0aGlzLnNsZWVwaW5nICl7XG5cblx0XHQgICAgaWYoIHRoaXMucGMgPiAweEZGRkYgKSBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICB2YXIgZnVuYyA9IHRoaXMubmF0aXZlWyB0aGlzLnBjIF07XG5cdFx0ICAgIC8vIGlmKCAhZnVuYyApIFx0XHQgICAgY29uc29sZS5sb2coIHRoaXMucGMgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYoIGZ1bmMgKSBmdW5jLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYoICF0aGlzLmdldEJsb2NrKCkgKVxuXHRcdFx0YnJlYWs7XG5cdFx0fWVsc2V7XG5cdFx0ICAgIHRoaXMudGljayArPSAxMDA7XG5cdFx0fVxuXHRcdFxuXHRcdGlmKCB0aGlzLnRpY2sgPj0gdGhpcy5lbmRUaWNrIHx8IHRoaXMudGljayAtIGxhc3RVcGRhdGUgPiAxMDAwICl7XG5cdFx0ICAgIGxhc3RVcGRhdGUgPSB0aGlzLnRpY2s7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlUGVyaWZlcmFscygpO1xuXHRcdH1cblxuXHQgICAgfVxuXG5cdFx0XG4gICAgICAgIH1maW5hbGx5e1xuXG5cdCAgICB0aGlzLnN0YXJ0VGljayA9IHRoaXMuZW5kVGljaztcblxuXHR9XG5cbiAgICB9XG5cbiAgICB1cGRhdGVQZXJpZmVyYWxzKCl7XG5cbiAgICAgICAgdmFyIGludGVycnVwdHNFbmFibGVkID0gdGhpcy5tZW1vcnlbMHg1Rl0gJiAoMTw8Nyk7XG5cbiAgICAgICAgdmFyIHVwZGF0ZUxpc3QgPSB0aGlzLnVwZGF0ZUxpc3Q7XG5cbiAgICAgICAgZm9yKCB2YXIgaT0wLCBsPXVwZGF0ZUxpc3QubGVuZ3RoOyBpPGw7ICsraSApe1xuXG4gICAgICAgICAgICB2YXIgcmV0ID0gdXBkYXRlTGlzdFtpXSggdGhpcy50aWNrLCBpbnRlcnJ1cHRzRW5hYmxlZCApO1xuXG4gICAgICAgICAgICBpZiggcmV0ICYmIGludGVycnVwdHNFbmFibGVkICl7XG4gICAgICAgICAgICAgICAgaW50ZXJydXB0c0VuYWJsZWQgPSAwO1xuXHRcdHRoaXMuc2xlZXBpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLmludGVycnVwdCggcmV0ICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgdXBkYXRlKCl7XG4gICAgICAgIHZhciBub3cgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdmFyIGRlbHRhID0gbm93IC0gdGhpcy50aW1lO1xuXG4gICAgICAgIGRlbHRhID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCAzMywgZGVsdGEgKSApO1xuXG4gICAgICAgIHRoaXMuZXhlYyggZGVsdGEvMTAwMCApO1xuXG4gICAgICAgIHRoaXMudGltZSA9IG5vdztcbiAgICB9XG5cbiAgICBnZXRCbG9jaygpe1xuXG5cbiAgICAgICAgdmFyIHN0YXJ0UEMgPSB0aGlzLnBjO1xuXG4gICAgICAgIHZhciBza2lwID0gZmFsc2UsIHByZXYgPSBmYWxzZTtcbiAgICAgICAgdmFyIG5vcCA9IHtuYW1lOidOT1AnLCBjeWNsZXM6MSwgZW5kOnRydWUsIGFyZ3Y6e319O1xuICAgICAgICB2YXIgY2FjaGVMaXN0ID0gWydyZWcnLCAnd3JlZycsICdpbycsICdtZW1vcnknLCAnc3JhbScsICdmbGFzaCddXG4gICAgICAgIHZhciBjb2RlID0gJ1widXNlIHN0cmljdFwiO1xcbnZhciBzcD10aGlzLnNwLCByLCB0MSwgaThhPXRoaXMuaThhLCBTS0lQPWZhbHNlLCAnO1xuICAgICAgICBjb2RlICs9IGNhY2hlTGlzdC5tYXAoYz0+IGAke2N9ID0gdGhpcy4ke2N9YCkuam9pbignLCAnKTtcbiAgICAgICAgY29kZSArPSAnO1xcbic7XG4gICAgICAgIGNvZGUgKz0gJ3ZhciBzciA9IG1lbW9yeVsweDVGXSc7XG4gICAgICAgIGZvciggdmFyIGk9MDsgaTw4OyArK2kgKVxuICAgICAgICAgICAgY29kZSArPSBgLCBzciR7aX0gPSAoc3I+PiR7aX0pJjFgO1xuICAgICAgICBjb2RlICs9ICc7XFxuJztcblxuICAgICAgICAvLyBjb2RlICs9IFwiY29uc29sZS5sb2coJ1xcXFxuRU5URVIgQkxPQ0s6IFwiICsgKHRoaXMucGM8PDEpLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpICsgXCIgQCAnLCAodGhpcy5wYzw8MSkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkgKTtcXG5cIjtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ0NSRUFURSBCTE9DSzogJywgKHRoaXMucGM8PDEpLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpICk7XG4gICAgICAgIGNvZGUgKz0gJ3N3aXRjaCggdGhpcy5wYyApe1xcbic7XG5cblx0bGV0IGFkZHJzID0gW107XG5cbiAgICAgICAgZG97XG5cdCAgICBcbiAgICAgICAgICAgIHZhciBpbnN0ID0gdGhpcy5pZGVudGlmeSgpO1xuICAgICAgICAgICAgaWYoICFpbnN0ICl7XG4gICAgICAgICAgICAgICAgLy8gaW5zdCA9IG5vcDtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oIHRoaXMuZXJyb3IgKTtcbiAgICAgICAgICAgICAgICAoZnVuY3Rpb24oKXtkZWJ1Z2dlcjt9KSgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuXHQgICAgYWRkcnMucHVzaCggdGhpcy5wYyApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb2RlICs9IGBcXG5jYXNlICR7dGhpcy5wY306IC8vICNgICsgKHRoaXMucGM8PDEpLnRvU3RyaW5nKDE2KSArIFwiOiBcIiArIGluc3QubmFtZSArICcgWycgKyBpbnN0LmRlY2J5dGVzLnRvU3RyaW5nKDIpLnBhZFN0YXJ0KDE2LCBcIjBcIikgKyAnXScgKyAnXFxuJztcblxuXG4gICAgICAgICAgICB2YXIgY2h1bmsgPSBgXG4gICAgICAgICAgICAgICAgdGhpcy5wYyA9ICR7dGhpcy5wY307XG4gICAgICAgICAgICAgICAgaWYoICh0aGlzLnRpY2sgKz0gJHtpbnN0LmN5Y2xlc30pID49IHRoaXMuZW5kVGljayApIGJyZWFrO1xuICAgICAgICAgICAgICAgIGA7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEJSRUFLUE9JTlRTXG4gICAgICAgICAgICBpZiggKHNlbGYuQlJFQUtQT0lOVFMgJiYgc2VsZi5CUkVBS1BPSU5UU1sgdGhpcy5wYzw8MSBdKSB8fCBpbnN0LmRlYnVnICl7XG4gICAgICAgICAgICAgICAgY2h1bmsgKz0gXCJjb25zb2xlLmxvZygnUEM6ICMnKyh0aGlzLnBjPDwxKS50b1N0cmluZygxNikrJ1xcXFxuU1I6ICcgKyBtZW1vcnlbMHg1Rl0udG9TdHJpbmcoMikgKyAnXFxcXG5TUDogIycgKyBzcC50b1N0cmluZygxNikgKyAnXFxcXG4nICsgQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKCByZWcsICh2LGkpID0+ICdSJysoaSsnJykrJyAnKyhpPDEwPycgJzonJykrJz1cXFxcdCMnK3YudG9TdHJpbmcoMTYpICsgJ1xcXFx0JyArIHYgKS5qb2luKCdcXFxcbicpICk7XFxuXCI7XG4gICAgICAgICAgICAgICAgY2h1bmsgKz0gJyAgZGVidWdnZXI7XFxuJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIG9wID0gdGhpcy5nZXRPcGNvZGVJbXBsKCBpbnN0LCBpbnN0LmltcGwgKTtcbiAgICAgICAgICAgIHZhciBzckRpcnR5ID0gb3Auc3JEaXJ0eTtcbiAgICAgICAgICAgIHZhciBsaW5lID0gb3AuYmVnaW4sIGVuZGxpbmUgPSBvcC5lbmQ7XG4gICAgICAgICAgICBpZiggaW5zdC5mbGFncyApe1xuICAgICAgICAgICAgICAgIGZvciggdmFyIGk9MCwgbD1pbnN0LmZsYWdzLmxlbmd0aDsgaTxsOyArK2kgKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZsYWdPcCA9IHRoaXMuZ2V0T3Bjb2RlSW1wbCggaW5zdCwgdGhpcy5mbGFnc1tpbnN0LmZsYWdzW2ldXSApO1xuICAgICAgICAgICAgICAgICAgICBsaW5lICs9IGZsYWdPcC5iZWdpbjtcbiAgICAgICAgICAgICAgICAgICAgZW5kbGluZSArPSBmbGFnT3AuZW5kO1xuICAgICAgICAgICAgICAgICAgICBzckRpcnR5IHw9IGZsYWdPcC5zckRpcnR5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoIHNyRGlydHkgKXtcbiAgICAgICAgICAgICAgICB2YXIgcHJlcyA9ICgofnNyRGlydHkpPj4+MCYweEZGKS50b1N0cmluZygyKTtcbiAgICAgICAgICAgICAgICBlbmRsaW5lICs9IGBzciA9IChzciYwYiR7cHJlc30pIGA7XG4gICAgICAgICAgICAgICAgZm9yKCB2YXIgaT0wOyBpPDg7IGkrKyApXG4gICAgICAgICAgICAgICAgICAgIGlmKCBzckRpcnR5JigxPDxpKSApXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmRsaW5lICs9IGAgfCAoc3Ike2l9PDwke2l9KWA7XG4gICAgICAgICAgICAgICAgZW5kbGluZSArPSAnO1xcbm1lbW9yeVsweDVGXSA9IHNyO1xcbic7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNodW5rICs9IGxpbmUgKyBlbmRsaW5lO1xuXG4gICAgICAgICAgICBpZiggc2tpcCApXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgaWYoICFTS0lQICl7XFxuICAgIFwiICsgY2h1bmsgKyBcIlxcbiAgfVxcblNLSVAgPSBmYWxzZTtcXG5cIjtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rO1xuXG4gICAgICAgICAgICBwcmV2ID0gc2tpcDtcbiAgICAgICAgICAgIHNraXAgPSBpbnN0LnNraXA7XG5cbiAgICAgICAgICAgIHRoaXMucGMgKz0gaW5zdC5ieXRlcyA+PiAxO1xuXG4gICAgICAgIH13aGlsZSggdGhpcy5wYyA8IHRoaXMucHJvZy5sZW5ndGggJiYgKCFpbnN0LmVuZCB8fCBza2lwIHx8IHByZXYpIClcblxuICAgICAgICBjb2RlICs9IGBcXG50aGlzLnBjID0gJHt0aGlzLnBjfTtcXG5gO1xuXHRjb2RlICs9IGBicmVhaztcXG5kZWZhdWx0OiB0aGlzLnRpY2sgKz0gMjsgY29uc29sZS53YXJuKCdmZWxsIHRocm91Z2ggIycgKyAodGhpcy5wYysrPDwxKS50b1N0cmluZygxNikpO1xcbmA7XG4gICAgICAgIGNvZGUgKz0gYFxcblxcbn1gO1xuICAgICAgICAvLyBjb2RlICs9IGNhY2hlTGlzdC5tYXAoYz0+YHRoaXMuJHtjfSA9ICR7Y307YCkuam9pbignXFxuJyk7XG4gICAgICAgIGNvZGUgKz0gJ3RoaXMuc3AgPSBzcDtcXG4nO1xuXG4gICAgICAgIHZhciBlbmRQQyA9IHRoaXMucGM7XG4gICAgICAgIHRoaXMucGMgPSBzdGFydFBDO1xuXG4gICAgICAgIGNvZGUgPSBcInJldHVybiAoZnVuY3Rpb24gX1wiICsgKHN0YXJ0UEM8PDEpLnRvU3RyaW5nKDE2KSArIFwiKCl7XFxuXCJcbiAgICAgICAgICAgICArIGNvZGVcbiAgICAgICAgICAgICArIFwifSk7XCI7XG5cbiAgICAgICAgdHJ5e1xuICAgICAgICAgICAgdmFyIGZ1bmMgPSAobmV3IEZ1bmN0aW9uKCBjb2RlICkpKCk7XG5cbiAgICAgICAgICAgIGZvciggdmFyIGk9MDsgaTxhZGRycy5sZW5ndGg7ICsraSApXG4gICAgICAgICAgICAgICAgdGhpcy5uYXRpdmVbIGFkZHJzW2ldIF0gPSBmdW5jO1xuXG4gICAgICAgICAgICBmdW5jLmNhbGwoIHRoaXMgKTtcbiAgICAgICAgfWNhdGNoKGV4KXtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc2V0VGltZW91dCgoKT0+e1xuICAgICAgICAgICAgICAgIGRlYnVnZ2VyO1xuICAgICAgICAgICAgICAgIHZhciBmdW5jID0gbmV3IEZ1bmN0aW9uKCBjb2RlICk7XG4gICAgICAgICAgICAgICAgZnVuYy5jYWxsKCB0aGlzICk7XG4gICAgICAgICAgICB9LCAxKTtcbiAgICAgICAgICAgIHRocm93IGV4O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICB9XG5cbiAgICBpZGVudGlmeSgpe1xuXG4gICAgICAgIC8vIGlmKCB0aGlzLnBjPDwxID09IDB4OTY2ICkgZGVidWdnZXI7XG5cbiAgICAgICAgbGV0IHByb2cgPSB0aGlzLnByb2csIFxuICAgICAgICAgICAgY29kZWMgPSB0aGlzLmNvZGVjLCBcbiAgICAgICAgICAgIGJ5dGVzLFxuICAgICAgICAgICAgaCxcbiAgICAgICAgICAgIGosXG4gICAgICAgICAgICBpPTAsIFxuICAgICAgICAgICAgbCA9IGNvZGVjLmxlbmd0aCxcbiAgICAgICAgICAgIHBjID0gdGhpcy5wYztcblxuICAgICAgICBsZXQgYnl0ZXMyLCBieXRlczQ7XG4gICAgICAgIGJ5dGVzMiA9IHByb2dbcGNdID4+PiAwO1xuICAgICAgICBieXRlczQgPSAoKGJ5dGVzMiA8PCAxNikgfCAocHJvZ1twYysxXSkpID4+PiAwO1xuXG4gICAgICAgIGxldCB2ZXJib3NlID0gMTtcblxuICAgICAgICBmb3IoIDsgaTxsOyArK2kgKXtcblxuICAgICAgICAgICAgdmFyIGRlc2MgPSBjb2RlY1tpXTtcbiAgICAgICAgICAgIHZhciBvcGNvZGUgPSBkZXNjLm9wY29kZT4+PjA7XG4gICAgICAgICAgICB2YXIgbWFzayA9IGRlc2MubWFzaz4+PjA7XG4gICAgICAgICAgICB2YXIgc2l6ZSA9IGRlc2MuYnl0ZXM7XG5cbiAgICAgICAgICAgIGlmKCBzaXplID09PSA0ICl7XG5cbiAgICAgICAgICAgICAgICBpZiggdmVyYm9zZT09MiB8fCB2ZXJib3NlID09IGRlc2MubmFtZSApXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCBkZXNjLm5hbWUgKyBcIlxcblwiICsgYmluKGJ5dGVzNCAmIG1hc2ssIDgqNCkgKyBcIlxcblwiICsgYmluKG9wY29kZSwgOCo0KSApO1xuXG4gICAgICAgICAgICAgICAgaWYoIChieXRlczQgJiBtYXNrKT4+PjAgIT09IG9wY29kZSApXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGJ5dGVzID0gYnl0ZXM0O1xuXG4gICAgICAgICAgICB9ZWxzZXtcblxuXG4gICAgICAgICAgICAgICAgaWYoIHZlcmJvc2U9PTIgfHwgdmVyYm9zZSA9PSBkZXNjLm5hbWUgKVxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyggZGVzYy5uYW1lICsgXCJcXG5cIiArIGJpbihieXRlczIgJiBtYXNrLCA4KjIpICsgXCJcXG5cIiArIGJpbihvcGNvZGUsIDgqMikgKTtcblxuICAgICAgICAgICAgICAgIGlmKCAoYnl0ZXMyICYgbWFzayk+Pj4wICE9PSBvcGNvZGUgKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBieXRlcyA9IGJ5dGVzMjtcblxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIHRoaXMuaW5zdHJ1Y3Rpb24gPSBkZXNjO1xuXG4gICAgICAgICAgICAvLyB2YXIgbG9nID0gZGVzYy5uYW1lICsgXCIgXCI7XG5cbiAgICAgICAgICAgIGZvciggdmFyIGsgaW4gZGVzYy5hcmdzICl7XG4gICAgICAgICAgICAgICAgbWFzayA9IGRlc2MuYXJnc1trXTtcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSAwO1xuICAgICAgICAgICAgICAgIGggPSAwO1xuICAgICAgICAgICAgICAgIGogPSAwO1xuICAgICAgICAgICAgICAgIHdoaWxlKCBtYXNrICl7XG4gICAgICAgICAgICAgICAgICAgIGlmKCBtYXNrJjEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlIHw9ICgoYnl0ZXM+PmgpJjEpIDw8IGo7XG4gICAgICAgICAgICAgICAgICAgICAgICBqKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbWFzayA9IG1hc2sgPj4+IDE7XG4gICAgICAgICAgICAgICAgICAgIGgrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVzYy5hcmd2W2tdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gbG9nICs9IGsgKyBcIjpcIiArIHZhbHVlICsgXCIgIFwiXG4gICAgICAgICAgICB9XG5cdCAgICBkZXNjLmRlY2J5dGVzID0gYnl0ZXM7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhsb2cpO1xuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbnN0cnVjdGlvbjtcblxuICAgICAgICB9XG5cblxuICAgICAgICB0aGlzLmVycm9yID0gXCIjXCIgKyAodGhpcy5wYzw8MSkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkgKyBgIG9wY29kZTogYCArIGJpbihieXRlczIsIDE2KTtcblxuICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgIH1cblxuICAgIGdldCBzdGF0dXNJKCl7IHJldHVybiB0aGlzLnNyZWcgJiAoMTw8Nyk7IH1cbiAgICBnZXQgc3RhdHVzVCgpeyByZXR1cm4gdGhpcy5zcmVnICYgKDE8PDYpOyB9XG4gICAgZ2V0IHN0YXR1c0goKXsgcmV0dXJuIHRoaXMuc3JlZyAmICgxPDw1KTsgfVxuICAgIGdldCBzdGF0dXNTKCl7IHJldHVybiB0aGlzLnNyZWcgJiAoMTw8NCk7IH1cbiAgICBnZXQgc3RhdHVzVigpeyByZXR1cm4gdGhpcy5zcmVnICYgKDE8PDMpOyB9XG4gICAgZ2V0IHN0YXR1c04oKXsgcmV0dXJuIHRoaXMuc3JlZyAmICgxPDwyKTsgfVxuICAgIGdldCBzdGF0dXNaKCl7IHJldHVybiB0aGlzLnNyZWcgJiAoMTw8MSk7IH1cbiAgICBnZXQgc3RhdHVzQygpeyByZXR1cm4gdGhpcy5zcmVnICYgKDE8PDApOyB9XG5cblxuICAgIGludGVycnVwdCggc291cmNlICl7XG5cbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJJTlRFUlJVUFQgXCIgKyBzb3VyY2UpO1xuXG4gICAgICAgIGxldCBhZGRyID0gdGhpcy5pbnRlcnJ1cHRNYXBbc291cmNlXTtcbiAgICAgICAgdmFyIHBjID0gdGhpcy5wYztcbiAgICAgICAgdGhpcy5tZW1vcnlbdGhpcy5zcC0tXSA9IHBjPj44O1xuICAgICAgICB0aGlzLm1lbW9yeVt0aGlzLnNwLS1dID0gcGM7XG4gICAgICAgIHRoaXMubWVtb3J5WzB4NUZdICY9IH4oMTw8Nyk7IC8vIGRpc2FibGUgaW50ZXJydXB0c1xuICAgICAgICB0aGlzLnBjID0gYWRkcjtcblxuICAgIH1cblxuICAgIGdldE9wY29kZUltcGwoIGluc3QsIHN0ciApe1xuICAgICAgICB2YXIgaSwgbCwgb3AgPSB7YmVnaW46XCJcIiwgZW5kOlwiXCIsIHNyRGlydHk6MH07XG5cbiAgICAgICAgaWYoIEFycmF5LmlzQXJyYXkoc3RyKSApe1xuICAgICAgICAgICAgZm9yKCBpID0gMCwgbD1zdHIubGVuZ3RoOyBpPGw7ICsraSApe1xuICAgICAgICAgICAgICAgIHZhciB0bXAgPSB0aGlzLmdldE9wY29kZUltcGwoIGluc3QsIHN0cltpXSApO1xuICAgICAgICAgICAgICAgIG9wLmJlZ2luICs9IHRtcC5iZWdpbiArIFwiXFxuXCI7XG4gICAgICAgICAgICAgICAgb3AuZW5kICs9IHRtcC5lbmQgKyBcIlxcblwiO1xuICAgICAgICAgICAgICAgIG9wLnNyRGlydHkgfD0gdG1wLnNyRGlydHk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb3A7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3JjID0gc3RyLCBhcmd2ID0gaW5zdC5hcmd2O1xuXG4gICAgICAgIGZvciggdmFyIGsgaW4gYXJndiApXG4gICAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoay50b0xvd2VyQ2FzZSgpKS5qb2luKGFyZ3Zba10pO1xuXG4gICAgICAgIHZhciBTUlN5bmMgPSBcIlwiLCBTUkRpcnR5ID0gMDtcblxuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvU1JAKFswLTldKylcXHMq4oaQXFxzKjE7P1xccyokL2csIChtLCBiaXQsIGFzc2lnbik9PntcbiAgICAgICAgICAgIFNSRGlydHkgfD0gMSA8PCBiaXQ7XG4gICAgICAgICAgICByZXR1cm4gYHNyJHtiaXR9ID0gMTtcXG5gO1xuICAgICAgICB9KTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1NSQChbMC05XSspXFxzKuKGkFxccyowOz9cXHMqJC9nLCAobSwgYml0LCBhc3NpZ24pPT57XG4gICAgICAgICAgICBTUkRpcnR5IHw9IDEgPDwgYml0O1xuICAgICAgICAgICAgcmV0dXJuIGBzciR7Yml0fSA9IDA7XFxuYDtcbiAgICAgICAgfSk7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9TUihbMC05XSspXFxzKj0oLiopL2csIChtLCBiaXQsIGFzc2lnbik9PntcbiAgICAgICAgICAgIFNSRGlydHkgfD0gMSA8PCBiaXQ7XG4gICAgICAgICAgICByZXR1cm4gYHNyJHtiaXR9ID0gJHthc3NpZ259O1xcbmA7XG4gICAgICAgIH0pO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvU1JcXHMq4oaQL2csICgpID0+IHtcbiAgICAgICAgICAgIFNSU3luYyA9ICdtZW1vcnlbMHg1Rl0gPSBzcjsgc3IwPXNyJjE7IHNyMT0oc3I+PjEpJjE7IHNyMj0oc3I+PjIpJjE7IHNyMz0oc3I+PjMpJjE7IHNyND0oc3I+PjQpJjE7IHNyNT0oc3I+PjUpJjE7IHNyNj0oc3I+PjYpJjE7IHNyNz0oc3I+PjcpJjE7JztcbiAgICAgICAgICAgIHJldHVybiAnc3IgPSc7XG4gICAgICAgIH0pO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvU1JAKFswLTldKylcXHMq4oaQKC4qKSQvZywgKG0sIGJpdCwgYXNzaWduKT0+e1xuICAgICAgICAgICAgU1JEaXJ0eSB8PSAxIDw8IGJpdDtcbiAgICAgICAgICAgIHJldHVybiBgc3Ike2JpdH0gPSAoISEoJHthc3NpZ259KSl8MDtgO1xuICAgICAgICB9KTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1NSXFxzKsKvL2csICcofnNyKScpO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvU1JAKFswLTldKylcXHMqwq8vZywgJyh+c3IkMSkgJyk7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9TUkAoWzAtOV0rKVxccyovZywgJyhzciQxKSAnKTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1NSL2csICdzcicpO1xuXG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9XUihbMC05XSspXFxzKuKGkC9nLCAnciA9IHdyZWdbJDFdID0nKTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1dSKFswLTldKylAKFswLTldKylcXHMq4oaQKC4qKSQvZywgKG0sIG51bSwgYml0LCBhc3NpZ24pPT5gciA9IHdyZWdbJHtudW19XSA9ICh3cmVnWyR7bnVtfV0gJiB+KDE8PCR7Yml0fSkpIHwgKCgoISEoJHthc3NpZ259KSl8MCk8PCR7Yml0fSk7YCk7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9XUihbMC05XSspXFxzKsKvL2csICcofndyZWdbJDFdKSAnKTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1dSKFswLTldKylAKFswLTldKylcXHMqwq8vZywgJyh+KHdyZWdbJDFdPj4+JDIpJjEpICcpO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvV1IoWzAtOV0rKUAoWzAtOV0rKVxccyovZywgJygod3JlZ1skMV0+Pj4kMikmMSkgJyk7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9XUihbMC05XSspL2csICd3cmVnWyQxXScpO1xuXG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9SKFswLTk8XSspKFxcK1swLTldKyk/XFxzKuKGkC9nLCAobSwgbnVtLCBudW1hZGQpID0+eyBcbiAgICAgICAgICAgIG51bWFkZCA9IG51bWFkZCB8fCBcIlwiO1xuICAgICAgICAgICAgb3AuZW5kICs9IGByZWdbKCR7bnVtfSkke251bWFkZH1dID0gcjtcXG5gOyBcbiAgICAgICAgICAgIHJldHVybiAnciA9ICc7IFxuICAgICAgICB9KTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1IoWzAtOTxdKykoXFwrWzAtOV0rKT9AKFswLTldKylcXHMq4oaQKC4qKSQvZywgKG0sIG51bSwgbnVtYWRkLCBiaXQsIGFzc2lnbik9PntcbiAgICAgICAgICAgIG51bWFkZCA9IG51bWFkZCB8fCBcIlwiO1xuICAgICAgICAgICAgb3AuZW5kICs9IGByZWdbKCR7bnVtfSkke251bWFkZH1dID0gcjtcXG5gXG4gICAgICAgICAgICByZXR1cm4gYHIgPSAocmVnWygke251bX0pJHtudW1hZGR9XSAmIH4oMTw8JHtiaXR9KSkgfCAoKCghISgke2Fzc2lnbn0pKXwwKTw8JHtiaXR9KTtgO1xuICAgICAgICB9KTtcblxuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvUihbMC05PF0rKShcXCtbMC05XSspP1xccyo9XFxzKy9nLCAobSwgbnVtLCBudW1hZGQpID0+eyBcbiAgICAgICAgICAgIG51bWFkZCA9IG51bWFkZCB8fCBcIlwiO1xuICAgICAgICAgICAgcmV0dXJuIGByID0gcmVnWygke251bX0pJHtudW1hZGR9XSA9IGA7IFxuICAgICAgICB9KTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1IoWzAtOTxdKykoXFwrWzAtOV0rKT9AKFswLTldKylcXHMqPVxccysoLiopJC9nLCAobSwgbnVtLCBudW1hZGQsIGJpdCwgYXNzaWduKT0+e1xuICAgICAgICAgICAgbnVtYWRkID0gbnVtYWRkIHx8IFwiXCI7XG4gICAgICAgICAgICByZXR1cm4gYHIgPSByZWdbKCR7bnVtfSkke251bWFkZH1dID0gKHJlZ1soJHtudW19KSR7bnVtYWRkfV0gJiB+KDE8PCR7Yml0fSkpIHwgKCgoISEoJHthc3NpZ259KSl8MCk8PCR7Yml0fSk7YDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1IoWzAtOTxdKykoXFwrWzAtOV0rKT9cXHMqwq8vZywgJyh+cmVnWygkMSkkMl0pICcpO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvUihbMC05PF0rKShcXCtbMC05XSspP0AoWzAtOV0rKVxccyrCry9nLCAnKH4ocmVnWygkMSkkMl0+Pj4kMykmMSkgJyk7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9SKFswLTk8XSspKFxcK1swLTldKyk/QChbMC05XSspXFxzKi9nLCAnKChyZWdbKCQxKSQyXT4+PiQzKSYxKSAnKTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1IoWzAtOTxdKykoXFwrWzAtOV0rKT8vZywgJyhyZWdbKCQxKSQyXT4+PjApJyk7XG5cbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1JAKFswLTldKylcXHMqwq8vZywgJyh+KHI+Pj4kMSkmMSkgJyk7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9SQChbMC05XSspXFxzKi9nLCAnKChyPj4+JDEpJjEpICcpO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvSVxcL08vZywgJ2lvJyk7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9SL2csICdyJyk7XG5cbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL0ZMQVNIXFwoKFtYWVpdKVxcKVxccyrihpAoLiopOz8kL2csIChtLCBuLCB2KSA9PiAnZmxhc2hbIHdyZWdbJyArIChuLmNoYXJDb2RlQXQoMCktODcpICsgJ10gXSA9ICcgKyB2ICsgJzsnKTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL0ZMQVNIXFwoKFtYWVpdKVxcKS9nLCAobSwgbikgPT4gJ2ZsYXNoWyB3cmVnWycgKyAobi5jaGFyQ29kZUF0KDApLTg3KSArICddIF0nKTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1xcKChbWFlaXSkoXFwrWzAtOV0rKT9cXClcXHMq4oaQKC4qKTs/JC9nLCAobSwgbiwgb2ZmLCB2KSA9PiAndGhpcy53cml0ZSggd3JlZ1snICsgKG4uY2hhckNvZGVBdCgwKS04NykgKyAnXScgKyAob2ZmfHwnJykgKyAnLCAnICsgdiArICcpOycpO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvXFwoKFtYWVpdKShcXCtbMC05XSspP1xcKS9nLCAobSwgbiwgb2ZmKSA9PiAndGhpcy5yZWFkKCB3cmVnWycgKyAobi5jaGFyQ29kZUF0KDApLTg3KSArICddJyArIChvZmZ8fCcnKSArICcsIHRoaXMucGMgKScpO1xuXG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9cXChTVEFDS1xcKVxccyrihpAvZywgKG0sIG4pID0+ICdtZW1vcnlbc3AtLV0gPScpO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvXFwoKFNUQUNLKVxcKS9nLCAobSwgbikgPT4gJ21lbW9yeVsrK3NwXScpO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvXFwoU1RBQ0syXFwpXFxzKuKGkCguKikvZywgJ3QxID0gJDE7XFxubWVtb3J5W3NwLS1dID0gdDE+Pjg7XFxubWVtb3J5W3NwLS1dID0gdDE7XFxuJyk7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9cXCgoU1RBQ0syKVxcKS9nLCAnKG1lbW9yeVsrK3NwXSArIChtZW1vcnlbKytzcF08PDgpKScpO1xuXG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC/iipUvZywgJ14nKTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL+KAoi9nLCAnJicpO1xuXG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9pb1xcWyhbMC05XSspXFxdXFxzKuKGkCguKj8pOz8kL2csICd0aGlzLndyaXRlKCAzMiskMSwgJDIgKScpO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvaW9cXFsoWzAtOV0rKUAoWzAtOV0rKVxcXVxccyrihpAoLio/KTs/JC9nLCAndGhpcy53cml0ZUJpdCggMzIrJDEsICQyLCAkMyApJyk7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9pb1xcWyhbMC05KzxdKylAKFswLTldKylcXF0vZywgJ3RoaXMucmVhZEJpdCggMzIrJDEsICQyLCB0aGlzLnBjICknKTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL2lvXFxbKFswLTkrPF0rKVxcXS9nLCAndGhpcy5yZWFkKCAzMiskMSwgdGhpcy5wYyApJyk7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9TUC9nLCAnc3AnKTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL1BDXFxzKuKGkCguKikkL2csICd0MSA9ICQxO1xcbmlmKCAhdDEgKSAoZnVuY3Rpb24oKXtkZWJ1Z2dlcjt9KSgpOyB0aGlzLnBjID0gdDE7IGJyZWFrO1xcbicpO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZSgvUEMvZywgJ3RoaXMucGMnKTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UoL+KGkC9nLCAnPScpO1xuXG5cbiAgICAgICAgc3RyID0gJy8vICcgKyBzcmMucmVwbGFjZSgvW1xcblxccl0rXFxzKi9nLCAnXFxuXFx0Ly8gJykgKyBcIlxcblwiICsgc3RyICsgXCJcXG5cIjtcbiAgICAgICAgXG4gICAgICAgIG9wLnNyRGlydHkgPSBTUkRpcnR5O1xuXG4gICAgICAgIG9wLmJlZ2luID0gc3RyO1xuICAgICAgICBvcC5lbmQgKz0gU1JTeW5jO1xuXG4gICAgICAgIHJldHVybiBvcDtcbiAgICB9XG5cbiAgICBzdGF0aWMgQVRtZWdhMzI4UCgpe1xuXG4gICAgICAgIGxldCBjb3JlID0gbmV3IEF0Y29yZSh7XG4gICAgICAgICAgICBmbGFzaDogMzIgKiAxMDI0LFxuICAgICAgICAgICAgZWVwcm9tOiAxICogMTAyNCxcbiAgICAgICAgICAgIHNyYW06IDIgKiAxMDI0LFxuICAgICAgICAgICAgY29kZWM6IEF0Q09ERUMsXG4gICAgICAgICAgICBmbGFnczogQXRGbGFncyxcbiAgICAgICAgICAgIGNsb2NrOiAxNiAqIDEwMDAgKiAxMDAwLCAvLyBzcGVlZCBpbiBrSHpcbiAgICAgICAgICAgIHBlcmlmZXJhbHM6cmVxdWlyZSgnLi9BdDMyOFAtcGVyaWZlcmFscy5qcycpLFxuICAgICAgICAgICAgaW50ZXJydXB0OntcbiAgICAgICAgICAgICAgICBSRVNFVDogMHgwMDAwLCAgLy8gIEV4dGVybmFsIHBpbiwgcG93ZXItb24gcmVzZXQsIGJyb3duLW91dCByZXNldCBhbmQgd2F0Y2hkb2cgc3lzdGVtIHJlc2V0XG4gICAgICAgICAgICAgICAgSU5UMDogMHgwMDIgLCAgLy8gIEV4dGVybmFsIGludGVycnVwdCByZXF1ZXN0IDBcbiAgICAgICAgICAgICAgICBJTlQxOiAweDAwMDQsICAvLyAgRXh0ZXJuYWwgaW50ZXJydXB0IHJlcXVlc3QgMVxuICAgICAgICAgICAgICAgIFBDSU5UMDogMHgwMDA2LCAgLy8gIFBpbiBjaGFuZ2UgaW50ZXJydXB0IHJlcXVlc3QgMFxuICAgICAgICAgICAgICAgIFBDSU5UMTogMHgwMDA4LCAgLy8gIFBpbiBjaGFuZ2UgaW50ZXJydXB0IHJlcXVlc3QgMVxuICAgICAgICAgICAgICAgIFBDSU5UMjogMHgwMDBBLCAgLy8gIFBpbiBjaGFuZ2UgaW50ZXJydXB0IHJlcXVlc3QgMlxuICAgICAgICAgICAgICAgIFdEVDogMHgwMDBDLCAgLy8gIFdhdGNoZG9nIHRpbWUtb3V0IGludGVycnVwdFxuICAgICAgICAgICAgICAgIFRJTUVSMkE6IDB4MDAwRSwgIC8vICBDT01QQSBUaW1lci9Db3VudGVyMiBjb21wYXJlIG1hdGNoIEFcbiAgICAgICAgICAgICAgICBUSU1FUjJCOiAweDAwMTAsICAvLyAgQ09NUEIgVGltZXIvQ291bnRlcjIgY29tcGFyZSBtYXRjaCBCXG4gICAgICAgICAgICAgICAgVElNRVIyTzogMHgwMDEyLCAgLy8gIE9WRiBUaW1lci9Db3VudGVyMiBvdmVyZmxvd1xuICAgICAgICAgICAgICAgIFRJTUVSMUM6IDB4MDAxNCwgIC8vICBDQVBUIFRpbWVyL0NvdW50ZXIxIGNhcHR1cmUgZXZlbnRcbiAgICAgICAgICAgICAgICBUSU1FUjFBOiAweDAwMTYsICAvLyAgQ09NUEEgVGltZXIvQ291bnRlcjEgY29tcGFyZSBtYXRjaCBBXG4gICAgICAgICAgICAgICAgVElNRVIxQjogMHgwMDE4LCAgLy8gIENPTVBCIFRpbWVyL0NvdW50ZXIxIGNvbXBhcmUgbWF0Y2ggQlxuICAgICAgICAgICAgICAgIFRJTUVSMU86IDB4MDAxQSwgIC8vICBPVkYgVGltZXIvQ291bnRlcjEgb3ZlcmZsb3dcbiAgICAgICAgICAgICAgICBUSU1FUjBBOiAweDAwMUMsICAvLyAgQ09NUEEgVGltZXIvQ291bnRlcjAgY29tcGFyZSBtYXRjaCBBXG4gICAgICAgICAgICAgICAgVElNRVIwQjogMHgwMDFFLCAgLy8gIENPTVBCIFRpbWVyL0NvdW50ZXIwIGNvbXBhcmUgbWF0Y2ggQlxuICAgICAgICAgICAgICAgIFRJTUVSME86IDB4MDAyMCwgIC8vICBPVkYgVGltZXIvQ291bnRlcjAgb3ZlcmZsb3dcbiAgICAgICAgICAgICAgICBTUEk6IDB4MDAyMiwgIC8vICwgU1RDIFNQSSBzZXJpYWwgdHJhbnNmZXIgY29tcGxldGVcbiAgICAgICAgICAgICAgICBVU0FSVFJYOiAweDAwMjQsICAvLyAsIFJYIFVTQVJUIFJ4IGNvbXBsZXRlXG4gICAgICAgICAgICAgICAgVVNBUlRFOiAweDAwMjYsICAvLyAsIFVEUkUgVVNBUlQsIGRhdGEgcmVnaXN0ZXIgZW1wdHlcbiAgICAgICAgICAgICAgICBVU0FSVFRYOiAweDAwMjgsICAvLyAsIFRYIFVTQVJULCBUeCBjb21wbGV0ZVxuICAgICAgICAgICAgICAgIEFEQzogMHgwMDJBLCAgLy8gIEFEQyBjb252ZXJzaW9uIGNvbXBsZXRlXG4gICAgICAgICAgICAgICAgRUVSRUFEWTogMHgwMDJDLCAgLy8gIFJFQURZIEVFUFJPTSByZWFkeVxuICAgICAgICAgICAgICAgIEFOQUxPRzogMHgwMDJFLCAgLy8gIENPTVAgQW5hbG9nIGNvbXBhcmF0b3JcbiAgICAgICAgICAgICAgICBUV0k6IDB4MDAzMCwgIC8vICAyLXdpcmUgc2VyaWFsIGludGVyZmFjZVxuICAgICAgICAgICAgICAgIFNQTTogMHgwMDMyICAvLyAgUkVBRFkgU3RvcmUgcHJvZ3JhbSBtZW1vcnkgcmVhZHkgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBjb3JlO1xuXG4gICAgfVxuXG4gICAgc3RhdGljIEFUbWVnYTMydTQoKXtcblxuXHRsZXQgY29yZSA9IG5ldyBBdGNvcmUoe1xuICAgICAgICAgICAgZmxhc2g6IDMyICogMTAyNCxcbiAgICAgICAgICAgIGVlcHJvbTogMSAqIDEwMjQsXG4gICAgICAgICAgICBzcmFtOiAyICogMTAyNCArIDUxMixcbiAgICAgICAgICAgIGNvZGVjOiBBdENPREVDLFxuICAgICAgICAgICAgZmxhZ3M6IEF0RmxhZ3MsXG4gICAgICAgICAgICBjbG9jazogMTYgKiAxMDAwICogMTAwMCwgLy8gc3BlZWQgaW4ga0h6XG4gICAgICAgICAgICBwZXJpZmVyYWxzOnJlcXVpcmUoJy4vQXQzMnU0LXBlcmlmZXJhbHMuanMnKSxcbiAgICAgICAgICAgIGludGVycnVwdDp7XG5cdFx0UkVTRVQ6IDB4MDAwMCwgIC8vICBFeHRlcm5hbCBwaW4sIHBvd2VyLW9uIHJlc2V0LCBicm93bi1vdXQgcmVzZXQgYW5kIHdhdGNoZG9nIHN5c3RlbSByZXNldFxuXHRcdElOVDA6IDB4MDAyICwgIC8vICBFeHRlcm5hbCBpbnRlcnJ1cHQgcmVxdWVzdCAwXG5cdFx0SU5UMTogMHgwMDA0LCAgLy8gIEV4dGVybmFsIGludGVycnVwdCByZXF1ZXN0IDFcblx0XHRJTlQyOiAweDAwMDYsICAvLyAgRXh0ZXJuYWwgaW50ZXJydXB0IHJlcXVlc3QgMlxuXHRcdElOVDM6IDB4MDAwOCwgIC8vICBFeHRlcm5hbCBpbnRlcnJ1cHQgcmVxdWVzdCAzXG5cdFx0UkVTRVJWRUQwOiAweDAwMEEsXG5cdFx0UkVTRVJWRUQxOiAweDAwMEMsXG5cdFx0SU5UNjogMHgwMDBFLCAgICAvLyAgRXh0ZXJuYWwgaW50ZXJydXB0IHJlcXVlc3QgNlxuXHRcdFBDSU5UMDogMHgwMDEyLCAgLy8gIFBpbiBjaGFuZ2UgaW50ZXJydXB0IHJlcXVlc3QgMFxuXHRcdFVTQkdFTjogMHgwMDE0LCAgLy8gVVNCIEdlbmVyYWwgSW50ZXJydXB0IHJlcXVlc3Rcblx0XHRVU0JFTkQ6IDB4MDAxNiwgIC8vIFVTQiBFbmRwb2ludCBJbnRlcnJ1cHQgcmVxdWVzdFxuXHRcdFdEVDogMHgwMDE4LCAgICAgLy8gIFdhdGNoZG9nIHRpbWUtb3V0IGludGVycnVwdFxuXHRcdFxuXHRcdFRJTUVSMUM6IDB4MDAyMCwgIC8vICBDQVBUIFRpbWVyL0NvdW50ZXIxIGNhcHR1cmUgZXZlbnRcblx0XHRUSU1FUjFBOiAweDAwMjIsICAvLyAgQ09NUEEgVGltZXIvQ291bnRlcjEgY29tcGFyZSBtYXRjaCBBXG5cdFx0VElNRVIxQjogMHgwMDI0LCAgLy8gIENPTVBCIFRpbWVyL0NvdW50ZXIxIGNvbXBhcmUgbWF0Y2ggQlxuXHRcdFRJTUVSMUM6IDB4MDAyNiwgIC8vICBDT01QQyBUaW1lci9Db3VudGVyMSBjb21wYXJlIG1hdGNoIENcblx0XHRUSU1FUjFPOiAweDAwMjgsICAvLyAgT1ZGIFRpbWVyL0NvdW50ZXIxIG92ZXJmbG93XG5cdFx0VElNRVIwQTogMHgwMDJBLCAgLy8gIENPTVBBIFRpbWVyL0NvdW50ZXIwIGNvbXBhcmUgbWF0Y2ggQVxuXHRcdFRJTUVSMEI6IDB4MDAyQywgIC8vICBDT01QQiBUaW1lci9Db3VudGVyMCBjb21wYXJlIG1hdGNoIEJcblx0XHRUSU1FUjBPOiAweDAwMkUsICAvLyAgT1ZGIFRpbWVyL0NvdW50ZXIwIG92ZXJmbG93XG5cdFx0XG5cdFx0U1BJOiAweDAwMzAsICAvLyAsIFNUQyBTUEkgc2VyaWFsIHRyYW5zZmVyIGNvbXBsZXRlXG5cdFx0XG5cdFx0VVNBUlRSWDogMHgwMDMyLCAgLy8gLCBSWCBVU0FSVCBSeCBjb21wbGV0ZVxuXHRcdFVTQVJURTogMHgwMDM0LCAgLy8gLCBVRFJFIFVTQVJULCBkYXRhIHJlZ2lzdGVyIGVtcHR5XG5cdFx0VVNBUlRUWDogMHgwMDM2LCAgLy8gLCBUWCBVU0FSVCwgVHggY29tcGxldGVcblxuXHRcdEFOQUxPRzogMHgwMDM4LCAvLyBBbmFsb2cgQ29tcGFyYXRvclxuXHRcdEFEQzogMHgwMDNBLCAgLy8gIEFEQyBjb252ZXJzaW9uIGNvbXBsZXRlXG5cdFx0XG5cdFx0RUVSRUFEWTogMHgwMDNDLCAgLy8gIEVFUFJPTSByZWFkeVxuXG5cdFx0VElNRVIzQzogMHgwMDNFLCAgLy8gIENBUFQgVGltZXIvQ291bnRlcjEgY2FwdHVyZSBldmVudFxuXHRcdFRJTUVSM0E6IDB4MDA0MCwgIC8vICBDT01QQSBUaW1lci9Db3VudGVyMSBjb21wYXJlIG1hdGNoIEFcblx0XHRUSU1FUjNCOiAweDAwNDIsICAvLyAgQ09NUEIgVGltZXIvQ291bnRlcjEgY29tcGFyZSBtYXRjaCBCXG5cdFx0VElNRVIzQzogMHgwMDQ0LCAgLy8gIENPTVBDIFRpbWVyL0NvdW50ZXIxIGNvbXBhcmUgbWF0Y2ggQ1xuXHRcdFRJTUVSM086IDB4MDA0NiwgIC8vICBPVkYgVGltZXIvQ291bnRlcjEgb3ZlcmZsb3dcblx0XHRcblx0XHRcblx0XHRUV0k6IDB4MDA0OCwgIC8vICAyLXdpcmUgc2VyaWFsIGludGVyZmFjZVxuXHRcdFxuXHRcdFNQTTogMHgwMDRBLCAgLy8gIFJFQURZIFN0b3JlIHByb2dyYW0gbWVtb3J5IHJlYWR5XG5cdFx0XG5cdFx0VElNRVI0QTogMHgwMDRDLFxuXHRcdFRJTUVSNEI6IDB4MDA0RSxcblx0XHRUSU1FUjREOiAweDAwNTAsXG5cdFx0VElNRVI0TzogMHgwMDUyLFxuXHRcdFRJTUVSNEZQRjogMHgwMDU0XG4gICAgICAgICAgICB9XG5cdH0pO1xuXG5cdHJldHVybiBjb3JlO1xuXG4gICAgfVxuXG59XG5cbmZ1bmN0aW9uIHBhcnNlKCBvdXQgKXtcbiAgICB2YXIgb3Bjb2RlID0gMDtcbiAgICB2YXIgbWFzayA9IDA7XG4gICAgdmFyIGFyZ3MgPSB7fTtcblxuICAgIHZhciBzdHIgPSBvdXQuc3RyLCBsPXN0ci5sZW5ndGg7XG4gICAgZm9yKCB2YXIgaT0wOyBpPGw7ICsraSApe1xuICAgICAgICB2YXIgY2hyID0gc3RyW2ldO1xuICAgICAgICB2YXIgYml0ID0gKGwtaS0xKT4+PjA7XG4gICAgICAgIGlmKCBjaHIgPT0gJzAnICl7XG4gICAgICAgICAgICBtYXNrIHw9IDE8PGJpdDtcbiAgICAgICAgfWVsc2UgaWYoIGNociA9PSAnMScgKXtcbiAgICAgICAgICAgIG1hc2sgfD0gMTw8Yml0O1xuICAgICAgICAgICAgb3Bjb2RlIHw9IDE8PGJpdDsgICAgICAgICAgICBcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICBpZiggIShjaHIgaW4gYXJncykgKVxuICAgICAgICAgICAgICAgIGFyZ3NbY2hyXSA9IDA7XG4gICAgICAgICAgICBhcmdzW2Nocl0gfD0gMTw8Yml0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb3V0Lm9wY29kZSA9IG9wY29kZTtcbiAgICBvdXQubWFzayA9IG1hc2s7XG4gICAgb3V0LmFyZ3MgPSBhcmdzO1xuICAgIG91dC5ieXRlcyA9IChsLzgpfDA7XG59XG5cbmNvbnN0IEF0Q09ERUMgPSBbXG4gICAge1xuICAgICAgICBuYW1lOiAnQURDJyxcbiAgICAgICAgc3RyOiAnMDAwMTExcmRkZGRkcnJycicsXG4gICAgICAgIGltcGw6ICdSZCDihpAgUmQgKyBSciArIFNSQDA7JyxcbiAgICAgICAgZmxhZ3M6J2h6dm5zYydcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0FERCcsXG4gICAgICAgIHN0cjogJzAwMDAxMXJkZGRkZHJycnInLFxuICAgICAgICBpbXBsOiAnUmQg4oaQIFJkICsgUnI7JyxcbiAgICAgICAgZmxhZ3M6J2h6dm5zYydcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ01VTCcsXG4gICAgICAgIHN0cjogJzEwMDExMXJkZGRkZHJycnInLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICAndDEgPSBSZCAqIFJyJyxcbiAgICAgICAgICAgICdSMCA9IHQxJyxcbiAgICAgICAgICAgICdSMSA9IHQxID4+IDgnLFxuICAgICAgICAgICAgJ1NSMSA9ICF0MXwwJyxcbiAgICAgICAgICAgICdTUjAgPSAodDE+PjE1KSYxJ1xuICAgICAgICBdLFxuICAgICAgICBmbGFnczonaHZuc2MnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdBRElXJyxcbiAgICAgICAgc3RyOiAnMTAwMTAxMTBLS2RkS0tLSycsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdXUmQg4oaQIFdSZCArIGs7JyxcbiAgICAgICAgXSxcbiAgICAgICAgZmxhZ3M6J1pWTlNDJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQU5EJyxcbiAgICAgICAgc3RyOiAnMDAxMDAwcmRkZGRkcnJycicsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdSZCDihpAgUmQg4oCiIFJyOycsXG4gICAgICAgICAgICAnU1JAMyDihpAgMCdcbiAgICAgICAgXSxcbiAgICAgICAgZmxhZ3M6J3pucydcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0FOREknLFxuICAgICAgICBzdHI6ICcwMTExS0tLS2RkZGRLS0tLJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ1JkKzE2IOKGkCBSZCsxNiDigKIgazsnLFxuICAgICAgICAgICAgJ1NSQDMg4oaQIDAnXG4gICAgICAgIF0sXG4gICAgICAgIGZsYWdzOid6bnMnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdBU1InLFxuICAgICAgICBzdHI6ICcxMDAxMDEwZGRkZGQwMTAxJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ1NSQDAg4oaQIFJkIOKAoiAxJyxcbiAgICAgICAgICAgICdSZCDihpAgUmQgPj4gMTsnXG4gICAgICAgIF0sXG4gICAgICAgIGZsYWdzOid6bnMnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdCQ0xSaScsXG4gICAgICAgIHN0cjogJzEwMDEwMTAwMTExMTEwMDAnLFxuICAgICAgICBpbXBsOiAnU1JANyDihpAgMCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0JDTFJ0JyxcbiAgICAgICAgc3RyOiAnMTAwMTAxMDAxMTEwMTAwMCcsXG4gICAgICAgIGltcGw6ICdTUkA2IOKGkCAwJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQkNMUmgnLFxuICAgICAgICBzdHI6ICcxMDAxMDEwMDExMDExMDAwJyxcbiAgICAgICAgaW1wbDogJ1NSQDUg4oaQIDAnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdCQ0xScycsXG4gICAgICAgIHN0cjogJzEwMDEwMTAwMTEwMDEwMDAnLFxuICAgICAgICBpbXBsOiAnU1JANCDihpAgMCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0JDTFJ2JyxcbiAgICAgICAgc3RyOiAnMTAwMTAxMDAxMDExMTAwMCcsXG4gICAgICAgIGltcGw6ICdTUkAzIOKGkCAwJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQkNMUm4nLFxuICAgICAgICBzdHI6ICcxMDAxMDEwMDEwMTAxMDAwJyxcbiAgICAgICAgaW1wbDogJ1NSQDIg4oaQIDAnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdCQ0xSeicsXG4gICAgICAgIHN0cjogJzEwMDEwMTAwMTAwMTEwMDAnLFxuICAgICAgICBpbXBsOiAnU1JAMSDihpAgMCdcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0JDTFJjJyxcbiAgICAgICAgc3RyOiAnMTAwMTAxMDAxMDAwMTAwMCcsXG4gICAgICAgIGltcGw6ICdTUkAwIOKGkCAwJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQlJDQycsXG4gICAgICAgIHN0cjonMTExMTAxa2tra2trazAwMCcsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdpZiggIVNSQDAgKXsnLFxuICAgICAgICAgICAgJyAgUEMg4oaQIFBDICsgKGsgPDwgMjUgPj4gMjUpICsgMTsnLFxuICAgICAgICAgICAgJ30nXSxcbiAgICAgICAgY3ljbGVzOiAyXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdCUkJTJyxcbiAgICAgICAgc3RyOicxMTExMDBra2tra2trc3NzJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ2lmKCBTUkBzICl7JyxcbiAgICAgICAgICAgICcgIFBDIOKGkCBQQyArIChrIDw8IDI1ID4+IDI1KSArIDE7JyxcbiAgICAgICAgICAgICd9J10sXG4gICAgICAgIGN5Y2xlczogMlxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQlJCQycsXG4gICAgICAgIHN0cjonMTExMTAxa2tra2tra3NzcycsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdpZiggIVNSQHMgKXsnLFxuICAgICAgICAgICAgJyAgUEMg4oaQIFBDICsgKGsgPDwgMjUgPj4gMjUpICsgMTsnLFxuICAgICAgICAgICAgJ30nXSxcbiAgICAgICAgY3ljbGVzOiAyXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdCUkNTJyxcbiAgICAgICAgc3RyOicxMTExMDBra2tra2trMDAwJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ2lmKCBTUkAwICl7JyxcbiAgICAgICAgICAgICcgIFBDIOKGkCBQQyArIChrIDw8IDI1ID4+IDI1KSArIDE7JyxcbiAgICAgICAgICAgICd9J10sXG4gICAgICAgIGN5Y2xlczogMlxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQlJFUScsXG4gICAgICAgIHN0cjonMTExMTAwa2tra2trazAwMScsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdpZiggU1JAMSApeycsXG4gICAgICAgICAgICAnICBQQyDihpAgUEMgKyAoayA8PCAyNSA+PiAyNSkgKyAxOycsXG4gICAgICAgICAgICAnfSddLFxuICAgICAgICBjeWNsZXM6IDNcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0JSTFQnLFxuICAgICAgICBzdHI6JzExMTEwMGtra2tra2sxMDAnLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICAnaWYoIFNSQDQgKXsnLFxuICAgICAgICAgICAgJyAgUEMg4oaQIFBDICsgKGsgPDwgMjUgPj4gMjUpICsgMTsnLFxuICAgICAgICAgICAgJ30nXSxcbiAgICAgICAgY3ljbGVzOiAzXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdCUkdFJyxcbiAgICAgICAgc3RyOicxMTExMDFra2tra2trMTAwJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ2lmKCAhU1JANCApeycsXG4gICAgICAgICAgICAnICBQQyDihpAgUEMgKyAoayA8PCAyNSA+PiAyNSkgKyAxOycsXG4gICAgICAgICAgICAnfSddLFxuICAgICAgICBjeWNsZXM6IDNcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0JSTkUnLFxuICAgICAgICBzdHI6JzExMTEwMWtra2tra2swMDEnLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICAnaWYoICFTUkAxICl7JyxcbiAgICAgICAgICAgICcgIFBDIOKGkCBQQyArIChrIDw8IDI1ID4+IDI1KSArIDE7JyxcbiAgICAgICAgICAgICd9J10sXG4gICAgICAgIGN5Y2xlczogM1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQlJQTCcsXG4gICAgICAgIHN0cjonMTExMTAxa2tra2trazAxMCcsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdpZiggIVNSQDIgKXsnLFxuICAgICAgICAgICAgJyAgUEMg4oaQIFBDICsgKGsgPDwgMjUgPj4gMjUpICsgMTsnLFxuICAgICAgICAgICAgJ30nXSxcbiAgICAgICAgY3ljbGVzOiAyXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdCUk1JJyxcbiAgICAgICAgc3RyOicxMTExMDBra2tra2trMDEwJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ2lmKCBTUkAyICl7JyxcbiAgICAgICAgICAgICcgIFBDIOKGkCBQQyArIChrIDw8IDI1ID4+IDI1KSArIDE7JyxcbiAgICAgICAgICAgICd9J10sXG4gICAgICAgIGN5Y2xlczogMlxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQlJUQycsXG4gICAgICAgIHN0cjonMTExMTAxa2tra2trazExMCcsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdpZiggIVNSQDYgKXsnLFxuICAgICAgICAgICAgJyAgUEMg4oaQIFBDICsgKGsgPDwgMjUgPj4gMjUpICsgMTsnLFxuICAgICAgICAgICAgJ30nXSxcbiAgICAgICAgY3ljbGVzOiAzXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdCU1QnLFxuICAgICAgICBzdHI6JzExMTExMDFkZGRkZDBiYmInLFxuICAgICAgICBpbXBsOiAnU1I2ID0gUmRAYidcbiAgICAgICAgLy8sZGVidWc6IHRydWVcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0JMRCcsXG4gICAgICAgIHN0cjonMTExMTEwMGRkZGRkMGJiYicsXG4gICAgICAgIGltcGw6ICdSZEBiIOKGkCBTUkA2J1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQ0FMTCcsXG4gICAgICAgIHN0cjonMTAwMTAxMGtra2trMTExa2tra2tra2tra2tra2tra2snLFxuICAgICAgICBjeWNsZXM6NCxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJyhTVEFDSzIpIOKGkCBQQyArIDInLFxuICAgICAgICAgICAgJ1BDIOKGkCBrJ1xuICAgICAgICAgICAgXVxuICAgIH0sXG4gICAge1xuXHRuYW1lOiAnQ0JJJyxcblx0c3RyOiAnMTAwMTEwMDBBQUFBQWJiYicsXG5cdGltcGw6ICdJL09bYUBiXSDihpAgMDsnXG4gICAgfSwgICAgXG4gICAge1xuICAgICAgICBuYW1lOiAnQ09NJyxcbiAgICAgICAgc3RyOicxMDAxMDEwZGRkZGQwMDAwJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ1JkIOKGkCB+IFJkOycsXG4gICAgICAgICAgICAnU1JAMyDihpAgMCcsXG4gICAgICAgICAgICAnU1JAMCDihpAgMSdcbiAgICAgICAgXSxcbiAgICAgICAgZmxhZ3M6ICd6bnMnXG4gICAgfSxcbiAgICB7XG5cdG5hbWU6ICdGTVVMJyxcblx0c3RyOicwMDAwMDAxMTBkZGQxcnJyJyxcblx0aW1wbDpbXG5cdCAgICAndDEgPSBSZCsxNiAqIFJyKzE2IDw8IDEnLFxuICAgICAgICAgICAgJ1IwID0gdDEnLFxuICAgICAgICAgICAgJ1IxID0gdDEgPj4gOCcsXG4gICAgICAgICAgICAnU1IxID0gIXQxfDAnLFxuICAgICAgICAgICAgJ1NSMCA9ICh0MT4+MTUpJjEnXG5cdF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ05PUCcsXG4gICAgICAgIHN0cjonMDAwMDAwMDAwMDAwMDAwMCcsXG4gICAgICAgIGltcGw6JydcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ05FRycsXG4gICAgICAgIHN0cjonMTAwMTAxMGRkZGRkMDAwMScsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdSZCDihpAgLSBSZDsnLFxuICAgICAgICAgICAgJ1NSMyA9IFJANyDigKIgUkA2IMKvIOKAoiBSQDUgwq8g4oCiIFJANCDCryDigKIgUkAzIMKvIOKAoiBSQDIgwq8g4oCiIFJAMSDCryDigKIgUkAwIMKvJyxcbiAgICAgICAgICAgICdTUjAgPSAoISFSKXwwJyxcbiAgICAgICAgICAgICdTUkA1IOKGkCBSQDMgfCBSZDMgwq8nXG4gICAgICAgIF0sXG4gICAgICAgIGZsYWdzOiAnem5zJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQ1AnLFxuICAgICAgICBzdHI6JzAwMDEwMXJkZGRkZHJycnInLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICAnUiA9ICgoUmQgLSBScikgPj4+IDApICYgMHhGRjsnLFxuICAgICAgICAgICAgJ1NSQDUg4oaQIChSZEAzIMKvIOKAoiBSckAzKSB8IChSckAzIOKAoiBSQDMpIHwgKFJAMyDigKIgUmRAMyDCryknLFxuICAgICAgICAgICAgJ1NSQDAg4oaQIChSZEA3IMKvIOKAoiBSckA3KSB8IChSckA3IOKAoiBSQDcpIHwgKFJANyDigKIgUmRANyDCryknLFxuICAgICAgICAgICAgJ1NSQDMg4oaQIChSZEA3IOKAoiBSckA3IMKvIOKAoiBSQDcgwq8pICsgKFJkQDcgwq8g4oCiIFJyQDcg4oCiIFJANyknXG4gICAgICAgIF0sXG4gICAgICAgIGZsYWdzOiAnem5zJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQ1BJJyxcbiAgICAgICAgc3RyOicwMDExS0tLS2RkZGRLS0tLJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ1IgPSAoKFJkKzE2IC0gaykgPj4+IDApICYgMHhGRjsnLFxuICAgICAgICAgICAgJ1NSQDUg4oaQIChSZCsxNkAzIMKvIOKAoiAoKGs+PjMpJjEpKSB8ICgoKGs+PjMpJjEpIOKAoiBSQDMpIHwgKFJAMyDigKIgUmQrMTZAMyDCryknLFxuICAgICAgICAgICAgJ1NSQDAg4oaQIChSZCsxNkA3IMKvIOKAoiAoKGs+PjcpJjEpKSB8ICgoKGs+PjcpJjEpIOKAoiBSQDcpIHwgKFJANyDigKIgUmQrMTZANyDCryknLFxuICAgICAgICAgICAgJ1NSQDMg4oaQIChSZCsxNkA3IOKAoiAoKGs+PjcpJjFeMSkg4oCiIFJANyDCrykgKyAoUmQrMTZANyDCryDigKIgKChrPj43KSYxKSDigKIgUkA3KSdcbiAgICAgICAgXSxcbiAgICAgICAgZmxhZ3M6ICd6bnMnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdDUEMnLFxuICAgICAgICBzdHI6JzAwMDAwMXJkZGRkZHJycnInLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICAnUiA9IChSZCAtIFJyIC0gU1JAMCkgJiAweEZGJyxcbiAgICAgICAgICAgICdTUkA1IOKGkCAoUmRAMyDCryDigKIgUnJAMykgfCAoUnJAMyDigKIgUkAzKSB8IChSQDMg4oCiIFJkQDMgwq8pJyxcbiAgICAgICAgICAgICdTUkAwIOKGkCAoUmRANyDCryDigKIgUnJANykgfCAoUnJANyDigKIgUkA3KSB8IChSQDcg4oCiIFJkQDcgwq8pJyxcbiAgICAgICAgICAgICdTUkAzIOKGkCAoUmRANyDigKIgUnJANyDCryDigKIgUkA3IMKvKSB8IChSZEA3IMKvIOKAoiBSckA3IOKAoiBSQDcpJyxcbiAgICAgICAgICAgICdTUkAxIOKGkCAoIVIpICYgU1JAMSdcbiAgICAgICAgXSxcbiAgICAgICAgZmxhZ3M6ICducydcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0NQU0UnLFxuICAgICAgICBzdHI6ICcwMDAxMDByZGRkZGRycnJyJyxcbiAgICAgICAgaW1wbDogJ1NLSVAg4oaQIFJyID09IFJkJyxcbiAgICAgICAgc2tpcDogdHJ1ZVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnREVDJyxcbiAgICAgICAgc3RyOicxMDAxMDEwZGRkZGQxMDEwJyxcbiAgICAgICAgaW1wbDpbXG4gICAgICAgICAgICAnUmQg4oaQIFJkIC0gMScsXG4gICAgICAgICAgICAnU1JAMyDihpAgUkA3IMKvIOKAoiBSQDYg4oCiIFJANSDigKIgUkA0IOKAoiBSQDMg4oCiIFJAMiDigKIgUkAxIOKAoiBSQDAnXG4gICAgICAgIF0sXG4gICAgICAgIGZsYWdzOiAnem5zJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnRU9SJyxcbiAgICAgICAgc3RyOicwMDEwMDFyZGRkZGRycnJyJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ1JkIOKGkCBSZCDiipUgUnI7JyxcbiAgICAgICAgICAgICdTUkAzIOKGkCAwJ1xuICAgICAgICBdLFxuICAgICAgICBmbGFnczogJ3pucydcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0lDQUxMJyxcbiAgICAgICAgc3RyOicxMDAxMDEwMTAwMDAxMDAxJyxcbiAgICAgICAgY3ljbGVzOjMsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICcoU1RBQ0syKSDihpAgUEMgKyAyJyxcbiAgICAgICAgICAgICdQQyDihpAgV1IzJ1xuICAgICAgICAgICAgXVxuICAgICAgICAvLyBlbmQ6dHJ1ZVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnSU5TUicsXG4gICAgICAgIHN0cjonMTAxMTAxMWRkZGRkMTExMScsXG4gICAgICAgIGltcGw6IGBSZCDihpAgU1JgLFxuICAgICAgICBjeWNsZXM6IDFcbiAgICAgICAgLy8gZGVidWc6IHRydWVcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0lOJyxcbiAgICAgICAgc3RyOicxMDExMEFBZGRkZGQxMTEwJyxcbiAgICAgICAgaW1wbDogYFJkIOKGkCBzcD4+PjhgLFxuICAgICAgICBjeWNsZXM6IDFcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0lOJyxcbiAgICAgICAgc3RyOicxMDExMEFBZGRkZGQxMTAxJyxcbiAgICAgICAgaW1wbDogYFJkIOKGkCBzcCYweEZGYCxcbiAgICAgICAgY3ljbGVzOiAxXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdJTicsXG4gICAgICAgIHN0cjonMTAxMTBBQWRkZGRkQUFBQScsXG4gICAgICAgIGltcGw6IGBSZCDihpAgSS9PW2FdYCxcbiAgICAgICAgY3ljbGVzOiAxXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdJTkMnLFxuICAgICAgICBzdHI6ICcxMDAxMDEwZGRkZGQwMDExJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ1JkIOKGkCBSZCArIDE7JyxcbiAgICAgICAgICAgICdTUkAzIOKGkCBSQDcg4oCiIFJANiDCryDigKIgUkA1IMKvIOKAoiBSQDQgwq8g4oCiIFJAMyDCryDigKIgUkAyIMKvIOKAoiBSQDEgwq8g4oCiIFJAMCDCrydcbiAgICAgICAgXSxcbiAgICAgICAgZmxhZ3M6J3pucydcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0lKTVAnLFxuICAgICAgICBzdHI6JzEwMDEwMTAwMDAwMDEwMDEnLFxuICAgICAgICBpbXBsOiBgUEMg4oaQIFdSM2AsXG4gICAgICAgIGN5Y2xlczogMixcbiAgICAgICAgZW5kOnRydWVcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0pNUCcsXG4gICAgICAgIHN0cjonMTAwMTAxMGtra2trMTEwa2tra2tra2tra2tra2tra2snLFxuICAgICAgICBpbXBsOiBgUEMg4oaQIGtgLFxuICAgICAgICBjeWNsZXM6IDMsXG4gICAgICAgIGVuZDp0cnVlXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdMREknLFxuICAgICAgICBzdHI6JzExMTBLS0tLZGRkZEtLS0snLFxuICAgICAgICBpbXBsOidSZCsxNiDihpAgaydcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0xEUycsXG4gICAgICAgIHN0cjonMTAwMTAwMHh4eHh4MDAwMGtra2tra2tra2tra2tra2snLFxuICAgICAgICBpbXBsOidSeCDihpAgdGhpcy5yZWFkKGspJyxcbiAgICAgICAgYnl0ZXM6IDRcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0xEWCcsXG4gICAgICAgIHN0cjonMTAwMTAwMGRkZGRkMTEwMCcsXG4gICAgICAgIGltcGw6IGBSZCDihpAgKFgpO2AsXG4gICAgICAgIGN5Y2xlczogMlxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnTERYKycsXG4gICAgICAgIHN0cjonMTAwMTAwMGRkZGRkMTEwMScsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgIGBSZCDihpAgKFgpO2AsXG4gICAgICAgICAgICBgV1IxICsrO2BcbiAgICAgICAgXSxcbiAgICAgICAgY3ljbGVzOiAyXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdMRFgtJyxcbiAgICAgICAgc3RyOicxMDAxMDAwZGRkZGQxMTEwJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgYFdSMSAtLTtgLFxuICAgICAgICAgICAgYFJkIOKGkCAoWCk7YFxuICAgICAgICBdLFxuICAgICAgICBjeWNsZXM6IDJcbiAgICB9LFxuXG4gICAge1xuICAgICAgICBuYW1lOiAnTERZJyxcbiAgICAgICAgc3RyOicxMDAwMDAwZGRkZGQxMDAwJyxcbiAgICAgICAgaW1wbDogYFJkIOKGkCAoWSlgLFxuICAgICAgICBjeWNsZXM6IDJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0xEWSsnLFxuICAgICAgICBzdHI6JzEwMDEwMDBkZGRkZDEwMDEnLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICBgUmQg4oaQIChZKTtgLFxuICAgICAgICAgICAgYFdSMyArKztgXG4gICAgICAgIF0sXG4gICAgICAgIGN5Y2xlczogMlxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnTERZLScsXG4gICAgICAgIHN0cjonMTAwMTAwMGRkZGRkMTAxMCcsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgIGBXUjMgLS07YCxcbiAgICAgICAgICAgIGBSZCDihpAgKFkpO2BcbiAgICAgICAgXSxcbiAgICAgICAgY3ljbGVzOiAyXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdMRFlRJyxcbiAgICAgICAgc3RyOicxMHEwcXEwZGRkZGQxcXFxJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgYFJkIOKGkCAoWStxKTtgXG4gICAgICAgIF0sXG4gICAgICAgIGN5Y2xlczogMlxuICAgIH0sXG5cbiAgICB7XG4gICAgICAgIG5hbWU6ICdMRFonLFxuICAgICAgICBzdHI6JzEwMDAwMDBkZGRkZDAwMDAnLFxuICAgICAgICBpbXBsOiBgUmQg4oaQIChaKTtgLFxuICAgICAgICBjeWNsZXM6IDJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0xEWisnLFxuICAgICAgICBzdHI6JzEwMDEwMDBkZGRkZDAwMDEnLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICBgUmQg4oaQIChaKTtgLFxuICAgICAgICAgICAgYFdSMyArKztgXG4gICAgICAgIF0sXG4gICAgICAgIGN5Y2xlczogMlxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnTERaLScsXG4gICAgICAgIHN0cjonMTAwMTAwMGRkZGRkMDAxMCcsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgIGBXUjMgLS07YCxcbiAgICAgICAgICAgIGBSZCDihpAgKFopO2BcbiAgICAgICAgXSxcbiAgICAgICAgY3ljbGVzOiAyXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdMRFpRJyxcbiAgICAgICAgc3RyOicxMHEwcXEwZGRkZGQwcXFxJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgYFJkIOKGkCAoWitxKTtgXG4gICAgICAgIF0sXG4gICAgICAgIGN5Y2xlczogMlxuICAgIH0sXG5cbiAgICB7XG4gICAgICAgIG5hbWU6ICdMUE1pJyxcbiAgICAgICAgc3RyOicxMDAxMDEwMTExMDAxMDAwJyxcbiAgICAgICAgaW1wbDonUjAg4oaQIEZMQVNIKFopJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnTFBNaWknLFxuICAgICAgICBzdHI6JzEwMDEwMDBkZGRkZDAxMDAnLFxuICAgICAgICBpbXBsOidSZCDihpAgRkxBU0goWiknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdMUE1paWknLFxuICAgICAgICBzdHI6JzEwMDEwMDBkZGRkZDAxMDEnLFxuICAgICAgICBpbXBsOltcbiAgICAgICAgICAgICdSZCDihpAgRkxBU0goWik7JyxcbiAgICAgICAgICAgICdXUjMgKys7J1xuICAgICAgICBdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdMU1InLFxuICAgICAgICBzdHI6JzEwMDEwMTBkZGRkZDAxMTAnLFxuICAgICAgICAvLyBkZWJ1Zzp0cnVlLFxuICAgICAgICBpbXBsOltcbiAgICAgICAgICAgICdTUjAgPSBSZEAwJyxcbiAgICAgICAgICAgICdSZCDihpAgUmQgPj4+IDEnLFxuICAgICAgICAgICAgJ1NSMiA9IDAnLFxuICAgICAgICAgICAgJ1NSMyA9IFNSQDIgXiBTUjAnXG4gICAgICAgIF0sXG4gICAgICAgIGZsYWdzOid6cydcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ01PVicsXG4gICAgICAgIHN0cjogJzAwMTAxMXJkZGRkZHJycnInLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICAnUmQg4oaQIFJyOydcbiAgICAgICAgXVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnTU9WVycsXG4gICAgICAgIHN0cjonMDAwMDAwMDFkZGRkcnJycicsXG4gICAgICAgIGltcGw6W1xuICAgICAgICAgICAgJ1JkPDwxID0gUnI8PDEnLFxuICAgICAgICAgICAgJ1JkPDwxKzEgPSBScjw8MSsxJ1xuICAgICAgICBdXG4gICAgfSxcbiAgICB7XG5cdG5hbWU6ICdNVUxTVScsXG5cdHN0cjonMDAwMDAwMTEwZGRkMHJycicsXG5cdGltcGw6W1xuXHQgICAgJ2k4YVswXSA9IFJkKzE2Jyxcblx0ICAgICd0MSA9IGk4YVswXSAqIFJyKzE2JyxcbiAgICAgICAgICAgICdSMCA9IHQxJyxcbiAgICAgICAgICAgICdSMSA9IHQxID4+IDgnLFxuICAgICAgICAgICAgJ1NSMSA9ICF0MXwwJyxcbiAgICAgICAgICAgICdTUjAgPSAodDE+PjE1KSYxJ1xuXHRdXG4gICAgfSxcbiAgICB7XG5cdG5hbWU6ICdNVUxTJyxcblx0c3RyOicwMDAwMDAxMGRkZGRycnJyJyxcblx0aW1wbDpbXG5cdCAgICAnaThhWzBdID0gUmQrMTYnLFxuXHQgICAgJ2k4YVsxXSA9IFJyKzE2Jyxcblx0ICAgICd0MSA9IGk4YVswXSAqIGk4YVsxXScsXG4gICAgICAgICAgICAnUjAgPSB0MScsXG4gICAgICAgICAgICAnUjEgPSB0MSA+PiA4JyxcbiAgICAgICAgICAgICdTUjEgPSAhdDF8MCcsXG4gICAgICAgICAgICAnU1IwID0gKHQxPj4xNSkmMSdcblx0XVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnT1InLFxuICAgICAgICBzdHI6ICcwMDEwMTByZGRkZGRycnJyJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ1JkIOKGkCBSZCB8IFJyOycsXG4gICAgICAgICAgICAnU1JAMyDihpAgMCdcbiAgICAgICAgXSxcbiAgICAgICAgZmxhZ3M6J3pucydcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ09SSScsXG4gICAgICAgIHN0cjogJzAxMTBLS0tLZGRkZEtLS0snLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICAnUmQrMTYg4oaQIFJkKzE2IHwgazsnLFxuICAgICAgICAgICAgJ1NSQDMg4oaQIDAnXG4gICAgICAgIF0sXG4gICAgICAgIGZsYWdzOid6bnMnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdPVVRzcicsXG4gICAgICAgIHN0cjonMTAxMTExMXJycnJyMTExMScsXG4gICAgICAgIGltcGw6ICdJL09bNjNdIOKGkCBTUiDihpAgUnInLFxuICAgICAgICBjeWNsZXM6IDFcbiAgICB9LCAgICBcbiAgICB7XG4gICAgICAgIG5hbWU6ICdPVVRzcGgnLFxuICAgICAgICBzdHI6JzEwMTExMTFycnJycjExMTAnLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICAnSS9PWzYyXSDihpAgUnI7JyxcbiAgICAgICAgICAgICdzcCA9IChpb1s2Ml08PDgpIHwgKHNwJjB4RkYpOydcbiAgICAgICAgXSxcbiAgICAgICAgY3ljbGVzOiAxXG4gICAgfSwgICAgXG4gICAge1xuICAgICAgICBuYW1lOiAnT1VUc3BsJyxcbiAgICAgICAgc3RyOicxMDExMTExcnJycnIxMTAxJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgJ0kvT1s2MV0g4oaQIFJyOycsXG4gICAgICAgICAgICAnc3AgPSAoc3AmMHhGRjAwKSB8IGlvWzYxXTsnXG4gICAgICAgIF0sXG4gICAgICAgIGN5Y2xlczogMVxuICAgIH0sICAgIFxuICAgIHtcbiAgICAgICAgbmFtZTogJ09VVCcsXG4gICAgICAgIHN0cjonMTAxMTFBQXJycnJyQUFBQScsXG4gICAgICAgIGltcGw6IGBJL09bYV0g4oaQIFJyYCxcbiAgICAgICAgY3ljbGVzOiAxXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdQVVNIJyxcbiAgICAgICAgc3RyOicxMDAxMDAxZGRkZGQxMTExJyxcbiAgICAgICAgaW1wbDonKFNUQUNLKSDihpAgUmQnLFxuICAgICAgICBjeWNsZXM6IDJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1BPUCcsXG4gICAgICAgIHN0cjonMTAwMTAwMGRkZGRkMTExMScsXG4gICAgICAgIGltcGw6J1JkIOKGkCAoU1RBQ0spJyxcbiAgICAgICAgY3ljbGVzOiAyXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdSRVQnLFxuICAgICAgICBzdHI6JzEwMDEwMTAxMDAwMDEwMDAnLFxuICAgICAgICBjeWNsZXM6NCxcbiAgICAgICAgZW5kOnRydWUsXG4gICAgICAgIGltcGw6ICdQQyDihpAgKFNUQUNLMiknXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdSRVRJJyxcbiAgICAgICAgc3RyOicxMDAxMDEwMTAwMDExMDAwJyxcbiAgICAgICAgY3ljbGVzOjQsXG4gICAgICAgIGVuZDp0cnVlLFxuICAgICAgICBpbXBsOltcbiAgICAgICAgICAgICdtZW1vcnlbMHg1Rl0gPSAoU1IgfD0gMTw8Nyk7JyxcbiAgICAgICAgICAgICdQQyDihpAgKFNUQUNLMiknXG4gICAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1JPUicsXG4gICAgICAgIHN0cjonMTAwMTAxMGRkZGRkMDExMScsXG4gICAgICAgIGltcGw6W1xuICAgICAgICAgICAgJ1NSMCA9IFJkQDAnLFxuICAgICAgICAgICAgJ1JkIOKGkCBSZCA+Pj4gMSB8IChTUjw8NyYweDgwKScsXG4gICAgICAgICAgICAnU1IyID0gUj4+NycsXG4gICAgICAgICAgICAnU1IzID0gU1JAMiBeIFNSMCdcbiAgICAgICAgXSxcbiAgICAgICAgZmxhZ3M6J3pzJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnSEFMVCcsXG4gICAgICAgIHN0cjonMTEwMDExMTExMTExMTExMScsXG4gICAgICAgIGltcGw6IGBQQyDihpAgUEMgLSAxYCxcbiAgICAgICAgZW5kOnRydWVcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1JDQUxMJyxcbiAgICAgICAgc3RyOicxMTAxa2tra2tra2tra2trJyxcbiAgICAgICAgY3ljbGVzOjMsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICcoU1RBQ0syKSDihpAgUEMgKyAxJyxcbiAgICAgICAgICAgIGBQQyDihpAgUEMgKyAoayA8PCAyMCA+PiAyMCkgKyAxYFxuICAgICAgICBdLFxuICAgICAgICBlbmQ6ZmFsc2VcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1JKTVAnLFxuICAgICAgICBzdHI6JzExMDBra2tra2tra2tra2snLFxuICAgICAgICBpbXBsOiBgUEMg4oaQIFBDICsgKGsgPDwgMjAgPj4gMjApICsgMWAsXG4gICAgICAgIGVuZDp0cnVlXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdTRUMnLFxuICAgICAgICBzdHI6JzEwMDEwMTAwMDAwMDEwMDAnLFxuICAgICAgICBpbXBsOiBgU1JAMCDihpAgMWBcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1NFVCcsXG4gICAgICAgIHN0cjonMTAwMTAxMDAwMTEwMTAwMCcsXG4gICAgICAgIGltcGw6IGBTUkA2IOKGkCAxYFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnU0VJJyxcbiAgICAgICAgc3RyOicxMDAxMDEwMDAxMTExMDAwJyxcbiAgICAgICAgaW1wbDogYFNSQDcg4oaQIDFgXG4gICAgfSxcbiAgICB7XG5cdG5hbWU6ICdTRk1VTCcsXG5cdHN0cjonMDAwMDAwMTExZGRkMHJycicsXG5cdGltcGw6W1xuXHQgICAgJ2k4YVswXSA9IFJkKzE2Jyxcblx0ICAgICdpOGFbMV0gPSBScisxNicsXG5cdCAgICAndDEgPSBpOGFbMF0gKiBpOGFbMV0gPDwgMScsXG4gICAgICAgICAgICAnUjAgPSB0MScsXG4gICAgICAgICAgICAnUjEgPSB0MSA+PiA4JyxcbiAgICAgICAgICAgICdTUjEgPSAhdDF8MCcsXG4gICAgICAgICAgICAnU1IwID0gKHQxPj4xNSkmMSdcblx0XVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnU1RTJyxcbiAgICAgICAgc3RyOicxMDAxMDAxZGRkZGQwMDAwa2tra2tra2tra2tra2traycsXG4gICAgICAgIGltcGw6IGB0aGlzLndyaXRlKCBrLCBSZCApYCxcbiAgICAgICAgYnl0ZXM6IDRcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1NUWCcsXG4gICAgICAgIHN0cjonMTAwMTAwMXJycnJyMTEwMCcsXG4gICAgICAgIGltcGw6IGAoWCkg4oaQIFJyYFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnU1RYKycsXG4gICAgICAgIHN0cjonMTAwMTAwMXJycnJyMTEwMScsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgIGAoWCkg4oaQIFJyYCxcbiAgICAgICAgICAgIGBXUjEgKys7YFxuICAgICAgICBdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdTVFgtJyxcbiAgICAgICAgc3RyOicxMDAxMDAxcnJycnIxMTEwJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgYFdSMSAtLTtgLFxuICAgICAgICAgICAgYChYKSDihpAgUnJgXG4gICAgICAgIF1cbiAgICB9LFxuXG4gICAge1xuICAgICAgICBuYW1lOiAnU1RZJyxcbiAgICAgICAgc3RyOicxMDAwMDAxcnJycnIxMDAwJyxcbiAgICAgICAgaW1wbDogYChZKSDihpAgUnJgXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdTVFkrJyxcbiAgICAgICAgc3RyOicxMDAxMDAxcnJycnIxMDAxJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgYChZKSDihpAgUnJgLFxuICAgICAgICAgICAgYFdSMSArKztgXG4gICAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1NUWS0nLFxuICAgICAgICBzdHI6JzEwMDEwMDFycnJycjEwMTAnLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICBgV1IxIC0tO2AsXG4gICAgICAgICAgICBgKFkpIOKGkCBScmBcbiAgICAgICAgXVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnU1RZUScsXG4gICAgICAgIHN0cjonMTBxMHFxMXJycnJyMXFxcScsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgIGAoWStxKSDihpAgUnJgXG4gICAgICAgIF1cbiAgICB9LFxuXG4gICAge1xuICAgICAgICBuYW1lOiAnU1RaJyxcbiAgICAgICAgc3RyOicxMDAwMDAxcnJycnIwMDAwJyxcbiAgICAgICAgaW1wbDogYChaKSDihpAgUnJgXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdTVForJyxcbiAgICAgICAgc3RyOicxMDAxMDAxcnJycnIwMDAxJyxcbiAgICAgICAgaW1wbDogW1xuICAgICAgICAgICAgYChaKSDihpAgUnJgLFxuICAgICAgICAgICAgYFdSMyArKztgXG4gICAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1NUWi0nLFxuICAgICAgICBzdHI6JzEwMDEwMDFycnJycjAwMTAnLFxuICAgICAgICBpbXBsOiBbXG4gICAgICAgICAgICBgV1IzIC0tO2AsXG4gICAgICAgICAgICBgKFopIOKGkCBScmBcbiAgICAgICAgXVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnU1RaUScsXG4gICAgICAgIHN0cjonMTBxMHFxMXJycnJyMHFxcScsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgIGAoWitxKSDihpAgUnJgXG4gICAgICAgIF1cbiAgICB9LFxuXG4gICAge1xuICAgICAgICBuYW1lOiAnU0JDJyxcbiAgICAgICAgc3RyOiAnMDAwMDEwcmRkZGRkcnJycicsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdSZCDihpAgKFJkIC0gUnIgLSBTUkAwKSAmIDB4RkY7JyxcbiAgICAgICAgICAgICdTUkA1IOKGkCAoUmRAMyDCryDigKIgUnJAMykgfCAoUnJAMyDigKIgUkAzKSB8IChSQDMg4oCiIFJkQDMgwq8pJyxcbiAgICAgICAgICAgICdTUkAwIOKGkCAoUmRANyDCryDigKIgUnJANykgfCAoUnJANyDigKIgUkA3KSB8IChSQDcg4oCiIFJkQDcgwq8pJyxcbiAgICAgICAgICAgICdTUkAzIOKGkCAoUmRANyDigKIgUnJANyDCryDigKIgUkA3IMKvKSB8IChSZEA3IMKvIOKAoiBSckA3IOKAoiBSQDcpJyxcbiAgICAgICAgICAgICdTUkAxIOKGkCAoIVIpICYgU1JAMSdcbiAgICAgICAgXSxcbiAgICAgICAgZmxhZ3M6J25zJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnU1VCJyxcbiAgICAgICAgc3RyOiAnMDAwMTEwcmRkZGRkcnJycicsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdSZCDihpAgKFJkIC0gUnIpJjB4RkY7JyxcbiAgICAgICAgICAgICdTUkA1IOKGkCAoUmRAMyDCryDigKIgUnJAMykgfCAoUnJAMyDigKIgUkAzKSB8IChSQDMg4oCiIFJkQDMgwq8pJyxcbiAgICAgICAgICAgICdTUkAwIOKGkCAoUmRANyDCryDigKIgUnJANykgfCAoUnJANyDigKIgUkA3KSB8IChSQDcg4oCiIFJkQDcgwq8pJyxcbiAgICAgICAgICAgICdTUkAzIOKGkCAoUmRANyDigKIgUnJANyDCryDigKIgUkA3IMKvKSB8IChSZEA3IMKvIOKAoiBSckA3IOKAoiBSQDcpJ1xuXG4gICAgICAgIF0sXG4gICAgICAgIGZsYWdzOid6bnMnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdTQkNJJyxcbiAgICAgICAgc3RyOiAnMDEwMEtLS0tkZGRkS0tLSycsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdSZCsxNiDihpAgKFJkKzE2IC0gayAtIFNSQDApJjB4RkY7JyxcbiAgICAgICAgICAgICdTUkA1IOKGkCAoUmQrMTZAMyDCryDigKIgKChrPj4zKSYxKSkgfCAoKChrPj4zKSYxKSDigKIgUkAzKSB8IChSQDMg4oCiIFJkKzE2QDMgwq8pJyxcbiAgICAgICAgICAgICdTUkAwIOKGkCAoUmQrMTZANyDCryDigKIgKChrPj43KSYxKSkgfCAoKChrPj43KSYxKSDigKIgUkA3KSB8IChSQDcg4oCiIFJkKzE2QDcgwq8pJyxcbiAgICAgICAgICAgICdTUkAzIOKGkCAoUmQrMTZANyDigKIgKChrPj43KSYxXjEpIOKAoiBSQDcgwq8pIHwgKFJkKzE2QDcgwq8g4oCiICgoaz4+NykmMSkg4oCiIFJANyknLFxuICAgICAgICAgICAgJ1NSQDEg4oaQICghUikgJiBTUkAxJ1xuICAgICAgICBdLFxuICAgICAgICBmbGFnczonbnMnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdTVUJJJyxcbiAgICAgICAgc3RyOiAnMDEwMUtLS0tkZGRkS0tLSycsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdSZCsxNiDihpAgUmQrMTYgLSBrOycsXG4gICAgICAgICAgICAnU1JANSDihpAgKFJkKzE2QDMgwq8g4oCiICgoaz4+MykmMSkpIHwgKCgoaz4+MykmMSkg4oCiIFJAMykgfCAoUkAzIOKAoiBSZCsxNkAzIMKvKScsXG4gICAgICAgICAgICAnU1JAMCDihpAgKFJkKzE2QDcgwq8g4oCiICgoaz4+NykmMSkpIHwgKCgoaz4+NykmMSkg4oCiIFJANykgfCAoUkA3IOKAoiBSZCsxNkA3IMKvKScsXG4gICAgICAgICAgICAnU1JAMyDihpAgKFJkKzE2QDcg4oCiICgoaz4+NykmMV4xKSDigKIgUkA3IMKvKSB8IChSZCsxNkA3IMKvIOKAoiAoKGs+PjcpJjEpIOKAoiBSQDcpJ1xuICAgICAgICBdLFxuICAgICAgICBmbGFnczonem5zJ1xuICAgIH0sXG4gICAge1xuXHRuYW1lOiAnU0JJJyxcblx0c3RyOiAnMTAwMTEwMTBBQUFBQWJiYicsXG5cdGltcGw6ICdJL09bYUBiXSDihpAgMTsnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdTQklXJyxcbiAgICAgICAgc3RyOiAnMTAwMTAxMTFLS2RkS0tLSycsXG4gICAgICAgIGltcGw6IFtcbiAgICAgICAgICAgICdXUmQg4oaQIFdSZCAtIGs7JyxcbiAgICAgICAgXSxcbiAgICAgICAgZmxhZ3M6J1pWTlMnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdTQklDJyxcbiAgICAgICAgc3RyOiAnMTAwMTEwMDFBQUFBQWJiYicsXG4gICAgICAgIGltcGw6ICdTS0lQIOKGkCAhSS9PW2FAYl0nLFxuICAgICAgICBza2lwOiB0cnVlXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdTQklTJyxcbiAgICAgICAgc3RyOiAnMTAwMTEwMTFBQUFBQWJiYicsXG4gICAgICAgIGltcGw6ICdTS0lQIOKGkCBJL09bYUBiXScsXG4gICAgICAgIHNraXA6IHRydWVcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1NCUkMnLFxuICAgICAgICBzdHI6ICcxMTExMTEwcnJycnIwYmJiJyxcbiAgICAgICAgLy8gZGVidWc6IHRydWUsXG4gICAgICAgIGltcGw6ICdTS0lQIOKGkCAhKFJyICYgKDE8PGIpKScsXG4gICAgICAgIHNraXA6IHRydWVcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1NCUlMnLFxuICAgICAgICBzdHI6ICcxMTExMTExcnJycnIwYmJiJyxcbiAgICAgICAgLy8gZGVidWc6IHRydWUsXG4gICAgICAgIGltcGw6ICdTS0lQIOKGkCBSciAmICgxPDxiKScsXG4gICAgICAgIHNraXA6IHRydWVcbiAgICB9LFxuICAgIHtcblx0bmFtZTogJ1NMRUVQJyxcblx0c3RyOiAnMTAwMTAxMDExMDAwMTAwMCcsXG5cdGltcGw6IFtcblx0ICAgICd0aGlzLnNsZWVwaW5nID0gdHJ1ZScsXG5cdCAgICAnUEMg4oaQIFBDICsgMSdcblx0XSxcblx0Ly8gZGVidWc6IHRydWUsXG5cdGN5Y2xlczogMFxuICAgIH0sXG4gICAge1xuXHRuYW1lOiAnU1dBUCcsXG5cdHN0cjogJzEwMDEwMTBkZGRkZDAwMTAnLFxuXHRpbXBsOltcblx0ICAgICdSZCDihpAgKFJkID4+PiA0KSB8IChSZCA8PCA0KSdcblx0ICAgIF1cbiAgICB9XG5dO1xuXG5jb25zdCBBdEZsYWdzID0ge1xuXG4gICAgaDogJ1NSQDUg4oaQIChSZEAzIOKAoiBSckAzKSArIChSckAzIOKAoiBSQDMgwq8pIHwgKFJAMyDCryDigKIgUmRAMyknLFxuICAgIEg6ICcnLFxuICAgIHo6ICdTUjEgPSAhKFImMHhGRil8MCcsXG4gICAgWjogJ1NSMSA9ICEoUiYweEZGKXwwJyxcbiAgICB2OiAnU1IzID0gKFJkQDcg4oCiIFJyQDcg4oCiIFJANyDCrykgfCAoUmRANyDCryDigKIgUnJANyDCryDigKIgUkA3KScsXG4gICAgVjogJ1NSMyA9IFdSZEAxNSDCryDigKIgUkAxNScsXG4gICAgbjogJ1NSMiA9IFJANycsXG4gICAgTjogJ1NSMiA9IFJAMTUnLFxuICAgIHM6ICdTUjQgPSBTUkAyIOKKlSBTUkAzJyxcbiAgICBTOiAnU1I0ID0gU1JAMiDiipUgU1JAMycsXG4gICAgYzogJ1NSMCA9IChSZEA3IOKAoiBSckA3KSB8IChSckA3IOKAoiBSQDcgwq8pIHwgKFJANyDCryDigKIgUmRANyknLFxuICAgIEM6ICdTUjAgPSAoUkAxNSDCryDigKIgV1JkQDE1KScsXG5cbiAgICAvKlxuICAgIEJpdCA3IOKAkyBJOiBHbG9iYWwgSW50ZXJydXB0IEVuYWJsZVxuICAgIFRoZSBnbG9iYWwgaW50ZXJydXB0IGVuYWJsZSBiaXQgbXVzdCBiZSBzZXQgZm9yIHRoZSBpbnRlcnJ1cHRzIHRvIGJlIGVuYWJsZWQuIFRoZSBpbmRpdmlkdWFsIGludGVycnVwdCBlbmFibGUgY29udHJvbCBpcyB0aGVuXG4gICAgcGVyZm9ybWVkIGluIHNlcGFyYXRlIGNvbnRyb2wgcmVnaXN0ZXJzLiBJZiB0aGUgZ2xvYmFsIGludGVycnVwdCBlbmFibGUgcmVnaXN0ZXIgaXMgY2xlYXJlZCwgbm9uZSBvZiB0aGUgaW50ZXJydXB0cyBhcmUgZW5hYmxlZFxuICAgIGluZGVwZW5kZW50IG9mIHRoZSBpbmRpdmlkdWFsIGludGVycnVwdCBlbmFibGUgc2V0dGluZ3MuIFRoZSBJLWJpdCBpcyBjbGVhcmVkIGJ5IGhhcmR3YXJlIGFmdGVyIGFuIGludGVycnVwdCBoYXMgb2NjdXJyZWQsIGFuZCBpc1xuICAgIHNldCBieSB0aGUgUkVUSSBpbnN0cnVjdGlvbiB0byBlbmFibGUgc3Vic2VxdWVudCBpbnRlcnJ1cHRzLiBUaGUgSS1iaXQgY2FuIGFsc28gYmUgc2V0IGFuZCBjbGVhcmVkIGJ5IHRoZSBhcHBsaWNhdGlvbiB3aXRoIHRoZVxuICAgIFNFSSBhbmQgQ0xJIGluc3RydWN0aW9ucywgYXMgZGVzY3JpYmVkIGluIHRoZSBpbnN0cnVjdGlvbiBzZXQgcmVmZXJlbmNlICAgIFxuICAgICovXG4gICAgU0VJKCl7XG4gICAgICAgIHRoaXMuc3JlZyB8PSAxIDw8IDc7XG4gICAgfSxcblxuICAgIENMSSgpe1xuICAgICAgICB0aGlzLnNyZWcgJj0gfigxPDw3KTtcbiAgICB9LFxuXG5cblxuICAgIC8qXG4gICAgQml0IDYg4oCTIFQ6IEJpdCBDb3B5IFN0b3JhZ2VcbiAgICBUaGUgYml0IGNvcHkgaW5zdHJ1Y3Rpb25zIEJMRCAoYml0IExvYUQpIGFuZCBCU1QgKEJpdCBTVG9yZSkgdXNlIHRoZSBULWJpdCBhcyBzb3VyY2Ugb3IgZGVzdGluYXRpb24gZm9yIHRoZSBvcGVyYXRlZCBiaXQuIEEgYml0XG4gICAgZnJvbSBhIHJlZ2lzdGVyIGluIHRoZSByZWdpc3RlciBmaWxlIGNhbiBiZSBjb3BpZWQgaW50byBUIGJ5IHRoZSBCU1QgaW5zdHJ1Y3Rpb24sIGFuZCBhIGJpdCBpbiBUIGNhbiBiZSBjb3BpZWQgaW50byBhIGJpdCBpbiBhXG4gICAgcmVnaXN0ZXIgaW4gdGhlIHJlZ2lzdGVyIGZpbGUgYnkgdGhlIEJMRCBpbnN0cnVjdGlvbi5cbiAgICAqL1xuICAgIEJMRCggUkVHLCBCSVQgKXtcbiAgICAgICAgaWYoIHRoaXMucmVnICYgKDE8PDYpICkgdGhpcy5yZWdbUkVHXSB8PSAxPDxCSVQ7XG4gICAgICAgIGVsc2UgdGhpcy5yZWdbUkVHXSAmPSB+KDE8PEJJVCk7XG4gICAgfSxcblxuICAgIEJTVCggUkVHLCBCSVQgKXtcbiAgICAgICAgbGV0IHYgPSAodGhpcy5yZWdbUkVHXSA+PiBCSVQpICYgMTtcbiAgICAgICAgaWYoIHYgKSB0aGlzLnNyZWcgfD0gMSA8PCA2O1xuICAgICAgICBlbHNlIHRoaXMuc3JlZyAmPSB+KDE8PDYpO1xuICAgIH1cblxuXG4gICAgXG59O1xuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBBdGNvcmU7XG4iLCJjb25zdCBIZXggPSB7XG5cbiAgICBwYXJzZVVSTCggdXJsLCBidWZmZXIsIGNiICl7XG5cbiAgICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYoICB4aHIucmVhZHlTdGF0ZSA9PT0gNCApe1xuICAgICAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICAgICAgSGV4LnBhcnNlKCB4aHIucmVzcG9uc2VUZXh0LCBidWZmZXIgKTtcbiAgICAgICAgICAgICAgICB9Y2F0Y2goZXgpe1xuICAgICAgICAgICAgICAgICAgICBjYihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2IoIHRydWUgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgeGhyLm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgICAgICAgeGhyLnNlbmQoKTtcbiAgICAgICAgXG4gICAgfSxcblxuICAgIHBhcnNlKCBzcmMsIGJ1ZmZlciApe1xuXG4gICAgICAgIGxldCBzdGF0ZSA9IDAsIHNpemUgPSAwLCBudW0sIGJ5dGUsIG9mZnNldCwgc3VtID0gMDtcblxuICAgICAgICBmb3IoIGxldCBpPTAsIGw9c3JjLmxlbmd0aDsgaTxsOyApe1xuXG4gICAgICAgICAgICBieXRlID0gc3JjLmNoYXJDb2RlQXQoaSsrKTtcblxuICAgICAgICAgICAgaWYoIGJ5dGUgPT09IDU4ICl7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiggYnl0ZSA+PSA2NSAmJiBieXRlIDw9IDcwICl7XG4gICAgICAgICAgICAgICAgbnVtID0gKGJ5dGUgLSA1NSkgPDwgNDtcbiAgICAgICAgICAgIH1lbHNlIGlmKCBieXRlID49IDQ4ICYmIGJ5dGUgPD0gNTcgKXtcbiAgICAgICAgICAgICAgICBudW0gPSAoYnl0ZSAtIDQ4KSA8PCA0O1xuICAgICAgICAgICAgfWVsc2UgY29udGludWU7XG5cbiAgICAgICAgICAgIHdoaWxlKCBpPGwgKXtcbiAgICAgICAgICAgICAgICBieXRlID0gc3JjLmNoYXJDb2RlQXQoaSsrKTtcbiAgICAgICAgICAgICAgICBpZiggYnl0ZSA+PSA2NSAmJiBieXRlIDw9IDcwICl7XG4gICAgICAgICAgICAgICAgICAgIG51bSArPSBieXRlIC0gNTU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1lbHNlIGlmKCBieXRlID49IDQ4ICYmIGJ5dGUgPD0gNTcgKXtcbiAgICAgICAgICAgICAgICAgICAgbnVtICs9IGJ5dGUgLSA0ODtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfWVsc2UgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHN3aXRjaCggc3RhdGUgKXtcbiAgICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgICAgICBzaXplID0gbnVtO1xuICAgICAgICAgICAgICAgIHN0YXRlKys7XG4gICAgICAgICAgICAgICAgc3VtID0gbnVtO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgb2Zmc2V0ID0gbnVtIDw8IDg7XG4gICAgICAgICAgICAgICAgc3RhdGUrKztcbiAgICAgICAgICAgICAgICBzdW0gKz0gbnVtO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgb2Zmc2V0ICs9IG51bTtcbiAgICAgICAgICAgICAgICBzdGF0ZSsrO1xuICAgICAgICAgICAgICAgIHN1bSArPSBudW07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgICBpZiggbnVtID09PSAxICkgcmV0dXJuO1xuXHRcdGlmKCBudW0gPT09IDMgfHwgbnVtID09PSA1ICl7XG5cdFx0ICAgIHN0YXRlKys7XG5cdFx0fWVsc2UgaWYoIG51bSAhPT0gMCApIHRocm93ICdVbnN1cHBvcnRlZCByZWNvcmQgdHlwZTogJyArIG51bTtcbiAgICAgICAgICAgICAgICBzdGF0ZSsrO1xuICAgICAgICAgICAgICAgIHN1bSArPSBudW07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgICAgICBidWZmZXJbb2Zmc2V0KytdID0gbnVtO1xuXHQgICAgY2FzZSA1OlxuICAgICAgICAgICAgICAgIHN1bSArPSBudW07XG4gICAgICAgICAgICAgICAgaWYoICEtLXNpemUgKSBzdGF0ZSA9IDY7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNhc2UgNjpcbiAgICAgICAgICAgICAgICBzdW0gKz0gbnVtO1xuICAgICAgICAgICAgICAgIHN1bSA9ICgtc3VtKSAmIDB4RkY7XG4gICAgICAgICAgICAgICAgaWYoICFzdW0gKSBzdGF0ZSsrO1xuICAgICAgICAgICAgICAgIGVsc2UgdGhyb3cgKCAnQ2hlY2tzdW0gbWlzbWF0Y2g6ICcgKyBzdW0gKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSA3OlxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyAnSWxsZWdhbCBzdGF0ZSAnICsgc3RhdGU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBIZXg7XG4iLCJjbGFzcyBCVE4ge1xuICAgIHN0YXRpYyBcIkBpbmplY3RcIiA9IHtcbiAgICAgICAgcG9vbDpcInBvb2xcIlxuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKCBET00gKXtcblxuXHRET00uZWxlbWVudC5jb250cm9sbGVyID0gdGhpcztcblx0RE9NLmVsZW1lbnQuZGlzcGF0Y2hFdmVudCggbmV3IEV2ZW50KFwiYWRkcGVyaWZlcmFsXCIsIHtidWJibGVzOnRydWV9KSApO1xuXHR0aGlzLm9uLmNvbm5lY3QgPSBET00uZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJwaW4tb25cIik7XG5cdHRoaXMuYWN0aXZlID0gRE9NLmVsZW1lbnQuZ2V0QXR0cmlidXRlKFwiYWN0aXZlXCIpICE9IFwibG93XCI7XG5cdFxuXHRET00uZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCBcIm1vdXNlZG93blwiLCAgXyA9PiB0aGlzLm9uLnZhbHVlID0gIHRoaXMuYWN0aXZlICk7XG5cdERPTS5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoIFwibW91c2V1cFwiLCAgICBfID0+IHRoaXMub24udmFsdWUgPSAhdGhpcy5hY3RpdmUgKTtcblx0RE9NLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggXCJ0b3VjaHN0YXJ0XCIsIF8gPT4gdGhpcy5vbi52YWx1ZSA9ICB0aGlzLmFjdGl2ZSApO1xuXHRET00uZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCBcInRvdWNoZW5kXCIsICAgXyA9PiB0aGlzLm9uLnZhbHVlID0gIXRoaXMuYWN0aXZlICk7XG5cblx0KERPTS5lbGVtZW50LmdldEF0dHJpYnV0ZShcImJpbmQta2V5XCIpIHx8IFwiXCIpLnNwbGl0KC9cXHMqLFxccyovKS5mb3JFYWNoKCBrID0+IHtcblx0ICAgIHRoaXNbXCJvblByZXNzXCIgKyBrXSA9IF8gPT4gdGhpcy5vbi52YWx1ZSA9IHRoaXMuYWN0aXZlO1xuXHQgICAgdGhpc1tcIm9uUmVsZWFzZVwiICsga10gPSBfID0+IHRoaXMub24udmFsdWUgPSAhdGhpcy5hY3RpdmU7XG5cdH0pO1xuXG5cdHRoaXMucG9vbC5hZGQodGhpcyk7XG5cdFxuICAgIH1cblxuICAgIHNldEFjdGl2ZVZpZXcoKXtcblx0dGhpcy5wb29sLnJlbW92ZSh0aGlzKTtcbiAgICB9XG5cbiAgICBvbiA9IHtcblx0Y29ubmVjdDogbnVsbCxcblx0aW5pdDpmdW5jdGlvbigpe1xuXHQgICAgdGhpcy5vbi52YWx1ZSA9ICF0aGlzLmFjdGl2ZTtcblx0fVxuICAgIH1cbiAgICBcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBCVE47XG4iLCJjbGFzcyBMRUQge1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKCBET00gKXtcblx0XG5cdHRoaXMuZWwgPSBET00uZWxlbWVudDtcblx0RE9NLmVsZW1lbnQuY29udHJvbGxlciA9IHRoaXM7XG5cdERPTS5lbGVtZW50LmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudChcImFkZHBlcmlmZXJhbFwiLCB7YnViYmxlczp0cnVlfSkgKTtcblx0dGhpcy5vbi5jb25uZWN0ID0gRE9NLmVsZW1lbnQuZ2V0QXR0cmlidXRlKFwicGluLW9uXCIpO1xuXHR0aGlzLmVsLnN0eWxlLm9wYWNpdHkgPSAwO1xuXHRcbiAgICB9XG5cbiAgICBvbiA9IHtcblx0XG5cdGNvbm5lY3Q6bnVsbCxcblx0XG5cdG9uTG93VG9IaWdoKCl7XG5cdCAgICB0aGlzLmVsLnN0eWxlLm9wYWNpdHkgPSBcIjBcIjtcblx0fSxcblx0XG5cdG9uSGlnaFRvTG93KCl7XG5cdCAgICB0aGlzLmVsLnN0eWxlLm9wYWNpdHkgPSBcIjFcIjtcblx0fVxuXHRcbiAgICB9XG4gICAgXG59XG5cbm1vZHVsZS5leHBvcnRzID0gTEVEO1xuIiwiY2xhc3MgU0NSRUVOIHtcbiAgICBzdGF0aWMgXCJAaW5qZWN0XCIgPSB7XG5cdHBvb2w6XCJwb29sXCJcbiAgICB9XG4gICAgXG4gICAgY29uc3RydWN0b3IoIERPTSApe1xuXHRcblx0bGV0IGNhbnZhcyA9IHRoaXMuY2FudmFzID0gRE9NLnNjcmVlbjtcblx0aWYoICFjYW52YXMgKSB0aHJvdyBcIk5vIGNhbnZhcyBpbiBBcmR1Ym95IGVsZW1lbnRcIjtcblxuXHR0aGlzLnBvb2wuYWRkKHRoaXMpO1xuXHRcblx0Y2FudmFzLndpZHRoID0gMTI4O1xuXHRjYW52YXMuaGVpZ2h0ID0gNjQ7XG5cblx0dGhpcy5jdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgICAgICB0aGlzLmN0eC5pbWFnZVNtb290aGluZ0VuYWJsZWQgPSBmYWxzZTtcblx0dGhpcy5jdHgubXNJbWFnZVNtb290aGluZ0VuYWJsZWQgPSBmYWxzZTtcblxuXHR0aGlzLmZiID0gdGhpcy5jcmVhdGVCdWZmZXIoKTtcblx0dGhpcy5mYk9OID0gdGhpcy5jcmVhdGVCdWZmZXIoKTtcblx0dGhpcy5mYk9GRiA9IHRoaXMuY3JlYXRlQnVmZmVyKCk7XG5cdHRoaXMuYWN0aXZlQnVmZmVyID0gdGhpcy5mYk9OO1xuXHR0aGlzLmRpcnR5ID0gdHJ1ZTtcblxuXHR0aGlzLmZiT04uZGF0YS5maWxsKDB4RkYpO1xuXG5cdERPTS5lbGVtZW50LmNvbnRyb2xsZXIgPSB0aGlzO1xuXHRET00uZWxlbWVudC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoXCJhZGRwZXJpZmVyYWxcIiwge2J1YmJsZXM6dHJ1ZX0pICk7XG5cdFxuXHR0aGlzLnNjay5jb25uZWN0ID0gRE9NLmVsZW1lbnQuZ2V0QXR0cmlidXRlKFwicGluLXNja1wiKTtcblx0dGhpcy5zZGEuY29ubmVjdCA9IERPTS5lbGVtZW50LmdldEF0dHJpYnV0ZShcInBpbi1zZGFcIik7XG5cdHRoaXMucmVzLmNvbm5lY3QgPSBET00uZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJwaW4tcmVzXCIpO1xuXHR0aGlzLmRjLmNvbm5lY3QgPSBET00uZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJwaW4tZGNcIik7XG5cblxuXHR0aGlzLnJlc2V0KCk7XG5cdFxuICAgIH1cblxuICAgIHNldEFjdGl2ZVZpZXcoKXtcblx0dGhpcy5wb29sLnJlbW92ZSh0aGlzKTtcbiAgICB9XG5cbiAgICBvblByZXNzS2V5Rigpe1xuXHR2YXIgZG9jRWwgPSB0aGlzLmNhbnZhczsgLy8gZG9jLmRvY3VtZW50RWxlbWVudDtcblx0XG5cdHRvZ2dsZUZ1bGxTY3JlZW4oKTtcblxuXHRyZXR1cm47XG5cblx0ZnVuY3Rpb24gaXNGdWxsU2NyZWVuKCl7XG5cdFx0dmFyIGRvYyA9IHdpbmRvdy5kb2N1bWVudDtcblx0XHRyZXR1cm4gZG9jLmZ1bGxzY3JlZW5FbGVtZW50IHx8IGRvYy5tb3pGdWxsU2NyZWVuRWxlbWVudCB8fCBkb2Mud2Via2l0RnVsbHNjcmVlbkVsZW1lbnQgfHwgZG9jLm1zRnVsbHNjcmVlbkVsZW1lbnQgfHwgZmFsc2U7XG5cdH1cblxuXHRmdW5jdGlvbiB0b2dnbGVGdWxsU2NyZWVuKHRvZ2dsZSkge1xuXHRcdHZhciBkb2MgPSB3aW5kb3cuZG9jdW1lbnQ7XG5cdCAgICAgICAgXG5cblx0XHR2YXIgcmVxdWVzdEZ1bGxTY3JlZW4gPSBkb2NFbC5yZXF1ZXN0RnVsbHNjcmVlbiB8fCBkb2NFbC5tb3pSZXF1ZXN0RnVsbFNjcmVlbiB8fCBkb2NFbC53ZWJraXRSZXF1ZXN0RnVsbFNjcmVlbiB8fCBkb2NFbC5tc1JlcXVlc3RGdWxsc2NyZWVuO1xuXHRcdHZhciBjYW5jZWxGdWxsU2NyZWVuID0gZG9jLmV4aXRGdWxsc2NyZWVuIHx8IGRvYy5tb3pDYW5jZWxGdWxsU2NyZWVuIHx8IGRvYy53ZWJraXRFeGl0RnVsbHNjcmVlbiB8fCBkb2MubXNFeGl0RnVsbHNjcmVlbjtcblx0XHR2YXIgc3RhdGUgPSBpc0Z1bGxTY3JlZW4oKTtcblxuXHRcdGlmKCB0b2dnbGUgPT0gdW5kZWZpbmVkICkgdG9nZ2xlID0gIXN0YXRlO1xuXHRcdGVsc2UgaWYoIHRvZ2dsZSA9PSBzdGF0ZSApIHJldHVybjtcblxuXHRcdGlmKCB0b2dnbGUgKSByZXF1ZXN0RnVsbFNjcmVlbi5jYWxsKGRvY0VsKTtcblx0XHRlbHNlIGNhbmNlbEZ1bGxTY3JlZW4uY2FsbChkb2MpO1xuXHR9XG4gICAgfVxuICAgIFxuICAgIFxuICAgIHRpY2soKXtcblx0aWYoIHRoaXMuZGlydHkgKXtcblx0ICAgIHRoaXMuY3R4LnB1dEltYWdlRGF0YSggdGhpcy5hY3RpdmVCdWZmZXIsIDAsIDAgKTtcblx0ICAgIHRoaXMuZGlydHkgPSBmYWxzZTtcblx0fVxuICAgIH1cblxuICAgIGNyZWF0ZUJ1ZmZlcigpe1xuXHRsZXQgY2FudmFzID0gdGhpcy5jYW52YXM7XG5cdHRyeXtcbiAgICAgICAgICAgIHJldHVybiBuZXcgSW1hZ2VEYXRhKFxuXHRcdG5ldyBVaW50OENsYW1wZWRBcnJheShjYW52YXMud2lkdGgqY2FudmFzLmhlaWdodCo0KSxcblx0XHRjYW52YXMud2lkdGgsXG5cdFx0Y2FudmFzLmhlaWdodFxuXHQgICAgKTtcblx0fWNhdGNoKGUpe1xuXHQgICAgcmV0dXJuIHRoaXMuY3R4LmNyZWF0ZUltYWdlRGF0YShjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuXHR9XG5cdFxuICAgIH1cblxuICAgIHJlc2V0KCl7XG5cdHRoaXMubW9kZSA9IDA7XG5cdHRoaXMuY2xvY2tEaXZpc29yID0gMHg4MDtcblx0dGhpcy5jbWQgPSBbXTtcblx0dGhpcy5wb3MgPSAwO1xuXHR0aGlzLmZiLmRhdGEuZmlsbCgwKTtcblx0dGhpcy5jb2xTdGFydCA9IDA7XG5cdHRoaXMuY29sRW5kID0gMTI3O1xuXHR0aGlzLnBhZ2VTdGFydCA9IDA7XG5cdHRoaXMucGFnZUVuZCA9IDc7XG5cdHRoaXMuY29sID0gMDtcblx0dGhpcy5wYWdlID0gMDtcbiAgICB9XG5cbiAgICBzdGF0ZSA9IGZ1bmN0aW9uKCBkYXRhICl7XG5cdC8vIGNvbnNvbGUubG9nKCBcIkRBVEE6IFwiICsgZGF0YS50b1N0cmluZygxNikgKTtcblx0bGV0IGNzID0gdGhpcy5jb2xTdGFydDtcblx0bGV0IGNlID0gdGhpcy5jb2xFbmQ7XG5cdGxldCBjZCA9IGNlIC0gY3M7XG5cdGxldCBwcyA9IHRoaXMucGFnZVN0YXJ0O1xuXHRsZXQgcGUgPSB0aGlzLnBhZ2VFbmQ7XG5cdGxldCBwZCA9IHBlIC0gcHM7XG5cdFxuXHRsZXQgeCA9IGNzICsgdGhpcy5jb2w7XG5cdGxldCB5ID0gKHBzICsgdGhpcy5wYWdlKSAqIDg7XG5cdFxuXHRmb3IoIGxldCBpPTA7IGk8ODsgKytpICl7XG5cdCAgICBsZXQgb2Zmc2V0ID0gKCh5K2kpKjEyOCArIHgpICogNDtcblx0ICAgIGxldCBiaXQgPSAoKGRhdGEgPj4+IGkpICYgMSkgKiAweEUwO1xuXHQgICAgdGhpcy5mYi5kYXRhWyBvZmZzZXQrKyBdID0gYml0O1xuXHQgICAgdGhpcy5mYi5kYXRhWyBvZmZzZXQrKyBdID0gYml0O1xuXHQgICAgdGhpcy5mYi5kYXRhWyBvZmZzZXQrKyBdID0gYml0O1xuXHQgICAgdGhpcy5mYi5kYXRhWyBvZmZzZXQrKyBdID0gYml0O1xuXHR9XG5cblx0dGhpcy5jb2wrKztcblx0aWYoIHRoaXMuY29sID4gY2QgKXtcblx0ICAgIHRoaXMuY29sID0gMDtcblx0ICAgIHRoaXMucGFnZSsrO1xuXHQgICAgaWYoIHRoaXMucGFnZSA+IHBkIClcblx0XHR0aGlzLnBhZ2UgPSAwO1xuXHR9XG5cblx0dGhpcy5kaXJ0eSA9IHRydWU7XG5cdFx0IFxuICAgIH1cblxuICAgIHNjayA9IHtcblx0Y29ubmVjdDpudWxsXG4gICAgfVxuXG4gICAgc2RhID0ge1xuXHRjb25uZWN0Om51bGwsXG5cdE1PU0k6ZnVuY3Rpb24oIGRhdGEgKXtcblxuXHQgICAgaWYoIHRoaXMubW9kZSA9PSAwICl7IC8vIGRhdGEgaXMgYSBjb21tYW5kXG5cdFx0bGV0IGNtZCA9IFwiY21kXCIgKyBkYXRhLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpO1xuXHRcdGlmKCB0aGlzLmNtZC5sZW5ndGggKXtcblx0XHQgICAgdGhpcy5jbWQucHVzaCggZGF0YSApO1xuXHRcdCAgICBjbWQgPSB0aGlzLmNtZFswXTtcblx0XHR9ZWxzZSB0aGlzLmNtZC5wdXNoKCBjbWQgKTtcblxuXHRcdGxldCBmbmMgPSB0aGlzW2NtZF07XG5cdFx0XG5cdFx0aWYoICFmbmMgKVxuXHRcdCAgICByZXR1cm4gY29uc29sZS53YXJuKFwiVW5rbm93biBTU0QxMzA2IGNvbW1hbmQ6IFwiICsgY21kLnRvU3RyaW5nKDE2KSk7XG5cdFx0XG5cdFx0aWYoIGZuYy5sZW5ndGggPT0gdGhpcy5jbWQubGVuZ3RoLTEgKXtcblx0XHQgICAgdGhpcy5jbWQuc2hpZnQoKTtcblx0XHQgICAgdGhpc1tjbWRdLmFwcGx5KCB0aGlzLCB0aGlzLmNtZCApO1xuXHRcdCAgICB0aGlzLmNtZC5sZW5ndGggPSAwO1xuXHRcdH1cblxuXHQgICAgfWVsc2V7XG5cdFx0dGhpcy5zdGF0ZSggZGF0YSApO1xuXHQgICAgfVxuXHR9XG4gICAgfVxuXG4gICAgcmVzID0ge1xuXHRjb25uZWN0Om51bGwsXG5cdG9uTG93VG9IaWdoOmZ1bmN0aW9uKCl7XG5cdCAgICB0aGlzLnJlc2V0KCk7XG5cdH1cbiAgICB9XG5cbiAgICBkYyA9IHtcblx0Y29ubmVjdDpudWxsLFxuXHRvbkxvd1RvSGlnaDpmdW5jdGlvbigpe1xuXHQgICAgdGhpcy5tb2RlID0gMTsgLy8gZGF0YVxuXHR9LFxuXHRvbkhpZ2hUb0xvdzpmdW5jdGlvbigpe1xuXHQgICAgdGhpcy5tb2RlID0gMDsgLy8gY29tbWFuZFxuXHR9IFxuICAgIH1cblxuXG5cbiAgICAvLyBEaXNwbGF5IE9mZlxuICAgIGNtZEFFKCl7XG5cdHRoaXMuYWN0aXZlQnVmZmVyID0gdGhpcy5mYk9GRjtcbiAgICB9XG5cbiAgICAvLyBTZXQgRGlzcGxheSBDbG9jayBEaXZpc29yIHYgPSAweEYwXG4gICAgY21kRDUoIHYgKXtcblx0dGhpcy5jbG9ja0Rpdmlzb3IgPSB2O1xuICAgIH1cblxuICAgIC8vIENoYXJnZSBQdW1wIFNldHRpbmcgdiA9IGVuYWJsZSAoMHgxNClcbiAgICBjbWQ4RCggdiApe1xuXHR0aGlzLmNoYXJnZVB1bXBFbmFibGVkID0gdjtcbiAgICB9XG5cbiAgICAvLyBTZXQgU2VnbWVudCBSZS1tYXAgKEEwKSB8IChiMDAwMSlcbiAgICBjbWRBMCgpeyB0aGlzLnNlZ21lbnRSZW1hcCA9IDA7IH1cbiAgICBjbWRBMSgpeyB0aGlzLnNlZ21lbnRSZW1hcCA9IDE7IH1cblxuICAgIGNtZEE1KCl7ICB9OyAvLyBtdWx0aXBsZXggc29tZXRoaW5nIG9yIG90aGVyXG5cbiAgICBjbWQwKCl7IHRoaXMuY29sU3RhcnQgPSB0aGlzLmNvbFN0YXJ0JjB4RjAgfCAwOyB9XG4gICAgY21kMSgpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHgxOyB9XG4gICAgY21kMigpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHgyOyB9XG4gICAgY21kMygpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHgzOyB9XG4gICAgY21kNCgpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHg0OyB9XG4gICAgY21kNSgpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHg1OyB9XG4gICAgY21kNigpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHg2OyB9XG4gICAgY21kNygpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHg3OyB9XG4gICAgY21kOCgpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHg4OyB9XG4gICAgY21kOSgpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHg5OyB9XG4gICAgY21kQSgpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHhBOyB9XG4gICAgY21kQigpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHhCOyB9XG4gICAgY21kQygpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHhDOyB9XG4gICAgY21kRCgpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHhEOyB9XG4gICAgY21kRSgpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHhFOyB9XG4gICAgY21kRigpeyB0aGlzLmNvbFN0YXJ0ID0gdGhpcy5jb2xTdGFydCYweEYwIHwgMHhGOyB9XG5cbiAgICBjbWQxMCgpeyB0aGlzLmNvbFN0YXJ0ID0gICAgICAgICAgICB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxMSgpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4MTw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxMigpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4Mjw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxMygpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4Mzw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxNCgpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4NDw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxNSgpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4NTw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxNigpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4Njw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxNygpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4Nzw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxOCgpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4ODw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxOSgpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4OTw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxQSgpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4QTw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxQigpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4Qjw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxQygpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4Qzw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxRCgpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4RDw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxRSgpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4RTw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cbiAgICBjbWQxRigpeyB0aGlzLmNvbFN0YXJ0ID0gKDB4Rjw8NCkgfCB0aGlzLmNvbFN0YXJ0JjB4MEY7IH1cblxuICAgIGNtZEIwKCl7IHRoaXMucGFnZSA9IDA7IH1cbiAgICBjbWRCMSgpeyB0aGlzLnBhZ2UgPSAxOyB9XG4gICAgY21kQjIoKXsgdGhpcy5wYWdlID0gMjsgfVxuICAgIGNtZEIzKCl7IHRoaXMucGFnZSA9IDM7IH1cbiAgICBjbWRCNCgpeyB0aGlzLnBhZ2UgPSA0OyB9XG4gICAgY21kQjUoKXsgdGhpcy5wYWdlID0gNTsgfVxuICAgIGNtZEI2KCl7IHRoaXMucGFnZSA9IDY7IH1cbiAgICBjbWRCNygpeyB0aGlzLnBhZ2UgPSA3OyB9XG5cbiAgICAvLyBTZXQgQ09NIE91dHB1dCBTY2FuIERpcmVjdGlvblxuICAgIGNtZEM4KCl7XG4gICAgfVxuXG4gIC8vIFNldCBDT00gUGlucyB2XG4gICAgY21kREEoIHYgKXtcbiAgICB9XG5cbiAgLy8gU2V0IENvbnRyYXN0IHYgPSAweENGXG4gICAgY21kODEoIHYgKXtcbiAgICB9XG5cbiAgLy8gU2V0IFByZWNoYXJnZSA9IDB4RjFcbiAgICBjbWREOSggdiApe1xuICAgIH1cblxuICAvLyBTZXQgVkNvbSBEZXRlY3RcbiAgICBjbWREQiggdiApe1xuICAgIH1cblxuICAvLyBFbnRpcmUgRGlzcGxheSBPTlxuICAgIGNtZEE0KCB2ICl7XG5cdHRoaXMuYWN0aXZlQnVmZmVyID0gdiA/IHRoaXMuZmJPTiA6IHRoaXMuZmI7XG4gICAgfVxuICAgIFxuICAvLyBTZXQgbm9ybWFsL2ludmVyc2UgZGlzcGxheVxuICAgIGNtZEE2KCB2ICl7XG4gICAgfVxuICAgIFxuICAvLyBEaXNwbGF5IE9uXG4gICAgY21kQUYoIHYgKXtcblx0dGhpcy5hY3RpdmVCdWZmZXIgPSB0aGlzLmZiO1xuICAgIH1cblxuICAvLyBzZXQgZGlzcGxheSBtb2RlID0gaG9yaXpvbnRhbCBhZGRyZXNzaW5nIG1vZGUgKDB4MDApXG4gICAgY21kMjAoIHYgKXtcbiAgICB9XG5cbiAgLy8gc2V0IGNvbCBhZGRyZXNzIHJhbmdlXG4gICAgY21kMjEoIHYsIGUgKXtcblx0dGhpcy5jb2xTdGFydCA9IHY7XG5cdHRoaXMuY29sRW5kICAgPSBlO1xuXHR0aGlzLmNvbCA9IDA7XG4gICAgfVxuXG4gIC8vIHNldCBwYWdlIGFkZHJlc3MgcmFuZ2VcbiAgICBjbWQyMiggdiwgZSApe1xuXHR0aGlzLnBhZ2VTdGFydCA9IHY7XG5cdHRoaXMucGFnZUVuZCAgID0gZTtcblx0dGhpcy5wYWdlID0gMDtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gU0NSRUVOO1xuIiwiaW1wb3J0IHsgSUNvbnRyb2xsZXIsIE1vZGVsLCBJVmlldyB9IGZyb20gJy4uL2xpYi9tdmMuanMnO1xuaW1wb3J0IHsgZ2V0UG9saWN5IH0gZnJvbSAnZHJ5LWRpJztcbmltcG9ydCBBdGNvcmUgZnJvbSAnLi4vYXRjb3JlL0F0Y29yZS5qcyc7XG5pbXBvcnQgSGV4IGZyb20gJy4uL2F0Y29yZS9IZXguanMnO1xuXG5jbGFzcyBBcmR1Ym95IHtcblxuICAgIHN0YXRpYyBcIkBpbmplY3RcIiA9IHtcbiAgICAgICAgcm9vdDogW01vZGVsLCB7c2NvcGU6XCJyb290XCJ9XSxcblx0cG9vbDpcInBvb2xcIlxuICAgIH1cblxuICAgIHRpY2sgPSBbXVxuXG4gICAgY29uc3RydWN0b3IoIERPTSApe1xuXG5cdHRoaXMucG9vbC5hZGQodGhpcyk7XG5cblx0dGhpcy5ET00gPSBET007XG5cdHRoaXMucGFyZW50ID0gRE9NLmVsZW1lbnQucGFyZW50RWxlbWVudDtcblx0dGhpcy53aWR0aCA9IDA7XG5cdHRoaXMuaGVpZ2h0ID0gMDtcblx0dGhpcy5kZWFkID0gZmFsc2U7XG5cblx0RE9NLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggXCJhZGRwZXJpZmVyYWxcIiwgZXZ0ID0+IHRoaXMuYWRkUGVyaWZlcmFsKCBldnQudGFyZ2V0LmNvbnRyb2xsZXIgKSApO1xuXG5cblx0dGhpcy5wZXJpZmVyYWxzID0gW107XG5cblx0dGhpcy51cGRhdGUgPSB0aGlzLl91cGRhdGUuYmluZCggdGhpcyApO1xuXHR0aGlzLnJlc2l6ZSgpO1xuXHRcblx0bGV0IHVybCA9IHRoaXMucm9vdC5nZXRJdGVtKFwiYXBwLkFUMzI4UC51cmxcIiwgbnVsbCk7XG5cdGlmKCB1cmwgKXtcblx0ICAgIFxuXHQgICAgdGhpcy5jb3JlID0gQXRjb3JlLkFUbWVnYTMyOFAoKTtcblx0ICAgIFxuXHQgICAgSGV4LnBhcnNlVVJMKCB1cmwsIHRoaXMuY29yZS5mbGFzaCwgKHN1Y2Nlc3MpID0+IHtcblx0XHRpZiggc3VjY2VzcyApXG5cdFx0ICAgIHRoaXMuaW5pdENvcmUoKTtcblx0ICAgIH0pO1xuXHQgICAgcmV0dXJuO1xuXHQgICAgXG5cdH1cblxuXHRsZXQgaGV4ID0gdGhpcy5yb290LmdldEl0ZW0oXCJhcHAuQVQzMjhQLmhleFwiLCBudWxsKTtcblx0aWYoIGhleCApe1xuXHRcdFxuXHQgICAgdGhpcy5jb3JlID0gQXRjb3JlLkFUbWVnYTMyOFAoKTtcblx0ICAgIEhleC5wYXJzZSggaGV4LCB0aGlzLmNvcmUuZmxhc2ggKTtcblx0ICAgIHRoaXMuaW5pdENvcmUoKTtcblx0ICAgIHJldHVybjtcblx0ICAgIFxuXHR9XG5cdCAgICBcblx0dXJsID0gdGhpcy5yb290LmdldEl0ZW0oXCJhcHAuQVQzMnU0LnVybFwiLCBudWxsKTtcblx0aWYoIHVybCApe1xuXG5cdCAgICB0aGlzLmNvcmUgPSBBdGNvcmUuQVRtZWdhMzJ1NCgpO1xuXHQgICAgSGV4LnBhcnNlVVJMKCB1cmwsIHRoaXMuY29yZS5mbGFzaCwgc3VjY2VzcyA9PiB7XG5cdFx0aWYoIHN1Y2Nlc3MgKSB0aGlzLmluaXRDb3JlKCk7XG5cdCAgICB9KTtcblx0ICAgIHJldHVybjtcblx0ICAgIFxuXHR9XG5cblx0aGV4ID0gdGhpcy5yb290LmdldEl0ZW0oXCJhcHAuQVQzMnU0LmhleFwiLCBudWxsKTtcblx0aWYoIGhleCApe1xuXHQgICAgXG5cdCAgICB0aGlzLmNvcmUgPSBBdGNvcmUuQVRtZWdhMzJ1NCgpO1xuXHQgICAgSGV4LnBhcnNlKCBoZXgsIHRoaXMuY29yZS5mbGFzaCApO1xuXHQgICAgdGhpcy5pbml0Q29yZSgpO1xuXHQgICAgcmV0dXJuO1xuXHQgICAgXG5cdH1cblxuXHRjb25zb2xlLmVycm9yKFwiTm90aGluZyB0byBsb2FkXCIpO1xuICAgIH1cblxuICAgIG9uUHJlc3NFc2NhcGUoKXtcblx0dGhpcy5wb3dlck9mZigpO1xuICAgIH1cblxuICAgIHNldEFjdGl2ZVZpZXcoKXtcblx0dGhpcy5wb29sLnJlbW92ZSh0aGlzKTtcbiAgICB9XG5cbiAgICBwb3dlck9mZigpe1xuXHR0aGlzLnBvb2wucmVtb3ZlKHRoaXMpO1xuXHR0aGlzLmRlYWQgPSB0cnVlO1xuXHR0aGlzLkRPTS5lbGVtZW50LmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudChcInBvd2Vyb2ZmXCIsIHtidWJibGVzOnRydWV9KSApO1xuICAgIH1cblxuICAgIGluaXRDb3JlKCl7XG5cdGxldCBjb3JlID0gdGhpcy5jb3JlLCBvbGRWYWx1ZXMgPSB7fSwgRERSQiwgc2VyaWFsMEJ1ZmZlciA9IFwiXCIsIGNhbGxiYWNrcyA9IHtcbiAgICAgICAgICAgIEREUkI6e30sXG4gICAgICAgICAgICBERFJDOnt9LFxuICAgICAgICAgICAgRERSRDp7fSxcbiAgICAgICAgICAgIFBPUlRCOnt9LFxuICAgICAgICAgICAgUE9SVEM6e30sXG4gICAgICAgICAgICBQT1JURDp7fSxcbiAgICAgICAgICAgIFBPUlRFOnt9LFxuICAgICAgICAgICAgUE9SVEY6e31cblx0fTtcblxuXHRPYmplY3Qua2V5cyhjYWxsYmFja3MpLmZvckVhY2goIGsgPT5cblx0XHRcdFx0XHRPYmplY3QuYXNzaWduKGNhbGxiYWNrc1trXSx7XG5cdFx0XHRcdFx0ICAgIG9uSGlnaFRvTG93OltdLCBcblx0XHRcdFx0XHQgICAgb25Mb3dUb0hpZ2g6W11cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHQgICAgICApO1xuXG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKCBjb3JlLnBpbnMsIHtcblxuICAgICAgICAgICAgb25IaWdoVG9Mb3c6e3ZhbHVlOmZ1bmN0aW9uKCBwb3J0LCBiaXQsIGNiICl7XG5cdFx0KGNhbGxiYWNrc1sgcG9ydCBdLm9uSGlnaFRvTG93WyBiaXQgXSA9IGNhbGxiYWNrc1sgcG9ydCBdWyBiaXQgXSB8fCBbXSkucHVzaCggY2IgKTtcbiAgICAgICAgICAgIH19LFxuXG4gICAgICAgICAgICBvbkxvd1RvSGlnaDp7dmFsdWU6ZnVuY3Rpb24oIHBvcnQsIGJpdCwgY2IgKXtcblx0XHQoY2FsbGJhY2tzWyBwb3J0IF0ub25Mb3dUb0hpZ2hbIGJpdCBdID0gY2FsbGJhY2tzWyBwb3J0IF1bIGJpdCBdIHx8IFtdKS5wdXNoKCBjYiApO1xuICAgICAgICAgICAgfX0sXG5cbiAgICAgICAgICAgIDA6e3ZhbHVlOnsgb3V0Ontwb3J0OlwiUE9SVERcIiwgYml0OjIgfSwgaW46e3BvcnQ6XCJQSU5EXCIsIGJpdDoyfSB9IH0sXG4gICAgICAgICAgICAxOnt2YWx1ZTp7IG91dDp7cG9ydDpcIlBPUlREXCIsIGJpdDozIH0sIGluOntwb3J0OlwiUElORFwiLCBiaXQ6M30gfSB9LFxuICAgICAgICAgICAgMjp7dmFsdWU6eyBvdXQ6e3BvcnQ6XCJQT1JURFwiLCBiaXQ6MSB9LCBpbjp7cG9ydDpcIlBJTkRcIiwgYml0OjF9IH0gfSxcbiAgICAgICAgICAgIDM6e3ZhbHVlOnsgb3V0Ontwb3J0OlwiUE9SVERcIiwgYml0OjAgfSwgaW46e3BvcnQ6XCJQSU5EXCIsIGJpdDowfSB9IH0sXG4gICAgICAgICAgICA0Ont2YWx1ZTp7IG91dDp7cG9ydDpcIlBPUlREXCIsIGJpdDo0IH0sIGluOntwb3J0OlwiUElORFwiLCBiaXQ6NH0gfSB9LFxuICAgICAgICAgICAgNTp7dmFsdWU6eyBvdXQ6e3BvcnQ6XCJQT1JUQ1wiLCBiaXQ6NiB9LCBpbjp7cG9ydDpcIlBJTkNcIiwgYml0OjZ9IH0gfSxcbiAgICAgICAgICAgIDY6e3ZhbHVlOnsgb3V0Ontwb3J0OlwiUE9SVERcIiwgYml0OjcgfSwgaW46e3BvcnQ6XCJQSU5EXCIsIGJpdDo3fSB9IH0sXG4gICAgICAgICAgICA3Ont2YWx1ZTp7IG91dDp7cG9ydDpcIlBPUlRFXCIsIGJpdDo2IH0sIGluOntwb3J0OlwiUElORVwiLCBiaXQ6Nn0gfSB9LFxuICAgICAgICAgICAgODp7dmFsdWU6eyBvdXQ6e3BvcnQ6XCJQT1JUQlwiLCBiaXQ6NCB9LCBpbjp7cG9ydDpcIlBJTkJcIiwgYml0OjR9IH0gfSxcbiAgICAgICAgICAgIDk6e3ZhbHVlOnsgb3V0Ontwb3J0OlwiUE9SVEJcIiwgYml0OjUgfSwgaW46e3BvcnQ6XCJQSU5CXCIsIGJpdDo1fSB9IH0sXG4gICAgICAgICAgICAxMDp7dmFsdWU6eyBvdXQ6e3BvcnQ6XCJQT1JUQlwiLCBiaXQ6NiB9LCBpbjp7cG9ydDpcIlBJTkJcIiwgYml0OjZ9IH0gfSxcbiAgICAgICAgICAgIDExOnt2YWx1ZTp7IG91dDp7cG9ydDpcIlBPUlRCXCIsIGJpdDo3IH0sIGluOntwb3J0OlwiUElOQlwiLCBiaXQ6N30gfSB9LFxuXG5cdCAgICAxNjp7dmFsdWU6eyBvdXQ6e3BvcnQ6XCJQT1JUQlwiLCBiaXQ6MiB9LCBpbjp7cG9ydDpcIlBJTkJcIiwgYml0OjJ9IH0gfSxcbiAgICAgICAgICAgIDE0Ont2YWx1ZTp7IG91dDp7cG9ydDpcIlBPUlRCXCIsIGJpdDozIH0sIGluOntwb3J0OlwiUElOQlwiLCBiaXQ6M30gfSB9LFxuICAgICAgICAgICAgMTU6e3ZhbHVlOnsgb3V0Ontwb3J0OlwiUE9SVEJcIiwgYml0OjEgfSwgaW46e3BvcnQ6XCJQSU5CXCIsIGJpdDoxfSB9IH0sXG4gICAgICAgICAgICAxNzp7dmFsdWU6eyBvdXQ6e3BvcnQ6XCJQT1JUQlwiLCBiaXQ6MCB9LCBpbjp7cG9ydDpcIlBJTkJcIiwgYml0OjB9IH0gfSxcblxuICAgICAgICAgICAgMTg6e3ZhbHVlOnsgb3V0Ontwb3J0OlwiUE9SVEZcIiwgYml0OjcgfSwgaW46e3BvcnQ6XCJQSU5GXCIsIGJpdDo3fSB9IH0sXG4gICAgICAgICAgICBBMDp7dmFsdWU6eyBvdXQ6e3BvcnQ6XCJQT1JURlwiLCBiaXQ6NyB9LCBpbjp7cG9ydDpcIlBJTkZcIiwgYml0Ojd9IH0gfSxcbiAgICAgICAgICAgIDE5Ont2YWx1ZTp7IG91dDp7cG9ydDpcIlBPUlRGXCIsIGJpdDo2IH0sIGluOntwb3J0OlwiUElORlwiLCBiaXQ6Nn0gfSB9LFxuICAgICAgICAgICAgQTE6e3ZhbHVlOnsgb3V0Ontwb3J0OlwiUE9SVEZcIiwgYml0OjYgfSwgaW46e3BvcnQ6XCJQSU5GXCIsIGJpdDo2fSB9IH0sXG4gICAgICAgICAgICAyMDp7dmFsdWU6eyBvdXQ6e3BvcnQ6XCJQT1JURlwiLCBiaXQ6NSB9LCBpbjp7cG9ydDpcIlBJTkZcIiwgYml0OjV9IH0gfSxcbiAgICAgICAgICAgIEEyOnt2YWx1ZTp7IG91dDp7cG9ydDpcIlBPUlRGXCIsIGJpdDo1IH0sIGluOntwb3J0OlwiUElORlwiLCBiaXQ6NX0gfSB9LFxuICAgICAgICAgICAgMjE6e3ZhbHVlOnsgb3V0Ontwb3J0OlwiUE9SVEZcIiwgYml0OjQgfSwgaW46e3BvcnQ6XCJQSU5GXCIsIGJpdDo0fSB9IH0sXG4gICAgICAgICAgICBBMzp7dmFsdWU6eyBvdXQ6e3BvcnQ6XCJQT1JURlwiLCBiaXQ6NCB9LCBpbjp7cG9ydDpcIlBJTkZcIiwgYml0OjR9IH0gfSxcblx0ICAgIFxuXHQgICAgTU9TSTp7dmFsdWU6e319LFxuXHQgICAgTUlTTzp7dmFsdWU6e319LFxuXG5cdCAgICBzcGlJbjp7XG5cdFx0dmFsdWU6W11cblx0ICAgIH0sXG5cdCAgICBcblx0ICAgIHNwaU91dDp7XG5cdFx0dmFsdWU6e1xuXHRcdCAgICBsaXN0ZW5lcnM6W10sXG5cdFx0ICAgIHB1c2goIGRhdGEgKXtcblx0XHRcdGxldCBpPTAsIGxpc3RlbmVycz10aGlzLmxpc3RlbmVycywgbD1saXN0ZW5lcnMubGVuZ3RoO1xuXHRcdFx0Zm9yKDtpPGw7KytpKVxuXHRcdFx0ICAgIGxpc3RlbmVyc1tpXSggZGF0YSApO1xuXHRcdCAgICB9XG5cdFx0fVxuXHQgICAgfSxcblx0ICAgIFxuICAgICAgICAgICAgc2VyaWFsMDp7XG5cdFx0c2V0OmZ1bmN0aW9uKCBzdHIgKXtcbiAgICAgICAgICAgICAgICAgICAgc3RyID0gKHN0ciB8fCBcIlwiKS5yZXBsYWNlKC9cXHJcXG4/LywnXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIHNlcmlhbDBCdWZmZXIgKz0gc3RyO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciBiciA9IHNlcmlhbDBCdWZmZXIuaW5kZXhPZihcIlxcblwiKTtcbiAgICAgICAgICAgICAgICAgICAgaWYoIGJyICE9IC0xICl7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwYXJ0cyA9IHNlcmlhbDBCdWZmZXIuc3BsaXQoXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSggcGFydHMubGVuZ3RoPjEgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCAnU0VSSUFMOiAnLCBwYXJ0cy5zaGlmdCgpICk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmlhbDBCdWZmZXIgPSBwYXJ0c1swXTtcblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuXHRcdH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIEREUkI6IHtcblx0XHRzZXQ6IHNldEREUi5iaW5kKG51bGwsIFwiRERSQlwiKSxcblx0XHRnZXQ6ZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9sZFZhbHVlcy5ERFJCfDA7XG5cdFx0fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEREUkM6IHtcblx0XHRzZXQ6IHNldEREUi5iaW5kKG51bGwsIFwiRERSQ1wiKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBERFJEOiB7XG5cdFx0c2V0OiBzZXRERFIuYmluZChudWxsLCBcIkREUkRcIiksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRERSRToge1xuXHRcdHNldDogc2V0RERSLmJpbmQobnVsbCwgXCJERFJEXCIpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEREUkY6IHtcblx0XHRzZXQ6IHNldEREUi5iaW5kKG51bGwsIFwiRERSRFwiKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBQT1JUQjoge1xuXHRcdHNldDogc2V0UG9ydC5iaW5kKG51bGwsIFwiUE9SVEJcIilcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBQT1JUQzoge1xuXHRcdHNldDogc2V0UG9ydC5iaW5kKG51bGwsIFwiUE9SVENcIilcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBQT1JURDoge1xuXHRcdHNldDogc2V0UG9ydC5iaW5kKG51bGwsIFwiUE9SVERcIilcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBQT1JURToge1xuXHRcdHNldDogc2V0UG9ydC5iaW5kKG51bGwsIFwiUE9SVEVcIilcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBQT1JURjoge1xuXHRcdHNldDogc2V0UG9ydC5iaW5kKG51bGwsIFwiUE9SVEZcIilcbiAgICAgICAgICAgIH1cblxuXHR9KTtcblxuXHRzZXRUaW1lb3V0KCBfID0+IHtcblx0ICAgIHRoaXMuc2V0dXBQZXJpZmVyYWxzKCk7XG5cdCAgICB0aGlzLl91cGRhdGUoKTtcblx0fSwgNSk7XG5cblx0ZnVuY3Rpb24gc2V0RERSKCBuYW1lLCBjdXIgKXsgICBcbiAgICAgICAgICAgIHZhciBvbGQgPSBvbGRWYWx1ZXNbbmFtZV07ICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIGlmKCBvbGQgPT09IGN1ciApIHJldHVybjtcbiAgICAgICAgICAgIG9sZFZhbHVlc1tuYW1lXSA9IGN1cjtcblx0fVxuXG5cdGZ1bmN0aW9uIHNldFBvcnQoIG5hbWUsIGN1ciApe1xuICAgICAgICAgICAgdmFyIG9sZCA9IG9sZFZhbHVlc1tuYW1lXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYoIG9sZCA9PT0gY3VyICkgcmV0dXJuO1xuICAgICAgICAgICAgdmFyIHMsIGosIGwsIGx0aCA9IGNhbGxiYWNrc1tuYW1lXS5vbkxvd1RvSGlnaCwgaHRsID0gY2FsbGJhY2tzW25hbWVdLm9uSGlnaFRvTG93LCB0aWNrID0gY29yZS50aWNrO1xuXG4gICAgICAgICAgICBmb3IoIHZhciBpPTA7IGk8ODsgKytpICl7XG5cblx0XHR2YXIgb2IgPSBvbGQ+Pj5pJjEsIG5iID0gY3VyPj4+aSYxO1xuXHRcdGlmKCBsdGhbaV0gJiYgIW9iICYmIG5iICl7XG4gICAgICAgICAgICAgICAgICAgIGZvciggaj0wLCBzPWx0aFtpXSwgbD1zLmxlbmd0aDsgajxsOyArK2ogKVxuXHRcdFx0c1tqXSggdGljayApO1xuXHRcdH1cblx0XHRpZiggaHRsW2ldICYmIG9iICYmICFuYiApe1xuICAgICAgICAgICAgICAgICAgICBmb3IoIGo9MCwgcz1odGxbaV0sIGw9cy5sZW5ndGg7IGo8bDsgKytqIClcblx0XHRcdHNbal0oIHRpY2sgKTtcblx0XHR9XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb2xkVmFsdWVzW25hbWVdID0gY3VyO1xuXG5cdH1cbiAgICB9XG5cbiAgICBcblxuICAgIGFkZFBlcmlmZXJhbCggY3RybCApe1xuXHRcblx0dGhpcy5wZXJpZmVyYWxzLnB1c2goIGN0cmwgKTtcblx0XG4gICAgfVxuXG4gICAgc2V0dXBQZXJpZmVyYWxzKCl7XG5cdGxldCBwaW5zID0gdGhpcy5jb3JlLnBpbnM7XG5cdGxldCBtYXAgPSB7IGNwdTp0aGlzLmNvcmUucGlucyB9O1xuXHRcblx0dGhpcy5wZXJpZmVyYWxzLmZvckVhY2goIGN0cmwgPT4ge1xuXG5cdCAgICBpZiggY3RybC50aWNrIClcblx0XHR0aGlzLnRpY2sucHVzaCggY3RybCApO1xuXHQgICAgXG5cdCAgICBmb3IoIGxldCBrIGluIGN0cmwgKXtcblxuXHRcdGxldCB2ID0gY3RybFtrXTtcblx0XHRpZiggIXYgfHwgIXYuY29ubmVjdCApIGNvbnRpbnVlO1xuXG5cdFx0bGV0IHRhcmdldCA9IHYuY29ubmVjdDtcblx0XHRpZih0eXBlb2YgdGFyZ2V0ID09IFwibnVtYmVyXCIgKVxuXHRcdCAgICB0YXJnZXQgPSBcImNwdS5cIiArIHRhcmdldDtcblxuXHRcdGxldCB0b2JqID0gbWFwO1xuXHRcdGxldCB0cGFydHMgPSB0YXJnZXQuc3BsaXQoXCIuXCIpO1xuXHRcdHdoaWxlKCB0cGFydHMubGVuZ3RoICYmIHRvYmogKVxuXHRcdCAgICB0b2JqID0gdG9ialsgdHBhcnRzLnNoaWZ0KCkgXTtcblxuXHRcdGlmKCB2Lk1PU0kgKVxuXHRcdCAgICBwaW5zLnNwaU91dC5saXN0ZW5lcnMucHVzaCggdi5NT1NJLmJpbmQoIGN0cmwgKSApO1xuXG5cdFx0aWYoICF0b2JqICl7XG5cdFx0ICAgIGNvbnNvbGUud2FybihcIkNvdWxkIG5vdCBhdHRhY2ggd2lyZSBmcm9tIFwiLCBrLCBcIiB0byBcIiwgdGFyZ2V0KTtcblx0XHQgICAgY29udGludWU7XG5cdFx0fVxuXG5cdFx0aWYoIHYub25Mb3dUb0hpZ2ggKVxuXHRcdCAgICBwaW5zLm9uTG93VG9IaWdoKCB0b2JqLm91dC5wb3J0LCB0b2JqLm91dC5iaXQsIHYub25Mb3dUb0hpZ2guYmluZCggY3RybCApICk7XG5cdFx0XG5cdFx0aWYoIHYub25IaWdoVG9Mb3cgKVxuXHRcdCAgICBwaW5zLm9uSGlnaFRvTG93KCB0b2JqLm91dC5wb3J0LCB0b2JqLm91dC5iaXQsIHYub25IaWdoVG9Mb3cuYmluZCggY3RybCApICk7XG5cblxuXHRcdGxldCBzZXR0ZXIgPSAoZnVuY3Rpb24oIHRvYmosIG52ICl7XG5cdFx0ICAgIFxuXHRcdCAgICBpZiggbnYgKSBwaW5zWyB0b2JqLmluLnBvcnQgXSB8PSAxIDw8IHRvYmouaW4uYml0O1xuXHRcdCAgICBlbHNlIHBpbnNbIHRvYmouaW4ucG9ydCBdICY9IH4oMSA8PCB0b2JqLmluLmJpdCk7XG5cdFx0ICAgIFxuXHRcdH0pLmJpbmQodGhpcywgdG9iaik7XG5cblx0XHRsZXQgZ2V0dGVyID0gKGZ1bmN0aW9uKCB0b2JqICl7XG5cdFx0ICAgIHJldHVybiAocGluc1sgdG9iai5vdXQucG9ydCBdID4+PiB0b2JqLm91dC5iaXQpICYgMTtcblx0XHR9KS5iaW5kKHRoaXMsIHRvYmopO1xuXG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHYsIFwidmFsdWVcIiwge1xuXHRcdCAgICBzZXQ6c2V0dGVyLFxuXHRcdCAgICBnZXQ6Z2V0dGVyXG5cdFx0fSk7XG5cblx0XHRpZiggdi5pbml0IClcblx0XHQgICAgdi5pbml0LmNhbGwoIGN0cmwgKTtcblxuXHQgICAgfVxuXHQgICAgXG5cdH0pO1xuXHRcbiAgICB9XG5cbiAgICBfdXBkYXRlKCl7XG5cdGlmKCB0aGlzLmRlYWQgKSByZXR1cm47XG5cdFxuXHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIHRoaXMudXBkYXRlICk7XG5cdHRoaXMuY29yZS51cGRhdGUoKTtcblx0dGhpcy5yZXNpemUoKTtcblx0Zm9yKCBsZXQgaT0wLCBsPXRoaXMudGljay5sZW5ndGg7IGk8bDsgKytpIClcblx0ICAgIHRoaXMudGlja1tpXS50aWNrKCk7XG4gICAgfVxuXG4gICAgcmVzaXplKCl7XG5cdFxuXHRsZXQgbWF4SGVpZ2h0ID0gdGhpcy5wYXJlbnQuY2xpZW50SGVpZ2h0O1xuXHRsZXQgbWF4V2lkdGggID0gdGhpcy5wYXJlbnQuY2xpZW50V2lkdGg7XG5cblx0aWYoIHRoaXMud2lkdGggPT0gbWF4V2lkdGggJiYgdGhpcy5oZWlnaHQgPT0gbWF4SGVpZ2h0IClcblx0ICAgIHJldHVybjtcblx0XG5cdHRoaXMud2lkdGggPSBtYXhXaWR0aDtcblx0dGhpcy5oZWlnaHQgPSBtYXhIZWlnaHQ7XG5cblx0bGV0IHJhdGlvID0gMzkzIC8gNjI0O1xuXG5cdGlmKCB0aGlzLmhlaWdodCAqIHJhdGlvID4gdGhpcy53aWR0aCApe1xuXHQgICAgdGhpcy5ET00uZWxlbWVudC5zdHlsZS53aWR0aCA9IHRoaXMud2lkdGggKyBcInB4XCI7XG5cdCAgICB0aGlzLkRPTS5lbGVtZW50LnN0eWxlLmhlaWdodCA9ICh0aGlzLndpZHRoIC8gcmF0aW8pICsgXCJweFwiO1xuXHR9ZWxzZXtcblx0ICAgIHRoaXMuRE9NLmVsZW1lbnQuc3R5bGUud2lkdGggPSAodGhpcy5oZWlnaHQgKiByYXRpbykgKyBcInB4XCI7XG5cdCAgICB0aGlzLkRPTS5lbGVtZW50LnN0eWxlLmhlaWdodCA9IHRoaXMuaGVpZ2h0ICsgXCJweFwiO1xuXHR9XG5cdFxuICAgIH1cbiAgICBcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBBcmR1Ym95O1xuIiwiY2xhc3MgQ29uZmlne1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKCBET00gKXtcclxuICAgICAgICBET00uZWxlbWVudC5pbm5lckhUTUwgPSBcIkMgTyBOIEYgSSBHXCI7XHJcbiAgICB9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENvbmZpZzsiLCJjbGFzcyBGaWxlc3tcclxuXHJcbiAgICBjb25zdHJ1Y3RvciggRE9NICl7XHJcbiAgICAgICAgRE9NLmVsZW1lbnQuaW5uZXJIVE1MID0gXCJDIE8gTiBGIEkgR1wiO1xyXG4gICAgfVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBGaWxlczsiLCJpbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uL2xpYi9tdmMuanMnO1xuXG5jbGFzcyBNYXJrZXR7XG5cbiAgICBzdGF0aWMgXCJAaW5qZWN0XCIgPSB7XG4gICAgICAgIHJvb3Q6IFtNb2RlbCwge3Njb3BlOlwicm9vdFwifV1cbiAgICB9XG5cbiAgICBjb25zdHJ1Y3RvciggRE9NICl7XG4gICAgfVxuXG4gICAgcnVuKCl7XG4gICAgICAgIHRoaXMucG9vbC5jYWxsKFwicnVuU2ltXCIpO1xuICAgIH1cbiAgICBcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBNYXJrZXQ7XG4iLCJpbXBvcnQgSVN0b3JlIGZyb20gJy4uL3N0b3JlL0lTdG9yZS5qcyc7XHJcbmltcG9ydCB7IElDb250cm9sbGVyLCBNb2RlbCwgSVZpZXcgfSBmcm9tICcuLi9saWIvbXZjLmpzJztcclxuaW1wb3J0IEpTWmlwIGZyb20gJ2pzemlwL2Rpc3QvanN6aXAubWluLmpzJztcclxuXHJcbmNsYXNzIEVudiBleHRlbmRzIElDb250cm9sbGVyIHtcclxuXHJcbiAgICBzdGF0aWMgXCJAaW5qZWN0XCIgPSB7XHJcbiAgICAgICAgc3RvcmU6SVN0b3JlLFxyXG4gICAgICAgIHBvb2w6XCJwb29sXCIsXHJcbiAgICAgICAgdmlld0ZhY3Rvcnk6W0lWaWV3LCB7Y29udHJvbGxlcjpFbnZ9XSxcclxuICAgICAgICBtb2RlbDogW01vZGVsLCB7c2NvcGU6XCJyb290XCJ9XVxyXG4gICAgfVxyXG5cclxuICAgIGV4aXRTcGxhc2goKXtcclxuXHQvKiAqL1xyXG4gICAgICAgIHRoaXMuX3Nob3coKTtcclxuXHQvKi9cclxuXHR0aGlzLm1vZGVsLnNldEl0ZW0oXCJhcHAuQVQzMnU0LnVybFwiLCBcIkhlbGxvV29ybGQzMnU0LmhleFwiKTtcclxuXHR0aGlzLnBvb2wuY2FsbChcInJ1blNpbVwiKTtcclxuXHQvKiAqL1x0XHJcbiAgICB9XHJcblxyXG4gICAgZXhpdFNpbSgpe1xyXG5cdHRoaXMuX3Nob3coKTtcclxuICAgIH1cclxuXHJcbiAgICBvbkRyb3BGaWxlKCBkb20sIGV2ZW50ICl7XHJcblx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcblxyXG5cdHZhciBkdCA9IGV2ZW50LmRhdGFUcmFuc2ZlcjtcclxuXHR2YXIgZmlsZXMgPSBkdC5maWxlcztcclxuXHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xyXG5cdCAgICBsZXQgZmlsZSA9IGZpbGVzW2ldO1xyXG5cdCAgICBpZiggLy4qXFwuYXJkdWJveSR8LipcXC5oZXgkL2kudGVzdChmaWxlLm5hbWUpIClcclxuXHRcdHJldHVybiBsb2FkRmlsZS5jYWxsKCB0aGlzLCBmaWxlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBsb2FkRmlsZSggZmlsZSApe1xyXG5cdCAgICBsZXQgZnIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG5cdCAgICBmci5vbmxvYWQgPSBldnQgPT4ge1xyXG5cdFx0dGhpcy5tb2RlbC5yZW1vdmVJdGVtKFwiYXBwLkFUMzJ1NFwiKTtcclxuXHRcdHRoaXMubW9kZWwuc2V0SXRlbShcImFwcC5BVDMydTQuaGV4XCIsIGZyLnJlc3VsdCk7XHJcblx0XHR0aGlzLnBvb2wuY2FsbChcInJ1blNpbVwiKTtcclxuXHQgICAgfTtcclxuXHQgICAgZnIucmVhZEFzVGV4dChmaWxlKTtcclxuXHR9XHJcblx0XHJcbiAgICB9XHJcblxyXG4gICAgcGxheSggb3B0ICl7XHJcblx0XHJcblx0bGV0IHVybCA9IG9wdC5lbGVtZW50LmRhdGFzZXQudXJsO1xyXG5cdFxyXG5cdHRoaXMubW9kZWwucmVtb3ZlSXRlbShcImFwcC5BVDMydTRcIik7XHJcblx0XHJcblx0aWYoIC9cXC5hcmR1Ym95JC9pLnRlc3QodXJsKSApe1xyXG5cdCAgICBcclxuXHQgICAgbGV0IHppcCA9IG51bGw7XHJcblx0ICAgIGZldGNoKCB0aGlzLm1vZGVsLmdldEl0ZW0oXCJhcHAucHJveHlcIikgKyB1cmwgKVxyXG5cdFx0LnRoZW4oIHJzcCA9PiByc3AuYXJyYXlCdWZmZXIoKSApXHJcblx0XHQudGhlbiggYnVmZiA9PiBKU1ppcC5sb2FkQXN5bmMoIGJ1ZmYgKSApXHJcblx0XHQudGhlbiggeiA9PiAoemlwPXopLmZpbGUoXCJpbmZvLmpzb25cIikuYXN5bmMoXCJ0ZXh0XCIpIClcclxuXHRcdC50aGVuKCBpbmZvID0+IHppcC5maWxlKCBKU09OLnBhcnNlKCBmaXhKU09OKGluZm8pICkuYmluYXJpZXNbMF0uZmlsZW5hbWUpLmFzeW5jKFwidGV4dFwiKSApXHJcblx0XHQudGhlbiggaGV4ID0+IHtcclxuXHRcdCAgICB0aGlzLm1vZGVsLnNldEl0ZW0oXCJhcHAuQVQzMnU0LmhleFwiLCBoZXgpO1xyXG5cdFx0ICAgIHRoaXMucG9vbC5jYWxsKFwicnVuU2ltXCIpO1xyXG5cdFx0fSlcclxuXHRcdC5jYXRjaCggZXJyID0+IHtcclxuXHRcdCAgICBjb25zb2xlLmVycm9yKCBlcnIgKTtcclxuXHRcdH0pO1xyXG5cclxuXHR9ZWxzZXtcclxuXHQgICAgdGhpcy5tb2RlbC5zZXRJdGVtKFwiYXBwLkFUMzJ1NC51cmxcIiwgdGhpcy5tb2RlbC5nZXRJdGVtKFwiYXBwLnByb3h5XCIpICsgdXJsICk7XHJcblx0ICAgIHRoaXMucG9vbC5jYWxsKFwicnVuU2ltXCIpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZml4SlNPTiggc3RyICl7XHJcblx0ICAgIFxyXG5cdCAgICBpZiggc3RyLmNoYXJDb2RlQXQoMCkgPT0gMHhGRUZGIClcclxuXHRcdHN0ciA9IHN0ci5zdWJzdHIoMSk7XHJcblx0ICAgIFxyXG5cdCAgICByZXR1cm4gc3RyLnJlcGxhY2UoL1xcLCg/IVxccyo/W1xce1xcW1xcXCJcXCdcXHddKS9nLCAnJyk7XHJcblx0ICAgIFxyXG5cdH1cclxuICAgIH1cclxuXHJcbn1cclxuXHJcblxyXG5leHBvcnQgZGVmYXVsdCBFbnY7XHJcbiIsImltcG9ydCB7IElDb250cm9sbGVyLCBNb2RlbCwgSVZpZXcgfSBmcm9tICcuLi9saWIvbXZjLmpzJztcblxuY2xhc3MgU2ltIGV4dGVuZHMgSUNvbnRyb2xsZXIge1xuXG4gICAgc3RhdGljIFwiQGluamVjdFwiID0ge1xuICAgICAgICBwb29sOlwicG9vbFwiLFxuICAgICAgICB2aWV3RmFjdG9yeTpbSVZpZXcsIHtjb250cm9sbGVyOlNpbX1dLFxuICAgICAgICBtb2RlbDogW01vZGVsLCB7c2NvcGU6XCJyb290XCJ9XVxuICAgIH1cblxuICAgIHJ1blNpbSgpe1xuICAgICAgICB0aGlzLl9zaG93KCk7XG4gICAgfVxuXG4gICAgb25FbmRTaW0oKXtcblx0dGhpcy5wb29sLmNhbGwoXCJleGl0U2ltXCIpO1xuICAgIH1cblxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IFNpbTtcbiIsIi8vIGltcG9ydCBJU3RvcmUgZnJvbSAnLi4vc3RvcmUvSVN0b3JlLmpzJztcclxuaW1wb3J0IHsgSUNvbnRyb2xsZXIsIElWaWV3IH0gZnJvbSAnLi4vbGliL212Yy5qcyc7XHJcblxyXG5cclxuY2xhc3MgU3BsYXNoIGV4dGVuZHMgSUNvbnRyb2xsZXIge1xyXG5cclxuICAgIHN0YXRpYyBcIkBpbmplY3RcIiA9IHtcclxuICAgICAgICBwb29sOlwicG9vbFwiLFxyXG4gICAgICAgIHZpZXdGYWN0b3J5OltJVmlldywge2NvbnRyb2xsZXI6U3BsYXNofV1cclxuICAgIH07XHJcblxyXG4gICAgZW50ZXJTcGxhc2goKXtcclxuICAgICAgICB0aGlzLl9zaG93KCk7XHJcbiAgICB9XHJcblxyXG4gICAgQk9EWSA9IHtcclxuICAgICAgICBib3VuZDpmdW5jdGlvbiggZXZ0ICl7XHJcbiAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldnQudGFyZ2V0O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbn1cclxuXHJcblxyXG5leHBvcnQgZGVmYXVsdCBTcGxhc2g7XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gRE9NO1xyXG5cclxuZnVuY3Rpb24gRE9NKCBlbGVtZW50ICl7XHJcblxyXG4gICAgaWYoICFlbGVtZW50ICYmIGRvY3VtZW50ICYmIGRvY3VtZW50LmJvZHkgKVxyXG4gICAgICAgIGVsZW1lbnQgPSBkb2N1bWVudC5ib2R5O1xyXG5cclxuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XHJcblxyXG59XHJcblxyXG52YXIgc3BhcmUgPSBudWxsO1xyXG5mdW5jdGlvbiBnZXRUaGlzKCB0aGF0ICl7XHJcblxyXG4gICAgaWYoICF0aGF0IHx8IHR5cGVvZiB0aGF0ID09IFwiZnVuY3Rpb25cIiApXHJcbiAgICAgICAgcmV0dXJuIHNwYXJlID0gc3BhcmUgfHwgbmV3IERPTSgpO1xyXG5cclxuICAgIHJldHVybiB0aGF0O1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gcHJvdG90eXBlKCBvYmogKXtcclxuICAgIFxyXG4gICAgdmFyIGRlc2MgPSB7fTtcclxuICAgIGZvciggdmFyIGsgaW4gb2JqICl7XHJcbiAgICAgICAgZGVzY1trXSA9IHtcclxuICAgICAgICAgICAgZW51bWVyYWJsZTpmYWxzZSxcclxuICAgICAgICAgICAgdmFsdWU6IG9ialtrXVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB2YXIgcmV0ID0ge307XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhyZXQsIGRlc2MpO1xyXG5cclxuICAgIHJldHVybiByZXQ7XHJcblxyXG59XHJcblxyXG52YXIgaW1wbCA9IHtcclxuXHJcbiAgICBjcmVhdGU6ZnVuY3Rpb24oIHN0clRhZ05hbWUsIG9ialByb3BlcnRpZXMsIGFyckNoaWxkcmVuLCBlbFBhcmVudCApe1xyXG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkuZnJvbShhcmd1bWVudHMpO1xyXG4gICAgICAgIHN0clRhZ05hbWUgPSBvYmpQcm9wZXJ0aWVzID0gYXJyQ2hpbGRyZW4gPSBlbFBhcmVudCA9IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgZm9yKCB2YXIgaT0wLCBsPWFyZ3MubGVuZ3RoOyBpPGw7ICsraSApe1xyXG4gICAgICAgICAgICB2YXIgYXJnID0gYXJnc1tpXTtcclxuICAgICAgICAgICAgaWYoIHR5cGVvZiBhcmcgPT0gXCJzdHJpbmdcIiApXHJcbiAgICAgICAgICAgICAgICBzdHJUYWdOYW1lID0gYXJnO1xyXG4gICAgICAgICAgICBlbHNlIGlmKCB0eXBlb2YgYXJnID09IFwib2JqZWN0XCIgKXtcclxuICAgICAgICAgICAgICAgIGlmKCBBcnJheS5pc0FycmF5KGFyZykgKVxyXG4gICAgICAgICAgICAgICAgICAgIGFyckNoaWxkcmVuID0gYXJnO1xyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiggYXJnIGluc3RhbmNlb2YgRWxlbWVudCApXHJcbiAgICAgICAgICAgICAgICAgICAgZWxQYXJlbnQgPSBhcmc7XHJcbiAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgb2JqUHJvcGVydGllcyA9IGFyZztcclxuICAgICAgICAgICAgfSAgICBcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKCAhZWxQYXJlbnQgJiYgdGhpcy5lbGVtZW50IClcclxuICAgICAgICAgICAgZWxQYXJlbnQgPSB0aGlzLmVsZW1lbnQ7XHJcblxyXG4gICAgICAgIGlmKCAhc3RyVGFnTmFtZSApe1xyXG4gICAgICAgICAgICBpZiggIWVsUGFyZW50IClcclxuICAgICAgICAgICAgICAgIHN0clRhZ05hbWUgPSBcInNwYW5cIjtcclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgc3RyVGFnTmFtZSA9IHtcclxuICAgICAgICAgICAgICAgICAgICB0YWJsZTpcInRyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgdHI6XCJ0ZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdDpcIm9wdGlvblwiLFxyXG4gICAgICAgICAgICAgICAgICAgIHVsOlwibGlcIixcclxuICAgICAgICAgICAgICAgICAgICBvbDpcImxpXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgZGw6XCJkdFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIG9wdGdyb3VwOlwib3B0aW9uXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YWxpc3Q6XCJvcHRpb25cIlxyXG4gICAgICAgICAgICAgICAgfVtlbFBhcmVudC50YWdOYW1lXSB8fCBlbFBhcmVudC50YWdOYW1lO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCBzdHJUYWdOYW1lICk7XHJcbiAgICAgICAgaWYoIGVsUGFyZW50IClcclxuICAgICAgICAgICAgZWxQYXJlbnQuYXBwZW5kQ2hpbGQoIGVsZW1lbnQgKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbGlzdGVuZXI7XHJcblxyXG4gICAgICAgIGZvciggdmFyIGtleSBpbiBvYmpQcm9wZXJ0aWVzICl7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IG9ialByb3BlcnRpZXNba2V5XTtcclxuICAgICAgICAgICAgaWYoIGtleSA9PSBcInRleHRcIiApXHJcbiAgICAgICAgICAgICAgICBlbGVtZW50LmFwcGVuZENoaWxkKCBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSkgKTtcclxuICAgICAgICAgICAgZWxzZSBpZigga2V5ID09IFwibGlzdGVuZXJcIiApXHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lciA9IHZhbHVlO1xyXG4gICAgICAgICAgICBlbHNlIGlmKCBrZXkgPT0gXCJhdHRyXCIgKXtcclxuICAgICAgICAgICAgICAgIGZvciggdmFyIGF0dHIgaW4gdmFsdWUgKVxyXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCBhdHRyLCB2YWx1ZVthdHRyXSApO1xyXG4gICAgICAgICAgICB9ZWxzZSBpZiggZWxlbWVudFtrZXldICYmIHR5cGVvZiBlbGVtZW50W2tleV0gPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdmFsdWUgPT0gXCJvYmplY3RcIiApXHJcbiAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKCBlbGVtZW50W2tleV0sIHZhbHVlICk7XHJcbiAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgIGVsZW1lbnRba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoIHRoaXMuZWxlbWVudCAmJiBlbGVtZW50LmlkIClcclxuICAgICAgICAgICAgdGhpc1tlbGVtZW50LmlkXSA9IGVsZW1lbnQ7XHJcblxyXG4gICAgICAgIGZvciggaT0wLCBsPWFyckNoaWxkcmVuICYmIGFyckNoaWxkcmVuLmxlbmd0aDsgaTxsOyArK2kgKXtcclxuICAgICAgICAgICAgdGhpcy5jcmVhdGUuYXBwbHkoIHRoaXMsIGFyckNoaWxkcmVuW2ldLmNvbmNhdChlbGVtZW50KSApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoIGxpc3RlbmVyIClcclxuICAgICAgICAgICAgKG5ldyBET00oZWxlbWVudCkpLmxpc3RlbiggbGlzdGVuZXIgKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XHJcbiAgICB9LFxyXG5cclxuICAgIGxpc3RlbjpmdW5jdGlvbiggbGlzdGVuZXJzLCB0aGF0LCBwcmVmaXggKXtcclxuICAgICAgICBwcmVmaXggPSBwcmVmaXggfHwgXCJcIjtcclxuICAgICAgICBpZiggdGhhdCA9PT0gdW5kZWZpbmVkICkgdGhhdCA9IGxpc3RlbmVycztcclxuXHJcbiAgICAgICAgdmFyIFRISVMgPSBnZXRUaGlzKCB0aGlzICk7XHJcblxyXG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoIGxpc3RlbmVycyApO1xyXG5cclxuICAgICAgICBUSElTLmZvckVhY2goIGVsZW1lbnQgPT4ge1xyXG5cclxuICAgICAgICAgICAgaWYoIGxpc3RlbmVyc1twcmVmaXggKyBlbGVtZW50LnRhZ05hbWVdICkgXHJcbiAgICAgICAgICAgICAgICBiaW5kKCBsaXN0ZW5lcnNbcHJlZml4ICsgZWxlbWVudC50YWdOYW1lXSwgZWxlbWVudCApO1xyXG5cclxuICAgICAgICAgICAgaWYoIGxpc3RlbmVyc1twcmVmaXggKyBlbGVtZW50LmlkXSApIFxyXG4gICAgICAgICAgICAgICAgYmluZCggbGlzdGVuZXJzW3ByZWZpeCArIGVsZW1lbnQuaWRdLCBlbGVtZW50ICk7XHJcblxyXG4gICAgICAgICAgICBpZiggbGlzdGVuZXJzW3ByZWZpeCArIGVsZW1lbnQuY2xhc3NOYW1lXSApIFxyXG4gICAgICAgICAgICAgICAgYmluZCggbGlzdGVuZXJzW3ByZWZpeCArIGVsZW1lbnQuY2xhc3NOYW1lXSwgZWxlbWVudCApO1xyXG5cclxuICAgICAgICAgICAgaWYoIGxpc3RlbmVyc1twcmVmaXggKyBlbGVtZW50Lm5hbWVdICkgXHJcbiAgICAgICAgICAgICAgICBiaW5kKCBsaXN0ZW5lcnNbcHJlZml4ICsgZWxlbWVudC5uYW1lXSwgZWxlbWVudCApO1xyXG5cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIFRISVM7XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIGJpbmQoIG9iaiwgZWxlbWVudCApe1xyXG5cclxuICAgICAgICAgICAgZm9yKCB2YXIgZXZlbnQgaW4gb2JqICl7XHJcbiAgICAgICAgICAgICAgICB2YXIgZnVuYyA9IG9ialtldmVudF07XHJcbiAgICAgICAgICAgICAgICBpZiggIWZ1bmMuY2FsbCApIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCBldmVudCwgdGhhdCA/IGZ1bmMuYmluZCh0aGF0KSA6IGZ1bmMgKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgfSxcclxuXHJcbiAgICBpbmRleDpmdW5jdGlvbigga2V5cywgbXVsdGlwbGUsIHByb3BlcnR5ICl7XHJcbiAgICAgICAgdmFyIFRISVMgPSBnZXRUaGlzKHRoaXMpO1xyXG5cclxuICAgICAgICB2YXIgaW5kZXggPSBPYmplY3QuY3JlYXRlKERPTS5wcm90b3R5cGUpO1xyXG5cclxuICAgICAgICBpZiggdHlwZW9mIGtleXMgPT0gXCJzdHJpbmdcIiApIGtleXMgPSBba2V5c107XHJcblxyXG4gICAgICAgIGZvciggdmFyIGk9MCwgbD1rZXlzLmxlbmd0aDsgaTxsOyArK2kgKXtcclxuXHJcbiAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xyXG4gICAgICAgICAgICBpZiggdHlwZW9mIGtleSAhPSBcInN0cmluZ1wiIClcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgaWYoICFwcm9wZXJ0eSAmJiAhbXVsdGlwbGUgKXtcclxuXHJcbiAgICAgICAgICAgICAgICBUSElTLmZvckVhY2goIGNoaWxkID0+IGNoaWxkW2tleV0gIT09IHVuZGVmaW5lZCAmJiAoaW5kZXhbIGNoaWxkW2tleV0gXSA9IGNoaWxkKSApO1xyXG5cclxuICAgICAgICAgICAgfWVsc2UgaWYoIHByb3BlcnR5ICYmICFtdWx0aXBsZSApe1xyXG5cclxuICAgICAgICAgICAgICAgIFRISVMuZm9yRWFjaCggY2hpbGQgPT57XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIGNoaWxkW3Byb3BlcnR5XSAmJiB0eXBlb2YgY2hpbGRbcHJvcGVydHldID09IFwib2JqZWN0XCIgJiYgY2hpbGRbcHJvcGVydHldW2tleV0gIT09IHVuZGVmaW5lZCApIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleFsgY2hpbGRbcHJvcGVydHldW2tleV0gXSA9IGNoaWxkO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB9ZWxzZSBpZiggIXByb3BlcnR5ICYmIHR5cGVvZiBtdWx0aXBsZSA9PSBcImZ1bmN0aW9uXCIgKXtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgVEhJUy5mb3JFYWNoKCBjaGlsZCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIGNoaWxkW2tleV0gIT09IHVuZGVmaW5lZCApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG11bHRpcGxlKCBjaGlsZFtrZXldLCBjaGlsZCApO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB9ZWxzZSBpZiggcHJvcGVydHkgJiYgdHlwZW9mIG11bHRpcGxlID09IFwiZnVuY3Rpb25cIiApe1xyXG5cclxuICAgICAgICAgICAgICAgIFRISVMuZm9yRWFjaCggY2hpbGQgPT57XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmKCAhY2hpbGRbcHJvcGVydHldIHx8IHR5cGVvZiBjaGlsZFtwcm9wZXJ0eV0gIT0gXCJvYmplY3RcIiApIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciB2ID0gY2hpbGRbcHJvcGVydHldW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIHYgIT09IHVuZGVmaW5lZCApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG11bHRpcGxlKCB2LCBjaGlsZCApO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgfWVsc2UgaWYoICFwcm9wZXJ0eSAmJiBtdWx0aXBsZSApe1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBUSElTLmZvckVhY2goIGNoaWxkID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiggY2hpbGRba2V5XSAhPT0gdW5kZWZpbmVkICl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCAhaW5kZXhbIGNoaWxkW2tleV0gXSApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleFsgY2hpbGRba2V5XSBdID0gW2NoaWxkXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXhbIGNoaWxkW2tleV0gXS5wdXNoKCBjaGlsZCApO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgfWVsc2UgaWYoIHByb3BlcnR5ICYmIG11bHRpcGxlICl7XHJcblxyXG4gICAgICAgICAgICAgICAgVEhJUy5mb3JFYWNoKCBjaGlsZCA9PntcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYoICFjaGlsZFtwcm9wZXJ0eV0gfHwgdHlwZW9mIGNoaWxkW3Byb3BlcnR5XSAhPSBcIm9iamVjdFwiICkgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHYgPSBjaGlsZFtwcm9wZXJ0eV1ba2V5XTtcclxuICAgICAgICAgICAgICAgICAgICBpZiggdiAhPT0gdW5kZWZpbmVkICl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCAhaW5kZXhbIHYgXSApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleFsgdiBdID0gW2NoaWxkXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXhbIHYgXS5wdXNoKCBjaGlsZCApO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gaW5kZXg7XHJcblxyXG4gICAgfSxcclxuXHJcbiAgICBmb3JFYWNoOmZ1bmN0aW9uKCBjYiwgZWxlbWVudCApe1xyXG4gICAgICAgIHZhciBUSElTID0gZ2V0VGhpcyh0aGlzKTtcclxuXHJcbiAgICAgICAgZWxlbWVudCA9IGVsZW1lbnQgfHwgVEhJUy5lbGVtZW50O1xyXG5cclxuICAgICAgICBpZiggIWVsZW1lbnQgKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIGlmKCBjYihlbGVtZW50KSA9PT0gZmFsc2UgKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIGlmKCAhZWxlbWVudC5jaGlsZHJlbiApXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgZm9yKCB2YXIgaT0wLCBsPWVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoOyBpPGw7ICsraSApe1xyXG4gICAgICAgICAgICBUSElTLmZvckVhY2goIGNiLCBlbGVtZW50LmNoaWxkcmVuW2ldICk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbn07XHJcblxyXG5PYmplY3QuYXNzaWduKERPTSwgaW1wbCk7XHJcbkRPTS5wcm90b3R5cGUgPSBwcm90b3R5cGUoaW1wbCk7XHJcbiIsIi8qXHJcbiAgSSd2ZSB3cmFwcGVkIE1ha290byBNYXRzdW1vdG8gYW5kIFRha3VqaSBOaXNoaW11cmEncyBjb2RlIGluIGEgbmFtZXNwYWNlXHJcbiAgc28gaXQncyBiZXR0ZXIgZW5jYXBzdWxhdGVkLiBOb3cgeW91IGNhbiBoYXZlIG11bHRpcGxlIHJhbmRvbSBudW1iZXIgZ2VuZXJhdG9yc1xyXG4gIGFuZCB0aGV5IHdvbid0IHN0b21wIGFsbCBvdmVyIGVhY2hvdGhlcidzIHN0YXRlLlxyXG4gIFxyXG4gIElmIHlvdSB3YW50IHRvIHVzZSB0aGlzIGFzIGEgc3Vic3RpdHV0ZSBmb3IgTWF0aC5yYW5kb20oKSwgdXNlIHRoZSByYW5kb20oKVxyXG4gIG1ldGhvZCBsaWtlIHNvOlxyXG4gIFxyXG4gIHZhciBtID0gbmV3IE1lcnNlbm5lVHdpc3RlcigpO1xyXG4gIHZhciByYW5kb21OdW1iZXIgPSBtLnJhbmRvbSgpO1xyXG4gIFxyXG4gIFlvdSBjYW4gYWxzbyBjYWxsIHRoZSBvdGhlciBnZW5yYW5kX3tmb299KCkgbWV0aG9kcyBvbiB0aGUgaW5zdGFuY2UuXHJcbiAgSWYgeW91IHdhbnQgdG8gdXNlIGEgc3BlY2lmaWMgc2VlZCBpbiBvcmRlciB0byBnZXQgYSByZXBlYXRhYmxlIHJhbmRvbVxyXG4gIHNlcXVlbmNlLCBwYXNzIGFuIGludGVnZXIgaW50byB0aGUgY29uc3RydWN0b3I6XHJcbiAgdmFyIG0gPSBuZXcgTWVyc2VubmVUd2lzdGVyKDEyMyk7XHJcbiAgYW5kIHRoYXQgd2lsbCBhbHdheXMgcHJvZHVjZSB0aGUgc2FtZSByYW5kb20gc2VxdWVuY2UuXHJcbiAgU2VhbiBNY0N1bGxvdWdoIChiYW5rc2VhbkBnbWFpbC5jb20pXHJcbiovXHJcblxyXG4vKiBcclxuICAgQSBDLXByb2dyYW0gZm9yIE1UMTk5MzcsIHdpdGggaW5pdGlhbGl6YXRpb24gaW1wcm92ZWQgMjAwMi8xLzI2LlxyXG4gICBDb2RlZCBieSBUYWt1amkgTmlzaGltdXJhIGFuZCBNYWtvdG8gTWF0c3Vtb3RvLlxyXG4gXHJcbiAgIEJlZm9yZSB1c2luZywgaW5pdGlhbGl6ZSB0aGUgc3RhdGUgYnkgdXNpbmcgaW5pdF9nZW5yYW5kKHNlZWQpICBcclxuICAgb3IgaW5pdF9ieV9hcnJheShpbml0X2tleSwga2V5X2xlbmd0aCkuXHJcbiBcclxuICAgQ29weXJpZ2h0IChDKSAxOTk3IC0gMjAwMiwgTWFrb3RvIE1hdHN1bW90byBhbmQgVGFrdWppIE5pc2hpbXVyYSxcclxuICAgQWxsIHJpZ2h0cyByZXNlcnZlZC4gICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gXHJcbiAgIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxyXG4gICBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnNcclxuICAgYXJlIG1ldDpcclxuIFxyXG4gICAgIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XHJcbiAgICAgICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxyXG4gXHJcbiAgICAgMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHRcclxuICAgICAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gdGhlXHJcbiAgICAgICAgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cclxuIFxyXG4gICAgIDMuIFRoZSBuYW1lcyBvZiBpdHMgY29udHJpYnV0b3JzIG1heSBub3QgYmUgdXNlZCB0byBlbmRvcnNlIG9yIHByb21vdGUgXHJcbiAgICAgICAgcHJvZHVjdHMgZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIFxyXG4gICAgICAgIHBlcm1pc3Npb24uXHJcbiBcclxuICAgVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQ09QWVJJR0hUIEhPTERFUlMgQU5EIENPTlRSSUJVVE9SU1xyXG4gICBcIkFTIElTXCIgQU5EIEFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UXHJcbiAgIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUlxyXG4gICBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBDT1BZUklHSFQgT1dORVIgT1JcclxuICAgQ09OVFJJQlVUT1JTIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsXHJcbiAgIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTyxcclxuICAgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SXHJcbiAgIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcclxuICAgTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkdcclxuICAgTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTXHJcbiAgIFNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxyXG4gXHJcbiBcclxuICAgQW55IGZlZWRiYWNrIGlzIHZlcnkgd2VsY29tZS5cclxuICAgaHR0cDovL3d3dy5tYXRoLnNjaS5oaXJvc2hpbWEtdS5hYy5qcC9+bS1tYXQvTVQvZW10Lmh0bWxcclxuICAgZW1haWw6IG0tbWF0IEAgbWF0aC5zY2kuaGlyb3NoaW1hLXUuYWMuanAgKHJlbW92ZSBzcGFjZSlcclxuKi9cclxuXHJcbnZhciBNZXJzZW5uZVR3aXN0ZXIgPSBmdW5jdGlvbihzZWVkKSB7XHJcbiAgaWYgKHNlZWQgPT0gdW5kZWZpbmVkKSB7XHJcbiAgICBzZWVkID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgfSBcclxuICAvKiBQZXJpb2QgcGFyYW1ldGVycyAqLyAgXHJcbiAgdGhpcy5OID0gNjI0O1xyXG4gIHRoaXMuTSA9IDM5NztcclxuICB0aGlzLk1BVFJJWF9BID0gMHg5OTA4YjBkZjsgICAvKiBjb25zdGFudCB2ZWN0b3IgYSAqL1xyXG4gIHRoaXMuVVBQRVJfTUFTSyA9IDB4ODAwMDAwMDA7IC8qIG1vc3Qgc2lnbmlmaWNhbnQgdy1yIGJpdHMgKi9cclxuICB0aGlzLkxPV0VSX01BU0sgPSAweDdmZmZmZmZmOyAvKiBsZWFzdCBzaWduaWZpY2FudCByIGJpdHMgKi9cclxuIFxyXG4gIHRoaXMubXQgPSBuZXcgQXJyYXkodGhpcy5OKTsgLyogdGhlIGFycmF5IGZvciB0aGUgc3RhdGUgdmVjdG9yICovXHJcbiAgdGhpcy5tdGk9dGhpcy5OKzE7IC8qIG10aT09TisxIG1lYW5zIG10W05dIGlzIG5vdCBpbml0aWFsaXplZCAqL1xyXG5cclxuICB0aGlzLmluaXRfZ2VucmFuZChzZWVkKTtcclxufSAgXHJcbiBcclxuLyogaW5pdGlhbGl6ZXMgbXRbTl0gd2l0aCBhIHNlZWQgKi9cclxuTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5pbml0X2dlbnJhbmQgPSBmdW5jdGlvbihzKSB7XHJcbiAgdGhpcy5tdFswXSA9IHMgPj4+IDA7XHJcbiAgZm9yICh0aGlzLm10aT0xOyB0aGlzLm10aTx0aGlzLk47IHRoaXMubXRpKyspIHtcclxuICAgICAgdmFyIHMgPSB0aGlzLm10W3RoaXMubXRpLTFdIF4gKHRoaXMubXRbdGhpcy5tdGktMV0gPj4+IDMwKTtcclxuICAgdGhpcy5tdFt0aGlzLm10aV0gPSAoKCgoKHMgJiAweGZmZmYwMDAwKSA+Pj4gMTYpICogMTgxMjQzMzI1MykgPDwgMTYpICsgKHMgJiAweDAwMDBmZmZmKSAqIDE4MTI0MzMyNTMpXHJcbiAgKyB0aGlzLm10aTtcclxuICAgICAgLyogU2VlIEtudXRoIFRBT0NQIFZvbDIuIDNyZCBFZC4gUC4xMDYgZm9yIG11bHRpcGxpZXIuICovXHJcbiAgICAgIC8qIEluIHRoZSBwcmV2aW91cyB2ZXJzaW9ucywgTVNCcyBvZiB0aGUgc2VlZCBhZmZlY3QgICAqL1xyXG4gICAgICAvKiBvbmx5IE1TQnMgb2YgdGhlIGFycmF5IG10W10uICAgICAgICAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgLyogMjAwMi8wMS8wOSBtb2RpZmllZCBieSBNYWtvdG8gTWF0c3Vtb3RvICAgICAgICAgICAgICovXHJcbiAgICAgIHRoaXMubXRbdGhpcy5tdGldID4+Pj0gMDtcclxuICAgICAgLyogZm9yID4zMiBiaXQgbWFjaGluZXMgKi9cclxuICB9XHJcbn1cclxuIFxyXG4vKiBpbml0aWFsaXplIGJ5IGFuIGFycmF5IHdpdGggYXJyYXktbGVuZ3RoICovXHJcbi8qIGluaXRfa2V5IGlzIHRoZSBhcnJheSBmb3IgaW5pdGlhbGl6aW5nIGtleXMgKi9cclxuLyoga2V5X2xlbmd0aCBpcyBpdHMgbGVuZ3RoICovXHJcbi8qIHNsaWdodCBjaGFuZ2UgZm9yIEMrKywgMjAwNC8yLzI2ICovXHJcbk1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuaW5pdF9ieV9hcnJheSA9IGZ1bmN0aW9uKGluaXRfa2V5LCBrZXlfbGVuZ3RoKSB7XHJcbiAgdmFyIGksIGosIGs7XHJcbiAgdGhpcy5pbml0X2dlbnJhbmQoMTk2NTAyMTgpO1xyXG4gIGk9MTsgaj0wO1xyXG4gIGsgPSAodGhpcy5OPmtleV9sZW5ndGggPyB0aGlzLk4gOiBrZXlfbGVuZ3RoKTtcclxuICBmb3IgKDsgazsgay0tKSB7XHJcbiAgICB2YXIgcyA9IHRoaXMubXRbaS0xXSBeICh0aGlzLm10W2ktMV0gPj4+IDMwKVxyXG4gICAgdGhpcy5tdFtpXSA9ICh0aGlzLm10W2ldIF4gKCgoKChzICYgMHhmZmZmMDAwMCkgPj4+IDE2KSAqIDE2NjQ1MjUpIDw8IDE2KSArICgocyAmIDB4MDAwMGZmZmYpICogMTY2NDUyNSkpKVxyXG4gICAgICArIGluaXRfa2V5W2pdICsgajsgLyogbm9uIGxpbmVhciAqL1xyXG4gICAgdGhpcy5tdFtpXSA+Pj49IDA7IC8qIGZvciBXT1JEU0laRSA+IDMyIG1hY2hpbmVzICovXHJcbiAgICBpKys7IGorKztcclxuICAgIGlmIChpPj10aGlzLk4pIHsgdGhpcy5tdFswXSA9IHRoaXMubXRbdGhpcy5OLTFdOyBpPTE7IH1cclxuICAgIGlmIChqPj1rZXlfbGVuZ3RoKSBqPTA7XHJcbiAgfVxyXG4gIGZvciAoaz10aGlzLk4tMTsgazsgay0tKSB7XHJcbiAgICB2YXIgcyA9IHRoaXMubXRbaS0xXSBeICh0aGlzLm10W2ktMV0gPj4+IDMwKTtcclxuICAgIHRoaXMubXRbaV0gPSAodGhpcy5tdFtpXSBeICgoKCgocyAmIDB4ZmZmZjAwMDApID4+PiAxNikgKiAxNTY2MDgzOTQxKSA8PCAxNikgKyAocyAmIDB4MDAwMGZmZmYpICogMTU2NjA4Mzk0MSkpXHJcbiAgICAgIC0gaTsgLyogbm9uIGxpbmVhciAqL1xyXG4gICAgdGhpcy5tdFtpXSA+Pj49IDA7IC8qIGZvciBXT1JEU0laRSA+IDMyIG1hY2hpbmVzICovXHJcbiAgICBpKys7XHJcbiAgICBpZiAoaT49dGhpcy5OKSB7IHRoaXMubXRbMF0gPSB0aGlzLm10W3RoaXMuTi0xXTsgaT0xOyB9XHJcbiAgfVxyXG5cclxuICB0aGlzLm10WzBdID0gMHg4MDAwMDAwMDsgLyogTVNCIGlzIDE7IGFzc3VyaW5nIG5vbi16ZXJvIGluaXRpYWwgYXJyYXkgKi8gXHJcbn1cclxuIFxyXG4vKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uIFswLDB4ZmZmZmZmZmZdLWludGVydmFsICovXHJcbk1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9pbnQzMiA9IGZ1bmN0aW9uKCkge1xyXG4gIHZhciB5O1xyXG4gIHZhciBtYWcwMSA9IG5ldyBBcnJheSgweDAsIHRoaXMuTUFUUklYX0EpO1xyXG4gIC8qIG1hZzAxW3hdID0geCAqIE1BVFJJWF9BICBmb3IgeD0wLDEgKi9cclxuXHJcbiAgaWYgKHRoaXMubXRpID49IHRoaXMuTikgeyAvKiBnZW5lcmF0ZSBOIHdvcmRzIGF0IG9uZSB0aW1lICovXHJcbiAgICB2YXIga2s7XHJcblxyXG4gICAgaWYgKHRoaXMubXRpID09IHRoaXMuTisxKSAgIC8qIGlmIGluaXRfZ2VucmFuZCgpIGhhcyBub3QgYmVlbiBjYWxsZWQsICovXHJcbiAgICAgIHRoaXMuaW5pdF9nZW5yYW5kKDU0ODkpOyAvKiBhIGRlZmF1bHQgaW5pdGlhbCBzZWVkIGlzIHVzZWQgKi9cclxuXHJcbiAgICBmb3IgKGtrPTA7a2s8dGhpcy5OLXRoaXMuTTtraysrKSB7XHJcbiAgICAgIHkgPSAodGhpcy5tdFtra10mdGhpcy5VUFBFUl9NQVNLKXwodGhpcy5tdFtraysxXSZ0aGlzLkxPV0VSX01BU0spO1xyXG4gICAgICB0aGlzLm10W2trXSA9IHRoaXMubXRba2srdGhpcy5NXSBeICh5ID4+PiAxKSBeIG1hZzAxW3kgJiAweDFdO1xyXG4gICAgfVxyXG4gICAgZm9yICg7a2s8dGhpcy5OLTE7a2srKykge1xyXG4gICAgICB5ID0gKHRoaXMubXRba2tdJnRoaXMuVVBQRVJfTUFTSyl8KHRoaXMubXRba2srMV0mdGhpcy5MT1dFUl9NQVNLKTtcclxuICAgICAgdGhpcy5tdFtra10gPSB0aGlzLm10W2trKyh0aGlzLk0tdGhpcy5OKV0gXiAoeSA+Pj4gMSkgXiBtYWcwMVt5ICYgMHgxXTtcclxuICAgIH1cclxuICAgIHkgPSAodGhpcy5tdFt0aGlzLk4tMV0mdGhpcy5VUFBFUl9NQVNLKXwodGhpcy5tdFswXSZ0aGlzLkxPV0VSX01BU0spO1xyXG4gICAgdGhpcy5tdFt0aGlzLk4tMV0gPSB0aGlzLm10W3RoaXMuTS0xXSBeICh5ID4+PiAxKSBeIG1hZzAxW3kgJiAweDFdO1xyXG5cclxuICAgIHRoaXMubXRpID0gMDtcclxuICB9XHJcblxyXG4gIHkgPSB0aGlzLm10W3RoaXMubXRpKytdO1xyXG5cclxuICAvKiBUZW1wZXJpbmcgKi9cclxuICB5IF49ICh5ID4+PiAxMSk7XHJcbiAgeSBePSAoeSA8PCA3KSAmIDB4OWQyYzU2ODA7XHJcbiAgeSBePSAoeSA8PCAxNSkgJiAweGVmYzYwMDAwO1xyXG4gIHkgXj0gKHkgPj4+IDE4KTtcclxuXHJcbiAgcmV0dXJuIHkgPj4+IDA7XHJcbn1cclxuIFxyXG4vKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uIFswLDB4N2ZmZmZmZmZdLWludGVydmFsICovXHJcbk1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9pbnQzMSA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiAodGhpcy5nZW5yYW5kX2ludDMyKCk+Pj4xKTtcclxufVxyXG4gXHJcbi8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gWzAsMV0tcmVhbC1pbnRlcnZhbCAqL1xyXG5NZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLmdlbnJhbmRfcmVhbDEgPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4gdGhpcy5nZW5yYW5kX2ludDMyKCkqKDEuMC80Mjk0OTY3Mjk1LjApOyBcclxuICAvKiBkaXZpZGVkIGJ5IDJeMzItMSAqLyBcclxufVxyXG5cclxuLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiBbMCwxKS1yZWFsLWludGVydmFsICovXHJcbk1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUucmFuZG9tID0gZnVuY3Rpb24oKSB7XHJcbiAgcmV0dXJuIHRoaXMuZ2VucmFuZF9pbnQzMigpKigxLjAvNDI5NDk2NzI5Ni4wKTsgXHJcbiAgLyogZGl2aWRlZCBieSAyXjMyICovXHJcbn1cclxuIFxyXG4vKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uICgwLDEpLXJlYWwtaW50ZXJ2YWwgKi9cclxuTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5nZW5yYW5kX3JlYWwzID0gZnVuY3Rpb24oKSB7XHJcbiAgcmV0dXJuICh0aGlzLmdlbnJhbmRfaW50MzIoKSArIDAuNSkqKDEuMC80Mjk0OTY3Mjk2LjApOyBcclxuICAvKiBkaXZpZGVkIGJ5IDJeMzIgKi9cclxufVxyXG4gXHJcbi8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gWzAsMSkgd2l0aCA1My1iaXQgcmVzb2x1dGlvbiovXHJcbk1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9yZXM1MyA9IGZ1bmN0aW9uKCkgeyBcclxuICB2YXIgYT10aGlzLmdlbnJhbmRfaW50MzIoKT4+PjUsIGI9dGhpcy5nZW5yYW5kX2ludDMyKCk+Pj42OyBcclxuICByZXR1cm4oYSo2NzEwODg2NC4wK2IpKigxLjAvOTAwNzE5OTI1NDc0MDk5Mi4wKTsgXHJcbn0gXHJcblxyXG4vKiBUaGVzZSByZWFsIHZlcnNpb25zIGFyZSBkdWUgdG8gSXNha3UgV2FkYSwgMjAwMi8wMS8wOSBhZGRlZCAqL1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBNZXJzZW5uZVR3aXN0ZXI7IiwiaW1wb3J0IHsgaW5qZWN0LCBiaW5kLCBnZXRJbnN0YW5jZU9mIH0gZnJvbSAnZHJ5LWRpJztcclxuaW1wb3J0IFN0ckxkciBmcm9tICcuL3N0cmxkci5qcyc7XHJcbmltcG9ydCBJU3RvcmUgZnJvbSAnLi4vc3RvcmUvSVN0b3JlLmpzJztcclxuaW1wb3J0IERPTSBmcm9tIFwiLi9kcnktZG9tLmpzXCI7XHJcbmltcG9ydCBQb29sIGZyb20gJy4vcG9vbC5qcyc7XHJcblxyXG5cclxuZnVuY3Rpb24gcmVhZCggc3RyLCBjdHggKXtcclxuXHJcbiAgICB2YXIgcGFydHMgPSBzdHIuc3BsaXQoXCIuXCIpLCBpPTA7XHJcblxyXG4gICAgd2hpbGUoIGk8cGFydHMubGVuZ3RoICYmIGN0eCApXHJcbiAgICAgICAgY3R4ID0gY3R4WyBwYXJ0c1tpKytdIF07XHJcbiAgICBcclxuICAgIHJldHVybiBjdHg7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkTWV0aG9kKCBzdHIsIGN0eCwgLi4uYXJncyApe1xyXG5cclxuICAgIHZhciBwYXJ0cyA9IHN0ci5zcGxpdChcIi5cIiksIGk9MDtcclxuXHJcbiAgICB2YXIgcGN0eCA9IGN0eDtcclxuXHJcbiAgICB3aGlsZSggaTxwYXJ0cy5sZW5ndGggJiYgY3R4ICl7XHJcbiAgICAgICAgcGN0eCA9IGN0eDtcclxuICAgICAgICBjdHggPSBjdHhbIHBhcnRzW2krK10gXTtcclxuICAgIH1cclxuXHJcbiAgICBpZiggY3R4ICYmIHR5cGVvZiBjdHggPT09IFwiZnVuY3Rpb25cIiApXHJcbiAgICAgICAgcmV0dXJuIGN0eC5iaW5kKCBwY3R4LCAuLi5hcmdzICk7XHJcbiAgICBcclxuICAgIHJldHVybiBudWxsO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGUoIHN0ciwgdmFsdWUsIGN0eCApe1xyXG5cclxuICAgIHZhciBwYXJ0cyA9IHN0ci5zcGxpdChcIi5cIiksIGk9MDtcclxuXHJcbiAgICB3aGlsZShwYXJ0cy5sZW5ndGgtMSAmJiBjdHgpe1xyXG4gICAgICAgIGlmKCAhKHBhcnRzW2ldIGluIGN0eCkgKVxyXG4gICAgICAgICAgICBjdHhbcGFydHNbaV1dID0ge307XHJcbiAgICAgICAgY3R4ID0gY3R4WyBwYXJ0c1tpKytdIF07XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlmKCBjdHggKVxyXG4gICAgICAgIGN0eFsgcGFydHNbaV0gXSA9IHZhbHVlO1xyXG4gICAgXHJcbiAgICByZXR1cm4gISFjdHg7XHJcbiAgICBcclxufVxyXG5cclxuY29uc3QgcGVuZGluZyA9IFtdO1xyXG5sZXQgbmV4dE1vZGVsSWQgPSAwO1xyXG5cclxuY2xhc3MgTW9kZWwge1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKCl7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IHt9O1xyXG4gICAgICAgIHZhciBkYXRhID0ge307XHJcbiAgICAgICAgdmFyIGNoaWxkcmVuID0ge307XHJcbiAgICAgICAgdmFyIHJldkNoaWxkcmVuID0ge307XHJcbiAgICAgICAgdmFyIHBhcmVudHMgPSB7fTtcclxuXHJcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KCBkYXRhLCBcIl9fbW9kZWxfX1wiLCB7IHZhbHVlOnRoaXMsIHdyaXRhYmxlOiBmYWxzZSwgZW51bWVyYWJsZTogZmFsc2UgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoIHRoaXMsIHtcclxuICAgICAgICAgICAgcm9vdDp7IHZhbHVlOnRoaXMsIGVudW1lcmFibGU6ZmFsc2UsIHdyaXRhYmxlOnRydWUgfSxcclxuICAgICAgICAgICAgbGlzdGVuZXJzOnsgdmFsdWU6bGlzdGVuZXJzLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IGZhbHNlIH0sXHJcbiAgICAgICAgICAgIGRhdGE6eyB2YWx1ZTpkYXRhLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUgfSxcclxuICAgICAgICAgICAgY2hpbGRyZW46eyB2YWx1ZTpjaGlsZHJlbiwgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiBmYWxzZSB9LFxyXG4gICAgICAgICAgICByZXZDaGlsZHJlbjp7IHZhbHVlOnJldkNoaWxkcmVuLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IGZhbHNlIH0sXHJcbiAgICAgICAgICAgIHBhcmVudHM6eyB2YWx1ZTpwYXJlbnRzLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IGZhbHNlIH0sXHJcbiAgICAgICAgICAgIGlkOnsgdmFsdWU6ICsrbmV4dE1vZGVsSWQsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogZmFsc2UgfSxcclxuICAgICAgICAgICAgZGlydHk6e1xyXG4gICAgICAgICAgICAgICAgZ2V0OigpID0+IHRoaXMucm9vdC5fX2RpcnR5LFxyXG4gICAgICAgICAgICAgICAgc2V0OiggdiApID0+IHRoaXMucm9vdC5fX2RpcnR5ID0gdlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHN0b3JlKCBiaW5hcnk9dHJ1ZSApe1xyXG4gICAgICAgIHJldHVybiBTdHJMZHIuc3RvcmUoIHRoaXMuZGF0YSwgYmluYXJ5ICk7XHJcbiAgICB9XHJcblxyXG4gICAgbG9hZCggZGF0YSwgZG9SYWlzZSA9IHRydWUgKXtcclxuXHJcbiAgICAgICAgaWYoIHR5cGVvZiBkYXRhID09PSBcInN0cmluZ1wiICl7XHJcbiAgICAgICAgICAgIHRyeXtcclxuICAgICAgICAgICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgZGF0YSA9IFN0ckxkci5sb2FkKGRhdGEpO1xyXG4gICAgICAgICAgICB9Y2F0Y2goZXgpe31cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKCBkYXRhICYmIGRhdGEuYnVmZmVyICYmIGRhdGEuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgKXtcclxuICAgICAgICAgICAgaWYoICEoZGF0YSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIClcclxuICAgICAgICAgICAgICAgIGRhdGEgPSBuZXcgVWludDhBcnJheShkYXRhLmJ1ZmZlcik7XHJcbiAgICAgICAgICAgIGRhdGEgPSBTdHJMZHIubG9hZCggZGF0YSwgdHJ1ZSApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yKCB2YXIgayBpbiBkYXRhICl7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0SXRlbSggaywgZGF0YVtrXSwgZG9SYWlzZSApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHNldEl0ZW0oIGssIHYsIGRvUmFpc2UgPSB0cnVlICl7XHJcblxyXG4gICAgICAgIGlmKCBrLmNoYXJDb2RlQXQgKSBrID0gay5zcGxpdChcIi5cIik7XHJcbiAgICAgICAgdmFyIHByb3AgPSBrLnNoaWZ0KCksIGNoaWxkO1xyXG4gICAgICAgIHZhciBkYXRhID0gdGhpcy5kYXRhLCBjaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW4sIHJldkNoaWxkcmVuID0gdGhpcy5yZXZDaGlsZHJlbjtcclxuXHJcbiAgICAgICAgaWYoIGsubGVuZ3RoICl7XHJcblxyXG4gICAgICAgICAgICBjaGlsZCA9IGNoaWxkcmVuW3Byb3BdO1xyXG4gICAgICAgICAgICBpZiggIWNoaWxkICl7XHJcbiAgICAgICAgICAgICAgICBjaGlsZCA9IGNoaWxkcmVuW3Byb3BdID0gbmV3IE1vZGVsKCk7XHJcbiAgICAgICAgICAgICAgICBjaGlsZC5yb290ID0gdGhpcy5yb290O1xyXG4gICAgICAgICAgICAgICAgY2hpbGQucGFyZW50c1sgdGhpcy5pZCBdID0gdGhpcztcclxuICAgICAgICAgICAgICAgIGRhdGFbcHJvcF0gPSBjaGlsZC5kYXRhO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kaXJ0eSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICByZXZDaGlsZHJlblsgY2hpbGQuaWQgXSA9IFtwcm9wXTtcclxuICAgICAgICAgICAgICAgIHRoaXMucmFpc2UoIHByb3AsIGZhbHNlICk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiBjaGlsZHJlbltwcm9wXS5zZXRJdGVtKCBrLCB2LCBkb1JhaXNlICk7XHJcblxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoIGNoaWxkcmVuW3Byb3BdICl7XHJcblxyXG4gICAgICAgICAgICBpZiggY2hpbGRyZW5bcHJvcF0uZGF0YSAhPT0gdiApXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgICAgICBjaGlsZCA9IGNoaWxkcmVuW3Byb3BdO1xyXG5cclxuICAgICAgICAgICAgbGV0IGluZGV4ID0gcmV2Q2hpbGRyZW5bIGNoaWxkLmlkIF0uaW5kZXhPZihwcm9wKTtcclxuICAgICAgICAgICAgaWYoIGluZGV4ID09PSAtMSApXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnRlZ3JpdHkgY29tcHJvbWlzZWRcIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXZDaGlsZHJlblsgY2hpbGQuaWQgXS5zcGxpY2UoIGluZGV4LCAxICk7XHJcblxyXG4gICAgICAgICAgICBkZWxldGUgY2hpbGQucGFyZW50c1sgdGhpcy5pZCBdO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKCB2ICYmIHR5cGVvZiB2ID09IFwib2JqZWN0XCIgKXtcclxuXHJcbiAgICAgICAgICAgIHZhciBkb0xvYWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgaWYoICF2Ll9fbW9kZWxfXyApe1xyXG4gICAgICAgICAgICAgICAgY2hpbGQgPSBuZXcgTW9kZWwoKTtcclxuICAgICAgICAgICAgICAgIGNoaWxkLnJvb3QgPSB0aGlzLnJvb3Q7XHJcbiAgICAgICAgICAgICAgICBkb0xvYWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgICAgIGNoaWxkID0gdi5fX21vZGVsX187XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmKCAhcmV2Q2hpbGRyZW5bIGNoaWxkLmlkIF0gKSByZXZDaGlsZHJlblsgY2hpbGQuaWQgXSA9IFsgcHJvcCBdO1xyXG4gICAgICAgICAgICBlbHNlIHJldkNoaWxkcmVuWyBjaGlsZC5pZCBdLnB1c2goIHByb3AgKTtcclxuICAgICAgICAgICAgY2hpbGRyZW5bIHByb3AgXSA9IGNoaWxkO1xyXG4gICAgICAgICAgICBjaGlsZC5wYXJlbnRzWyB0aGlzLmlkIF0gPSB0aGlzO1xyXG5cclxuICAgICAgICAgICAgaWYoIGRvTG9hZCApe1xyXG4gICAgICAgICAgICAgICAgY2hpbGQubG9hZCggdiwgZmFsc2UgKTtcclxuICAgICAgICAgICAgICAgIGNoaWxkLmRhdGEgPSB2O1xyXG4gICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KCB2LCBcIl9fbW9kZWxfX1wiLCB7IHZhbHVlOmNoaWxkLCB3cml0YWJsZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRhdGFbIHByb3AgXSA9IHY7XHJcblxyXG4gICAgICAgIHRoaXMuZGlydHkgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMucmFpc2UoIHByb3AsIGRvUmFpc2UgKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGdldE1vZGVsKCBrLCBjcmVhdGUgKXtcclxuXHJcbiAgICAgICAgaWYoIGsuY2hhckNvZGVBdCApXHJcbiAgICAgICAgICAgIGsgPSBrLnNwbGl0KFwiLlwiKTtcclxuXHJcbiAgICAgICAgdmFyIGN0eCA9IHRoaXMsIGkgPSAwO1xyXG4gICAgICAgIGlmKCBjcmVhdGUgKXtcclxuICAgICAgICAgICAgd2hpbGUoIGN0eCAmJiBpPGsubGVuZ3RoICl7XHJcbiAgICAgICAgICAgICAgICBpZiggIWN0eC5jaGlsZHJlbltrW2ldXSApXHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LnNldEl0ZW0oa1tpXSwge30pO1xyXG4gICAgICAgICAgICAgICAgY3R4ID0gY3R4LmNoaWxkcmVuWyBrW2krK10gXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICB3aGlsZSggY3R4ICYmIGk8ay5sZW5ndGggKVxyXG4gICAgICAgICAgICAgICAgY3R4ID0gY3R4LmNoaWxkcmVuWyBrW2krK10gXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBjdHg7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGdldEl0ZW0oIGssIGRlZmF1bHRWYWx1ZSApe1xyXG4gICAgICAgIHZhciB2ID0gcmVhZCggaywgdGhpcy5kYXRhICk7XHJcbiAgICAgICAgaWYoIHYgPT09IHVuZGVmaW5lZCApIHYgPSBkZWZhdWx0VmFsdWU7XHJcbiAgICAgICAgcmV0dXJuIHY7XHJcbiAgICB9XHJcblxyXG4gICAgcmVtb3ZlSXRlbShrLCBjYil7XHJcblxyXG4gICAgICAgIHZhciBwYXJlbnQgPSBrLnNwbGl0KFwiLlwiKTtcclxuICAgICAgICB2YXIga2V5ID0gcGFyZW50LnBvcCgpO1xyXG5cclxuICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLmdldE1vZGVsKCBwYXJlbnQgKTtcclxuICAgICAgICB2YXIgZGF0YSA9IG1vZGVsLmRhdGEsIGNoaWxkcmVuID0gbW9kZWwuY2hpbGRyZW47XHJcblxyXG4gICAgICAgIGlmKCAhKGtleSBpbiBkYXRhKSApIHJldHVybjtcclxuXHJcbiAgICAgICAgaWYoIGNoaWxkcmVuW2tleV0gKXtcclxuXHJcbiAgICAgICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2tleV0sIFxyXG4gICAgICAgICAgICAgICAgcmV2Q2hpbGRyZW4gPSBtb2RlbC5yZXZDaGlsZHJlbltjaGlsZC5pZF07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSByZXZDaGlsZHJlbi5pbmRleE9mKCBrZXkgKTtcclxuICAgICAgICAgICAgaWYoIGluZGV4ID09IC0xICkgdGhyb3cgXCJJbnRlZ3JpdHkgY29tcHJvbWlzZWRcIjtcclxuXHJcbiAgICAgICAgICAgIHJldkNoaWxkcmVuLnNwbGljZShpbmRleCwgMSk7XHJcblxyXG4gICAgICAgICAgICBpZiggcmV2Q2hpbGRyZW4ubGVuZ3RoID09IDAgKXtcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSBjaGlsZC5wYXJlbnRzWyBtb2RlbC5pZCBdO1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIG1vZGVsLnJldkNoaWxkcmVuW2NoaWxkLmlkXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZGVsZXRlIGNoaWxkcmVuW2tleV07XHJcblxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZGVsZXRlIGRhdGFba2V5XTtcclxuXHJcbiAgICAgICAgbW9kZWwucmFpc2UoIGtleSwgdHJ1ZSApO1xyXG4gICAgfVxyXG5cclxuICAgIHJhaXNlKGssIGRvUmFpc2Upe1xyXG5cclxuICAgICAgICBwZW5kaW5nW3BlbmRpbmcubGVuZ3RoKytdID0ge21vZGVsOnRoaXMsIGtleTprfTtcclxuXHJcbiAgICAgICAgaWYoICFkb1JhaXNlIClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICBmb3IoIHZhciBpID0gMCwgbD1wZW5kaW5nLmxlbmd0aDsgaTxsOyArK2kgKXtcclxuXHJcbiAgICAgICAgICAgIGsgPSBwZW5kaW5nW2ldLmtleTtcclxuICAgICAgICAgICAgdmFyIG1vZGVsID0gcGVuZGluZ1tpXS5tb2RlbDtcclxuXHJcbiAgICAgICAgICAgIGlmKCBrICl7XHJcblxyXG4gICAgICAgICAgICAgICAgZGlzcGF0Y2goIG1vZGVsLmxpc3RlbmVyc1trXSwgbW9kZWwuZGF0YVtrXSwgayApO1xyXG5cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuXHJcbiAgICAgICAgICAgICAgICBmb3IoIHZhciBwaWQgaW4gbW9kZWwucGFyZW50cyApe1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB2YXIgcGFyZW50ID0gbW9kZWwucGFyZW50c1sgcGlkIF07XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJldkNoaWxkcmVuID0gcGFyZW50LnJldkNoaWxkcmVuWyBtb2RlbC5pZCBdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKCAhcmV2Q2hpbGRyZW4gKSB0aHJvdyBcIkludGVncml0eSBjb21wcm9taXNlZFwiO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBmb3IoIHZhciBqID0gMCwgcmNsID0gcmV2Q2hpbGRyZW4ubGVuZ3RoOyBqPHJjbDsgKytqICl7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkaXNwYXRjaCggcGFyZW50Lmxpc3RlbmVyc1sgcmV2Q2hpbGRyZW5bal0gXSwgcGFyZW50LmRhdGEsIHJldkNoaWxkcmVuW2pdICk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwZW5kaW5nLmxlbmd0aCA9IDA7XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIGRpc3BhdGNoKCBsaXN0ZW5lcnMsIHZhbHVlLCBrZXkgKXtcclxuXHJcbiAgICAgICAgICAgIGlmKCAhbGlzdGVuZXJzIClcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIGZvciggdmFyIGk9MCwgbD1saXN0ZW5lcnMubGVuZ3RoOyBpPGw7ICsraSApXHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnNbaV0oIHZhbHVlLCBrZXkgKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gYXR0YWNoKCBrOlN0cmluZywgY2I6RnVuY3Rpb24gKVxyXG4gICAgLy8gbGlzdGVuIHRvIG5vdGlmaWNhdGlvbnMgZnJvbSBhIHBhcnRpY3VsYXIga2V5XHJcbiAgICAvLyBhdHRhY2goIGNiOkZ1bmN0aW9uIClcclxuICAgIC8vIGxpc3RlbiB0byBrZXkgYWRkaXRpb25zL3JlbW92YWxzXHJcbiAgICBhdHRhY2goaywgY2Ipe1xyXG4gICAgICAgIHZhciBrZXkgPSBrLnNwbGl0KFwiLlwiKTtcclxuICAgICAgICB2YXIgbW9kZWw7XHJcbiAgICAgICAgaWYoIGtleS5sZW5ndGggPT0gMSApe1xyXG4gICAgICAgICAgICBrZXkgPSBrO1xyXG4gICAgICAgICAgICBtb2RlbCA9IHRoaXM7XHJcbiAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgIGsgPSBrZXkucG9wKCk7XHJcbiAgICAgICAgICAgIG1vZGVsID0gdGhpcy5nZXRNb2RlbCgga2V5LCB0cnVlICk7XHJcbiAgICAgICAgICAgIGtleSA9IGs7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKCAhbW9kZWwubGlzdGVuZXJzW2tleV0gKVxyXG4gICAgICAgICAgICBtb2RlbC5saXN0ZW5lcnNba2V5XSA9IFsgY2IgXTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIG1vZGVsLmxpc3RlbmVyc1trZXldLnB1c2goY2IpO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICAvLyBzdG9wIGxpc3RlbmluZ1xyXG4gICAgZGV0YWNoKGssIGNiKXtcclxuXHJcbiAgICAgICAgdmFyIGluZGV4LCBsaXN0ZW5lcnM7XHJcblxyXG4gICAgICAgIGlmKCB0eXBlb2YgayA9PSBcImZ1bmN0aW9uXCIgKXtcclxuICAgICAgICAgICAgY2IgPSBrO1xyXG4gICAgICAgICAgICBrID0gXCJcIjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzW2tdO1xyXG4gICAgICAgIGlmKCAhbGlzdGVuZXJzW2tdIClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICBpbmRleCA9IGxpc3RlbmVycy5pbmRleE9mKGNiKTtcclxuICAgICAgICBpZiggaW5kZXggPT0gLTEgKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGlzdGVuZXJzLnNwbGljZSggaW5kZXgsIDEgKTtcclxuXHJcbiAgICB9XHJcblxyXG59XHJcblxyXG5jb25zdCBjYWNoZSA9IHt9O1xyXG5cclxuY2xhc3MgSVZpZXcge1xyXG5cclxuICAgIHN0YXRpYyBcIkBpbmplY3RcIiA9IHtcclxuICAgICAgICBwYXJlbnRFbGVtZW50OlwiUGFyZW50RWxlbWVudFwiLFxyXG4gICAgICAgIG1vZGVsOltNb2RlbCx7c2NvcGU6J3Jvb3QnfV1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdHJ1Y3RvciggY29udHJvbGxlciApe1xyXG5cclxuICAgICAgICB2YXIgbGF5b3V0ID0gXCJsYXlvdXRzL1wiICsgY29udHJvbGxlci5jb25zdHJ1Y3Rvci5uYW1lICsgXCIuaHRtbFwiO1xyXG4gICAgICAgIHRoaXMuY29udHJvbGxlciA9IGNvbnRyb2xsZXI7XHJcbiAgICAgICAgdGhpcy5kb20gPSBudWxsO1xyXG5cclxuICAgICAgICBpZiggIWNhY2hlW2xheW91dF0gKXtcclxuXHJcbiAgICAgICAgICAgIGZldGNoKCBsYXlvdXQgKVxyXG4gICAgICAgICAgICAudGhlbiggKHJzcCkgPT4ge1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKCAhcnNwLm9rICYmIHJzcC5zdGF0dXMgIT09IDAgKSB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgT0shXCIpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJzcC50ZXh0KCk7XHJcblxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAudGhlbiggdGV4dCA9PiAobmV3IHdpbmRvdy5ET01QYXJzZXIoKSkucGFyc2VGcm9tU3RyaW5nKHRleHQsIFwidGV4dC9odG1sXCIpKVxyXG4gICAgICAgICAgICAudGhlbigoaHRtbCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY2FjaGVbIGxheW91dCBdID0gaHRtbDtcclxuICAgICAgICAgICAgICAgIHRoaXMubG9hZExheW91dCggaHRtbCApO1xyXG4gICAgICAgICAgICB9KS5jYXRjaCggKGV4KSA9PiB7XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LmlubmVySFRNTCA9IGA8ZGl2PmAgKyAoZXgubWVzc2FnZSB8fCBleCkgKyBgOiAke2xheW91dH0hPC9kaXY+YDtcclxuXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICB9ZWxzZSBcclxuICAgICAgICAgICAgdGhpcy5sb2FkTGF5b3V0KCBjYWNoZVtsYXlvdXRdICk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGxvYWRMYXlvdXQoIGRvYyApe1xyXG4gICAgICAgIGRvYyA9IGRvYy5jbG9uZU5vZGUodHJ1ZSk7XHJcbiAgICAgICAgWy4uLmRvYy5ib2R5LmNoaWxkcmVuXS5mb3JFYWNoKCBjaGlsZCA9PiB0aGlzLnBhcmVudEVsZW1lbnQuYXBwZW5kQ2hpbGQoY2hpbGQpICk7XHJcblxyXG4gICAgICAgIHZhciBkb20gPSBuZXcgRE9NKCB0aGlzLnBhcmVudEVsZW1lbnQgKTtcclxuICAgICAgICB0aGlzLmRvbSA9IGRvbTtcclxuXHJcbiAgICAgICAgcHJlcGFyZURPTSggZG9tLCB0aGlzLmNvbnRyb2xsZXIsIHRoaXMubW9kZWwgKTtcclxuICAgIH1cclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByZXBhcmVET00oIGRvbSwgY29udHJvbGxlciwgX21vZGVsICl7XHJcblxyXG4gICAgZG9tLmZvckVhY2goKGVsZW1lbnQpID0+IHtcclxuXHJcbiAgICAgICAgaWYoIGVsZW1lbnQuZGF0YXNldC5zcmMgJiYgIWVsZW1lbnQuZGF0YXNldC5pbmplY3QgKXtcclxuICAgICAgICAgICAgc3dpdGNoKCBlbGVtZW50LnRhZ05hbWUgKXtcclxuICAgICAgICAgICAgY2FzZSAnVUwnOlxyXG4gICAgICAgICAgICBjYXNlICdPTCc6XHJcbiAgICAgICAgICAgICAgICB2YXIgdGVtcGxhdGUgPSBlbGVtZW50LmNsb25lTm9kZSh0cnVlKTtcclxuICAgICAgICAgICAgICAgIF9tb2RlbC5hdHRhY2goIGVsZW1lbnQuZGF0YXNldC5zcmMsIHJlbmRlckxpc3QuYmluZCggZWxlbWVudCwgdGVtcGxhdGUgKSApO1xyXG4gICAgICAgICAgICAgICAgcmVuZGVyTGlzdCggZWxlbWVudCwgdGVtcGxhdGUsIF9tb2RlbC5nZXRJdGVtKCBlbGVtZW50LmRhdGFzZXQuc3JjICkgKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciggdmFyIGk9MDsgaTxlbGVtZW50LmF0dHJpYnV0ZXMubGVuZ3RoOyArK2kgKXtcclxuICAgICAgICAgICAgdmFyIGtleSA9IGVsZW1lbnQuYXR0cmlidXRlc1tpXS5uYW1lO1xyXG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBlbGVtZW50LmF0dHJpYnV0ZXNbaV0udmFsdWU7XHJcblxyXG4gICAgICAgICAgICB2YXIgcGFydHMgPSBrZXkuc3BsaXQoXCItXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYoIHBhcnRzLmxlbmd0aCA9PSAyIClcclxuICAgICAgICAgICAgICAgIHN3aXRjaCggcGFydHNbMV0gKXtcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJjYWxsXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IHJlYWRNZXRob2QoIHZhbHVlLCBjb250cm9sbGVyLCBkb20gKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiggdGFyZ2V0IClcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCBwYXJ0c1swXSwgdGFyZ2V0ICk7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJDb3VsZCBub3QgYmluZCBldmVudCB0byBcIiArIGNvbnRyb2xsZXIuY29uc3RydWN0b3IubmFtZSArIFwiLlwiICsgbmFtZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgICAgIGNhc2UgXCJ0b2dnbGVcIjpcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdnBhcnRzID0gdmFsdWUubWF0Y2goL14oW15AXSspXFxAKFtePV0rKVxcPSguKykkLyk7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIHZwYXJ0cyApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRUb2dnbGUoIGVsZW1lbnQsIHBhcnRzWzBdLCB2cGFydHMgKTtcclxuICAgICAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkNvdWxkIG5vdCBwYXJzZSB0b2dnbGU6IFwiICsgdmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBtZW1vID0geyBfX3NyYzp2YWx1ZSwgX19obmQ6MCB9O1xyXG4gICAgICAgICAgICB2YWx1ZS5yZXBsYWNlKC9cXHtcXHsoW15cXH1dKylcXH1cXH0vZywgYmluZEF0dHJpYnV0ZS5iaW5kKCBudWxsLCBlbGVtZW50LmF0dHJpYnV0ZXNbaV0sIG1lbW8gKSk7XHJcbiAgICAgICAgICAgIHVwZGF0ZUF0dHJpYnV0ZSggZWxlbWVudC5hdHRyaWJ1dGVzW2ldLCBtZW1vICk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiggZWxlbWVudC5kYXRhc2V0LmluamVjdCAmJiBlbGVtZW50ICE9IGRvbS5lbGVtZW50ICl7XHJcblxyXG4gICAgICAgICAgICBsZXQgY2hpbGREb20gPSBuZXcgRE9NKGVsZW1lbnQpO1xyXG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKCBjaGlsZERvbSwgY2hpbGREb20uaW5kZXgoXCJpZFwiKSApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIGN0cmwgPSBnZXRJbnN0YW5jZU9mKCBlbGVtZW50LmRhdGFzZXQuaW5qZWN0LCBjaGlsZERvbSApO1xyXG4gICAgICAgICAgICBkb21bZWxlbWVudC5kYXRhc2V0LmluamVjdF0gPSBjdHJsO1xyXG5cclxuICAgICAgICAgICAgcHJlcGFyZURPTSggY2hpbGREb20sIGN0cmwgKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfSk7XHJcblxyXG4gICAgZnVuY3Rpb24gYmluZFRvZ2dsZSggZWxlbWVudCwgZXZlbnQsIGNtZCApe1xyXG4gICAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggZXZlbnQsICgpPT57XHJcbiAgICAgICAgICAgIFsuLi5kb20uZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGNtZFsxXSldLmZvckVhY2goIHRhcmdldCA9PiB0YXJnZXQuc2V0QXR0cmlidXRlKGNtZFsyXSwgY21kWzNdKSApO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBmdW5jdGlvbiByZW5kZXJMaXN0KCBlbGVtZW50LCB0ZW1wbGF0ZSwgYXJyICl7XHJcblxyXG4gICAgICAgIHdoaWxlKCBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCApXHJcbiAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQ2hpbGQoIGVsZW1lbnQuY2hpbGRyZW5bMF0gKTtcclxuICAgICAgICBcclxuICAgICAgICBmb3IoIHZhciBrZXkgaW4gYXJyICl7XHJcblxyXG4gICAgICAgICAgICB2YXIgY2hpbGRNb2RlbCA9IG5ldyBNb2RlbCgpO1xyXG4gICAgICAgICAgICBjaGlsZE1vZGVsLmxvYWQoIF9tb2RlbC5kYXRhICk7XHJcbiAgICAgICAgICAgIGNoaWxkTW9kZWwuc2V0SXRlbShcImtleVwiLCBrZXkpO1xyXG4gICAgICAgICAgICBjaGlsZE1vZGVsLnNldEl0ZW0oXCJ2YWx1ZVwiLCBhcnJba2V5XSk7XHJcbiAgICAgICAgICAgIGNoaWxkTW9kZWwucm9vdCA9IF9tb2RlbC5yb290O1xyXG5cclxuICAgICAgICAgICAgWy4uLnRlbXBsYXRlLmNsb25lTm9kZSh0cnVlKS5jaGlsZHJlbl0uZm9yRWFjaChjaGlsZCA9PiB7XHJcblxyXG4gICAgICAgICAgICAgICAgZWxlbWVudC5hcHBlbmRDaGlsZCggY2hpbGQgKTtcclxuICAgICAgICAgICAgICAgIHByZXBhcmVET00oIG5ldyBET00oY2hpbGQpLCBjb250cm9sbGVyLCBjaGlsZE1vZGVsICk7XHJcblxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBiaW5kQXR0cmlidXRlKCBhdHRyLCBtZW1vLCBtYXRjaCwgaW5uZXIgKXtcclxuXHJcbiAgICAgICAgaWYoIGlubmVyIGluIG1lbW8gKSByZXR1cm4gXCJcIjtcclxuXHJcbiAgICAgICAgX21vZGVsLmF0dGFjaCggaW5uZXIsICh2YWx1ZSk9PntcclxuICAgICAgICAgICAgbWVtb1tpbm5lcl0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgaWYoIG1lbW8uX19obmQgKSByZXR1cm47XHJcbiAgICAgICAgICAgIG1lbW8uX19obmQgPSBzZXRUaW1lb3V0KCB1cGRhdGVBdHRyaWJ1dGUuYmluZCggbnVsbCwgYXR0ciwgbWVtbyApLCAxICk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIG1lbW9baW5uZXJdID0gX21vZGVsLmdldEl0ZW0oaW5uZXIpO1xyXG5cclxuICAgICAgICByZXR1cm4gXCJcIjtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlQXR0cmlidXRlKCBhdHRyLCBtZW1vICl7XHJcbiAgICAgICAgbWVtby5fX2huZCA9IDA7XHJcbiAgICAgICAgYXR0ci52YWx1ZSA9IG1lbW8uX19zcmMucmVwbGFjZShcclxuXHRcdC9cXHtcXHsoW15cXH1dKylcXH1cXH0vZyxcclxuXHQgICAgKG1hdGNoLCBwYXRoKSA9PiB0eXBlb2YgbWVtb1twYXRoXSA9PSBcIm9iamVjdFwiID9cclxuXHRcdEpTT04uc3RyaW5naWZ5KG1lbW9bcGF0aF0pXHJcblx0XHQ6IG1lbW9bcGF0aF1cclxuXHQpO1xyXG4gICAgfVxyXG5cclxufVxyXG5cclxudmFyIGRlZmF1bHRNb2RlbCA9IG51bGw7XHJcblxyXG5jbGFzcyBJQ29udHJvbGxlciB7XHJcblxyXG4gICAgc3RhdGljIFwiQGluamVjdFwiID0ge1xyXG4gICAgICAgIHZpZXdGYWN0b3J5OklWaWV3LFxyXG4gICAgICAgIHBvb2w6XCJwb29sXCIsXHJcbiAgICAgICAgbW9kZWw6TW9kZWxcclxuICAgIH1cclxuXHJcbiAgICBjb25zdHJ1Y3RvciggKXtcclxuXHJcbiAgICAgICAgdGhpcy5wb29sLmFkZCh0aGlzKTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgX3Nob3coKXtcclxuICAgICAgICBjb25zb2xlLmxvZyhcImNyZWF0ZWQgdmlld1wiKTtcclxuICAgICAgICB0aGlzLnBvb2wuY2FsbCggXCJzZXRBY3RpdmVWaWV3XCIsIG51bGwgKTtcdFxyXG4gICAgICAgIHZhciB2aWV3ID0gdGhpcy52aWV3RmFjdG9yeSggdGhpcyApO1xyXG4gICAgICAgIHJldHVybiB2aWV3O1xyXG4gICAgfVxyXG5cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIGJvb3QoIHsgbWFpbiwgZWxlbWVudCwgY29tcG9uZW50cywgZW50aXRpZXMgfSApe1xyXG5cclxuICAgIGJpbmQoUG9vbCkudG8oJ3Bvb2wnKS5zaW5nbGV0b24oKTtcclxuICAgIGJpbmQoTW9kZWwpLnRvKE1vZGVsKS53aXRoVGFncyh7c2NvcGU6J3Jvb3QnfSkuc2luZ2xldG9uKCk7XHJcblxyXG4gICAgZm9yKCB2YXIgayBpbiBjb21wb25lbnRzIClcclxuICAgICAgICBiaW5kKCBjb21wb25lbnRzW2tdICkudG8oIGsgKTtcclxuXHJcbiAgICBmb3IoIHZhciBrIGluIGVudGl0aWVzICl7XHJcbiAgICAgICAgdmFyIGN0cmwgPSBlbnRpdGllc1trXTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyggXCJBZGRpbmcgZW50aXR5IFwiICsgaywgY3RybCApO1xyXG4gICAgICAgIGJpbmQoY3RybCkudG8oSUNvbnRyb2xsZXIpO1xyXG4gICAgICAgIGJpbmQoSVZpZXcpXHJcbiAgICAgICAgICAgIC50byhJVmlldylcclxuICAgICAgICAgICAgLmluamVjdGluZyhcclxuICAgICAgICAgICAgICAgIFtkb2N1bWVudC5ib2R5LCAnUGFyZW50RWxlbWVudCddXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgICAgLndpdGhUYWdzKHtjb250cm9sbGVyOmN0cmx9KVxyXG4gICAgICAgICAgICAuZmFjdG9yeSgpOyBcclxuICAgIH1cclxuXHJcbiAgICBiaW5kKG1haW4pLnRvKG1haW4pLmluamVjdGluZyhbbmV3IERPTShlbGVtZW50KSwgRE9NXSk7XHJcbiAgICBnZXRJbnN0YW5jZU9mKCBtYWluICk7XHJcblxyXG59XHJcblxyXG5cclxuZXhwb3J0IHsgTW9kZWwsIElWaWV3LCBJQ29udHJvbGxlciwgYm9vdCB9O1xyXG5cclxuIiwidmFyIG5leHRVSUQgPSAwO1xyXG5cclxuZnVuY3Rpb24gZ2V0VUlEKCl7XHJcbiAgICByZXR1cm4gKytuZXh0VUlEO1xyXG59XHJcblxyXG5mdW5jdGlvbiBQb29sKCkge1xyXG4gICAgdmFyIG1ldGhvZHMgPSB7XHJcbiAgICAgICAgY29uc3RydWN0b3I6IFtdXHJcbiAgICB9O1xyXG4gICAgdmFyIHNpbGVuY2UgPSB7XHJcbiAgICAgICAgXCJvblRpY2tcIjogMSxcclxuICAgICAgICBcIm9uUG9zdFRpY2tcIjogMSxcclxuICAgICAgICBcIm9uUmVuZGVyXCI6IDFcclxuICAgIH07XHJcbiAgICB2YXIgZGVidWcgPSBudWxsO1xyXG4gICAgdmFyIHByb3hpZXMgPSBbXTtcclxuICAgIHZhciBjb250ZW50cyA9IHt9O1xyXG5cclxuICAgIGZ1bmN0aW9uIG9uRXZlbnQoZSkge1xyXG4gICAgICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldDtcclxuICAgICAgICB2YXIgbmFtZXMgPSAodGFyZ2V0LmNsYXNzTmFtZSB8fCBcIlwiKS5zcGxpdCgvXFxzKy8pLmZpbHRlcihmdW5jdGlvbihuKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuLmxlbmd0aCA+IDA7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHZhciBldmVudCA9IGUudHlwZTtcclxuICAgICAgICBldmVudCA9IGV2ZW50LnN1YnN0cigwLCAxKS50b1VwcGVyQ2FzZSgpICsgZXZlbnQuc3Vic3RyKDEpO1xyXG5cclxuICAgICAgICB3aGlsZSAodGFyZ2V0KSB7XHJcbiAgICAgICAgICAgIHZhciBpZCA9IHRhcmdldC5pZDtcclxuICAgICAgICAgICAgaWYgKHRhcmdldC5vbmNsaWNrKSByZXR1cm47XHJcbiAgICAgICAgICAgIGlmIChpZCkge1xyXG4gICAgICAgICAgICAgICAgaWQgPSBpZC5zdWJzdHIoMCwgMSkudG9VcHBlckNhc2UoKSArIGlkLnN1YnN0cigxKTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgaSA9IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZTtcclxuICAgICAgICAgICAgICAgIGlmIChuYW1lcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAobmFtZSA9IG5hbWVzW2krK10pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDAsIDEpLnRvVXBwZXJDYXNlKCkgKyBuYW1lLnN1YnN0cigxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJCQoXCJvblwiICsgZXZlbnQgKyBpZCArIG5hbWUsIHRhcmdldCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAkJChcIm9uXCIgKyBldmVudCArIGlkLCB0YXJnZXQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbih0YXJnZXQsIGFyZ3MpIHtcclxuICAgICAgICBpZiAoIWFyZ3MgJiYgdGFyZ2V0ICYmIERPQy50eXBlT2YodGFyZ2V0KSA9PSBcImFycmF5XCIpIHtcclxuICAgICAgICAgICAgYXJncyA9IHRhcmdldDtcclxuICAgICAgICAgICAgdGFyZ2V0ID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0YXJnZXQpIHRhcmdldCA9IGRvY3VtZW50LmJvZHk7XHJcbiAgICAgICAgaWYgKCFhcmdzKSB7XHJcbiAgICAgICAgICAgIGFyZ3MgPSBbXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgayBpbiB0YXJnZXQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBtID0gay5tYXRjaCgvXm9uKC4rKS8pO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFtKSBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGFyZ3MucHVzaChtWzFdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBhcmdzLmZvckVhY2goZnVuY3Rpb24oYXJnKSB7XHJcbiAgICAgICAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKGFyZywgb25FdmVudCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuZGVidWcgPSBmdW5jdGlvbihtKSB7XHJcbiAgICAgICAgZGVidWcgPSBtO1xyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnNpbGVuY2UgPSBmdW5jdGlvbihtKSB7XHJcbiAgICAgICAgc2lsZW5jZVttXSA9IDE7XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuYWRkUHJveHkgPSBmdW5jdGlvbihvYmopIHtcclxuICAgICAgICBpZiAob2JqICYmIG9iai5jYWxsKSBwcm94aWVzLnB1c2gob2JqKTtcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5yZW1vdmVQcm94eSA9IGZ1bmN0aW9uKG9iaikge1xyXG4gICAgICAgIHZhciBpID0gcHJveGllcy5pbmRleE9mKG9iaik7XHJcbiAgICAgICAgaWYgKGkgPT0gLTEpIHJldHVybjtcclxuICAgICAgICBwcm94aWVzLnNwbGljZShpLCAxKTtcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5hZGQgPSBmdW5jdGlvbihvYmosIGVuYWJsZURpcmVjdE1zZykge1xyXG4gICAgICAgIGlmICghb2JqKSByZXR1cm47XHJcbiAgICAgICAgaWYgKGRlYnVnICYmIG9iai5jb25zdHJ1Y3Rvci5uYW1lID09IGRlYnVnKSBjb25zb2xlLmxvZyhcImFkZFwiLCBvYmopO1xyXG5cclxuICAgICAgICBpZiAoIShcIl9fdWlkXCIgaW4gb2JqKSkgb2JqLl9fdWlkID0gZ2V0VUlEKCk7XHJcblxyXG4gICAgICAgIGlmICghKFwiX191aWRcIiBpbiBvYmopKSBjb25zb2xlLndhcm4oXCJDb3VsZCBub3QgYWRkIF9fdWlkIHRvIFwiLCBvYmosIG9iai5jb25zdHJ1Y3Rvci5uYW1lKTtcclxuXHJcbiAgICAgICAgY29udGVudHNbb2JqLl9fdWlkXSA9IG9iajtcclxuICAgICAgICB2YXIgY2xhenogPSBvYmouY29uc3RydWN0b3I7XHJcbiAgICAgICAgaWYgKG9iai5tZXRob2RzIHx8IGNsYXp6Lm1ldGhvZHMpIHtcclxuICAgICAgICAgICAgdmFyIGFyciA9IG9iai5tZXRob2RzIHx8IGNsYXp6Lm1ldGhvZHM7XHJcbiAgICAgICAgICAgIGlmICghKGFyciBpbnN0YW5jZW9mIEFycmF5KSkgYXJyID0gT2JqZWN0LmtleXMoYXJyKTtcclxuICAgICAgICAgICAgdmFyIGwgPSBhcnIubGVuZ3RoO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGw7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIG0gPSBhcnJbaV07XHJcbiAgICAgICAgICAgICAgICBpZiAobSAmJiBtWzBdICE9IFwiX1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saXN0ZW4ob2JqLCBtLCBlbmFibGVEaXJlY3RNc2cpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbGF6ei5tZXRhW21dICYmIGNsYXp6Lm1ldGFbbV0uc2lsZW5jZSkgdGhpcy5zaWxlbmNlKG0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIHByb3BlcnRpZXMgPSB7fSwgY29iaiA9IG9iajtcclxuICAgICAgICAgICAgZG97XHJcbiAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKCBwcm9wZXJ0aWVzLCBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyhjb2JqKSApO1xyXG4gICAgICAgICAgICB9d2hpbGUoIGNvYmogPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YoY29iaikgKTtcclxuXHJcbiAgICAgICAgICAgIGZvciAoIHZhciBrIGluIHByb3BlcnRpZXMgKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9ialtrXSAhPSBcImZ1bmN0aW9uXCIpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgaWYgKGsgJiYga1swXSAhPSBcIl9cIikgdGhpcy5saXN0ZW4ob2JqLCBrKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5yZW1vdmUgPSBmdW5jdGlvbihvYmopIHtcclxuICAgICAgICBpZiAob2JqLmNvbnN0cnVjdG9yLm5hbWUgPT0gZGVidWcpIGNvbnNvbGUubG9nKFwicmVtb3ZlXCIsIG9iaik7XHJcblxyXG4gICAgICAgIGRlbGV0ZSBjb250ZW50c1tvYmouX191aWRdO1xyXG5cclxuXHRpZiggb2JqLm1ldGhvZHMgfHwgb2JqLmNvbnN0cnVjdG9yLm1ldGhvZHMgKXtcclxuICAgICAgICAgICAgZm9yICh2YXIgayBpbiAob2JqLm1ldGhvZHMgfHwgb2JqLmNvbnN0cnVjdG9yLm1ldGhvZHMpIClcclxuXHRcdHRoaXMubXV0ZShvYmosIGspO1xyXG5cdH1lbHNle1xyXG4gICAgICAgICAgICB2YXIgcHJvcGVydGllcyA9IHt9LCBjb2JqID0gb2JqO1xyXG4gICAgICAgICAgICBkb3tcclxuICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oIHByb3BlcnRpZXMsIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKGNvYmopICk7XHJcbiAgICAgICAgICAgIH13aGlsZSggY29iaiA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihjb2JqKSApO1xyXG5cclxuICAgICAgICAgICAgZm9yICggdmFyIGsgaW4gcHJvcGVydGllcyApXHJcblx0XHR0aGlzLm11dGUob2JqLCBrKTtcclxuXHR9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMucG9sbCA9IGZ1bmN0aW9uKHQpIHtcclxuICAgICAgICBpZiAoIXQpIHJldHVybiBjb250ZW50cztcclxuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGNvbnRlbnRzKTtcclxuICAgICAgICB2YXIgcmV0ID0gW107XHJcbiAgICAgICAgdmFyIGNvdW50ID0gMDtcclxuICAgICAgICBmb3IgKDsgY291bnQgPCBrZXlzLmxlbmd0aDsgKytjb3VudClcclxuICAgICAgICByZXQucHVzaCh0KGNvbnRlbnRzW2tleXNbY291bnRdXSkpO1xyXG4gICAgICAgIHJldHVybiByZXQ7XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMubGlzdGVuID0gZnVuY3Rpb24ob2JqLCBuYW1lLCBlbmFibGVEaXJlY3RNc2cpIHtcclxuICAgICAgICB2YXIgbWV0aG9kID0gb2JqW25hbWVdO1xyXG4gICAgICAgIGlmICh0eXBlb2YgbWV0aG9kICE9IFwiZnVuY3Rpb25cIikgcmV0dXJuO1xyXG5cclxuICAgICAgICB2YXIgYXJyID0gbWV0aG9kc1tuYW1lXTtcclxuICAgICAgICBpZiAoIWFycikgYXJyID0gbWV0aG9kc1tuYW1lXSA9IHt9O1xyXG4gICAgICAgIGFycltvYmouX191aWRdID0ge1xyXG4gICAgICAgICAgICBUSElTOiBvYmosXHJcbiAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKGVuYWJsZURpcmVjdE1zZykge1xyXG4gICAgICAgICAgICBhcnIgPSBtZXRob2RzW25hbWUgKyBvYmouX191aWRdO1xyXG4gICAgICAgICAgICBpZiAoIWFycikgYXJyID0gbWV0aG9kc1tuYW1lICsgb2JqLl9fdWlkXSA9IHt9O1xyXG4gICAgICAgICAgICBhcnJbb2JqLl9fdWlkXSA9IHtcclxuICAgICAgICAgICAgICAgIFRISVM6IG9iaixcclxuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLm11dGUgPSBmdW5jdGlvbihvYmosIG5hbWUpIHtcclxuICAgICAgICB2YXIgbWV0aG9kID0gb2JqW25hbWVdO1xyXG4gICAgICAgIHZhciBsaXN0ZW5lcnMgPSBtZXRob2RzW25hbWVdO1xyXG4gICAgICAgIGlmICghbGlzdGVuZXJzKSByZXR1cm47XHJcbiAgICAgICAgZGVsZXRlIGxpc3RlbmVyc1tvYmouX191aWRdO1xyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLmNhbGwgPSBmdW5jdGlvbihtZXRob2QpIHtcclxuICAgICAgICBpZiAobWV0aG9kID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlVuZGVmaW5lZCBjYWxsXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgaSwgbDtcclxuXHJcbiAgICAgICAgLyogKiAvXHJcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XHJcbiAgICAvKi9cclxuICAgICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XHJcbiAgICAgICAgZm9yIChpID0gMSwgbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgIC8qICovXHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBwcm94aWVzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHByb3hpZXNbaV0uY2FsbChtZXRob2QsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IG1ldGhvZHNbbWV0aG9kXTtcclxuICAgICAgICBpZiAoIWxpc3RlbmVycykge1xyXG4gICAgICAgICAgICBpZiAoIShtZXRob2QgaW4gc2lsZW5jZSkpIGNvbnNvbGUubG9nKG1ldGhvZCArIFwiOiAwXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGxpc3RlbmVycyk7XHJcbiAgICAgICAgdmFyIHJldDsgLy89dW5kZWZpbmVkXHJcbiAgICAgICAgdmFyIGNvdW50ID0gMCxcclxuICAgICAgICAgICAgYztcclxuICAgICAgICBmb3IgKDsgY291bnQgPCBrZXlzLmxlbmd0aDsgKytjb3VudCkge1xyXG4gICAgICAgICAgICBjID0gbGlzdGVuZXJzW2tleXNbY291bnRdXTtcclxuXHJcbiAgICAgICAgICAgIC8vIERFQlVHXHJcbiAgICAgICAgICAgIGlmIChkZWJ1ZyAmJiAobWV0aG9kID09IGRlYnVnIHx8IGMuVEhJUy5jb25zdHJ1Y3Rvci5uYW1lID09IGRlYnVnKSkgY29uc29sZS5sb2coYy5USElTLCBtZXRob2QsIGFyZ3MpO1xyXG4gICAgICAgICAgICAvLyBFTkQtREVCVUdcclxuXHJcbiAgICAgICAgICAgIHZhciBscmV0ID0gYyAmJiBjLm1ldGhvZC5hcHBseShjLlRISVMsIGFyZ3MpO1xyXG4gICAgICAgICAgICBpZiAobHJldCAhPT0gdW5kZWZpbmVkKSByZXQgPSBscmV0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIShtZXRob2QgaW4gc2lsZW5jZSkpIGNvbnNvbGUubG9nKG1ldGhvZCArIFwiOiBcIiArIGNvdW50KTtcclxuICAgICAgICByZXR1cm4gcmV0O1xyXG4gICAgfTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBQb29sO1xyXG4iLCJcclxuZnVuY3Rpb24gc3RvcmUoIG9iaiwgYXNCdWZmZXIgKXtcclxuXHJcbiAgICBpZiggdHlwZW9mIG9iaiA9PSBcImZ1bmN0aW9uXCIgKSBvYmogPSB1bmRlZmluZWQ7XHJcbiAgICBpZiggIW9iaiB8fCB0eXBlb2Ygb2JqICE9IFwib2JqZWN0XCIgKVxyXG4gICAgICAgIHJldHVybiBvYmo7XHJcblxyXG4gICAgdmFyIGluc3QgPSBbXSwgc3RySW5kZXggPSB7XCJPYmplY3RcIjotMixcIkFycmF5XCI6LTN9LCBhcnJJbmRleCA9IHt9LCBvYmpJbmRleCA9IFtdO1xyXG5cclxuICAgIGFkZCggb2JqICk7XHJcblxyXG4gICAgaWYoIGFzQnVmZmVyIClcclxuICAgICAgICByZXR1cm4gdG9CdWZmZXIoIGluc3QgKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIGluc3Q7XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkKCBvYmogKXtcclxuICAgICAgICB2YXIgdHlwZSA9IHR5cGVvZiBvYmo7XHJcbiAgICAgICAgaWYoIHR5cGUgPT0gXCJmdW5jdGlvblwiICl7XHJcbiAgICAgICAgICAgIG9iaiA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgdHlwZSA9IHR5cGVvZiBvYmo7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgaW5kZXg7XHJcbiAgICAgICAgaWYoIG9iaiA9PT0gdW5kZWZpbmVkICl7XHJcbiAgICAgICAgICAgIGluZGV4ID0gLTQ7XHJcbiAgICAgICAgfWVsc2UgaWYoIHR5cGUgPT0gXCJzdHJpbmdcIiApe1xyXG4gICAgICAgICAgICBpbmRleCA9IHN0ckluZGV4W29ial07XHJcbiAgICAgICAgICAgIGlmKCBpbmRleCA9PT0gdW5kZWZpbmVkIClcclxuICAgICAgICAgICAgICAgIGluZGV4ID0gLTE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaW5kZXggPSBpbnN0LmluZGV4T2Yob2JqKTtcclxuXHJcbiAgICAgICAgaWYoIGluZGV4ICE9IC0xICkgcmV0dXJuIGluZGV4O1xyXG5cclxuICAgICAgICBpZiggdHlwZSA9PSBcIm9iamVjdFwiICl7XHJcbiAgICAgICAgICAgIGluZGV4ID0gb2JqSW5kZXguaW5kZXhPZihvYmopO1xyXG4gICAgICAgICAgICBpZiggaW5kZXggIT0gLTEgKSByZXR1cm4gaW5kZXg7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpbmRleCA9IGluc3QubGVuZ3RoO1xyXG4gICAgICAgIGluc3RbaW5kZXhdID0gb2JqO1xyXG5cclxuICAgICAgICBpZiggdHlwZSA9PSBcInN0cmluZ1wiIClcclxuICAgICAgICAgICAgc3RySW5kZXhbb2JqXSA9IGluZGV4O1xyXG5cclxuICAgICAgICBpZiggIW9iaiB8fCB0eXBlICE9IFwib2JqZWN0XCIgKVxyXG4gICAgICAgICAgICByZXR1cm4gaW5kZXg7XHJcbiAgICAgICAgXHJcbiAgICAgICAgb2JqSW5kZXhbIGluZGV4IF0gPSBvYmo7XHJcblxyXG4gICAgICAgIHZhciBjdG9ySW5kZXggPSBhZGQoIG9iai5jb25zdHJ1Y3Rvci5mdWxsTmFtZSB8fCBvYmouY29uc3RydWN0b3IubmFtZSApO1xyXG5cclxuICAgICAgICBpZiggb2JqLmJ1ZmZlciAmJiBvYmouYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgKXtcclxuXHJcbiAgICAgICAgICAgIGlmKCAhYXNCdWZmZXIgKVxyXG4gICAgICAgICAgICAgICAgb2JqID0gQXJyYXkuZnJvbSggb2JqICk7XHJcblxyXG4gICAgICAgICAgICBpbnN0W2luZGV4XSA9IFtjdG9ySW5kZXgsIC0zLCBvYmpdO1xyXG4gICAgICAgICAgICByZXR1cm4gaW5kZXg7XHJcbiAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBrZXksIGtleVNldCA9IFtdO1xyXG4gICAgICAgIGZvcigga2V5IGluIG9iaiApe1xyXG4gICAgICAgICAgICBpZiggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSApe1xyXG4gICAgICAgICAgICAgICAgdmFyIGtleUluZGV4ID0gc3RySW5kZXhba2V5XTtcclxuICAgICAgICAgICAgICAgIGlmKCBrZXlJbmRleCA9PT0gdW5kZWZpbmVkICl7XHJcbiAgICAgICAgICAgICAgICAgICAga2V5SW5kZXggPSBpbnN0Lmxlbmd0aDtcclxuICAgICAgICAgICAgICAgICAgICBpbnN0W2tleUluZGV4XSA9IGtleTtcclxuICAgICAgICAgICAgICAgICAgICBzdHJJbmRleFtrZXldID0ga2V5SW5kZXg7XHJcbiAgICAgICAgICAgICAgICAgICAga2V5SW5kZXggPSAtMTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGtleVNldFtrZXlTZXQubGVuZ3RoXSA9IGtleUluZGV4O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgc3RyS2V5U2V0ID0gSlNPTi5zdHJpbmdpZnkoa2V5U2V0KTtcclxuICAgICAgICBrZXlJbmRleCA9IGFyckluZGV4WyBzdHJLZXlTZXQgXTtcclxuICAgICAgICBpZigga2V5SW5kZXggPT09IHVuZGVmaW5lZCApe1xyXG4gICAgICAgICAgICBrZXlJbmRleCA9IGluc3QubGVuZ3RoO1xyXG4gICAgICAgICAgICBpbnN0W2tleUluZGV4XSA9IGtleVNldDtcclxuICAgICAgICAgICAgYXJySW5kZXhbc3RyS2V5U2V0XSA9IGtleUluZGV4O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHZhbHVlU2V0ID0gWyBjdG9ySW5kZXgsIGtleUluZGV4IF07XHJcblxyXG4gICAgICAgIGZvcigga2V5IGluIG9iaiApe1xyXG4gICAgICAgICAgICBpZiggb2JqLmhhc093blByb3BlcnR5KGtleSkgKXtcclxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IG9ialtrZXldO1xyXG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlSW5kZXggPSBhZGQoIHZhbHVlICk7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZVNldFt2YWx1ZVNldC5sZW5ndGhdID0gdmFsdWVJbmRleDsgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN0cktleVNldCA9IEpTT04uc3RyaW5naWZ5KHZhbHVlU2V0KTtcclxuICAgICAgICBrZXlJbmRleCA9IGFyckluZGV4WyBzdHJLZXlTZXQgXTtcclxuICAgICAgICBpZigga2V5SW5kZXggPT09IHVuZGVmaW5lZCApe1xyXG4gICAgICAgICAgICBhcnJJbmRleFtzdHJLZXlTZXRdID0gaW5kZXg7XHJcbiAgICAgICAgICAgIGluc3RbaW5kZXhdID0gdmFsdWVTZXQ7XHJcbiAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgIGluc3RbaW5kZXhdID0gW2tleUluZGV4XTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBpbmRleDtcclxuICAgIH1cclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGxvYWQoIGFyciwgaXNCdWZmZXIgKXtcclxuXHJcbiAgICBpZiggaXNCdWZmZXIgfHwgKGFyciAmJiBhcnIuYnVmZmVyKSApXHJcbiAgICAgICAgYXJyID0gZnJvbUJ1ZmZlciggYXJyICk7XHJcblxyXG4gICAgdmFyIFNFTEYgPSBudWxsO1xyXG5cclxuICAgIGlmKCAhYXJyIHx8IHR5cGVvZiBhcnIgIT09IFwib2JqZWN0XCIgKVxyXG4gICAgICAgIHJldHVybiBhcnI7XHJcbiAgICBcclxuICAgIGlmKCAhQXJyYXkuaXNBcnJheShhcnIpIClcclxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG5cclxuICAgIChmdW5jdGlvbigpeyB0cnl7U0VMRj13aW5kb3c7fWNhdGNoKGV4KXt9IH0pKCk7XHJcbiAgICBpZiggIVNFTEYgKVxyXG4gICAgICAgIChmdW5jdGlvbigpeyB0cnl7U0VMRj1nbG9iYWw7fWNhdGNoKGV4KXt9IH0pKCk7XHJcblxyXG4gICAgdmFyIG9iamVjdHMgPSBbXTtcclxuXHJcbiAgICB2YXIgY3Vyc29yID0gMDtcclxuICAgIHJldHVybiByZWFkKC0xKTtcclxuXHJcbiAgICBmdW5jdGlvbiByZWFkKCBwb3MgKXtcclxuXHJcbiAgICAgICAgc3dpdGNoKCBwb3MgKXtcclxuICAgICAgICBjYXNlIC0xOlxyXG4gICAgICAgICAgICBwb3MgPSBjdXJzb3I7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgLTI6XHJcbiAgICAgICAgICAgIHJldHVybiBcIk9iamVjdFwiO1xyXG4gICAgICAgIGNhc2UgLTM6XHJcbiAgICAgICAgICAgIHJldHVybiBcIkFycmF5XCI7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgaWYoIG9iamVjdHNbcG9zXSApXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqZWN0c1twb3NdO1xyXG5cclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiggcG9zID09IGN1cnNvciApXHJcbiAgICAgICAgICAgIGN1cnNvcisrO1xyXG5cclxuICAgICAgICB2YXIgdmFsdWUgPSBhcnJbcG9zXTtcclxuICAgICAgICBpZiggIXZhbHVlICkgcmV0dXJuIHZhbHVlO1xyXG5cclxuICAgICAgICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcclxuICAgICAgICBpZiggdHlwZSAhPSBcIm9iamVjdFwiICkgcmV0dXJuIHZhbHVlO1xyXG5cclxuICAgICAgICBpZiggdmFsdWUubGVuZ3RoID09IDEgKVxyXG4gICAgICAgICAgICB2YWx1ZSA9IGFyclsgdmFsdWVbMF0gXTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY2xhc3NOYW1lID0gcmVhZCggdmFsdWVbMF0gKTtcclxuXHJcbiAgICAgICAgaWYoICFjbGFzc05hbWUuc3BsaXQgKVxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyggY2xhc3NOYW1lLCB2YWx1ZVswXSApO1xyXG5cclxuICAgICAgICB2YXIgY3RvciA9IFNFTEYsIG9iajtcclxuICAgICAgICBjbGFzc05hbWUuc3BsaXQoXCIuXCIpLmZvckVhY2goIHBhcnQgPT4gY3RvciA9IGN0b3JbcGFydF0gKTtcclxuXHJcbiAgICAgICAgaWYoIHZhbHVlWzFdICE9PSAtMyApe1xyXG4gICAgICAgICAgICBvYmogPSBuZXcgY3RvcigpO1xyXG4gICAgICAgICAgICBvYmplY3RzWyBwb3MgXSA9IG9iajtcclxuXHJcbiAgICAgICAgICAgIHZhciBmaWVsZFJlZkxpc3QsIG11c3RBZGQgPSB2YWx1ZVsxXSA+IHBvcztcclxuXHJcbiAgICAgICAgICAgIGZpZWxkUmVmTGlzdCA9IGFyclsgdmFsdWVbMV0gXTtcclxuXHJcbiAgICAgICAgICAgIHZhciBmaWVsZExpc3QgPSBmaWVsZFJlZkxpc3QubWFwKCByZWYgPT4gcmVhZChyZWYpICk7XHJcblxyXG4gICAgICAgICAgICBpZiggbXVzdEFkZCApIGN1cnNvcisrO1xyXG5cclxuXHJcbiAgICAgICAgICAgIGZvciggdmFyIGk9MjsgaTx2YWx1ZS5sZW5ndGg7ICsraSApe1xyXG4gICAgICAgICAgICAgICAgdmFyIHZpID0gdmFsdWVbaV07XHJcbiAgICAgICAgICAgICAgICBpZiggdmkgIT09IC00IClcclxuICAgICAgICAgICAgICAgICAgICBvYmpbIGZpZWxkTGlzdFtpLTJdIF0gPSByZWFkKHZpKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICB9IGVsc2Uge1xyXG5cclxuICAgICAgICAgICAgb2JqID0gdmFsdWVbMl07XHJcbiAgICAgICAgICAgIGlmKCAhaXNCdWZmZXIgKSBvYmplY3RzWyBwb3MgXSA9IG9iaiA9IGN0b3IuZnJvbSggb2JqICk7XHJcbiAgICAgICAgICAgIGVsc2Ugb2JqZWN0c1sgcG9zIF0gPSBvYmogPSBuZXcgY3Rvciggb2JqICk7XHJcblxyXG4gICAgICAgICAgICBjdXJzb3IrKztcclxuXHJcbiAgICAgICAgfVxyXG5cclxuXHJcblxyXG4gICAgICAgIHJldHVybiBvYmo7XHJcbiAgICB9XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiB0b0J1ZmZlciggc3JjICl7XHJcbiAgICBjb25zdCBvdXQgPSBbXTtcclxuXHJcbiAgICBjb25zdCBkYWIgPSBuZXcgRmxvYXQ2NEFycmF5KDEpO1xyXG4gICAgY29uc3QgYmFiID0gbmV3IFVpbnQ4QXJyYXkoZGFiLmJ1ZmZlcik7XHJcbiAgICBjb25zdCBzYWIgPSBuZXcgSW50MzJBcnJheShkYWIuYnVmZmVyKTtcclxuICAgIGNvbnN0IGZhYiA9IG5ldyBGbG9hdDMyQXJyYXkoZGFiLmJ1ZmZlcik7XHJcblxyXG4gICAgdmFyIHA9MDtcclxuXHJcbiAgICBmb3IoIHZhciBpPTAsIGw9c3JjLmxlbmd0aDsgaTxsOyArK2kgKXtcclxuICAgICAgICB2YXIgdmFsdWUgPSBzcmNbaV0sXHJcbiAgICAgICAgICAgIHR5cGUgPSB0eXBlb2YgdmFsdWU7XHJcblxyXG4gICAgICAgIHN3aXRjaCggdHlwZSApe1xyXG4gICAgICAgIGNhc2UgXCJib29sZWFuXCI6IC8vIDEsIDJcclxuICAgICAgICAgICAgb3V0W3ArK10gPSAxKyh2YWx1ZXwwKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgIGNhc2UgXCJudW1iZXJcIjpcclxuICAgICAgICAgICAgdmFyIGlzRmxvYXQgPSBNYXRoLmZsb29yKCB2YWx1ZSApICE9PSB2YWx1ZTtcclxuICAgICAgICAgICAgaWYoIGlzRmxvYXQgKXtcclxuXHJcbiAgICAgICAgICAgICAgICBmYWJbMF0gPSB2YWx1ZTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiggZmFiWzBdID09PSB2YWx1ZSB8fCBpc05hTih2YWx1ZSkgKXtcclxuICAgICAgICAgICAgICAgICAgICBvdXRbcCsrXSA9IDM7XHJcbiAgICAgICAgICAgICAgICAgICAgb3V0W3ArK10gPSBiYWJbMF07IG91dFtwKytdID0gYmFiWzFdO1xyXG4gICAgICAgICAgICAgICAgICAgIG91dFtwKytdID0gYmFiWzJdOyBvdXRbcCsrXSA9IGJhYlszXTtcclxuICAgICAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgICAgIGRhYlswXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIG91dFtwKytdID0gNDtcclxuICAgICAgICAgICAgICAgICAgICBvdXRbcCsrXSA9IGJhYlswXTsgb3V0W3ArK10gPSBiYWJbMV07XHJcbiAgICAgICAgICAgICAgICAgICAgb3V0W3ArK10gPSBiYWJbMl07IG91dFtwKytdID0gYmFiWzNdO1xyXG4gICAgICAgICAgICAgICAgICAgIG91dFtwKytdID0gYmFiWzRdOyBvdXRbcCsrXSA9IGJhYls1XTtcclxuICAgICAgICAgICAgICAgICAgICBvdXRbcCsrXSA9IGJhYls2XTsgb3V0W3ArK10gPSBiYWJbN107XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgICAgIHNhdmVJbnQoIDAsIHZhbHVlICk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxyXG4gICAgICAgICAgICB2YXIgc3RhcnQgPSBwLCByZXN0YXJ0ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHNhdmVJbnQoIDEsIHZhbHVlLmxlbmd0aCApO1xyXG4gICAgICAgICAgICBmb3IoIHZhciBiaT0wLCBibD12YWx1ZS5sZW5ndGg7IGJpPGJsOyArK2JpICl7XHJcbiAgICAgICAgICAgICAgICB2YXIgYnl0ZSA9IHZhbHVlLmNoYXJDb2RlQXQoYmkpO1xyXG4gICAgICAgICAgICAgICAgaWYoIGJ5dGUgPiAweEZGICl7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdGFydCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBvdXRbcCsrXSA9IGJ5dGU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmKCAhcmVzdGFydCApXHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHAgPSBzdGFydDtcclxuICAgICAgICAgICAgc2F2ZUludCggMiwgdmFsdWUubGVuZ3RoICk7XHJcblxyXG4gICAgICAgICAgICBmb3IoIHZhciBiaT0wLCBibD12YWx1ZS5sZW5ndGg7IGJpPGJsOyArK2JpICl7XHJcbiAgICAgICAgICAgICAgICB2YXIgYnl0ZSA9IHZhbHVlLmNoYXJDb2RlQXQoYmkpO1xyXG4gICAgICAgICAgICAgICAgb3V0W3ArK10gPSBieXRlICYgMHhGRjtcclxuICAgICAgICAgICAgICAgIG91dFtwKytdID0gKGJ5dGU+PjgpICYgMHhGRjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY2FzZSBcIm9iamVjdFwiOlxyXG4gICAgICAgICAgICBpZiggdHlwZW9mIHZhbHVlWzJdID09IFwib2JqZWN0XCIgKXtcclxuICAgICAgICAgICAgICAgIHZhciB0eXBlZCA9IG5ldyBVaW50OEFycmF5KCB2YWx1ZVsyXS5idWZmZXIgKTtcclxuXHJcbiAgICAgICAgICAgICAgICBzYXZlSW50KCAzLCAtdHlwZWQubGVuZ3RoICk7XHJcbiAgICAgICAgICAgICAgICBzYXZlSW50KCAwLCB2YWx1ZVswXSApO1xyXG5cclxuICAgICAgICAgICAgICAgIGZvciggdmFyIGJpPTAsIGJsPXR5cGVkLmxlbmd0aDsgYmk8Ymw7ICsrYmkgKXtcclxuICAgICAgICAgICAgICAgICAgICBvdXRbcCsrXSA9IHR5cGVkW2JpXTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgc2F2ZUludCggMywgdmFsdWUubGVuZ3RoICk7XHJcbiAgICAgICAgICAgICAgICBmb3IoIHZhciBiaT0wLCBibD12YWx1ZS5sZW5ndGg7IGJpPGJsOyArK2JpICl7XHJcbiAgICAgICAgICAgICAgICAgICAgc2F2ZUludCggMCwgdmFsdWVbYmldICk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBVaW50OEFycmF5LmZyb20ob3V0KTtcclxuXHJcbiAgICBmdW5jdGlvbiBzYXZlSW50KCB0eXBlLCB2YWx1ZSApe1xyXG5cclxuICAgICAgICB2YXIgYml0Q291bnQgPSBNYXRoLmNlaWwoIE1hdGgubG9nMiggTWF0aC5hYnModmFsdWUpICkgKTtcclxuICAgICAgICB2YXIgYnl0ZSA9IHR5cGUgPDwgNjtcclxuXHJcbiAgICAgICAgaWYoIGJpdENvdW50IDwgMyB8fCB2YWx1ZSA9PT0gLTggKXtcclxuICAgICAgICAgICAgYnl0ZSB8PSAweDMwO1xyXG4gICAgICAgICAgICBieXRlIHw9IHZhbHVlICYgMHhGO1xyXG4gICAgICAgICAgICBvdXRbcCsrXSA9IGJ5dGU7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKCBiaXRDb3VudCA8PSA4KzMgfHwgdmFsdWUgPT09IC0yMDQ4ICl7XHJcbiAgICAgICAgICAgIGJ5dGUgfD0gMHgxMDtcclxuICAgICAgICAgICAgYnl0ZSB8PSAodmFsdWUgPj4+IDgpICYgMHhGO1xyXG4gICAgICAgICAgICBvdXRbcCsrXSA9IGJ5dGU7XHJcbiAgICAgICAgICAgIG91dFtwKytdID0gdmFsdWUgJiAweEZGO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiggYml0Q291bnQgPD0gMTYrMyB8fCB2YWx1ZSA9PT0gLTUyNDI4OCApe1xyXG4gICAgICAgICAgICBieXRlIHw9IDB4MjA7XHJcbiAgICAgICAgICAgIGJ5dGUgfD0gKHZhbHVlID4+PiAxNikgJiAweEY7XHJcbiAgICAgICAgICAgIG91dFtwKytdID0gYnl0ZTtcclxuICAgICAgICAgICAgb3V0W3ArK10gPSAodmFsdWU+Pj44KSAmIDB4RkY7XHJcbiAgICAgICAgICAgIG91dFtwKytdID0gdmFsdWUgJiAweEZGO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBzYWJbMF0gPSB2YWx1ZTtcclxuICAgICAgICBvdXRbcCsrXSA9IGJ5dGU7XHJcbiAgICAgICAgb3V0W3ArK10gPSBiYWJbMF07IG91dFtwKytdID0gYmFiWzFdO1xyXG4gICAgICAgIG91dFtwKytdID0gYmFiWzJdOyBvdXRbcCsrXSA9IGJhYlszXTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBmcm9tQnVmZmVyKCBzcmMgKXtcclxuICAgIGNvbnN0IG91dCA9IFtdO1xyXG4gICAgY29uc3QgZGFiID0gbmV3IEZsb2F0NjRBcnJheSgxKTtcclxuICAgIGNvbnN0IGJhYiA9IG5ldyBVaW50OEFycmF5KGRhYi5idWZmZXIpO1xyXG4gICAgY29uc3Qgc2FiID0gbmV3IEludDMyQXJyYXkoZGFiLmJ1ZmZlcik7XHJcbiAgICBjb25zdCBmYWIgPSBuZXcgRmxvYXQzMkFycmF5KGRhYi5idWZmZXIpO1xyXG5cclxuICAgIHZhciBwb3MgPSAwO1xyXG5cclxuICAgIGZvciggdmFyIGw9c3JjLmxlbmd0aDsgcG9zPGw7IClcclxuICAgICAgICBvdXRbb3V0Lmxlbmd0aF0gPSByZWFkKCk7XHJcblxyXG4gICAgcmV0dXJuIG91dDtcclxuXHJcbiAgICBmdW5jdGlvbiByZWFkKCl7XHJcbiAgICAgICAgdmFyIHRtcDtcclxuICAgICAgICB2YXIgYnl0ZSA9IHNyY1twb3MrK107XHJcbiAgICAgICAgc3dpdGNoKCBieXRlICl7XHJcbiAgICAgICAgY2FzZSAwOiBicmVhaztcclxuICAgICAgICBjYXNlIDE6IHJldHVybiBmYWxzZTtcclxuICAgICAgICBjYXNlIDI6IHJldHVybiB0cnVlO1xyXG4gICAgICAgIGNhc2UgMzogcmV0dXJuIGRlY29kZUZsb2F0MzIoKTtcclxuICAgICAgICBjYXNlIDQ6IHJldHVybiBkZWNvZGVGbG9hdDY0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgdmFyIGhiID0gYnl0ZSA+Pj4gNDtcclxuICAgICAgICB2YXIgbGIgPSBieXRlICYgMHhGO1xyXG4gICAgICAgIHN3aXRjaCggaGIgJiAzICl7XHJcbiAgICAgICAgY2FzZSAwOiAvLyAzMiBiaXQgaW50XHJcbiAgICAgICAgICAgIHRtcCA9IGRlY29kZUludDMyKCk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMTogLy8gMTIgYml0IGludFxyXG4gICAgICAgICAgICB0bXAgPSBzcmNbcG9zKytdIHwgKChsYjw8MjgpPj4yMCk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMjogLy8gMTkgYml0IGludFxyXG4gICAgICAgICAgICB0bXAgPSAoKGxiPDwyOCk+PjEyKSB8IHNyY1twb3NdIHwgKHNyY1twb3MrMV08PDgpO1xyXG4gICAgICAgICAgICBwb3MgKz0gMjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAzOiAvLyA0LWJpdCBpbnRcclxuICAgICAgICAgICAgdG1wID0gKGxiPDwyOCk+PjI4OyBcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN3aXRjaCggaGI+PjIgKXtcclxuICAgICAgICBjYXNlIDA6IHJldHVybiB0bXA7XHJcbiAgICAgICAgY2FzZSAxOiByZXR1cm4gZGVjb2RlU3RyOCggdG1wICk7XHJcbiAgICAgICAgY2FzZSAyOiByZXR1cm4gZGVjb2RlU3RyMTYoIHRtcCApO1xyXG4gICAgICAgIGNhc2UgMzogcmV0dXJuIGRlY29kZUFycmF5KCB0bXAgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGRlY29kZVN0cjgoIHNpemUgKXtcclxuICAgICAgICB2YXIgYWNjID0gXCJcIjtcclxuICAgICAgICBmb3IoIHZhciBpPTA7IGk8c2l6ZTsgKytpIClcclxuICAgICAgICAgICAgYWNjICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoIHNyY1twb3MrK10gKVxyXG4gICAgICAgIHJldHVybiBhY2M7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZGVjb2RlU3RyMTYoIHNpemUgKXtcclxuICAgICAgICB2YXIgYWNjID0gXCJcIjtcclxuICAgICAgICBmb3IoIHZhciBpPTA7IGk8c2l6ZTsgKytpICl7XHJcbiAgICAgICAgICAgIHZhciBoID0gc3JjW3BvcysrXTtcclxuICAgICAgICAgICAgYWNjICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoIChoPDw4KSB8IHNyY1twb3MrK10gKVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gYWNjO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGRlY29kZUFycmF5KCBzaXplICl7XHJcblxyXG4gICAgICAgIHZhciByZXQgPSBbXTtcclxuICAgICAgICBpZiggc2l6ZSA8IDAgKXtcclxuXHJcbiAgICAgICAgICAgIHJldFswXSA9IHJlYWQoKTsgLy8gdHlwZVxyXG4gICAgICAgICAgICByZXRbMV0gPSAtMztcclxuXHJcbiAgICAgICAgICAgIHNpemUgPSAtc2l6ZTtcclxuXHJcbiAgICAgICAgICAgIHZhciBieXRlcyA9IG5ldyBVaW50OEFycmF5KHNpemUpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZm9yKCB2YXIgaT0wOyBpPHNpemU7ICsraSApXHJcbiAgICAgICAgICAgICAgICBieXRlc1tpXSA9IHNyY1twb3MrK11cclxuXHJcbiAgICAgICAgICAgIHJldFsyXSA9IGJ5dGVzLmJ1ZmZlcjtcclxuXHJcbiAgICAgICAgfWVsc2V7XHJcblxyXG4gICAgICAgICAgICBmb3IoIHZhciBpPTA7IGk8c2l6ZTsgKytpIClcclxuICAgICAgICAgICAgICAgIHJldFtpXSA9IHJlYWQoKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcmV0O1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBkZWNvZGVJbnQzMigpe1xyXG4gICAgICAgIGJhYlswXSA9IHNyY1twb3MrK107IGJhYlsxXSA9IHNyY1twb3MrK107XHJcbiAgICAgICAgYmFiWzJdID0gc3JjW3BvcysrXTsgYmFiWzNdID0gc3JjW3BvcysrXTtcclxuICAgICAgICByZXR1cm4gc2FiWzBdO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGRlY29kZUZsb2F0MzIoKXtcclxuICAgICAgICBiYWJbMF0gPSBzcmNbcG9zKytdOyBiYWJbMV0gPSBzcmNbcG9zKytdO1xyXG4gICAgICAgIGJhYlsyXSA9IHNyY1twb3MrK107IGJhYlszXSA9IHNyY1twb3MrK107XHJcbiAgICAgICAgcmV0dXJuIGZhYlswXTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBkZWNvZGVGbG9hdDY0KCl7XHJcbiAgICAgICAgYmFiWzBdID0gc3JjW3BvcysrXTsgYmFiWzFdID0gc3JjW3BvcysrXTtcclxuICAgICAgICBiYWJbMl0gPSBzcmNbcG9zKytdOyBiYWJbM10gPSBzcmNbcG9zKytdO1xyXG4gICAgICAgIGJhYls0XSA9IHNyY1twb3MrK107IGJhYls1XSA9IHNyY1twb3MrK107XHJcbiAgICAgICAgYmFiWzZdID0gc3JjW3BvcysrXTsgYmFiWzddID0gc3JjW3BvcysrXTtcclxuICAgICAgICByZXR1cm4gZGFiWzBdO1xyXG4gICAgfVxyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7IHN0b3JlLCBsb2FkIH07XHJcbiIsIi8vIGxldCB7YmluZCwgaW5qZWN0LCBnZXRJbnN0YW5jZU9mfSA9IHJlcXVpcmUoJy4vbGliL2RyeS1kaS5qcycpO1xyXG5pbXBvcnQge2JpbmQsIGluamVjdCwgZ2V0SW5zdGFuY2VPZn0gZnJvbSAnZHJ5LWRpJztcclxuXHJcblxyXG5pbXBvcnQgQXBwIGZyb20gJy4vQXBwLmpzJztcclxuaW1wb3J0IElTdG9yZSBmcm9tICcuL3N0b3JlL0lTdG9yZS5qcyc7XHJcbmltcG9ydCBOb2RlU3RvcmUgZnJvbSAnLi9zdG9yZS9Ob2RlLmpzJztcclxuaW1wb3J0IE1UIGZyb20gJy4vbGliL210LmpzJztcclxuaW1wb3J0IHsgTW9kZWwsIGJvb3QgfSBmcm9tICcuL2xpYi9tdmMuanMnO1xyXG5cclxuaW1wb3J0ICogYXMgZW50aXRpZXMgZnJvbSAnLi9lbnRpdGllcy8qLmpzJztcclxuaW1wb3J0ICogYXMgY29tcG9uZW50cyBmcm9tICcuL2NvbXBvbmVudHMvKi5qcyc7XHJcbmltcG9ydCAqIGFzIHNjZW5lY29tcG9uZW50cyBmcm9tICcuL3NjZW5lY29tcG9uZW50cy8qLmpzJztcclxuaW1wb3J0ICogYXMgc2NlbmVjb250cm9sbGVycyBmcm9tICcuL3NjZW5lY29udHJvbGxlcnMvKi5qcyc7XHJcblxyXG5mdW5jdGlvbiBtYWtlUk5HKCBzZWVkICl7XHJcbiAgICB2YXIgcm5nID0gbmV3IE1UKCBNYXRoLnJvdW5kKCBzZWVkfHwwICkgKTtcclxuICAgIHJldHVybiBybmcucmFuZG9tLmJpbmQocm5nKTtcclxufVxyXG5cclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcclxuc2V0VGltZW91dCggZnVuY3Rpb24oKXtcclxuXHJcbiAgICBiaW5kKE5vZGVTdG9yZSkudG8oSVN0b3JlKS5zaW5nbGV0b24oKTtcclxuICAgIGJpbmQobWFrZVJORykudG8oXCJSTkdcIikuZmFjdG9yeSgpO1xyXG5cclxuICAgIGZvciggbGV0IGsgaW4gc2NlbmVjb21wb25lbnRzIClcclxuICAgICAgICBiaW5kKHNjZW5lY29tcG9uZW50c1trXSkudG8oaykud2l0aFRhZ3MoeyBzY2VuZWNvbXBvbmVudDp0cnVlIH0pO1xyXG4gICAgZm9yKCBsZXQgayBpbiBzY2VuZWNvbnRyb2xsZXJzIClcclxuICAgICAgICBiaW5kKHNjZW5lY29udHJvbGxlcnNba10pLnRvKGspLndpdGhUYWdzKHsgc2NlbmVjb250cm9sbGVyOnRydWUgfSk7XHJcblxyXG4gICAgYm9vdCh7XHJcbiAgICAgICAgbWFpbjpBcHAsXHJcbiAgICAgICAgZWxlbWVudDpkb2N1bWVudC5ib2R5LFxyXG4gICAgICAgIGNvbXBvbmVudHMsXHJcbiAgICAgICAgZW50aXRpZXMsXHJcbiAgICAgICAgbW9kZWxOYW1lOiAnZGVmYXVsdCdcclxuICAgIH0pO1xyXG5cclxufSwgMjAwMCk7XHJcbn0gKTsiLCJsZXQgZnMgPSBudWxsO1xyXG5cclxuZnVuY3Rpb24gbWtkaXJwKCBiYXNlLCBwYXRoLCBjYWxsYmFjaykge1xyXG4gICAgbGV0IGFjYyA9IGJhc2UgfHwgXCJcIjtcclxuICAgIGxldCBwYXRocyA9IHBhdGguc3BsaXQoL1tcXC9cXFxcXSsvKTtcclxuICAgIHBhdGhzLnBvcCgpOyAvLyByZW1vdmUgbGFzdCBmaWxlL2VtcHR5IGVudHJ5XHJcbiAgICB3b3JrKCk7XHJcbiAgICByZXR1cm47XHJcblxyXG4gICAgZnVuY3Rpb24gd29yaygpe1xyXG4gICAgICAgIGlmKCAhcGF0aHMubGVuZ3RoIClcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHRydWUpO1xyXG4gICAgICAgIGxldCBjdXJyZW50ID0gcGF0aHMuc2hpZnQoKTtcclxuICAgICAgICBmcy5ta2RpciggYWNjICsgY3VycmVudCwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICBpZiggZXJyICYmIGVyci5jb2RlICE9ICdFRVhJU1QnICl7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhmYWxzZSk7XHJcbiAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgYWNjICs9IGN1cnJlbnQgKyAnLyc7XHJcbiAgICAgICAgICAgICAgICB3b3JrKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxufVxyXG5cclxubGV0IG9ubG9hZCA9IFtdLCB3YXNJbml0ID0gZmFsc2U7XHJcbmxldCBsb2NrID0ge307XHJcblxyXG5jbGFzcyBJU3RvcmUge1xyXG5cclxuICAgIHNldCBvbmxvYWQoIGNiICl7XHJcbiAgICAgICAgaWYoIHdhc0luaXQgKVxyXG4gICAgICAgICAgICBjYigpO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgb25sb2FkLnB1c2goY2IpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldCBmcyggX2ZzICl7XHJcblxyXG4gICAgICAgIGlmKCBmcyApIHJldHVybjtcclxuXHJcbiAgICAgICAgZnMgPSBfZnM7XHJcblxyXG4gICAgICAgIG1rZGlycCggdGhpcy5yb290LCBcInN0b3JlL1wiLCAoKSA9PiB7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnJvb3QgKz0gXCJzdG9yZS9cIjtcclxuXHJcbiAgICAgICAgICAgIHdhc0luaXQgPSB0cnVlO1xyXG5cclxuICAgICAgICAgICAgZm9yKCB2YXIgaT0wLCBjYjsgY2I9b25sb2FkW2ldOyArK2kgKVxyXG4gICAgICAgICAgICAgICAgY2IoKTtcclxuXHJcbiAgICAgICAgfSApO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBnZXRUZXh0SXRlbSggaywgY2IgKXtcclxuXHJcbiAgICAgICAgaWYoIGxvY2tba10gKSBjYihsb2NrW2tdICk7XHJcbiAgICAgICAgZWxzZSBmcy5yZWFkRmlsZSggdGhpcy5yb290ICsgaywgXCJ1dGYtOFwiLCAoZXJyLCBkYXRhKSA9PiBjYihkYXRhKSApO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBnZXRJdGVtQnVmZmVyKCBrLCBjYiApe1xyXG5cclxuICAgICAgICAgICAgaWYoIGxvY2tba10gKSBjYihsb2NrW2tdICk7XHJcbiAgICAgICAgICAgIGVsc2V7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlJlYWRpbmcgXCIsIGspO1xyXG4gICAgICAgICAgICAgICAgZnMucmVhZEZpbGUoIHRoaXMucm9vdCArIGssIChlcnIsIGRhdGEpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlJlYWQgXCIsIGssIGVycik7XHJcbiAgICAgICAgICAgICAgICAgICAgY2IoZGF0YSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgc2V0SXRlbSggaywgdiwgY2IgKXtcclxuXHJcbiAgICAgICAgbWtkaXJwKCB0aGlzLnJvb3QsIGssIChzdWNjZXNzKT0+e1xyXG5cclxuICAgICAgICAgICAgaWYoICFzdWNjZXNzICl7XHJcbiAgICAgICAgICAgICAgICBjYihmYWxzZSk7XHJcbiAgICAgICAgICAgIH1lbHNlIGlmKCBsb2NrW2tdICl7XHJcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCB0aGlzLnNldEl0ZW0uYmluZCh0aGlzLCBrLCB2LCBjYiksIDIwMCApO1xyXG4gICAgICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgICAgIGxvY2tba10gPSB2O1xyXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKCB0aGlzLnJvb3QgKyBrLCB2LCAoZXJyKSA9PiB7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBsb2NrW2tdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKCBjYiApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKCFlcnIpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIH1cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gSVN0b3JlO1xyXG4iLCJcclxubGV0IElTdG9yZSA9IHJlcXVpcmUoJy4vSVN0b3JlLmpzJyk7XHJcblxyXG5pZiggd2luZG93LnJlcXVpcmUgKXtcclxuXHJcbiAgICB2YXIgZnMgPSB3aW5kb3cucmVxdWlyZSgnZnMnKTtcclxuICAgIHZhciB7IHJlbW90ZTp7YXBwfSB9ID0gd2luZG93LnJlcXVpcmUoJ2VsZWN0cm9uJyk7XHJcblxyXG4gICAgdmFyIHt3ZWJGcmFtZX0gPSB3aW5kb3cucmVxdWlyZSgnZWxlY3Ryb24nKTtcclxuICAgIHdlYkZyYW1lLnJlZ2lzdGVyVVJMU2NoZW1lQXNQcml2aWxlZ2VkKCdmaWxlJywge30pO1xyXG5cclxufWVsc2V7XHJcblxyXG4gICAgZnMgPSB7XHJcblxyXG4gICAgICAgIG1rZGlyKCBwYXRoLCBjYiApeyBjYigpOyB9LFxyXG5cclxuICAgICAgICByZWFkRmlsZSggcGF0aCwgZW5jLCBjYiApe1xyXG5cclxuXHJcbiAgICAgICAgICAgIHZhciBkYXRhID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oIHBhdGggKTtcclxuXHJcblxyXG4gICAgICAgICAgICBpZiggdHlwZW9mIGVuYyA9PT0gXCJmdW5jdGlvblwiICl7XHJcblxyXG4gICAgICAgICAgICAgICAgY2IgPSBlbmM7XHJcbiAgICAgICAgICAgICAgICBpZiggZGF0YSA9PT0gbnVsbCApXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNiKCBcIkVOT0VOVFwiICk7XHJcblxyXG4gICAgICAgICAgICAgICAgZGF0YSA9IGRhdGEuc3BsaXQoXCIsXCIpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KCBkYXRhLmxlbmd0aCApO1xyXG4gICAgICAgICAgICAgICAgZm9yKCB2YXIgaT0wLCBsPWRhdGEubGVuZ3RoOyBpPGw7ICsraSApXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVyW2ldID0gZGF0YVtpXSB8IDA7XHJcbiAgICAgICAgICAgICAgICBkYXRhID0gYnVmZmVyO1xyXG5cclxuICAgICAgICAgICAgfWVsc2UgaWYoIGRhdGEgPT09IG51bGwgKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNiKCBcIkVOT0VOVFwiICk7XHJcblxyXG4gICAgICAgICAgICBjYiggdW5kZWZpbmVkLCBkYXRhICk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHdyaXRlRmlsZSggcGF0aCwgZGF0YSwgY2IgKXtcclxuXHJcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCBwYXRoLCBkYXRhICk7XHJcbiAgICAgICAgICAgIGNiKHRydWUpO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG59XHJcblxyXG5jbGFzcyBOb2RlU3RvcmUgZXh0ZW5kcyBJU3RvcmUge1xyXG4gICAgXHJcbiAgICBjb25zdHJ1Y3Rvcigpe1xyXG4gICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgIGlmKCBhcHAgKVxyXG4gICAgICAgICAgICB0aGlzLnJvb3QgPSBhcHAuZ2V0UGF0aChcInVzZXJEYXRhXCIpICsgXCIvXCI7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB0aGlzLnJvb3QgPSBcIlwiO1xyXG5cclxuICAgICAgICB0aGlzLmZzID0gZnM7XHJcblxyXG4gICAgfVxyXG5cclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTm9kZVN0b3JlOyJdfQ==

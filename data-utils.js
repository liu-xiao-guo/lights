//from http://jsperf.com/uint8array-vs-array-encode-to-utf8/2
exports.strToUtf8Array = function(str) {
    var n = str.length,
      idx = 0,
      utf8 = new Uint8Array(new ArrayBuffer(n * 4)),
      i, j, c;

    //from http://user1.matsumoto.ne.jp/~goma/js/utf.js
    for (i = 0; i < n; ++i) {
        c = str.charCodeAt(i);
        if (c <= 0x7F) {
            utf8[idx++] = c;
        } else if (c <= 0x7FF) {
            utf8[idx++] = 0xC0 | (c >>> 6);
            utf8[idx++] = 0x80 | (c & 0x3F);
        } else if (c <= 0xFFFF) {
            utf8[idx++] = 0xE0 | (c >>> 12);
            utf8[idx++] = 0x80 | ((c >>> 6) & 0x3F);
            utf8[idx++] = 0x80 | (c & 0x3F);
        } else {
            j = 4;
            while (c >> (6 * j)) j++;
            utf8[idx++] = ((0xFF00 >>> j) & 0xFF) | (c >>> (6 * --j));
            while (j--)
                utf8[idx++] = 0x80 | ((c >>> (6 * j)) & 0x3F);
        }
    }
    return utf8.subarray(0, idx);
}

exports.uintToString = function(uintArray) {
    var encodedString = String.fromCharCode.apply(null, uintArray),
        decodedString = decodeURIComponent(escape(encodedString));
    return decodedString;
}

exports.hexString = function(array) {
    var str = '';
    for(n of array) {
        if (n >= 16)
            str += n.toString(16);
        else
            str += ('0' + n.toString(16));
        str += ' ';
    }
    return str.toUpperCase();
}

//ArrayBuffer to String
exports.hexEncode = function(buffer) {
    var array = new Uint8Array(buffer);
    var str = '';
    for(n of array) {
        if (n >= 16)
            str += n.toString(16);
        else
            str += ('0' + n.toString(16));
    }
    return str;
}

//String to ArrayBuffer
exports.hexDecode = function(str) {
    var length = str.length / 2;
    var array = new Uint8Array(length);
    for (var i = 0; i < length; i++) {
        var substr = str.slice(i * 2, i * 2 + 2);
        array[i] = parseInt(substr, 16);
    }
    return array.buffer;
}

exports.dumpProperties = function(obj) {
    var keys = Object.keys(obj);
    console.log("length: " + keys.length)
    for( var i = 0; i < keys.length; i++ ) {
        var key = keys[ i ];
        var data = key + ' : ' + obj[ key ];
        console.log( data + " type: " + typeof(obj[ key ]) );
    }
}

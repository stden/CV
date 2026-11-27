const { execFileSync } = require('node:child_process');

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_CHANNEL_CHUNKS = new Set(['PLTE', 'IDAT', 'tRNS', 'sBIT', 'bKGD']);
const PNG_FIXED_CHUNKS = { gAMA: 4, cHRM: 32, sRGB: 1, pHYs: 9 };
const JPEG_IMAGE_SEGMENTS = new Set([0xc0, 0xc1, 0xc2, 0xc4, 0xda, 0xdb, 0xdc, 0xdd]);
const WEBP_IMAGE_CHUNKS = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH']);

// Parse container structure and allow only pixel data and known presentation
// chunks. EXIF, XMP, comments, embedded profiles and trailing data fail closed.
function isCleanPng(bytes) {
    if (!bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) return false;
    let offset = PNG_MAGIC.length;
    let hasHeader = false;
    let hasImage = false;
    while (offset + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString('latin1', offset + 4, offset + 8);
        const end = offset + 12 + length;
        if (end > bytes.length) return false;
        if (!hasHeader) {
            if (type !== 'IHDR' || length !== 13) return false;
            hasHeader = true;
        } else if (type === 'IEND') {
            return length === 0 && hasImage && end === bytes.length;
        } else {
            if (type === 'IDAT') hasImage = true;
            if (!PNG_CHANNEL_CHUNKS.has(type) && PNG_FIXED_CHUNKS[type] !== length) return false;
        }
        offset = end;
    }
    return false;
}

function nextJpegSegment(bytes, start) {
    let offset = bytes.indexOf(0xff, start);
    while (offset >= 0 && offset + 1 < bytes.length) {
        let marker = offset + 1;
        while (bytes[marker] === 0xff) marker++;
        const code = bytes[marker];
        if (code !== 0x00 && !(code >= 0xd0 && code <= 0xd7)) return marker - 1;
        offset = bytes.indexOf(0xff, marker + 1);
    }
    return -1;
}

function isCleanJpeg(bytes) {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
    let offset = 2;
    let hasData = false;
    let hasFrame = false;
    while (offset + 1 < bytes.length && bytes[offset] === 0xff) {
        while (bytes[offset + 1] === 0xff) offset++;
        const marker = bytes[offset + 1];
        if (marker === 0xd9) return hasFrame && hasData && offset + 2 === bytes.length;
        if (offset + 4 > bytes.length) return false;
        const length = bytes.readUInt16BE(offset + 2);
        const end = offset + 2 + length;
        if (length < 2 || end > bytes.length) return false;
        if (marker === 0xe0) {
            const payload = bytes.subarray(offset + 4, end);
            const standardJfif = payload.length === 14 && payload.toString('latin1', 0, 5) === 'JFIF\0'
                && payload[12] === 0 && payload[13] === 0;
            if (!standardJfif) return false;
        } else if (!JPEG_IMAGE_SEGMENTS.has(marker)) {
            return false;
        }
        if (marker >= 0xc0 && marker <= 0xc2) hasFrame = true;
        if (marker === 0xda) {
            hasData = true;
            offset = nextJpegSegment(bytes, end);
            if (offset < 0) return false;
        } else {
            offset = end;
        }
    }
    return false;
}

function isCleanWebp(bytes) {
    if (bytes.length < 12 || bytes.toString('latin1', 0, 4) !== 'RIFF'
        || bytes.toString('latin1', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) return false;
    let offset = 12;
    let imageCount = 0;
    while (offset + 8 <= bytes.length) {
        const type = bytes.toString('latin1', offset, offset + 4);
        const length = bytes.readUInt32LE(offset + 4);
        const end = offset + 8 + length;
        if (!WEBP_IMAGE_CHUNKS.has(type) || end > bytes.length) return false;
        if (type === 'VP8X' && (length !== 10 || bytes[offset + 8] & ~0x10)) return false;
        if (type === 'VP8 ' || type === 'VP8L') imageCount++;
        if (length % 2 !== 0 && bytes[end] !== 0) return false;
        offset = end + (length % 2);
    }
    return offset === bytes.length && imageCount === 1;
}

function isCleanDib(bytes, width, height, bitDepth) {
    if (bytes.length < 40 || ![1, 4, 8, 16, 24, 32].includes(bitDepth)) return false;
    if (bytes.readUInt32LE(0) !== 40 || bytes.readInt32LE(4) !== width
        || bytes.readInt32LE(8) !== height * 2 || bytes.readUInt16LE(12) !== 1
        || bytes.readUInt16LE(14) !== bitDepth || bytes.readUInt32LE(16) !== 0) return false;
    const coloursUsed = bytes.readUInt32LE(32);
    if (coloursUsed > (bitDepth <= 8 ? 2 ** bitDepth : 0)) return false;
    const paletteSize = bitDepth <= 8 ? (coloursUsed || 2 ** bitDepth) * 4 : 0;
    const alignedRow = (bits) => Math.ceil(bits / 32) * 4;
    return bytes.length === 40 + paletteSize + height * (alignedRow(width * bitDepth) + alignedRow(width));
}

function isCleanIcon(bytes) {
    if (bytes.length < 22 || bytes.readUInt16LE(0) !== 0 || bytes.readUInt16LE(2) !== 1) return false;
    const count = bytes.readUInt16LE(4);
    const headerSize = 6 + count * 16;
    if (count === 0 || headerSize > bytes.length) return false;
    const entries = Array.from({ length: count }, (_, index) => {
        const start = 6 + index * 16;
        return {
            width: bytes[start] || 256,
            height: bytes[start + 1] || 256,
            reserved: bytes[start + 3],
            bitDepth: bytes.readUInt16LE(start + 6),
            length: bytes.readUInt32LE(start + 8),
            offset: bytes.readUInt32LE(start + 12),
        };
    }).sort((left, right) => left.offset - right.offset);
    let offset = headerSize;
    for (const entry of entries) {
        if (entry.offset !== offset || entry.reserved !== 0 || entry.length === 0) return false;
        offset += entry.length;
        if (offset > bytes.length) return false;
        const payload = bytes.subarray(entry.offset, offset);
        if (!isCleanPng(payload) && !isCleanDib(payload, entry.width, entry.height, entry.bitDepth)) return false;
    }
    return offset === bytes.length;
}

const imageChecks = {
    '.png': isCleanPng,
    '.jpg': isCleanJpeg,
    '.jpeg': isCleanJpeg,
    '.webp': isCleanWebp,
    '.ico': isCleanIcon,
};

function isCleanFont(bytes) {
    return bytes.length >= 48 && bytes.toString('latin1', 0, 4) === 'wOF2'
        && bytes.readUInt32BE(8) === bytes.length && bytes.readUInt16BE(12) > 0
        && bytes.readUInt16BE(14) === 0 && bytes.subarray(28, 48).every((byte) => byte === 0);
}

function pdfOutput(command, args) {
    return execFileSync(command, args, {
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, LC_ALL: 'C' },
    });
}

function inspectPdf(filename) {
    const text = pdfOutput('pdftotext', ['-enc', 'UTF-8', filename, '-']);
    const metadata = pdfOutput('pdfinfo', ['-enc', 'UTF-8', '-custom', filename]);
    const xmp = pdfOutput('pdfinfo', ['-enc', 'UTF-8', '-meta', filename]);
    const links = pdfOutput('pdfinfo', ['-enc', 'UTF-8', '-url', filename]).trim().split(/\r?\n/);
    const javascript = pdfOutput('pdfinfo', ['-enc', 'UTF-8', '-js', filename]);
    const attachments = pdfOutput('pdfdetach', ['-list', filename]);
    return {
        publicText: [text, metadata, xmp, ...links].join('\n'),
        links: links.slice(1).map((line) => line.match(/^\s*\d+\s+\S+\s+(.+)$/)?.[1] ?? ''),
        validText: Boolean(text.trim()),
        activeContent: Boolean(javascript.trim()) || !/^0 embedded files?\s*$/i.test(attachments),
    };
}

module.exports = { imageChecks, inspectPdf, isCleanFont };

const crypto = require('node:crypto');

const UINT32_SPACE = 0x1_0000_0000;

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
}

function createCommit(serverSeed) {
  assertNonEmptyString(serverSeed, 'serverSeed');
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

function verifyCommit(serverSeed, commitHash) {
  if (typeof commitHash !== 'string' || !/^[a-f0-9]{64}$/i.test(commitHash)) return false;

  const expected = Buffer.from(createCommit(serverSeed), 'hex');
  const provided = Buffer.from(commitHash, 'hex');
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

function createByteStream({ serverSeed, clientSeed, nonce = 0 } = {}) {
  assertNonEmptyString(serverSeed, 'serverSeed');
  assertNonEmptyString(clientSeed, 'clientSeed');

  let round = Number(nonce);
  if (!Number.isInteger(round) || round < 0) {
    throw new TypeError('nonce must be a non-negative integer');
  }

  let cursor = 32;
  let block = Buffer.alloc(32);

  return {
    nextUInt32() {
      if (cursor + 4 > 32) {
        block = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${round}`).digest();
        round += 1;
        cursor = 0;
      }

      const value = block.readUInt32BE(cursor);
      cursor += 4;
      return value;
    }
  };
}

function createDeterministicRng(params) {
  const stream = createByteStream(params);

  return (min, max) => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min) {
      throw new TypeError('randomInt bounds must be integers with max > min');
    }

    const range = max - min;
    const unbiasedLimit = Math.floor(UINT32_SPACE / range) * range;

    let value = stream.nextUInt32();
    while (value >= unbiasedLimit) {
      value = stream.nextUInt32();
    }

    return min + (value % range);
  };
}

module.exports = {
  createCommit,
  verifyCommit,
  createDeterministicRng
};

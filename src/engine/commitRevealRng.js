const crypto = require('node:crypto');

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function createCommit(serverSeed, clientSeed, nonce, playerId = '') {
  const payload = `${serverSeed}:${clientSeed}:${nonce}:${playerId}`;
  return sha256(payload);
}

function reveal(serverSeed, clientSeed, nonce, cursor = 0, playerId = '') {
  const commit = createCommit(serverSeed, clientSeed, nonce, playerId);
  const stream = sha256(`${commit}:${cursor}`);
  const value = parseInt(stream.slice(0, 13), 16) / 0x10000000000000;
  return {
    commit,
    value,
    cursor: cursor + 1,
    hash: stream,
  };
}

function createRng(commitReveal) {
  const { serverSeed, clientSeed, nonce, playerId = '' } = commitReveal;
  let cursor = 0;
  return () => {
    const result = reveal(serverSeed, clientSeed, nonce, cursor, playerId);
    cursor = result.cursor;
    return result.value;
  };
}

function verifyCommit({ serverSeed, clientSeed, nonce, expectedCommit, playerId = '' }) {
  return createCommit(serverSeed, clientSeed, nonce, playerId) === expectedCommit;
}

module.exports = {
  createCommit,
  reveal,
  createRng,
  verifyCommit,
};

const crypto = require('node:crypto');
const anchor = require('@coral-xyz/anchor');

function hashSeed(seedBuffer) {
  return crypto.createHash('sha256').update(seedBuffer).digest();
}

function hashHex(seedBuffer) {
  return hashSeed(seedBuffer).toString('hex');
}

function normalizeSeed(seed) {
  if (Buffer.isBuffer(seed) && seed.length === 32) return seed;
  if (typeof seed !== 'string' || !seed.length) throw new Error('seed must be a non-empty string');
  return crypto.createHash('sha256').update(seed).digest();
}

function to32ByteArray(buffer) {
  if (buffer.length === 32) return [...buffer];
  const out = Buffer.alloc(32);
  buffer.copy(out, 0, 0, Math.min(buffer.length, 32));
  return [...out];
}

function nonceToLeBytes(nonce) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(nonce));
  return out;
}

function parsePlayerPubkeyBytes(playerPubkey) {
  try {
    return new anchor.web3.PublicKey(playerPubkey).toBuffer();
  } catch {
    return anchor.web3.PublicKey.default.toBuffer();
  }
}

function createRoundPayload({ serverSeed, clientSeed, nonce, playerId }) {
  const serverSeedBytesBuffer = normalizeSeed(serverSeed);
  const clientSeedBytesBuffer = normalizeSeed(clientSeed);
  const nonceLeBytes = nonceToLeBytes(nonce);
  const playerPubkeyBytes = parsePlayerPubkeyBytes(playerId);
  const clientSeedHash = hashHex(clientSeedBytesBuffer);
  const commitHash = hashHex(
    Buffer.concat([serverSeedBytesBuffer, clientSeedBytesBuffer, nonceLeBytes, playerPubkeyBytes])
  );

  return {
    nonce,
    commitHashHex: commitHash,
    commitHashBytes: to32ByteArray(Buffer.from(commitHash, 'hex')),
    clientSeedHashHex: clientSeedHash,
    clientSeedHashBytes: to32ByteArray(Buffer.from(clientSeedHash, 'hex')),
    clientSeedBytes: to32ByteArray(clientSeedBytesBuffer),
    serverSeedBytes: to32ByteArray(serverSeedBytesBuffer),
  };
}

async function settleRoundOnChain({
  provider,
  programId,
  idl,
  accounts,
  payload,
  payoutLamports,
  jackpotWinLamports = 0,
  nftCollection = anchor.web3.PublicKey.default,
}) {
  if (!provider || !idl || !programId) {
    throw new Error('provider, idl and programId are required');
  }

  const program = new anchor.Program(idl, programId, provider);

  return program.methods
    .revealAndSettle(
      payload.serverSeedBytes,
      payload.clientSeedBytes,
      new anchor.BN(payoutLamports),
      new anchor.BN(jackpotWinLamports),
      nftCollection
    )
    .accounts(accounts)
    .rpc();
}

module.exports = {
  createRoundPayload,
  settleRoundOnChain,
};

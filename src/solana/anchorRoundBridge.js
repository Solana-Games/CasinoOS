const crypto = require('node:crypto');
const anchor = require('@coral-xyz/anchor');
const { createCommit } = require('../engine/commitRevealRng');

function hashSeed(seed) {
  return crypto.createHash('sha256').update(seed).digest();
}

function to32ByteArray(buffer) {
  if (buffer.length === 32) return [...buffer];
  const out = Buffer.alloc(32);
  buffer.copy(out, 0, 0, Math.min(buffer.length, 32));
  return [...out];
}

function createRoundPayload({ serverSeed, clientSeed, nonce, playerId }) {
  const commitHash = createCommit(serverSeed, clientSeed, nonce, playerId);
  return {
    nonce,
    commitHashHex: commitHash,
    commitHashBytes: to32ByteArray(Buffer.from(commitHash, 'hex')),
    clientSeedHashBytes: to32ByteArray(hashSeed(clientSeed)),
    clientSeedBytes: to32ByteArray(Buffer.from(clientSeed.padEnd(32, '0').slice(0, 32))),
    serverSeedBytes: to32ByteArray(Buffer.from(serverSeed.padEnd(32, '0').slice(0, 32))),
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

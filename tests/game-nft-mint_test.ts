import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';

// Utility function to create valid metadata
function createValidMetadata(gameId: number, royaltyPercentage: number = 10): Uint8Array {
  return types.buff(Buffer.from(JSON.stringify({
    game: `Game${gameId}`,
    description: `NFT for game ${gameId}`
  })));
}

Clarinet.test({
  name: "Mint NFT: Successful minting of a new NFT",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const gameId = 1;
    const metadata = createValidMetadata(gameId);
    const royaltyPercentage = 10;

    const block = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "mint-nft", 
        [
          types.uint(gameId), 
          metadata, 
          types.uint(royaltyPercentage)
        ], 
        deployer.address
      )
    ]);

    // Check the block result 
    block.receipts[0].result.expectOk().expectUint(1);

    // Verify metadata retrieval
    const metadataResult = chain.callReadOnlyFn(
      "game-nft-mint", 
      "get-nft-metadata", 
      [types.uint(1)], 
      deployer.address
    );

    const expectedMetadata = {
      'game-id': types.uint(gameId),
      'creator': types.principal(deployer.address),
      'metadata': metadata,
      'royalty-percentage': types.uint(royaltyPercentage)
    };
    metadataResult.result.expectSome().expectTuple(expectedMetadata);
  }
});

Clarinet.test({
  name: "Mint NFT: Prevent minting with invalid royalty percentage",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const gameId = 1;
    const metadata = createValidMetadata(gameId);
    const invalidRoyaltyPercentage = 101; // Over 100%

    const block = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "mint-nft", 
        [
          types.uint(gameId), 
          metadata, 
          types.uint(invalidRoyaltyPercentage)
        ], 
        deployer.address
      )
    ]);

    // Check for invalid metadata error
    block.receipts[0].result.expectErr().expectUint(402);
  }
});

Clarinet.test({
  name: "Mint NFT: Prevent minting beyond collection limit",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    
    // First, set max collection size to a very low number for testing
    const setMaxSizeBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "set-max-collection-size", 
        [types.uint(2)], 
        deployer.address
      )
    ]);

    // Mint two NFTs (should be allowed)
    const mintBlocks1 = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "mint-nft", 
        [
          types.uint(1), 
          createValidMetadata(1), 
          types.uint(10)
        ], 
        deployer.address
      ),
      Tx.contractCall(
        "game-nft-mint", 
        "mint-nft", 
        [
          types.uint(2), 
          createValidMetadata(2), 
          types.uint(10)
        ], 
        deployer.address
      )
    ]);

    // Third mint should fail
    const mintBlock3 = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "mint-nft", 
        [
          types.uint(3), 
          createValidMetadata(3), 
          types.uint(10)
        ], 
        deployer.address
      )
    ]);

    // Verify first two mints succeeded
    mintBlocks1.receipts[0].result.expectOk().expectUint(1);
    mintBlocks1.receipts[1].result.expectOk().expectUint(2);

    // Verify third mint failed due to collection limit
    mintBlock3.receipts[0].result.expectErr().expectUint(403);
  }
});

Clarinet.test({
  name: "Transfer NFT: Successful transfer by owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const recipient = accounts.get("wallet_1")!;

    // First, mint an NFT
    const mintBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "mint-nft", 
        [
          types.uint(1), 
          createValidMetadata(1), 
          types.uint(10)
        ], 
        deployer.address
      )
    ]);
    mintBlock.receipts[0].result.expectOk().expectUint(1);

    // Then, transfer the NFT
    const transferBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "transfer-nft", 
        [
          types.uint(1),  // token-id 
          types.principal(recipient.address)
        ], 
        deployer.address
      )
    ]);

    // Verify successful transfer
    transferBlock.receipts[0].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "Transfer NFT: Prevent transfer by non-owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;
    const wallet2 = accounts.get("wallet_2")!;

    // First, mint an NFT to deployer
    const mintBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "mint-nft", 
        [
          types.uint(1), 
          createValidMetadata(1), 
          types.uint(10)
        ], 
        deployer.address
      )
    ]);
    mintBlock.receipts[0].result.expectOk().expectUint(1);

    // Attempt transfer by non-owner (wallet1)
    const transferBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "transfer-nft", 
        [
          types.uint(1),  // token-id 
          types.principal(wallet2.address)
        ], 
        wallet1.address
      )
    ]);

    // Verify transfer is prevented
    transferBlock.receipts[0].result.expectErr().expectUint(401);
  }
});

Clarinet.test({
  name: "Burn NFT: Successful burning by owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // First, mint an NFT
    const mintBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "mint-nft", 
        [
          types.uint(1), 
          createValidMetadata(1), 
          types.uint(10)
        ], 
        deployer.address
      )
    ]);
    mintBlock.receipts[0].result.expectOk().expectUint(1);

    // Then, burn the NFT
    const burnBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "burn-nft", 
        [types.uint(1)], 
        deployer.address
      )
    ]);

    // Verify successful burn
    burnBlock.receipts[0].result.expectOk().expectBool(true);

    // Verify metadata is deleted
    const metadataResult = chain.callReadOnlyFn(
      "game-nft-mint", 
      "get-nft-metadata", 
      [types.uint(1)], 
      deployer.address
    );
    metadataResult.result.expectNone();
  }
});

Clarinet.test({
  name: "Burn NFT: Prevent burning by non-owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // First, mint an NFT
    const mintBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "mint-nft", 
        [
          types.uint(1), 
          createValidMetadata(1), 
          types.uint(10)
        ], 
        deployer.address
      )
    ]);
    mintBlock.receipts[0].result.expectOk().expectUint(1);

    // Attempt burn by non-owner
    const burnBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "burn-nft", 
        [types.uint(1)], 
        wallet1.address
      )
    ]);

    // Verify burn is prevented
    burnBlock.receipts[0].result.expectErr().expectUint(401);
  }
});

Clarinet.test({
  name: "Admin: Update Max Collection Size",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Successful update by contract owner
    const successBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "set-max-collection-size", 
        [types.uint(5000)], 
        deployer.address
      )
    ]);
    successBlock.receipts[0].result.expectOk().expectBool(true);

    // Prevent update by non-owner
    const failBlock = chain.mineBlock([
      Tx.contractCall(
        "game-nft-mint", 
        "set-max-collection-size", 
        [types.uint(5000)], 
        wallet1.address
      )
    ]);
    failBlock.receipts[0].result.expectErr().expectUint(401);
  }
});
;; Game NFT Minting Contract
;; A secure, feature-rich NFT contract for blockchain-powered gaming platforms

;; Error Constants
(define-constant ERR-NOT-AUTHORIZED u401)
(define-constant ERR-INVALID-METADATA u402)
(define-constant ERR-MINT-LIMIT-REACHED u403)

;; Contract Owner
(define-data-var contract-owner principal tx-sender)

;; NFT Collection Traits
(define-trait nft-collection
  (
    (mint-nft (uint (buff 1200)) (principal) (response uint uint))
    (transfer-nft (uint principal principal) (response bool uint))
    (burn-nft (uint principal) (response bool uint))
    (get-nft-metadata (uint) (response (optional (buff 1200)) uint))
  )
)

;; NFT Metadata Map
;; Stores details for each minted NFT
(define-map nft-metadata 
  uint 
  {
    game-id: uint,           ;; Specific game identifier
    creator: principal,      ;; Original NFT creator
    metadata: (buff 1200),   ;; Flexible metadata storage
    royalty-percentage: uint ;; Royalty for original creator
  }
)

;; Total Minted NFTs Tracking
(define-data-var total-minted uint u0)

;; Maximum NFTs per Game Collection
(define-data-var max-collection-size uint u10000)

;; Authorization Check: Ensure only contract owner can perform admin actions
(define-private (is-contract-owner (sender principal))
  (is-eq sender (var-get contract-owner))
)

;; Retrieve NFT Metadata
(define-read-only (get-nft-metadata (token-id uint))
  (map-get? nft-metadata token-id)
)

;; Mint a New Gaming NFT
;; Parameters:
;; - game-id: Unique identifier for the game collection
;; - metadata: JSON or similar metadata for the NFT
;; - royalty-percentage: Percentage of future sales going to creator
(define-public (mint-nft 
  (game-id uint) 
  (metadata (buff 1200)) 
  (royalty-percentage uint)
)
  (let 
    (
      (token-id (+ (var-get total-minted) u1))
      (current-total (var-get total-minted))
    )
    ;; Validate inputs
    (asserts! (< current-total (var-get max-collection-size)) (err ERR-MINT-LIMIT-REACHED))
    (asserts! (<= royalty-percentage u100) (err ERR-INVALID-METADATA))
    
    ;; Mint the NFT
    (try! (nft-mint? game-mint-collection token-id tx-sender))
    
    ;; Store NFT Metadata
    (map-set nft-metadata token-id {
      game-id: game-id,
      creator: tx-sender,
      metadata: metadata,
      royalty-percentage: royalty-percentage
    })
    
    ;; Update total minted count
    (var-set total-minted token-id)
    
    ;; Return the new token ID
    (ok token-id)
)

;; Transfer NFT with Royalty Handling
(define-public (transfer-nft 
  (token-id uint) 
  (recipient principal)
)
  (let 
    (
      (metadata (unwrap! (map-get? nft-metadata token-id) (err ERR-NOT-AUTHORIZED)))
      (current-owner (unwrap! (nft-get-owner? game-mint-collection token-id) (err ERR-NOT-AUTHORIZED)))
    )
    ;; Validate ownership and authorization
    (asserts! (is-eq tx-sender current-owner) (err ERR-NOT-AUTHORIZED))
    
    ;; Perform NFT transfer
    (try! (nft-transfer? game-mint-collection token-id current-owner recipient))
    
    ;; Optional: Implement royalty payment logic here
    
    (ok true)
  )
)

;; Burn NFT
(define-public (burn-nft (token-id uint))
  (let 
    (
      (current-owner (unwrap! (nft-get-owner? game-mint-collection token-id) (err ERR-NOT-AUTHORIZED)))
    )
    ;; Validate ownership
    (asserts! (is-eq tx-sender current-owner) (err ERR-NOT-AUTHORIZED))
    
    ;; Burn the NFT
    (try! (nft-burn? game-mint-collection token-id current-owner))
    
    ;; Optional: Add cleanup for metadata if needed
    (map-delete nft-metadata token-id)
    
    (ok true)
  )
)

;; Update Maximum Collection Size (Admin Function)
(define-public (set-max-collection-size (new-size uint))
  (begin
    (asserts! (is-contract-owner tx-sender) (err ERR-NOT-AUTHORIZED))
    (var-set max-collection-size new-size)
    (ok true)
  )
)

(define-non-fungible-token game-mint-collection uint)
# Run pre-deployment validation
bash scripts/validate-prod-config.sh

# Expected output:
# ✅ No .env files in repository
# ✅ All secrets in AWS Secrets Manager
# ✅ Insurance policy active: NXM-2026-CASINO
# ✅ GLI certification valid: GLI-2026-1668
# ✅ Solana program deployed on mainnet
# ✅ Database migrations ready
# ✅ Multi-region failover configured

# Execute production deployment
bash scripts/deploy-prod.sh

# Monitor deployment
watch -n 2 'kubectl get pods -n casinoos-elite'
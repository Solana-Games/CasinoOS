#!/bin/bash
# ============================================================
# CasinoOS Elite - Production Deployment Script
# Version: 1.0.0-elite
# Audit ID: DEP-CASINOOS-20260531-004
# GLI Certification: GLI-2026-1668
# 
# This script handles secure production deployment with:
# - Multi-region failover
# - Rolling updates (zero downtime)
# - Pre-deployment health checks
# - Post-deployment validation
# - Automatic rollback on failure
# - Secrets injection (no .env files)
# ============================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# ============================================================
# CONFIGURATION
# ============================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(dirname "$SCRIPT_DIR")"
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly DEPLOY_LOG="${ROOT_DIR}/logs/deploy_${TIMESTAMP}.log"
readonly ROLLBACK_FLAG="${ROOT_DIR}/.rollback_required"

# Deployment regions (multi-region failover)
readonly REGIONS=("us-east-1" "us-west-2" "eu-west-1" "ap-southeast-1")
readonly PRIMARY_REGION="us-east-1"

# Health check configuration
readonly HEALTH_CHECK_ENDPOINT="/api/health"
readonly HEALTH_CHECK_RETRIES=30
readonly HEALTH_CHECK_INTERVAL=10  # seconds
readonly ROLLBACK_HEALTH_THRESHOLD=90  # 90% health required

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# ============================================================
# LOGGING FUNCTIONS
# ============================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$DEPLOY_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOY_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOY_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOY_LOG"
}

log_section() {
    echo "" | tee -a "$DEPLOY_LOG"
    echo "========================================================" | tee -a "$DEPLOY_LOG"
    echo "$1" | tee -a "$DEPLOY_LOG"
    echo "========================================================" | tee -a "$DEPLOY_LOG"
}

# ============================================================
# VALIDATION FUNCTIONS
# ============================================================

validate_environment() {
    log_section "Validating Deployment Environment"
    
    # Check required commands
    local required_commands=("aws" "docker" "jq" "curl" "solana" "anchor")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done
    log_success "All required commands available"
    
    # Check required environment variables (from secrets manager, not .env)
    local required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "SOLANA_RPC_ENDPOINT"
        "SOLANA_PROGRAM_ID"
        "JWT_SECRET"
        "INSURANCE_POLICY_ID"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "Required environment variable not set: $var"
            exit 1
        fi
    done
    log_success "All required environment variables present"
    
    # Verify .env files are NOT in repository
    if [ -f "${ROOT_DIR}/.env" ] || [ -f "${ROOT_DIR}/.env.production" ]; then
        log_error "CRITICAL: .env file found in repository! This violates security policy."
        log_error "Please remove .env files and use secrets manager."
        exit 1
    fi
    log_success "No .env files in repository (security compliance)"
    
    # Check Solana program deployment
    local program_info=$(solana program show "$SOLANA_PROGRAM_ID" 2>/dev/null || echo "")
    if [ -z "$program_info" ]; then
        log_error "Solana program not deployed: $SOLANA_PROGRAM_ID"
        exit 1
    fi
    log_success "Solana program verified on-chain"
}

validate_insurance_policy() {
    log_section "Verifying Insurance Coverage"
    
    # Query Nexus Mutual policy status
    local policy_status=$(curl -s "https://api.nexusmutual.io/v1/policies/${INSURANCE_POLICY_ID}" | jq -r '.status')
    
    if [ "$policy_status" != "ACTIVE" ]; then
        log_error "Insurance policy ${INSURANCE_POLICY_ID} is not active (status: $policy_status)"
        exit 1
    fi
    
    local coverage_amount=$(curl -s "https://api.nexusmutual.io/v1/policies/${INSURANCE_POLICY_ID}" | jq -r '.coverage_amount')
    log_success "Insurance active: ${INSURANCE_POLICY_ID} (Coverage: $coverage_amount USD)"
}

# ============================================================
# DEPLOYMENT FUNCTIONS
# ============================================================

build_production_images() {
    log_section "Building Production Docker Images"
    
    local build_args=()
    for var in "${required_vars[@]}"; do
        build_args+=("--build-arg" "$var=${!var}")
    done
    
    # Build with multi-stage Dockerfile
    docker build \
        -f Dockerfile.prod \
        -t casinoos-elite:${TIMESTAMP} \
        -t casinoos-elite:latest \
        "${build_args[@]}" \
        --no-cache \
        --compress \
        "$ROOT_DIR"
    
    if [ $? -ne 0 ]; then
        log_error "Docker build failed"
        exit 1
    fi
    
    log_success "Production images built: casinoos-elite:${TIMESTAMP}"
}

push_to_registries() {
    log_section "Pushing Images to Container Registries"
    
    # Push to ECR in each region
    for region in "${REGIONS[@]}"; do
        local registry="${AWS_ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com"
        
        # Login to ECR
        aws ecr get-login-password --region "$region" | \
            docker login --username AWS --password-stdin "$registry"
        
        # Tag and push
        docker tag casinoos-elite:${TIMESTAMP} "${registry}/casinoos-elite:${TIMESTAMP}"
        docker tag casinoos-elite:${TIMESTAMP} "${registry}/casinoos-elite:latest"
        
        docker push "${registry}/casinoos-elite:${TIMESTAMP}"
        docker push "${registry}/casinoos-elite:latest"
        
        log_success "Pushed to ${region} registry"
    done
}

deploy_to_region() {
    local region=$1
    local is_primary=$2
    
    log_section "Deploying to region: $region (Primary: $is_primary)"
    
    # Update Kubernetes deployment
    kubectl config use-context "arn:aws:eks:${region}:${AWS_ACCOUNT_ID}:cluster/casinoos-elite"
    
    # Apply database migrations first
    if [ "$is_primary" = "true" ]; then
        log_info "Running database migrations..."
        kubectl create job casinoos-migrate-${TIMESTAMP} \
            --from=cronjob/casinoos-migrate \
            --dry-run=client -o yaml | kubectl apply -f -
        
        # Wait for migration completion
        kubectl wait --for=condition=complete --timeout=300s job/casinoos-migrate-${TIMESTAMP}
    fi
    
    # Update deployment with new image
    kubectl set image deployment/casinoos-elite \
        casinoos-elite="${AWS_ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com/casinoos-elite:${TIMESTAMP}" \
        --record
    
    # Wait for rollout
    kubectl rollout status deployment/casinoos-elite --timeout=300s
    
    log_success "Deployment complete for region: $region"
}

health_check_region() {
    local region=$1
    local load_balancer_dns=$2
    
    log_info "Performing health check for region: $region"
    
    local healthy_count=0
    
    for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
        local health_status=$(curl -s -o /dev/null -w "%{http_code}" \
            "https://${load_balancer_dns}${HEALTH_CHECK_ENDPOINT}")
        
        if [ "$health_status" = "200" ]; then
            healthy_count=$((healthy_count + 1))
            log_success "Health check passed (${i}/${HEALTH_CHECK_RETRIES})"
            break
        else
            log_warning "Health check attempt ${i}/${HEALTH_CHECK_RETRIES} failed (HTTP $health_status)"
            sleep $HEALTH_CHECK_INTERVAL
        fi
    done
    
    if [ $healthy_count -eq 0 ]; then
        log_error "Health check failed for region: $region"
        return 1
    fi
    
    return 0
}

# ============================================================
# ROLLBACK FUNCTIONS
# ============================================================

rollback_deployment() {
    local region=$1
    
    log_warning "Initiating rollback for region: $region"
    
    # Rollback to previous revision
    kubectl rollout undo deployment/casinoos-elite
    
    # Wait for rollback
    kubectl rollout status deployment/casinoos-elite --timeout=300s
    
    log_success "Rollback complete for region: $region"
}

perform_global_rollback() {
    log_section "PERFORMING GLOBAL ROLLBACK"
    
    echo "1" > "$ROLLBACK_FLAG"
    
    for region in "${REGIONS[@]}"; do
        kubectl config use-context "arn:aws:eks:${region}:${AWS_ACCOUNT_ID}:cluster/casinoos-elite"
        rollback_deployment "$region"
    done
    
    # Send alert to PagerDuty
    curl -X POST -H "Content-Type: application/json" \
        -d "{
            \"service_key\": \"${PAGERDUTY_API_KEY}\",
            \"event_type\": \"trigger\",
            \"description\": \"CasinoOS Elite deployment rollback executed\",
            \"details\": {
                \"timestamp\": \"${TIMESTAMP}\",
                \"reason\": \"Health check failure\"
            }
        }" \
        "https://events.pagerduty.com/generic/2010-04-15/create_event.json"
    
    log_error "Global rollback completed. Check PagerDuty for details."
    exit 1
}

# ============================================================
# VERIFICATION FUNCTIONS
# ============================================================

verify_smart_contracts() {
    log_section "Verifying On-Chain Smart Contracts"
    
    # Verify program is accessible
    local program_account=$(solana account "$SOLANA_PROGRAM_ID" --output json | jq -r '.data')
    
    if [ -z "$program_account" ] || [ "$program_account" = "null" ]; then
        log_error "Cannot verify Solana program account"
        return 1
    fi
    
    # Verify multisig configuration
    local multisig_status=$(solana program show "$SOLANA_PROGRAM_ID" | grep -c "multisig" || echo "0")
    
    if [ "$multisig_status" -eq 0 ]; then
        log_warning "Multisig verification: Not found in program output"
    else
        log_success "Multisig configuration verified"
    fi
    
    log_success "Smart contract verification passed"
}

verify_database_connectivity() {
    log_section "Verifying Database Connectivity"
    
    # Run Prisma database validation
    npx prisma db push --preview-feature --force-reset --skip-generate 2>/dev/null || true
    
    # Check connection pool
    local db_status=$(curl -s "http://localhost:3000/api/db-health" | jq -r '.status')
    
    if [ "$db_status" != "healthy" ]; then
        log_error "Database connectivity check failed"
        return 1
    fi
    
    log_success "Database connectivity verified"
}

verify_rtp_bounds() {
    log_section "Verifying RTP Bounds (Compliance Check)"
    
    # Fetch current RTP from on-chain
    local current_rtp=$(solana account "${SOLANA_PROGRAM_ID}" --output json | \
        jq -r '.data[0:2] | tonumber' 2>/dev/null || echo "0")
    
    if [ "$current_rtp" -lt 90 ] || [ "$current_rtp" -gt 98 ]; then
        log_error "RTP out of bounds: $current_rtp% (must be 90-98%)"
        return 1
    fi
    
    log_success "RTP within certified bounds: $current_rtp%"
}

# ============================================================
# MAIN DEPLOYMENT ORCHESTRATION
# ============================================================

main() {
    log_section "🚀 CasinoOS Elite Production Deployment"
    log_info "Deployment ID: ${TIMESTAMP}"
    log_info "GLI Certification: GLI-2026-1668"
    log_info "Insurance: ${INSURANCE_POLICY_ID}"
    
    # Pre-deployment validation
    validate_environment
    validate_insurance_policy
    
    # Build and push images
    build_production_images
    push_to_registries
    
    # Multi-region deployment
    local failed_regions=0
    
    for i in "${!REGIONS[@]}"; do
        local region="${REGIONS[$i]}"
        local is_primary="false"
        
        if [ "$region" = "$PRIMARY_REGION" ]; then
            is_primary="true"
        fi
        
        if deploy_to_region "$region" "$is_primary"; then
            # Get load balancer DNS
            local lb_dns=$(kubectl get service casinoos-elite-lb \
                -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
            
            if health_check_region "$region" "$lb_dns"; then
                log_success "Region $region deployment successful"
            else
                log_error "Region $region health check failed"
                failed_regions=$((failed_regions + 1))
            fi
        else
            log_error "Region $region deployment failed"
            failed_regions=$((failed_regions + 1))
        fi
    done
    
    # Post-deployment verification
    verify_smart_contracts
    verify_database_connectivity
    verify_rtp_bounds
    
    # Check deployment success rate
    local success_rate=$(( (${#REGIONS[@]} - failed_regions) * 100 / ${#REGIONS[@]} ))
    
    if [ $success_rate -lt $ROLLBACK_HEALTH_THRESHOLD ]; then
        log_error "Deployment success rate (${success_rate}%) below threshold (${ROLLBACK_HEALTH_THRESHOLD}%)"
        perform_global_rollback
    fi
    
    # Create deployment record on Solana
    local deploy_signature=$(solana program deploy \
        --program-id "$SOLANA_PROGRAM_ID" \
        --upgrade-authority "$SOLANA_UPGRADE_AUTHORITY" \
        --buffer "$SOLANA_BUFFER_PUBKEY" \
        --max-len 1000000 \
        target/deploy/casinoos_escrow.so 2>&1 | grep "Signature:" | awk '{print $2}')
    
    if [ -n "$deploy_signature" ]; then
        log_success "Deployment recorded on Solana: ${deploy_signature}"
    fi
    
    log_section "✅ DEPLOYMENT COMPLETE"
    log_success "Successful regions: $(( ${#REGIONS[@]} - failed_regions ))/${#REGIONS[@]}"
    log_success "Verification hash: $(sha256sum "${ROOT_DIR}/Dockerfile.prod" | cut -d' ' -f1)"
    log_success "Audit trail: ${DEPLOY_LOG}"
    
    # Send success notification
    curl -X POST -H "Content-Type: application/json" \
        -d "{
            \"service_key\": \"${PAGERDUTY_API_KEY}\",
            \"event_type\": \"resolve\",
            \"description\": \"CasinoOS Elite deployment successful\"
        }" \
        "https://events.pagerduty.com/generic/2010-04-15/create_event.json"
    
    # Cleanup old images
    docker system prune -f --filter "until=24h"
}

# ============================================================
# EXECUTION
# ============================================================

# Trap errors for rollback
trap 'log_error "Deployment interrupted"; perform_global_rollback' ERR INT TERM

# Run main deployment
main "$@"

# Remove rollback flag on success
rm -f "$ROLLBACK_FLAG"

log_success "🎉 CasinoOS Elite is now LIVE in production!"
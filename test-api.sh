#!/bin/bash
# CLI tests for Inventorius API - SKU and Batch creation
# Usage: ./test-api.sh [staging|local]

set -e

ENV="${1:-staging}"

if [ "$ENV" = "staging" ]; then
  BASE_URL="https://staging.computemachines.com"
elif [ "$ENV" = "local" ]; then
  BASE_URL="http://localhost:8000"
else
  echo "Usage: $0 [staging|local]"
  exit 1
fi

echo "Testing against: $BASE_URL"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}PASS${NC}: $1"; }
fail() { echo -e "${RED}FAIL${NC}: $1"; exit 1; }
info() { echo -e "${YELLOW}INFO${NC}: $1"; }

# Generate unique IDs for this test run
# IDs must be prefix + digits only (e.g., SKU000001, BAT000001)
TIMESTAMP=$(date +%s)
# Use last 6 digits of timestamp to keep IDs short
SHORT_TS=${TIMESTAMP: -6}
TEST_SKU_ID="SKU${SHORT_TS}01"
TEST_BATCH_ID="BAT${SHORT_TS}01"
TEST_SKU_CODE_ID="SKU${SHORT_TS}02"

echo ""
echo "Test IDs for this run:"
echo "  SKU: $TEST_SKU_ID"
echo "  Batch: $TEST_BATCH_ID"
echo ""

# ============================================
# Test 1: Check API is up
# ============================================
info "Test 1: API status check"
STATUS=$(curl -s "$BASE_URL/api/status")
if echo "$STATUS" | grep -q '"is-up": true'; then
  pass "API is up"
else
  fail "API is down: $STATUS"
fi

# ============================================
# Test 2: Create SKU
# ============================================
info "Test 2: Create SKU"
SKU_RESPONSE=$(curl -s -X POST "$BASE_URL/api/skus" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$TEST_SKU_ID\",
    \"name\": \"Test Resistor\",
    \"props\": {
      \"_category\": \"resistor\",
      \"resistance\": \"10k\",
      \"package\": \"0805\"
    }
  }")

echo "Response: $SKU_RESPONSE"

if echo "$SKU_RESPONSE" | grep -q "\"Id\""; then
  SKU_URI=$(echo "$SKU_RESPONSE" | grep -o '"Id": "[^"]*"' | cut -d'"' -f4)
  pass "SKU created: $SKU_URI"
else
  fail "SKU creation failed: $SKU_RESPONSE"
fi

# ============================================
# Test 3: Verify SKU exists
# ============================================
info "Test 3: Verify SKU exists"
SKU_GET=$(curl -s "$BASE_URL/api/sku/$TEST_SKU_ID")
echo "Response: $SKU_GET"

if echo "$SKU_GET" | grep -q "\"name\": \"Test Resistor\""; then
  pass "SKU verified"
else
  fail "SKU verification failed: $SKU_GET"
fi

# ============================================
# Test 4: Create Batch (linked to SKU)
# ============================================
info "Test 4: Create Batch"
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$TEST_BATCH_ID\",
    \"sku_id\": \"$TEST_SKU_ID\",
    \"name\": \"Test Batch from DigiKey\",
    \"props\": {
      \"source\": \"DigiKey\",
      \"order_number\": \"12345678\",
      \"cost_per_unit\": \"0.05\"
    }
  }")

echo "Response: $BATCH_RESPONSE"

if echo "$BATCH_RESPONSE" | grep -q "\"Id\""; then
  BATCH_URI=$(echo "$BATCH_RESPONSE" | grep -o '"Id": "[^"]*"' | cut -d'"' -f4)
  pass "Batch created: $BATCH_URI"
else
  fail "Batch creation failed: $BATCH_RESPONSE"
fi

# ============================================
# Test 5: Verify Batch exists
# ============================================
info "Test 5: Verify Batch exists"
BATCH_GET=$(curl -s "$BASE_URL/api/batch/$TEST_BATCH_ID")
echo "Response: $BATCH_GET"

if echo "$BATCH_GET" | grep -q "\"sku_id\": \"$TEST_SKU_ID\""; then
  pass "Batch verified and linked to SKU"
else
  fail "Batch verification failed: $BATCH_GET"
fi

# ============================================
# Test 6: Create SKU with owned code
# ============================================
info "Test 6: Create SKU with owned code"
TEST_CODE="TEST-CODE-${TIMESTAMP}"

SKU_CODE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/skus" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$TEST_SKU_CODE_ID\",
    \"name\": \"SKU with Code\",
    \"owned_codes\": [\"$TEST_CODE\"]
  }")

echo "Response: $SKU_CODE_RESPONSE"

if echo "$SKU_CODE_RESPONSE" | grep -q "\"Id\""; then
  pass "SKU with code created"
else
  fail "SKU with code creation failed: $SKU_CODE_RESPONSE"
fi

# ============================================
# Test 7: Verify code is owned
# ============================================
info "Test 7: Verify code ownership"
SKU_CODE_GET=$(curl -s "$BASE_URL/api/sku/$TEST_SKU_CODE_ID")
echo "Response: $SKU_CODE_GET"

if echo "$SKU_CODE_GET" | grep -q "\"$TEST_CODE\""; then
  pass "Code ownership verified"
else
  fail "Code ownership verification failed: $SKU_CODE_GET"
fi

# ============================================
# Cleanup (optional - comment out to keep test data)
# ============================================
echo ""
info "Cleanup: Deleting test resources"

curl -s -X DELETE "$BASE_URL/api/batch/$TEST_BATCH_ID" > /dev/null
pass "Deleted batch $TEST_BATCH_ID"

curl -s -X DELETE "$BASE_URL/api/sku/$TEST_SKU_ID" > /dev/null
pass "Deleted SKU $TEST_SKU_ID"

curl -s -X DELETE "$BASE_URL/api/sku/$TEST_SKU_CODE_ID" > /dev/null
pass "Deleted SKU $TEST_SKU_CODE_ID"

echo ""
echo "================================"
echo -e "${GREEN}All tests passed!${NC}"

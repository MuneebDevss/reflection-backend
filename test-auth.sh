#!/bin/bash

# Test script for JWT Authentication endpoints
# Make sure the backend server is running before executing this script

BASE_URL="http://localhost:3001"

echo "==================================="
echo "Testing Authentication System"
echo "==================================="
echo ""

# Test 1: Register a new user
echo "1. Testing User Registration..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }')

echo "Response: $REGISTER_RESPONSE"
echo ""

# Extract access token from registration
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Registration failed or user already exists. Trying login..."
  
  # Test 2: Login with existing user
  echo "2. Testing User Login..."
  LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "password123"
    }')
  
  echo "Response: $LOGIN_RESPONSE"
  echo ""
  
  # Extract access token from login
  ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
else
  echo "Registration successful!"
  echo "Access Token: $ACCESS_TOKEN"
  echo ""
fi

# Test 3: Access protected endpoint
if [ ! -z "$ACCESS_TOKEN" ]; then
  echo "3. Testing Protected Endpoint..."
  PROTECTED_RESPONSE=$(curl -s -X GET $BASE_URL/goals \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  
  echo "Response: $PROTECTED_RESPONSE"
  echo ""
  
  echo "4. Testing without token (should fail)..."
  UNAUTH_RESPONSE=$(curl -s -X GET $BASE_URL/goals)
  
  echo "Response: $UNAUTH_RESPONSE"
  echo ""
else
  echo "Failed to obtain access token"
fi

echo "==================================="
echo "Testing Complete"
echo "==================================="

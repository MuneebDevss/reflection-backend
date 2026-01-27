#!/usr/bin/env bash

# Test script for the Daily Task Engine API

echo "Testing Daily Task Engine API"
echo "=============================="
echo ""

# Get the goal ID from user or use default
GOAL_ID="${1:-test-goal-id}"
API_BASE="http://localhost:3001"

echo "Using Goal ID: $GOAL_ID"
echo ""

# Test 1: Get today's tasks
echo "Test 1: GET /goals/$GOAL_ID/today-tasks"
curl -s -X GET "$API_BASE/goals/$GOAL_ID/today-tasks" | jq .
echo ""
echo ""

# Test 2: Generate tasks for today
echo "Test 2: POST /goals/$GOAL_ID/generate-tasks"
curl -s -X POST "$API_BASE/goals/$GOAL_ID/generate-tasks" | jq .
echo ""
echo ""

# Test 3: Get today's tasks again (should show generated tasks)
echo "Test 3: GET /goals/$GOAL_ID/today-tasks (after generation)"
RESPONSE=$(curl -s -X GET "$API_BASE/goals/$GOAL_ID/today-tasks")
echo "$RESPONSE" | jq .
echo ""

# Test 4: Update task status (if tasks exist)
TASK_ID=$(echo "$RESPONSE" | jq -r '.[0].id // empty')
if [ ! -z "$TASK_ID" ]; then
  echo ""
  echo "Test 4: PATCH /goals/tasks/$TASK_ID/status"
  curl -s -X PATCH "$API_BASE/goals/tasks/$TASK_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"status": "COMPLETED"}' | jq .
  echo ""
else
  echo "No tasks found to update"
fi

echo ""
echo "=============================="
echo "Tests completed!"

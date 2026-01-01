#!/bin/bash
# Simple script to run the Sharp web application

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root to ensure imports work
cd "$PROJECT_ROOT"

# Run the app
python -m uvicorn webapp.app:app --host 0.0.0.0 --port 8000 --reload


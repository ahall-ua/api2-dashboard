#!/bin/bash
# Deploy api2-dashboard on a Linux build agent.
# Usage:
#   1. Copy this folder to the machine (or git pull)
#   2. Edit .env.local with real values
#   3. Run: ./deploy.sh
#
# Requires: docker and docker compose

set -e
cd "$(dirname "$0")"

if [ ! -f .env.local ]; then
  echo "Error: .env.local not found. Copy .env.local.example and fill in values."
  exit 1
fi

echo "Building and starting api2-dashboard..."
docker compose up -d --build

echo ""
echo "Dashboard is running at http://$(hostname):3000"
echo "To view logs:    docker compose logs -f"
echo "To stop:         docker compose stop"
echo "To restart:      docker compose restart"

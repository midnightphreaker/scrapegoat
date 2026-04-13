#!/bin/bash
systemctl stop scrapegoat.service
sync
sleep 1
# git pull  # disabled for local hotfix build
sync
sleep 1
docker system prune --all -f
docker compose -f ./compose.build.yml build --no-cache
sync
sleep 1
systemctl start scrapegoat.service

#!/bin/bash
systemctl stop scrapegoat.service
sync
sleep 1
git pull
sync
sleep 1
docker system prune --all -f
docker compose -f ./docker-compose-build-containers.yml build --no-cache
sync
sleep 1
systemctl start scrapegoat.service

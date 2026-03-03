#!/bin/bash
docker system prune --all -f
docker compose -f ./docker-compose-build-containers.yml build --no-cache

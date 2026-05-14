#!/bin/bash

DOCKER_BUILDKIT=1 docker build -t k3d-registry.localhost:55000/daemun:local ..
docker push k3d-registry.localhost:55000/daemun:local

HELM_REPO_NAME=jameswynn
HELM_REPO_URL=https://jameswynn.github.io/helm-charts

if ! helm repo list | grep $HELM_REPO_URL > /dev/null; then
  helm repo add $HELM_REPO_NAME $HELM_REPO_URL
  helm repo update
fi

helm upgrade --install daemun jameswynn/homepage -f k3d-helm-values.yaml
